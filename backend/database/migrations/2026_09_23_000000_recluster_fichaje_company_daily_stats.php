<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Reordena la tabla por (day, company_external_id).
     *
     * Con 47 días de datos daba igual; con el histórico desde 2013 son 5,2
     * millones de filas y las consultas pasaron a tardar 28 y 71 segundos.
     * El plan de ejecución delataba el motivo: escaneo completo de la tabla.
     * Todas las consultas filtran por rango de fechas, pero la tabla estaba
     * agrupada físicamente por un `id` autonumérico que no usa nadie, así que
     * MySQL descartaba el índice de fecha y prefería leerlo todo.
     *
     * Poniendo (day, company_external_id) como clave primaria, InnoDB ordena la
     * tabla por fecha y un rango se lee de corrido y cubre todas las columnas.
     * De paso company_external_id baja de varchar(191) a varchar(16) — el valor
     * más largo mide 14 — lo que adelgaza todos los índices.
     *
     * Medido en producción: la consulta de 3 meses pasa de 16,7 s a 0,77 s, y la
     * tabla de 910 MB a 599 MB.
     *
     * ⚠️ La colación se fija explícitamente. Crear la tabla sin indicarla toma la
     * del servidor (utf8mb4_uca1400_ai_ci en este RDS), que no coincide con la de
     * `contacts` (utf8mb4_unicode_ci), y el join por external_id revienta con
     * "Illegal mix of collations".
     */
    public function up(): void
    {
        // En producción el cambio ya se aplicó a mano; si la tabla no tiene `id`
        // ya está reordenada y no hay nada que hacer.
        if (!Schema::hasColumn('fichaje_company_daily_stats', 'id')) {
            return;
        }

        DB::statement('DROP TABLE IF EXISTS fichaje_company_daily_stats_new');
        DB::statement("
            CREATE TABLE fichaje_company_daily_stats_new (
              day date NOT NULL,
              company_external_id varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL,
              clock_in int unsigned NOT NULL DEFAULT 0,
              clock_in_manual int unsigned NOT NULL DEFAULT 0,
              clock_out int unsigned NOT NULL DEFAULT 0,
              clock_out_manual int unsigned NOT NULL DEFAULT 0,
              pause int unsigned NOT NULL DEFAULT 0,
              pause_manual int unsigned NOT NULL DEFAULT 0,
              return_count int unsigned NOT NULL DEFAULT 0,
              return_manual int unsigned NOT NULL DEFAULT 0,
              manual_count int unsigned NOT NULL DEFAULT 0,
              active_users int unsigned NOT NULL DEFAULT 0,
              headcount int unsigned NULL,
              active_headcount int unsigned NULL,
              updated_at timestamp NULL,
              PRIMARY KEY (day, company_external_id),
              KEY fichaje_company_idx (company_external_id, day)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        DB::statement('
            INSERT INTO fichaje_company_daily_stats_new
              (day, company_external_id, clock_in, clock_in_manual, clock_out, clock_out_manual,
               pause, pause_manual, return_count, return_manual, manual_count, active_users,
               headcount, active_headcount, updated_at)
            SELECT day, company_external_id, clock_in, clock_in_manual, clock_out, clock_out_manual,
                   pause, pause_manual, return_count, return_manual, manual_count, active_users,
                   headcount, active_headcount, updated_at
              FROM fichaje_company_daily_stats
        ');

        DB::statement('DROP TABLE fichaje_company_daily_stats');
        DB::statement('RENAME TABLE fichaje_company_daily_stats_new TO fichaje_company_daily_stats');
    }

    public function down(): void
    {
        // Volver a la estructura con `id` solo tiene sentido para deshacer del
        // todo; los datos se conservan intactos en el proceso.
        if (Schema::hasColumn('fichaje_company_daily_stats', 'id')) {
            return;
        }

        DB::statement('DROP TABLE IF EXISTS fichaje_company_daily_stats_old');
        DB::statement("
            CREATE TABLE fichaje_company_daily_stats_old (
              id bigint unsigned NOT NULL AUTO_INCREMENT,
              day date NOT NULL,
              company_external_id varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
              clock_in int unsigned NOT NULL DEFAULT 0,
              clock_in_manual int unsigned NOT NULL DEFAULT 0,
              clock_out int unsigned NOT NULL DEFAULT 0,
              clock_out_manual int unsigned NOT NULL DEFAULT 0,
              pause int unsigned NOT NULL DEFAULT 0,
              pause_manual int unsigned NOT NULL DEFAULT 0,
              return_count int unsigned NOT NULL DEFAULT 0,
              return_manual int unsigned NOT NULL DEFAULT 0,
              manual_count int unsigned NOT NULL DEFAULT 0,
              active_users int unsigned NOT NULL DEFAULT 0,
              headcount int unsigned NULL,
              active_headcount int unsigned NULL,
              updated_at timestamp NULL,
              PRIMARY KEY (id),
              UNIQUE KEY fichaje_company_day_unique (day, company_external_id),
              KEY fichaje_company_idx (company_external_id, day),
              KEY fichaje_company_daily_stats_day_index (day)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
        DB::statement('
            INSERT INTO fichaje_company_daily_stats_old
              (day, company_external_id, clock_in, clock_in_manual, clock_out, clock_out_manual,
               pause, pause_manual, return_count, return_manual, manual_count, active_users,
               headcount, active_headcount, updated_at)
            SELECT day, company_external_id, clock_in, clock_in_manual, clock_out, clock_out_manual,
                   pause, pause_manual, return_count, return_manual, manual_count, active_users,
                   headcount, active_headcount, updated_at
              FROM fichaje_company_daily_stats
        ');
        DB::statement('DROP TABLE fichaje_company_daily_stats');
        DB::statement('RENAME TABLE fichaje_company_daily_stats_old TO fichaje_company_daily_stats');
    }
};
