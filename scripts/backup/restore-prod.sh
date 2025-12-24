#!/bin/bash

# SAMS Production Disaster Recovery Script
# Restores Production from backup (INCLUDING users)
# Usage: ./restore-prod.sh --backup=YYYY-MM-DD --confirm

set -e

# Configuration
PROD_PROJECT_ID="sams-sandyland-prod"
BUCKET_NAME="sams-shared-backups"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Parse arguments
BACKUP_DATE=""
CONFIRMED=false
for arg in "$@"; do
    case $arg in
        --backup=*)
            BACKUP_DATE="${arg#*=}"
            shift
            ;;
        --confirm)
            CONFIRMED=true
            shift
            ;;
        *)
            echo "⚠️  Unknown argument: $arg"
            ;;
    esac
done

if [ -z "$BACKUP_DATE" ]; then
    echo "❌ Error: --backup=YYYY-MM-DD is required"
    echo ""
    echo "Usage: ./restore-prod.sh --backup=YYYY-MM-DD --confirm"
    echo ""
    echo "Available backups:"
    gsutil ls "gs://${BUCKET_NAME}/manifests/" 2>/dev/null | xargs -I {} basename {} .json | cut -d'_' -f1 | sort -u
    exit 1
fi

# Handle common typos
if [ "$BACKUP_DATE" = "lastest" ]; then
    echo "   ⚠️  Did you mean 'latest'? For production restore, please specify exact date (YYYY-MM-DD)"
    echo "   Available backups:"
    gsutil ls "gs://${BUCKET_NAME}/manifests/" 2>/dev/null | xargs -I {} basename {} .json | cut -d'_' -f1 | sort -u
    exit 1
fi

echo "🚨 SAMS Production Disaster Recovery"
echo "===================================="
echo ""
echo "⚠️  CRITICAL WARNING:"
echo "   This will OVERWRITE ALL Production data!"
echo "   This includes:"
echo "   - All Firestore collections (INCLUDING users)"
echo "   - All Storage files"
echo "   - This operation CANNOT be undone!"
echo ""
echo "Backup date: $BACKUP_DATE"
echo "Target project: $PROD_PROJECT_ID"
echo ""

# Find backup prefix
BACKUP_PREFIX=$(gsutil ls "gs://${BUCKET_NAME}/manifests/${BACKUP_DATE}_*.json" 2>/dev/null | head -1 | xargs basename .json)
if [ -z "$BACKUP_PREFIX" ]; then
    echo "❌ No backup found for date: $BACKUP_DATE"
    echo "   Available backups:"
    gsutil ls "gs://${BUCKET_NAME}/manifests/" 2>/dev/null | xargs -I {} basename {} .json | cut -d'_' -f1 | sort -u
    exit 1
fi

MANIFEST_PATH="gs://${BUCKET_NAME}/manifests/${BACKUP_PREFIX}.json"

# Download and parse manifest
echo "📄 Reading backup manifest..."
TEMP_MANIFEST=$(mktemp)
gsutil cp "$MANIFEST_PATH" "$TEMP_MANIFEST" >/dev/null 2>&1

if [ ! -s "$TEMP_MANIFEST" ]; then
    echo "❌ Failed to download manifest"
    rm "$TEMP_MANIFEST"
    exit 1
fi

# Extract paths from manifest
FIRESTORE_ALL_PATH=$(cat "$TEMP_MANIFEST" | grep -o '"all_collections": "[^"]*"' | cut -d'"' -f4)
FIRESTORE_USERS_PATH=$(cat "$TEMP_MANIFEST" | grep -o '"users_only": "[^"]*"' | cut -d'"' -f4)
STORAGE_PATH=$(cat "$TEMP_MANIFEST" | grep -o '"path": "[^"]*"' | cut -d'"' -f4)
BACKUP_TIMESTAMP=$(cat "$TEMP_MANIFEST" | grep -o '"timestamp": "[^"]*"' | cut -d'"' -f4)

if [ -z "$FIRESTORE_ALL_PATH" ] || [ -z "$STORAGE_PATH" ]; then
    echo "❌ Invalid manifest format"
    rm "$TEMP_MANIFEST"
    exit 1
fi

