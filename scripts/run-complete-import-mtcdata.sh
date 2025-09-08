#!/bin/bash

# Complete Import Script for SAMS Dev Environment - Using MTCdata Directory
# This script runs all import scripts in the correct order using the MTCdata files
# Date: July 4, 2025

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}SAMS Complete Data Import - Dev Environment${NC}"
echo -e "${BLUE}Using MTCdata Directory Files${NC}"
echo -e "${BLUE}================================================${NC}"

# Set environment
export FIRESTORE_ENV=dev

# Verify we're in the scripts directory
if [ ! -f "import-users.js" ]; then
    echo -e "${RED}Error: Please run this script from the scripts directory${NC}"
    echo "cd /path/to/SAMS/scripts"
    exit 1
fi

# Check if MTCdata directory exists
echo -e "\n${YELLOW}Checking for MTCdata directory...${NC}"
if [ ! -d "../MTCdata" ]; then
    echo -e "${RED}Error: MTCdata directory not found${NC}"
    echo "Expected location: ../MTCdata (relative to scripts directory)"
    exit 1
fi

# List available data files
echo -e "\n${BLUE}Available data files in MTCdata:${NC}"
ls -la ../MTCdata/*.json

# Safety confirmation
echo -e "\n${YELLOW}⚠️  This will import data to: sandyland-management-system (Dev)${NC}"
echo -e "${YELLOW}⚠️  Data source: MTCdata directory${NC}"
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

# 1. Create MTC Client (since we don't have a client JSON file)
echo -e "\n${BLUE}▶ Creating MTC Client Document${NC}"
if ! node create-mtc-client.js; then
    echo -e "${RED}Critical error: Client creation failed. Stopping.${NC}"
    exit 1
fi

# 2. Import Users
# The import-users script expects data in MTCdata directory
if ! run_import "import-users.js" "Users Import"; then
    echo -e "${YELLOW}Warning: User import had issues. Check logs.${NC}"
fi

# 3. Import Categories and Vendors
# This script reads from MTCdata/Categories.json and MTCdata/Vendors.json
if ! run_import "import-categories-vendors.js" "Categories & Vendors Import"; then
    echo -e "${YELLOW}Warning: Categories/Vendors import had issues. Check logs.${NC}"
fi

# 4. Setup Accounts (we don't have account data, so we'll create default accounts)
echo -e "\n${BLUE}▶ Setting up default accounts${NC}"
cat > temp-setup-accounts.js << 'EOF'
import { initializeFirebase } from './utils/environment-config.js';
import { getCurrentTimestamp } from './utils/timestamp-converter.js';

async function setupAccounts() {
  const { db } = await initializeFirebase('dev');
  const clientId = 'MTC';
  
  // Create default accounts
  const accounts = [
    { id: 'bank-001', name: 'CiBanco', type: 'bank', currency: 'USD', balance: 0 },
    { id: 'cash-001', name: 'Cash', type: 'cash', currency: 'USD', balance: 0 }
  ];
  
  for (const account of accounts) {
    const accountDoc = {
      ...account,
      isActive: true,
      updated: getCurrentTimestamp(),
      balanceUpdated: getCurrentTimestamp()
    };
    
    await db.collection(`clients/${clientId}/accounts`).doc(account.id).set(accountDoc);
    console.log(`✅ Created account: ${account.name}`);
  }
}

setupAccounts().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
EOF

node temp-setup-accounts.js
rm temp-setup-accounts.js

# 5. Import Units
# This script reads from MTCdata/Units.json and MTCdata/UnitSizes.json
if ! run_import "import-units.js" "Units Import"; then
    echo -e "${YELLOW}Warning: Units import had issues. Check logs.${NC}"
fi

# 6. Import Transactions
# This script reads from MTCdata/Transactions.json
if ! run_import "import-transactions.js" "Transactions Import"; then
    echo -e "${YELLOW}Warning: Transactions import had issues. Check logs.${NC}"
fi

# 7. Import HOA Dues
# This script reads from MTCdata/HOADues.json
if ! run_import "importHOADues.js" "HOA Dues Import"; then
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

if [ -f "verify-import.js" ]; then
    echo -e "\n${BLUE}▶ Import Verification${NC}"
    node verify-import.js
fi

if [ -f "verify-data.js" ]; then
    echo -e "\n${BLUE}▶ Data Statistics${NC}"
    node verify-data.js
fi

echo -e "\n${GREEN}🎉 Import process complete!${NC}"
echo -e "${BLUE}Check the verification output above for any issues.${NC}"
echo -e "${BLUE}You can now test the application with the fresh data.${NC}"

# Optional: Open Firebase console
echo -e "\n${YELLOW}Open Firebase Console to verify?${NC}"
echo "https://console.firebase.google.com/project/sandyland-management-system/firestore"