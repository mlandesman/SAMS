#!/bin/bash

# Example: Update only variable data (transactions, HOA dues, units)
# Preserves static configuration data

CLIENT_ID=$1
DATA_PATH=${2:-"../../${CLIENT_ID}data"}

if [ -z "$CLIENT_ID" ]; then
    echo "Usage: $0 <CLIENT_ID> [DATA_PATH]"
    echo "Example: $0 AVII"
    echo "Example: $0 AVII ../../AVIIdata"
    exit 1
fi

# Change to the client-onboarding directory
cd "$(dirname "$0")/.." || exit 1

echo "==================================================================================="
echo "Updating variable data for client: $CLIENT_ID"
echo "Data source: $DATA_PATH"
echo "==================================================================================="

# Collections to update
VARIABLE_COLLECTIONS="transactions,hoadues,units"

echo ""
echo "This will update the following collections:"
echo "- Units (including HOA dues subcollections)"
echo "- Transactions"
echo "- HOA Dues"
echo ""
echo "The following will be preserved:"
echo "- Users and permissions"
echo "- Client configuration"
echo "- Categories and Vendors"
echo "- Accounts structure"
echo "- Year-end balances"
echo ""

# 1. Dry run first
echo "Running dry-run to see what will be affected..."
echo "----------------------------------------------"
node purge-prod-client-selective.js --client "$CLIENT_ID" --only "$VARIABLE_COLLECTIONS" --dry-run

echo ""
read -p "Continue with actual update? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Operation cancelled"
    exit 0
fi

# 2. Purge variable data
echo ""
echo "Step 1: Purging variable data..."
echo "--------------------------------"
node purge-prod-client-selective.js --client "$CLIENT_ID" --only "$VARIABLE_COLLECTIONS" --force

# 3. Import variable data (units must come before HOA dues)
echo ""
echo "Step 2: Importing fresh variable data..."
echo "---------------------------------------"
./run-complete-import-selective.sh "$CLIENT_ID" --only units,transactions,hoadues --data-path "$DATA_PATH" --force

echo ""
echo "==================================================================================="
echo "Variable data update complete for client: $CLIENT_ID"
echo "Static configuration has been preserved"
echo "==================================================================================="