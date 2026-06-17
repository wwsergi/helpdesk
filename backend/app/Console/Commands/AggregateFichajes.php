<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AggregateFichajes extends Command
{
    protected $signature = 'fichajes:aggregate
        {--days=45 : Días hacia atrás a reagregar (modo incremental)}
        {--full : Reagregar TODO el histórico (backfill inicial, consulta pesada)}';

    protected $description = 'Pre-agrega los fichajes de Intratime (login_logout) en la tabla local fichaje_daily_stats';

    public function handle(): int
    {
        $full = (bool) $this->option('full');
        $days = max(1, (int) $this->option('days'));

        $this->info($full ? 'Backfill COMPLETO de fichajes…' : "Reagregando últimos {$days} días de fichajes…");

        try {
            $conn = DB::connection('paneladmin');
            // El backfill completo escanea ~73M filas → cap alto (off-peak, puntual).
            // El incremental es ligero → cap moderado. Evita que la consulta quede colgada.
            $conn->statement('SET SESSION max_execution_time = ' . ($full ? 290000 : 60000));

            $query = $conn->table('login_logout')
                ->whereNull('INOUT_DELETED_AT')
                ->whereIn('INOUT_TYPE', [0, 1, 2, 3])
                ->selectRaw('DATE(INOUT_DATE) as d, INOUT_TYPE as t, CASE WHEN INOUT_SOURCE = 3 THEN 1 ELSE 0 END as is_manual, COUNT(*) as c')
                ->groupBy('d', 't', 'is_manual');

            $fromDate = null;
            if (!$full) {
                $fromDate = now()->subDays($days)->format('Y-m-d');
                $query->where('INOUT_DATE', '>=', $fromDate . ' 00:00:00');
            }

            $rows = $query->get();
        } catch (\Throwable $e) {
            $this->error('Fallo consultando Intratime: ' . $e->getMessage());
            Log::error('fichajes:aggregate — consulta a paneladmin falló: ' . $e->getMessage());
            return self::FAILURE;
        }

        // Escritura en la BD local (RDS). Borramos la ventana afectada y reinsertamos
        // para que recuentos a la baja (filas borradas en origen) queden reflejados.
        $now = now();
        DB::transaction(function () use ($rows, $full, $fromDate, $now) {
            if ($full) {
                DB::table('fichaje_daily_stats')->truncate();
            } else {
                DB::table('fichaje_daily_stats')->where('day', '>=', $fromDate)->delete();
            }

            foreach ($rows->chunk(1000) as $chunk) {
                $insert = $chunk->map(fn ($r) => [
                    'day'        => $r->d,
                    'inout_type' => (int) $r->t,
                    'is_manual'  => (int) $r->is_manual,
                    'count'      => (int) $r->c,
                    'updated_at' => $now,
                ])->all();
                DB::table('fichaje_daily_stats')->insert($insert);
            }
        });

        $msg = sprintf('fichajes:aggregate OK — %d filas agregadas (%s).', $rows->count(), $full ? 'full' : "últimos {$days}d");
        $this->info($msg);
        Log::info($msg);

        return self::SUCCESS;
    }
}
