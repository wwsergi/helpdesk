<?php

namespace App\Console\Commands;

use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AggregateFichajes extends Command
{
    protected $signature = 'fichajes:aggregate
        {--days=365 : Días hacia atrás a reagregar (modo incremental)}
        {--since= : Fecha de inicio explícita, YYYY-MM-DD}
        {--full : Reagregar todo el histórico desde HISTORY_START}
        {--auto : Modo nocturno: histórico completo si falta, y si no los últimos 365 días}
        {--audit : Antes de reescribir cada día, anota en fichaje_aggregate_audit si los datos han cambiado}';

    /**
     * Intratime arrancó en 2013; lo anterior son 3.178 filas de pruebas.
     *
     * 🔴 NO usar min(INOUT_DATE) para arrancar un backfill: la tabla tiene
     * fechas corruptas y su mínimo real es 0000-06-10, o sea 740.085 días hasta
     * hoy. Recorrerlos día a día son más de ocho años de ejecución contra la
     * réplica. Por eso el suelo es una constante y no un dato de la tabla.
     */
    public const HISTORY_START = '2013-01-01';

    protected $description = 'Pre-agrega los fichajes de Intratime (login_logout) en las tablas locales fichaje_daily_stats (global) y fichaje_company_daily_stats (por empresa), troceando día a día para no saturar la BD origen';

    public function handle(): int
    {
        $full  = (bool) $this->option('full');
        $days  = max(1, (int) $this->option('days'));
        $audit = (bool) $this->option('audit');

        $conn = DB::connection('paneladmin');
        // Cada consulta cubre UN solo día (~1-2s). El cap es un seguro por si un día
        // tuviera un volumen anómalo; nunca se agrega toda la tabla de una vez.
        try {
            $conn->statement('SET SESSION max_execution_time = 30000'); // 30s por consulta-día
        } catch (\Throwable $e) {
            $this->error('No se pudo conectar a Intratime: ' . $e->getMessage());
            Log::error('fichajes:aggregate — conexión paneladmin falló: ' . $e->getMessage());
            return self::FAILURE;
        }

        $end = Carbon::now()->startOfDay();

        // Modo nocturno: la primera vez reconstruye todo el histórico; a partir
        // de ahí solo los últimos 12 meses, que es donde se mueven los datos.
        // Se decide mirando hasta dónde llega la tabla local, así que si algún
        // día se vacía o se queda a medias, la noche siguiente se recompone
        // sola sin que nadie tenga que acordarse.
        if ($this->option('auto')) {
            $minLocal = DB::table('fichaje_company_daily_stats')->min('day');
            $needsHistory = !$minLocal
                || Carbon::parse($minLocal)->gt(Carbon::parse(self::HISTORY_START));

            if ($needsHistory) {
                $full = true;
                $this->info($minLocal
                    ? "Histórico incompleto (empieza en {$minLocal}): reconstruyendo desde " . self::HISTORY_START . '.'
                    : 'Tabla vacía: reconstruyendo el histórico completo.');
            } else {
                $days = 365;
            }
        }

        if ($since = $this->option('since')) {
            try {
                $start = Carbon::parse($since)->startOfDay();
            } catch (\Throwable $e) {
                $this->error("Fecha --since no válida: {$since}");
                return self::FAILURE;
            }
        } elseif ($full) {
            $start = Carbon::parse(self::HISTORY_START)->startOfDay();
        } else {
            $start = $end->copy()->subDays($days);
        }

        // Nunca por debajo del suelo: evita recorrer siglos de fechas corruptas.
        $floor = Carbon::parse(self::HISTORY_START)->startOfDay();
        if ($start->lt($floor)) {
            $this->warn('La fecha de inicio es anterior a ' . self::HISTORY_START . '; se ajusta a ese suelo.');
            $start = $floor;
        }

        $totalToProcess = $start->diffInDays($end) + 1;
        $this->info(sprintf(
            'Agregando fichajes día a día: %s → %s (%d días, ~%d min estimados)',
            $start->toDateString(), $end->toDateString(), $totalToProcess, (int) ceil($totalToProcess * 1.1 / 60)
        ));

        // Plantilla activa por empresa. Se resuelve UNA vez por ejecución (una
        // consulta de ~68k filas) en vez de por día: el valor es el de hoy, no
        // el histórico, porque Intratime no guarda esa evolución.
        $activeHeadcount = [];
        try {
            foreach ($conn->table('users')
                ->where('USER_IS_ACTIVE', 1)
                ->whereNotNull('USER_COMPANY')
                ->where('USER_COMPANY', '<>', '')
                ->selectRaw('USER_COMPANY as company, COUNT(*) as n')
                ->groupBy('USER_COMPANY')
                ->cursor() as $row) {
                $activeHeadcount[(string) $row->company] = (int) $row->n;
            }
            $this->info(sprintf('Plantilla activa resuelta para %d empresas.', count($activeHeadcount)));
        } catch (\Throwable $e) {
            $this->warn('No se pudo calcular la plantilla activa: ' . $e->getMessage());
            Log::warning('fichajes:aggregate — plantilla activa falló: ' . $e->getMessage());
        }

        $now = Carbon::now();
        $totalDays = 0;
        $totalRows = 0;
        $companyRows = 0;
        $failed = 0;
        $changedDays = 0;

        for ($d = $start->copy(); $d->lte($end); $d->addDay()) {
            $dayStr   = $d->format('Y-m-d');
            $dayStart = $d->format('Y-m-d 00:00:00');
            $dayEnd   = $d->copy()->addDay()->format('Y-m-d 00:00:00');

            try {
                $rows = $conn->table('login_logout')
                    ->whereNull('INOUT_DELETED_AT')
                    ->whereIn('INOUT_TYPE', [0, 1, 2, 3])
                    ->where('INOUT_DATE', '>=', $dayStart)
                    ->where('INOUT_DATE', '<', $dayEnd)
                    ->selectRaw('INOUT_TYPE as t, CASE WHEN INOUT_SOURCE = 3 THEN 1 ELSE 0 END as is_manual, COUNT(*) as c')
                    ->groupBy('t', 'is_manual')
                    ->get();
            } catch (\Throwable $e) {
                $failed++;
                $this->warn("  {$dayStr} saltado: " . $e->getMessage());
                Log::warning("fichajes:aggregate {$dayStr} falló: " . $e->getMessage());
                continue;
            }

            // Cada día es atómico e idempotente: borra y reinserta solo ese día.
            DB::transaction(function () use ($rows, $dayStr, $now, &$totalRows) {
                DB::table('fichaje_daily_stats')->where('day', $dayStr)->delete();
                if ($rows->isNotEmpty()) {
                    $insert = $rows->map(fn ($r) => [
                        'day'        => $dayStr,
                        'inout_type' => (int) $r->t,
                        'is_manual'  => (int) $r->is_manual,
                        'count'      => (int) $r->c,
                        'updated_at' => $now,
                    ])->all();
                    DB::table('fichaje_daily_stats')->insert($insert);
                    $totalRows += count($insert);
                }
            });

            // ── Desglose por empresa ────────────────────────────────────────
            // Segunda consulta del mismo día. Se mantiene separada de la global
            // para no alterar el comportamiento de fichaje_daily_stats, que ya
            // está en producción. El join va contra users.USER_ID (PK) y
            // companies.COMPANY_UNIQUE_ID (único): ~1s por día.
            try {
                $byCompany = $conn->table('login_logout as ll')
                    ->join('users as u', 'u.USER_ID', '=', 'll.INOUT_USER_ID')
                    ->leftJoin('companies as c', 'c.COMPANY_UNIQUE_ID', '=', 'u.USER_COMPANY')
                    ->whereNull('ll.INOUT_DELETED_AT')
                    ->whereIn('ll.INOUT_TYPE', [0, 1, 2, 3])
                    ->where('ll.INOUT_DATE', '>=', $dayStart)
                    ->where('ll.INOUT_DATE', '<', $dayEnd)
                    ->whereNotNull('u.USER_COMPANY')
                    ->where('u.USER_COMPANY', '<>', '')
                    ->selectRaw(
                        'u.USER_COMPANY as company,'
                        . ' SUM(ll.INOUT_TYPE = 0) as clock_in,'
                        . ' SUM(ll.INOUT_TYPE = 1) as clock_out,'
                        . ' SUM(ll.INOUT_TYPE = 2) as pause,'
                        . ' SUM(ll.INOUT_TYPE = 3) as return_count,'
                        . ' SUM(ll.INOUT_TYPE = 0 AND ll.INOUT_SOURCE = 3) as clock_in_manual,'
                        . ' SUM(ll.INOUT_TYPE = 1 AND ll.INOUT_SOURCE = 3) as clock_out_manual,'
                        . ' SUM(ll.INOUT_TYPE = 2 AND ll.INOUT_SOURCE = 3) as pause_manual,'
                        . ' SUM(ll.INOUT_TYPE = 3 AND ll.INOUT_SOURCE = 3) as return_manual,'
                        . ' SUM(ll.INOUT_SOURCE = 3) as manual_count,'
                        . ' COUNT(DISTINCT ll.INOUT_USER_ID) as active_users,'
                        . ' MAX(c.COMPANY_CURRENT_USERS) as headcount'
                    )
                    ->groupBy('u.USER_COMPANY')
                    ->get();
            } catch (\Throwable $e) {
                // 🔴 continue, NO seguir con $byCompany vacío. La escritura de
                // más abajo borra el día antes de insertar, así que caer aquí
                // con una colección vacía BORRABA el desglose del día y lo
                // dejaba en blanco hasta la noche siguiente — y el mensaje
                // decía "saltado", con lo que no había forma de enterarse.
                // El caso no es teórico: la consulta global es un COUNT sobre
                // una tabla indexada y esta es un join a tres bandas con el
                // tope de 30 s, así que es justo la que puede reventar sola.
                // Saltando, el día conserva lo que ya tenía (dato de ayer, no
                // un agujero) y la noche siguiente vuelve a intentarlo.
                $failed++;
                $this->warn("  {$dayStr} (empresas) saltado, se conserva lo anterior: " . $e->getMessage());
                Log::warning("fichajes:aggregate {$dayStr} desglose por empresa falló, día conservado: " . $e->getMessage());
                continue;
            }

            // Auditoría: comparar lo almacenado con lo que acaba de llegar, ANTES
            // de machacarlo. Va fuera de la transacción de escritura a propósito:
            // es una medición, y si fallara no debe tumbar la agregación.
            if ($audit) {
                try {
                    $before = DB::table('fichaje_company_daily_stats')
                        ->where('day', $dayStr)
                        ->get()
                        ->keyBy('company_external_id')
                        ->map(fn ($r) => $this->storedSignature($r))
                        ->all();

                    $after = [];
                    foreach ($byCompany as $r) {
                        $after[(string) $r->company] = $this->incomingSignature($r, $activeHeadcount);
                    }

                    $diff = $this->diffDay($before, $after);
                    if ($diff['changed']) {
                        $changedDays++;
                    }

                    $this->recordAudit($dayStr, $diff, $now);
                } catch (\Throwable $e) {
                    $this->warn("  {$dayStr} auditoría falló: " . $e->getMessage());
                    Log::warning("fichajes:aggregate {$dayStr} auditoría falló: " . $e->getMessage());
                }
            }

            DB::transaction(function () use ($byCompany, $dayStr, $now, $activeHeadcount, &$companyRows) {
                DB::table('fichaje_company_daily_stats')->where('day', $dayStr)->delete();
                foreach ($byCompany->chunk(500) as $chunk) {
                    $insert = $chunk->map(fn ($r) => [
                        'day'                 => $dayStr,
                        'company_external_id' => (string) $r->company,
                        'clock_in'            => (int) $r->clock_in,
                        'clock_out'           => (int) $r->clock_out,
                        'pause'               => (int) $r->pause,
                        'return_count'        => (int) $r->return_count,
                        'clock_in_manual'     => (int) $r->clock_in_manual,
                        'clock_out_manual'    => (int) $r->clock_out_manual,
                        'pause_manual'        => (int) $r->pause_manual,
                        'return_manual'       => (int) $r->return_manual,
                        'manual_count'        => (int) $r->manual_count,
                        'active_users'        => (int) $r->active_users,
                        'headcount'           => $r->headcount !== null ? (int) $r->headcount : null,
                        'active_headcount'    => $activeHeadcount[(string) $r->company] ?? null,
                        'updated_at'          => $now,
                    ])->values()->all();
                    DB::table('fichaje_company_daily_stats')->insert($insert);
                    $companyRows += count($insert);
                }
            });

            $totalDays++;
            if ($totalDays % 30 === 0) {
                $this->info("  {$totalDays} días procesados (último: {$dayStr})…");
            }
        }

        $msg = sprintf(
            'fichajes:aggregate OK — %d días, %d filas globales, %d filas por empresa%s%s.',
            $totalDays, $totalRows, $companyRows,
            $failed ? ", {$failed} días con error" : '',
            $audit ? ", {$changedDays} de {$totalDays} días con datos distintos" : ''
        );
        $this->info($msg);
        Log::info($msg);

        return self::SUCCESS;
    }

    /**
     * Las doce columnas que el agregador escribe por empresa y día, en orden.
     * La firma de un día es el conjunto de estas tuplas: si cambia una sola
     * cifra, cambia la firma. Los nulos se marcan con 'n' para distinguir
     * "sin plantilla registrada" de "plantilla cero", que no es lo mismo.
     */
    private function signature(array $v): string
    {
        return implode(',', array_map(
            fn ($x) => $x === null ? 'n' : (string) (int) $x,
            $v
        ));
    }

    /** Firma de una fila ya almacenada en fichaje_company_daily_stats. */
    private function storedSignature($r): string
    {
        return $this->signature([
            $r->clock_in, $r->clock_out, $r->pause, $r->return_count,
            $r->clock_in_manual, $r->clock_out_manual, $r->pause_manual, $r->return_manual,
            $r->manual_count, $r->active_users, $r->headcount, $r->active_headcount,
        ]);
    }

    /**
     * Firma de una fila recién traída de Intratime. Tiene que construirse con
     * EXACTAMENTE las mismas conversiones que hace el insert de más abajo
     * (casts a int, active_headcount desde el mapa de plantilla), o la
     * comparación marcaría como cambiados días que solo difieren en el tipo.
     */
    private function incomingSignature($r, array $activeHeadcount): string
    {
        return $this->signature([
            (int) $r->clock_in, (int) $r->clock_out, (int) $r->pause, (int) $r->return_count,
            (int) $r->clock_in_manual, (int) $r->clock_out_manual,
            (int) $r->pause_manual, (int) $r->return_manual,
            (int) $r->manual_count, (int) $r->active_users,
            $r->headcount !== null ? (int) $r->headcount : null,
            $activeHeadcount[(string) $r->company] ?? null,
        ]);
    }

    /**
     * Anota el resultado de auditar un día. ACUMULATIVO a propósito: una sola
     * pasada no responde nada, porque el nocturno reagrega estos mismos días
     * cada noche y por tanto compara contra lo de anoche. La pregunta —hasta
     * dónde atrás se mueven los datos— se contesta dejándolo varias noches y
     * mirando times_changed y last_changed_at.
     */
    private function recordAudit(string $dayStr, array $diff, Carbon $now): void
    {
        $prev = DB::table('fichaje_aggregate_audit')->where('day', $dayStr)->first();

        DB::table('fichaje_aggregate_audit')->updateOrInsert(
            ['day' => $dayStr],
            [
                'times_checked'     => ($prev->times_checked ?? 0) + 1,
                'times_changed'     => ($prev->times_changed ?? 0) + ($diff['changed'] ? 1 : 0),
                'first_checked_at'  => $prev->first_checked_at ?? $now,
                'last_checked_at'   => $now,
                'last_changed_at'   => $diff['changed'] ? $now : ($prev->last_changed_at ?? null),
                'changed_last'      => $diff['changed'],
                'companies_before'  => $diff['companies_before'],
                'companies_after'   => $diff['companies_after'],
                'companies_added'   => $diff['companies_added'],
                'companies_removed' => $diff['companies_removed'],
                'companies_changed' => $diff['companies_changed'],
                'total_before'      => $diff['total_before'],
                'total_after'       => $diff['total_after'],
            ]
        );
    }

    /**
     * Compara las firmas de un día — antes contra después — y devuelve las
     * columnas de fichaje_aggregate_audit. Función pura: recibe dos mapas
     * empresa => firma y no toca nada.
     */
    private function diffDay(array $before, array $after): array
    {
        $added   = array_diff_key($after, $before);
        $removed = array_diff_key($before, $after);

        $changed = 0;
        foreach (array_intersect_key($after, $before) as $company => $sig) {
            if ($sig !== $before[$company]) {
                $changed++;
            }
        }

        // El total del día son las cuatro primeras cifras de cada firma: las
        // marcas reales (entrada, salida, pausa, regreso), sin los desgloses
        // de manuales, que ya van incluidos dentro de esas cuatro.
        $volume = function (array $sigs): int {
            $t = 0;
            foreach ($sigs as $sig) {
                $p = explode(',', $sig);
                $t += (int) $p[0] + (int) $p[1] + (int) $p[2] + (int) $p[3];
            }

            return $t;
        };

        return [
            'companies_before'  => count($before),
            'companies_after'   => count($after),
            'companies_added'   => count($added),
            'companies_removed' => count($removed),
            'companies_changed' => $changed,
            'total_before'      => $volume($before),
            'total_after'       => $volume($after),
            'changed'           => count($added) > 0 || count($removed) > 0 || $changed > 0,
        ];
    }
}
