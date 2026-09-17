<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Conteos diarios de fichajes desglosados POR EMPRESA. Complementa a
        // fichaje_daily_stats (que solo tiene el total global) y es la fuente de
        // los paneles de Analytics: filtro por empresa, ranking por volumen y
        // calidad de fichaje.
        //
        // Los tipos van pivotados a columnas en vez de una fila por tipo: deja la
        // tabla en ~5.900 filas/día en lugar de ~17.200, y es justo la forma que
        // necesita la barra apilada del ranking.
        Schema::create('fichaje_company_daily_stats', function (Blueprint $table) {
            $table->id();
            $table->date('day');

            // = users.USER_COMPANY en Intratime = contacts.external_id en HelpDesk.
            // Se guarda el identificador de Intratime, no contacts.id, para que la
            // agregación no dependa de que el contacto ya esté sincronizado.
            $table->string('company_external_id', 191);

            $table->unsignedInteger('clock_in')->default(0);  // INOUT_TYPE 0
            $table->unsignedInteger('clock_out')->default(0); // INOUT_TYPE 1
            $table->unsignedInteger('pause')->default(0);     // INOUT_TYPE 2
            // 'return' es palabra reservada en MySQL: se llama return_count
            $table->unsignedInteger('return_count')->default(0); // INOUT_TYPE 3

            // Cuántos del total se introdujeron a mano (INOUT_SOURCE = 3).
            $table->unsignedInteger('manual_count')->default(0);
            // Empleados distintos que ficharon ese día.
            $table->unsignedInteger('active_users')->default(0);
            // Plantilla de la empresa (companies.COMPANY_CURRENT_USERS). Ojo: en el
            // backfill histórico queda el valor de hoy, porque Intratime no guarda
            // el histórico de este campo. A partir de ahora cada noche fija el suyo.
            $table->unsignedInteger('headcount')->nullable();

            $table->timestamp('updated_at')->nullable();

            $table->unique(['day', 'company_external_id'], 'fichaje_company_day_unique');
            $table->index(['company_external_id', 'day'], 'fichaje_company_idx');
            $table->index('day');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fichaje_company_daily_stats');
    }
};
