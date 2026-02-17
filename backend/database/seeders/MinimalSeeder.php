<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class MinimalSeeder extends Seeder
{
    public function run(): void
    {
        // Create tenant
        $tenant = Tenant::create([
            'name' => 'Demo Company',
        ]);

        // Create users
        User::create([
            'tenant_id' => $tenant->id,
            'name' => 'Admin User',
            'email' => 'admin@example.com',
            'password' => Hash::make('password'),
            'role' => 'admin',
        ]);

        User::create([
            'tenant_id' => $tenant->id,
            'name' => 'Agent User',
            'email' => 'agent@example.com',
            'password' => Hash::make('password'),
            'role' => 'agent',
        ]);

        User::create([
            'tenant_id' => $tenant->id,
            'name' => 'Customer User',
            'email' => 'customer@example.com',
            'password' => Hash::make('password'),
            'role' => 'customer',
        ]);

        $this->command->info('✅ Minimal seed data created!');
        $this->command->info('📧 Credentials: admin/agent/customer@example.com / password');
    }
}
