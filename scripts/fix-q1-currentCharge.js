#!/usr/bin/env node
/**
 * Fix Q1 2026 Water Bills - Populate currentCharge and fix status
 * 
 * Problem: Q1 bills were created before Dec 16, 2025 when currentCharge field was added.
 * This causes penalty recalculation to use 0 instead of actual remaining balance.
 * Also, some bills have incorrect status (partial when fully paid).
 * 
 * Logic:
 * - Calculate totalCharges = waterCharge + carWashCharge + boatWashCharge
 * - If paidAmount >= totalCharges: status = 'paid', currentCharge = 0
 * - If paidAmount > 0 but < totalCharges: status = 'partial', currentCharge = totalCharges - paidAmount
 * - If paidAmount === 0: status = 'unpaid', currentCharge = totalCharges
 * 
 * Usage:
 *   node scripts/fix-q1-currentCharge.js --dry-run     # Preview changes
 *   node scripts/fix-q1-currentCharge.js --execute     # Apply changes
 *   node scripts/fix-q1-currentCharge.js --execute --prod  # Apply to production
 */

import admin from 'firebase-admin';

// Parse arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isExecute = args.includes('--execute');
const isProd = args.includes('--prod');

if (!isDryRun && !isExecute) {
  console.log('Usage:');
  console.log('  node scripts/fix-q1-currentCharge.js --dry-run     # Preview changes');
  console.log('  node scripts/fix-q1-currentCharge.js --execute     # Apply to dev');
  console.log('  node scripts/fix-q1-currentCharge.js --execute --prod  # Apply to production');
  process.exit(1);
}

const projectId = isProd ? 'sams-sandyland-prod' : 'sams-sandyland-dev';
console.log(`\n🔧 Q1 2026 currentCharge Fix Script`);
console.log(`📍 Target: ${projectId}`);
console.log(`🔍 Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'EXECUTE (will modify data)'}\n`);

// Initialize Firebase
admin.initializeApp({ projectId });
const db = admin.firestore();

