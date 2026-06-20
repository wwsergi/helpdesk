<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ticket;
use App\Models\TicketTimeEntry;
use Illuminate\Http\Request;

class AssistanceSheetController extends Controller
{
    public function show(Request $request, $ticketId)
    {
        $ticket = Ticket::with([
            'contact',
            'user',
            'timeEntries.agent:id,name',
            'messages' => fn($q) => $q->where('is_solution', true)->latest()->limit(1),
            'messages.user:id,name',
        ])
            ->where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($ticketId);

        $contact = $ticket->contact;
        $timeEntries = $ticket->timeEntries->sortBy('date');
        $ticketMinutes = $timeEntries->sum('duration_minutes');

        $hoursData = null;
        if ($contact && $contact->has_contract && $contact->contract_type === 'hours' && $contact->contract_hours_month) {
            $now = now();
            $consumedThisMonth = TicketTimeEntry::whereHas('ticket', function ($q) use ($contact, $request) {
                $q->where('contact_id', $contact->id)
                    ->where('tenant_id', $request->user()->tenant_id);
            })
                ->whereYear('date', $now->year)
                ->whereMonth('date', $now->month)
                ->sum('duration_minutes');

            $contractedMinutes = $contact->contract_hours_month * 60;
            $remainingMinutes  = max(0, $contractedMinutes - $consumedThisMonth);

            $hoursData = [
                'contracted_minutes'  => $contractedMinutes,
                'consumed_minutes'    => $consumedThisMonth,
                'this_ticket_minutes' => $ticketMinutes,
                'remaining_minutes'   => $remainingMinutes,
            ];
        }

        return response()->json([
            'ticket' => [
                'id'          => $ticket->id,
                'uuid'        => $ticket->uuid,
                'subject'     => $ticket->subject,
                'description' => $ticket->description,
                'status'      => $ticket->status,
                'priority'    => $ticket->priority,
                'created_at'  => $ticket->created_at,
                'solution'    => $ticket->messages->first()?->body,
            ],
            'contact' => $contact ? [
                'name'                  => $contact->name,
                'email'                 => $contact->email,
                'phone'                 => $contact->phone,
                'contact_person'        => $contact->contact_person,
                'has_contract'          => $contact->has_contract,
                'contract_type'         => $contact->contract_type,
                'contract_hours_month'  => $contact->contract_hours_month,
                'contract_end_date'     => $contact->contract_end_date,
                'contract_notes'        => $contact->contract_notes,
            ] : null,
            'agent' => $ticket->user ? [
                'name'  => $ticket->user->name,
                'email' => $ticket->user->email,
                'level' => $ticket->user->level,
            ] : null,
            'time_entries' => $timeEntries->map(fn($e) => [
                'id'               => $e->id,
                'date'             => $e->date,
                'description'      => $e->description,
                'assistance_type'  => $e->assistance_type,
                'duration_minutes' => $e->duration_minutes,
                'agent_name'       => $e->agent?->name,
            ])->values(),
            'total_minutes' => $ticketMinutes,
            'hours_data'    => $hoursData,
            'generated_at'  => now()->toIso8601String(),
        ]);
    }
}
