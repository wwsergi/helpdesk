<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TicketMessage;
use Illuminate\Http\Request;

class TicketMessageController extends Controller
{
    public function update(Request $request, $messageId)
    {
        $message = TicketMessage::with('ticket')->findOrFail($messageId);

        // Ensure message belongs to this tenant
        if ($message->ticket->tenant_id !== $request->user()->tenant_id) {
            abort(403, 'Unauthorized');
        }

        // Cannot edit messages on closed tickets
        if ($message->ticket->status === 'CLOSED') {
            return response()->json(['message' => 'Cannot edit messages on closed tickets.'], 422);
        }

        // Only the agent who wrote the message can edit it (or admin)
        if ($message->user_id !== $request->user()->id && $request->user()->role !== 'admin') {
            abort(403, 'Unauthorized');
        }

        $validated = $request->validate([
            'body' => 'required|string',
        ]);

        $message->update(['body' => $validated['body']]);

        return response()->json($message->load(['user', 'contact', 'attachments']));
    }
}
