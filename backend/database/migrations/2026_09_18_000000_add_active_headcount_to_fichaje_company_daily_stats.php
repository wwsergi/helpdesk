<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // headcount viene de companies.COMPANY_CURRENT_USERS, que resultó poco
        // fiable: de las 9.554 empresas activas está nulo o a 0 en 4.217 (44%) y
        // se queda corto frente a los usuarios reales en otras 3.556. Contar los
        // usuarios activos en la tabla `users` solo falla en un 18%, así que es
        // el denominador bueno para el % de uso.
        Schema::table('fichaje_company_daily_stats', function (Blueprint $table) {
            $table->unsignedInteger('active_headcount')->nullable()->after('headcount');
        });
    }

    public function down(): void
    {
        Schema::table('fichaje_company_daily_stats', function (Blueprint $table) {
            $table->dropColumn('active_headcount');
        });
    }
};
