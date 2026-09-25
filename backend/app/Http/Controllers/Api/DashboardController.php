<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ticket;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class DashboardController extends Controller
{
    public function stats(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $agentId  = $request->user()->id;

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
            'open_tickets'   => $openTotal,
            'my_tickets'     => $myOpen,
            'sla_at_risk'    => $slaAtRisk,
            'resolved_today' => $resolvedToday,
        ]);
    }

    public function kpis(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $year     = (int) $request->input('year', date('Y'));
        $month    = $request->filled('month') ? (int) $request->input('month') : null;

        // ── Build date range ──────────────────────────────────────────────────
        if ($month) {
            $from     = Carbon::create($year, $month, 1)->startOfMonth();
            $to       = Carbon::create($year, $month, 1)->endOfMonth();
            $prevFrom = $from->copy()->subYear()->startOfMonth();
            $prevTo   = $from->copy()->subYear()->endOfMonth();
            $format   = '%Y-%m-%d';
        } else {
            $from     = Carbon::create($year, 1, 1)->startOfYear();
            $to       = Carbon::create($year, 12, 31)->endOfYear();
            $prevFrom = Carbon::create($year - 1, 1, 1)->startOfYear();
            $prevTo   = Carbon::create($year - 1, 12, 31)->endOfYear();
            $format   = '%Y-%m';
        }

        $closed = ['RESOLVED', 'CLOSED'];

        // ── Summary KPIs ─────────────────────────────────────────────────────
        $base        = Ticket::where('tenant_id', $tenantId);
        $created     = (clone $base)->whereBetween('created_at', [$from, $to])->count();
        $resolved    = (clone $base)->whereBetween('resolved_at', [$from, $to])->count();
        $prevCreated = (clone $base)->whereBetween('created_at', [$prevFrom, $prevTo])->count();
        $prevResolved = (clone $base)->whereBetween('resolved_at', [$prevFrom, $prevTo])->count();

        // Current-state snapshots (not period-filtered)
        $openNow       = (clone $base)->whereNotIn('status', $closed)->count();
        $inProgressNow = (clone $base)->where('status', 'IN_PROGRESS')->count();

        // Avg resolution time (hours) within period
        $avgResolutionHours = (clone $base)
            ->whereBetween('resolved_at', [$from, $to])
            ->whereNotNull('first_response_at')
            ->selectRaw('AVG(TIMESTAMPDIFF(HOUR, created_at, resolved_at)) as avg_h')
            ->value('avg_h');

        // Avg first response time (hours) within period
        $avgFirstResponseHours = (clone $base)
            ->whereBetween('created_at', [$from, $to])
            ->whereNotNull('first_response_at')
            ->selectRaw('AVG(TIMESTAMPDIFF(HOUR, created_at, first_response_at)) as avg_h')
            ->value('avg_h');

        // SLA breaches in period
        $slaBreached = (clone $base)
            ->whereBetween('created_at', [$from, $to])
            ->where('sla_resolution_breached', true)
            ->count();

        $pct = fn($c, $p) => $p > 0 ? round(($c - $p) / $p * 100, 1) : null;

        // ── Evolution chart ───────────────────────────────────────────────────
        $createdRows = Ticket::where('tenant_id', $tenantId)
            ->whereBetween('created_at', [$from, $to])
            ->selectRaw("DATE_FORMAT(created_at, ?) as period, COUNT(*) as creados", [$format])
            ->groupBy('period')->orderBy('period')->get();

        $resolvedRows = Ticket::where('tenant_id', $tenantId)
            ->whereBetween('resolved_at', [$from, $to])
            ->selectRaw("DATE_FORMAT(resolved_at, ?) as period, COUNT(*) as resueltos", [$format])
            ->groupBy('period')->orderBy('period')->get();

        $chart = [];
        foreach ($createdRows as $r)  $chart[$r->period]['creados']  = $r->creados;
        foreach ($resolvedRows as $r) $chart[$r->period]['resueltos'] = $r->resueltos;
        ksort($chart);
        $chart = array_map(fn($p, $d) => array_merge(['period' => $p], ['creados' => 0, 'resueltos' => 0], $d), array_keys($chart), $chart);

        // ── By agent ─────────────────────────────────────────────────────────
        $byAgent = DB::table('tickets as t')
            ->join('users as u', 't.user_id', '=', 'u.id')
            ->where('t.tenant_id', $tenantId)
            ->whereBetween('t.created_at', [$from, $to])
            ->whereNull('t.deleted_at')
            ->selectRaw("
                u.name as agent,
                COUNT(*) as total,
                SUM(CASE WHEN t.status NOT IN ('RESOLVED','CLOSED') THEN 1 ELSE 0 END) as open,
                SUM(CASE WHEN t.status = 'IN_PROGRESS'              THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN t.status IN ('RESOLVED','CLOSED')      THEN 1 ELSE 0 END) as resolved
            ")
            ->groupBy('u.id', 'u.name')
            ->orderByDesc('total')
            ->get();

        // ── By category ───────────────────────────────────────────────────────
        $byCategory = DB::table('tickets as t')
            ->join('categories as c', 't.category_id', '=', 'c.id')
            ->where('t.tenant_id', $tenantId)
            ->whereBetween('t.created_at', [$from, $to])
            ->whereNull('t.deleted_at')
            ->selectRaw('c.name as name, COUNT(*) as count')
            ->groupBy('c.id', 'c.name')
            ->orderByDesc('count')
            ->limit(15)
            ->get();

        // ── Top 15 clients ────────────────────────────────────────────────────
        $topClients = DB::table('tickets as t')
            ->join('contacts as c', 't.contact_id', '=', 'c.id')
            ->where('t.tenant_id', $tenantId)
            ->whereBetween('t.created_at', [$from, $to])
            ->whereNull('t.deleted_at')
            ->selectRaw('c.name as name, COUNT(*) as count')
            ->groupBy('c.id', 'c.name')
            ->orderByDesc('count')
            ->limit(15)
            ->get();

        return response()->json([
            'summary' => [
                'created'                  => $created,
                'resolved'                 => $resolved,
                'open_now'                 => $openNow,
                'in_progress_now'          => $inProgressNow,
                'avg_resolution_hours'     => $avgResolutionHours     ? round($avgResolutionHours, 1)     : null,
                'avg_first_response_hours' => $avgFirstResponseHours  ? round($avgFirstResponseHours, 1)  : null,
                'sla_breached'             => $slaBreached,
                'sla_breach_rate'          => $created > 0 ? round($slaBreached / $created * 100, 1) : 0,
                'created_change'           => $pct($created, $prevCreated),
                'resolved_change'          => $pct($resolved, $prevResolved),
            ],
            'chart'       => array_values($chart),
            'by_agent'    => $byAgent,
            'by_category' => $byCategory,
            'top_clients' => $topClients,
        ]);
    }
}
