# Changelog

## 2026-04-23

### Knowledge Base — Filtro de categorías

- **Filtro de categorías añadido**: nueva UI en la pantalla de KB (`/agent/kb`) con dropdown de selección múltiple para filtrar artículos por categoría, siguiendo el mismo patrón visual que el filtro de prioridades del Inbox.
- **Multiselección con lógica OR**: el filtro acepta varias categorías simultáneamente y muestra todos los artículos que pertenezcan a cualquiera de ellas. Soporta categorías de primer nivel y subcategorías.
- **Filtrado client-side**: tras depurar exhaustivamente el backend (comprobado con `tinker` y `curl` que `whereIn` funciona correctamente), se optó por filtrar en el cliente: el backend devuelve todos los artículos (con búsqueda de texto opcional) y el frontend aplica el filtro de categorías con `allArticles.filter(a => categoryFilter.includes(a.category_id))`.
- **`KnowledgeBaseController`**: actualizado el filtro de categorías a `array_filter((array) $request->input('category_id', []))` + `whereIn`, siguiendo el patrón exacto de `TicketController`.
- **Cierre por clic exterior**: el dropdown de categorías se cierra al hacer clic fuera usando `document.addEventListener('mousedown', handler)` en un `useEffect`.

### Imágenes inline en comentarios (implementado y revertido)

- **TipTap instalado**: paquetes `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-image`, `@tiptap/extension-placeholder` y `dompurify` añadidos a `package.json`.
- **`UploadController.php`** creado: endpoint `POST /api/upload/image` que almacena en `storage/app/public/ticket-images/` y devuelve la URL relativa `/storage/ticket-images/{filename}`.
- **Ruta `POST /api/upload/image`** añadida dentro del grupo `auth:sanctum` en `api.php`.
- **`php artisan storage:link`** ejecutado para enlazar `public/storage → storage/app/public`.
- **`RichTextEditor.jsx`** creado: componente TipTap con toolbar (negrita, cursiva, tachado, listas, código, imagen), soporte de pegar imágenes desde portapapeles y arrastrar y soltar, y upload al endpoint `/api/upload/image`.
- **Integrado en `TicketDetail.jsx`**: textarea de respuesta y edición sustituidos por `RichTextEditor`; mensajes renderizados con `DOMPurify.sanitize()`.
- **Revertido a petición del usuario**: se volvió al `textarea` simple al no funcionar correctamente la visualización de imágenes inline. Se mantienen `UploadController` y la ruta por si se retoma.

### Adjuntos en tickets

- **Límites de subida corregidos**: `upload_max_filesize` subido a 20M y `post_max_size` a 25M en `backend/docker/php.ini`. `client_max_body_size` añadido a nginx frontend (20M) y backend (25M).
- **Visualización de imágenes adjuntas**: las imágenes se muestran como miniatura 96×96px en el hilo de mensajes. Al hacer clic se abre un lightbox a pantalla completa con botón de descarga.
- **Apertura de documentos adjuntos**: PDFs y otros documentos abren directamente en nueva pestaña al hacer clic (ya no fuerzan descarga).
- **Proxy `/storage` en nginx frontend**: añadida regla `location ^~ /storage` con `^~` para que tome prioridad sobre la regla de assets estáticos (que antes interceptaba `.png`, `.jpg`, etc. antes de llegar al proxy).
- **URLs de adjuntos relativas**: `TicketAttachment::getUrlAttribute()` ahora devuelve `/api/attachments/{id}` (relativo) en lugar de URL absoluta basada en `APP_URL`, evitando problemas en entornos distintos de producción.
- **`preview_url` en modelo**: nuevo atributo `preview_url` en `TicketAttachment` que devuelve `/storage/{path}` para servir imágenes directamente desde nginx sin pasar por PHP.
- **`UploadController`**: imágenes inline devuelven URL relativa `/storage/{path}` en lugar de la URL absoluta generada por `Storage::disk('public')->url()`.

### Editor de texto enriquecido (revertido)

- Se implementó y posteriormente se eliminó el editor TipTap (rich text) en los comentarios de tickets. Se mantiene el `textarea` simple.
- Se eliminaron los imports de `RichTextEditor` y `DOMPurify` de `TicketDetail.jsx`.

### CRUD de Prioridades

- **Migración `2026_04_23_000001_create_priorities_table`**: nueva tabla `priorities` con campos `tenant_id`, `name` (valor guardado en tickets), `label` (texto visible), `color` (hex), `sort_order`. Inserta automáticamente P1–P4 para todos los tenants existentes.
- **Modelo `Priority`**: nuevo modelo Eloquent con `$fillable` y relación `tickets`.
- **`PriorityController`**: CRUD completo (index, store, update, destroy). El `destroy` bloquea la eliminación si hay tickets con esa prioridad.
- **Rutas**: `GET/POST /api/priorities` y `PATCH/DELETE /api/priorities/{id}` añadidas en `api.php`.
- **Página `/agent/priorities`**: nueva página CRUD en Settings con tabla de prioridades, selector de color (paleta de presets + color picker + preview en tiempo real) y modal de creación/edición.
- **Enlace en Settings**: añadido "Prioridades" al menú desplegable de Settings en `AgentLayout.jsx`.
- **Hook `usePriorities`**: hook compartido `frontend/src/hooks/usePriorities.js` con `usePriorities()` y helper `getPriorityBadgeStyle(color)`.
- **`Inbox.jsx`**: filtros de prioridad y badges en la lista de tickets ahora son dinámicos (cargados desde API, coloreados con el hex de la BD). Eliminado `PRIORITY_COLORS` hardcodeado.
- **`CreateTicketModal.jsx`**: selector de prioridad dinámico desde API.
- **`TicketDetail.jsx`**: badge de prioridad coloreado en el panel lateral + select del modal de delegación dinámicos.
- **Validación backend**: `priority` en el endpoint `PATCH /tickets/{id}` cambiado de `in:P1,P2,P3,P4` a `nullable|string|max:50` para aceptar prioridades personalizadas.

### Campo Jira Issue

- **Buscador Inbox**: el campo `jira_issue_link` añadido al `orWhere` de la búsqueda en `TicketController::index`.
- **Campo editable en `TicketDetail`**: corregido el campo Jira Issue que no permitía escribir porque cada tecla disparaba una petición API. Ahora usa estado local (`jiraValue`) y guarda solo al perder el foco (`onBlur`), únicamente si el valor ha cambiado.
- **Validación backend**: `jira_issue_link` cambiado de `nullable|url` a `nullable|string|max:500` para aceptar texto libre y URLs sin esquema.
- **Input `type="text"`**: cambiado de `type="url"` a `type="text"` para evitar que el browser bloquee valores no estándar.
- **`onError` en `updateTicketMutation`**: añadido handler de error para mostrar mensajes al usuario si la petición falla.

### Automatización de estado

- **Eliminado cambio automático a `PENDING_CUSTOMER`**: al responder un ticket como agente el estado ya no cambia automáticamente. Solo se mantiene el cambio automático cuando responde el cliente (pasa a `IN_PROGRESS` si estaba en otro estado).
