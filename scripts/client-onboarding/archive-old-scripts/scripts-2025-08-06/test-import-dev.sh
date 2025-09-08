#!/bin/bash

# Test import in development environment
# This script runs a limited test of the import process to verify fixes

echo "================================================"
echo "SAMS Import Test - DEVELOPMENT ONLY"
echo "================================================"
echo ""
echo "This script will test the import process with a small subset of data"
echo "in the development environment to verify the date parsing fix."
echo ""

# Set environment to development
export FIRESTORE_ENV=dev

# Check if MTCdata directory exists
if [ ! -d "../../MTCdata" ]; then
  echo "❌ Error: MTCdata directory not found"
  echo "   Expected location: ../../MTCdata"
  exit 1
fi

# Show environment
echo "Environment: $FIRESTORE_ENV (Development)"
echo "Project: sandyland-management-system"
echo ""

read -p "Continue with test import? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Test cancelled."
  exit 0
fi

echo ""
echo "=== TEST 1: Import Single Transaction ==="
echo "Testing date parsing fix with one transaction..."

# Create a test transaction file with just one transaction
cat > test-transaction.json << 'EOF'
[
  {
    "Date": "1/3/2024",
    "Amount": "3500",
    "Vendor": "Test Deposit",
    "Category": "HOA Dues",
    "Account": "MTC Bank",
    "Method": "Wire",
    "Notes": "Test transaction for date parsing",
    "Unit": "1A"
  }
]
EOF

echo "Created test transaction file"

# Run the import with just the test transaction
echo "Running import script..."
node import-transactions-with-crud-refactored.js --test-file test-transaction.json

# Check the exit code
if [ $? -eq 0 ]; then
  echo "✅ Test import completed successfully!"
else
  echo "❌ Test import failed"
fi

# Clean up test file
rm -f test-transaction.json

echo ""
echo "Test complete. Check the logs above for any errors."
echo "If successful, you can proceed with more comprehensive testing."