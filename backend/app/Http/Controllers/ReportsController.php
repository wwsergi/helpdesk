<?php

namespace App\Http\Controllers;

use App\Models\Ticket;
use App\Models\User;
use App\Models\TicketTimeEntry;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportsController extends Controller
{
    private function applyFilters($query, Request $request, string $prefix = '')
    {
        $p = $prefix ? $prefix . '.' : '';
        if ($request->has('from')) {
            $query->whereDate("{$p}created_at", '>=', $request->from);
        }
        if ($request->has('to')) {
            $query->whereDate("{$p}created_at", '<=', $request->to);
        }
        if ($request->has('contact_id') && $request->contact_id) {
            $query->where("{$p}contact_id", $request->contact_id);
        }
        if ($request->has('category_ids') && is_array($request->category_ids) && count($request->category_ids)) {
            $query->whereIn("{$p}category_id", $request->category_ids);
        }
    }

    public function overallStats(Request $request)
    {
        $query = Ticket::query()->where('tenant_id', $request->user()->tenant_id);
        $this->applyFilters($query, $request);

        $totalTickets = (clone $query)->count();

        $statusCounts = $query->select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->get()
            ->pluck('count', 'status')
            ->toArray();

        return response()->json(['overview' => [
            'total_tickets'    => $totalTickets,
            'new'              => $statusCounts['NEW'] ?? 0,
            'open'             => $statusCounts['OPEN'] ?? 0,
            'in_progress'      => $statusCounts['IN_PROGRESS'] ?? 0,
            'pending_customer' => $statusCounts['PENDING_CUSTOMER'] ?? 0,
            'resolved'         => $statusCounts['RESOLVED'] ?? 0,
            'closed'           => $statusCounts['CLOSED'] ?? 0,
        ]]);
    }

    public function agentStats(Request $request)
    {
        $query = Ticket::query()->where('tenant_id', $request->user()->tenant_id);
        $this->applyFilters($query, $request);

        $ticketsByAgent = (clone $query)
            ->select('user_id', 'status', DB::raw('count(*) as count'))
            ->groupBy('user_id', 'status')
            ->get();

        // Time logged by each agent on matching tickets
        $ticketIds = (clone $query)->pluck('id');
        $timeTotals = TicketTimeEntry::whereIn('ticket_id', $ticketIds)
            ->select('agent_id', DB::raw('sum(duration_minutes) as total_minutes'))
            ->groupBy('agent_id')
            ->get()
            ->keyBy('agent_id');

        $agentIds = $ticketsByAgent->pluck('user_id')->unique()->filter();
        $agents = User::whereIn('id', $agentIds)->get()->keyBy('id');

        $agentStats = [];

        $unassignedCounts = $ticketsByAgent->where('user_id', null)->pluck('count', 'status')->toArray();
        if (!empty($unassignedCounts)) {
            $agentStats[] = [
                'agent_id'         => null,
                'agent_name'       => 'Unassigned',
                'total'            => array_sum($unassignedCounts),
                'new'              => $unassignedCounts['NEW'] ?? 0,
                'open'             => $unassignedCounts['OPEN'] ?? 0,
                'in_progress'      => $unassignedCounts['IN_PROGRESS'] ?? 0,
                'pending_customer' => $unassignedCounts['PENDING_CUSTOMER'] ?? 0,
                'resolved'         => $unassignedCounts['RESOLVED'] ?? 0,
                'closed'           => $unassignedCounts['CLOSED'] ?? 0,
                'total_minutes'    => 0,
            ];
        }

        foreach ($agents as $agentId => $agent) {
            $agentTickets = $ticketsByAgent->where('user_id', $agentId)->pluck('count', 'status')->toArray();
            $agentStats[] = [
                'agent_id'         => $agentId,
                'agent_name'       => $agent->name,
                'total'            => array_sum($agentTickets),
                'new'              => $agentTickets['NEW'] ?? 0,
                'open'             => $agentTickets['OPEN'] ?? 0,
                'in_progress'      => $agentTickets['IN_PROGRESS'] ?? 0,
                'pending_customer' => $agentTickets['PENDING_CUSTOMER'] ?? 0,
                'resolved'         => $agentTickets['RESOLVED'] ?? 0,
                'closed'           => $agentTickets['CLOSED'] ?? 0,
                'total_minutes'    => (int) ($timeTotals[$agentId]->total_minutes ?? 0),
            ];
        }

        usort($agentStats, fn($a, $b) => $b['total'] - $a['total']);

        return response()->json(['by_agent' => $agentStats]);
    }

    public function customerStats(Request $request)
    {
        $query = Ticket::query()->where('tenant_id', $request->user()->tenant_id);
        $this->applyFilters($query, $request);

        $ticketsByCustomer = (clone $query)
            ->select('contact_id', 'status', DB::raw('count(*) as count'))
            ->with('contact:id,name')
            ->groupBy('contact_id', 'status')
            ->get();

        $ticketIds = (clone $query)->pluck('id');
        $timeTotals = TicketTimeEntry::whereIn('ticket_id', $ticketIds)
            ->join('tickets', 'ticket_time_entries.ticket_id', '=', 'tickets.id')
            ->select('tickets.contact_id', DB::raw('sum(ticket_time_entries.duration_minutes) as total_minutes'))
            ->groupBy('tickets.contact_id')
            ->get()
            ->keyBy('contact_id');

        $customerStats = [];
        foreach ($ticketsByCustomer->groupBy('contact_id') as $customerId => $tickets) {
            $statusCounts = $tickets->pluck('count', 'status')->toArray();
            $customer = $tickets->first()->contact;
            $customerStats[] = [
                'customer_id'      => $customerId,
                'customer_name'    => $customer ? $customer->name : 'Unknown',
                'total'            => array_sum($statusCounts),
                'new'              => $statusCounts['NEW'] ?? 0,
                'open'             => $statusCounts['OPEN'] ?? 0,
                'in_progress'      => $statusCounts['IN_PROGRESS'] ?? 0,
                'pending_customer' => $statusCounts['PENDING_CUSTOMER'] ?? 0,
                'resolved'         => $statusCounts['RESOLVED'] ?? 0,
                'closed'           => $statusCounts['CLOSED'] ?? 0,
                'total_minutes'    => (int) ($timeTotals[$customerId]->total_minutes ?? 0),
            ];
        }

        usort($customerStats, fn($a, $b) => $b['total'] - $a['total']);

        return response()->json(['by_customer' => $customerStats]);
    }

    public function distributorStats(Request $request)
    {
        $query = Ticket::query()->where('tickets.tenant_id', $request->user()->tenant_id);

        if ($request->has('from')) {
            $query->whereDate('tickets.created_at', '>=', $request->from);
        }
        if ($request->has('to')) {
            $query->whereDate('tickets.created_at', '<=', $request->to);
        }
        if ($request->has('contact_id') && $request->contact_id) {
            $query->where('tickets.contact_id', $request->contact_id);
        }
        if ($request->has('category_ids') && is_array($request->category_ids) && count($request->category_ids)) {
            $query->whereIn('tickets.category_id', $request->category_ids);
        }

        // Get ticket IDs for time totals (before the JOIN)
        $ticketIds = (clone $query)->pluck('tickets.id');

        $timeTotalsByDistributor = TicketTimeEntry::whereIn('ticket_time_entries.ticket_id', $ticketIds)
            ->join('tickets as t2', 'ticket_time_entries.ticket_id', '=', 't2.id')
            ->join('contacts as c2', 't2.contact_id', '=', 'c2.id')
            ->select('c2.distributor_id', DB::raw('sum(ticket_time_entries.duration_minutes) as total_minutes'))
            ->groupBy('c2.distributor_id')
            ->get()
            ->keyBy('distributor_id');

        $ticketsByDistributor = $query
            ->join('contacts', 'tickets.contact_id', '=', 'contacts.id')
            ->select('contacts.distributor_id', 'tickets.status', DB::raw('count(*) as count'))
            ->groupBy('contacts.distributor_id', 'tickets.status')
            ->get();

        $conversiaStats = ['distributor_name' => 'Conversia', 'total' => 0, 'new' => 0, 'open' => 0, 'in_progress' => 0, 'pending_customer' => 0, 'resolved' => 0, 'closed' => 0, 'total_minutes' => 0];
        $winworldStats  = ['distributor_name' => 'Winworld',  'total' => 0, 'new' => 0, 'open' => 0, 'in_progress' => 0, 'pending_customer' => 0, 'resolved' => 0, 'closed' => 0, 'total_minutes' => 0];

        foreach ($ticketsByDistributor->groupBy('distributor_id') as $distributorId => $tickets) {
            $statusCounts = $tickets->pluck('count', 'status')->toArray();
            $total = array_sum($statusCounts);
            $minutes = (int) ($timeTotalsByDistributor[$distributorId]->total_minutes ?? 0);

            $target = ((string) $distributorId === '1') ? 'conversia' : 'winworld';
            $ref = &$$target.'Stats';
            $ref['total']            += $total;
            $ref['new']              += $statusCounts['NEW'] ?? 0;
            $ref['open']             += $statusCounts['OPEN'] ?? 0;
            $ref['in_progress']      += $statusCounts['IN_PROGRESS'] ?? 0;
            $ref['pending_customer'] += $statusCounts['PENDING_CUSTOMER'] ?? 0;
            $ref['resolved']         += $statusCounts['RESOLVED'] ?? 0;
            $ref['closed']           += $statusCounts['CLOSED'] ?? 0;
            $ref['total_minutes']    += $minutes;
        }

        $distributorStats = [];
        if ($conversiaStats['total'] > 0) $distributorStats[] = $conversiaStats;
        if ($winworldStats['total'] > 0)  $distributorStats[] = $winworldStats;

        usort($distributorStats, fn($a, $b) => $b['total'] - $a['total']);

        return response()->json(['by_distributor' => $distributorStats]);
    }
}
