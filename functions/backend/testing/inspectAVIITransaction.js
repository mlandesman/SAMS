/**
 * Inspect AVII transaction 2025-07-17_211044_563 to debug why it's not being found
 */

import { getDb } from '../firebase.js';

async function inspectTransaction() {
  const db = await getDb();
  const transactionId = '2025-07-17_211044_563';
  const clientId = 'AVII';
  const unitId = '101';
  
  console.log(`\n🔍 Inspecting transaction ${transactionId} for unit ${unitId}...\n`);
  
  try {
    // Get the transaction
    const txDoc = await db.collection('clients').doc(clientId)
      .collection('transactions').doc(transactionId)
      .get();
    
    if (!txDoc.exists) {
      console.log('❌ Transaction not found');
      process.exit(1);
    }
    
    const transaction = txDoc.data();
    
    console.log('Transaction Data:');
    console.log(`  ID: ${txDoc.id}`);
    console.log(`  unitId: ${transaction.unitId}`);
    console.log(`  unit (legacy): ${transaction.unit}`);
    console.log(`  date: ${transaction.date}`);
    console.log(`  amount: ${transaction.amount} (centavos)`);
    console.log(`  allocations count: ${transaction.allocations?.length || 0}`);
    
    if (transaction.allocations) {
      console.log('\nAllocations:');
      transaction.allocations.forEach((alloc, i) => {
        console.log(`  ${i + 1}. categoryId: ${alloc.categoryId}`);
        console.log(`     amount: ${alloc.amount} (centavos)`);
        console.log(`     data:`, JSON.stringify(alloc.data, null, 2));
        console.log(`     targetName: ${alloc.targetName}`);
      });
    }
    
    // Check date parsing
    const txDate = transaction.date?.toDate?.() || new Date(transaction.date);
    console.log(`\nParsed date: ${txDate.toISOString()}`);
    console.log(`Date string: ${transaction.date}`);
    
    // Check if it would be included in Fiscal Year 2026
    const statementEndDate = new Date('2026-06-30');
    console.log(`\nStatement end date: ${statementEndDate.toISOString()}`);
    console.log(`Transaction date <= statement end: ${txDate <= statementEndDate}`);
    
    // Check unit matching
    console.log(`\nUnit matching:`);
    console.log(`  unitId match: ${transaction.unitId === unitId}`);
    console.log(`  unit (legacy) match: ${transaction.unit === unitId}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

inspectTransaction();

