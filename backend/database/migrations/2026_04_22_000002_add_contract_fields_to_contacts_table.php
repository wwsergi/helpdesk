<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            $table->boolean('has_contract')->default(false)->after('active');
            $table->enum('contract_type', ['none', 'hours', 'unlimited'])->default('none')->after('has_contract');
            $table->unsignedInteger('contract_hours_month')->nullable()->after('contract_type');
            $table->date('contract_start_date')->nullable()->after('contract_hours_month');
            $table->date('contract_end_date')->nullable()->after('contract_start_date');
            $table->text('contract_notes')->nullable()->after('contract_end_date');
        });
    }

    public function down(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            $table->dropColumn([
                'has_contract',
                'contract_type',
                'contract_hours_month',
                'contract_start_date',
                'contract_end_date',
                'contract_notes',
            ]);
        });
    }
};
