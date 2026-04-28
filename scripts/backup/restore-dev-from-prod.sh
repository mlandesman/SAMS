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

REMAP_STATE_DIR="$(mktemp -d)"
DEV_EMAIL_MAP_FILE="$REMAP_STATE_DIR/dev-email-to-uid.json"
PROD_UID_MAP_FILE="$REMAP_STATE_DIR/prod-uid-to-email.json"

cleanup_remap_state() {
    rm -rf "$REMAP_STATE_DIR"
}
trap cleanup_remap_state EXIT

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

# Step 4: Save Dev users before import
# Full export imports ALL collections (including users) — Firestore full exports
# cannot be filtered with --collection-ids on import. We protect dev users by
# saving them first, then restoring after import.
echo "👥 Step 3: Saving Dev users to temporary backup..."
DEV_USERS_BACKUP="gs://${BUCKET_NAME}/dev/users_backup_$(date +%Y%m%d_%H%M%S)"
echo "   Exporting to: $DEV_USERS_BACKUP"

gcloud firestore export "$DEV_USERS_BACKUP" \
    --project="$DEV_PROJECT_ID" \
    --collection-ids="users"

echo "   ✅ Dev users saved"
echo ""

echo "🗺️  Step 3b: Capturing pre-flight Dev email→UID map..."
node "$SCRIPT_DIR/remap-dev-user-links.js" export-email-to-uid --out="$DEV_EMAIL_MAP_FILE"
echo "   ✅ Pre-flight map captured: $DEV_EMAIL_MAP_FILE"
echo ""

# Step 5: Purge Dev client data and auditLogs before import
echo "🗑️  Step 4: Purging Dev data before import..."
echo "   This ensures deleted Prod documents don't persist in Dev"
echo ""

# NOTE: Leave exchangeRates (auto-synced) and system (environment-specific)
for COLLECTION in "clients" "auditLogs"; do
    echo "   Deleting $COLLECTION..."
    firebase firestore:delete "$COLLECTION" -r --project "$DEV_PROJECT_ID" --force 2>/dev/null || \
        echo "   ⚠️  $COLLECTION may not exist (OK if first restore)"
done

echo "   ✅ Dev data purged"
echo ""

# Step 6: Import Firestore (full export — includes users from prod)
echo "📦 Step 5: Importing Firestore from Prod backup..."
echo "   Importing from: $FIRESTORE_PATH"
echo "   Target project: $DEV_PROJECT_ID"
echo "   ⚠️  This imports ALL collections (users will be restored in a later step)"

IMPORT_OUTPUT=$(gcloud firestore import "$FIRESTORE_PATH" \
    --project="$DEV_PROJECT_ID" \
    --async 2>&1)

echo "$IMPORT_OUTPUT"

# Extract the specific operation name so we can track THIS import, not any random operation
IMPORT_OP_NAME=$(echo "$IMPORT_OUTPUT" | grep "^name:" | sed 's/name: //')

if [ -z "$IMPORT_OP_NAME" ]; then
    echo "   ⚠️  Could not capture import operation name from output."
    echo "   Check manually: gcloud firestore operations list --project=$DEV_PROJECT_ID"
    echo ""
    echo "   After import completes, run these commands to restore Dev users:"
    echo "     firebase firestore:delete users -r --project $DEV_PROJECT_ID --force"
    echo "     gcloud firestore import $DEV_USERS_BACKUP --project=$DEV_PROJECT_ID --collection-ids=users"
    exit 1
fi

echo ""
echo "   ⏳ Tracking import operation: $(basename "$IMPORT_OP_NAME")"
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

# Step 8: Wait for Firestore import by polling the SPECIFIC operation
echo "⏳ Step 7: Waiting for Firestore import to complete..."
echo "   (This may take 5-10 minutes for large databases)"
echo ""

MAX_WAIT=900
WAIT_INTERVAL=30
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
    OP_DONE=$(gcloud firestore operations describe "$IMPORT_OP_NAME" \
        --project="$DEV_PROJECT_ID" \
        --format="value(done)" 2>/dev/null)

    if [ "$OP_DONE" = "True" ]; then
        echo "   ✅ Import operation completed!"
        break
    fi

    sleep $WAIT_INTERVAL
    ELAPSED=$((ELAPSED + WAIT_INTERVAL))
    echo "   ⏳ Waiting... (${ELAPSED}s elapsed)"
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo "   ⚠️  Timeout reached (${MAX_WAIT}s). Import may still be running."
    echo ""
    echo "   Check status:  gcloud firestore operations describe $IMPORT_OP_NAME --project=$DEV_PROJECT_ID"
    echo ""
    echo "   ⚠️  Users have NOT been restored yet. After import completes, run:"
    echo "     firebase firestore:delete users -r --project $DEV_PROJECT_ID --force"
    echo "     gcloud firestore import $DEV_USERS_BACKUP --project=$DEV_PROJECT_ID --collection-ids=users"
    echo ""
    exit 0
fi

# Step 8: Capture imported Prod UID→email map (before deleting users)
echo ""
echo "🗺️  Step 8: Capturing imported Prod UID→email map..."
node "$SCRIPT_DIR/remap-dev-user-links.js" export-uid-to-email --out="$PROD_UID_MAP_FILE"
echo "   ✅ Prod map captured: $PROD_UID_MAP_FILE"
echo ""

# Step 9: Replace imported Prod users with saved Dev users
echo ""
echo "👥 Step 9: Restoring Dev users..."
echo "   Deleting Prod users that were imported..."
firebase firestore:delete "users" -r --project "$DEV_PROJECT_ID" --force 2>/dev/null || true

echo "   Re-importing saved Dev users from: $DEV_USERS_BACKUP"
gcloud firestore import "$DEV_USERS_BACKUP" \
    --project="$DEV_PROJECT_ID" \
    --collection-ids="users"

echo "   ✅ Dev users restored"
echo ""

# Step 10: Remap stale user links in unit contacts
echo "🔗 Step 10: Remapping unit owner/manager user links..."
node "$SCRIPT_DIR/remap-dev-user-links.js" remap-unit-contacts \
    --prod-uid-map="$PROD_UID_MAP_FILE" \
    --dev-email-map="$DEV_EMAIL_MAP_FILE" \
    --execute
echo "   ✅ Unit contact links remapped"
echo ""

echo ""
echo "✅ Restore Complete!"
echo "==================="
echo ""
echo "📊 Summary:"
echo "   Firestore imported from: $FIRESTORE_PATH"
echo "   Storage synced from: $STORAGE_PATH"
echo "   Dev users: SAVED → RESTORED from $DEV_USERS_BACKUP"
echo ""
echo "💡 Next steps:"
echo "   1. Test Dev environment to ensure data is correct"
echo "   2. Verify Dev users can still log in"
echo "   3. Verify unit owner/manager names load in Water Bills and HOA views"
echo ""

