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

        // Lee de la tabla local pre-agregada `fichaje_daily_stats` (poblada por el
        // comando nocturno `fichajes:aggregate`). NO consulta Intratime aquí: una
        // vista del dashboard nunca golpea los 73M de filas de login_logout.
        $maxMonths = 60;
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

        // Filtro por empresa (opcional). Cuando llega, la serie sale de la tabla
        // desglosada por empresa en vez de la global; el formato de respuesta es
        // idéntico para que el gráfico no se entere.
        $companyId = $request->input('company_id');
        if ($companyId) {
            $externalId = Contact::where('tenant_id', $request->user()->tenant_id)
                ->where('id', $companyId)
                ->value('external_id');

            // Sin external_id no hay forma de cruzar con Intratime: serie vacía,
            // que es más honesto que devolver los totales globales.
            if (!$externalId) {
                return response()->json([]);
            }

            return response()->json($this->fichajesSeriesForCompany(
                $externalId, $from, $to, $format, $source
            ));
        }

        $rows = \Illuminate\Support\Facades\DB::table('fichaje_daily_stats')
            ->where('day', '>=', $from->format('Y-m-d'))
            ->where('day', '<=', $to->format('Y-m-d'))
            ->when($source === 'manual', fn ($q) => $q->where('is_manual', 1))
            ->when($source === 'employee', fn ($q) => $q->where('is_manual', 0))
            ->selectRaw("DATE_FORMAT(day, ?) as period, inout_type as type, SUM(count) as count", [$format])
            ->groupBy('period', 'type')
            ->orderBy('period')
            ->get();

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

    /**
     * Serie temporal de fichajes de UNA empresa, leyendo de
     * fichaje_company_daily_stats. Devuelve el mismo formato que fichajes().
     */
    private function fichajesSeriesForCompany(string $externalId, Carbon $from, Carbon $to, string $format, ?string $source): array
    {
        // Según el origen pedido se suman las columnas totales, solo las de
        // manuales, o la diferencia (lo fichado por el propio empleado).
        $expr = fn (string $total, string $manual) => match ($source) {
            'manual'   => "SUM($manual)",
            'employee' => "SUM($total - $manual)",
            default    => "SUM($total)",
        };

        $rows = \Illuminate\Support\Facades\DB::table('fichaje_company_daily_stats')
            ->where('company_external_id', $externalId)
            ->where('day', '>=', $from->format('Y-m-d'))
            ->where('day', '<=', $to->format('Y-m-d'))
            ->selectRaw(
                "DATE_FORMAT(day, ?) as period, "
                . $expr('clock_in', 'clock_in_manual') . " as entrada, "
                . $expr('clock_out', 'clock_out_manual') . " as salida, "
                . $expr('pause', 'pause_manual') . " as pausa, "
                . $expr('return_count', 'return_manual') . " as regreso",
                [$format]
            )
            ->groupBy('period')
            ->orderBy('period')
            ->get();

        return $rows->map(fn ($r) => [
            'period'  => $r->period,
            'entrada' => (int) $r->entrada,
            'salida'  => (int) $r->salida,
            'pausa'   => (int) $r->pausa,
            'regreso' => (int) $r->regreso,
            'total'   => (int) $r->entrada + (int) $r->salida + (int) $r->pausa + (int) $r->regreso,
        ])->all();
    }

    /**
     * Ranking de empresas por volumen de fichajes en un rango, con el reparto
     * por tipo. Devuelve el top N, una fila agregada con el resto, y el total.
     */
    public function fichajesByCompany(Request $request)
    {
        if ($request->user()->level !== 'admin' && $request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $tenantId = $request->user()->tenant_id;
        $limit = min(200, max(1, (int) $request->input('limit', 50)));

        try {
            $to = $request->filled('date_to') ? Carbon::parse($request->date_to)->endOfDay() : Carbon::now()->endOfDay();
        } catch (\Throwable $e) {
            $to = Carbon::now()->endOfDay();
        }
        try {
            $from = $request->filled('date_from') ? Carbon::parse($request->date_from)->startOfDay() : $to->copy()->subMonths(3)->startOfDay();
        } catch (\Throwable $e) {
            $from = $to->copy()->subMonths(3)->startOfDay();
        }
        if ($from->greaterThan($to)) {
            $from = $to->copy()->subMonths(3)->startOfDay();
        }

        // leftJoin a propósito: ~2,5% de las empresas que fichan aún no están
        // sincronizadas como contacto, y dejarlas fuera falsearía los totales.
        $base = \Illuminate\Support\Facades\DB::table('fichaje_company_daily_stats as f')
            ->leftJoin('contacts as c', function ($j) use ($tenantId) {
                $j->on('c.external_id', '=', 'f.company_external_id')
                  ->where('c.tenant_id', '=', $tenantId);
            })
            ->where('f.day', '>=', $from->format('Y-m-d'))
            ->where('f.day', '<=', $to->format('Y-m-d'))
            ->when($request->filled('plan'), fn ($q) => $q->where('c.subscription_plan', $request->input('plan')))
            ->when($request->filled('distributor_id'), fn ($q) => $q->where('c.distributor_id', (int) $request->input('distributor_id')))
            ->when($request->filled('contact_id'), fn ($q) => $q->where('c.id', (int) $request->input('contact_id')));

        $select = 'SUM(f.clock_in) as entrada, SUM(f.clock_out) as salida, SUM(f.pause) as pausa,'
            . ' SUM(f.return_count) as regreso, SUM(f.manual_count) as manuales,'
            . ' SUM(f.clock_in + f.clock_out + f.pause + f.return_count) as total';

        $companies = (clone $base)
            ->selectRaw(
                'f.company_external_id, c.id as contact_id, c.name, c.subscription_plan as plan,'
                . ' c.distributor_id, MAX(f.headcount) as headcount, MAX(f.active_users) as max_active_users, '
                . $select
            )
            ->groupBy('f.company_external_id', 'c.id', 'c.name', 'c.subscription_plan', 'c.distributor_id')
            ->orderByDesc('total')
            ->limit($limit)
            ->get();

        $overall = (clone $base)->selectRaw($select)->first();

        // Clientes distintos con actividad en el rango (no solo los del top N).
        $companyCount = (clone $base)
            ->distinct()
            ->count(\Illuminate\Support\Facades\DB::raw('f.company_external_id'));

        $sum = fn (string $k) => (int) $companies->sum(fn ($r) => (int) $r->$k);
        $rest = [
            'entrada'  => (int) $overall->entrada - $sum('entrada'),
            'salida'   => (int) $overall->salida  - $sum('salida'),
            'pausa'    => (int) $overall->pausa   - $sum('pausa'),
            'regreso'  => (int) $overall->regreso - $sum('regreso'),
            'manuales' => (int) $overall->manuales - $sum('manuales'),
            'total'    => (int) $overall->total   - $sum('total'),
        ];

        return response()->json([
            'from'      => $from->toDateString(),
            'to'        => $to->toDateString(),
            'limit'         => $limit,
            'company_count' => $companyCount,
            'companies' => $companies->map(fn ($r) => [
                'company_external_id' => $r->company_external_id,
                'contact_id'          => $r->contact_id ? (int) $r->contact_id : null,
                'name'                => $r->name ?: '(sin contacto sincronizado)',
                'plan'                => $r->plan,
                'distributor_id'      => $r->distributor_id ? (int) $r->distributor_id : null,
                'headcount'           => $r->headcount !== null ? (int) $r->headcount : null,
                'active_users'        => (int) $r->max_active_users,
                'entrada'             => (int) $r->entrada,
                'salida'              => (int) $r->salida,
                'pausa'               => (int) $r->pausa,
                'regreso'             => (int) $r->regreso,
                'manuales'            => (int) $r->manuales,
                'total'               => (int) $r->total,
            ])->all(),
            'rest'   => $rest['total'] > 0 ? $rest : null,
            'totals' => [
                'entrada'  => (int) $overall->entrada,
                'salida'   => (int) $overall->salida,
                'pausa'    => (int) $overall->pausa,
                'regreso'  => (int) $overall->regreso,
                'manuales' => (int) $overall->manuales,
                'total'    => (int) $overall->total,
            ],
        ]);
    }
}
