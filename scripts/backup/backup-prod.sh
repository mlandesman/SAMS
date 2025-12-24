#!/bin/bash

# SAMS Production Backup Script
# Exports Firestore (all collections) to GCS
# Syncs Firebase Storage to GCS
# Creates manifest with timestamp
# Usage: ./backup-prod.sh [--tag=nightly|manual|pre-deploy]

set -e

# Configuration
PROJECT_ID="sams-sandyland-prod"
BUCKET_NAME="sams-shared-backups"
STORAGE_BUCKET="sams-sandyland-prod.firebasestorage.app"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISCOVER_SCRIPT="$SCRIPT_DIR/discover-collections.js"
SERVICE_ACCOUNT="$SCRIPT_DIR/../../functions/serviceAccountKey-prod.json"

# Parse arguments
TAG="manual"
for arg in "$@"; do
    case $arg in
        --tag=*)
            TAG="${arg#*=}"
            shift
            ;;
        *)
            echo "⚠️  Unknown argument: $arg"
            ;;
    esac
done

# Validate tag
if [[ ! "$TAG" =~ ^(nightly|manual|pre-deploy)$ ]]; then
    echo "❌ Invalid tag: $TAG. Must be one of: nightly, manual, pre-deploy"
    exit 1
fi

# Generate backup date/time
BACKUP_DATE=$(date +%Y-%m-%d)
BACKUP_TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
BACKUP_PREFIX="${BACKUP_DATE}_${TAG}"

# Paths
FIRESTORE_BASE="gs://${BUCKET_NAME}/firestore/${BACKUP_PREFIX}"
STORAGE_BASE="gs://${BUCKET_NAME}/storage/${BACKUP_DATE}"
MANIFEST_PATH="gs://${BUCKET_NAME}/manifests/${BACKUP_PREFIX}.json"

echo "🔄 SAMS Production Backup"
echo "========================"
echo ""
echo "Project: $PROJECT_ID"
echo "Tag: $TAG"
echo "Date: $BACKUP_DATE"
echo "Timestamp: $BACKUP_TIMESTAMP"
echo ""

# Step 1: Discover collections dynamically
echo "📋 Step 1: Discovering Firestore collections..."
if [ ! -f "$DISCOVER_SCRIPT" ]; then
    echo "❌ Collection discovery script not found: $DISCOVER_SCRIPT"
    exit 1
fi

# Run discovery script and capture JSON output (last line is JSON)
DISCOVERY_OUTPUT=$(node "$DISCOVER_SCRIPT" "$PROJECT_ID" "$SERVICE_ACCOUNT" 2>&1)
COLLECTIONS_JSON=$(echo "$DISCOVERY_OUTPUT" | tail -1)

# Show human-readable output (everything except last line)
# macOS head doesn't support -n -1, so use sed instead
echo "$DISCOVERY_OUTPUT" | sed '$d'

# Parse JSON to extract collections
if [ -z "$COLLECTIONS_JSON" ] || ! echo "$COLLECTIONS_JSON" | grep -q '{'; then
    echo "❌ Failed to discover collections - invalid JSON output"
    echo "   Output: $COLLECTIONS_JSON"
    exit 1
fi

