<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\Ticket;
use App\Models\TicketMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

class TicketController extends Controller
{
    public function index(Request $request)
    {
        $query = $this->buildFilteredQuery($request);

        if ($query === null) {
            return response()->json(['data' => [], 'total' => 0]);
        }

        $query->with(['contact', 'user', 'creator', 'queue', 'messages.user', 'messages.contact', 'children.user', 'children.creator'])
            ->withCount('children');

        $this->applySort($query, $request);

        // Aggregate totals across ALL filtered tickets (not just current page)
        // Used by the inbox "show total hours" toggle so the total stays
        // consistent while paginating.
        $totalMinutesAll = (int) \DB::table('ticket_time_entries')
            ->whereIn('ticket_id', (clone $query)->reorder()->select('tickets.id'))
            ->sum('duration_minutes');

        $ticketsWithTimeCount = (clone $query)->whereHas('timeEntries')->count();

        $tickets = $query->paginate(20);

        $payload = $tickets->toArray();
        $payload['total_minutes_all'] = $totalMinutesAll;
        $payload['tickets_with_time_count'] = $ticketsWithTimeCount;

        return response()->json($payload);
    }

    /**
     * Export the currently filtered ticket list to an Excel (.xlsx) file.
     * Honours the same filters/sort as the inbox listing (no pagination).
     */
    public function export(Request $request)
    {
        $query = $this->buildFilteredQuery($request);

        if ($query === null) {
            $query = Ticket::query()->whereRaw('1 = 0');
        }

        $query->with('contact');
        $this->applySort($query, $request);

        $tickets = $query->get();

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Asistencias');

        $headers = ['Nº Asistencia', 'Cliente', 'Descripción', 'Fecha', 'Tiempo'];
        $sheet->fromArray($headers, null, 'A1');
        $sheet->getStyle('A1:E1')->getFont()->setBold(true);
        $sheet->getStyle('A1:E1')->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);

        $row = 2;
        foreach ($tickets as $ticket) {
            $minutes = (int) $ticket->time_entries_sum_duration_minutes;
            $sheet->setCellValueExplicit("A{$row}", $ticket->uuid, \PhpOffice\PhpSpreadsheet\Cell\DataType::TYPE_STRING);
            $sheet->setCellValue("B{$row}", $ticket->contact->name ?? '');
            $sheet->setCellValue("C{$row}", $ticket->subject);
            $sheet->setCellValue("D{$row}", optional($ticket->created_at)->format('d/m/Y H:i'));
            $sheet->setCellValue("E{$row}", $this->formatMinutes($minutes));
            $row++;
        }

