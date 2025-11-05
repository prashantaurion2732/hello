#!/bin/bash

# Backup script for database and volumes

set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "Creating backup directory..."
mkdir -p $BACKUP_DIR

echo "Backing up PostgreSQL database..."
docker-compose exec -T postgres pg_dump -U omegle_user omegle_clone | gzip > "$BACKUP_DIR/postgres_$TIMESTAMP.sql.gz"

echo "Backing up Redis data..."
docker-compose exec -T redis redis-cli SAVE
docker cp omegle-redis:/data/dump.rdb "$BACKUP_DIR/redis_$TIMESTAMP.rdb"

echo ""
echo "Backup completed!"
echo "Files saved to: $BACKUP_DIR/"
echo "  - postgres_$TIMESTAMP.sql.gz"
echo "  - redis_$TIMESTAMP.rdb"
echo ""
