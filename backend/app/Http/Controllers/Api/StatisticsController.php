<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use Carbon\Carbon;
use Illuminate\Http\Request;

class StatisticsController extends Controller
{
    public function totals(Request $request)
    {
        // Enforce admin level/role
        if ($request->user()->level !== 'admin' && $request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $tenantId = $request->user()->tenant_id;
        
        $base = Contact::where('tenant_id', $tenantId);

        $totalClients    = (clone $base)->count();
        $clientsActive   = (clone $base)->where('is_lead', false)->where('active', true)->count();
        $clientsInactive = (clone $base)->where('is_lead', false)->where('active', false)->count();
        $leadsTotal      = (clone $base)->where('is_lead', true)->count();
        $leadsActive     = (clone $base)->where('is_lead', true)->where('active', true)->count();
        $leadsInactive   = (clone $base)->where('is_lead', true)->where('active', false)->count();
        
        $byContractRaw = Contact::where('tenant_id', $tenantId)
            ->selectRaw('contract_category, is_lead, active, count(*) as count')
            ->groupBy('contract_category', 'is_lead', 'active')
            ->get();

        $byContract = [];
        foreach ($byContractRaw as $row) {
            // Leads van siempre a su propio bucket, independientemente de contract_category
            if ($row->is_lead) {
                $cat = 'leads';
            } elseif ($row->contract_category) {
                $cat = $row->contract_category;
            } else {
                $cat = 'sin_categoria';
            }

            if (!isset($byContract[$cat])) {
                $byContract[$cat] = ['total' => 0, 'active' => 0, 'inactive' => 0];
            }
            $byContract[$cat]['total'] += $row->count;
            if ($row->active) {
                $byContract[$cat]['active'] += $row->count;
            } else {
                $byContract[$cat]['inactive'] += $row->count;
            }
        }

        // Orden fijo para la visualización
        $order = ['winworld', 'conversia', 'conversia22', 'leads', 'sin_categoria'];
        uksort($byContract, function ($a, $b) use ($order) {
            $posA = array_search($a, $order);
            $posB = array_search($b, $order);
            return ($posA !== false ? $posA : 99) <=> ($posB !== false ? $posB : 99);
        });

        return response()->json([
            'totals' => [
                'clients'          => $totalClients,
                'clients_active'   => $clientsActive,
                'clients_inactive' => $clientsInactive,
                'leads'            => $leadsTotal,
                'leads_active'     => $leadsActive,
                'leads_inactive'   => $leadsInactive,
            ],
            'by_contract' => $byContract,
        ]);
    }

    public function registrations(Request $request)
    {
        if ($request->user()->level !== 'admin' && $request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $tenantId = $request->user()->tenant_id;
        $granularity = $request->input('granularity', 'month');
        $dateFrom = $request->input('date_from');
        $dateTo   = $request->input('date_to');

        $format = $granularity === 'day' ? '%Y-%m-%d' : '%Y-%m';

        $query = \App\Models\Contact::where('tenant_id', $tenantId)
            ->whereNotNull('registration_date');

        if ($dateFrom) $query->where('registration_date', '>=', $dateFrom);
        if ($dateTo)   $query->where('registration_date', '<=', $dateTo);

        $rows = $query
            ->selectRaw("DATE_FORMAT(registration_date, ?) as period, contract_category, is_lead, COUNT(*) as count", [$format])
            ->groupBy('period', 'contract_category', 'is_lead')
            ->orderBy('period')
            ->get();

        $periods = [];
        foreach ($rows as $row) {
            $p = $row->period;
            if (!isset($periods[$p])) {
                $periods[$p] = ['period' => $p, 'total' => 0, 'winworld' => 0, 'conversia' => 0, 'conversia22' => 0, 'leads' => 0];
            }
            $periods[$p]['total'] += $row->count;
            if ($row->is_lead) {
                $periods[$p]['leads'] += $row->count;
            } elseif ($row->contract_category) {
                $cat = $row->contract_category;
                if (array_key_exists($cat, $periods[$p])) {
                    $periods[$p][$cat] += $row->count;
                }
            }
        }

        return response()->json(array_values($periods));
    }

    public function fichajes(Request $request)
    {
        if ($request->user()->level !== 'admin' && $request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $granularity = $request->input('granularity') === 'day' ? 'day' : 'month';
        $source      = $request->input('source'); // 'manual' | 'employee' | null
        $format = $granularity === 'day' ? '%Y-%m-%d' : '%Y-%m';

        // El rango de fechas SIEMPRE va acotado: nunca lanzar un GROUP BY sobre toda
        // la tabla login_logout (puede tener millones de filas y saturaría la BD de
        // producción de Intratime). Sin fechas → últimos 12 meses; tope duro 24 meses.
        $maxMonths = 24;
        try {
            $to = $request->filled('date_to') ? Carbon::parse($request->date_to)->endOfDay() : Carbon::now()->endOfDay();
        } catch (\Throwable $e) {
            $to = Carbon::now()->endOfDay();
        }
        try {
            $from = $request->filled('date_from') ? Carbon::parse($request->date_from)->startOfDay() : $to->copy()->subMonths(12)->startOfDay();
        } catch (\Throwable $e) {
            $from = $to->copy()->subMonths(12)->startOfDay();
        }
        if ($from->greaterThan($to)) {
            $from = $to->copy()->subMonths(12)->startOfDay();
        }
        if ($from->lessThan($to->copy()->subMonths($maxMonths))) {
            $from = $to->copy()->subMonths($maxMonths)->startOfDay();
        }

        try {
            $conn = \Illuminate\Support\Facades\DB::connection('paneladmin');

            // Tope de ejecución en el servidor: MySQL aborta la SELECT si supera el
            // límite, evitando que una consulta pesada sature la BD origen. Solo
            // afecta a sentencias SELECT de solo lectura.
            $conn->statement('SET SESSION max_execution_time = 15000'); // 15s

            $query = $conn->table('login_logout')
                ->whereNull('INOUT_DELETED_AT')
                ->whereIn('INOUT_TYPE', [0, 1, 2, 3])
                ->where('INOUT_DATE', '>=', $from->format('Y-m-d H:i:s'))
                ->where('INOUT_DATE', '<=', $to->format('Y-m-d H:i:s'))
                ->selectRaw("DATE_FORMAT(INOUT_DATE, ?) as period, INOUT_TYPE as type, COUNT(*) as count", [$format])
                ->groupBy('period', 'type')
                ->orderBy('period');

            if ($source === 'manual')   $query->where('INOUT_SOURCE', 3);
            if ($source === 'employee') $query->where('INOUT_SOURCE', '!=', 3);

            $rows = $query->get();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Paneladmin fichajes query failed: ' . $e->getMessage());
            return response()->json(['error' => 'No se pudo conectar o la consulta de fichajes superó el tiempo límite.'], 503);
        }

        $typeMap = [0 => 'entrada', 1 => 'salida', 2 => 'pausa', 3 => 'regreso'];
        $periods = [];

        foreach ($rows as $row) {
            $p = $row->period;
            if (!isset($periods[$p])) {
                $periods[$p] = ['period' => $p, 'total' => 0, 'entrada' => 0, 'salida' => 0, 'pausa' => 0, 'regreso' => 0];
            }
            $label = $typeMap[$row->type] ?? null;
            if ($label) $periods[$p][$label] += $row->count;
            $periods[$p]['total'] += $row->count;
        }

        return response()->json(array_values($periods));
    }
}
