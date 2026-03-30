# Easy Invoice Hub (Self-Hosted)

Production-ready invoicing app with:
- React + Vite frontend
- Node.js + Express API
- PostgreSQL database
- Docker Compose deployment

## Quick Start

```bash
cp .env.example .env
# Edit secrets in .env first
sudo docker compose pull
sudo docker compose up -d
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
APP_IMAGE=ghcr.io/finnie2006/easy-invoice-hub-app
SERVER_IMAGE=ghcr.io/finnie2006/easy-invoice-hub-server
IMAGE_TAG=latest
PULL_POLICY=always
BODY_LIMIT=1mb
UPLOAD_MAX_MB=10
AUTH_WINDOW_MS=900000
AUTH_MAX_REQUESTS=30
```

## Automatic GHCR Publishing (recommended)

This repository includes a GitHub Actions workflow at `.github/workflows/publish-ghcr.yml`.

On each push to `main`, it builds and publishes:
- `ghcr.io/<repo-owner>/easy-invoice-hub-app:latest`
- `ghcr.io/<repo-owner>/easy-invoice-hub-server:latest`

It uses `GITHUB_TOKEN` with package write permissions, so no extra secret is needed for same-repo publishing.

## Build and Push to GHCR (manual)

Login once (token needs `write:packages`):

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

Build and push app image:

```bash
docker build -t ghcr.io/YOUR_GITHUB_USERNAME/easy-invoice-hub-app:latest .
docker push ghcr.io/YOUR_GITHUB_USERNAME/easy-invoice-hub-app:latest
```

Build and push server image:

```bash
docker build -t ghcr.io/YOUR_GITHUB_USERNAME/easy-invoice-hub-server:latest ./server
docker push ghcr.io/YOUR_GITHUB_USERNAME/easy-invoice-hub-server:latest
```


## Deploy from GHCR

Set in `.env` on your server:

```env
APP_IMAGE=ghcr.io/finnie2006/easy-invoice-hub-app
SERVER_IMAGE=ghcr.io/finnie2006/easy-invoice-hub-server
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
