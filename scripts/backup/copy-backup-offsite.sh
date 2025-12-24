#!/bin/bash

# SAMS Backup Off-Site Copy Script
# Copies backups to local storage or alternative cloud storage (Google Drive/S3)
# Usage: ./copy-backup-offsite.sh [--backup=latest|YYYY-MM-DD] [--destination=local|drive|s3] [--compress]

set -e

# Configuration
BUCKET_NAME="sams-shared-backups"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_LOCAL_DIR="${HOME}/SAMS-Backups"

# Parse arguments
# Initialize variables (unset first to avoid environment variable conflicts)
unset BACKUP_DATE BACKUP_PREFIX DESTINATION COMPRESS LOCAL_DIR
BACKUP_DATE=""
BACKUP_PREFIX=""
DESTINATION="local"
COMPRESS=false
LOCAL_DIR=""

for arg in "$@"; do
    case $arg in
        --backup=*)
            # Extract value after = sign
            BACKUP_DATE="${arg#*=}"
            # Trim any whitespace
            BACKUP_DATE=$(echo "$BACKUP_DATE" | xargs)
            shift
            ;;
        --backup-prefix=*)
            # Allow passing full backup prefix directly (e.g., 2025-12-23_1501_manual)
            BACKUP_PREFIX="${arg#*=}"
            BACKUP_PREFIX=$(echo "$BACKUP_PREFIX" | xargs)
            shift
            ;;
        --destination=*)
            DESTINATION="${arg#*=}"
            shift
            ;;
        --compress)
            COMPRESS=true
            shift
            ;;
        --local-dir=*)
            LOCAL_DIR="${arg#*=}"
            shift
            ;;
        *)
            echo "⚠️  Unknown argument: $arg"
            ;;
    esac
done

# Validate destination
if [[ ! "$DESTINATION" =~ ^(local|drive|s3)$ ]]; then
    echo "❌ Invalid destination: $DESTINATION"
    echo "   Must be one of: local, drive, s3"
    exit 1
fi

echo "📦 SAMS Backup Off-Site Copy"
echo "============================"
echo ""
echo "Destination: $DESTINATION"
echo ""

# Step 1: Find backup
echo "📋 Step 1: Finding backup..."

# If backup prefix was provided directly, use it
if [ -n "$BACKUP_PREFIX" ]; then
    MANIFEST_PATH="gs://${BUCKET_NAME}/manifests/${BACKUP_PREFIX}.json"
    if ! gsutil ls "$MANIFEST_PATH" >/dev/null 2>&1; then
        echo "❌ Backup prefix not found: $BACKUP_PREFIX"
        exit 1
    fi
    BACKUP_DATE=$(echo "$BACKUP_PREFIX" | sed 's/_.*//')
    echo "   ✅ Using backup prefix: $BACKUP_PREFIX"
elif [ -z "$BACKUP_DATE" ] || [ "$BACKUP_DATE" = "latest" ]; then
    # Handle common typos
    if [ "$BACKUP_DATE" = "lastest" ]; then
        echo "   ⚠️  Did you mean 'latest'? Using 'latest'..."
        BACKUP_DATE="latest"
    fi
    
    echo "   Searching for latest backup..."
    
    LATEST_MANIFEST=$(gsutil ls "gs://${BUCKET_NAME}/manifests/" 2>/dev/null | sort -r | head -1)
    
    if [ -z "$LATEST_MANIFEST" ]; then
        echo "❌ No backups found"
        exit 1
    fi
    
    BACKUP_DATE=$(basename "$LATEST_MANIFEST" .json | cut -d'_' -f1)
    BACKUP_PREFIX=$(basename "$LATEST_MANIFEST" .json)
    echo "   ✅ Found latest backup: $BACKUP_DATE"
