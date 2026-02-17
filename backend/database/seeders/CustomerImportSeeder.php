<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use App\Models\Contact;
use App\Models\Tenant;

class CustomerImportSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $jsonPath = database_path('seeders/customers.json');

        if (!File::exists($jsonPath)) {
            $this->command->error("File not found: $jsonPath");
            return;
        }

        $json = File::get($jsonPath);
        $customers = json_decode($json, true);

        if (!$customers) {
            $this->command->error("Invalid JSON in $jsonPath");
            return;
        }

        // Get the first tenant (assuming single tenant context for this import)
        $tenant = Tenant::first();

        if (!$tenant) {
            $this->command->error("No tenant found. Please create a tenant first.");
            return;
        }

        $this->command->info("Importing " . count($customers) . " customers for tenant: " . $tenant->name);

        foreach ($customers as $customerData) {
            Contact::updateOrCreate(
                [
                    'tenant_id' => $tenant->id,
                    'email' => $customerData['email'],
                ],
                [
                    'name' => $customerData['name'],
                    'external_id' => $customerData['external_id'],
                    'cif' => $customerData['cif'],
                    'subscription_plan' => $customerData['subscription_plan'],
                    'max_users' => $customerData['max_users'],
                    'billing_mode' => $customerData['billing_mode'],
                    'rate' => $customerData['rate'],
                    'registration_date' => $customerData['registration_date'],
                ]
            );
        }

        $this->command->info("Customers imported successfully.");
    }
}
