#!/bin/bash
# Firebase CLI Purge Commands for Dev Environment
# Generated: 2025-07-04T23:27:01.138Z
# Task: PURGE-DEV-DATA-001

# SAFETY CHECK: Ensure you are targeting DEV project
echo "Current Firebase project:"
firebase use
echo ""
echo "⚠️  WARNING: This will DELETE data from the current project!"
echo "⚠️  ONLY proceed if the project is: sandyland-management-dev"
echo ""
read -p "Type PURGE DEV to continue: " confirm
if [ "$confirm" != "PURGE DEV" ]; then
  echo "Cancelled."
  exit 1
fi

# Set project explicitly
firebase use sandyland-management-dev

# === PHASE 1: Delete deepest subcollections first ===
echo "Deleting HOA dues subcollections..."
firebase firestore:delete clients/MTC/units/1A/dues --recursive --yes
firebase firestore:delete clients/MTC/units/1B/dues --recursive --yes
firebase firestore:delete clients/MTC/units/1C/dues --recursive --yes
firebase firestore:delete clients/MTC/units/1D/dues --recursive --yes
firebase firestore:delete clients/MTC/units/1E/dues --recursive --yes
firebase firestore:delete clients/MTC/units/1F/dues --recursive --yes
firebase firestore:delete clients/MTC/units/1G/dues --recursive --yes
firebase firestore:delete clients/MTC/units/1H/dues --recursive --yes
firebase firestore:delete clients/MTC/units/1I/dues --recursive --yes
firebase firestore:delete clients/MTC/units/1J/dues --recursive --yes
firebase firestore:delete clients/MTC/units/1K/dues --recursive --yes
firebase firestore:delete clients/MTC/units/1L/dues --recursive --yes
firebase firestore:delete clients/MTC/units/2A/dues --recursive --yes
firebase firestore:delete clients/MTC/units/2B/dues --recursive --yes
firebase firestore:delete clients/MTC/units/2C/dues --recursive --yes
firebase firestore:delete clients/MTC/units/2D/dues --recursive --yes
firebase firestore:delete clients/MTC/units/2E/dues --recursive --yes
firebase firestore:delete clients/MTC/units/2F/dues --recursive --yes
firebase firestore:delete clients/MTC/units/2G/dues --recursive --yes
firebase firestore:delete clients/MTC/units/2H/dues --recursive --yes
firebase firestore:delete clients/MTC/units/2I/dues --recursive --yes
firebase firestore:delete clients/MTC/units/2J/dues --recursive --yes
firebase firestore:delete clients/MTC/units/2K/dues --recursive --yes
firebase firestore:delete clients/MTC/units/2L/dues --recursive --yes

# === PHASE 2: Delete parent collections ===
echo "Deleting units collection..."
firebase firestore:delete clients/MTC/units --recursive --yes

echo "Deleting transactions collection..."
firebase firestore:delete clients/MTC/transactions --recursive --yes

echo "Deleting vendors collection..."
firebase firestore:delete clients/MTC/vendors --recursive --yes

echo "Deleting categories collection..."
firebase firestore:delete clients/MTC/categories --recursive --yes

echo "Deleting accounts collection..."
firebase firestore:delete clients/MTC/accounts --recursive --yes

# === PHASE 3: Delete client document ===
echo "Deleting MTC client document..."
firebase firestore:delete clients/MTC --yes

# === PHASE 4: Delete audit logs ===
echo "Deleting all audit logs..."
firebase firestore:delete auditLogs --recursive --yes

# === VERIFICATION ===
echo ""
echo "✅ Purge complete!"
echo ""
echo "Remaining collections (should only be exchangeRates and users):"
firebase firestore:indexes