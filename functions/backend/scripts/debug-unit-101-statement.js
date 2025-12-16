/**
 * Debug Unit 101 Statement Calculation
 * 
 * Understand why Statement shows -$146.69 when Firestore shows $1,750 owed
 * 
 * Usage: node backend/scripts/debug-unit-101-statement.js
 */

import admin from 'firebase-admin';
import { readFile } from 'fs/promises';

// Initialize Firebase Admin
const serviceAccountPath = new URL('../serviceAccountKey.json', import.meta.url);
const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const CLIENT_ID = 'AVII';
const UNIT_ID = '101';

function centavosToPesos(centavos) {
  return (centavos / 100).toFixed(2);
}

async function debugStatement() {
  console.log('🔍 Debug Unit 101 Statement Calculation - AVII');
  console.log('=' .repeat(70));

  // Check the creditBalances document structure
  console.log('\n📋 SECTION 1: Credit Balance Document Structure');
  console.log('-'.repeat(50));
  
  const creditBalancesDoc = await db.collection('clients').doc(CLIENT_ID)
    .collection('units').doc('creditBalances')
    .get();
  
  if (creditBalancesDoc.exists) {
    const creditBalances = creditBalancesDoc.data();
    console.log('Full creditBalances document:');
    console.log(JSON.stringify(creditBalances, null, 2));
    
    const unit101Credit = creditBalances[UNIT_ID];
    if (unit101Credit) {
      console.log(`\nUnit 101 credit balance object:`);
      console.log(JSON.stringify(unit101Credit, null, 2));
    }
  }

  // Check all transactions for Unit 101 (not just filtered)
  console.log('\n📋 SECTION 2: ALL Transactions for Unit 101');
  console.log('-'.repeat(50));
  
  // Query by unitId
  const txnsByUnitId = await db.collection('clients').doc(CLIENT_ID)
    .collection('transactions')
    .where('unitId', '==', UNIT_ID)
    .get();
  
  console.log(`Transactions with unitId=${UNIT_ID}: ${txnsByUnitId.size}`);
  
  // Also query by unit field (legacy)
  const txnsByUnit = await db.collection('clients').doc(CLIENT_ID)
    .collection('transactions')
    .where('unit', '==', UNIT_ID)
    .get();
  
  console.log(`Transactions with unit=${UNIT_ID}: ${txnsByUnit.size}`);
  
  // Get ALL transactions and filter
  const allTxns = await db.collection('clients').doc(CLIENT_ID)
    .collection('transactions')
    .get();
  
  console.log(`\nTotal transactions in collection: ${allTxns.size}`);
  
  let unit101Txns = [];
  allTxns.forEach(doc => {
    const txn = doc.data();
    if (txn.unitId === UNIT_ID || txn.unit === UNIT_ID) {
      unit101Txns.push({ id: doc.id, ...txn });
    }
  });
  
  console.log(`Unit 101 transactions found: ${unit101Txns.length}`);
  
  if (unit101Txns.length > 0) {
    console.log('\nAll Unit 101 transactions:');
    for (const txn of unit101Txns.sort((a, b) => a.id.localeCompare(b.id))) {
      console.log(`\n  📄 ${txn.id}:`);
      console.log(`     Date: ${txn.date?.toDate?.() || txn.date}`);
      console.log(`     Amount: ${txn.amount} centavos ($${centavosToPesos(txn.amount || 0)})`);
      console.log(`     Type: ${txn.type}`);
      console.log(`     Category: ${txn.category}`);
      console.log(`     Notes: ${txn.notes?.substring(0, 100) || 'N/A'}`);
      
      if (txn.allocations) {
        console.log(`     Allocations (${txn.allocations.length}):`);
        for (const alloc of txn.allocations) {
          console.log(`       - ${alloc.categoryId}: $${centavosToPesos(alloc.amount || 0)}`);
          console.log(`         target: ${alloc.targetName || 'N/A'}`);
        }
      }
    }
  }

  // Check if there's a waterBills subcollection at unit level (legacy structure)
  console.log('\n📋 SECTION 3: Check Legacy Unit-Level Water Bills');
  console.log('-'.repeat(50));
  
  const unitWaterBillsSnapshot = await db.collection('clients').doc(CLIENT_ID)
    .collection('units').doc(UNIT_ID)
    .collection('waterBills')
    .get();
  
  if (!unitWaterBillsSnapshot.empty) {
    console.log(`Found ${unitWaterBillsSnapshot.size} legacy water bills at unit level!`);
    unitWaterBillsSnapshot.forEach(doc => {
      const bill = doc.data();
      console.log(`\n  📄 ${doc.id}:`);
      console.log(`     Amount: ${bill.amount} centavos ($${centavosToPesos(bill.amount || 0)})`);
      console.log(`     Status: ${bill.status}`);
      console.log(`     Consumption: ${bill.consumption}`);
    });
  } else {
    console.log('No legacy unit-level water bills found');
  }

  // Check the unit document itself
  console.log('\n📋 SECTION 4: Unit Document');
  console.log('-'.repeat(50));
  
  const unitDoc = await db.collection('clients').doc(CLIENT_ID)
    .collection('units').doc(UNIT_ID)
    .get();
  
  if (unitDoc.exists) {
    const unitData = unitDoc.data();
    console.log('Unit 101 document fields:');
    console.log(JSON.stringify(unitData, null, 2));
  }

  // Check waterBills project document (parent of bills collection)
  console.log('\n📋 SECTION 5: waterBills Project Document');
  console.log('-'.repeat(50));
  
  const waterBillsProjectDoc = await db.collection('clients').doc(CLIENT_ID)
    .collection('projects').doc('waterBills')
    .get();
  
  if (waterBillsProjectDoc.exists) {
    const projectData = waterBillsProjectDoc.data();
    console.log('waterBills project document:');
    console.log(JSON.stringify(projectData, null, 2));
  } else {
    console.log('No waterBills project document found');
  }

  // Check Statement of Account calculation components
  console.log('\n📋 SECTION 6: Statement Calculation Analysis');
  console.log('-'.repeat(50));
  
  // Get Q1 2026 bill details
  const q1Doc = await db.collection('clients').doc(CLIENT_ID)
    .collection('projects').doc('waterBills')
    .collection('bills').doc('2026-Q1')
    .get();
  
  // Get Q2 2026 bill details
  const q2Doc = await db.collection('clients').doc(CLIENT_ID)
    .collection('projects').doc('waterBills')
    .collection('bills').doc('2026-Q2')
    .get();
  
  let statementCalc = {
    q1: null,
    q2: null,
    totalCharged: 0,
    totalPaid: 0,
    balance: 0
  };
  
  if (q1Doc.exists) {
    const q1Data = q1Doc.data();
    const unit101Q1 = q1Data.bills?.units?.[UNIT_ID];
    if (unit101Q1) {
      statementCalc.q1 = {
        charge: unit101Q1.currentCharge || 0,
        penalty: unit101Q1.penaltyAmount || 0,
        total: unit101Q1.totalAmount || 0,
        basePaid: unit101Q1.basePaid || 0,
        penaltyPaid: unit101Q1.penaltyPaid || 0,
        paidAmount: unit101Q1.paidAmount || 0,
        status: unit101Q1.status
      };
      statementCalc.totalCharged += statementCalc.q1.total;
      statementCalc.totalPaid += statementCalc.q1.basePaid + statementCalc.q1.penaltyPaid;
    }
  }
  
  if (q2Doc.exists) {
    const q2Data = q2Doc.data();
    const unit101Q2 = q2Data.bills?.units?.[UNIT_ID];
    if (unit101Q2) {
      statementCalc.q2 = {
        charge: unit101Q2.currentCharge || 0,
        penalty: unit101Q2.penaltyAmount || 0,
        total: unit101Q2.totalAmount || 0,
        basePaid: unit101Q2.basePaid || 0,
        penaltyPaid: unit101Q2.penaltyPaid || 0,
        paidAmount: unit101Q2.paidAmount || 0,
        status: unit101Q2.status
      };
      statementCalc.totalCharged += statementCalc.q2.total;
      statementCalc.totalPaid += statementCalc.q2.basePaid + statementCalc.q2.penaltyPaid;
    }
  }
  
  statementCalc.balance = statementCalc.totalCharged - statementCalc.totalPaid;
  
  console.log('\nStatement Calculation Breakdown:');
  console.log(JSON.stringify(statementCalc, null, 2));
  
  console.log('\n💡 SUMMARY:');
  console.log(`   Q1 Owed: $${centavosToPesos((statementCalc.q1?.total || 0) - (statementCalc.q1?.basePaid || 0) - (statementCalc.q1?.penaltyPaid || 0))}`);
  console.log(`   Q2 Owed: $${centavosToPesos((statementCalc.q2?.total || 0) - (statementCalc.q2?.basePaid || 0) - (statementCalc.q2?.penaltyPaid || 0))}`);
  console.log(`   Total Balance: $${centavosToPesos(statementCalc.balance)}`);
  console.log('');
  console.log('   ⚠️  The -$146.69 display must be calculated elsewhere');
  console.log('   ⚠️  Q2 2026 ($1,400) should NOT exist - these are phantom charges');

  console.log('\n' + '=' .repeat(70));
  process.exit(0);
}

debugStatement().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