echo "   Backup timestamp: $BACKUP_TIMESTAMP"
echo "   Firestore (all): $FIRESTORE_ALL_PATH"
echo "   Firestore (users): $FIRESTORE_USERS_PATH"
echo "   Storage: $STORAGE_PATH"
rm "$TEMP_MANIFEST"

# Critical confirmation
echo ""
echo "🚨 FINAL CONFIRMATION REQUIRED"
echo "=============================="
echo ""
echo "To proceed with Production restore, you must:"
echo "1. Type the project ID exactly: $PROD_PROJECT_ID"
echo "2. Type 'RESTORE PRODUCTION' to confirm"
echo ""

if [ "$CONFIRMED" != "true" ]; then
    echo -n "Type project ID: "
    read PROJECT_CONFIRM
    
    if [ "$PROJECT_CONFIRM" != "$PROD_PROJECT_ID" ]; then
        echo "❌ Project ID mismatch. Operation cancelled."
        exit 1
    fi
    
    echo -n "Type 'RESTORE PRODUCTION': "
    read RESTORE_CONFIRM
    
    if [ "$RESTORE_CONFIRM" != "RESTORE PRODUCTION" ]; then
        echo "❌ Confirmation text mismatch. Operation cancelled."
        exit 1
    fi
fi

echo ""
echo "⚠️  Proceeding with Production restore..."
echo "   This will take several minutes. Do not interrupt!"
echo ""

# Log start time
START_TIME=$(date)
echo "Start time: $START_TIME" | tee "$SCRIPT_DIR/restore-prod-$(date +%Y%m%d-%H%M%S).log"

# Step 1: Import Firestore (all collections)
echo "📦 Step 1: Importing Firestore (all collections)..."
echo "   Importing from: $FIRESTORE_ALL_PATH"

gcloud firestore import "$FIRESTORE_ALL_PATH" \
    --project="$PROD_PROJECT_ID" \
    --async

echo "   ⏳ Firestore import started (async operation)"
echo ""

# Step 2: Import users collection
echo "👥 Step 2: Importing users collection..."
echo "   Importing from: $FIRESTORE_USERS_PATH"

gcloud firestore import "$FIRESTORE_USERS_PATH" \
    --project="$PROD_PROJECT_ID" \
    --async

echo "   ⏳ Users import started (async operation)"
echo ""

# Step 3: Sync Storage
echo "📁 Step 3: Syncing Storage files..."
PROD_STORAGE_BUCKET="sams-sandyland-prod.firebasestorage.app"

echo "   Source: $STORAGE_PATH"
echo "   Destination: gs://${PROD_STORAGE_BUCKET}/"

# Sync storage
gsutil -m rsync -r "$STORAGE_PATH/" "gs://${PROD_STORAGE_BUCKET}/"

echo "   ✅ Storage sync complete"
echo ""

# Step 4: Wait for imports
echo "⏳ Step 4: Waiting for Firestore imports to complete..."
echo "   This may take 10-20 minutes for large databases"
echo ""
echo "   Check status with:"
echo "   gcloud firestore operations list --project=$PROD_PROJECT_ID"
echo ""
echo "   Waiting up to 20 minutes (checking every 30 seconds)..."

MAX_WAIT=1200
WAIT_INTERVAL=30
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
    sleep $WAIT_INTERVAL
    ELAPSED=$((ELAPSED + WAIT_INTERVAL))
    echo "   Waiting... (${ELAPSED}s elapsed)"
done

echo ""
echo "✅ Restore Complete!"
echo "==================="
echo ""
echo "📊 Summary:"
echo "   Firestore (all collections) imported from: $FIRESTORE_ALL_PATH"
echo "   Firestore (users) imported from: $FIRESTORE_USERS_PATH"
echo "   Storage synced from: $STORAGE_PATH"
echo "   Restore started: $START_TIME"
echo ""
echo "💡 Next steps:"
echo "   1. Verify Firestore imports completed:"
echo "      gcloud firestore operations list --project=$PROD_PROJECT_ID"
echo "   2. Test Production environment thoroughly"
echo "   3. Verify users can log in"
echo "   4. Check application functionality"
echo ""
echo "📝 Log file saved: restore-prod-*.log"
echo ""