else
    # Handle common typos
    if [ "$BACKUP_DATE" = "lastest" ]; then
        echo "   ⚠️  Did you mean 'latest'? Using 'latest'..."
        BACKUP_DATE="latest"
    fi
    
    # Handle timestamp format (YYYY-MM-DD-HHMM) by converting to underscore format
    BACKUP_DATE_SEARCH=$(echo "$BACKUP_DATE" | sed 's/-/_/g')
    
    # Try with converted format first
    BACKUP_PREFIX=$(gsutil ls "gs://${BUCKET_NAME}/manifests/${BACKUP_DATE_SEARCH}"*".json" 2>/dev/null | head -1 | xargs -I {} basename {} .json 2>/dev/null)
    
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
        echo ""
        echo "💡 Tip: Use 'latest' to get the most recent backup, or specify full date: YYYY-MM-DD"
        exit 1
    fi
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

# Extract paths
FIRESTORE_ALL_PATH=$(cat "$TEMP_MANIFEST" | grep -o '"all_collections": "[^"]*"' | cut -d'"' -f4)
FIRESTORE_USERS_PATH=$(cat "$TEMP_MANIFEST" | grep -o '"users_only": "[^"]*"' | cut -d'"' -f4)
STORAGE_PATH=$(cat "$TEMP_MANIFEST" | grep -o '"path": "[^"]*"' | cut -d'"' -f4)
BACKUP_TIMESTAMP=$(cat "$TEMP_MANIFEST" | grep -o '"timestamp": "[^"]*"' | cut -d'"' -f4)
SOURCE_PROJECT=$(cat "$TEMP_MANIFEST" | grep -o '"source_project": "[^"]*"' | cut -d'"' -f4)

if [ -z "$FIRESTORE_ALL_PATH" ] || [ -z "$STORAGE_PATH" ]; then
    echo "❌ Invalid manifest format"
    rm "$TEMP_MANIFEST"
    exit 1
fi

echo "   Backup: $BACKUP_DATE"
echo "   Timestamp: $BACKUP_TIMESTAMP"
echo "   Source: $SOURCE_PROJECT"
echo "   Firestore (all): $FIRESTORE_ALL_PATH"
echo "   Firestore (users): $FIRESTORE_USERS_PATH"
echo "   Storage: $STORAGE_PATH"
rm "$TEMP_MANIFEST"

