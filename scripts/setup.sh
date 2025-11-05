#!/bin/bash

# Omegle Clone Setup Script
# This script helps you set up the application on a fresh server

set -e

echo "========================================="
echo "Omegle Clone - Setup Script"
echo "========================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    echo "Docker installed successfully!"
else
    echo "✓ Docker is already installed"
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "Docker Compose is not installed. Installing..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo "Docker Compose installed successfully!"
else
    echo "✓ Docker Compose is already installed"
fi

echo ""
echo "Setting up environment..."

# Copy .env.example to .env if it doesn't exist
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✓ Created .env file from .env.example"
    echo ""
    echo "⚠️  IMPORTANT: Please edit the .env file and update the following:"
    echo "  - POSTGRES_PASSWORD (use a strong password)"
    echo "  - CORS_ORIGIN (your domain)"
    echo "  - ALLOWED_ORIGINS (your domain)"
    echo ""
    read -p "Press Enter to continue after updating .env file..."
else
    echo "✓ .env file already exists"
fi

# Copy backend .env
if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    echo "✓ Created backend/.env file"
else
    echo "✓ backend/.env file already exists"
fi

# Copy frontend .env
if [ ! -f frontend/.env ]; then
    cp frontend/.env.example frontend/.env
    echo "✓ Created frontend/.env file"
else
    echo "✓ frontend/.env file already exists"
fi

# Create necessary directories
mkdir -p nginx/ssl
mkdir -p backend/logs
echo "✓ Created necessary directories"

echo ""
echo "========================================="
echo "Setup completed!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Update the .env files with your configuration"
echo "2. Run './scripts/deploy.sh' to start the application"
echo "3. For SSL setup, run './scripts/setup-ssl.sh' after DNS is configured"
echo ""
