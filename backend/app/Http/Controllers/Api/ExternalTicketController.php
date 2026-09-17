<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\Ticket;
use App\Models\TicketMessage;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ExternalTicketController extends Controller
{
    public function store(Request $request)
    {
        // Validate shared secret
        $key = $request->header('X-Claudia-Key');
        if (!$key || $key !== env('CLAUDIA_WEBHOOK_SECRET')) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'customer_identifier' => 'required|string|max:255',
            'identifier_type'     => 'required|in:email,id',
            'description'         => 'required|string',
        ]);

        $tenantId    = (int) env('HELPDESK_DEFAULT_TENANT_ID', 1);
        $identifier  = $validated['customer_identifier'];
        $subject     = 'Ticket from chatbot: ' . $identifier;

        // Chatbot ticket type (id=7)
        $chatbotTypeId = \App\Models\TicketType::where('name', 'Chatbot')->value('id');

        // Find or create contact by email or external_id
        if ($validated['identifier_type'] === 'email') {
            $contact = Contact::firstOrCreate(
                ['tenant_id' => $tenantId, 'email' => $identifier],
                ['name' => $identifier],
            );
        } else {
            $contact = Contact::firstOrCreate(
                ['tenant_id' => $tenantId, 'external_id' => $identifier],
                ['name' => $identifier],
            );
        }

        // Claud-IA bot user as creator
        $botUser = User::where('tenant_id', $tenantId)
            ->where('email', 'claudia@system.local')
            ->first()
            ?? User::where('tenant_id', $tenantId)
                ->whereIn('role', ['admin', 'agent'])
                ->orderBy('id')
                ->first();

        if (!$botUser) {
            return response()->json(['message' => 'No agent/admin found for tenant'], 500);
        }

        $ticket = Ticket::create([
            'uuid'           => 'TKT-' . strtoupper(Str::random(6)),
            'tenant_id'      => $tenantId,
            'contact_id'     => $contact->id,
            'subject'        => $subject,
            'description'    => $validated['description'],
            'status'         => 'NEW',
            'priority'       => 'P3',
            'ticket_type_id' => $chatbotTypeId,
            'created_by_id'  => $botUser->id,
            'channel'        => 'chat',
        ]);

        TicketMessage::create([
            'ticket_id'      => $ticket->id,
            'user_id'        => $botUser->id,
            'is_internal'    => false,
            'body'           => $validated['description'],
            'channel_source' => 'chat',
        ]);

        return response()->json(['uuid' => $ticket->uuid, 'id' => $ticket->id], 201);
    }
}
