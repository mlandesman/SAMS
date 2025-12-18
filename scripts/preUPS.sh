#!/bin/bash

# ========================================
# preUPS.sh - Pre-UPS Test Backup Script
# ========================================
# Creates a backup of all UPS-affected data before testing payments
# 
# Usage:
#   ./scripts/preUPS.sh AVII 106           # Production (default)
#   ./scripts/preUPS.sh AVII 106 --dev     # Development
#
# Requires: gcloud auth application-default login (for production)
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
CLIENT_ID=""
UNIT_ID=""

for arg in "$@"; do
    case $arg in
        --dev)
            ENV="dev"
            ;;
        --prod)
            ENV="prod"
            ;;
        *)
            if [ -z "$CLIENT_ID" ]; then
                CLIENT_ID="$arg"
            elif [ -z "$UNIT_ID" ]; then
                UNIT_ID="$arg"
            fi
            ;;
    esac
done

# Check arguments
if [ -z "$CLIENT_ID" ] || [ -z "$UNIT_ID" ]; then
    echo -e "${RED}❌ Usage: $0 <clientId> <unitId> [--dev|--prod]${NC}"
    echo ""
    echo "Examples:"
    echo "  $0 AVII 106           # Production (default)"
    echo "  $0 AVII 106 --dev     # Development"
    echo "  $0 MTC PH4D --prod    # Production (explicit)"
    exit 1
fi

# Set display based on environment
if [ "$ENV" == "prod" ]; then
    ENV_DISPLAY="${RED}PRODUCTION${NC}"
    ENV_WARNING="⚠️  This will backup PRODUCTION data"
else
    ENV_DISPLAY="${YELLOW}DEVELOPMENT${NC}"
    ENV_WARNING="This will backup Development data"
fi

echo -e "${CYAN}════════════════════════════════════════${NC}"
echo -e "${CYAN}🔒 Pre-UPS Test Backup${NC}"
echo -e "${CYAN}════════════════════════════════════════${NC}"
echo ""
echo -e "   Client: ${YELLOW}${CLIENT_ID}${NC}"
echo -e "   Unit:   ${YELLOW}${UNIT_ID}${NC}"
echo -e "   Target: ${ENV_DISPLAY}"
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

# Confirm before proceeding
echo -e "${YELLOW}${ENV_WARNING} for Unit ${UNIT_ID}${NC}"
read -p "Continue? (y/n): " CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo -e "${CYAN}▶ Running backup...${NC}"
echo ""

# Run the backup script (always use ADC since service account keys are broken)
USE_ADC=true FIRESTORE_ENV=$ENV node scripts/backupUPSContext.js "$CLIENT_ID" "$UNIT_ID"

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Backup complete! Safe to test UPS.${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo -e "💡 If something goes wrong, restore with:"
echo -e "   ${CYAN}./scripts/postUPS.sh <backup-filename>${NC}"
echo ""
