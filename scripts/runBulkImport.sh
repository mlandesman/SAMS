#!/bin/bash

# Script to run the bulk exchange rates import
# This will delete all existing exchange rate data and import from 2024-01-01 to today

echo "🚀 SAMS Exchange Rates Bulk Import"
echo "=================================="
echo ""
echo "⚠️  WARNING: This will delete ALL existing exchange rate data!"
echo "   and import historical data from January 1, 2024 to today."
echo ""
echo "   This process may take 10-20 minutes depending on the date range."
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Import cancelled"
    exit 0
fi

echo ""
echo "🔄 Starting bulk import..."
echo ""

# Navigate to the scripts directory
cd "$(dirname "$0")"

# Run the bulk import script
node bulkImportExchangeRates.js

echo ""
echo "✅ Bulk import completed!"
echo ""
echo "💡 You can now use the app normally. The system will automatically"
echo "   fill any future gaps when you don't start the app for multiple days."