# Step 3: Copy based on destination
echo ""
case "$DESTINATION" in
    local)
        echo "💾 Step 3: Copying to local storage..."
        
        if [ -z "$LOCAL_DIR" ]; then
            LOCAL_DIR="$DEFAULT_LOCAL_DIR"
        fi
        
        BACKUP_DIR="${LOCAL_DIR}/${BACKUP_PREFIX}"
        mkdir -p "$BACKUP_DIR"
        
        echo "   Destination: $BACKUP_DIR"
        echo ""
        
        # Copy manifest
        echo "   Copying manifest..."
        gsutil cp "$MANIFEST_PATH" "${BACKUP_DIR}/manifest.json"
        
        # Copy Firestore exports
        echo "   Copying Firestore exports (this may take a while)..."
        echo "      All collections..."
        mkdir -p "${BACKUP_DIR}/firestore_all_collections"
        gsutil -m rsync -r "${FIRESTORE_ALL_PATH}" "${BACKUP_DIR}/firestore_all_collections"
        
        # Check if users_only path exists before copying
        if gsutil ls "${FIRESTORE_USERS_PATH}" >/dev/null 2>&1; then
            echo "      Users collection..."
            mkdir -p "${BACKUP_DIR}/firestore_users_only"
            gsutil -m rsync -r "${FIRESTORE_USERS_PATH}" "${BACKUP_DIR}/firestore_users_only"
        else
            echo "      Users collection... (not found, skipping)"
        fi
        
        # Copy Storage
        echo "   Copying Storage files..."
        mkdir -p "${BACKUP_DIR}/storage"
        gsutil -m rsync -r "${STORAGE_PATH}" "${BACKUP_DIR}/storage"
        
        echo ""
        echo "✅ Local copy complete!"
        echo "   Location: $BACKUP_DIR"
        
        # Compress if requested
        if [ "$COMPRESS" = true ]; then
            echo ""
            echo "🗜️  Step 4: Compressing backup..."
            COMPRESSED_FILE="${LOCAL_DIR}/${BACKUP_PREFIX}.tar.gz"
            cd "$LOCAL_DIR"
            tar -czf "$COMPRESSED_FILE" "$BACKUP_PREFIX"
            echo "   ✅ Compressed to: $COMPRESSED_FILE"
            
            # Show size
            SIZE=$(du -h "$COMPRESSED_FILE" | cut -f1)
            echo "   Size: $SIZE"
            
            # Optionally remove uncompressed directory
            echo ""
            read -p "   Remove uncompressed directory? (y/N): " REMOVE_DIR
            if [[ "$REMOVE_DIR" =~ ^[Yy]$ ]]; then
                rm -rf "${BACKUP_DIR}"
                echo "   ✅ Removed uncompressed directory"
            fi
        fi
        
        echo ""
        echo "📊 Summary:"
        echo "   Backup: $BACKUP_PREFIX"
        echo "   Location: $BACKUP_DIR"
        if [ "$COMPRESS" = true ]; then
            echo "   Compressed: $COMPRESSED_FILE"
        fi
        ;;
        
    drive)
        echo "☁️  Step 3: Copying to Google Drive..."
        echo ""
        
        # Check for rclone
        if ! command -v rclone &> /dev/null; then
            echo "❌ rclone not found"
            echo "   Install: brew install rclone"
            echo "   Configure: rclone config"
            exit 1
        fi
        
        # Check for configured remotes
        RCLONE_REMOTES=$(rclone listremotes 2>/dev/null)
        if [ -z "$RCLONE_REMOTES" ]; then
            echo "❌ No rclone remotes configured"
            echo "   Configure: rclone config"
            exit 1
        fi
        
        # Try to find Sandyland_GDrive remote, or prompt for remote name
        RCLONE_REMOTE=""
        if echo "$RCLONE_REMOTES" | grep -q "Sandyland_GDrive"; then
            RCLONE_REMOTE="Sandyland_GDrive"
            echo "   ✅ Found remote: $RCLONE_REMOTE"
        else
            echo "Available rclone remotes:"
            echo "$RCLONE_REMOTES" | sed 's/^/   /'
            echo ""
            read -p "Enter remote name (e.g., Sandyland_GDrive): " RCLONE_REMOTE
            
            if [ -z "$RCLONE_REMOTE" ]; then
                echo "❌ Remote name required"
                exit 1
            fi
            
            # Verify remote exists
            if ! echo "$RCLONE_REMOTES" | grep -q "^${RCLONE_REMOTE}:$"; then
                echo "❌ Remote '$RCLONE_REMOTE' not found"
                exit 1
            fi
        fi
        
        DRIVE_PATH="${RCLONE_REMOTE}:SAMS-Backups/${BACKUP_PREFIX}"
        
        echo ""
        echo "   Copying to: ${DRIVE_PATH}/"
        echo "   (This may take a while...)"
        echo ""
        
        # Create temp directory for staging
        TEMP_DIR=$(mktemp -d)
        echo "   Staging files locally..."
        
        # Copy manifest
        echo "   Copying manifest..."
        gsutil cp "$MANIFEST_PATH" "$TEMP_DIR/manifest.json"
        
        # Copy Firestore exports
        echo "   Copying Firestore exports..."
        echo "      All collections..."
        mkdir -p "$TEMP_DIR/firestore_all_collections"
        gsutil -m rsync -r "${FIRESTORE_ALL_PATH}" "$TEMP_DIR/firestore_all_collections"
        
        # Check if users_only path exists before copying
        if gsutil ls "${FIRESTORE_USERS_PATH}" >/dev/null 2>&1; then
            echo "      Users collection..."
            mkdir -p "$TEMP_DIR/firestore_users_only"
            gsutil -m rsync -r "${FIRESTORE_USERS_PATH}" "$TEMP_DIR/firestore_users_only"
        else
            echo "      Users collection... (not found, skipping)"
        fi
        
        # Copy Storage
        echo "   Copying Storage files..."
        mkdir -p "$TEMP_DIR/storage"
        gsutil -m rsync -r "${STORAGE_PATH}" "$TEMP_DIR/storage"
        
        # Upload to Google Drive using rclone
        echo ""
        echo "   Uploading to Google Drive..."
        rclone copy "$TEMP_DIR/" "${DRIVE_PATH}/" --progress
        
        # Cleanup temp directory
        rm -rf "$TEMP_DIR"
        
        echo ""
        echo "✅ Backup uploaded to Google Drive!"
        echo "   Location: ${DRIVE_PATH}/"
        ;;
        
    s3)
        echo "☁️  Step 3: Copying to AWS S3..."
        echo ""
        
        # Check for AWS CLI
        if ! command -v aws &> /dev/null; then
            echo "❌ AWS CLI not found"
            echo "   Install: https://aws.amazon.com/cli/"
            echo "   Configure: aws configure"
            exit 1
        fi
        
        # Prompt for S3 bucket
        echo -n "Enter S3 bucket name (e.g., sams-backups): "
        read S3_BUCKET
        
        if [ -z "$S3_BUCKET" ]; then
            echo "❌ S3 bucket name required"
            exit 1
        fi
        
        S3_PREFIX="sams-backups/${BACKUP_PREFIX}"
        
        echo ""
        echo "   Copying to: s3://${S3_BUCKET}/${S3_PREFIX}/"
        echo "   (This may take a while...)"
        echo ""
        
        # Copy manifest
        echo "   Copying manifest..."
        TEMP_MANIFEST=$(mktemp)
        gsutil cp "$MANIFEST_PATH" "$TEMP_MANIFEST"
        aws s3 cp "$TEMP_MANIFEST" "s3://${S3_BUCKET}/${S3_PREFIX}/manifest.json"
        rm "$TEMP_MANIFEST"
        
        # Copy Firestore (download from GCS, upload to S3)
        echo "   Copying Firestore exports..."
        echo "      All collections..."
        # Create temp directory for download
        TEMP_DIR=$(mktemp -d)
        gsutil -m cp -r "$FIRESTORE_ALL_PATH" "$TEMP_DIR/firestore_all_collections/"
        aws s3 sync "$TEMP_DIR/firestore_all_collections/" "s3://${S3_BUCKET}/${S3_PREFIX}/firestore_all_collections/"
        
        # Check if users_only path exists before copying
        if gsutil ls "${FIRESTORE_USERS_PATH}" >/dev/null 2>&1; then
            echo "      Users collection..."
            gsutil -m cp -r "$FIRESTORE_USERS_PATH" "$TEMP_DIR/firestore_users_only/"
            aws s3 sync "$TEMP_DIR/firestore_users_only/" "s3://${S3_BUCKET}/${S3_PREFIX}/firestore_users_only/"
        else
            echo "      Users collection... (not found, skipping)"
        fi
        
        # Copy Storage
        echo "   Copying Storage files..."
        gsutil -m cp -r "$STORAGE_PATH" "$TEMP_DIR/storage/"
        aws s3 sync "$TEMP_DIR/storage/" "s3://${S3_BUCKET}/${S3_PREFIX}/storage/"
        
        # Cleanup temp directory
        rm -rf "$TEMP_DIR"
        
        echo ""
        echo "✅ S3 copy complete!"
        echo "   Location: s3://${S3_BUCKET}/${S3_PREFIX}/"
        ;;
esac

echo ""
echo "💡 Safety Note:"
echo "   Your backup is now stored in a different location/service"
echo "   This provides protection against GCS service-wide issues"
echo ""

