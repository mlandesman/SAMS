#!/bin/bash

# SAMS Dev Restore from Production Backup
# Imports latest Prod backup to Dev (EXCLUDING users)
# Usage: ./restore-dev-from-prod.sh [--backup=latest|YYYY-MM-DD]

set -e

# Configuration
PROD_PROJECT_ID="sams-sandyland-prod"
DEV_PROJECT_ID="sandyland-management-system"
BUCKET_NAME="sams-shared-backups"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Parse arguments
BACKUP_DATE=""
for arg in "$@"; do
    case $arg in
        --backup=*)
            BACKUP_DATE="${arg#*=}"
            shift
            ;;
        *)
            echo "⚠️  Unknown argument: $arg"
            ;;
    esac
done

echo "🔄 SAMS Dev Restore from Production"
echo "===================================="
echo ""
echo "Source: $PROD_PROJECT_ID"
echo "Target: $DEV_PROJECT_ID"
echo ""

# Step 1: List available backups
echo "📋 Step 1: Finding available backups..."

# Handle common typos
if [ "$BACKUP_DATE" = "lastest" ]; then
    echo "   ⚠️  Did you mean 'latest'? Using 'latest'..."
    BACKUP_DATE="latest"
fi

if [ -z "$BACKUP_DATE" ] || [ "$BACKUP_DATE" = "latest" ]; then
    echo "   Searching for latest backup..."
    
    # List all manifests and find the latest
    LATEST_MANIFEST=$(gsutil ls "gs://${BUCKET_NAME}/manifests/" 2>/dev/null | sort -r | head -1)
    
    if [ -z "$LATEST_MANIFEST" ]; then
        echo "❌ No backups found in gs://${BUCKET_NAME}/manifests/"
        echo "   Run ./backup-prod.sh first to create a backup"
        exit 1
    fi
    
    # Extract date from manifest path (format: YYYY-MM-DD_tag.json)
    BACKUP_DATE=$(basename "$LATEST_MANIFEST" .json | cut -d'_' -f1)
    echo "   ✅ Found latest backup: $BACKUP_DATE"
else
    echo "   Using specified backup: $BACKUP_DATE"
    # Convert dashes to underscores for matching (user might pass 2025-12-23-1501)
    BACKUP_DATE_SEARCH=$(echo "$BACKUP_DATE" | sed 's/-/_/g')
fi

# Find backup prefix (could be nightly, manual, or pre-deploy)
# Handle both formats: YYYY-MM-DD_tag and YYYY-MM-DD-HHMM_tag
# Try with converted format first
if [ -n "$BACKUP_DATE_SEARCH" ]; then
    BACKUP_PREFIX=$(gsutil ls "gs://${BUCKET_NAME}/manifests/${BACKUP_DATE_SEARCH}"*".json" 2>/dev/null | head -1 | xargs -I {} basename {} .json 2>/dev/null)
fi

# If no match, try original format
if [ -z "$BACKUP_PREFIX" ]; then
    BACKUP_PREFIX=$(gsutil ls "gs://${BUCKET_NAME}/manifests/${BACKUP_DATE}"*".json" 2>/dev/null | head -1 | xargs -I {} basename {} .json 2>/dev/null)
fi

# If still no match, try date-only pattern
if [ -z "$BACKUP_PREFIX" ]; then
    BACKUP_DATE_ONLY=$(echo "$BACKUP_DATE" | cut -d'-' -f1-3)
    BACKUP_PREFIX=$(gsutil ls "gs://${BUCKET_NAME}/manifests/${BACKUP_DATE_ONLY}_*.json" 2>/dev/null | head -1 | xargs -I {} basename {} .json 2>/dev/null)
fi

if [ -z "$BACKUP_PREFIX" ]; then
    echo "❌ No backup found for date: $BACKUP_DATE"
    echo "   Available backups:"
    gsutil ls "gs://${BUCKET_NAME}/manifests/" 2>/dev/null | xargs -I {} basename {} .json | sed 's/_.*//' | sort -u
    exit 1
fi

MANIFEST_PATH="gs://${BUCKET_NAME}/manifests/${BACKUP_PREFIX}.json"

# Download and parse manifest
echo ""
echo "📄 Step 2: Reading backup manifest..."
TEMP_MANIFEST=$(mktemp)
gsutil cp "$MANIFEST_PATH" "$TEMP_MANIFEST" >/dev/null 2>&1

if [ ! -s "$TEMP_MANIFEST" ]; then
    echo "❌ Failed to download manifest"
    rm "$TEMP_MANIFEST"
    exit 1
fi

# Extract paths from manifest
FIRESTORE_PATH=$(cat "$TEMP_MANIFEST" | grep -o '"all_collections": "[^"]*"' | cut -d'"' -f4)
STORAGE_PATH=$(cat "$TEMP_MANIFEST" | grep -o '"path": "[^"]*"' | cut -d'"' -f4)
BACKUP_TIMESTAMP=$(cat "$TEMP_MANIFEST" | grep -o '"timestamp": "[^"]*"' | cut -d'"' -f4)

if [ -z "$FIRESTORE_PATH" ] || [ -z "$STORAGE_PATH" ]; then
    echo "❌ Invalid manifest format"
    rm "$TEMP_MANIFEST"
    exit 1
fi

echo "   Backup timestamp: $BACKUP_TIMESTAMP"
echo "   Firestore path: $FIRESTORE_PATH"
echo "   Storage path: $STORAGE_PATH"
rm "$TEMP_MANIFEST"

