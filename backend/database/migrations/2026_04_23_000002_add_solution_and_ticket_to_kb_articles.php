<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('knowledge_base_articles', function (Blueprint $table) {
            $table->text('solution')->nullable()->after('content');
            $table->foreignId('ticket_id')->nullable()->constrained('tickets')->onDelete('set null')->after('category_id');
        });
    }

    public function down(): void
    {
        Schema::table('knowledge_base_articles', function (Blueprint $table) {
            $table->dropForeign(['ticket_id']);
            $table->dropColumn(['solution', 'ticket_id']);
        });
    }
};
