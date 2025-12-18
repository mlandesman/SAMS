#!/bin/bash

# ========================================
# postUPS.sh - Post-UPS Test Restore Script
# ========================================
# Restores UPS-affected data from a backup after testing
# 
# Usage:
#   ./scripts/postUPS.sh <backup-file>                    # Production (default)
#   ./scripts/postUPS.sh <backup-file> --dry-run          # Dry run
#   ./scripts/postUPS.sh <backup-file> --dev              # Development
#   ./scripts/postUPS.sh <backup-file> --dev --dry-run    # Dev dry run
#
# Options:
#   --dry-run    Show what would be restored without making changes
#   --dev        Target development environment
#   --prod       Target production environment (default)
# ========================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Parse arguments
ENV="prod"
DRY_RUN=""
BACKUP_FILE=""

for arg in "$@"; do
    case $arg in
        --dev)
            ENV="dev"
            ;;
        --prod)
            ENV="prod"
            ;;
        --dry-run)
            DRY_RUN="--dry-run"
            ;;
        *)
            if [ -z "$BACKUP_FILE" ]; then
                BACKUP_FILE="$arg"
            fi
            ;;
    esac
done

# Check arguments
if [ -z "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Usage: $0 <backup-filename> [--dev|--prod] [--dry-run]${NC}"
    echo ""
    echo "Examples:"
    echo "  $0 ups-backup-AVII-106-2025-12-18.json              # Production"
    echo "  $0 ups-backup-AVII-106-2025-12-18.json --dry-run    # Dry run"
    echo "  $0 ups-backup-AVII-106-2025-12-18.json --dev        # Development"
    echo ""
    echo "Available backups:"
    ls -1t test-results/ups-backup-*.json 2>/dev/null | head -5 || echo "  (none found)"
    exit 1
fi

# Set display based on environment
if [ "$ENV" == "prod" ]; then
    ENV_DISPLAY="${RED}PRODUCTION${NC}"
else
    ENV_DISPLAY="${YELLOW}DEVELOPMENT${NC}"
fi

echo -e "${CYAN}════════════════════════════════════════${NC}"
echo -e "${CYAN}🔄 Post-UPS Test Restore${NC}"
echo -e "${CYAN}════════════════════════════════════════${NC}"
echo ""
echo -e "   Backup: ${YELLOW}${BACKUP_FILE}${NC}"
echo -e "   Target: ${ENV_DISPLAY}"
if [ -n "$DRY_RUN" ]; then
    echo -e "   Mode:   ${GREEN}DRY RUN (no changes)${NC}"
fi
echo ""

# Check if we're in the right directory
if [ ! -f "firebase.json" ]; then
    echo -e "${RED}❌ Not in SAMS project root directory!${NC}"
    echo "   Please run from /Users/michael/Projects/SAMS"
    exit 1
fi

# Check gcloud auth and set project
echo -e "${CYAN}▶ Checking gcloud authentication...${NC}"
if ! gcloud auth application-default print-access-token > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Not authenticated with gcloud${NC}"
    echo ""
    echo "Running: gcloud auth application-default login"
    echo ""
    gcloud auth application-default login
fi

# Set the correct project based on environment
if [ "$ENV" == "prod" ]; then
    gcloud config set project sams-sandyland-prod --quiet
else
    gcloud config set project sandyland-management-system --quiet
fi
echo -e "${GREEN}✅ gcloud authenticated for ${ENV}${NC}"
echo ""

# If not dry-run, confirm
if [ -z "$DRY_RUN" ]; then
    if [ "$ENV" == "prod" ]; then
        echo -e "${RED}⚠️  WARNING: This will OVERWRITE PRODUCTION data!${NC}"
        echo ""
        read -p "Type 'RESTORE' to confirm: " CONFIRM
    else
        echo -e "${YELLOW}⚠️  This will overwrite Development data${NC}"
        echo ""
        read -p "Continue? (y/n): " CONFIRM
        if [ "$CONFIRM" == "y" ] || [ "$CONFIRM" == "Y" ]; then
            CONFIRM="RESTORE"
        fi
    fi
    
    if [ "$CONFIRM" != "RESTORE" ]; then
        echo "Cancelled."
        exit 0
    fi
fi

echo ""
echo -e "${CYAN}▶ Running restore...${NC}"
echo ""

# Run the restore script (always use ADC since service account keys are broken)
USE_ADC=true FIRESTORE_ENV=$ENV node scripts/restoreUPSContext.js "$BACKUP_FILE" $DRY_RUN --force

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
if [ -n "$DRY_RUN" ]; then
    echo -e "${GREEN}✅ Dry run complete. No changes made.${NC}"
else
    echo -e "${GREEN}✅ Restore complete!${NC}"
fi
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
