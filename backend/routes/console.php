<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

// Fetch support emails every 5 minutes
// Disabled for now (not needed yet) — re-enable when email ingestion is wanted.
// Schedule::command('tickets:fetch-emails')->everyFiveMinutes();

// Sync Intratime companies into CRM contacts nightly
Schedule::command('paneladmin:sync-clients')->daily()->withoutOverlapping();

// Pre-agrega los fichajes (login_logout) a la tabla local cada noche off-peak,
// para que el dashboard no consulte la BD de producción de Intratime en cada vista.
Schedule::command('fichajes:aggregate')->dailyAt('03:30')->withoutOverlapping();

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');