async function fixQ1CurrentCharge() {
  const docRef = db.doc('clients/AVII/projects/waterBills/bills/2026-Q1');
  const doc = await docRef.get();
  
  if (!doc.exists) {
    console.error('❌ Q1 2026 document not found!');
    process.exit(1);
  }
  
  const data = doc.data();
  const units = data.bills?.units || {};
  
  // Manual overrides for units with known payment data issues
  // These units have incorrect paidAmount in Firestore but are confirmed paid via statement analysis
  const manualOverrides = {
    '101': {
      status: 'paid',
      currentCharge: 0,
      reason: 'Actual payments: $1,139.73 + $60.27 = $1,200 for $1,250 bill. Q2 already paid, so Q1 must be paid first.'
    },
    '104': { 
      status: 'paid', 
      currentCharge: 0,
      reason: 'Actual payments: $1,767.59 + $639.73 + $1,454.50 = $3,861.82 for $1,350 bill (June+Q1 transition)'
    }
  };
  
  console.log('Current Q1 Data:');
  console.log('================');
  console.log('Unit    | Status  | totalCharges | paidAmount | currentCharge | NEW Status | NEW currentCharge | Changes');
  console.log('--------|---------|--------------|------------|---------------|------------|-------------------|--------');
  
  const updates = {};
  let changesNeeded = 0;
  
  for (const [unitId, bill] of Object.entries(units).sort((a, b) => 
    a[0].localeCompare(b[0], undefined, { numeric: true }))) {
    
    const status = bill.status || 'unpaid';
    const waterCharge = bill.waterCharge || 0;
    const carWashCharge = bill.carWashCharge || 0;
    const boatWashCharge = bill.boatWashCharge || 0;
    const paidAmount = bill.paidAmount || 0;
    const currentCharge = bill.currentCharge || 0;
    
    // Calculate total charges (base bill without penalties)
    const totalCharges = waterCharge + carWashCharge + boatWashCharge;
    
    // Determine correct status and currentCharge
    let newStatus;
    let newCurrentCharge;
    let overrideApplied = false;
    
    // Check for manual override first
    if (manualOverrides[unitId]) {
      newStatus = manualOverrides[unitId].status;
      newCurrentCharge = manualOverrides[unitId].currentCharge;
      overrideApplied = true;
    } else if (paidAmount >= totalCharges) {
      // Fully paid (or overpaid)
      newStatus = 'paid';
      newCurrentCharge = 0;
    } else if (paidAmount > 0) {
      // Partially paid
      newStatus = 'partial';
      newCurrentCharge = totalCharges - paidAmount;
    } else {
      // Unpaid
      newStatus = 'unpaid';
      newCurrentCharge = totalCharges;
    }
    
    const statusChanged = status !== newStatus;
    const chargeChanged = currentCharge !== newCurrentCharge;
    const anyChange = statusChanged || chargeChanged;
    if (anyChange) changesNeeded++;
    
    const changeFlags = [];
    if (statusChanged) changeFlags.push('status');
    if (chargeChanged) changeFlags.push('charge');
    if (overrideApplied) changeFlags.push('OVERRIDE');
    
    console.log(
      `${unitId.padEnd(7)} | ${status.padEnd(7)} | ${String(totalCharges).padStart(12)} | ${String(paidAmount).padStart(10)} | ${String(currentCharge).padStart(13)} | ${newStatus.padEnd(10)} | ${String(newCurrentCharge).padStart(17)} | ${changeFlags.join(', ') || '-'}`
    );
    
    if (overrideApplied && manualOverrides[unitId].reason) {
      console.log(`        ↳ Override reason: ${manualOverrides[unitId].reason}`);
    }
    
    if (statusChanged) {
      updates[`bills.units.${unitId}.status`] = newStatus;
    }
    if (chargeChanged) {
      updates[`bills.units.${unitId}.currentCharge`] = newCurrentCharge;
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`Total units: ${Object.keys(units).length}`);
  console.log(`Changes needed: ${changesNeeded}`);
  
  if (changesNeeded === 0) {
    console.log('\n✅ No changes needed - all currentCharge values are correct!');
    process.exit(0);
  }
  
  if (isDryRun) {
    console.log('\n📋 DRY RUN - No changes made.');
    console.log('Run with --execute to apply these changes.');
  } else {
    console.log('\n⏳ Applying changes...');
    await docRef.update(updates);
    console.log('✅ Changes applied successfully!');
    
    // Verify
    console.log('\n🔍 Verifying changes...');
    const verifyDoc = await docRef.get();
    const verifyUnits = verifyDoc.data().bills?.units || {};
    let allCorrect = true;
    
    for (const [unitId, bill] of Object.entries(verifyUnits)) {
      const status = bill.status || 'unpaid';
      const waterCharge = bill.waterCharge || 0;
      const carWashCharge = bill.carWashCharge || 0;
      const boatWashCharge = bill.boatWashCharge || 0;
      const paidAmount = bill.paidAmount || 0;
      const currentCharge = bill.currentCharge || 0;
      
      const totalCharges = waterCharge + carWashCharge + boatWashCharge;
      
      let expectedStatus, expectedCharge;
      if (paidAmount >= totalCharges) {
        expectedStatus = 'paid';
        expectedCharge = 0;
      } else if (paidAmount > 0) {
        expectedStatus = 'partial';
        expectedCharge = totalCharges - paidAmount;
      } else {
        expectedStatus = 'unpaid';
        expectedCharge = totalCharges;
      }
      
      if (status !== expectedStatus) {
        console.log(`❌ Unit ${unitId} status: expected '${expectedStatus}', got '${status}'`);
        allCorrect = false;
      }
      if (currentCharge !== expectedCharge) {
        console.log(`❌ Unit ${unitId} currentCharge: expected ${expectedCharge}, got ${currentCharge}`);
        allCorrect = false;
      }
    }
    
    if (allCorrect) {
      console.log('✅ All values verified correctly!');
    }
  }
}

fixQ1CurrentCharge()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
