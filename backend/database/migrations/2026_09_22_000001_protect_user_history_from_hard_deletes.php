<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Todo lo que referencia a un usuario pasa a RESTRICT.
     *
     * Había dos claves en CASCADE que, ante un borrado duro, se llevaban por
     * delante las horas imputadas del agente y sus actividades de CRM. Las otras
     * seis estaban en SET NULL, que conserva la fila pero pierde de quién era:
     * igual de malo para trazabilidad e histórico.
     *
     * La aplicación nunca borra usuarios en duro (usa soft delete, y desde la
     * incorporación de `active` lo normal es desactivar), así que esto no cambia
     * ningún flujo: solo convierte en imposible el borrado accidental por
     * cascada o por una limpieza manual en base de datos. El camino que lo
     * hacía posible era `users.tenant_id -> tenants ON DELETE CASCADE`; ahora
     * ese borrado fallará ruidosamente en vez de vaciar el histórico en
     * silencio, que es justo lo que se busca.
     */
    private const FKS = [
        // [tabla, constraint, columna, regla original para el rollback]
        ['activities',          'activities_user_id_foreign',           'user_id',       'CASCADE'],
        ['audit_logs',          'audit_logs_user_id_foreign',           'user_id',       'SET NULL'],
        ['deals',               'deals_user_id_foreign',                'user_id',       'SET NULL'],
        ['login_logs',          'login_logs_user_id_foreign',           'user_id',       'SET NULL'],
        ['ticket_messages',     'ticket_messages_user_id_foreign',      'user_id',       'SET NULL'],
        ['ticket_time_entries', 'ticket_time_entries_agent_id_foreign', 'agent_id',      'CASCADE'],
        ['tickets',             'tickets_created_by_id_foreign',        'created_by_id', 'SET NULL'],
        ['tickets',             'tickets_user_id_foreign',              'user_id',       'SET NULL'],
    ];

    public function up(): void
    {
        foreach (self::FKS as [$table, $constraint, $column, $_]) {
            $this->swap($table, $constraint, $column, 'RESTRICT');
        }
    }

    public function down(): void
    {
        foreach (self::FKS as [$table, $constraint, $column, $original]) {
            $this->swap($table, $constraint, $column, $original);
        }
    }

    private function swap(string $table, string $constraint, string $column, string $rule): void
    {
        // Sin el DROP previo MySQL rechaza la redefinición. El índice que deja
        // atrás se reutiliza al volver a crear la clave.
        DB::statement("ALTER TABLE `{$table}` DROP FOREIGN KEY `{$constraint}`");
        DB::statement(
            "ALTER TABLE `{$table}` ADD CONSTRAINT `{$constraint}` "
            . "FOREIGN KEY (`{$column}`) REFERENCES `users` (`id`) ON DELETE {$rule}"
        );
    }
};
