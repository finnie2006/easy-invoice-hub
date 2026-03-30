# Self-Hosted Easy Invoice Hub Setup

Dit project is nu omgezet van Supabase naar een zelf-gehoste PostgreSQL-database met een Node.js backend.

## Architectuur

- **Database**: PostgreSQL (zelf-gehoste versie)
- **Backend**: Node.js + Express
- **Frontend**: React + Vite
- **Authenticatie**: JWT tokens met refresh tokens
- **Wachtwoord-beveiliging**: bcryptjs

## Voorbereiding

### Systeemvereisten
- Docker & Docker Compose (aanbevolen)
- Of: Node.js 20+, PostgreSQL 16+

## Docker Deploy (aanbevolen)

### 1. Omgeving instellen

```bash
# Kopieer en bewerk het .env bestand
cp server/.env.example server/.env
```

**Let op!** Update deze waarden voor production:
- `DB_PASSWORD` - sterke wachtwoord genereren
- `JWT_SECRET` - willekeurige sleutel genereren
- `JWT_REFRESH_SECRET` - willekeurige sleutel genereren

```bash
# Genereer sterke geheimen:
openssl rand -base64 32  # Voor DB_PASSWORD
openssl rand -base64 32  # Voor JWT_SECRET
openssl rand -base64 32  # Voor JWT_REFRESH_SECRET
```

### 2. Starten met Docker Compose

```bash
# Start alle services
docker-compose up -d

# Logs controleren
docker-compose logs -f

# Services status
docker-compose ps
```

De applicatie is nu beschikbaar op:
- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:3001
- **Database**: localhost:5432

### 3. Eerste gebruiker aanmaken

Ga naar http://localhost:8080 en registreer je. De eerste gebruiker wordt automatisch admin.

## Handmatige Deploy (zonder Docker)

### 1. Database instellen

```bash
# PostgreSQL starten (Linux)
sudo systemctl start postgresql

# Connect to PostgreSQL
psql -U postgres

# Maak database en gebruiker aan:
CREATE DATABASE invoice_hub;
CREATE USER invoice_hub WITH PASSWORD 'your-strong-password';
ALTER ROLE invoice_hub WITH CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE invoice_hub TO invoice_hub;
\q

# Voer migrations uit
psql -U invoice_hub -d invoice_hub -f supabase/migrations/001-initial-schema.sql
```

### 2. Backend instellen

```bash
cd server

# Kopieer .env
cp .env.example .env

# Edit .env met database credentials
nano .env

# Install dependencies
npm install

# Start server
npm start
# Of development mode:
npm run dev
```

Backend draait nu op http://localhost:3001

### 3. Frontend instellen

```bash
# Terug naar root directory
cd ..

# Create .env file
echo "VITE_API_URL=http://localhost:3001" > .env

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend is nu beschikbaar op http://localhost:8080

## Environment Variabelen

### Backend (.env in server/)

```
# Server
PORT=3001

# Database
DB_HOST=localhost (of postgres in Docker)
DB_PORT=5432
DB_NAME=invoice_hub
DB_USER=invoice_hub
DB_PASSWORD=your_password

# JWT (genereer willekeurige strings!)
JWT_SECRET=your-secret-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-key-change-in-production
```

### Frontend (.env in root)

```
VITE_API_URL=http://localhost:3001
```

## Productie Deployment

### Met Docker Compose

```bash
# Update environment variabelen
nano server/.env

# Build images (optioneel)
docker-compose build

# Start in detached mode
docker-compose up -d

# Backup database
docker exec invoice_hub_db pg_dump -U invoice_hub invoice_hub > backup.sql

# Stop services
docker-compose stop
docker-compose down
```

### Database Backups

```bash
# Via Docker
docker exec invoice_hub_db pg_dump -U invoice_hub invoice_hub > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore
docker exec -i invoice_hub_db psql -U invoice_hub invoice_hub < backup.sql

# Via pgAdmin (optioneel)
# Voeg pgAdmin toe aan docker-compose.yml
```

## SSL/HTTPS Setup (Production)

### Met NGINX proxy

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com

# Update docker-compose.yml volumes en ports
# Port 443 mapping toevoegen
```

## Troubleshooting

### Database connection error
```bash
# Check database status
docker-compose logs postgres

# Verify connection string
psql -h localhost -U invoice_hub -d invoice_hub -c "SELECT 1"

# Reset database
docker-compose down -v  # Waarschuwing: verwijdert alle data!
docker-compose up -d
```

### Backend not connecting to database
```bash
# Check backend logs
docker-compose logs server

# Verify backend health
curl http://localhost:3001/api/health
```

### CORS errors
- Controleer of Backend URL correct is in frontend .env
- Controleer CORS instellingen in server/src/index.js

## Migratie van Supabase

### Data Export
Als je al data in Supabase hebt:

1. Export data van Supabase als CSV
2. Convert naar PostgreSQL format
3. Import in new database

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/verify` - Verify token

### Clients, Invoices, Expenses, Projects, etc.
Alle CRUD endpoints beschikbaar:
- `GET /api/{resource}` - List all
- `POST /api/{resource}` - Create new
- `PUT /api/{resource}/:id` - Update
- `DELETE /api/{resource}/:id` - Delete

Zie server/src/index.js voor volledige API documentatie.

## Development

### Frontend Development

```bash
# Start dev server (hot reload)
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

### Backend Development

```bash
cd server

# Start with auto-reload
npm run dev

# Run in production mode
npm start
```

## Support & Updates

- Controleer dependencies regelmatig:
  ```bash
  npm outdated
  cd server && npm outdated
  ```

- Update Dockerfile voor beveiligingspatches
- Maak regelmatig backups van database

## Licentie

Same as original project
