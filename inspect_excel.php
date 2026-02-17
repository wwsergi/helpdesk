<?php
require 'vendor/autoload.php';
use PhpOffice\PhpSpreadsheet\IOFactory;

$filename = '/var/www/html/customers.xlsx';
if (!file_exists($filename)) {
    // Try copying it if it doesn't exist in the container
    echo "File not found: $filename\n";
    exit(1);
}

try {
    $spreadsheet = IOFactory::load($filename);
    $sheet = $spreadsheet->getActiveSheet();
    $rows = $sheet->toArray();
    $header = $rows[0];
    echo "Header count: " . count($header) . "\n";
    echo "Headers: " . implode(' | ', $header) . "\n";
    echo "First data row count: " . count($rows[1]) . "\n";
    echo "First data row: " . implode(' | ', $rows[1]) . "\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
