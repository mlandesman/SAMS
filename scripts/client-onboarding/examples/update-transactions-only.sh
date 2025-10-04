#!/bin/bash

# Example: Update only transactions for a client
# This preserves all other data including users and configuration

CLIENT_ID=$1

if [ -z "$CLIENT_ID" ]; then
    echo "Usage: $0 <CLIENT_ID>"
    echo "Example: $0 AVII"
    exit 1
fi

# Change to the client-onboarding directory
cd "$(dirname "$0")/.." || exit 1

echo "==================================================================================="
echo "Updating transactions for client: $CLIENT_ID"
echo "This will preserve users, client config, and all other non-transaction data"
echo "==================================================================================="

# 1. Dry run first to see what will be affected
echo ""
echo "Step 1: Running dry-run to preview changes..."
echo "-------------------------------------------"
node purge-prod-client-selective.js --client "$CLIENT_ID" --only transactions --dry-run

# Ask for confirmation
echo ""
read -p "Continue with actual purge and import? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Operation cancelled"
    exit 0
fi

# 2. Purge transactions
echo ""
echo "Step 2: Purging transactions..."
echo "------------------------------"
node purge-prod-client-selective.js --client "$CLIENT_ID" --only transactions --force

# 3. Import transactions
echo ""
echo "Step 3: Importing new transactions..."
echo "------------------------------------"
./run-complete-import-selective.sh "$CLIENT_ID" --only transactions --force

echo ""
echo "==================================================================================="
echo "Transaction update complete for client: $CLIENT_ID"
echo "==================================================================================="