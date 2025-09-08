#!/bin/bash

# Navigate to the scripts directory
cd "$(dirname "$0")"

# Install any needed dependencies
echo "Installing dependencies..."
npm install firebase-admin

# Run the import script
echo "Running transaction import..."
node importTransactionsForMTC.js

# Check result
if [ $? -eq 0 ]; then
    echo "Transaction import completed. Running balance rebuild..."
    node rebuildBalancesForMTC.js
else
    echo "Transaction import failed. Skipping balance rebuild."
    exit 1
fi

echo "Done!"
