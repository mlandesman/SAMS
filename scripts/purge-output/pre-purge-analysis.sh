#!/bin/bash
# Pre-Purge Analysis Script

echo "=== PRE-PURGE COLLECTION ANALYSIS ==="
echo ""
echo "Checking current Firebase project..."
firebase use
echo ""

echo "Collections to PRESERVE:"
echo "- exchangeRates"
echo "- users"
echo ""

echo "Collections to PURGE:"
echo "- clients/MTC (and all subcollections)"
echo "- auditLogs"
echo ""

echo "Analyzing collection sizes..."
echo ""

echo "1. Client data:"
firebase firestore:get clients/MTC --shallow
echo ""

echo "2. Audit logs:"
firebase firestore:get auditLogs --limit 10
echo ""

echo "3. Exchange rates (PRESERVE):"
firebase firestore:get exchangeRates --limit 10
echo ""

echo "4. Users (PRESERVE):"
firebase firestore:get users
echo ""
