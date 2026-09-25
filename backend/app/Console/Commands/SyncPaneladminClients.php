<?php

namespace App\Console\Commands;

use App\Models\Contact;
use App\Services\IntratimeService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class SyncPaneladminClients extends Command
{
    protected $signature = 'paneladmin:sync-clients {--tenant=1 : Tenant ID to sync contacts for}';
    protected $description = 'Sync companies from the Intratime admin API into HelpDesk CRM contacts';

    /**
     * Columns refreshed on every sync. Note that contract-management fields
     * (has_contract, contract_type, contract_hours_month, etc.) are NOT here on
     * purpose — those are managed manually in the CRM and must survive a sync.
     */
    private const UPSERT_UPDATE_COLUMNS = [
        'name', 'email', 'cif', 'phone', 'contact_person',
        'subscription_plan', 'max_users', 'active', 'billing_mode',
        'distributor_id', 'registration_date', 'is_lead',
        'contract_category', 'sync_source', 'updated_at',
    ];

    public function handle(IntratimeService $intratime): int
    {
        $tenantId = (int) $this->option('tenant');
        $perPage = 1000;
        $processed = 0;
        $skipped = 0;
        $page = 1;
        $lastPage = 1;

        $this->info("Starting Intratime API sync for tenant {$tenantId}...");

        do {
            $payload = $intratime->getCompaniesPage($page, $perPage);

            if ($payload === null) {
                $this->error("Failed fetching page {$page}. Aborting sync.");
                Log::error("Intratime sync aborted: could not fetch page {$page} (tenant {$tenantId}).");
                return 1;
            }

            $companies = $payload['data'] ?? [];
            $lastPage = (int) ($payload['meta']['last_page'] ?? $page);

            $toUpsert = [];
            foreach ($companies as $company) {
                $row = $this->mapCompany((array) $company, $tenantId);
                if ($row !== null) {
                    $toUpsert[] = $row;
                }
            }

            if (!empty($toUpsert)) {
                $skipped += $this->upsertBatch($toUpsert);
                $processed += count($toUpsert);
            }

            $this->info("  Page {$page}/{$lastPage} — processed {$processed}...");
            $page++;
        } while ($page <= $lastPage);

        $summary = "Done. Synced {$processed} companies for tenant {$tenantId}"
            . ($skipped ? ", {$skipped} skipped (email collisions)" : '') . '.';
        $this->info($summary);
        Log::info("Intratime sync completed: {$summary}");

        return 0;
    }

    /**
     * Map an API company object to a contacts upsert row.
     * Returns null when the record can't be keyed (no unique_id).
     */
    private function mapCompany(array $co, int $tenantId): ?array
    {
        $externalId = $co['unique_id'] ?? null;
        if (empty($externalId)) {
            return null;
        }

        $mode = (int) ($co['subscription_mode'] ?? 0);

        // Demo (mode 0) means no real contract yet → lead.
        $isLead = $mode === 0;

        // The API already returns the plan name (e.g. "Pro"); demos are forced to "Demo".
        $planName = $isLead ? 'Demo' : ($co['plan'] ?: null);

        // contract_category derived from distributor and subscription mode.
        $distributorId = $co['distributor_id'] ?? null;
        $contractCategory = null;
        if (!$isLead) {
            if ($distributorId == 1) {
                $contractCategory = in_array($mode, [1, 2]) ? 'conversia22' : 'conversia';
            } elseif ($distributorId == 2 || $distributorId === null) {
                $contractCategory = 'winworld';
            }
        }

        // A soft-deleted company in the source is treated as inactive.
        $active = (bool) ($co['active'] ?? false) && empty($co['deleted_at']);

        return [
            'tenant_id'         => $tenantId,
            'external_id'       => (string) $externalId,
            'sync_source'       => 'intratime',
            'name'              => $co['name'] ?? 'Unknown',
            'email'             => !empty($co['email']) ? $co['email'] : null,
            'cif'               => !empty($co['cif']) ? $co['cif'] : null,
            'phone'             => !empty($co['phone']) ? $co['phone'] : null,
            'contact_person'    => $co['billing']['name'] ?? null,
            'subscription_plan' => $planName,
            'max_users'         => !empty($co['max_users']) ? (int) $co['max_users'] : null,
            'active'            => $active,
            'billing_mode'      => !empty($co['cycle']) ? (string) $co['cycle'] : null,
            'distributor_id'    => $distributorId,
            'registration_date' => $this->sanitizeDate($co['created_at'] ?? null),
            'is_lead'           => $isLead,
            'contract_category' => $contractCategory,
            'created_at'        => now(),
            'updated_at'        => now(),
        ];
    }

    /**
     * Upsert a page of rows keyed by [tenant_id, external_id]. The contacts table
     * also has a unique [tenant_id, email]; if an incoming email collides with a
     * different existing contact the whole batch insert fails, so we fall back to
     * row-by-row and skip (log) just the offending rows.
     *
     * @return int number of rows skipped due to collisions
     */
    private function upsertBatch(array $rows): int
    {
        try {
            Contact::upsert($rows, ['tenant_id', 'external_id'], self::UPSERT_UPDATE_COLUMNS);
            return 0;
        } catch (\Throwable $e) {
            Log::warning('Intratime sync: batch upsert failed, retrying row-by-row: ' . $e->getMessage());

            $skipped = 0;
            foreach ($rows as $row) {
                try {
                    Contact::upsert([$row], ['tenant_id', 'external_id'], self::UPSERT_UPDATE_COLUMNS);
                } catch (\Throwable $rowError) {
                    $skipped++;
                    Log::warning("Intratime sync: skipped external_id={$row['external_id']} email={$row['email']} — {$rowError->getMessage()}");
                }
            }
            return $skipped;
        }
    }

    private function sanitizeDate($value): ?string
    {
        if (empty($value)) {
            return null;
        }
        try {
            $dt = new \DateTime($value);
            return $dt->format('Y') < 1971 ? null : $dt->format('Y-m-d');
        } catch (\Throwable $e) {
            return null;
        }
    }
}
