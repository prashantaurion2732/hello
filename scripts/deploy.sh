#!/bin/bash

# Deployment script for Omegle Clone

set -e

echo "========================================="
echo "Omegle Clone - Deployment"
echo "========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Please run ./scripts/setup.sh first"
    exit 1
fi

# Load environment variables
source .env

echo "Building Docker images..."
docker-compose build

echo ""
echo "Starting services..."
docker-compose up -d

echo ""
echo "Waiting for services to be healthy..."
sleep 10

# Check service health
echo "Checking service status..."
docker-compose ps

echo ""
echo "========================================="
echo "Deployment completed!"
echo "========================================="
echo ""
echo "Application URLs:"
echo "  Frontend: http://localhost"
echo "  Backend:  http://localhost:3000"
echo "  Health:   http://localhost:3000/health"
echo "  Stats:    http://localhost:3000/stats"
echo ""
echo "To view logs:"
echo "  docker-compose logs -f"
echo ""
echo "To stop services:"
echo "  docker-compose down"
echo ""
