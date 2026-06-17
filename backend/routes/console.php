<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

// Fetch support emails every 5 minutes
// Disabled for now (not needed yet) — re-enable when email ingestion is wanted.
// Schedule::command('tickets:fetch-emails')->everyFiveMinutes();

// Sync Intratime companies into CRM contacts nightly
Schedule::command('paneladmin:sync-clients')->daily()->withoutOverlapping();

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');
