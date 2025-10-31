/**
 * Fix November 2025 Bills - Reset charges to 0
 * This document is only for opening meter values, charges should be 0
 */

import admin from 'firebase-admin';
import { getDb } from '../firebase.js';

async function fixNovember2025Bills() {
  console.log('🔧 Fixing November 2025 Bills - Resetting charges to 0');
  console.log('═'.repeat(80));
  
  try {
    const db = await getDb();
    
    // Get the November 2025 bill document
    const billRef = db.collection('clients').doc('AVII')
      .collection('projects').doc('waterBills')
      .collection('bills').doc('2025-11');
    
    console.log('\n📖 Reading document: /clients/AVII/projects/waterBills/bills/2025-11');
    const doc = await billRef.get();
    
    if (!doc.exists) {
      console.error('❌ Document not found!');
      process.exit(1);
    }
    
    const data = doc.data();
    console.log('✅ Document found');
    
    // Get the units from bills.units
    const units = data.bills?.units || {};
    const unitIds = Object.keys(units);
    
    console.log(`\n📊 Found ${unitIds.length} units to update`);
    console.log('Units:', unitIds.join(', '));
    
    // Show current values
    console.log('\n📋 Current Values:');
    unitIds.forEach(unitId => {
      const unit = units[unitId];
      console.log(`   ${unitId}:`);
      console.log(`      currentCharge: ${unit.currentCharge}`);
      console.log(`      waterCharge: ${unit.waterCharge}`);
      console.log(`      totalAmount: ${unit.totalAmount}`);
    });
    
    // Prepare the update
    const updates = {};
    unitIds.forEach(unitId => {
      updates[`bills.units.${unitId}.currentCharge`] = 0;
      updates[`bills.units.${unitId}.waterCharge`] = 0;
      updates[`bills.units.${unitId}.totalAmount`] = 0;
    });
    
    console.log('\n💾 Applying updates...');
    await billRef.update(updates);
    
    console.log('✅ Update complete!');
    
    // Verify the changes
    console.log('\n🔍 Verifying changes...');
    const verifyDoc = await billRef.get();
    const verifyData = verifyDoc.data();
    const verifyUnits = verifyData.bills?.units || {};
    
    let allZero = true;
    unitIds.forEach(unitId => {
      const unit = verifyUnits[unitId];
      if (unit.currentCharge !== 0 || unit.waterCharge !== 0 || unit.totalAmount !== 0) {
        allZero = false;
        console.log(`   ❌ ${unitId}: Still has non-zero values`);
      }
    });
    
    if (allZero) {
      console.log('✅ All units verified - all charges set to 0');
    }
    
    console.log('\n📋 Updated Values:');
    unitIds.forEach(unitId => {
      const unit = verifyUnits[unitId];
      console.log(`   ${unitId}:`);
      console.log(`      currentCharge: ${unit.currentCharge}`);
      console.log(`      waterCharge: ${unit.waterCharge}`);
      console.log(`      totalAmount: ${unit.totalAmount}`);
    });
    
    console.log('\n' + '═'.repeat(80));
    console.log('✅ Fix complete! November 2025 bills now have 0 charges (opening meters only)');
    
  } catch (error) {
    console.error('\n❌ Error fixing November 2025 bills:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the fix
fixNovember2025Bills().then(() => {
  console.log('\n✅ Script complete');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

