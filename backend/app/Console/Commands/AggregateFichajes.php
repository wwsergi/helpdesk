<?php

namespace App\Console\Commands;

use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AggregateFichajes extends Command
{
    protected $signature = 'fichajes:aggregate
        {--days=45 : Días hacia atrás a reagregar (modo incremental)}
        {--full : Reagregar desde el primer registro existente (backfill completo)}';

    protected $description = 'Pre-agrega los fichajes de Intratime (login_logout) en las tablas locales fichaje_daily_stats (global) y fichaje_company_daily_stats (por empresa), troceando día a día para no saturar la BD origen';

    public function handle(): int
    {
        $full = (bool) $this->option('full');
        $days = max(1, (int) $this->option('days'));

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
        if ($full) {
            $min = $conn->table('login_logout')->whereNull('INOUT_DELETED_AT')->min('INOUT_DATE');
            $start = $min ? Carbon::parse($min)->startOfDay() : $end->copy()->subYears(5);
        } else {
            $start = $end->copy()->subDays($days);
        }

        $this->info(sprintf('Agregando fichajes día a día: %s → %s', $start->toDateString(), $end->toDateString()));

        $now = Carbon::now();
        $totalDays = 0;
        $totalRows = 0;
        $companyRows = 0;
        $failed = 0;

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
                $failed++;
                $this->warn("  {$dayStr} (empresas) saltado: " . $e->getMessage());
                Log::warning("fichajes:aggregate {$dayStr} desglose por empresa falló: " . $e->getMessage());
                $byCompany = collect();
            }

            DB::transaction(function () use ($byCompany, $dayStr, $now, &$companyRows) {
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
            'fichajes:aggregate OK — %d días, %d filas globales, %d filas por empresa%s.',
            $totalDays, $totalRows, $companyRows, $failed ? ", {$failed} días con error" : ''
        );
        $this->info($msg);
        Log::info($msg);

        return self::SUCCESS;
    }
}
