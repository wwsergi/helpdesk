<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ticket;
use App\Models\TicketMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class TicketController extends Controller
{
    public function index(Request $request)
    {
        $assignedToMe = $request->has('assigned_to_me') && $request->assigned_to_me;

        $query = Ticket::with(['contact', 'user', 'queue', 'messages.user', 'messages.contact'])
            ->withCount('children')
            ->where('tenant_id', $request->user()->tenant_id);

        // "My Tickets" shows all tickets assigned to me, including subtickets delegated to me.
        // General inbox only shows top-level tickets.
        if ($assignedToMe) {
            $query->where('user_id', $request->user()->id);
        } else {
            $query->whereNull('parent_ticket_id');
        }

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by priority
        if ($request->has('priority')) {
            $query->where('priority', $request->priority);
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
                    ->orWhereHas('messages', function ($messageQuery) use ($searchTerm) {
                        $messageQuery->where('body', 'like', '%' . $searchTerm . '%');
                    })
                    ->orWhereHas('contact', function ($contactQuery) use ($searchTerm) {
                        $contactQuery->where('name', 'like', '%' . $searchTerm . '%')
                            ->orWhere('email', 'like', '%' . $searchTerm . '%');
                    });
            });
        }

        // For customers, only show their own tickets and NOT child tickets (internal delegation)
        if ($request->user()->role === 'customer') {
            $contact = \App\Models\Contact::where('email', $request->user()->email)
                ->where('tenant_id', $request->user()->tenant_id)
                ->first();

            if (!$contact) {
                return response()->json(['data' => [], 'total' => 0]);
            }

            $query->where('contact_id', $contact->id);
        }

        $tickets = $query->orderBy('created_at', 'desc')->paginate(20);

        return response()->json($tickets);
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
            'subject' => $subject,
            'description' => $validated['description'] ?? null,
            'status' => $status,
            'priority' => $validated['priority'],
            'ticket_type_id' => $validated['ticket_type_id'] ?? null,
            'category_id' => $validated['category_id'] ?? null,
            'parent_ticket_id' => $validated['parent_ticket_id'] ?? null,
            'user_id' => $validated['user_id'] ?? null,
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

        return response()->json($ticket->load(['contact', 'user', 'queue', 'messages.user', 'messages.contact', 'messages.attachments']), 201);
    }

    public function show(Request $request, $id)
    {
        $ticket = Ticket::with([
            'contact', 'user', 'queue',
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
            'priority' => 'nullable|in:P1,P2,P3,P4',
            'user_id' => 'nullable|exists:users,id',
            'queue_id' => 'nullable|exists:queues,id',
            'category_id' => 'nullable|exists:categories,id',
            'jira_issue_link' => 'nullable|url',
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

        if (isset($validated['status'])) {
            if ($validated['status'] === 'RESOLVED' && $ticket->status !== 'RESOLVED') {
                $validated['resolved_at'] = now();

                // Rule A: Parent Resolved => All Subtickets Resolved
                $ticket->children()->where('status', '!=', 'RESOLVED')->update([
                    'status' => 'RESOLVED',
                    'resolved_at' => now(),
                    // Add logic to log this if needed, but direct update is fastest
                ]);

            } elseif (in_array($validated['status'], ['NEW', 'IN_PROGRESS', 'PENDING_CUSTOMER'])) {
                // If reopening or moving to active state, clear resolved timestamp
                $validated['resolved_at'] = null;
                $validated['closed_at'] = null;
            }
        }

        $ticket->update($validated);

        // If assigning user and status is NEW, change to IN_PROGRESS
        if (isset($validated['user_id']) && $validated['user_id'] && $ticket->status === 'NEW') {
            $ticket->update(['status' => 'IN_PROGRESS']);
        }

        return response()->json($ticket->load(['contact', 'user', 'queue', 'children'])); // Reload children to reflect changes if any
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

        $message = TicketMessage::create([
            'ticket_id' => $targetTicket->id,
            'contact_id' => $request->user()->role === 'customer' ? $contactId : null,
            'user_id' => $request->user()->role !== 'customer' ? $request->user()->id : null,
            'is_internal' => $isInternal,
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

        // Status Automation (on the parent/target ticket)
        if ($request->user()->role === 'customer') {
            if ($targetTicket->status !== 'IN_PROGRESS' && $targetTicket->status !== 'NEW') {
                $targetTicket->update(['status' => 'IN_PROGRESS']);
            }
        } else {
            if (!$isInternal) {
                $targetTicket->update(['status' => 'PENDING_CUSTOMER']);
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
