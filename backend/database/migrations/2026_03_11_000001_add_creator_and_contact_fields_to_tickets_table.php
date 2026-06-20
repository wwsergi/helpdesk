<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->unsignedBigInteger('created_by_id')->nullable()->after('user_id');
            $table->string('contact_name')->nullable()->after('contact_id');
            $table->string('contact_phone', 50)->nullable()->after('contact_name');

            $table->foreign('created_by_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropForeign(['created_by_id']);
            $table->dropColumn(['created_by_id', 'contact_name', 'contact_phone']);
        });
    }
};
