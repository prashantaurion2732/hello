#!/bin/bash

# Restore script for database backup

set -e

if [ -z "$1" ]; then
    echo "Usage: ./scripts/restore.sh <backup_file.sql.gz>"
    exit 1
fi

BACKUP_FILE=$1

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "⚠️  WARNING: This will overwrite the current database!"
read -p "Are you sure you want to continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Restore cancelled."
    exit 1
fi

echo "Restoring PostgreSQL database from $BACKUP_FILE..."
gunzip < "$BACKUP_FILE" | docker-compose exec -T postgres psql -U omegle_user omegle_clone

echo ""
echo "✓ Database restored successfully!"
echo ""
