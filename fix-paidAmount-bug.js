/**
 * Fix paidAmount bug in existing water bills data
 * 
 * Problem: paidAmount was storing the FULL transaction amount instead of
 * just the portion allocated to that specific bill (basePaid + penaltyPaid)
 * 
 * This script recalculates paidAmount for all bills to ensure:
 * paidAmount = basePaid + penaltyPaid
 */

import { getDb } from './backend/firebase.js';

async function fixPaidAmounts() {
  const db = await getDb();
  
  console.log('🔧 Starting paidAmount fix...\n');
  
  const clients = ['AVII', 'MTC'];
  
  for (const clientId of clients) {
    console.log(`\n📋 Processing client: ${clientId}`);
    
    const billsSnapshot = await db.collection('clients').doc(clientId)
      .collection('projects').doc('waterBills')
      .collection('bills')
      .get();
    
    console.log(`   Found ${billsSnapshot.size} bill documents`);
    
    const batch = db.batch();
    let fixCount = 0;
    
    for (const billDoc of billsSnapshot.docs) {
      const billData = billDoc.data();
      const units = billData.bills?.units || {};
      
      for (const [unitId, unitBill] of Object.entries(units)) {
        const basePaid = unitBill.basePaid || 0;
        const penaltyPaid = unitBill.penaltyPaid || 0;
        const currentPaidAmount = unitBill.paidAmount || 0;
        const correctPaidAmount = basePaid + penaltyPaid;
        
        // Check if paidAmount needs fixing
        if (currentPaidAmount !== correctPaidAmount) {
          console.log(`\n   🔧 Fixing Unit ${unitId} in ${billDoc.id}:`);
          console.log(`      Current paidAmount: ${currentPaidAmount} centavos ($${(currentPaidAmount/100).toFixed(2)})`);
          console.log(`      basePaid: ${basePaid} centavos ($${(basePaid/100).toFixed(2)})`);
          console.log(`      penaltyPaid: ${penaltyPaid} centavos ($${(penaltyPaid/100).toFixed(2)})`);
          console.log(`      Correct paidAmount: ${correctPaidAmount} centavos ($${(correctPaidAmount/100).toFixed(2)})`);
          
          const billRef = db.collection('clients').doc(clientId)
            .collection('projects').doc('waterBills')
            .collection('bills').doc(billDoc.id);
          
          batch.update(billRef, {
            [`bills.units.${unitId}.paidAmount`]: correctPaidAmount
          });
          
          fixCount++;
        }
      }
    }
    
    if (fixCount > 0) {
      console.log(`\n   💾 Committing ${fixCount} fixes for ${clientId}...`);
      await batch.commit();
      console.log(`   ✅ Fixed ${fixCount} bills for ${clientId}`);
    } else {
      console.log(`   ✅ No fixes needed for ${clientId}`);
    }
  }
  
  console.log('\n✅ paidAmount fix complete!');
  process.exit(0);
}

fixPaidAmounts().catch(error => {
  console.error('❌ Error fixing paidAmount:', error);
  process.exit(1);
});

