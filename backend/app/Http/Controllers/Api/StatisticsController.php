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
        // Con filtro de cliente o de tramo de plan la serie sale de la tabla
        // desglosada por empresa; sin filtros se usa la global, que son 35.000
        // filas y es instantánea. El formato de respuesta es idéntico.
        $companyId = $request->input('company_id');
        $planTier  = $request->input('plan_tier');

        if ($companyId || $planTier) {
            $externalId = null;
            if ($companyId) {
                $externalId = Contact::where('tenant_id', $request->user()->tenant_id)
                    ->where('id', $companyId)
                    ->value('external_id');

                // Sin external_id no hay forma de cruzar con Intratime: serie
                // vacía, que es más honesto que devolver los totales globales.
                if (!$externalId) {
                    return response()->json([]);
                }
            }

            return response()->json($this->fichajesSeriesFiltered(
                $request->user()->tenant_id, $externalId, $planTier, $from, $to, $format, $source
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
    private function fichajesSeriesFiltered(int $tenantId, ?string $externalId, ?string $planTier, Carbon $from, Carbon $to, string $format, ?string $source): array
    {
        // Según el origen pedido se suman las columnas totales, solo las de
        // manuales, o la diferencia (lo fichado por el propio empleado).
        $expr = fn (string $total, string $manual) => match ($source) {
            'manual'   => "SUM($manual)",
            'employee' => "SUM($total - $manual)",
            default    => "SUM($total)",
        };

        $rows = \Illuminate\Support\Facades\DB::table('fichaje_company_daily_stats as f')
            ->when($planTier, fn ($q) => $q->leftJoin('contacts as c', function ($j) use ($tenantId) {
                $j->on('c.external_id', '=', 'f.company_external_id')
                  ->where('c.tenant_id', '=', $tenantId);
            }))
            ->when($externalId, fn ($q) => $q->where('f.company_external_id', $externalId))
            ->when($planTier, fn ($q) => $this->applyPlanTierFilter($q, $planTier))
            ->where('f.day', '>=', $from->format('Y-m-d'))
            ->where('f.day', '<=', $to->format('Y-m-d'))
            ->selectRaw(
                "DATE_FORMAT(f.day, ?) as period, "
                . $expr('f.clock_in', 'f.clock_in_manual') . " as entrada, "
                . $expr('f.clock_out', 'f.clock_out_manual') . " as salida, "
                . $expr('f.pause', 'f.pause_manual') . " as pausa, "
                . $expr('f.return_count', 'f.return_manual') . " as regreso",
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
            ->when($request->filled('distributor'), fn ($q) => $this->applyDistributorFilter($q, $request->input('distributor')))
            ->when($request->filled('plan_tier'), fn ($q) => $this->applyPlanTierFilter($q, $request->input('plan_tier')))
            ->when($request->filled('contact_id'), fn ($q) => $q->where('c.id', (int) $request->input('contact_id')));

        // Una sola pasada sobre la tabla. Antes eran tres consultas (el top N,
        // los totales y el recuento de clientes) y con 5 millones de filas eso
        // se notaba: el endpoint tardaba 6,7 s. Agregando una vez y derivando
        // el resto en PHP sobre ~6.800 filas, baja a un tercio.
        // Se puede agrupar por empresa (por defecto) o por tramo de plan. Las
        // métricas agregadas son las mismas, solo cambia la clave de agrupación,
        // así que la respuesta mantiene la forma y el frontend no se entera.
        $byPlan = $request->input('group_by') === 'plan';

        $metrics = ' MAX(f.headcount) as headcount, MAX(f.active_users) as peak_users,'
            . ' SUM(f.active_users) as user_days,'
            . ' MAX(COALESCE(f.active_headcount, f.headcount)) as plantilla,'
            . ' SUM(COALESCE(f.active_headcount, f.headcount)) as headcount_days,'
            . ' MIN(f.day) as first_day, COUNT(DISTINCT f.day) as active_days,'
            . ' SUM(f.clock_in) as entrada, SUM(f.clock_out) as salida, SUM(f.pause) as pausa,'
            . ' SUM(f.return_count) as regreso, SUM(f.manual_count) as manuales,'
            . ' SUM(f.clock_in + f.clock_out + f.pause + f.return_count) as total';

        if ($byPlan) {
            // Subconsulta a propósito: MariaDB (el motor de este RDS) no reconoce
            // que la expresión CASE del SELECT es la misma que la del GROUP BY y
            // rechaza la consulta con ONLY_FULL_GROUP_BY. MySQL sí lo deduce, de
            // ahí que en local pasara. Calculando el tramo dentro y agrupando
            // por el alias fuera, funciona en los dos.
            $all = \Illuminate\Support\Facades\DB::query()
                ->fromSub($base->selectRaw($this->planTierExpression() . ' as tier, f.*'), 't')
                ->selectRaw(
                    'tier as company_external_id, NULL as contact_id, tier as name,'
                    . ' NULL as plan, NULL as distributor_id, NULL as registration_date,'
                    . ' COUNT(DISTINCT company_external_id) as companies,'
                    . str_replace('f.', '', $metrics)
                )
                ->groupBy('tier')
                ->get()
                ->map(function ($r) {
                    // active_days aquí es el nº de días con actividad en TODO el
                    // tramo, no de una empresa: la regularidad no significa lo
                    // mismo, así que se anula para no dar un dato engañoso.
                    $r->name = $this->planTierLabel($r->name);
                    // Un tramo agrupa muchas empresas: la regularidad y la
                    // antigüedad no significan nada agregadas, así que se marcan
                    // como no aplicables en vez de falsear los contadores.
                    $r->aggregate = true;

                    return $r;
                });
        } else {
            $all = $base
                ->selectRaw(
                    'f.company_external_id, c.id as contact_id, c.name, c.subscription_plan as plan,'
                    . ' c.distributor_id, c.registration_date, 1 as companies,'
                    . $metrics
                )
                ->groupBy('f.company_external_id', 'c.id', 'c.name', 'c.subscription_plan', 'c.distributor_id', 'c.registration_date')
                ->get();
        }

        $companyCount = $all->count();

        $overall = (object) [
            'entrada'  => (int) $all->sum(fn ($r) => (int) $r->entrada),
            'salida'   => (int) $all->sum(fn ($r) => (int) $r->salida),
            'pausa'    => (int) $all->sum(fn ($r) => (int) $r->pausa),
            'regreso'  => (int) $all->sum(fn ($r) => (int) $r->regreso),
            'manuales' => (int) $all->sum(fn ($r) => (int) $r->manuales),
            'total'    => (int) $all->sum(fn ($r) => (int) $r->total),
        ];

        $companies = $all->sortByDesc(fn ($r) => (int) $r->total)->take($limit)->values();

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
            // El estado sale del mismo evaluador que usa la pantalla de calidad:
            // los umbrales viven en un único sitio y las dos pantallas no pueden
            // contradecirse.
            'group_by'  => $byPlan ? 'plan' : 'company',
            'companies' => $companies->map(fn ($r) => $this->evaluateCompanyHealth($r, $from, $to) + [
                'user_days' => (int) $r->user_days,
                'headcount' => $r->headcount !== null ? (int) $r->headcount : null,
                'companies' => (int) ($r->companies ?? 1),
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

    /** Umbrales del semáforo de calidad. Salen de la distribución real de la
     *  cartera, no de criterio: el 88% de las empresas queda por debajo del 5%
     *  de descuadre, y la moda de intensidad es 2-2,5 fichajes por empleado y
     *  día (una entrada y una salida). Viven aquí, en un único sitio, para que
     *  el ranking y la pantalla de calidad no puedan discrepar. */
    private const GAP_WARN = 5;
    private const GAP_CRIT = 10;
    private const PER_USER_WARN = 2;
    private const PER_USER_CRIT = 1.5;
    private const MIN_VOLUME = 20;
    /** Un descuadre en porcentaje sobre una base diminuta no dice nada: 8 pausas
     *  frente a 7 regresos es un 12,5% y es sencillamente un empleado. Cada par
     *  se evalúa solo si tiene al menos este volumen, con lo que un 10% pasa a
     *  significar 2 fichajes o más. */
    private const MIN_PAIR_VOLUME = 20;

    /** Días que una empresa lleva fichando para poder valorarla. Por debajo no
     *  es que fiche mal: es que acaba de empezar y no hay recorrido. */
    private const MIN_OBSERVED_DAYS = 14;

    /** Hasta este tamaño de rango se agrega el periodo anterior al completo,
     *  lo que permite comparar el índice de calidad. Por encima solo se pide lo
     *  imprescindible: agregar dos veces un año entero costaba 52 segundos. */
    private const PREV_DETAIL_MAX_DAYS = 45;

    /** Regularidad = días con fichajes / días laborables desde su primer fichaje.
     *  El 74% de la cartera pasa del 75%, así que por debajo del 25% algo falla
     *  y por debajo del 10% directamente no lo están usando. */
    private const REGULARITY_WARN = 0.25;
    private const REGULARITY_CRIT = 0.10;

    /**
     * Calidad de fichaje de TODOS los clientes con actividad (~6.500), con los
     * mismos filtros que el ranking más filtro por estado, orden y paginación.
     */
    public function fichajesHealth(Request $request)
    {
        if ($request->user()->level !== 'admin' && $request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $tenantId = $request->user()->tenant_id;
        $perPage = min(200, max(10, (int) $request->input('per_page', 50)));
        $page    = max(1, (int) $request->input('page', 1));

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

        // Una sola consulta agregada: ~6.500 empresas en ~130 ms. El semáforo se
        // calcula luego en PHP sobre ese resultado, que es más legible que
        // anidar tres subconsultas y cuesta lo mismo a este volumen.
        $byPlan = $request->input('group_by') === 'plan';

        $base = \Illuminate\Support\Facades\DB::table('fichaje_company_daily_stats as f')
            ->leftJoin('contacts as c', function ($j) use ($tenantId) {
                $j->on('c.external_id', '=', 'f.company_external_id')
                  ->where('c.tenant_id', '=', $tenantId);
            })
            ->where('f.day', '>=', $from->format('Y-m-d'))
            ->where('f.day', '<=', $to->format('Y-m-d'))
            ->when($request->filled('plan'), fn ($q) => $q->where('c.subscription_plan', $request->input('plan')))
            ->when($request->filled('distributor'), fn ($q) => $this->applyDistributorFilter($q, $request->input('distributor')))
            ->when($request->filled('plan_tier'), fn ($q) => $this->applyPlanTierFilter($q, $request->input('plan_tier')))
            ->when($request->filled('contact_id'), fn ($q) => $q->where('c.id', (int) $request->input('contact_id')))
            ->when($request->filled('search'), fn ($q) => $q->where('c.name', 'like', '%' . $request->input('search') . '%'));

        $metrics = ' SUM(f.clock_in) as entrada, SUM(f.clock_out) as salida,'
            . ' SUM(f.pause) as pausa, SUM(f.return_count) as regreso,'
            . ' SUM(f.manual_count) as manuales,'
            . ' SUM(f.clock_in + f.clock_out + f.pause + f.return_count) as total,'
            . ' SUM(f.active_users) as user_days, MAX(f.active_users) as peak_users,'
            . ' MAX(COALESCE(f.active_headcount, f.headcount)) as plantilla,'
            . ' SUM(COALESCE(f.active_headcount, f.headcount)) as headcount_days,'
            . ' MIN(f.day) as first_day, COUNT(DISTINCT f.day) as active_days';

        if ($byPlan) {
            // Ver la nota del ranking: subconsulta por compatibilidad con MariaDB.
            $rows = \Illuminate\Support\Facades\DB::query()
                ->fromSub($base->selectRaw($this->planTierExpression() . ' as tier, f.*'), 't')
                ->selectRaw(
                    'tier as company_external_id, NULL as contact_id, tier as name,'
                    . ' NULL as plan, NULL as distributor_id, NULL as registration_date,'
                    . ' COUNT(DISTINCT company_external_id) as companies,'
                    . str_replace('f.', '', $metrics)
                )
                ->groupBy('tier')
                ->get()
                ->map(function ($r) {
                    // Agregado de muchas empresas: la regularidad y el "lleva N
                    // días" no aplican a un tramo, así que se neutralizan.
                    $r->name = $this->planTierLabel($r->name);
                    // Un tramo agrupa muchas empresas: la regularidad y la
                    // antigüedad no significan nada agregadas, así que se marcan
                    // como no aplicables en vez de falsear los contadores.
                    $r->aggregate = true;

                    return $r;
                });
        } else {
            // Las columnas del contacto van como agregados, NO en el GROUP BY.
            // Agrupar por cadenas (nombre, plan, fecha de alta) es lo que costaba
            // 17 s en los KPIs; aquí estaba el mismo patrón. Cada empresa tiene un
            // solo contacto -- no hay external_id repetido dentro de un tenant --
            // así que MAX() devuelve su valor exacto.
            $rows = $base
                ->selectRaw(
                    'f.company_external_id, MAX(c.id) as contact_id, MAX(c.name) as name,'
                    . ' MAX(c.subscription_plan) as plan, MAX(c.distributor_id) as distributor_id,'
                    . ' MAX(c.registration_date) as registration_date, 1 as companies,'
                    . $metrics
                )
                ->groupBy('f.company_external_id')
                ->get();
        }

        $evaluated = $rows->map(fn ($r) => $this->evaluateCompanyHealth($r, $from, $to) + [
            'companies' => (int) ($r->companies ?? 1),
        ]);

        // Resumen sobre TODAS las empresas que pasan los filtros, no solo la
        // página: si no, el reparto del semáforo cambiaría al pasar de página.
        $summary = [
            'clients'  => $evaluated->count(),
            'good'     => $evaluated->where('status', 'good')->count(),
            'warning'  => $evaluated->where('status', 'warning')->count(),
            'critical' => $evaluated->where('status', 'critical')->count(),
            'new'      => $evaluated->where('status', 'new')->count(),
            'unknown'  => $evaluated->where('status', 'unknown')->count(),
            'total_fichajes' => (int) $evaluated->sum('total'),
        ];
        $withUsage = $evaluated->whereNotNull('usage_pct');
        $summary['usage_avg'] = $withUsage->count() ? round($withUsage->avg('usage_pct'), 1) : null;
        $summary['usage_unknown'] = $evaluated->count() - $withUsage->count();

        if ($request->filled('status')) {
            $evaluated = $evaluated->where('status', $request->input('status'))->values();
        }

        $severity = ['unknown' => 0, 'new' => 0, 'good' => 1, 'warning' => 2, 'critical' => 3];
        $sort = $request->input('sort', 'total');
        $desc = $request->input('dir', 'desc') !== 'asc';
        // Las métricas que pueden faltar (uso, intensidad, descuadre) van SIEMPRE
        // al final, ordene como ordene: quien ordena por "peor uso" quiere ver
        // los peores datos reales, no la lista de los que no tienen dato.
        $last = $desc ? -INF : INF;
        $evaluated = $evaluated->sortBy(function ($r) use ($sort, $severity, $last) {
            return match ($sort) {
                'name'     => mb_strtolower((string) ($r['name'] ?? '')),
                'status'   => $severity[$r['status']],
                'usage'    => $r['usage_pct'] ?? $last,
                'regularity' => $r['regularity'] ?? $last,
                'per_user' => $r['per_user'] ?? $last,
                'gap'      => ($r['gap_io'] === null && $r['gap_pr'] === null)
                    ? $last
                    : max($r['gap_io'] ?? 0, $r['gap_pr'] ?? 0),
                default    => $r['total'],
            };
        }, SORT_REGULAR, $desc)->values();

        $total = $evaluated->count();

        return response()->json([
            'from'     => $from->toDateString(),
            'to'       => $to->toDateString(),
            'group_by' => $byPlan ? 'plan' : 'company',
            'summary'  => $summary,
            'data'     => $evaluated->forPage($page, $perPage)->values()->all(),
            'page'     => $page,
            'per_page' => $perPage,
            'total'    => $total,
            'last_page' => max(1, (int) ceil($total / $perPage)),
            'thresholds' => [
                'gap_warn' => self::GAP_WARN, 'gap_crit' => self::GAP_CRIT,
                'per_user_warn' => self::PER_USER_WARN, 'per_user_crit' => self::PER_USER_CRIT,
                'min_volume' => self::MIN_VOLUME,
            ],
        ]);
    }



    /**
     * Tramos de plan por número de usuarios contratados (contacts.max_users).
     *
     * Hay 142 valores distintos con una cola larguísima, así que un desplegable
     * plano no sirve. Los tramos salen del reparto real entre las empresas con
     * actividad: 1 · 2-5 · 6-10 · 11-25 · 26-50 · 51-100 · +100, que quedan
     * equilibrados y permiten ver algo que hoy no se ve — 35 clientes de más de
     * 100 usuarios generan cinco veces más fichajes que 1.152 de usuario único.
     */
    private const PLAN_TIERS = [
        ['key' => '1',       'label' => '1 usuario',   'min' => 1,   'max' => 1],
        ['key' => '2-5',     'label' => '2-5',         'min' => 2,   'max' => 5],
        ['key' => '6-10',    'label' => '6-10',        'min' => 6,   'max' => 10],
        ['key' => '11-25',   'label' => '11-25',       'min' => 11,  'max' => 25],
        ['key' => '26-50',   'label' => '26-50',       'min' => 26,  'max' => 50],
        ['key' => '51-100',  'label' => '51-100',      'min' => 51,  'max' => 100],
        ['key' => '100+',    'label' => 'Más de 100',  'min' => 101, 'max' => null],
        ['key' => 'none',    'label' => 'Sin plan',    'min' => null, 'max' => null],
    ];

    /** Expresión SQL que traduce max_users al tramo, para agrupar por plan. */
    private function planTierExpression(): string
    {
        $cases = [];
        foreach (self::PLAN_TIERS as $t) {
            if ($t['key'] === 'none') {
                continue;
            }
            $cond = $t['max'] === null
                ? "c.max_users >= {$t['min']}"
                : "c.max_users BETWEEN {$t['min']} AND {$t['max']}";
            $cases[] = "WHEN {$cond} THEN '{$t['key']}'";
        }

        return 'CASE WHEN c.max_users IS NULL THEN \'none\' ' . implode(' ', $cases) . ' ELSE \'none\' END';
    }

    /** Filtra por tramo de plan. */
    private function applyPlanTierFilter($query, string $tier)
    {
        foreach (self::PLAN_TIERS as $t) {
            if ($t['key'] !== $tier) {
                continue;
            }
            if ($t['key'] === 'none') {
                return $query->whereNull('c.max_users');
            }
            $query->whereNotNull('c.max_users')->where('c.max_users', '>=', $t['min']);

            return $t['max'] === null ? $query : $query->where('c.max_users', '<=', $t['max']);
        }

        return $query;
    }

    /** Etiqueta legible de un tramo. */
    private function planTierLabel(?string $key): string
    {
        foreach (self::PLAN_TIERS as $t) {
            if ($t['key'] === $key) {
                return $t['label'];
            }
        }

        return 'Sin plan';
    }

    /**
     * Filtro por distribuidor, con la convención que ya usa el resto de la
     * aplicación (ContactController, ReportsController): el distribuidor 1 es
     * Conversia y **Winworld es todo lo demás, incluidos los contactos sin
     * distribuidor asignado**, que son la mayoría (44.863 de 69.403). Filtrar
     * literalmente por distributor_id = 2 devuelve 8 contactos y parece que el
     * filtro no funciona.
     */
    private function applyDistributorFilter($query, $distributor)
    {
        if ((string) $distributor === '2') {
            return $query->where(function ($q) {
                $q->where('c.distributor_id', '!=', 1)->orWhereNull('c.distributor_id');
            });
        }

        return $query->where('c.distributor_id', (int) $distributor);
    }


    /**
     * KPIs de las pantallas de estadísticas.
     *
     * Endpoint aparte y consultado en paralelo a propósito: así la tabla o el
     * gráfico de cada pantalla se pintan a su velocidad de siempre y los
     * indicadores llegan cuando lleguen, sin bloquear nada.
     *
     * Todo sale de DOS consultas agregadas por empresa —periodo actual y
     * anterior— en vez de una por indicador. La concentración, el reparto por
     * tramo de plan y la fuga de clientes se derivan en PHP sobre ~6.800 filas,
     * que es gratis comparado con volver a tocar los 5 millones.
     */
    public function fichajesKpis(Request $request)
    {
        if ($request->user()->level !== 'admin' && $request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $tenantId = $request->user()->tenant_id;

        try {
            $to = $request->filled('date_to') ? Carbon::parse($request->date_to)->endOfDay() : Carbon::now()->endOfDay();
        } catch (\Throwable $e) {
            $to = Carbon::now()->endOfDay();
        }
        try {
            $from = $request->filled('date_from') ? Carbon::parse($request->date_from)->startOfDay() : $to->copy()->subDays(7)->startOfDay();
        } catch (\Throwable $e) {
            $from = $to->copy()->subDays(7)->startOfDay();
        }
        if ($from->greaterThan($to)) {
            $from = $to->copy()->subDays(7)->startOfDay();
        }

        // El periodo anterior es uno de la misma longitud pegado justo antes,
        // para que la comparación sea contra algo equivalente.
        $lengthDays = max(1, (int) $from->diffInDays($to->copy()->startOfDay()) + 1);
        $prevTo = $from->copy()->subDay()->endOfDay();
        $prevFrom = $prevTo->copy()->subDays($lengthDays - 1)->startOfDay();

        // Un rango corto permite el detalle completo (índice de calidad y su
        // comparación); uno largo se queda en lo esencial, que es lo único que
        // la pantalla llega a mostrar.
        $detailed = $lengthDays <= self::PREV_DETAIL_MAX_DAYS;

        $filtered = fn (Carbon $a, Carbon $b) => \Illuminate\Support\Facades\DB::table('fichaje_company_daily_stats as f')
            ->leftJoin('contacts as c', function ($j) use ($tenantId) {
                $j->on('c.external_id', '=', 'f.company_external_id')
                  ->where('c.tenant_id', '=', $tenantId);
            })
            ->whereBetween('f.day', [$a->format('Y-m-d'), $b->format('Y-m-d')])
            ->when($request->filled('plan'), fn ($q) => $q->where('c.subscription_plan', $request->input('plan')))
            ->when($request->filled('distributor'), fn ($q) => $this->applyDistributorFilter($q, $request->input('distributor')))
            ->when($request->filled('plan_tier'), fn ($q) => $this->applyPlanTierFilter($q, $request->input('plan_tier')))
            ->when($request->filled('contact_id'), fn ($q) => $q->where('c.id', (int) $request->input('contact_id')))
            ->selectRaw(
                // Las columnas del contacto van como agregados, NO en el GROUP BY:
                // agrupar por cadenas (nombre, fecha) encarecía muchísimo la
                // consulta — 17 s en un rango de 3 meses. Cada empresa tiene un
                // solo contacto, así que MAX() devuelve su valor exacto.
                'f.company_external_id, MAX(c.max_users) as max_users,'
                // Estas cinco solo alimentan el índice de calidad, y COUNT(DISTINCT)
                // es de lo más caro que hay aquí. En rangos largos el delta de
                // calidad no se muestra, así que ni se piden.
                . ($detailed
                    ? ' MAX(c.registration_date) as registration_date,'
                        . ' MIN(f.day) as first_day, COUNT(DISTINCT f.day) as active_days,'
                        . ' MAX(f.active_users) as peak_users,'
                        . ' MAX(COALESCE(f.active_headcount, f.headcount)) as plantilla,'
                    : '')
                . ' SUM(f.clock_in) as entrada, SUM(f.clock_out) as salida,'
                . ' SUM(f.pause) as pausa, SUM(f.return_count) as regreso,'
                . ' SUM(f.manual_count) as manuales,'
                . ' SUM(f.clock_in + f.clock_out + f.pause + f.return_count) as total,'
                . ' SUM(f.active_users) as user_days,'
                . ' SUM(COALESCE(f.active_headcount, f.headcount)) as headcount_days,'
                . ' SUM(CASE WHEN DAYOFWEEK(f.day) IN (1,7)'
                . '     THEN f.clock_in + f.clock_out + f.pause + f.return_count ELSE 0 END) as findes,'
                . ' COUNT(DISTINCT f.day) as dias'
            )
            // Todas las columnas seleccionadas van en el GROUP BY: MariaDB no
            // deduce dependencias funcionales aunque agrupes por la clave.
            ->groupBy('f.company_external_id');

        $cur = $filtered($from, $to)->get();

        // El periodo anterior solo se agrega al completo cuando el rango es
        // corto. En rangos largos esto duplicaba una consulta cara — 52 s a 12
        // meses — para poder comparar el índice de calidad. Por encima del
        // umbral se pide una versión ligera que basta para las variaciones de
        // volumen, clientes y fuga, y el delta de calidad se omite diciéndolo.
        $prevDetailed = $detailed;
        $prev = $prevDetailed
            ? $filtered($prevFrom, $prevTo)->get()
            : \Illuminate\Support\Facades\DB::table('fichaje_company_daily_stats as f')
                ->when(
                    $request->filled('plan') || $request->filled('distributor')
                        || $request->filled('plan_tier') || $request->filled('contact_id'),
                    fn ($q) => $q->leftJoin('contacts as c', function ($j) use ($tenantId) {
                        $j->on('c.external_id', '=', 'f.company_external_id')
                          ->where('c.tenant_id', '=', $tenantId);
                    })
                )
                ->whereBetween('f.day', [$prevFrom->format('Y-m-d'), $prevTo->format('Y-m-d')])
                ->when($request->filled('plan'), fn ($q) => $q->where('c.subscription_plan', $request->input('plan')))
                ->when($request->filled('distributor'), fn ($q) => $this->applyDistributorFilter($q, $request->input('distributor')))
                ->when($request->filled('plan_tier'), fn ($q) => $this->applyPlanTierFilter($q, $request->input('plan_tier')))
                ->when($request->filled('contact_id'), fn ($q) => $q->where('c.id', (int) $request->input('contact_id')))
                ->selectRaw(
                    'f.company_external_id,'
                    . ' SUM(f.clock_in + f.clock_out + f.pause + f.return_count) as total'
                )
                ->groupBy('f.company_external_id')
                ->get();

        $sum = fn ($rows, $k) => (int) $rows->sum(fn ($r) => (int) $r->$k);
        $curTotal = $sum($cur, 'total');
        $prevTotal = $sum($prev, 'total');

        // Días laborables reales del rango, no una estimación: normaliza la
        // media diaria para que una semana y un trimestre sean comparables.
        $workdays = 0;
        for ($d = $from->copy(); $d->lte($to); $d->addDay()) {
            if (!$d->isWeekend()) {
                $workdays++;
            }
        }

        $findes = $sum($cur, 'findes');
        $weekendDays = max(0, $lengthDays - $workdays);

        // Concentración: qué parte del volumen acumulan los N mayores.
        $totals = $cur->map(fn ($r) => (int) $r->total)->sortDesc()->values();
        $topShare = function (int $n) use ($totals, $curTotal) {
            if (!$curTotal || $totals->isEmpty()) {
                return null;
            }

            return round($totals->take($n)->sum() / $curTotal * 100, 1);
        };

        // Uso de plantilla por tramo de plan: el hallazgo de que cae según crece
        // la cuenta. Se agrupa en PHP porque los tramos ya están en memoria.
        $tiers = [];
        foreach (self::PLAN_TIERS as $t) {
            $tiers[$t['key']] = ['key' => $t['key'], 'label' => $t['label'], 'user_days' => 0, 'headcount_days' => 0, 'total' => 0, 'companies' => 0];
        }
        foreach ($cur as $r) {
            $key = $this->tierKeyFor($r->max_users);
            $tiers[$key]['user_days'] += (int) $r->user_days;
            $tiers[$key]['headcount_days'] += (int) $r->headcount_days;
            $tiers[$key]['total'] += (int) $r->total;
            $tiers[$key]['companies']++;
        }
        $usageByTier = collect($tiers)->filter(fn ($t) => $t['companies'] > 0)->map(fn ($t) => [
            'key' => $t['key'],
            'label' => $t['label'],
            'companies' => $t['companies'],
            'total' => $t['total'],
            'usage_pct' => $t['headcount_days'] > 0
                ? round(min(100, $t['user_days'] / $t['headcount_days'] * 100), 1)
                : null,
        ])->values();

        // Fuga: clientes que fichaban en el periodo anterior y han dejado de
        // hacerlo. Es una alerta, no una estadística.
        $curIds = $cur->pluck('company_external_id')->flip();
        $prevIds = $prev->pluck('company_external_id');
        $stopped = $prevIds->reject(fn ($id) => $curIds->has($id))->values();
        $started = $curIds->keys()->reject(fn ($id) => $prevIds->contains($id))->values();

        // Índice de calidad de los dos periodos, con el mismo evaluador que usa la
        // pantalla: así el porcentaje no puede discrepar del reparto que se ve
        // justo debajo. Son ~6.800 filas ya en memoria, no otra consulta.
        $qualityPct = function ($rows, Carbon $a, Carbon $b) {
            $ev = $rows->map(fn ($r) => $this->evaluateCompanyHealth($r, $a, $b));
            $judged = $ev->whereIn('status', ['good', 'warning', 'critical']);

            return $judged->count() > 0
                ? round($judged->where('status', 'good')->count() / $judged->count() * 100, 1)
                : null;
        };
        $quality = $detailed ? $qualityPct($cur, $from, $to) : null;
        $qualityPrev = $prevDetailed ? $qualityPct($prev, $prevFrom, $prevTo) : null;

        $pct = fn ($a, $b) => $b > 0 ? round(($a - $b) / $b * 100, 1) : null;

        return response()->json([
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'prev_from' => $prevFrom->toDateString(),
            'prev_to' => $prevTo->toDateString(),
            'total' => $curTotal,
            'total_prev' => $prevTotal,
            'total_change_pct' => $pct($curTotal, $prevTotal),
            'companies' => $cur->count(),
            'companies_prev' => $prev->count(),
            'companies_change_pct' => $pct($cur->count(), $prev->count()),
            'manual_pct' => $curTotal > 0 ? round($sum($cur, 'manuales') / $curTotal * 100, 2) : null,
            'workdays' => $workdays,
            'weekend_days' => $weekendDays,
            'daily_avg_workday' => $workdays > 0 ? (int) round(($curTotal - $findes) / $workdays) : null,
            'daily_avg_weekend' => $weekendDays > 0 ? (int) round($findes / $weekendDays) : null,
            'weekend_pct' => $curTotal > 0 ? round($findes / $curTotal * 100, 1) : null,
            'by_type' => [
                'entrada' => $sum($cur, 'entrada'),
                'pausa'   => $sum($cur, 'pausa'),
                'regreso' => $sum($cur, 'regreso'),
                'salida'  => $sum($cur, 'salida'),
            ],
            'concentration' => [
                ['n' => 10, 'pct' => $topShare(10)],
                ['n' => 50, 'pct' => $topShare(50)],
                ['n' => 100, 'pct' => $topShare(100)],
                ['n' => 500, 'pct' => $topShare(500)],
            ],
            'usage_by_tier' => $usageByTier,
            'quality_pct' => $quality,
            'quality_prev_available' => $prevDetailed,
            'quality_pct_prev' => $qualityPrev,
            'quality_change_pp' => ($quality !== null && $qualityPrev !== null)
                ? round($quality - $qualityPrev, 1) : null,
            'stopped_count' => $stopped->count(),
            'started_count' => $started->count(),
        ]);
    }

    /** Tramo de plan al que pertenece un número de usuarios contratados. */
    private function tierKeyFor($maxUsers): string
    {
        if ($maxUsers === null) {
            return 'none';
        }
        foreach (self::PLAN_TIERS as $t) {
            if ($t['key'] === 'none') {
                continue;
            }
            if ($maxUsers >= $t['min'] && ($t['max'] === null || $maxUsers <= $t['max'])) {
                return $t['key'];
            }
        }

        return 'none';
    }

    /** Aplica las tres señales a una empresa y devuelve estado + motivos. */
    private function evaluateCompanyHealth($r, Carbon $rangeStart, Carbon $rangeEnd): array
    {
        $entrada = (int) $r->entrada; $salida = (int) $r->salida;
        $pausa = (int) $r->pausa;     $regreso = (int) $r->regreso;
        $total = (int) $r->total;     $userDays = (int) $r->user_days;
        $plantilla = ($r->plantilla ?? null) !== null ? (int) $r->plantilla : null;
        $peak = (int) ($r->peak_users ?? 0);

        $gap = function (int $a, int $b): ?float {
            $max = max($a, $b);
            if ($max < self::MIN_PAIR_VOLUME) {
                return null; // base insuficiente: el porcentaje sería ruido
            }
            return abs($a - $b) / $max * 100;
        };
        $gapIo = $gap($entrada, $salida);
        $gapPr = $gap($pausa, $regreso);
        $perUser = $userDays ? $total / $userDays : null;

        // % de uso = empleados que fichan sobre plantilla, promediado por día:
        // user_days / headcount_days. Antes se usaba el PICO de empleados sobre
        // la plantilla, que es optimista (mide el mejor día) y, sobre todo, deja
        // de significar nada al agregar varias empresas en un tramo de plan, que
        // es como se consulta ahora. Esta forma es correcta en ambos modos.
        // Se recorta al 100%: la plantilla registrada se queda corta a menudo.
        $headcountDays = (int) ($r->headcount_days ?? 0);
        $usage = $headcountDays > 0 ? min(100, $userDays / $headcountDays * 100) : null;

        // Antigüedad = desde su fecha de ALTA, no desde el primer fichaje del
        // rango. Si se calculara sobre el rango, al filtrar una semana todas las
        // empresas parecerían recién incorporadas. registration_date está
        // informado en el 99,7% de los contactos y es exactamente el dato que
        // distingue "acaba de darse de alta" de "lleva años y no lo usa".
        $end = $rangeEnd->copy()->startOfDay();
        $registered = ($r->registration_date ?? null) ? Carbon::parse($r->registration_date)->startOfDay() : null;
        $observedDays = $registered && $registered->lte($end)
            ? (int) $registered->diffInDays($end) + 1
            : 0;

        $activeDays = (int) ($r->active_days ?? 0);

        // La regularidad se mide sobre la ventana realmente observada: el rango
        // pedido, recortado por la fecha de alta si es posterior. Así un rango de
        // una semana se compara contra los laborables de esa semana, y no contra
        // los de los tres años que la empresa lleva de cliente.
        $windowStart = $registered && $registered->gt($rangeStart)
            ? $registered
            : $rangeStart->copy()->startOfDay();
        $windowDays = max(1, (int) $windowStart->diffInDays($end) + 1);
        $workingDays = max(1, (int) round($windowDays * 5 / 7));

        // Al agrupar por tramo de plan estas dos no aplican: los días activos son
        // los del conjunto, no los de una empresa.
        $isAggregate = (bool) ($r->aggregate ?? false);
        $regularity = $isAggregate ? null : min(1, $activeDays / $workingDays);
        if ($isAggregate) {
            $observedDays = 0;
        }

        // Llevar poco tiempo NO impide valorar: es contexto, no un veredicto.
        // Solo invalida la regularidad, que necesita recorrido para significar
        // algo. Los descuadres y la intensidad son ratios y les basta volumen,
        // así que una empresa con 400 fichajes en 8 días sí se puede evaluar.
        $isNew = $observedDays > 0 && $observedDays < self::MIN_OBSERVED_DAYS;
        if ($isNew) {
            $regularity = null;
        }

        $reasons = [];
        $status = 'good';

        if ($isNew) {
            $reasons[] = sprintf(
                'Se dio de alta hace %d día%s, el %s.',
                $observedDays, $observedDays === 1 ? '' : 's', $registered->format('d/m/Y')
            );
        }

        // Sin volumen para los descuadres y sin recorrido para la regularidad no
        // queda nada que medir. Se distingue el porqué en vez de un genérico
        // "sin datos": no es lo mismo acabar de empezar que llevar meses sin usarlo.
        if ($total < self::MIN_VOLUME && $regularity === null) {
            $status = $isNew ? 'new' : 'unknown';
            $reasons[] = $isNew
                ? 'Aún no hay recorrido suficiente para valorar la calidad.'
                : "Solo {$total} fichajes en el rango: muy pocos para valorar.";
        } else {
            if ($gapIo !== null && $gapIo >= self::GAP_WARN) {
                $falta = $entrada > $salida ? 'salidas' : 'entradas';
                $reasons[] = sprintf('Entradas %s frente a salidas %s: %.1f %% de diferencia. Faltan %s.', number_format($entrada, 0, ',', '.'), number_format($salida, 0, ',', '.'), $gapIo, $falta);
            }
            if ($gapPr !== null && $gapPr >= self::GAP_WARN) {
                $falta = $pausa > $regreso ? 'regresos' : 'pausas';
                $reasons[] = sprintf('Pausas %s frente a regresos %s: %.1f %% de diferencia. Faltan %s.', number_format($pausa, 0, ',', '.'), number_format($regreso, 0, ',', '.'), $gapPr, $falta);
            }
            if ($perUser !== null && $perUser < self::PER_USER_WARN) {
                $reasons[] = sprintf('%.2f fichajes por empleado y día, cuando una jornada completa son 2 como mínimo. Hay jornadas sin cerrar.', $perUser);
            }

            $regLevel = 1;
            if ($regularity !== null && $regularity < self::REGULARITY_WARN) {
                $regLevel = $regularity < self::REGULARITY_CRIT ? 3 : 2;
                $reasons[] = sprintf(
                    'Solo ficharon %d de los ~%d días laborables del periodo (%.0f %%). El sistema apenas se usa.',
                    $activeDays, $workingDays, $regularity * 100
                );
            }

            $worstGap = max($gapIo ?? 0, $gapPr ?? 0);
            $gapLevel = $worstGap >= self::GAP_CRIT ? 3 : ($worstGap >= self::GAP_WARN ? 2 : 1);
            $puLevel = 1;
            if ($perUser !== null && $perUser < self::PER_USER_WARN) {
                $puLevel = $perUser < self::PER_USER_CRIT ? 3 : 2;
            }
            $level = max($gapLevel, $puLevel, $regLevel);
            $status = [1 => 'good', 2 => 'warning', 3 => 'critical'][$level];

            if ($status === 'good') {
                $reasons[] = $regularity === null
                    ? 'Entradas y salidas cuadran, las pausas se cierran y cada empleado ficha su jornada completa.'
                    : 'Entradas y salidas cuadran, las pausas se cierran, cada empleado ficha su jornada completa y lo hacen con regularidad.';
            }
        }

        // Los campos descriptivos son opcionales: el cálculo de KPIs reutiliza
        // este evaluador con una consulta más ligera que no los selecciona.
        return [
            'company_external_id' => $r->company_external_id,
            'contact_id' => isset($r->contact_id) && $r->contact_id ? (int) $r->contact_id : null,
            'name'       => ($r->name ?? null) ?: '(sin contacto sincronizado)',
            'plan'       => $r->plan ?? null,
            'distributor_id' => isset($r->distributor_id) && $r->distributor_id ? (int) $r->distributor_id : null,
            'entrada' => $entrada, 'salida' => $salida, 'pausa' => $pausa, 'regreso' => $regreso,
            'manuales' => (int) ($r->manuales ?? 0),
            'total' => $total,
            'active_users' => $peak,
            'plantilla' => $plantilla,
            'usage_pct' => $usage !== null ? round($usage, 1) : null,
            'gap_io'   => $gapIo !== null ? round($gapIo, 1) : null,
            'gap_pr'   => $gapPr !== null ? round($gapPr, 1) : null,
            'per_user' => $perUser !== null ? round($perUser, 2) : null,
            'registered_at' => $registered?->toDateString(),
            'observed_days' => $observedDays,
            'window_days'   => $windowDays,
            'is_new'        => $isNew,
            'active_days'   => $activeDays,
            'regularity'    => $regularity !== null ? round($regularity * 100, 1) : null,
            'status'   => $status,
            'reasons'  => $reasons,
        ];
    }
}
