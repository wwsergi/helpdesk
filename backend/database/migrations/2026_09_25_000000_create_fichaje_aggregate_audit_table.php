<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Mide CUÁNTO ATRÁS cambian de verdad los fichajes ya agregados.
        //
        // Hace falta porque no hay forma de saberlo con lo que había: el
        // agregador borra y reinserta cada día entero, así que reescribe
        // updated_at en los 365 días aunque los valores sean idénticos. Ese
        // campo dice "esto se reprocesó", no "esto cambió".
        //
        // 🔑 ES UNA MEDIDA ACUMULATIVA, NO UNA FOTO. El nocturno reagrega los
        // últimos 365 días CADA noche, así que una sola pasada solo compara
        // contra lo que Intratime dijo la noche anterior: mide unas horas, no
        // el horizonte. La respuesta sale de dejar `--audit` puesto varias
        // noches y mirar cuántas veces se movió cada día. Por eso las columnas
        // que mandan son times_checked / times_changed / last_changed_at, que
        // se acumulan, y no el detalle de la última pasada.
        Schema::create('fichaje_aggregate_audit', function (Blueprint $table) {
            $table->date('day')->primary();

            // El acumulado: de cuántas pasadas ha salido distinto este día.
            // times_changed = 0 tras muchas comprobaciones es justo la prueba
            // de que ese día ya está congelado y puede salir de la ventana.
            $table->unsignedInteger('times_checked')->default(0);
            $table->unsignedInteger('times_changed')->default(0);
            $table->timestamp('first_checked_at')->nullable();
            $table->timestamp('last_checked_at')->nullable();
            // La fecha que de verdad contesta la pregunta: la última vez que
            // este día cambió. Nula = no ha cambiado desde que se vigila.
            $table->timestamp('last_changed_at')->nullable();

            // Detalle de la ÚLTIMA pasada, para dimensionar el cambio cuando lo
            // hay. Se sobreescribe a propósito: el histórico que importa es el
            // de los contadores de arriba.
            $table->boolean('changed_last')->default(false);
            $table->unsignedInteger('companies_before')->default(0);
            $table->unsignedInteger('companies_after')->default(0);
            // Separar altas de cambios importa: una empresa que aparece en un
            // día viejo es un fichaje retroactivo; una cifra distinta en una que
            // ya estaba es una corrección. No se corrigen igual.
            $table->unsignedInteger('companies_added')->default(0);
            $table->unsignedInteger('companies_removed')->default(0);
            $table->unsignedInteger('companies_changed')->default(0);
            $table->unsignedBigInteger('total_before')->default(0);
            $table->unsignedBigInteger('total_after')->default(0);

            $table->index('times_changed');
            $table->index('last_changed_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fichaje_aggregate_audit');
    }
};
