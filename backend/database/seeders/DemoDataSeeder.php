<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Contact;
use App\Models\Queue;
use App\Models\Category;
use App\Models\Ticket;
use App\Models\TicketMessage;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        // Create tenants
        $tenant1 = Tenant::create([
            'name' => 'Acme Corporation',
        ]);

        // Create users (agents & customers)
        $adminUser = User::create([
            'tenant_id' => $tenant1->id,
            'name' => 'Admin User',
            'email' => 'admin@example.com',
            'password' => Hash::make('password'),
            'role' => 'admin',
        ]);

        $agentUser = User::create([
            'tenant_id' => $tenant1->id,
            'name' => 'Jane Agent',
            'email' => 'agent@example.com',
            'password' => Hash::make('password'),
            'role' => 'agent',
        ]);

        $customerUser = User::create([
            'tenant_id' => $tenant1->id,
            'name' => 'John Customer',
            'email' => 'customer@example.com',
            'password' => Hash::make('password'),
            'role' => 'customer',
        ]);

        // Create contacts
        $contact1 = Contact::create([
            'tenant_id' => $tenant1->id,
            'name' => 'John Doe',
            'email' => 'john.doe@example.com',
            'phone' => '+34 123 456 789',
        ]);

        $contact2 = Contact::create([
            'tenant_id' => $tenant1->id,
            'name' => 'Jane Smith',
            'email' => 'jane.smith@example.com',
            'phone' => '+34 987 654 321',
        ]);

        // Create queues
        $supportQueue = Queue::create([
            'tenant_id' => $tenant1->id,
            'name' => 'Technical Support',
            'slug' => 'technical-support',
            'description' => 'General technical support',
        ]);

        $billingQueue = Queue::create([
            'tenant_id' => $tenant1->id,
            'name' => 'Billing',
            'slug' => 'billing',
            'description' => 'Billing inquiries',
        ]);

        // Create categories
        $techCategory = Category::create([
            'tenant_id' => $tenant1->id,
            'name' => 'Technical',
        ]);

        $billingCategory = Category::create([
            'tenant_id' => $tenant1->id,
            'name' => 'Billing',
        ]);

        // Create sample tickets
        $ticket1 = Ticket::create([
            'uuid' => 'TKT-' . strtoupper(Str::random(6)),
            'tenant_id' => $tenant1->id,
            'contact_id' => $contact1->id,
            'user_id' => $agentUser->id,
            'queue_id' => $supportQueue->id,
            'category_id' => $techCategory->id,
            'subject' => 'Cannot login to dashboard',
            'description' => 'Getting invalid credentials error',
            'status' => 'OPEN',
            'priority' => 'P1',
            'type' => 'BUG',
            'channel' => 'email',
            'sla_first_response_due_at' => now()->addHour(),
            'sla_resolution_due_at' => now()->addHours(8),
            'created_at' => now()->subHours(2),
        ]);

        TicketMessage::create([
            'ticket_id' => $ticket1->id,
            'author_type' => 'contact',
            'author_id' => $contact1->id,
            'is_internal' => false,
            'body' => 'Hi, I cannot log in. Getting "Invalid credentials" error.',
            'channel_source' => 'email',
            'created_at' => now()->subHours(2),
        ]);

        TicketMessage::create([
            'ticket_id' => $ticket1->id,
            'author_type' => 'user',
            'author_id' => $agentUser->id,
            'is_internal' => false,
            'body' => 'Hi John, please try resetting your password.',
            'channel_source' => 'web',
            'created_at' => now()->subMinutes(45),
        ]);

        $ticket2 = Ticket::create([
            'uuid' => 'TKT-' . strtoupper(Str::random(6)),
            'tenant_id' => $tenant1->id,
            'contact_id' => $contact2->id,
            'user_id' => $agentUser->id,
            'queue_id' => $supportQueue->id,
            'subject' => 'Feature request: Dark mode',
            'description' => 'Would like dark mode option',
            'status' => 'IN_PROGRESS',
            'priority' => 'P3',
            'type' => 'FEATURE_REQUEST',
            'channel' => 'web',
            'first_response_at' => now()->subHours(22),
            'created_at' => now()->subDay(),
        ]);

        TicketMessage::create([
            'ticket_id' => $ticket2->id,
            'author_type' => 'contact',
            'author_id' => $contact2->id,
            'is_internal' => false,
            'body' => 'Would be great to have a dark mode option!',
            'channel_source' => 'web',
            'created_at' => now()->subDay(),
        ]);

        $ticket3 = Ticket::create([
            'uuid' => 'TKT-' . strtoupper(Str::random(6)),
            'tenant_id' => $tenant1->id,
            'contact_id' => $contact1->id,
            'queue_id' => $billingQueue->id,
            'category_id' => $billingCategory->id,
            'subject' => 'Question about invoice',
            'description' => 'Question about latest invoice charges',
            'status' => 'PENDING_CUSTOMER',
            'priority' => 'P2',
            'type' => 'BILLING',
            'channel' => 'email',
            'first_response_at' => now()->subHours(4),
            'created_at' => now()->subHours(5),
        ]);

        TicketMessage::create([
            'ticket_id' => $ticket3->id,
            'author_type' => 'contact',
            'author_id' => $contact1->id,
            'is_internal' => false,
            'body' => 'I have a question about my latest invoice charges.',
            'channel_source' => 'email',
            'created_at' => now()->subHours(5),
        ]);

        $ticket4 = Ticket::create([
            'uuid' => 'TKT-' . strtoupper(Str::random(6)),
            'tenant_id' => $tenant1->id,
            'contact_id' => $contact2->id,
            'subject' => 'Performance issues on mobile',
            'description' => 'App is very slow on mobile',
            'status' => 'NEW',
            'priority' => 'P1',
            'type' => 'BUG',
            'channel' => 'chat',
            'created_at' => now()->subMinutes(30),
        ]);

        TicketMessage::create([
            'ticket_id' => $ticket4->id,
            'author_type' => 'contact',
            'author_id' => $contact2->id,
            'is_internal' => false,
            'body' => 'The mobile app is very slow, takes 30+ seconds to load.',
            'channel_source' => 'chat',
            'created_at' => now()->subMinutes(30),
        ]);

        $this->command->info('✅ Demo data seeded successfully!');
        $this->command->info('');
        $this->command->info('📧 Login credentials:');
        $this->command->info('  Admin: admin@example.com / password');
        $this->command->info('  Agent: agent@example.com / password');
        $this->command->info('  Customer: customer@example.com / password');
    }
}
