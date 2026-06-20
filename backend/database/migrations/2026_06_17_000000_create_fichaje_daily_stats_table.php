<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Conteos diarios pre-agregados de fichajes (login_logout de Intratime),
        // para que el dashboard no consulte los 73M de filas en cada vista.
        Schema::create('fichaje_daily_stats', function (Blueprint $table) {
            $table->id();
            $table->date('day');
            $table->unsignedTinyInteger('inout_type'); // 0=entrada,1=salida,2=pausa,3=regreso
            $table->boolean('is_manual');               // INOUT_SOURCE == 3
            $table->unsignedInteger('count')->default(0);
            $table->timestamp('updated_at')->nullable();

            $table->unique(['day', 'inout_type', 'is_manual'], 'fichaje_day_type_source_unique');
            $table->index('day');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fichaje_daily_stats');
    }
};
