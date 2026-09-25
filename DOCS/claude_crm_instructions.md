# Instrucciones para Claude Code: Extensión CRM para HelpDesk

¡Hola Claude! Tienes la tarea de extender esta aplicación actual de HelpDesk (Laravel backend + React Vite frontend) para incluir funcionalidades de CRM. A continuación tienes todo el contexto y las instrucciones paso a paso para ejecutar el plan de implementación.

## Contexto del Proyecto
1. **Frontend**: React con Vite. Usa React Router y un sistema de componentes actual.
2. **Backend**: Laravel 11. 
3. **Modelos clave existentes**:
   - `User`: Tiene un campo `role` (actualmente 'admin', 'agent', etc.).
   - `Contact`: Funciona como la "Empresa" o "Cuenta" del cliente.
   - `Ticket`: Pertenece a un `Contact` (`contact_id`).
   - Todos los usuarios tienen acceso a todos los `Contact` (no hay aislamiento de datos de clientes por agente).

> **Nota importante:** Antes de detener el desarrollo, ya he ejecutado los comandos `php artisan make:model Deal -a` y `php artisan make:model Activity -a`. Así que los archivos base de estos modelos, migraciones, controladores y factories ya están creados en el código. Tu tarea es rellenarlos e implementarlos.

---

## Tareas a Ejecutar

### Fase 1: Backend - Base de Datos y Modelos

1. **Migración de `deals`**:
   - Edita la migración recién creada para `deals`.
   - Añade las columnas: `tenant_id` (relacionado con tenants), `contact_id` (foreign key a contacts), `user_id` (agente/comercial asignado, nullable), `title` (string), `amount` (decimal), `stage` (enum o string: 'lead', 'contacted', 'proposal', 'negotiation', 'won', 'lost'), `expected_close_date` (date, nullable), softDeletes, timestamps.

2. **Migración de `activities`**:
   - Edita la migración recién creada para `activities`.
   - Añade las columnas: `tenant_id`, `contact_id` (nullable), `deal_id` (nullable), `user_id` (creador/asignado), `type` (enum o string: 'call', 'email', 'meeting', 'note'), `description` (text), `due_date` (datetime, nullable), `is_completed` (boolean, default false), timestamps.

3. **Modelos (`Deal.php` y `Activity.php`)**:
   - Define los `$fillable` correspondientes.
   - Crea las relaciones `belongsTo`: `tenant()`, `contact()`, `user()`.
   - En `Activity`, añade relación opcional a `deal()`.
   - **Edita `Contact.php`**: Añade `$this->hasMany(Deal::class)` y `$this->hasMany(Activity::class)`.

4. **Roles en `User`**:
   - Asegúrate de que el sistema permita el rol `'comercial'`. Si hay enums o validaciones en middlewares o FormRequests, actualízalos para permitir este rol.

---

### Fase 2: Backend - API y Controladores

1. **Rutas (en `routes/api.php`)**:
   - Crea endpoints de recurso api para `deals` y `activities` protegidas por el middleware de autenticación (Sanctum).
   - Crea un endpoint personalizado: `GET /api/crm/pipeline` que devuelva los `deals` agrupados por el campo `stage` para facilitar el renderizado del Kanban en frontend.

2. **Controladores (`DealController`, `ActivityController`)**:
   - Implementa los métodos `index`, `store`, `show`, `update`, `destroy`.
   - Permite filtrar `deals` por `contact_id` para cuando se visualice la ficha de un cliente específico.
   - Permite la actualización rápida del `stage` de un Deal (necesario para el drag-and-drop del Kanban).

---

### Fase 3: Frontend - Navegación y UI

1. **Menú de Navegación**:
   - Añade una sección "CRM" al sidebar/menú principal para los usuarios con roles `admin` y `comercial`.
   - Submenús sugeridos: "Pipeline" (ruteará a `/crm/pipeline`) y "Directorio" (que puede reutilizar o apuntar a la actual vista de contactos `/contacts` pero con la ficha ampliada).

2. **Vista Kanban (`PipelineBoard.jsx`)**:
   - Crea una nueva ruta y componente en el frontend (ej. `/src/pages/crm/PipelineBoard.jsx`).
   - Obtén los datos del endpoint `/api/crm/pipeline`.
   - Implementa columnas (Lead, Contacted, Proposal, Negotiation, Won, Lost) y muestra "tarjetas" por cada Deal (mostrando `title`, `amount`, `contact.name`).
   - *Opcional pero recomendado:* Implementa Drag and Drop (usando `dnd-kit` o `react-beautiful-dnd` si están instalados, o HTML5 nativo) para que al soltar la tarjeta en otra columna se dispare un `PUT` a la API actualizando el `stage` del Deal.

3. **Vista Ficha de Cliente (`CompanyProfile.jsx` / Extender `Contacts.jsx`)**:
   - Actualmente ya hay gestión de contactos. Modifica la vista de detalle de un Contacto para que actúe como una Ficha 360º.
   - Crea un layout con pestañas (Tabs):
     - **Tickets:** Lista los tickets actuales de ese `contact_id`.
     - **Oportunidades (Deals):** Lista de ventas asociadas al contacto, con opción de crear uno nuevo.
     - **Actividades/Notas:** Timeline o lista de `activities` (llamadas, emails, reuniones) para ese cliente.

---

### Criterios de Aceptación y Estilo

- **Estilo Visual**: El usuario ha pedido un diseño muy "premium", "moderno" y "dinámico" (Dark mode, glassmorphism, colores vibrantes). Usa la estructura CSS/Tailwind actual pero eleva el diseño de las tarjetas del Kanban para que se vean muy limpias.
- **Validación de Roles**: Un agente de soporte puro no debería ver el Pipeline de ventas, solo el `comercial` y el `admin`.
- Al finalizar, ejecuta las migraciones (`php artisan migrate`) y asegúrate de que el frontend compila correctamente.
