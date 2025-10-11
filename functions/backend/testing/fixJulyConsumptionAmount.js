import { getDb } from '../firebase.js';

async function fixJulyConsumptionAmount() {
  try {
    console.log('🔧 Fixing July consumption amounts...');
    
    const db = await getDb();
    
    // Get July bill document
    const julyBillDoc = await db
      .collection('clients').doc('AVII')
      .collection('projects').doc('waterBills')
      .collection('bills').doc('2026-00')
      .get();
    
    if (!julyBillDoc.exists) {
      console.log('❌ July bill document not found');
      return;
    }
    
    const billData = julyBillDoc.data();
    const units = billData.bills?.units || {};
    
    console.log('📋 Current July bill units and their consumption amounts:');
    
    const batch = db.batch();
    let updatesNeeded = 0;
    
    for (const [unitId, unit] of Object.entries(units)) {
      const consumption = unit.consumption || 0;
      const currentCharge = unit.currentCharge || 0;
      const expectedCharge = consumption * 50; // $50 per m³
      
      console.log(`  Unit ${unitId}: ${consumption} m³, currentCharge: $${currentCharge}, expected: $${expectedCharge}`);
      
      if (consumption > 0 && currentCharge === 0) {
        // Need to update currentCharge
        batch.update(julyBillDoc.ref, {
          [`bills.units.${unitId}.currentCharge`]: expectedCharge
        });
        updatesNeeded++;
        console.log(`    ✅ Will update Unit ${unitId} currentCharge to $${expectedCharge}`);
      }
    }
    
    if (updatesNeeded > 0) {
      await batch.commit();
      console.log(`✅ Updated ${updatesNeeded} units with correct consumption amounts`);
    } else {
      console.log('ℹ️ No updates needed - all units already have correct currentCharge values');
    }
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
}

fixJulyConsumptionAmount();