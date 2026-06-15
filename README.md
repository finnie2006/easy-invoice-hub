# Easy Invoice Hub

Easy Invoice Hub is een self-hosted facturatie- en administratie-app voor freelancers en kleine ondernemers. De app helpt met facturen, klanten, projecten, uren, uitgaven, BTW-aangiftevoorbereiding en basisrapportages, zonder afhankelijkheid van een externe SaaS-dienst.

De applicatie bestaat uit een React/Vite frontend, een Node.js/Express API en een PostgreSQL database. Deployen kan lokaal, op een VPS of via Docker Compose.

## Features

- Klantenbeheer met bedrijfs- en contactgegevens.
- Facturen maken, bewerken, downloaden en per e-mail verzenden.
- Factuurstatussen zoals concept, verzonden, betaald, verlopen en geannuleerd.
- Externe facturen en bijlagen registreren.
- Projecten en urenregistratie.
- Uitgaven inclusief BTW, reverse-charge ondersteuning en bonuploads.
- BTW-periodes beheren en kwartalen afsluiten.
- BTW-aangiftevelden voorbereiden per kwartaal.
- Dashboard en rapportages voor omzet, kosten en BTW.
- PWA-installatie voor telefoon of desktop.
- Pushmeldingen voor verzonden facturen waarvan de betalingstermijn is verstreken.
- Lokale login met JWT refresh tokens, optionele 2FA en optionele Authentik OAuth.
- Admin-instellingen voor registratie, SMTP en systeemconfiguratie.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query.
- Backend: Node.js, Express, PostgreSQL, JWT, Helmet, Multer, Nodemailer.
- Database: PostgreSQL 16.
- Deployment: Docker Compose, NGINX container, GHCR image workflow.
- Tests: Vitest, React Testing Library.

## Project Structure

```text
.
├── src/                    # React frontend
├── server/src/             # Express backend
├── supabase/migrations/    # PostgreSQL schema migrations
├── public/                 # Static assets, PWA manifest, service worker
├── docker-compose.yml      # Self-hosted deployment
└── SELF_HOSTED_SETUP.md    # Extended deployment guide
```

## Quick Start With Docker

```bash
cp .env.example .env
```

Edit `.env` and set strong values for at least:

```env
DB_PASSWORD=change_me
JWT_SECRET=change_me_long_random
JWT_REFRESH_SECRET=change_me_long_random
PUBLIC_URL=http://localhost:8080
ALLOWED_ORIGINS=http://localhost:8080
```

Start the stack:

```bash
docker compose up -d
```

Open:

- App: http://localhost:8080
- API health: http://localhost:3001/api/health

The first registered user becomes admin.

## Local Development

Start PostgreSQL and the backend:

```bash
cd server
npm install
npm run dev
```

Start the frontend in another terminal:

```bash
npm install
npm run dev
```

By default the Vite dev server proxies `/api` and `/uploads` to `http://localhost:3001`.

## Environment Variables

Root `.env` for Docker Compose:

```env
DB_USER=invoice_hub
DB_PASSWORD=change_me
DB_NAME=invoice_hub
PUBLIC_URL=https://your-domain.tld
JWT_SECRET=change_me_long_random
JWT_REFRESH_SECRET=change_me_long_random
ALLOWED_ORIGINS=https://your-domain.tld
```

Optional production settings:

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

PWA push notifications:

```env
VAPID_SUBJECT=mailto:admin@your-domain.tld
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
PUSH_CHECK_INTERVAL_MINUTES=60
```

Generate stable VAPID keys:

```bash
cd server
npx web-push generate-vapid-keys
```

Without configured VAPID keys the server generates temporary keys at startup. That is fine for development, but production users may need to re-enable push notifications after each restart.

## PWA And Push Notifications

The app includes a manifest, install icons and a service worker. On HTTPS domains, supported browsers can install it as an app on mobile or desktop.

Push reminders are configured per logged-in device from `Instellingen > App en meldingen`. The backend periodically checks for invoices where:

- `status = sent`
- `due_date < CURRENT_DATE`
- no reminder has been sent yet for that invoice and push subscription

Push notifications require HTTPS in production. Localhost works for development; a plain LAN HTTP address usually does not.

## Database Migrations

Migrations live in `supabase/migrations`. Docker Compose runs them through the `migrate` service before the API starts.

The API also applies a small runtime compatibility schema check on startup for recent columns and tables. That keeps existing self-hosted installs from failing when a deployment missed a migration.

## Quality Checks

```bash
npm run lint
npm run build
npm test
node --check server/src/index.js
```

## Production Deployment

For a full self-hosted guide, see [SELF_HOSTED_SETUP.md](SELF_HOSTED_SETUP.md).

Recommended production basics:

- Put the app behind HTTPS.
- Set strong JWT secrets and database credentials.
- Set `ALLOWED_ORIGINS` to your public app URL.
- Configure SMTP if you want to send invoices by e-mail.
- Configure persistent VAPID keys if you want stable push notifications.
- Back up both PostgreSQL data and uploaded files.

## GHCR Images

This repository includes `.github/workflows/publish-ghcr.yml`. On pushes to `main`, it can publish:

- `ghcr.io/<repo-owner>/easy-invoice-hub-app:latest`
- `ghcr.io/<repo-owner>/easy-invoice-hub-server:latest`

Manual image build:

```bash
docker build -t ghcr.io/YOUR_GITHUB_USERNAME/easy-invoice-hub-app:latest .
docker build -t ghcr.io/YOUR_GITHUB_USERNAME/easy-invoice-hub-server:latest ./server
```

## Backup And Restore

Database backup:

```bash
docker compose exec -T postgres pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > invoice_hub.dump
```

Uploads backup:

```bash
docker run --rm \
  -v easy-invoice-hub_uploads_data:/from \
  -v "$PWD":/to \
  alpine sh -c "cd /from && tar czf /to/uploads_data.tar.gz ."
```

Database restore:

```bash
docker compose exec -T postgres pg_restore \
  -U "$DB_USER" -d "$DB_NAME" \
  --clean --if-exists --no-owner --no-privileges < invoice_hub.dump
```

Uploads restore:

```bash
docker run --rm \
  -v easy-invoice-hub_uploads_data:/to \
  -v "$PWD":/from \
  alpine sh -c "cd /to && tar xzf /from/uploads_data.tar.gz"
```

## Security

Implemented defaults include:

- Helmet security headers.
- Auth rate limiting on `/api/auth/*`.
- Configurable CORS allow-list.
- JSON body size limit.
- Upload size and type restrictions.
- Safe upload deletion checks.
- Backend container runs as a non-root user.
- Optional MFA.

Do not commit `.env` files, database dumps or uploaded user files.

## Contributing

Contributions are welcome. Please keep changes focused and include tests for user-facing behavior or shared logic where practical.

Suggested workflow:

1. Fork the repository.
2. Create a feature branch.
3. Run lint, build and tests.
4. Open a pull request with a concise description and screenshots for UI changes.

## License

This project is available under the MIT License. See [LICENSE](LICENSE).

## Disclaimer

Easy Invoice Hub helps prepare invoices, reports and BTW data, but it is not legal, financial or tax advice. Verify output before filing taxes or sending official documents.
