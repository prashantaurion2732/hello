#!/bin/bash

# SSL Setup Script using Let's Encrypt
# Requires: Domain DNS configured to point to your server

set -e

echo "========================================="
echo "Omegle Clone - SSL Setup"
echo "========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    exit 1
fi

# Load environment variables
source .env

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo "❌ DOMAIN and EMAIL must be set in .env file"
    exit 1
fi

echo "Setting up SSL for: $DOMAIN"
echo "Contact email: $EMAIL"
echo ""

read -p "Is your domain DNS configured to point to this server? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please configure DNS first, then run this script again."
    exit 1
fi

# Install certbot if not installed
if ! command -v certbot &> /dev/null; then
    echo "Installing certbot..."
    sudo apt-get update
    sudo apt-get install -y certbot
fi

# Stop nginx if running
docker-compose stop nginx 2>/dev/null || true

# Obtain certificate
echo "Obtaining SSL certificate from Let's Encrypt..."
sudo certbot certonly --standalone \
    --preferred-challenges http \
    -d $DOMAIN \
    -d www.$DOMAIN \
    --email $EMAIL \
    --agree-tos \
    --non-interactive

# Copy certificates to nginx directory
echo "Copying certificates..."
sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem nginx/ssl/
sudo chmod 644 nginx/ssl/*

# Update nginx config with domain
sed -i "s/\${DOMAIN}/$DOMAIN/g" nginx/nginx.conf

echo ""
echo "========================================="
echo "SSL Setup Completed!"
echo "========================================="
echo ""
echo "Starting services with SSL..."
docker-compose --profile with-ssl up -d

echo ""
echo "Your site is now available at:"
echo "  https://$DOMAIN"
echo ""
echo "Certificate will auto-renew. Set up a cron job to renew:"
echo "  0 0 1 * * certbot renew --quiet && docker-compose restart nginx"
echo ""