        foreach (range('A', 'E') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        $writer = new Xlsx($spreadsheet);
        $filename = 'asistencias-' . now()->format('Ymd-His') . '.xlsx';

        return response()->streamDownload(function () use ($writer) {
            $writer->save('php://output');
        }, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    /**
     * Build the ticket query with all inbox filters applied (no ordering or
     * pagination). Returns null when the request resolves to "no results"
     * (e.g. a customer with no matching contact).
     */
    private function buildFilteredQuery(Request $request)
    {
        $assignedToMe = $request->has('assigned_to_me') && $request->assigned_to_me;
        $filterByContact = $request->filled('contact_id') && in_array($request->user()->role, ['agent', 'admin', 'comercial']);

        $query = Ticket::query()
            ->withSum('timeEntries', 'duration_minutes')
            ->where('tenant_id', $request->user()->tenant_id);

        if ($filterByContact) {
            // CRM profile view: show all tickets for this contact (no parent restriction)
            $query->where('contact_id', $request->contact_id);
        } elseif ($assignedToMe) {
            // "My Tickets" shows all tickets assigned to me, including subtickets delegated to me.
            $query->where('user_id', $request->user()->id);
        } else {
            // General inbox only shows top-level tickets.
            $query->whereNull('parent_ticket_id');
        }

        // Filter by status (comma-separated values; DELETED shows soft-deleted tickets)
        if ($request->has('status') && $request->status !== '') {
            $statuses = array_filter(explode(',', $request->status));
            $hasDeleted = in_array('DELETED', $statuses);
            $otherStatuses = array_values(array_filter($statuses, fn($s) => $s !== 'DELETED'));

            if ($hasDeleted && empty($otherStatuses)) {
                $query->withTrashed()->whereNotNull('deleted_at');
            } elseif ($hasDeleted) {
                $query->withTrashed()->where(function ($q) use ($otherStatuses) {
                    $q->whereNotNull('deleted_at')->orWhereIn('status', $otherStatuses);
                });
            } else {
                $query->whereIn('status', $otherStatuses);
            }
        }

        // Filter by priority (comma-separated)
        if ($request->has('priority') && $request->priority !== '') {
            $priorities = array_filter(explode(',', $request->priority));
            if (!empty($priorities)) {
                $query->whereIn('priority', $priorities);
            }
        }

        // Filter by category (comma-separated IDs)
        if ($request->has('category_id') && $request->category_id !== '') {
            $categoryIds = array_filter(explode(',', $request->category_id));
            if (!empty($categoryIds)) {
                $query->whereIn('category_id', $categoryIds);
            }
        }

        // Filter by specific assigned user
        if ($request->has('assigned_to') && $request->assigned_to !== 'all') {
            if ($request->assigned_to === 'unassigned') {
                $query->whereNull('user_id');
            } else {
                $query->where('user_id', $request->assigned_to);
            }
        }

        // Filter by unassigned
        if ($request->has('unassigned') && $request->unassigned) {
            $query->whereNull('user_id');
        }

        // Filter by date range
        if ($request->has('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->has('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        // Search
        if ($request->has('search')) {
            $searchTerm = $request->search;
            $query->where(function ($q) use ($searchTerm) {
                $q->where('subject', 'like', '%' . $searchTerm . '%')
                    ->orWhere('jira_issue_link', 'like', '%' . $searchTerm . '%')
                    ->orWhereHas('messages', function ($messageQuery) use ($searchTerm) {
                        $messageQuery->where('body', 'like', '%' . $searchTerm . '%');
                    })
                    ->orWhereHas('contact', function ($contactQuery) use ($searchTerm) {
                        $contactQuery->where('name', 'like', '%' . $searchTerm . '%')
                            ->orWhere('email', 'like', '%' . $searchTerm . '%');
                    });
            });
        }

        // Filter by client (inbox use — keeps parent ticket restriction)
        if ($request->filled('client_id') && in_array($request->user()->role, ['agent', 'admin', 'comercial'])) {
            $query->where('contact_id', $request->client_id);
        }

        // For customers, only show their own tickets and NOT child tickets (internal delegation)
        if ($request->user()->role === 'customer') {
            $contact = Contact::where('email', $request->user()->email)
                ->where('tenant_id', $request->user()->tenant_id)
                ->first();

            if (!$contact) {
                return null;
            }

            $query->where('contact_id', $contact->id);
        }

        return $query;
    }

    /**
     * Apply ordering to the ticket query based on the `sort` request param.
     * Supports client name (asc/desc) and creation date (asc/desc).
     */
    private function applySort($query, Request $request)
    {
        $sort = $request->get('sort', 'created_desc');

        switch ($sort) {
            case 'client_asc':
            case 'client_desc':
                $dir = $sort === 'client_asc' ? 'asc' : 'desc';
                // Order by the related contact name via a correlated subquery so
                // we don't disturb the withSum/withCount aggregate selects.
                $query->orderBy(
                    Contact::select('name')->whereColumn('contacts.id', 'tickets.contact_id'),
                    $dir
                )->orderBy('tickets.created_at', 'desc');
                break;
            case 'created_asc':
                $query->orderBy('created_at', 'asc');
                break;
            case 'created_desc':
            default:
                $query->orderBy('created_at', 'desc');
                break;
        }
    }

    private function formatMinutes(?int $minutes): string
    {
        if (!$minutes) {
            return '0min';
        }
        $h = intdiv($minutes, 60);
        $m = $minutes % 60;
        return $h > 0 ? "{$h}h {$m}min" : "{$m}min";
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'subject' => 'required_without:parent_ticket_id|string|max:255',
            'description' => 'nullable|string',
            'priority' => 'required|in:P1,P2,P3,P4',
            'ticket_type_id' => 'nullable|exists:ticket_types,id',
            'contact_id' => 'nullable|exists:contacts,id',
            'category_id' => 'nullable|exists:categories,id',
            'parent_ticket_id' => 'nullable|exists:tickets,id',
            'attachments' => 'nullable|array',
            'attachments.*.name' => 'required|string',
            'attachments.*.path' => 'required|string',
            'attachments.*.mime_type' => 'required|string',
            'attachments.*.size' => 'required|integer',
            'user_id' => 'nullable|exists:users,id',
            'comment' => 'nullable|string',
            'contact_name' => 'nullable|string|max:255',
            'contact_phone' => 'nullable|string|max:50',
        ]);

        // Subticket Logic
        $subject = $validated['subject'] ?? null;
        $status = 'NEW';
        $contactId = $validated['contact_id'] ?? null;
        $parentTicket = null;

        if (!empty($validated['parent_ticket_id'])) {
            $parentTicket = Ticket::where('tenant_id', $request->user()->tenant_id)
                ->findOrFail($validated['parent_ticket_id']);

            // Enforce max 2 levels
            if ($parentTicket->parent_ticket_id) {
                return response()->json(['message' => 'Sub-tickets cannot be nested. Only one level of delegation is allowed.'], 422);
            }

            // Auto-generate subject from parent — subticket is a delegation record
            $subject = '[Delegation] ' . $parentTicket->subject;
            $status = 'IN_PROGRESS';
            $contactId = $parentTicket->contact_id;
        }

        // For customers, create or get their contact record
        if ($request->user()->role === 'customer' && !$contactId) {
            // Find or create a contact for this customer user
            $contact = \App\Models\Contact::firstOrCreate(
                [
                    'tenant_id' => $request->user()->tenant_id,
                    'email' => $request->user()->email,
                ],
                [
                    'name' => $request->user()->name,
                ]
            );
            $contactId = $contact->id;
        }

        // Check for assignment to set status
        if (!empty($validated['user_id'])) {
            $status = 'IN_PROGRESS';
        }

        $ticket = Ticket::create([
            'uuid' => 'TKT-' . strtoupper(Str::random(6)),
            'tenant_id' => $request->user()->tenant_id,
            'contact_id' => $contactId,
            'contact_name' => $validated['contact_name'] ?? null,
            'contact_phone' => $validated['contact_phone'] ?? null,
            'subject' => $subject,
            'description' => $validated['description'] ?? null,
            'status' => $status,
            'priority' => $validated['priority'],
            'ticket_type_id' => $validated['ticket_type_id'] ?? null,
            'category_id' => $validated['category_id'] ?? null,
            'parent_ticket_id' => $validated['parent_ticket_id'] ?? null,
            'user_id' => $validated['user_id'] ?? null,
            'created_by_id' => $request->user()->id,
            'channel' => 'web',
        ]);

        if ($parentTicket) {
            // Subticket: post the comment as an internal note on the PARENT ticket conversation
            $assignedAgent = $validated['user_id']
                ? \App\Models\User::find($validated['user_id'])
                : null;
            $agentLabel = $assignedAgent
                ? $assignedAgent->name . ($assignedAgent->level ? ' (L' . $assignedAgent->level . ')' : '')
                : 'Unassigned';
            $commentBody = !empty($validated['comment'])
                ? $validated['comment']
                : 'Delegation created — assigned to ' . $agentLabel . '.';

            TicketMessage::create([
                'ticket_id' => $parentTicket->id,
                'user_id' => $request->user()->id,
                'is_internal' => true,
                'body' => '🔀 **Delegated to ' . $agentLabel . '** [' . $ticket->uuid . '] — ' . $commentBody,
                'channel_source' => 'web',
            ]);
        } else {
            // Regular ticket: create initial message from description
            $message = TicketMessage::create([
                'ticket_id' => $ticket->id,
                'contact_id' => $request->user()->role === 'customer' ? $contactId : null,
                'user_id' => $request->user()->role !== 'customer' ? $request->user()->id : null,
                'is_internal' => false,
                'body' => $validated['description'],
                'channel_source' => 'web',
            ]);

            // Create attachments if provided
            if (!empty($validated['attachments'])) {
                foreach ($validated['attachments'] as $fileData) {
                    if (str_starts_with($fileData['path'], 'attachments/')) {
                        \App\Models\TicketAttachment::create([
                            'ticket_message_id' => $message->id,
                            'name' => $fileData['name'],
                            'path' => $fileData['path'],
                            'mime_type' => $fileData['mime_type'],
                            'size' => $fileData['size'],
                        ]);
                    }
                }
            }
        }

        return response()->json($ticket->load(['contact', 'user', 'creator', 'queue', 'messages.user', 'messages.contact', 'messages.attachments']), 201);
    }

    public function show(Request $request, $id)
    {
        $ticket = Ticket::with([
            'contact', 'user', 'creator', 'queue',
            'messages.user', 'messages.contact', 'messages.attachments',
            'children.user',
            'parent.messages.user', 'parent.messages.contact', 'parent.messages.attachments',
        ])
            ->where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($id);

        // For customers, only show their own tickets and BLOCK child tickets
        if ($request->user()->role === 'customer') {
            // Block access if it's a child ticket
            if ($ticket->parent_ticket_id) {
                abort(403, 'Unauthorized');
            }

            $contact = \App\Models\Contact::where('email', $request->user()->email)
                ->where('tenant_id', $request->user()->tenant_id)
                ->first();

            if (!$contact || $ticket->contact_id !== $contact->id) {
                abort(403, 'Unauthorized');
            }
        }

        return response()->json($ticket);
    }

    public function update(Request $request, $id)
    {
        $ticket = Ticket::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);

        $validated = $request->validate([
            'status' => 'nullable|in:NEW,OPEN,IN_PROGRESS,PENDING_CUSTOMER,RESOLVED,CLOSED',
            'priority' => 'nullable|string|max:50',
            'user_id' => 'nullable|exists:users,id',
            'queue_id' => 'nullable|exists:queues,id',
            'category_id' => 'nullable|exists:categories,id',
            'ticket_type_id' => 'nullable|exists:ticket_types,id',
            'jira_issue_link' => 'nullable|string|max:500',
            'subject' => 'nullable|string|max:255',
            'contact_id' => 'nullable|exists:contacts,id',
            'delegation_comment' => 'nullable|string|max:1000',
        ]);

        // Only agents can update tickets, UNLESS customer is marking as RESOLVED
        if ($request->user()->role === 'customer') {
            // Customers can ONLY update status to RESOLVED
            if (count($validated) === 1 && isset($validated['status']) && $validated['status'] === 'RESOLVED') {
                // Allow
            } else {
                abort(403, 'Unauthorized');
            }
        }

        $previousUserId = $ticket->user_id;
        $delegationComment = $validated['delegation_comment'] ?? null;
        unset($validated['delegation_comment']);

        if (isset($validated['status'])) {
            if ($validated['status'] === 'RESOLVED' && $ticket->status !== 'RESOLVED') {
                $validated['resolved_at'] = now();

                $ticket->children()->where('status', '!=', 'RESOLVED')->update([
                    'status' => 'RESOLVED',
                    'resolved_at' => now(),
                ]);

            } elseif (in_array($validated['status'], ['NEW', 'IN_PROGRESS', 'PENDING_CUSTOMER'])) {
                $validated['resolved_at'] = null;
                $validated['closed_at'] = null;
            }
        }

        $ticket->update($validated);

        // If assigning user and status is NEW, change to IN_PROGRESS
        if (isset($validated['user_id']) && $validated['user_id'] && $ticket->status === 'NEW') {
            $ticket->update(['status' => 'IN_PROGRESS']);
        }

        // Record delegation note when user_id changes
        if (
            isset($validated['user_id']) &&
            $validated['user_id'] != $previousUserId &&
            $request->user()->role !== 'customer'
        ) {
            $newAgent = \App\Models\User::find($validated['user_id']);
            $prevAgent = $previousUserId ? \App\Models\User::find($previousUserId) : null;

            $prevLabel = $prevAgent
                ? $prevAgent->name . ($prevAgent->level ? " (L{$prevAgent->level})" : '')
                : 'Sin asignar';
            $newLabel = $newAgent
                ? $newAgent->name . ($newAgent->level ? " (L{$newAgent->level})" : '')
                : 'Sin asignar';

            $noteBody = "🔀 **Delegado** de {$prevLabel} a {$newLabel}";
            if ($delegationComment) {
                $noteBody .= " — {$delegationComment}";
            }

            \App\Models\TicketMessage::create([
                'ticket_id' => $ticket->id,
                'user_id' => $request->user()->id,
                'body' => $noteBody,
                'is_internal' => true,
                'is_solution' => false,
            ]);
        }

        return response()->json($ticket->load(['contact', 'user', 'queue', 'messages', 'children']));
    }

    public function addMessage(Request $request, $id)
    {
        $ticket = Ticket::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);

        // All messages always live on the parent ticket — single unified conversation.
        // If this is a subticket, transparently redirect to the parent.
        $targetTicket = $ticket->parent_ticket_id
            ? Ticket::where('tenant_id', $request->user()->tenant_id)->findOrFail($ticket->parent_ticket_id)
            : $ticket;

        $contactId = null;

        // For customers, check permission and get contact_id
        if ($request->user()->role === 'customer') {
            $contact = \App\Models\Contact::where('email', $request->user()->email)
                ->where('tenant_id', $request->user()->tenant_id)
                ->first();

            if (!$contact || $targetTicket->contact_id !== $contact->id) {
                abort(403, 'Unauthorized');
            }
            $contactId = $contact->id;
        }

        $validated = $request->validate([
            'body' => 'required|string',
            'is_internal' => 'nullable|boolean',
            'is_solution' => 'nullable|boolean',
            'attachments' => 'nullable|array',
            'attachments.*.name' => 'required|string',
            'attachments.*.path' => 'required|string',
            'attachments.*.mime_type' => 'required|string',
            'attachments.*.size' => 'required|integer',
        ]);

        // L2 agents and subticket conversations are always internal.
        // Customers always public. L1/admin agents choose.
        if ($ticket->parent_ticket_id || $request->user()->level == 2) {
            $isInternal = true;
        } elseif ($request->user()->role === 'customer') {
            $isInternal = false;
        } else {
            $isInternal = $validated['is_internal'] ?? false;
        }

        $isSolution = ($validated['is_solution'] ?? false) && $request->user()->role !== 'customer';

        // Only one solution per ticket — clear any previous
        if ($isSolution) {
            TicketMessage::where('ticket_id', $targetTicket->id)->where('is_solution', true)->update(['is_solution' => false]);
            if (!in_array($targetTicket->status, ['RESOLVED', 'CLOSED'])) {
                $targetTicket->update(['status' => 'RESOLVED']);
            }
        }

        $message = TicketMessage::create([
            'ticket_id' => $targetTicket->id,
            'contact_id' => $request->user()->role === 'customer' ? $contactId : null,
            'user_id' => $request->user()->role !== 'customer' ? $request->user()->id : null,
            'is_internal' => $isInternal,
            'is_solution' => $isSolution,
            'body' => $validated['body'],
            'channel_source' => 'web',
        ]);

        // Create attachments if provided
        if (!empty($validated['attachments'])) {
            foreach ($validated['attachments'] as $fileData) {
                // Security check: ensure path is within attachments folder
                if (str_starts_with($fileData['path'], 'attachments/')) {
                    \App\Models\TicketAttachment::create([
                        'ticket_message_id' => $message->id,
                        'name' => $fileData['name'],
                        'path' => $fileData['path'],
                        'mime_type' => $fileData['mime_type'],
                        'size' => $fileData['size'],
                    ]);
                }
            }
        }

        // Mark first response time if applicable (on the parent/target ticket)
        if (!$targetTicket->first_response_at && !$isInternal && $request->user()->role !== 'customer') {
            $targetTicket->update(['first_response_at' => now()]);
        }

        // Status Automation: only auto-change when the customer replies
        if ($request->user()->role === 'customer') {
            if ($targetTicket->status !== 'IN_PROGRESS' && $targetTicket->status !== 'NEW') {
                $targetTicket->update(['status' => 'IN_PROGRESS']);
            }
        }

        // Auto-create Knowledge Base article when solution is marked
        if ($isSolution) {
            $alreadyExists = \App\Models\KnowledgeBaseArticle::where('ticket_id', $targetTicket->id)->exists();
            if (!$alreadyExists) {
                \App\Models\KnowledgeBaseArticle::create([
                    'tenant_id'    => $targetTicket->tenant_id,
                    'ticket_id'    => $targetTicket->id,
                    'category_id'  => $targetTicket->category_id,
                    'title'        => $targetTicket->subject,
                    'slug'         => \Illuminate\Support\Str::slug($targetTicket->subject . '-' . $targetTicket->id),
                    'content'      => $targetTicket->description ?? '',
                    'solution'     => $validated['body'],
                    'is_published' => true,
                ]);
            } else {
                // Update existing article's solution
                \App\Models\KnowledgeBaseArticle::where('ticket_id', $targetTicket->id)
                    ->update(['solution' => $validated['body']]);
            }
        }

        return response()->json($message->load(['user', 'contact', 'attachments']), 201);
    }

    public function assign(Request $request, $id)
    {
        $ticket = Ticket::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);

        // Only agents can assign tickets
        if ($request->user()->role === 'customer') {
            abort(403, 'Unauthorized');
        }

        $validated = $request->validate([
            'user_id' => 'nullable|exists:users,id',
        ]);

        $ticket->update(['user_id' => $validated['user_id']]);

        // Automation: Assign agent -> In Progress
        if ($validated['user_id'] && $ticket->status === 'NEW') {
            $ticket->update(['status' => 'IN_PROGRESS']);
        }

        return response()->json($ticket->load(['contact', 'user', 'queue']));
    }

    public function destroy(Request $request, $id)
    {
        $ticket = Ticket::where('tenant_id', $request->user()->tenant_id)->findOrFail($id);

        // Only agents can delete tickets
        if ($request->user()->role === 'customer') {
            abort(403, 'Unauthorized');
        }

        $ticket->delete();

        return response()->json(['message' => 'Ticket deleted successfully']);
    }
}
