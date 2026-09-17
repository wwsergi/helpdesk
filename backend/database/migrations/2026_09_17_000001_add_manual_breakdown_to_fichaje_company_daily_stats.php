<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // El panel de estadísticas permite filtrar por origen (solo manuales /
        // solo empleados) a la vez que por tipo de fichaje. Con un único
        // manual_count global no se puede servir esa combinación al filtrar por
        // empresa, así que se desglosa el contador de manuales por tipo.
        // manual_count se mantiene como suma precalculada de estos cuatro.
        Schema::table('fichaje_company_daily_stats', function (Blueprint $table) {
            $table->unsignedInteger('clock_in_manual')->default(0)->after('clock_in');
            $table->unsignedInteger('clock_out_manual')->default(0)->after('clock_out');
            $table->unsignedInteger('pause_manual')->default(0)->after('pause');
            $table->unsignedInteger('return_manual')->default(0)->after('return_count');
        });
    }

    public function down(): void
    {
        Schema::table('fichaje_company_daily_stats', function (Blueprint $table) {
            $table->dropColumn(['clock_in_manual', 'clock_out_manual', 'pause_manual', 'return_manual']);
        });
    }
};