# Step 3: Confirm before proceeding
echo ""
echo "⚠️  WARNING: This will overwrite Dev environment data!"
echo "   - Firestore collections will be replaced (users preserved)"
echo "   - Storage files will be synced"
echo "   - Dev users will NOT be affected"
echo ""
echo -n "   Type 'RESTORE DEV' to confirm: "
read CONFIRMATION

if [ "$CONFIRMATION" != "RESTORE DEV" ]; then
    echo "❌ Operation cancelled"
    exit 0
fi

echo ""

# Step 4: Note current Dev users (for verification)
echo "👥 Step 3: Preserving Dev users..."
echo "   Dev users will be preserved and NOT overwritten"
echo "   (Only Firestore data excluding users collection will be restored)"
echo ""

# Step 5: Purge Dev client data and auditLog before import
echo "🗑️  Step 4: Purging Dev data before import..."
echo "   This ensures deleted Prod documents don't persist in Dev"
echo ""

# Purge client data and auditLog
# Using firebase CLI recursive delete — handles subcollections automatically
# NOTE: Leave exchangeRates (auto-synced) and system (environment-specific)
for COLLECTION in "clients" "auditLog"; do
    echo "   Deleting $COLLECTION..."
    firebase firestore:delete "$COLLECTION" -r --project "$DEV_PROJECT_ID" --force 2>/dev/null || \
        echo "   ⚠️  $COLLECTION may not exist (OK if first restore)"
done

echo "   ✅ Dev data purged"
echo ""

# Step 6: Import Firestore (excluding users)
echo "📦 Step 5: Importing Firestore (excluding users)..."
echo "   Importing from: $FIRESTORE_PATH"
echo "   Target project: $DEV_PROJECT_ID"

gcloud firestore import "$FIRESTORE_PATH" \
    --project="$DEV_PROJECT_ID" \
    --async

echo "   ⏳ Firestore import started (async operation)"
echo "   💡 This may take several minutes. Check status with:"
echo "      gcloud firestore operations list --project=$DEV_PROJECT_ID"
echo ""

# Step 7: Sync Storage
echo "📁 Step 6: Syncing Storage files..."
DEV_STORAGE_BUCKET="sandyland-management-system.firebasestorage.app"

echo "   Source: $STORAGE_PATH"
echo "   Destination: gs://${DEV_STORAGE_BUCKET}/"

# Sync storage with -d flag to delete stale files in Dev
# Dev is also staging — must mirror Prod exactly
for FOLDER in clients icons logos; do
    echo "   Syncing $FOLDER/ (with delete of stale files)..."
    gsutil -m rsync -r -d "$STORAGE_PATH/$FOLDER/" "gs://${DEV_STORAGE_BUCKET}/$FOLDER/" 2>/dev/null || true
done

# Imports folder is additive only (may contain Dev-specific test imports)
echo "   Syncing imports/ (additive only)..."
gsutil -m rsync -r "$STORAGE_PATH/imports/" "gs://${DEV_STORAGE_BUCKET}/imports/" 2>/dev/null || true

echo "   ✅ Storage sync complete"
echo ""

# Step 8: Wait for Firestore import
echo "⏳ Step 7: Waiting for Firestore import to complete..."
echo "   (This may take 5-10 minutes for large databases)"
echo ""
echo "   You can check status manually with:"
echo "   gcloud firestore operations list --project=$DEV_PROJECT_ID"
echo ""
echo "   Or wait here (checking every 30 seconds, max 15 minutes)..."

# Wait up to 15 minutes
MAX_WAIT=900
WAIT_INTERVAL=30
ELAPSED=0

# Get the operation name from the import command output
# Note: Firestore import operations are async, so we check periodically
IMPORT_STARTED=false
while [ $ELAPSED -lt $MAX_WAIT ]; do
    # Check for recent import operations (within last hour)
    RECENT_OPS=$(gcloud firestore operations list \
        --project="$DEV_PROJECT_ID" \
        --filter="done:true AND startTime>=-PT1H" \
        --limit=1 \
        --format="value(done)" 2>/dev/null)
    
    if [ "$RECENT_OPS" = "True" ]; then
        echo "   ✅ Import operation completed!"
        break
    fi
    
    if [ "$IMPORT_STARTED" = false ]; then
        echo "   ⏳ Import started, waiting for completion..."
        IMPORT_STARTED=true
    fi
    
    sleep $WAIT_INTERVAL
    ELAPSED=$((ELAPSED + WAIT_INTERVAL))
    echo "   Waiting... (${ELAPSED}s elapsed)"
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo "   ⚠️  Timeout reached. Check import status manually:"
    echo "      gcloud firestore operations list --project=$DEV_PROJECT_ID"
fi

echo ""
echo "✅ Restore Complete!"
echo "==================="
echo ""
echo "📊 Summary:"
echo "   Firestore imported from: $FIRESTORE_PATH"
echo "   Storage synced from: $STORAGE_PATH"
echo "   Dev users: PRESERVED (not overwritten)"
echo ""
echo "💡 Next steps:"
echo "   1. Verify Firestore import completed:"
echo "      gcloud firestore operations list --project=$DEV_PROJECT_ID"
echo "   2. Test Dev environment to ensure data is correct"
echo "   3. Verify Dev users can still log in"
echo ""

