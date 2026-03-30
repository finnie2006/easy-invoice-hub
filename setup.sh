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

# Create .env file for server if it doesn't exist
if [ ! -f "server/.env" ]; then
    echo "Creating server/.env file..."
    
    # Generate random secrets
    DB_PASSWORD=$(openssl rand -base64 32 | head -c 32)
    JWT_SECRET=$(openssl rand -base64 32)
    JWT_REFRESH_SECRET=$(openssl rand -base64 32)
    
    cat > server/.env << EOF
# Server Configuration
PORT=3001

# Database Configuration
DB_HOST=postgres
DB_PORT=5432
DB_NAME=invoice_hub
DB_USER=invoice_hub
DB_PASSWORD=$DB_PASSWORD

# JWT Secrets (generated)
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
EOF
    
    echo "✅ server/.env created with random secrets"
else
    echo "ℹ️  server/.env already exists"
fi

echo ""

# Create frontend .env if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file for frontend..."
    cat > .env << EOF
VITE_API_URL=http://localhost:3001
EOF
    echo "✅ .env created"
else
    echo "ℹ️  .env already exists"
fi

echo ""
echo "Starting Docker containers..."
docker-compose up -d

echo ""
echo "Waiting for services to be ready..."
sleep 5

# Check if services are running
if docker-compose ps | grep -q "postgres.*Up"; then
    echo "✅ PostgreSQL is running"
else
    echo "⚠️  PostgreSQL may not be fully started yet"
fi

if docker-compose ps | grep -q "server.*Up"; then
    echo "✅ Backend server is running"
else
    echo "⚠️  Backend server may not be fully started yet"
fi

if docker-compose ps | grep -q "app.*Up"; then
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
echo "  docker-compose stop"
echo ""
echo "To view logs:"
echo "  docker-compose logs -f"
echo ""
