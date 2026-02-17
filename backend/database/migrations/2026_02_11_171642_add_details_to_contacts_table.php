<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            $table->string('cif')->nullable();
            $table->string('subscription_plan')->nullable();
            $table->integer('max_users')->nullable();
            $table->string('billing_mode')->nullable();
            $table->string('rate')->nullable();
            $table->date('registration_date')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            $table->dropColumn(['cif', 'subscription_plan', 'max_users', 'billing_mode', 'rate', 'registration_date']);
        });
    }
};
