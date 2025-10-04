#!/bin/bash

# Example: Reimport all data except users and client configuration
# Useful when you need to refresh data but keep user access intact

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
echo "Reimporting data for client: $CLIENT_ID"
echo "Preserving: Users and Client Configuration"
echo "Data source: $DATA_PATH"
echo "==================================================================================="

# 1. Show what will be preserved
echo ""
echo "The following will be PRESERVED:"
echo "- User accounts and permissions"
echo "- Client configuration and settings"
echo ""
echo "The following will be REPLACED:"
echo "- Units and HOA dues"
echo "- Transactions"
echo "- Categories and Vendors"
echo "- Year-end balances"
echo "- Accounts"
echo ""

read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Operation cancelled"
    exit 0
fi

# 2. Purge everything except users and client config
echo ""
echo "Step 1: Purging data (preserving users and client config)..."
echo "-----------------------------------------------------------"
node purge-prod-client-selective.js --client "$CLIENT_ID" --skip-users --skip-clients --force

# 3. Import everything except users and client config
echo ""
echo "Step 2: Importing fresh data..."
echo "-------------------------------"
./run-complete-import-selective.sh "$CLIENT_ID" --skip-users --skip-clients --data-path "$DATA_PATH" --force

echo ""
echo "==================================================================================="
echo "Data reimport complete for client: $CLIENT_ID"
echo "Users and client configuration have been preserved"
echo "==================================================================================="