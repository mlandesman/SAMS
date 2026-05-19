#!/bin/bash

# SAMS Production Disaster Recovery Script
# Restores Production from backup (INCLUDING users)
# Entry: scripts/backup/backup-menu.sh option 6, or run this script directly.
# (No scripts/sams_backup.sh — see test-results/restore-path-comparison-2026-05-19.md D3 #1)
# Usage: ./restore-prod.sh --backup=YYYY-MM-DD [--confirm] [--project=PROJECT_ID]

set -e

# Configuration
DEFAULT_PROD_PROJECT_ID="sams-sandyland-prod"
PROD_PROJECT_ID="$DEFAULT_PROD_PROJECT_ID"
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
        --project=*)
            PROD_PROJECT_ID="${arg#*=}"
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
    echo "Usage: ./restore-prod.sh --backup=YYYY-MM-DD [--confirm] [--project=PROJECT_ID]"
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

if [ "$PROD_PROJECT_ID" != "$DEFAULT_PROD_PROJECT_ID" ]; then
    echo "⚠️  Non-default target project: $PROD_PROJECT_ID"
    echo "   Intended for DR drill / smoke test only."
    echo ""
fi

echo "🚨 SAMS Production Disaster Recovery"
echo "===================================="
echo ""
echo "⚠️  CRITICAL WARNING:"
echo "   This restores Firestore + Storage from a GCS backup snapshot."
echo "   - Collections are PURGED (clients, auditLogs) then imported (merge for other top-level collections)."
echo "   - Documents created AFTER the backup but outside purged trees may REMAIN."
echo "   - All Storage mirror folders are synced with delete-of-stale (-d)."
echo "   - This operation CANNOT be undone easily!"
echo ""
echo "Backup date: $BACKUP_DATE"
echo "Target project: $PROD_PROJECT_ID"
echo ""

# Find backup prefix
BACKUP_FILE=$(gsutil ls "gs://${BUCKET_NAME}/manifests/${BACKUP_DATE}_*.json" 2>/dev/null | head -1)
BACKUP_PREFIX=$(basename "$BACKUP_FILE" .json)
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
echo "To proceed with restore, you must:"
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
echo "⚠️  Proceeding with restore..."
echo "   This will take several minutes. Do not interrupt!"
echo ""

# Log start time
START_TIME=$(date)
LOG_FILE="$SCRIPT_DIR/restore-prod-$(date +%Y%m%d-%H%M%S).log"
echo "Start time: $START_TIME" | tee "$LOG_FILE"

# Resolve storage bucket from project (Prod vs Dev smoke target)
case "$PROD_PROJECT_ID" in
    "$DEFAULT_PROD_PROJECT_ID")
        TARGET_STORAGE_BUCKET="sams-sandyland-prod.firebasestorage.app"
        ;;
    sandyland-management-system)
        TARGET_STORAGE_BUCKET="sandyland-management-system.firebasestorage.app"
        ;;
    *)
        TARGET_STORAGE_BUCKET="${PROD_PROJECT_ID}.firebasestorage.app"
        ;;
esac

wait_for_import_operation() {
    local op_name="$1"
    local label="$2"
    local max_wait="${3:-1200}"
    local wait_interval="${4:-30}"
    local elapsed=0

    echo "⏳ Waiting for $label..."
    echo "   Operation: $(basename "$op_name")"
    echo "   (This may take 5-10 minutes for large databases)"
    echo ""

    while [ $elapsed -lt $max_wait ]; do
        local op_done
        op_done=$(gcloud firestore operations describe "$op_name" \
            --project="$PROD_PROJECT_ID" \
            --format="value(done)" 2>/dev/null || true)

        if [ "$op_done" = "True" ]; then
            local op_state
            op_state=$(gcloud firestore operations describe "$op_name" \
                --project="$PROD_PROJECT_ID" \
                --format="value(metadata.operationState)" 2>/dev/null || true)
            if [ "$op_state" = "SUCCESSFUL" ] || [ -z "$op_state" ]; then
                echo "   ✅ $label completed successfully!"
                return 0
            fi
            echo "   ❌ $label finished with state: ${op_state:-unknown}"
            echo "      gcloud firestore operations describe $op_name --project=$PROD_PROJECT_ID"
            return 1
        fi

        sleep "$wait_interval"
        elapsed=$((elapsed + wait_interval))
        echo "   ⏳ Waiting... (${elapsed}s elapsed)"
    done

    echo "   ❌ Timeout waiting for $label (${max_wait}s)."
    echo "      gcloud firestore operations describe $op_name --project=$PROD_PROJECT_ID"
    return 1
}

