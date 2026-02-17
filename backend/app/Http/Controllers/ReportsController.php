<?php

namespace App\Http\Controllers;

use App\Models\Ticket;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportsController extends Controller
{
    /**
     * Get overall statistics with optional date filtering
     */
    public function overallStats(Request $request)
    {
        $query = Ticket::query();

        // Apply tenant filter
        if ($request->user()->tenant_id) {
            $query->where('tenant_id', $request->user()->tenant_id);
        }

        // Apply date range filter
        if ($request->has('from')) {
            $query->whereDate('created_at', '>=', $request->from);
        }
        if ($request->has('to')) {
            $query->whereDate('created_at', '<=', $request->to);
        }

        // Get overview counts by status
        $statusCounts = $query->select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->get()
            ->pluck('count', 'status')
            ->toArray();

        $overview = [
            'total_tickets' => $query->count(),
            'new' => $statusCounts['NEW'] ?? 0,
            'open' => $statusCounts['OPEN'] ?? 0,
            'in_progress' => $statusCounts['IN_PROGRESS'] ?? 0,
            'pending_customer' => $statusCounts['PENDING_CUSTOMER'] ?? 0,
            'resolved' => $statusCounts['RESOLVED'] ?? 0,
            'closed' => $statusCounts['CLOSED'] ?? 0,
        ];

        return response()->json(['overview' => $overview]);
    }

    /**
     * Get statistics by agent
     */
    public function agentStats(Request $request)
    {
        $query = Ticket::query();

        // Apply tenant filter
        if ($request->user()->tenant_id) {
            $query->where('tenant_id', $request->user()->tenant_id);
        }

        // Apply date range filter
        if ($request->has('from')) {
            $query->whereDate('created_at', '>=', $request->from);
        }
        if ($request->has('to')) {
            $query->whereDate('created_at', '<=', $request->to);
        }

        // Get tickets grouped by agent and status
        $ticketsByAgent = $query->select(
            'user_id',
            'status',
            DB::raw('count(*) as count')
        )
            ->groupBy('user_id', 'status')
            ->get();

        // Get all agents who have tickets assigned
        $agentIds = $ticketsByAgent->pluck('user_id')->unique()->filter();
        $agents = User::whereIn('id', $agentIds)->get()->keyBy('id');

        // Build agent stats array
        $agentStats = [];

        // Handle unassigned tickets
        $unassignedCounts = $ticketsByAgent->where('user_id', null)->pluck('count', 'status')->toArray();
        if (!empty($unassignedCounts)) {
            $agentStats[] = [
                'agent_id' => null,
                'agent_name' => 'Unassigned',
                'total' => array_sum($unassignedCounts),
                'new' => $unassignedCounts['NEW'] ?? 0,
                'open' => $unassignedCounts['OPEN'] ?? 0,
                'in_progress' => $unassignedCounts['IN_PROGRESS'] ?? 0,
                'pending_customer' => $unassignedCounts['PENDING_CUSTOMER'] ?? 0,
                'resolved' => $unassignedCounts['RESOLVED'] ?? 0,
                'closed' => $unassignedCounts['CLOSED'] ?? 0,
            ];
        }

        // Process each agent
        foreach ($agents as $agentId => $agent) {
            $agentTickets = $ticketsByAgent->where('user_id', $agentId)->pluck('count', 'status')->toArray();

            $agentStats[] = [
                'agent_id' => $agentId,
                'agent_name' => $agent->name,
                'total' => array_sum($agentTickets),
                'new' => $agentTickets['NEW'] ?? 0,
                'open' => $agentTickets['OPEN'] ?? 0,
                'in_progress' => $agentTickets['IN_PROGRESS'] ?? 0,
                'pending_customer' => $agentTickets['PENDING_CUSTOMER'] ?? 0,
                'resolved' => $agentTickets['RESOLVED'] ?? 0,
                'closed' => $agentTickets['CLOSED'] ?? 0,
            ];
        }

        // Sort by total tickets descending
        usort($agentStats, function ($a, $b) {
            return $b['total'] - $a['total'];
        });

        return response()->json(['by_agent' => $agentStats]);
    }

    /**
     * Get statistics by customer
     */
    public function customerStats(Request $request)
    {
        $query = Ticket::query();

        // Apply tenant filter
        if ($request->user()->tenant_id) {
            $query->where('tenant_id', $request->user()->tenant_id);
        }

        // Apply date range filter
        if ($request->has('from')) {
            $query->whereDate('created_at', '>=', $request->from);
        }
        if ($request->has('to')) {
            $query->whereDate('created_at', '<=', $request->to);
        }

        // Get tickets grouped by customer and status
        $ticketsByCustomer = $query->select(
            'contact_id',
            'status',
            DB::raw('count(*) as count')
        )
            ->with('contact:id,name')
            ->groupBy('contact_id', 'status')
            ->get();

        // Group by customer
        $customerGroups = $ticketsByCustomer->groupBy('contact_id');

        $customerStats = [];
        foreach ($customerGroups as $customerId => $tickets) {
            $statusCounts = $tickets->pluck('count', 'status')->toArray();
            $customer = $tickets->first()->contact;

            $customerStats[] = [
                'customer_id' => $customerId,
                'customer_name' => $customer ? $customer->name : 'Unknown',
                'total' => array_sum($statusCounts),
                'new' => $statusCounts['NEW'] ?? 0,
                'open' => $statusCounts['OPEN'] ?? 0,
                'in_progress' => $statusCounts['IN_PROGRESS'] ?? 0,
                'pending_customer' => $statusCounts['PENDING_CUSTOMER'] ?? 0,
                'resolved' => $statusCounts['RESOLVED'] ?? 0,
                'closed' => $statusCounts['CLOSED'] ?? 0,
            ];
        }

        // Sort by total tickets descending
        usort($customerStats, function ($a, $b) {
            return $b['total'] - $a['total'];
        });

        return response()->json(['by_customer' => $customerStats]);
    }
}
