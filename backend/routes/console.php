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
// Agregación de fichajes. --auto reconstruye el histórico completo desde 2013
// la primera vez y, una vez está, reagrega solo los últimos 12 meses cada noche,
// que es donde se mueven los datos (llegan fichajes manuales con fecha atrasada).
//
// timezone() se fija en la tarea y NO con APP_TIMEZONE: cambiar la zona global
// alteraría cómo Laravel interpreta y escribe todos los timestamps ya guardados
// en UTC. Así la hora significa hora española todo el año, sin que el cambio de
// horario la mueva, y sin tocar nada más.
//
// La ventana es 03:00-05:00 hora española: el histórico completo son ~5.000 días
// y unos 90 minutos; los días normales, 365, apenas 7.
// withoutOverlapping(180) libera el cerrojo a las 3 horas, para que una
// ejecución muerta no bloquee las noches siguientes.
Schedule::command('fichajes:aggregate --auto')
    ->dailyAt('03:00')
    ->timezone('Europe/Madrid')
    ->withoutOverlapping(180);

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');
