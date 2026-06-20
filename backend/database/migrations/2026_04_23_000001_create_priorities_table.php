<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('priorities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
            $table->string('name');        // value stored in tickets.priority
            $table->string('label');       // display text
            $table->string('color', 7)->default('#6b7280'); // hex color
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['tenant_id', 'name']);
        });

        // Seed default P1–P4 for all existing tenants
        $defaults = [
            ['name' => 'P1', 'label' => 'Crítica',  'color' => '#ef4444', 'sort_order' => 1],
            ['name' => 'P2', 'label' => 'Alta',     'color' => '#f97316', 'sort_order' => 2],
            ['name' => 'P3', 'label' => 'Media',    'color' => '#eab308', 'sort_order' => 3],
            ['name' => 'P4', 'label' => 'Baja',     'color' => '#3b82f6', 'sort_order' => 4],
        ];

        $now = now();
        foreach (DB::table('tenants')->pluck('id') as $tenantId) {
            foreach ($defaults as $priority) {
                DB::table('priorities')->insert(array_merge($priority, [
                    'tenant_id'  => $tenantId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]));
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('priorities');
    }
};
