<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ticket;
use Illuminate\Http\Request;
use Carbon\Carbon;

class DashboardController extends Controller
{
    public function stats(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $agentId = $request->user()->id;

        $openTotal = Ticket::where('tenant_id', $tenantId)
            ->whereNotIn('status', ['RESOLVED', 'CLOSED'])
            ->count();

        $myOpen = Ticket::where('tenant_id', $tenantId)
            ->where('user_id', $agentId)
            ->whereNotIn('status', ['RESOLVED', 'CLOSED'])
            ->count();

        $slaAtRisk = Ticket::where('tenant_id', $tenantId)
            ->whereNotIn('status', ['RESOLVED', 'CLOSED'])
            ->whereNotNull('sla_resolution_due_at')
            ->where('sla_resolution_due_at', '<=', Carbon::now()->addHours(4))
            ->count();

        $resolvedToday = Ticket::where('tenant_id', $tenantId)
            ->where('status', 'RESOLVED')
            ->whereDate('resolved_at', Carbon::today())
            ->count();

        return response()->json([
            'open_tickets' => $openTotal,
            'my_tickets' => $myOpen,
            'sla_at_risk' => $slaAtRisk,
            'resolved_today' => $resolvedToday,
        ]);
    }
}
