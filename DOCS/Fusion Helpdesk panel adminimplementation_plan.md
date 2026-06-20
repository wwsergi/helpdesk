# Plan de Integración: HelpDesk CRM & Paneladminv4

Este plan detalla la estrategia para fusionar las funcionalidades de Paneladminv4 dentro del ecosistema de HelpDesk, potenciando específicamente el módulo CRM. El objetivo es centralizar la gestión de clientes (activos, leads, contratos) y ofrecer un panel de control estadístico exclusivo para administradores, aprovechando las sinergias entre ambos proyectos.

## User Review Required

> [!IMPORTANT]
> **Estrategia de Datos (Sincronización vs. Consulta Directa):**
> La propuesta principal es **sincronizar** periódicamente las empresas/clientes desde Paneladminv4 hacia la tabla `contacts` de HelpDesk (aprovechando campos como `contract_type` y `sync_source` ya existentes). Esto permite enlazar a los clientes con Tickets, Deals y Actividades en HelpDesk. 
> *¿Estás de acuerdo con este enfoque de sincronización, o prefieres que HelpDesk consulte la API de Paneladminv4 en tiempo real sin guardar los clientes en su propia base de datos?*

> [!NOTE]
> **Definición de "Lead":**
> Actualmente en Paneladminv4, ¿un "Lead" se distingue mediante un tipo de contrato específico, un estado de facturación, o un campo propio? Necesito confirmar cómo lo identificamos exactamente en la base de datos para mapearlo correctamente.

## Proposed Changes

---

### 1. Sincronización y Listado de Clientes (Backend HelpDesk)

Para visualizar los clientes de Paneladminv4, alimentaremos el modelo `Contact` de HelpDesk.

#### [NEW] `app/Console/Commands/SyncPaneladminClients.php`
- Crearemos un comando Artisan programado (Cron/Scheduler) que se conecte a la base de datos o API de Paneladminv4.
- El script hará un *upsert* (crear o actualizar) en la tabla `contacts` de HelpDesk.
- Mapeará los estados: si el cliente está activo, qué tipo de contrato tiene (`winworld`, `conversia`, `conversia22`) y si es un lead. Guardará el ID original en el campo `external_id` y marcará el `sync_source` como "paneladminv4".

#### [MODIFY] `app/Http/Controllers/ContactController.php`
- Actualizaremos el método `index` para aceptar nuevos parámetros de filtro en la *query string* (ej: `?contract=winworld`, `?is_lead=true`).
- Aplicaremos estos filtros en la consulta a la base de datos de Eloquent y los devolveremos paginados al frontend.

---

### 2. Filtros Avanzados en Directorio CRM (Frontend HelpDesk)

Adaptaremos la vista existente del directorio para incluir los nuevos filtros.

#### [MODIFY] `frontend/src/pages/crm/CRMDirectory.jsx`
- Añadiremos una barra de filtros junto al buscador.
- **Filtros a implementar:**
  - **Estado:** Activos / Inactivos.
  - **Tipo de Contrato:** Winworld, Conversia, Conversia22, Lead.
- Al seleccionar estos filtros, el hook `useQuery` de React Query se actualizará enviando los parámetros correspondientes al backend, recargando el listado en tiempo real.

---

### 3. Panel Estadístico para Administradores (Frontend & Backend)

Traeremos el "Dashboard" de Paneladminv4 al CRM de HelpDesk, restringido por nivel de acceso.

#### [NEW] `frontend/src/pages/crm/Statistics.jsx`
- Migraremos/Adaptaremos los componentes de la vista `StatisticsPage.tsx` de Paneladminv4.
- Mostrará gráficos y contadores totales (altas, bajas, facturación/tipos de empresa, etc.).
- Utilizará Tailwind CSS y los componentes estándar de HelpDesk (prescindiendo de HeroUI para mantener consistencia gráfica, o adaptándolo si se prefiere).

#### [MODIFY] `frontend/src/App.jsx` (o archivo de rutas)
- Añadiremos la ruta protegida `/crm/statistics`.

#### [MODIFY] `frontend/src/components/agent/AgentLayout.jsx` (o Sidebar del CRM)
- Añadiremos el enlace "Estadísticas" en el menú lateral de la sección CRM.
- **Restricción de Acceso:** Este botón solo se renderizará si el usuario autenticado tiene `user.role === 'admin'` o `user.level === 'admin'`. Si un agente normal intenta acceder a la URL directamente, se le redirigirá.

#### [NEW] `app/Http/Controllers/Api/StatisticsController.php` (Backend HelpDesk)
- Crearemos nuevos endpoints para proveer los datos estadísticos agregados al frontend de HelpDesk.
- Este controlador consultará la tabla local de `contacts` sincronizada, o bien hará peticiones a la API de Paneladminv4 (`intratime-admin-api-v3`) para consolidar la información.

## Verification Plan

### Automated Tests
- Ejecutar el comando de sincronización de prueba en local para verificar que los contactos se insertan correctamente con sus campos de contrato y estado activo.
- Añadir un test unitario en HelpDesk (`tests/Feature/ContactFilterTest.php`) asegurando que los endpoints `/api/contacts?contract=winworld` devuelven únicamente esos registros.

### Manual Verification
- Iniciar sesión como `admin` en HelpDesk: verificar que aparece la pestaña "Estadísticas" en el CRM y que carga gráficos similares a Paneladminv4.
- Iniciar sesión como usuario normal: verificar que no tiene acceso a "Estadísticas" ni le aparece en el menú.
- Ir al "Directorio de Clientes" en el CRM, hacer clic en los filtros "Winworld", "Conversia22" y "Lead", y comprobar visualmente que la tabla de resultados se actualiza de forma instantánea y correcta.
