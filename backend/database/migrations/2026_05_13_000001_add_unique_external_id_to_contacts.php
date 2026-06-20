<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        // Remove duplicates first (keep the row with the highest id per external_id+tenant_id)
        \DB::statement('
            DELETE c1 FROM contacts c1
            INNER JOIN contacts c2
            WHERE c1.external_id IS NOT NULL
              AND c1.external_id != \'\'
              AND c1.tenant_id = c2.tenant_id
              AND c1.external_id = c2.external_id
              AND c1.id < c2.id
        ');

        Schema::table('contacts', function (Blueprint $table) {
            $table->unique(['tenant_id', 'external_id'], 'contacts_tenant_external_unique');
        });
    }

    public function down()
    {
        Schema::table('contacts', function (Blueprint $table) {
            $table->dropUnique('contacts_tenant_external_unique');
        });
    }
};
