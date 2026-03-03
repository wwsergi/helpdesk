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
        $query = Ticket::with(['contact', 'user', 'queue', 'messages.user', 'messages.contact'])
            ->where('tenant_id', $request->user()->tenant_id);

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by priority
        if ($request->has('priority')) {
            $query->where('priority', $request->priority);
        }

        // Filter by assigned user (for agents)
        if ($request->has('assigned_to_me') && $request->assigned_to_me) {
            $query->where('user_id', $request->user()->id);
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

            $query->where('contact_id', $contact->id)
                ->whereNull('parent_ticket_id');
        }

        $tickets = $query->orderBy('created_at', 'desc')->paginate(20);

        return response()->json($tickets);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'subject' => 'required_without:parent_ticket_id|string|max:255',
            'description' => 'required|string',
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
        ]);

        // Subticket Logic
        $subject = $validated['subject'] ?? null;
        $status = 'NEW';
        $contactId = $validated['contact_id'] ?? null;

        if (!empty($validated['parent_ticket_id'])) {
            $parentTicket = Ticket::where('tenant_id', $request->user()->tenant_id)
                ->findOrFail($validated['parent_ticket_id']);

            // Inherit subject from parent
            $subject = $parentTicket->subject;

            // Subtickets start as IN_PROGRESS if assigned (which they should be)
            // But let's trust the default logic or set it here if assigned
            $status = 'IN_PROGRESS'; // Default for subtickets as they differ from customer tickets

            // Keep contact_id null for internal tickets or maybe link to primary contact? 
            // Spec says "Subtickets have their own operational data". 
            // For now, let's leave contact_id as passed or null.
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
            'subject' => $subject, // Use determined subject
            'description' => $validated['description'],
            'status' => $status, // Use determined status
            'priority' => $validated['priority'],
            'ticket_type_id' => $validated['ticket_type_id'] ?? null,
            'category_id' => $validated['category_id'] ?? null,
            'parent_ticket_id' => $validated['parent_ticket_id'] ?? null,
            'user_id' => $validated['user_id'] ?? null,
            'channel' => 'web',
        ]);

        // Create initial message from description
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

        return response()->json($ticket->load(['contact', 'user', 'queue', 'messages.user', 'messages.contact', 'messages.attachments']), 201);
    }

    public function show(Request $request, $id)
    {
        $ticket = Ticket::with(['contact', 'user', 'queue', 'messages.user', 'messages.contact', 'messages.attachments', 'children.user', 'children.queue'])
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
            'status' => 'nullable|in:NEW,IN_PROGRESS,PENDING_CUSTOMER,RESOLVED',
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

        $contactId = null;

        // For customers, check permission and get contact_id
        if ($request->user()->role === 'customer') {
            $contact = \App\Models\Contact::where('email', $request->user()->email)
                ->where('tenant_id', $request->user()->tenant_id)
                ->first();

            if (!$contact || $ticket->contact_id !== $contact->id) {
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

        // Customers cannot create internal messages
        $isInternal = $request->user()->role === 'customer' ? false : ($validated['is_internal'] ?? false);

        $message = TicketMessage::create([
            'ticket_id' => $ticket->id,
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

        // Mark first response time if applicable
        if (!$ticket->first_response_at && !$isInternal && $request->user()->role !== 'customer') {
            $ticket->update(['first_response_at' => now()]);
        }

        // Status Automation
        if ($request->user()->role === 'customer') {
            // Customer reply -> In Progress (action needed)
            if ($ticket->status !== 'IN_PROGRESS' && $ticket->status !== 'NEW') {
                $ticket->update(['status' => 'IN_PROGRESS']);
            }
        } else {
            // Agent reply
            if (!$isInternal) {
                // Public reply -> Pending Customer
                $ticket->update(['status' => 'PENDING_CUSTOMER']);
            }
            // Internal note -> No status change
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
