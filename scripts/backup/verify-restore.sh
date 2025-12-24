#!/bin/bash

# Quick verification script to check if restore worked
# Usage: ./verify-restore.sh

set -e

DEV_PROJECT_ID="sandyland-management-system"

echo "🔍 Verifying Dev Restore"
echo "======================="
echo ""

# Check Firestore operations
echo "📦 Checking Firestore import status..."
LATEST_OP=$(gcloud firestore operations list \
    --project="$DEV_PROJECT_ID" \
    --limit=1 \
    --format="value(name,done,operationState)" 2>/dev/null | head -1)

if [ -n "$LATEST_OP" ]; then
    echo "   Latest operation: $LATEST_OP"
    if echo "$LATEST_OP" | grep -q "True"; then
        echo "   ✅ Firestore import completed"
    else
        echo "   ⏳ Firestore import still in progress"
    fi
else
    echo "   ⚠️  No recent operations found"
fi

echo ""

# Check Storage files
echo "📁 Checking Storage files..."
STORAGE_COUNT=$(gsutil ls -r gs://sandyland-management-system.firebasestorage.app/ 2>/dev/null | wc -l | tr -d ' ')
echo "   Storage files found: $STORAGE_COUNT"

if [ "$STORAGE_COUNT" -gt 10 ]; then
    echo "   ✅ Storage files present"
else
    echo "   ⚠️  Storage files may be incomplete"
fi

echo ""

# Check for clients data
echo "🏢 Checking client data..."
CLIENTS=$(gsutil ls gs://sandyland-management-system.firebasestorage.app/clients/ 2>/dev/null | wc -l | tr -d ' ')
echo "   Client directories: $CLIENTS"

if [ "$CLIENTS" -gt 0 ]; then
    echo "   ✅ Client data present"
    echo "   Clients found:"
    gsutil ls gs://sandyland-management-system.firebasestorage.app/clients/ 2>/dev/null | sed 's|gs://sandyland-management-system.firebasestorage.app/clients/||' | sed 's|/$||' | sed 's/^/      - /'
else
    echo "   ⚠️  No client data found"
fi

echo ""
echo "✅ Verification complete!"
echo ""
echo "💡 To verify Firestore data, check the Firebase Console:"
echo "   https://console.firebase.google.com/project/$DEV_PROJECT_ID/firestore"