start_import() {
    local import_path="$1"
    local label="$2"
    local collection_ids="${3:-}"

    echo "📦 Importing $label..." >&2
    echo "   From: $import_path" >&2

    local import_output
    if [ -n "$collection_ids" ]; then
        import_output=$(gcloud firestore import "$import_path" \
            --project="$PROD_PROJECT_ID" \
            --collection-ids="$collection_ids" \
            --async 2>&1)
    else
        import_output=$(gcloud firestore import "$import_path" \
            --project="$PROD_PROJECT_ID" \
            --async 2>&1)
    fi

    echo "$import_output" >&2

    local op_name
    op_name=$(echo "$import_output" | grep "^name:" | sed 's/name: //')
    if [ -z "$op_name" ]; then
        echo "   ❌ Could not capture import operation name for $label." >&2
        return 1
    fi

    echo "$op_name"
}

# Step 1: Pre-flight snapshot (D3 #9 — rollback reference)
echo "💾 Step 1: Pre-flight Firestore snapshot..."
PREFLIGHT_BACKUP="gs://${BUCKET_NAME}/prod/preflight_${BACKUP_PREFIX}_$(date +%Y%m%d_%H%M%S)"
echo "   Exporting to: $PREFLIGHT_BACKUP"

gcloud firestore export "$PREFLIGHT_BACKUP" \
    --project="$PROD_PROJECT_ID" \
    --async

echo "   ⏳ Pre-flight export started (async — does not block restore)"
echo "   💡 Rollback reference if restore fails: $PREFLIGHT_BACKUP"
echo ""

# Step 2: Purge before import (D3 #2, #3, #4, #12, #13 — parity with restore-dev-from-prod.sh)
echo "🗑️  Step 2: Purging Firestore data before import..."
echo "   Ensures post-backup documents under purged trees do not persist (import merge semantics)."
echo ""

# D3 #4: same scope as Dev — leave exchangeRates / systemConfig
for COLLECTION in "clients" "auditLogs"; do
    echo "   Deleting $COLLECTION (recursive)..."
    firebase firestore:delete "$COLLECTION" -r --project "$PROD_PROJECT_ID" --force 2>/dev/null || \
        echo "   ⚠️  $COLLECTION may not exist (OK if empty)"
done

echo "   ✅ Purge complete"
echo ""

# Step 3: Import all collections, wait (D3 #5, #7, #8, #14 — sequential, tracked op)
if ! ALL_IMPORT_OP=$(start_import "$FIRESTORE_ALL_PATH" "all collections"); then
    echo "❌ Failed to start all-collections import."
    exit 1
fi

if ! wait_for_import_operation "$ALL_IMPORT_OP" "all-collections import"; then
    echo "❌ Restore aborted: all-collections import did not complete."
    exit 1
fi

echo ""

# Step 4: Import users collection separately (D3 #5 — sequential, not concurrent)
if [ -n "$FIRESTORE_USERS_PATH" ]; then
    if ! USERS_IMPORT_OP=$(start_import "$FIRESTORE_USERS_PATH" "users collection" "users"); then
        echo "❌ Failed to start users import."
        exit 1
    fi

    if ! wait_for_import_operation "$USERS_IMPORT_OP" "users import"; then
        echo "❌ Restore aborted: users import did not complete."
        exit 1
    fi
    echo ""
else
    echo "⚠️  No users_only path in manifest; skipping separate users import."
    echo ""
fi

# Step 5: Sync Storage after Firestore completes (D3 #6, #14)
echo "📁 Step 5: Syncing Storage files (after Firestore imports)..."
echo "   Source: $STORAGE_PATH"
echo "   Destination: gs://${TARGET_STORAGE_BUCKET}/"

for FOLDER in clients icons logos; do
    echo "   Syncing $FOLDER/ (with delete of stale files)..."
    gsutil -m rsync -r -d "$STORAGE_PATH/$FOLDER/" "gs://${TARGET_STORAGE_BUCKET}/$FOLDER/" 2>/dev/null || \
        echo "   ⚠️  $FOLDER/ missing in backup or destination (skipped)"
done

echo "   Syncing imports/ (additive only)..."
gsutil -m rsync -r "$STORAGE_PATH/imports/" "gs://${TARGET_STORAGE_BUCKET}/imports/" 2>/dev/null || true

echo "   ✅ Storage sync complete"
echo ""

echo "✅ Restore Complete!"
echo "==================="
echo ""
echo "📊 Summary:"
echo "   Target project: $PROD_PROJECT_ID"
echo "   Pre-flight snapshot: $PREFLIGHT_BACKUP"
echo "   Firestore (all) imported from: $FIRESTORE_ALL_PATH"
if [ -n "$FIRESTORE_USERS_PATH" ]; then
    echo "   Firestore (users) imported from: $FIRESTORE_USERS_PATH"
fi
echo "   Storage synced from: $STORAGE_PATH"
echo "   Restore started: $START_TIME"
echo ""
echo "💡 Verification (D3 #11 — run manually on target project):"
echo "   gcloud firestore operations list --project=$PROD_PROJECT_ID --limit=5"
echo "   gsutil ls gs://${TARGET_STORAGE_BUCKET}/clients/ | head"
echo "   Firebase Console → Firestore → spot-check clients/{MTC,AVII}"
echo ""
echo "📝 Log file: $LOG_FILE"
echo ""
