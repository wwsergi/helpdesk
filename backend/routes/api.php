<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\TicketController;
use App\Http\Controllers\Api\AttachmentController;

// Public routes
Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'timestamp' => now()->toIso8601String(),
        'database' => DB::connection()->getPdo() ? 'connected' : 'disconnected'
    ]);
});

Route::get('/info', function () {
    return response()->json([
        'app_name' => config('app.name'),
        'version' => '1.0.0-alpha',
        'environment' => config('app.env'),
    ]);
});

// Auth routes
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/register', [AuthController::class, 'register']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    // Auth
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);

    // Attachments
    Route::post('/attachments/upload', [AttachmentController::class, 'upload']);
    Route::get('/attachments/{id}', [AttachmentController::class, 'download']);
    Route::delete('/attachments/{id}', [AttachmentController::class, 'destroy']);

    // Tickets
    Route::get('/tickets', [TicketController::class, 'index']);
    Route::post('/tickets', [TicketController::class, 'store']);
    Route::get('/tickets/{id}', [TicketController::class, 'show']);
    Route::patch('/tickets/{id}', [TicketController::class, 'update']);
    Route::post('/tickets/{id}/messages', [TicketController::class, 'addMessage']);
    Route::post('/tickets/{id}/assign', [TicketController::class, 'assign']);
    Route::delete('/tickets/{id}', [TicketController::class, 'destroy']);

    // Contacts
    Route::get('/contacts', [\App\Http\Controllers\Api\ContactController::class, 'index']);
    Route::post('/contacts', [\App\Http\Controllers\Api\ContactController::class, 'store']);
    Route::post('/contacts/import', [\App\Http\Controllers\Api\ContactController::class, 'import']);
    Route::get('/contacts/{id}', [\App\Http\Controllers\Api\ContactController::class, 'show']);
    Route::patch('/contacts/{id}', [\App\Http\Controllers\Api\ContactController::class, 'update']);
    Route::delete('/contacts/{id}', [\App\Http\Controllers\Api\ContactController::class, 'destroy']);

    // Agents (Admin only)
    Route::middleware('admin')->group(function () {
        Route::get('/agents', [\App\Http\Controllers\Api\AgentController::class, 'index']);
        Route::post('/agents', [\App\Http\Controllers\Api\AgentController::class, 'store']);
        Route::patch('/agents/{id}', [\App\Http\Controllers\Api\AgentController::class, 'update']);
        Route::delete('/agents/{id}', [\App\Http\Controllers\Api\AgentController::class, 'destroy']);
        Route::post('/agents', [\App\Http\Controllers\Api\AgentController::class, 'store']);
        Route::get('/agents/{id}', [\App\Http\Controllers\Api\AgentController::class, 'show']);
        Route::patch('/agents/{id}', [\App\Http\Controllers\Api\AgentController::class, 'update']);
        Route::delete('/agents/{id}', [\App\Http\Controllers\Api\AgentController::class, 'destroy']);
    });

    // Categories
    Route::get('/categories', [\App\Http\Controllers\Api\CategoryController::class, 'index']);
    Route::post('/categories', [\App\Http\Controllers\Api\CategoryController::class, 'store']);
    Route::patch('/categories/{id}', [\App\Http\Controllers\Api\CategoryController::class, 'update']);
    Route::delete('/categories/{id}', [\App\Http\Controllers\Api\CategoryController::class, 'destroy']);

    // Knowledge Base
    Route::get('/kb', [\App\Http\Controllers\Api\KnowledgeBaseController::class, 'index']);
    Route::post('/kb', [\App\Http\Controllers\Api\KnowledgeBaseController::class, 'store']);
    Route::get('/kb/{id}', [\App\Http\Controllers\Api\KnowledgeBaseController::class, 'show']);
    Route::patch('/kb/{id}', [\App\Http\Controllers\Api\KnowledgeBaseController::class, 'update']);
    Route::delete('/kb/{id}', [\App\Http\Controllers\Api\KnowledgeBaseController::class, 'destroy']);

    // Reports (Admin only)
    Route::middleware('admin')->prefix('reports')->group(function () {
        Route::get('/stats', [\App\Http\Controllers\ReportsController::class, 'overallStats']);
        Route::get('/agents', [\App\Http\Controllers\ReportsController::class, 'agentStats']);
        Route::get('/customers', [\App\Http\Controllers\ReportsController::class, 'customerStats']);
    });

    // Dashboard
    Route::get('/dashboard/stats', [\App\Http\Controllers\Api\DashboardController::class, 'stats']);
});
