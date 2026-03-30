#!/bin/bash

# Easy Invoice Hub - Self-Hosted Setup Script
# This script sets up the complete self-hosted environment

set -e  # Exit on error

echo "======================================"
echo "Easy Invoice Hub - Self-Hosted Setup"
echo "======================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    echo "   Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker is installed"
echo ""

# Create root .env if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cp .env.example .env

    # Generate random secrets for safer defaults
    DB_PASSWORD=$(openssl rand -base64 32 | head -c 32)
    JWT_SECRET=$(openssl rand -base64 32)
    JWT_REFRESH_SECRET=$(openssl rand -base64 32)

    if sed --version >/dev/null 2>&1; then
        sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=$DB_PASSWORD/" .env
        sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
        sed -i "s/^JWT_REFRESH_SECRET=.*/JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET/" .env
    else
        # Fallback for systems without GNU sed
        perl -0777 -i -pe "s/^DB_PASSWORD=.*/DB_PASSWORD=$DB_PASSWORD/m; s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/m; s/^JWT_REFRESH_SECRET=.*/JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET/m" .env
    fi

    echo "✅ .env created with random secrets"
else
    echo "ℹ️  .env already exists"
fi

echo ""
echo "Starting Docker containers..."
docker compose pull
docker compose up -d

echo ""
echo "Waiting for services to be ready..."
sleep 5

# Check if services are running
if docker compose ps | grep -q "postgres.*Up"; then
    echo "✅ PostgreSQL is running"
else
    echo "⚠️  PostgreSQL may not be fully started yet"
fi

if docker compose ps | grep -q "server.*Up"; then
    echo "✅ Backend server is running"
else
    echo "⚠️  Backend server may not be fully started yet"
fi

if docker compose ps | grep -q "app.*Up"; then
    echo "✅ Frontend app is running"
else
    echo "⚠️  Frontend app may not be fully started yet"
fi

echo ""
echo "======================================"
echo "✅ Setup Complete!"
echo "======================================"
echo ""
echo "Applications are now running:"
echo "  📱 Frontend:  http://localhost:8080"
echo "  🔧 API:       http://localhost:3001"
echo "  🗄️  Database:  localhost:5432"
echo ""
echo "Next steps:"
echo "  1. Open http://localhost:8080 in your browser"
echo "  2. Register a new account (first user becomes admin)"
echo "  3. Start using Easy Invoice Hub!"
echo ""
echo "For more information:"
echo "  📖 See SELF_HOSTED_SETUP.md for detailed setup instructions"
echo ""
echo "To stop services:"
echo "  docker compose stop"
echo ""
echo "To view logs:"
echo "  docker compose logs -f"
echo ""