# Extract collections (excluding users)
COLLECTIONS=$(echo "$COLLECTIONS_JSON" | node -e "
try {
  const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
  if (data.excludeUsers && data.excludeUsers.length > 0) {
    console.log(data.excludeUsers.join(','));
  } else {
    console.log('clients'); // Fallback
  }
} catch (e) {
  console.error('Error parsing JSON:', e.message);
  process.exit(1);
}
")

if [ -z "$COLLECTIONS" ]; then
    echo "⚠️  No collections found (excluding users). Using fallback list."
    COLLECTIONS="clients"
fi

echo "   Collections to backup: $COLLECTIONS"
echo ""

# Step 2: Export Firestore (all collections except users)
# CRITICAL: --collection-ids only exports top-level collections, NOT subcollections
# To get subcollections like clients/AVII/transactions, we need to export collection GROUPS
# Collection groups: transactions, units, categories, etc. (not clients/AVII/transactions)
# So we export everything (no --collection-ids) to get all data including subcollections
echo "📦 Step 2: Exporting Firestore (all data including subcollections)..."
ALL_COLLECTIONS_PATH="${FIRESTORE_BASE}/all_collections"

echo "   Exporting to: $ALL_COLLECTIONS_PATH"
echo "   Exporting ALL data (no --collection-ids) to include subcollections"
echo "   This captures: clients, transactions, units, categories, vendors, etc."
echo "   Note: Users will be included but exported separately in Step 3"

# Export everything - this includes users, but we'll export users separately too
# On restore, we'll import the "all" export which overwrites everything including users
# For Dev restore, users will be overwritten (which is acceptable for Dev environment)
gcloud firestore export "$ALL_COLLECTIONS_PATH" \
    --project="$PROJECT_ID" \
    --async

echo "   ⏳ Firestore export started (async operation)"
echo "   💡 Use 'gcloud firestore operations list' to check status"
echo ""

# Step 3: Export users collection separately
echo "👥 Step 3: Exporting users collection separately..."
USERS_PATH="${FIRESTORE_BASE}/users_only"

echo "   Exporting to: $USERS_PATH"
gcloud firestore export "$USERS_PATH" \
    --project="$PROJECT_ID" \
    --collection-ids="users" \
    --async

echo "   ⏳ Users export started (async operation)"
echo ""

# Step 4: Sync Firebase Storage
echo "📁 Step 4: Syncing Firebase Storage..."
echo "   Source: gs://${STORAGE_BUCKET}/"
echo "   Destination: ${STORAGE_BASE}/"

# Count files before sync
FILES_BEFORE=$(gsutil ls -r "gs://${STORAGE_BUCKET}/" 2>/dev/null | wc -l | tr -d ' ')

# Sync storage
gsutil -m rsync -r "gs://${STORAGE_BUCKET}/" "${STORAGE_BASE}/"

# Count files after sync
FILES_AFTER=$(gsutil ls -r "${STORAGE_BASE}/" 2>/dev/null | wc -l | tr -d ' ')

# Calculate size
STORAGE_SIZE_MB=$(gsutil du -s "${STORAGE_BASE}/" 2>/dev/null | awk '{print int($1/1024/1024)}')

echo "   ✅ Storage sync complete"
echo "   Files synced: $FILES_AFTER"
echo "   Size: ~${STORAGE_SIZE_MB} MB"
echo ""

# Step 5: Wait for Firestore exports to complete
echo "⏳ Step 5: Waiting for Firestore exports to complete..."
echo "   Checking export status..."

# Wait up to 10 minutes for exports
MAX_WAIT=600
WAIT_INTERVAL=10
ELAPSED=0

check_export_status() {
    local operation_name="$1"
    gcloud firestore operations list \
        --project="$PROJECT_ID" \
        --filter="name:${operation_name}" \
        --format="value(done)" 2>/dev/null | head -1
}

# Note: We can't easily get operation names from async exports
# So we'll check if the export directories exist and have content
wait_for_export() {
    local export_path="$1"
    local max_wait="$2"
    local elapsed=0
    
    while [ $elapsed -lt $max_wait ]; do
        if gsutil ls "${export_path}/" >/dev/null 2>&1; then
            # Check if export has actual data (not just metadata)
            local file_count=$(gsutil ls -r "${export_path}/" 2>/dev/null | wc -l | tr -d ' ')
            if [ "$file_count" -gt 1 ]; then
                return 0
            fi
        fi
        sleep 10
        elapsed=$((elapsed + 10))
        echo "   Waiting... (${elapsed}s elapsed)"
    done
    
    return 1
}

if wait_for_export "$ALL_COLLECTIONS_PATH" 600; then
    echo "   ✅ All collections export complete"
else
    echo "   ⚠️  All collections export may still be in progress (check manually)"
fi

if wait_for_export "$USERS_PATH" 600; then
    echo "   ✅ Users export complete"
else
    echo "   ⚠️  Users export may still be in progress (check manually)"
fi

echo ""

# Step 6: Create manifest
echo "📝 Step 6: Creating manifest file..."

# Create manifest JSON
MANIFEST_JSON=$(cat <<EOF
{
  "timestamp": "$BACKUP_TIMESTAMP",
  "tag": "$TAG",
  "firestore": {
    "all_collections": "$ALL_COLLECTIONS_PATH",
    "users_only": "$USERS_PATH"
  },
  "storage": {
    "path": "$STORAGE_BASE",
    "files_count": $FILES_AFTER,
    "total_size_mb": $STORAGE_SIZE_MB
  },
  "source_project": "$PROJECT_ID",
  "collections_backed_up": "$COLLECTIONS"
}
EOF
)

# Write manifest to temp file then upload
TEMP_MANIFEST=$(mktemp)
echo "$MANIFEST_JSON" > "$TEMP_MANIFEST"
gsutil cp "$TEMP_MANIFEST" "$MANIFEST_PATH"
rm "$TEMP_MANIFEST"

echo "   ✅ Manifest created: $MANIFEST_PATH"
echo ""

# Summary
echo "✅ Backup Complete!"
echo "==================="
echo ""
echo "📊 Summary:"
echo "   Firestore (all collections): $ALL_COLLECTIONS_PATH"
echo "   Firestore (users only): $USERS_PATH"
echo "   Storage: $STORAGE_BASE"
echo "   Manifest: $MANIFEST_PATH"
echo "   Files: $FILES_AFTER"
echo "   Size: ~${STORAGE_SIZE_MB} MB"
echo ""
echo "💡 Next steps:"
echo "   - Verify backup: ./list-backups.sh"
echo "   - Restore to dev: ./restore-dev-from-prod.sh --backup=$BACKUP_DATE"
echo ""

