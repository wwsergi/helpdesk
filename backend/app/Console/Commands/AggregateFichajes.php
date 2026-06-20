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

    protected $description = 'Pre-agrega los fichajes de Intratime (login_logout) en la tabla local fichaje_daily_stats, troceando día a día para no saturar la BD origen';

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

            $totalDays++;
            if ($totalDays % 30 === 0) {
                $this->info("  {$totalDays} días procesados (último: {$dayStr})…");
            }
        }

        $msg = sprintf('fichajes:aggregate OK — %d días, %d filas%s.', $totalDays, $totalRows, $failed ? ", {$failed} días con error" : '');
        $this->info($msg);
        Log::info($msg);

        return self::SUCCESS;
    }
}
