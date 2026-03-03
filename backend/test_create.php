<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

try {
    App\Models\User::create([
        'tenant_id' => 1,
        'name' => 'test_agent',
        'email' => 'test_agent@example.com',
        'password' => bcrypt('password'),
        'role' => 'agent'
    ]);
    echo "USER_SUCCESS\n";
} catch (\Throwable $e) {
    echo "USER_ERROR: " . $e->getMessage() . "\n";
}

try {
    App\Models\TicketType::create([
        'tenant_id' => 1,
        'name' => 'test_type'
    ]);
    echo "TT_SUCCESS\n";
} catch (\Throwable $e) {
    echo "TT_ERROR: " . $e->getMessage() . "\n";
}
