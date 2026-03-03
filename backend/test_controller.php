<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$user = \App\Models\User::where('role', 'admin')->first() ?: \App\Models\User::first();

$request = \Illuminate\Http\Request::create('/api/ticket-types', 'POST', [
    'name' => 'Test From Request',
    'is_active' => true,
]);
$request->setUserResolver(function () use ($user) {
    return $user; });

$controller = new \App\Http\Controllers\Api\TicketTypeController();
try {
    $response = $controller->store($request);
    echo "TT Response: " . $response->getContent() . "\n";
} catch (\Throwable $e) {
    echo "TT Ex: " . $e->getMessage() . "\n";
    if (method_exists($e, 'errors')) {
        print_r($e->errors());
    }
}

$agentRequest = \Illuminate\Http\Request::create('/api/agents', 'POST', [
    'name' => 'Agent Controller Test',
    'email' => 'agent_ctrl@test.com',
    'password' => 'password123',
    'password_confirmation' => 'password123',
    'role' => 'agent',
]);
$agentRequest->setUserResolver(function () use ($user) {
    return $user; });

$agentController = new \App\Http\Controllers\Api\AgentController();
try {
    $resp = $agentController->store($agentRequest);
    echo "Agent Response: " . $resp->getContent() . "\n";
} catch (\Throwable $e) {
    echo "Agent Ex: " . $e->getMessage() . "\n";
    if (method_exists($e, 'errors')) {
        print_r($e->errors());
    }
}
