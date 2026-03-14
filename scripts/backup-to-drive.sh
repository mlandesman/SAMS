#!/usr/bin/env bash
#
# scripts/backup-to-drive.sh
#
# Backup SAMS code and critical documents to an external drive.
# Uses rsync with filters to exclude build artifacts, dependencies, and caches.
#
# Usage:
#   bash scripts/backup-to-drive.sh                          # Auto-detect drive
#   bash scripts/backup-to-drive.sh /Volumes/MyDrive         # Explicit drive path
#   bash scripts/backup-to-drive.sh --dry-run                # Preview without copying
#   bash scripts/backup-to-drive.sh /Volumes/MyDrive --dry-run
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_FOLDER="SAMS-Backup"
DRY_RUN=""
DRIVE_PATH=""

# Parse arguments
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN="--dry-run" ;;
    --help|-h)
      echo "Usage: bash scripts/backup-to-drive.sh [DRIVE_PATH] [--dry-run]"
      echo ""
      echo "  DRIVE_PATH   Mount point of external drive (e.g. /Volumes/Data)"
      echo "               If omitted, auto-detects from connected drives."
      echo "  --dry-run    Preview what would be copied without writing."
      echo ""
      echo "Backup destination: DRIVE_PATH/$BACKUP_FOLDER/"
      exit 0
      ;;
    /*)  DRIVE_PATH="$arg" ;;
    *)   echo "❌ Unknown argument: $arg (use --help)"; exit 1 ;;
  esac
done

# Auto-detect external drive if not specified
if [ -z "$DRIVE_PATH" ]; then
  CANDIDATES=()
  for vol in /Volumes/*/; do
    vol="${vol%/}"
    # Skip system volumes
    case "$(basename "$vol")" in
      "Macintosh HD"|"Local TimeMachine"|"TimeMachine Portable") continue ;;
    esac
    if [ -d "$vol" ] && [ -w "$vol" ]; then
      CANDIDATES+=("$vol")
    fi
  done

  if [ ${#CANDIDATES[@]} -eq 0 ]; then
    echo "❌ No writable external drives found in /Volumes/"
    echo "   Connect a drive or specify a path: bash scripts/backup-to-drive.sh /Volumes/DriveName"
    exit 1
  elif [ ${#CANDIDATES[@]} -eq 1 ]; then
    DRIVE_PATH="${CANDIDATES[0]}"
  else
    echo "Multiple external drives found:"
    for i in "${!CANDIDATES[@]}"; do
      echo "  [$((i+1))] ${CANDIDATES[$i]}"
    done
    read -rp "Select drive [1-${#CANDIDATES[@]}]: " choice
    idx=$((choice - 1))
    if [ "$idx" -lt 0 ] || [ "$idx" -ge ${#CANDIDATES[@]} ]; then
      echo "❌ Invalid selection"; exit 1
    fi
    DRIVE_PATH="${CANDIDATES[$idx]}"
  fi
fi

# Verify drive is mounted and writable
if [ ! -d "$DRIVE_PATH" ]; then
  echo "❌ Drive not found: $DRIVE_PATH"
  exit 1
fi
if [ ! -w "$DRIVE_PATH" ]; then
  echo "❌ Drive is not writable: $DRIVE_PATH"
  exit 1
fi

DEST="$DRIVE_PATH/$BACKUP_FOLDER"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  SAMS Backup to External Drive"
echo "═══════════════════════════════════════════════════════════════"
echo "  Source:      $PROJECT_ROOT/"
echo "  Destination: $DEST/"
[ -n "$DRY_RUN" ] && echo "  Mode:        🔍 DRY RUN (no changes)"
echo ""

mkdir -p "$DEST"

rsync -av --delete $DRY_RUN \
  --exclude='node_modules/' \
  --exclude='.git/' \
  --exclude='dist/' \
  --exclude='build/' \
  --exclude='.firebase/' \
  --exclude='.cache/' \
  --exclude='.parcel-cache/' \
  --exclude='.next/' \
  --exclude='out/' \
  --exclude='coverage/' \
  --exclude='.nyc_output/' \
  --exclude='tmp/' \
  --exclude='temp/' \
  --exclude='*.tgz' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  --exclude='Thumbs.db' \
  --exclude='*.swp' \
  --exclude='*.swo' \
  --exclude='*~' \
  --exclude='.env*' \
  --exclude='serviceAccountKey*.json' \
  --exclude='*firebase-adminsdk*.json' \
  --exclude='firebase-credentials.json' \
  --exclude='.vscode/' \
  --exclude='.idea/' \
  --exclude='backend.OLD/' \
  --exclude='backend.OLD.zip' \
  --exclude='AVIIdata/' \
  --exclude='MTCdata/' \
  --exclude='test-results/' \
  --exclude='.cursor/screenshots/' \
  --exclude='.claude/' \
  --exclude='npm-debug.log*' \
  --exclude='yarn-debug.log*' \
  --exclude='*.tsbuildinfo' \
  "$PROJECT_ROOT/" "$DEST/"

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
if [ -z "$DRY_RUN" ]; then
  echo "$TIMESTAMP" > "$DEST/.last-backup"
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "  ✅ Backup complete — $TIMESTAMP"
  echo "  📁 $DEST/"
  du -sh "$DEST" 2>/dev/null | awk '{print "  💾 Size: " $1}'
  echo "═══════════════════════════════════════════════════════════════"
else
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "  🔍 Dry run complete — no files were copied"
  echo "═══════════════════════════════════════════════════════════════"
fi
echo ""
