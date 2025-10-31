/**
 * Check if delete reversal worked for transaction 2025-10-15_185009_708
 */

import { getDb } from '../firebase.js';

async function checkDeleteReversal() {
  console.log('🔍 Checking Delete Reversal for Transaction: 2025-10-15_185009_708');
  console.log('═'.repeat(80));
  
  const clientId = 'AVII';
  const unitId = '102'; // From the frontend log - Unit 102
  const transactionId = '2025-10-15_185009_708';
  
  try {
    const db = await getDb();
    
    // Check 1: Is transaction still in database?
    console.log('\n1️⃣  Checking if transaction was deleted...');
    const txnRef = db.collection('clients').doc(clientId)
      .collection('transactions').doc(transactionId);
    const txnDoc = await txnRef.get();
    
    if (txnDoc.exists) {
      console.log('   ❌ Transaction STILL EXISTS (not deleted)');
      console.log('   Data:', JSON.stringify(txnDoc.data(), null, 2));
    } else {
      console.log('   ✅ Transaction deleted from database');
    }
    
    // Check 2: Bill documents - August 2025 (month 1)
    console.log('\n2️⃣  Checking August 2025 bill (2026-01)...');
    const augustBillRef = db.collection('clients').doc(clientId)
      .collection('projects').doc('waterBills')
      .collection('bills').doc('2026-01');
    const augustBill = await augustBillRef.get();
    
    if (augustBill.exists) {
      const augustData = augustBill.data();
      const unit102August = augustData.bills?.units?.['102'];
      
      if (unit102August) {
        console.log('   Bill status:', unit102August.status);
        console.log('   Paid amount:', unit102August.paidAmount);
        console.log('   Transaction ID:', unit102August.lastPayment?.transactionId || 'null');
        console.log('   Payments array:', unit102August.payments?.length || 0, 'entries');
        
        if (unit102August.lastPayment?.transactionId === transactionId) {
          console.log('   ❌ Bill STILL shows deleted transaction!');
        } else {
          console.log('   ✅ Bill transaction reference cleared');
        }
        
        if (unit102August.status === 'paid') {
          console.log('   ❌ Bill STILL marked as paid (should be unpaid)');
        } else {
          console.log('   ✅ Bill marked as unpaid');
        }
      }
    }
    
    // Check 3: Bill documents - September 2025 (month 2)
    console.log('\n3️⃣  Checking September 2025 bill (2026-02)...');
    const septBillRef = db.collection('clients').doc(clientId)
      .collection('projects').doc('waterBills')
      .collection('bills').doc('2026-02');
    const septBill = await septBillRef.get();
    
    if (septBill.exists) {
      const septData = septBill.data();
      const unit102Sept = septData.bills?.units?.['102'];
      
      if (unit102Sept) {
        console.log('   Bill status:', unit102Sept.status);
        console.log('   Paid amount:', unit102Sept.paidAmount);
        console.log('   Transaction ID:', unit102Sept.lastPayment?.transactionId || 'null');
        console.log('   Payments array:', unit102Sept.payments?.length || 0, 'entries');
        
        if (unit102Sept.lastPayment?.transactionId === transactionId) {
          console.log('   ❌ Bill STILL shows deleted transaction!');
        } else {
          console.log('   ✅ Bill transaction reference cleared');
        }
        
        if (unit102Sept.status === 'paid') {
          console.log('   ❌ Bill STILL marked as paid (should be unpaid)');
        } else {
          console.log('   ✅ Bill marked as unpaid');
        }
      }
    }
    
    // Check 4: Credit balance and history
    console.log('\n4️⃣  Checking credit balance for Unit 102...');
    const fiscalYear = 2024; // Fiscal year 2024-2025 (July 2024 - June 2025)
    const duesRef = db.collection('clients').doc(clientId)
      .collection('units').doc(unitId)
      .collection('dues').doc(fiscalYear.toString());
    const duesDoc = await duesRef.get();
    
    if (duesDoc.exists) {
      const duesData = duesDoc.data();
      console.log('   Credit balance:', duesData.creditBalance, 'centavos');
      console.log('   History entries:', duesData.creditBalanceHistory?.length || 0);
      
      // Look for reversal entry
      const reversalEntry = duesData.creditBalanceHistory?.find(e => 
        e.transactionId === transactionId + '_reversal'
      );
      
      if (reversalEntry) {
        console.log('   ✅ Found reversal entry:', reversalEntry);
      } else {
        console.log('   ❌ No reversal entry found');
      }
      
      // Look for original transaction entries
      const originalEntries = duesData.creditBalanceHistory?.filter(e => 
        e.transactionId === transactionId
      );
      
      if (originalEntries && originalEntries.length > 0) {
        console.log('   ❌ Original transaction entries STILL in history:', originalEntries.length);
        originalEntries.forEach(e => console.log('      -', e.type, e.amount));
      } else {
        console.log('   ✅ Original transaction entries removed from history');
      }
    } else {
      console.log('   ⚠️  HOA Dues document not found');
    }
    
    // Check 5: AggregatedData
    console.log('\n5️⃣  Checking aggregatedData...');
    const aggDataRef = db.collection('clients').doc(clientId)
      .collection('projects').doc('waterBills')
      .collection('aggregatedData').doc('2026');
    const aggData = await aggDataRef.get();
    
    if (aggData.exists) {
      const data = aggData.data();
      console.log('   lastPenaltyUpdate:', data.lastPenaltyUpdate?.toDate?.() || data.lastPenaltyUpdate);
      
      // Check Unit 102 in August and September
      const augustUnit = data.months?.[1]?.units?.['102'];
      const septUnit = data.months?.[2]?.units?.['102'];
      
      if (augustUnit) {
        console.log('\n   August Unit 102:');
        console.log('      Status:', augustUnit.status);
        console.log('      Due:', augustUnit.due);
        console.log('      Paid:', augustUnit.paidAmount);
      }
      
      if (septUnit) {
        console.log('\n   September Unit 102:');
        console.log('      Status:', septUnit.status);
        console.log('      Due:', septUnit.due);
        console.log('      Paid:', septUnit.paidAmount);
      }
    }
    
    console.log('\n' + '═'.repeat(80));
    console.log('SUMMARY');
    console.log('═'.repeat(80));
    console.log('This diagnostic will show what actually happened vs what should have happened.');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error(error.stack);
  }
}

checkDeleteReversal().catch(console.error);

