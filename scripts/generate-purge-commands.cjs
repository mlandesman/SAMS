/**
 * Generate Firebase CLI Commands for Dev Purge
 * Task ID: PURGE-DEV-DATA-001
 * 
 * This script generates the Firebase CLI commands needed to purge
 * the dev environment while preserving exchangeRates and users
 */

const fs = require('fs');
const path = require('path');

// Collections to preserve
const PRESERVE_COLLECTIONS = ['exchangeRates', 'users'];

// Known collection structure based on project documentation
const COLLECTION_HIERARCHY = {
  clients: {
    docs: ['MTC'],
    subcollections: {
      MTC: {
        collections: ['accounts', 'transactions', 'vendors', 'categories', 'units'],
        units: {
          subcollections: ['dues']
        }
      }
    }
  },
  auditLogs: {},
  exchangeRates: {}, // PRESERVE
  users: {} // PRESERVE
};

// Generate delete commands
function generateDeleteCommands() {
  const commands = [];
  const timestamp = new Date().toISOString();
  
  commands.push('#!/bin/bash');
  commands.push('# Firebase CLI Purge Commands for Dev Environment');
  commands.push(`# Generated: ${timestamp}`);
  commands.push('# Task: PURGE-DEV-DATA-001');
  commands.push('');
  commands.push('# SAFETY CHECK: Ensure you are targeting DEV project');
  commands.push('echo "Current Firebase project:"');
  commands.push('firebase use');
  commands.push('echo ""');
  commands.push('echo "⚠️  WARNING: This will DELETE data from the current project!"');
  commands.push('echo "⚠️  ONLY proceed if the project is: sandyland-management-dev"');
  commands.push('echo ""');
  commands.push('read -p "Type PURGE DEV to continue: " confirm');
  commands.push('if [ "$confirm" != "PURGE DEV" ]; then');
  commands.push('  echo "Cancelled."');
  commands.push('  exit 1');
  commands.push('fi');
  commands.push('');
  commands.push('# Set project explicitly');
  commands.push('firebase use sandyland-management-dev');
  commands.push('');
  
  // Generate commands for deleting collections (bottom-up)
  commands.push('# === PHASE 1: Delete deepest subcollections first ===');
  commands.push('echo "Deleting HOA dues subcollections..."');
  
  // HOA dues (deepest level)
  for (let i = 1; i <= 24; i++) {
    const unitId = `${Math.floor((i-1)/12) + 1}${String.fromCharCode(65 + ((i-1) % 12))}`;
    commands.push(`firebase firestore:delete clients/MTC/units/${unitId}/dues --recursive --yes`);
  }
  
  commands.push('');
  commands.push('# === PHASE 2: Delete parent collections ===');
  commands.push('echo "Deleting units collection..."');
  commands.push('firebase firestore:delete clients/MTC/units --recursive --yes');
  
  commands.push('');
  commands.push('echo "Deleting transactions collection..."');
  commands.push('firebase firestore:delete clients/MTC/transactions --recursive --yes');
  
  commands.push('');
  commands.push('echo "Deleting vendors collection..."');
  commands.push('firebase firestore:delete clients/MTC/vendors --recursive --yes');
  
  commands.push('');
  commands.push('echo "Deleting categories collection..."');
  commands.push('firebase firestore:delete clients/MTC/categories --recursive --yes');
  
  commands.push('');
  commands.push('echo "Deleting accounts collection..."');
  commands.push('firebase firestore:delete clients/MTC/accounts --recursive --yes');
  
  commands.push('');
  commands.push('# === PHASE 3: Delete client document ===');
  commands.push('echo "Deleting MTC client document..."');
  commands.push('firebase firestore:delete clients/MTC --yes');
  
  commands.push('');
  commands.push('# === PHASE 4: Delete audit logs ===');
  commands.push('echo "Deleting all audit logs..."');
  commands.push('firebase firestore:delete auditLogs --recursive --yes');
  
  commands.push('');
  commands.push('# === VERIFICATION ===');
  commands.push('echo ""');
  commands.push('echo "✅ Purge complete!"');
  commands.push('echo ""');
  commands.push('echo "Remaining collections (should only be exchangeRates and users):"');
  commands.push('firebase firestore:indexes');
  
  return commands.join('\n');
}

// Generate verification script
function generateVerificationScript() {
  const commands = [];
  
  commands.push('#!/bin/bash');
  commands.push('# Verification Script for Dev Purge');
  commands.push('');
  commands.push('echo "=== DEV ENVIRONMENT VERIFICATION ==="');
  commands.push('echo ""');
  commands.push('echo "Current project:"');
  commands.push('firebase use');
  commands.push('echo ""');
  commands.push('echo "Checking collections..."');
  commands.push('echo ""');
  
  // Check each collection
  commands.push('echo "1. Checking /clients collection:"');
  commands.push('firebase firestore:get clients --limit 5');
  commands.push('echo ""');
  
  commands.push('echo "2. Checking /auditLogs collection:"');
  commands.push('firebase firestore:get auditLogs --limit 5');
  commands.push('echo ""');
  
  commands.push('echo "3. Checking /exchangeRates collection (SHOULD EXIST):"');
  commands.push('firebase firestore:get exchangeRates --limit 5');
  commands.push('echo ""');
  
  commands.push('echo "4. Checking /users collection (SHOULD EXIST):"');
  commands.push('firebase firestore:get users --limit 5');
  commands.push('echo ""');
  
  return commands.join('\n');
}

// Main execution
console.log('Generating Firebase CLI purge commands...\n');

// Create output directory
const outputDir = path.join(__dirname, 'purge-output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Generate purge script
const purgeScript = generateDeleteCommands();
const purgeScriptPath = path.join(outputDir, 'purge-dev-firestore.sh');
fs.writeFileSync(purgeScriptPath, purgeScript);
fs.chmodSync(purgeScriptPath, '755');

// Generate verification script
const verifyScript = generateVerificationScript();
const verifyScriptPath = path.join(outputDir, 'verify-dev-state.sh');
fs.writeFileSync(verifyScriptPath, verifyScript);
fs.chmodSync(verifyScriptPath, '755');

// Generate pre-purge analysis script
const prePurgeScript = `#!/bin/bash
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
`;

const prePurgeScriptPath = path.join(outputDir, 'pre-purge-analysis.sh');
fs.writeFileSync(prePurgeScriptPath, prePurgeScript);
fs.chmodSync(prePurgeScriptPath, '755');

console.log('✅ Generated purge scripts successfully!\n');
console.log('Output files:');
console.log(`  1. ${purgeScriptPath}`);
console.log(`  2. ${verifyScriptPath}`);
console.log(`  3. ${prePurgeScriptPath}`);
console.log('\nInstructions:');
console.log('  1. First, ensure Firebase CLI is installed: npm install -g firebase-tools');
console.log('  2. Login to Firebase: firebase login');
console.log('  3. Run pre-purge analysis: ./purge-output/pre-purge-analysis.sh');
console.log('  4. Review the output carefully');
console.log('  5. Run the purge: ./purge-output/purge-dev-firestore.sh');
console.log('  6. Verify results: ./purge-output/verify-dev-state.sh');
console.log('\n⚠️  CRITICAL: Only run these scripts after confirming you are in DEV environment!');