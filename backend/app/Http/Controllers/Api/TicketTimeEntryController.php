<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ticket;
use App\Models\TicketTimeEntry;
use Illuminate\Http\Request;

class TicketTimeEntryController extends Controller
{
    public function index(Request $request, $ticketId)
    {
        $ticket = $this->findTicket($request, $ticketId);

        $entries = $ticket->timeEntries()
            ->with('agent:id,name')
            ->orderBy('date', 'desc')
            ->get();

        $totalMinutes = $entries->whereNotNull('duration_minutes')->sum('duration_minutes');

        return response()->json([
            'entries' => $entries,
            'summary' => [
                'total_minutes' => $totalMinutes,
                'total_hours' => round($totalMinutes / 60, 2),
                'remote_minutes' => $entries->where('assistance_type', 'remote')->whereNotNull('duration_minutes')->sum('duration_minutes'),
                'onsite_minutes' => $entries->where('assistance_type', 'onsite')->whereNotNull('duration_minutes')->sum('duration_minutes'),
            ],
        ]);
    }

    public function store(Request $request, $ticketId)
    {
        $ticket = $this->findTicket($request, $ticketId);

        $validated = $request->validate([
            'description'      => 'required|string|max:2000',
            'assistance_type'  => 'required|in:remote,onsite',
            'date'             => 'required|date',
            'duration_minutes' => 'required|integer|min:1',
        ]);

        $entry = $ticket->timeEntries()->create([
            'agent_id'         => $request->user()->id,
            'description'      => $validated['description'],
            'assistance_type'  => $validated['assistance_type'],
            'date'             => $validated['date'],
            'duration_minutes' => $validated['duration_minutes'],
        ]);

        $entry->load('agent:id,name');

        return response()->json($entry, 201);
    }

    public function update(Request $request, $ticketId, $entryId)
    {
        $ticket = $this->findTicket($request, $ticketId);

        $entry = $ticket->timeEntries()->findOrFail($entryId);

        if ($entry->agent_id !== $request->user()->id && $request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $validated = $request->validate([
            'description'      => 'sometimes|string|max:2000',
            'assistance_type'  => 'sometimes|in:remote,onsite',
            'date'             => 'sometimes|date',
            'duration_minutes' => 'sometimes|integer|min:1',
        ]);

        $entry->update($validated);
        $entry->load('agent:id,name');

        return response()->json($entry);
    }

    public function destroy(Request $request, $ticketId, $entryId)
    {
        $ticket = $this->findTicket($request, $ticketId);

        $entry = $ticket->timeEntries()->findOrFail($entryId);

        if ($entry->agent_id !== $request->user()->id && $request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $entry->delete();

        return response()->json(['message' => 'Entry deleted.']);
    }

    private function findTicket(Request $request, $ticketId): Ticket
    {
        return Ticket::where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($ticketId);
    }
}
