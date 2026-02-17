#!/usr/bin/env php
<?php

/**
 * Safe Customer Deletion Script
 * 
 * This script helps delete customers that were created during a recent import.
 * It shows you what will be deleted before actually deleting anything.
 */

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Contact;
use Carbon\Carbon;

echo "\n";
echo "========================================\n";
echo "  Safe Customer Deletion Script\n";
echo "========================================\n\n";

// Ask for time range
echo "How far back should we look for customers to delete?\n";
echo "1. Last 1 hour\n";
echo "2. Last 6 hours\n";
echo "3. Last 24 hours\n";
echo "4. Today only\n";
echo "5. Custom date/time\n";
echo "\nEnter choice (1-5): ";

$handle = fopen("php://stdin", "r");
$choice = trim(fgets($handle));

$query = Contact::query();

switch ($choice) {
    case '1':
        $query->where('created_at', '>=', Carbon::now()->subHour());
        $timeDesc = "last 1 hour";
        break;
    case '2':
        $query->where('created_at', '>=', Carbon::now()->subHours(6));
        $timeDesc = "last 6 hours";
        break;
    case '3':
        $query->where('created_at', '>=', Carbon::now()->subDay());
        $timeDesc = "last 24 hours";
        break;
    case '4':
        $query->whereDate('created_at', Carbon::today());
        $timeDesc = "today";
        break;
    case '5':
        echo "Enter date/time (YYYY-MM-DD HH:MM:SS): ";
        $customDate = trim(fgets($handle));
        try {
            $date = Carbon::parse($customDate);
            $query->where('created_at', '>=', $date);
            $timeDesc = "since " . $date->format('Y-m-d H:i:s');
        } catch (Exception $e) {
            echo "\nInvalid date format. Exiting.\n\n";
            exit(1);
        }
        break;
    default:
        echo "\nInvalid choice. Exiting.\n\n";
        exit(1);
}

// Get the customers
$customers = $query->get();
$count = $customers->count();

echo "\n========================================\n";
echo "  Found {$count} customer(s) created {$timeDesc}\n";
echo "========================================\n\n";

if ($count === 0) {
    echo "No customers found. Nothing to delete.\n\n";
    exit(0);
}

// Show preview
echo "Preview of customers to be deleted:\n\n";
echo str_pad("ID", 8) . str_pad("Name", 40) . str_pad("Email", 40) . "Created At\n";
echo str_repeat("-", 120) . "\n";

foreach ($customers->take(20) as $customer) {
    echo str_pad($customer->id, 8)
        . str_pad(substr($customer->name, 0, 38), 40)
        . str_pad(substr($customer->email, 0, 38), 40)
        . $customer->created_at->format('Y-m-d H:i:s') . "\n";
}

if ($count > 20) {
    echo "... and " . ($count - 20) . " more\n";
}

echo "\n========================================\n";

// Confirm deletion
echo "\nDo you want to DELETE these {$count} customer(s)? This CANNOT be undone!\n";
echo "Type 'DELETE' (in capitals) to confirm: ";

$confirmation = trim(fgets($handle));

if ($confirmation !== 'DELETE') {
    echo "\nDeletion cancelled. No changes were made.\n\n";
    exit(0);
}

// Perform deletion
echo "\nDeleting customers...\n";

try {
    $deleted = $query->delete();
    echo "\n✓ Successfully deleted {$deleted} customer(s)\n\n";
} catch (Exception $e) {
    echo "\n✗ Error during deletion: " . $e->getMessage() . "\n\n";
    exit(1);
}

fclose($handle);
