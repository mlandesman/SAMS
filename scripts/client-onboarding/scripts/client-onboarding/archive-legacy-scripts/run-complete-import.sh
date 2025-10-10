#!/bin/bash

# Complete Import Script for SAMS Dev Environment
# This script runs all import scripts in the correct order
# Date: July 4, 2025

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}SAMS Complete Data Import - Dev Environment${NC}"
echo -e "${BLUE}================================================${NC}"

# Set environment
export FIRESTORE_ENV=dev

# Verify we're in the scripts directory
if [ ! -f "import-all-mtc-data.js" ]; then
    echo -e "${RED}Error: Please run this script from the scripts directory${NC}"
    echo "cd /path/to/SAMS/scripts"
    exit 1
fi

# Check if data files exist
echo -e "\n${YELLOW}Checking for data files...${NC}"
if [ ! -d "data" ]; then
    echo -e "${RED}Error: data directory not found${NC}"
    echo "Please ensure your exported data files are in the scripts/data directory"
    exit 1
fi

# Safety confirmation
echo -e "\n${YELLOW}⚠️  This will import data to: sandyland-management-system (Dev)${NC}"
echo -e "${YELLOW}⚠️  Make sure you have exported fresh data from Google Sheets${NC}"
read -p "Continue with import? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${RED}Import cancelled${NC}"
    exit 0
fi

# Function to run import and check status
run_import() {
    local script=$1
    local description=$2
    
    echo -e "\n${BLUE}▶ Running: ${description}${NC}"
    echo -e "${BLUE}  Script: ${script}${NC}"
    
    if node "$script"; then
        echo -e "${GREEN}✅ ${description} completed successfully${NC}"
        return 0
    else
        echo -e "${RED}❌ ${description} failed${NC}"
        return 1
    fi
}

# Start timer
start_time=$(date +%s)

echo -e "\n${GREEN}Starting import sequence...${NC}"

# 1. Import Client Data
if ! run_import "client-onboarding/import-client-data.js" "Client Data Import"; then
    echo -e "${RED}Critical error: Client import failed. Stopping.${NC}"
    exit 1
fi

# 2. Import Users
if ! run_import "import-users-with-audit.js" "Users Import"; then
    echo -e "${YELLOW}Warning: User import had issues. Check logs.${NC}"
fi

# 3. Import Categories
if ! run_import "import-categories-vendors-with-crud.js" "Categories & Vendors Import"; then
    echo -e "${YELLOW}Warning: Categories/Vendors import had issues. Check logs.${NC}"
fi

# 4. Setup Accounts
if ! run_import "setup-accounts.js" "Accounts Setup"; then
    echo -e "${YELLOW}Warning: Accounts setup had issues. Check logs.${NC}"
fi

# 5. Import Units
if ! run_import "import-units-with-crud.js" "Units Import"; then
    echo -e "${YELLOW}Warning: Units import had issues. Check logs.${NC}"
fi

# 6. Import Transactions
if ! run_import "import-transactions-with-crud.js" "Transactions Import"; then
    echo -e "${YELLOW}Warning: Transactions import had issues. Check logs.${NC}"
fi

# 7. Import HOA Dues
if ! run_import "importHOADuesFixed.js" "HOA Dues Import"; then
    echo -e "${YELLOW}Warning: HOA Dues import had issues. Check logs.${NC}"
fi

# Calculate elapsed time
end_time=$(date +%s)
elapsed=$((end_time - start_time))
minutes=$((elapsed / 60))
seconds=$((elapsed % 60))

echo -e "\n${BLUE}================================================${NC}"
echo -e "${GREEN}Import sequence completed in ${minutes}m ${seconds}s${NC}"
echo -e "${BLUE}================================================${NC}"

# Run verification
echo -e "\n${YELLOW}Running verification scripts...${NC}"

echo -e "\n${BLUE}▶ Import Verification${NC}"
node verify-import.js

echo -e "\n${BLUE}▶ Data Statistics${NC}"
node verify-data.js

echo -e "\n${GREEN}🎉 Import process complete!${NC}"
echo -e "${BLUE}Check the verification output above for any issues.${NC}"
echo -e "${BLUE}You can now test the application with the fresh data.${NC}"

# Optional: Open Firebase console
echo -e "\n${YELLOW}Open Firebase Console to verify?${NC}"
echo "https://console.firebase.google.com/project/sandyland-management-system/firestore"