#!/bin/bash

# SAMS Backup Listing Utility
# Lists all backups with timestamps and sizes
# Usage: ./list-backups.sh [--project=prod|dev]

set -e

BUCKET_NAME="sams-shared-backups"
PROJECT_FILTER=""

# Parse arguments
for arg in "$@"; do
    case $arg in
        --project=*)
            PROJECT_FILTER="${arg#*=}"
            shift
            ;;
        *)
            echo "⚠️  Unknown argument: $arg"
            ;;
    esac
done

echo "📋 SAMS Backup Listing"
echo "====================="
echo ""

# List all manifests
echo "🔍 Scanning backups..."
MANIFESTS=$(gsutil ls "gs://${BUCKET_NAME}/manifests/" 2>/dev/null | grep -E '\.json$' | sort -r)

if [ -z "$MANIFESTS" ]; then
    echo "❌ No backups found"
    echo "   Run ./backup-prod.sh to create your first backup"
    exit 0
fi

# Download and parse each manifest
echo ""
echo "Available Backups:"
echo "=================="
echo ""

BACKUP_COUNT=0
while IFS= read -r manifest_path; do
    BACKUP_COUNT=$((BACKUP_COUNT + 1))
    
    # Extract backup prefix from path
    BACKUP_PREFIX=$(basename "$manifest_path" .json)
    BACKUP_DATE=$(echo "$BACKUP_PREFIX" | cut -d'_' -f1)
    BACKUP_TAG=$(echo "$BACKUP_PREFIX" | cut -d'_' -f2-)
    
    # Download manifest
    TEMP_MANIFEST=$(mktemp)
    if ! gsutil cp "$manifest_path" "$TEMP_MANIFEST" >/dev/null 2>&1; then
        echo "⚠️  Failed to read manifest: $BACKUP_PREFIX"
        continue
    fi
    
    # Parse manifest
    TIMESTAMP=$(cat "$TEMP_MANIFEST" | grep -o '"timestamp": "[^"]*"' | cut -d'"' -f4)
    SOURCE_PROJECT=$(cat "$TEMP_MANIFEST" | grep -o '"source_project": "[^"]*"' | cut -d'"' -f4)
    FILES_COUNT=$(cat "$TEMP_MANIFEST" | grep -o '"files_count": [0-9]*' | grep -o '[0-9]*')
    SIZE_MB=$(cat "$TEMP_MANIFEST" | grep -o '"total_size_mb": [0-9]*' | grep -o '[0-9]*')
    FIRESTORE_ALL=$(cat "$TEMP_MANIFEST" | grep -o '"all_collections": "[^"]*"' | cut -d'"' -f4)
    FIRESTORE_USERS=$(cat "$TEMP_MANIFEST" | grep -o '"users_only": "[^"]*"' | cut -d'"' -f4)
    STORAGE_PATH=$(cat "$TEMP_MANIFEST" | grep -o '"path": "[^"]*"' | cut -d'"' -f4)
    
    rm "$TEMP_MANIFEST"
    
    # Filter by project if specified
    if [ -n "$PROJECT_FILTER" ]; then
        if [ "$PROJECT_FILTER" = "prod" ] && [ "$SOURCE_PROJECT" != "sams-sandyland-prod" ]; then
            continue
        fi
        if [ "$PROJECT_FILTER" = "dev" ] && [ "$SOURCE_PROJECT" != "sandyland-management-system" ]; then
            continue
        fi
    fi
    
    # Format date
    FORMATTED_DATE=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$TIMESTAMP" "+%Y-%m-%d %H:%M:%S UTC" 2>/dev/null || \
                     date -u -d "$TIMESTAMP" "+%Y-%m-%d %H:%M:%S UTC" 2>/dev/null || \
                     echo "$TIMESTAMP")
    
    # Check if Firestore exports exist
    FIRESTORE_ALL_EXISTS="❌"
    if gsutil ls "$FIRESTORE_ALL/" >/dev/null 2>&1; then
        FIRESTORE_ALL_EXISTS="✅"
    fi
    
    FIRESTORE_USERS_EXISTS="❌"
    if gsutil ls "$FIRESTORE_USERS/" >/dev/null 2>&1; then
        FIRESTORE_USERS_EXISTS="✅"
    fi
    
    STORAGE_EXISTS="❌"
    if gsutil ls "$STORAGE_PATH/" >/dev/null 2>&1; then
        STORAGE_EXISTS="✅"
    fi
    
    # Display backup info
    echo "📦 Backup #$BACKUP_COUNT: $BACKUP_DATE ($BACKUP_TAG)"
    echo "   Timestamp: $FORMATTED_DATE"
    echo "   Source: $SOURCE_PROJECT"
    echo "   Firestore (all): $FIRESTORE_ALL_EXISTS"
    echo "   Firestore (users): $FIRESTORE_USERS_EXISTS"
    echo "   Storage: $STORAGE_EXISTS"
    if [ -n "$FILES_COUNT" ]; then
        echo "   Files: $FILES_COUNT"
    fi
    if [ -n "$SIZE_MB" ]; then
        echo "   Size: ~${SIZE_MB} MB"
    fi
    echo ""
    
done <<< "$MANIFESTS"

if [ $BACKUP_COUNT -eq 0 ]; then
    echo "No backups found matching criteria"
else
    echo "Total backups: $BACKUP_COUNT"
    echo ""
    echo "💡 Usage:"
    echo "   Restore to dev: ./restore-dev-from-prod.sh --backup=$BACKUP_DATE"
    echo "   Restore to prod: ./restore-prod.sh --backup=$BACKUP_DATE --confirm"
fi

