# Easy Invoice Hub (Self-Hosted)

Production-ready invoicing app with:
- React + Vite frontend
- Node.js + Express API
- PostgreSQL database
- Docker Compose deployment

## Quick Start

```bash
cp server/.env.example .env
# Edit secrets in .env first
sudo docker compose up -d --build
```

Open:
- App: http://localhost:8080
- API health: http://localhost:3001/api/health

## Security Defaults Implemented

- `helmet` security headers on API
- Auth rate limiting (`/api/auth/*`)
- Configurable CORS allow-list (`ALLOWED_ORIGINS`)
- JSON body size limit (`BODY_LIMIT`)
- Upload size/type restrictions (`UPLOAD_MAX_MB`, PDF/JPEG/PNG/WEBP)
- Safe upload path deletion checks (path traversal protection)
- Backend container runs as non-root user
- Server dependencies with `npm audit` clean state

## Environment Variables (root `.env`)

Required in production:

```env
DB_USER=invoice_hub
DB_PASSWORD=change_me
DB_NAME=invoice_hub
PUBLIC_URL=https://your-domain.tld
JWT_SECRET=change_me_long_random
JWT_REFRESH_SECRET=change_me_long_random
ALLOWED_ORIGINS=https://your-domain.tld
```

Optional:

```env
IMAGE_TAG=latest
DOCKERHUB_NAMESPACE=yourdockerhubuser
PULL_POLICY=always
BODY_LIMIT=1mb
UPLOAD_MAX_MB=10
AUTH_WINDOW_MS=900000
AUTH_MAX_REQUESTS=30
```

## Build and Push to Docker Hub

Login once:

```bash
docker login
```

Build and push app image:

```bash
docker build -t yourdockerhubuser/easy-invoice-hub-app:latest .
docker push yourdockerhubuser/easy-invoice-hub-app:latest
```

Build and push server image:

```bash
docker build -t yourdockerhubuser/easy-invoice-hub-server:latest ./server
docker push yourdockerhubuser/easy-invoice-hub-server:latest
```

## Deploy from Docker Hub

Set in `.env` on your server:

```env
DOCKERHUB_NAMESPACE=yourdockerhubuser
IMAGE_TAG=latest
PULL_POLICY=always
```

Start with pull:

```bash
sudo docker compose pull
sudo docker compose up -d
```

## Data Backup and Restore

Database backup:

```bash
sudo docker compose exec -T postgres pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > invoice_hub.dump
```

Uploads backup:

```bash
sudo docker run --rm \
  -v easy-invoice-hub_uploads_data:/from \
  -v "$PWD":/to \
  alpine sh -c "cd /from && tar czf /to/uploads_data.tar.gz ."
```

Restore database:

```bash
sudo docker compose exec -T postgres pg_restore \
  -U "$DB_USER" -d "$DB_NAME" \
  --clean --if-exists --no-owner --no-privileges < invoice_hub.dump
```

Restore uploads:

```bash
sudo docker run --rm \
  -v easy-invoice-hub_uploads_data:/to \
  -v "$PWD":/from \
  alpine sh -c "cd /to && tar xzf /from/uploads_data.tar.gz"
```
