#!/bin/bash
# Verification Script for Dev Purge

echo "=== DEV ENVIRONMENT VERIFICATION ==="
echo ""
echo "Current project:"
firebase use
echo ""
echo "Checking collections..."
echo ""
echo "1. Checking /clients collection:"
firebase firestore:get clients --limit 5
echo ""
echo "2. Checking /auditLogs collection:"
firebase firestore:get auditLogs --limit 5
echo ""
echo "3. Checking /exchangeRates collection (SHOULD EXIST):"
firebase firestore:get exchangeRates --limit 5
echo ""
echo "4. Checking /users collection (SHOULD EXIST):"
firebase firestore:get users --limit 5
echo ""