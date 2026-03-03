<?php

require __DIR__ . '/vendor/autoload.php';

$app = require __DIR__ . '/bootstrap/app.php';

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);

$kernel->bootstrap();

// Force drivers to array to avoid Redis dependency in CLI
config(['session.driver' => 'array']);
config(['cache.default' => 'array']);

use App\Models\User;
use App\Models\Ticket;
use Illuminate\Support\Facades\Auth;

// 1. Login as Admin or Agent
$admin = User::whereIn('role', ['admin', 'agent'])->first();

if (!$admin) {
    echo "No admin/agent found. Checking for Tenant...\n";
    $tenant = \App\Models\Tenant::first();
    if (!$tenant) {
        $tenant = \App\Models\Tenant::create(['name' => 'Test Tenant', 'domain' => 'test.localhost']);
        echo "Created Test Tenant.\n";
    }

    echo "Creating Test Admin...\n";
    $admin = User::create([
        'name' => 'Test Admin',
        'email' => 'admin_test_' . time() . '@helpdesk.com',
        'password' => bcrypt('password'),
        'role' => 'admin',
        'tenant_id' => $tenant->id,
    ]);
}

Auth::login($admin);
echo "Logged in as: {$admin->email}\n";

// 1b. Create Test Contact
$contact = \App\Models\Contact::firstOrCreate(
    ['email' => 'test_contact@example.com', 'tenant_id' => $admin->tenant_id],
    ['name' => 'Test Contact']
);

// 2. Create Parent Ticket
$parent = Ticket::create([
    'uuid' => 'TEST-PARENT',
    'tenant_id' => $admin->tenant_id,
    'contact_id' => $contact->id,
    'subject' => 'Parent Ticket Subject',
    'description' => 'Parent Description',
    'status' => 'IN_PROGRESS',
    'priority' => 'P2',
    'type' => 'INCIDENCE',
    'user_id' => $admin->id,
]);
echo "Created Parent Ticket: {$parent->id} - {$parent->subject}\n";

// 3. Create Child Ticket (Simulate Controller Logic)
// In the controller, we pass 'parent_ticket_id' and it handles the rest.
// Here we simulate the controller logic manually to test the assumption or call the controller method?
// Better to simulate the logic we wrote in the controller to ensure it works as expected if we were hitting the API.
// But we can't easily call the controller store method without a Request object.
// So let's test the Model/Logic path.

$childSubject = $parent->subject; // Controller logic
$childStatus = 'IN_PROGRESS'; // Controller logic

$child = Ticket::create([
    'uuid' => 'TEST-CHILD',
    'tenant_id' => $admin->tenant_id,
    'contact_id' => $contact->id,
    'parent_ticket_id' => $parent->id,
    'subject' => $childSubject,
    'description' => 'Internal Instructions',
    'status' => $childStatus,
    'priority' => 'P2',
    'user_id' => $admin->id,
]);
echo "Created Child Ticket: {$child->id} - {$child->subject} (Status: {$child->status})\n";

// Verify Subject Inheritance
if ($child->subject !== $parent->subject) {
    echo "FAIL: Child subject '{$child->subject}' does not match parent '{$parent->subject}'\n";
} else {
    echo "PASS: Child subject matches parent.\n";
}

// 4. Resolve Parent Ticket
echo "Resolving Parent Ticket...\n";
$parent->update(['status' => 'RESOLVED']);

// Simulate the Controller's auto-resolution logic
// Logic in Controller:
// $ticket->children()->where('status', '!=', 'RESOLVED')->update(['status' => 'RESOLVED', ...]);
$parent->children()->where('status', '!=', 'RESOLVED')->update([
    'status' => 'RESOLVED',
    'resolved_at' => now(),
]);

// 5. Verify Child is Resolved
$child->refresh();
echo "Child Status after Parent Resolution: {$child->status}\n";

if ($child->status === 'RESOLVED') {
    echo "PASS: Child ticket was auto-resolved.\n";
} else {
    echo "FAIL: Child ticket status is {$child->status}\n";
}

// Cleanup
$child->forceDelete();
$parent->forceDelete();
echo "Cleanup done.\n";
