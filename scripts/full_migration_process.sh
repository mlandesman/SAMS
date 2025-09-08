#!/bin/bash

# full_migration_process.sh
# 
# This script performs the full migration process for the SAMS app:
# 1. Import HOA dues data from MTCdata/HOA_Dues_Export.json
# 2. Import transactions from MTCdata/transHistory.json
# 3. Migrate accounts to use stable IDs and update transactions
# 4. Link HOA dues payments to transactions
# 5. Set final account balances

# Exit on any error
set -e

# Colors for better visibility
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Navigate to the scripts directory
cd "$(dirname "$0")"

# Define client ID
CLIENT_ID="MTC"

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}🔄 Starting full migration process for ${CLIENT_ID}${NC}"
echo -e "${BLUE}=========================================${NC}"
echo

# Step 1: Import HOA Dues
echo -e "${YELLOW}Step 1: Importing HOA Dues data...${NC}"
node importHOADuesFixed3.js ${CLIENT_ID}
echo -e "${GREEN}✅ HOA Dues import completed${NC}"
echo

# Step 2: Import Transactions
echo -e "${YELLOW}Step 2: Importing Transactions...${NC}"
node import-mtc-transactions.js ${CLIENT_ID} --import
echo -e "${GREEN}✅ Transaction import completed${NC}"
echo

# Step 3: Migrate accounts to use stable IDs
echo -e "${YELLOW}Step 3: Migrating accounts to use stable IDs...${NC}"
node account-id-migration.js ${CLIENT_ID} --migrate-accounts
echo -e "${GREEN}✅ Account migration completed${NC}"
echo

# Step 4: Link HOA dues payments to transactions
echo -e "${YELLOW}Step 4: Linking HOA dues payments to transactions...${NC}"
node account-id-migration.js ${CLIENT_ID} --link-hoa-dues
echo -e "${GREEN}✅ HOA dues linking completed${NC}"
echo

# Step 5: Set final balances
echo -e "${YELLOW}Step 5: Setting final account balances...${NC}"
node import-mtc-transactions.js ${CLIENT_ID} --balances
echo -e "${GREEN}✅ Final balances set${NC}"
echo

echo -e "${BLUE}=========================================${NC}"
echo -e "${GREEN}✅ Full migration process completed successfully${NC}"
echo -e "${BLUE}=========================================${NC}"

# Make sure the script returns success
exit 0
