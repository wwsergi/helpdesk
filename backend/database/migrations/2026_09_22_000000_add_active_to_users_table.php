<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Desactivar un agente NO es borrarlo. El borrado (soft delete) esconde
        // al usuario también de las relaciones, así que un ticket suyo pasaría a
        // verse "Sin asignar" perdiendo la trazabilidad de quién lo llevaba.
        // Con una bandera aparte el agente deja de entrar y de aparecer en los
        // desplegables, pero sus tickets, mensajes y horas siguen atribuidos.
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('active')->default(true)->after('level');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('active');
        });
    }
};
