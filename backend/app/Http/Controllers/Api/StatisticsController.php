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
            ->when($request->filled('distributor'), fn ($q) => $this->applyDistributorFilter($q, $request->input('distributor')))
            ->when($request->filled('contact_id'), fn ($q) => $q->where('c.id', (int) $request->input('contact_id')));

        // Una sola pasada sobre la tabla. Antes eran tres consultas (el top N,
        // los totales y el recuento de clientes) y con 5 millones de filas eso
        // se notaba: el endpoint tardaba 6,7 s. Agregando una vez y derivando
        // el resto en PHP sobre ~6.800 filas, baja a un tercio.
        $all = $base
            ->selectRaw(
                'f.company_external_id, c.id as contact_id, c.name, c.subscription_plan as plan,'
                . ' c.distributor_id, MAX(f.headcount) as headcount, MAX(f.active_users) as peak_users,'
                . ' SUM(f.active_users) as user_days,'
                . ' MAX(COALESCE(f.active_headcount, f.headcount)) as plantilla,'
                . ' MIN(f.day) as first_day, COUNT(DISTINCT f.day) as active_days,'
                . ' SUM(f.clock_in) as entrada, SUM(f.clock_out) as salida, SUM(f.pause) as pausa,'
                . ' SUM(f.return_count) as regreso, SUM(f.manual_count) as manuales,'
                . ' SUM(f.clock_in + f.clock_out + f.pause + f.return_count) as total'
            )
            ->groupBy('f.company_external_id', 'c.id', 'c.name', 'c.subscription_plan', 'c.distributor_id')
            ->get();

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
            'companies' => $companies->map(fn ($r) => $this->evaluateCompanyHealth($r, $to) + [
                'user_days' => (int) $r->user_days,
                'headcount' => $r->headcount !== null ? (int) $r->headcount : null,
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
        $rows = \Illuminate\Support\Facades\DB::table('fichaje_company_daily_stats as f')
            ->leftJoin('contacts as c', function ($j) use ($tenantId) {
                $j->on('c.external_id', '=', 'f.company_external_id')
                  ->where('c.tenant_id', '=', $tenantId);
            })
            ->where('f.day', '>=', $from->format('Y-m-d'))
            ->where('f.day', '<=', $to->format('Y-m-d'))
            ->when($request->filled('plan'), fn ($q) => $q->where('c.subscription_plan', $request->input('plan')))
            ->when($request->filled('distributor'), fn ($q) => $this->applyDistributorFilter($q, $request->input('distributor')))
            ->when($request->filled('contact_id'), fn ($q) => $q->where('c.id', (int) $request->input('contact_id')))
            ->when($request->filled('search'), fn ($q) => $q->where('c.name', 'like', '%' . $request->input('search') . '%'))
            ->selectRaw(
                'f.company_external_id, c.id as contact_id, c.name, c.subscription_plan as plan, c.distributor_id,'
                . ' SUM(f.clock_in) as entrada, SUM(f.clock_out) as salida,'
                . ' SUM(f.pause) as pausa, SUM(f.return_count) as regreso,'
                . ' SUM(f.manual_count) as manuales,'
                . ' SUM(f.clock_in + f.clock_out + f.pause + f.return_count) as total,'
                . ' SUM(f.active_users) as user_days, MAX(f.active_users) as peak_users,'
                . ' MAX(COALESCE(f.active_headcount, f.headcount)) as plantilla,'
                . ' MIN(f.day) as first_day, COUNT(DISTINCT f.day) as active_days'
            )
            ->groupBy('f.company_external_id', 'c.id', 'c.name', 'c.subscription_plan', 'c.distributor_id')
            ->get();

        $evaluated = $rows->map(fn ($r) => $this->evaluateCompanyHealth($r, $to));

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

    /** Aplica las tres señales a una empresa y devuelve estado + motivos. */
    private function evaluateCompanyHealth($r, Carbon $rangeEnd): array
    {
        $entrada = (int) $r->entrada; $salida = (int) $r->salida;
        $pausa = (int) $r->pausa;     $regreso = (int) $r->regreso;
        $total = (int) $r->total;     $userDays = (int) $r->user_days;
        $plantilla = $r->plantilla !== null ? (int) $r->plantilla : null;
        $peak = (int) $r->peak_users;

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

        // Puede pasar del 100%: COMPANY_CURRENT_USERS se queda corto a menudo.
        // Se recorta para que el indicador no mienta al alza.
        $usage = ($plantilla && $plantilla > 0) ? min(100, $peak / $plantilla * 100) : null;

        // Periodo REAL de la empresa, no la ventana del filtro: desde su primer
        // fichaje hasta el final del rango. Una empresa dada de alta este mes no
        // puede juzgarse con la vara de una que lleva tres años.
        $firstDay = $r->first_day ? Carbon::parse($r->first_day)->startOfDay() : null;
        // startOfDay en ambos extremos: el rango llega con hora 23:59:59 y
        // diffInDays devolvería un float feo (46,99999…).
        $observedDays = $firstDay
            ? (int) $firstDay->diffInDays($rangeEnd->copy()->startOfDay()) + 1
            : 0;
        $activeDays = (int) ($r->active_days ?? 0);

        // Días con fichajes sobre los laborables del periodo observado. Es la
        // señal que faltaba: la intensidad solo mira los días que ficharon, así
        // que quien ficha dos días en tres meses sale con 2,0 y parece perfecto.
        $workingDays = max(1, (int) round($observedDays * 5 / 7));
        $regularity = $observedDays > 0 ? min(1, $activeDays / $workingDays) : null;

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
                'Lleva %d día%s fichando, desde el %s.',
                $observedDays, $observedDays === 1 ? '' : 's', $firstDay->format('d/m/Y')
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
                    'Solo ficharon %d de los ~%d días laborables desde el %s (%.0f %%). El sistema apenas se usa.',
                    $activeDays, $workingDays, $firstDay->format('d/m/Y'), $regularity * 100
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

        return [
            'company_external_id' => $r->company_external_id,
            'contact_id' => $r->contact_id ? (int) $r->contact_id : null,
            'name'       => $r->name ?: '(sin contacto sincronizado)',
            'plan'       => $r->plan,
            'distributor_id' => $r->distributor_id ? (int) $r->distributor_id : null,
            'entrada' => $entrada, 'salida' => $salida, 'pausa' => $pausa, 'regreso' => $regreso,
            'manuales' => (int) $r->manuales,
            'total' => $total,
            'active_users' => $peak,
            'plantilla' => $plantilla,
            'usage_pct' => $usage !== null ? round($usage, 1) : null,
            'gap_io'   => $gapIo !== null ? round($gapIo, 1) : null,
            'gap_pr'   => $gapPr !== null ? round($gapPr, 1) : null,
            'per_user' => $perUser !== null ? round($perUser, 2) : null,
            'first_day'     => $firstDay?->toDateString(),
            'observed_days' => $observedDays,
            'is_new'        => $isNew,
            'active_days'   => $activeDays,
            'regularity'    => $regularity !== null ? round($regularity * 100, 1) : null,
            'status'   => $status,
            'reasons'  => $reasons,
        ];
    }
}
