import { getDb } from '../firebase.js';

async function verifyPaymentRecording() {
  try {
    console.log('🔍 Verifying payment recording in database...');
    
    const db = await getDb();
    
    // Check July bill for Unit 203
    const julyBillDoc = await db
      .collection('clients').doc('AVII')
      .collection('projects').doc('waterBills')
      .collection('bills').doc('2026-00')
      .get();
    
    if (julyBillDoc.exists) {
      const billData = julyBillDoc.data();
      const unit203 = billData.bills?.units?.[203];
      
      console.log('\n📋 Unit 203 July Bill (Raw Database):');
      console.log('  Raw bill data:', JSON.stringify(unit203, null, 2));
      
      if (unit203) {
        console.log('\n📊 Payment Analysis:');
        console.log(`  Total Amount: $${unit203.totalAmount}`);
        console.log(`  Paid Amount: $${unit203.paidAmount || 0}`);
        console.log(`  Unpaid Amount: $${(unit203.totalAmount || 0) - (unit203.paidAmount || 0)}`);
        console.log(`  Status: ${unit203.status}`);
        console.log(`  Last Payment:`, unit203.lastPayment);
      }
    } else {
      console.log('❌ July bill document not found');
    }
    
    // Check August bill for Unit 203
    const augustBillDoc = await db
      .collection('clients').doc('AVII')
      .collection('projects').doc('waterBills')
      .collection('bills').doc('2026-01')
      .get();
    
    if (augustBillDoc.exists) {
      const billData = augustBillDoc.data();
      const unit203 = billData.bills?.units?.[203];
      
      console.log('\n📋 Unit 203 August Bill (Raw Database):');
      console.log('  Raw bill data:', JSON.stringify(unit203, null, 2));
    } else {
      console.log('❌ August bill document not found');
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

verifyPaymentRecording();