# Helpdesk SaaS - Getting Started

## Services Running

### Application URLs

- **Laravel Backend API**: http://localhost (or http://localhost:80)
- **React Frontend**: http://localhost:5173
- **Mailhog (Email Testing)**: http://localhost:8025
- **MinIO Console (S3 Storage)**: http://localhost:8900

### Quick Start

1. **Start Docker Services**
   ```bash
   docker compose up -d
   ```

2. **Run Database Migrations**
   ```bash
   docker compose exec app php artisan migrate
   ```

3. **Access the Frontend**
   - Open http://localhost:5173 in your browser

4. **API Endpoints**
   - Base URL: http://localhost/api
   - Example: http://localhost/api/tickets

### Testing Email

- All emails are caught by Mailhog
- View emails at: http://localhost:8025

### Database Access

**MySQL**:
- Host: localhost
- Port: 3306
- Database: helpdesk
- Username: sail
- Password: password

### File Storage (MinIO)

- Console: http://localhost:8900
- Username: sail
- Password: password
- Bucket: local

### Development Commands

**Backend (Laravel)**:
```bash
# Enter the container
docker compose exec app bash

# Run migrations
docker compose exec app php artisan migrate

# Create a seeder
docker compose exec app php artisan make:seeder

# Run tests
docker compose exec app php artisan test
```

**Frontend (React)**:
```bash
cd frontend
npm run dev    # Already running on port 5173
npm run build  # Build for production
```

### Stopping Services

```bash
docker compose down
```

### Rebuilding

```bash
docker compose down
docker compose up -d --build
```
