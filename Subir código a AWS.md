# Subir código a AWS

## 1. Desde local — subir cambios a git

```bash
git add .
git commit -m "descripción del cambio"
git push origin main
```

## 2. En el servidor AWS — bajar los cambios

```bash
git pull origin main
```

## 3. Reconstruir y reiniciar el frontend

```bash
docker compose build --no-cache frontend && docker compose up -d frontend
```

> Siempre usar `--no-cache` para asegurarse de que Docker coge los ficheros nuevos.

## 4. Limpiar caché de Laravel (backend)

```bash
docker compose exec backend php artisan config:cache
docker compose exec backend php artisan route:cache
```

## 5. Si hay migraciones nuevas

```bash
docker compose exec backend php artisan migrate --force
```

## 6. Reinicio completo (si algo falla)

```bash
docker compose down && docker compose build --no-cache frontend && docker compose up -d
```

---

**Notas:**
- El backend se actualiza automáticamente vía volumen mount (no necesita rebuild).
- El frontend siempre necesita `build` porque está compilado dentro de la imagen Docker.
- Después de desplegar, hacer **Cmd+Shift+R** en el navegador para forzar recarga sin caché.
