// Script to test HOA dues data structure
// Performs a sample payment and verifies both transaction and dues records are created properly

import { getDb } from '../backend/firebase.js';
import { writeFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Mock data for testing
const clientId = 'MTC';
const unitId = 'TEST';
const year = 2025;
const amount = 5000;

// Initialize Firebase
async function main() {
  console.log('Starting HOA Dues data structure test...');

  try {
    // Get database instance
    const db = await getDb();
    
    // Test 1: Verify we can access the client data
    console.log(`Test 1: Accessing client data for ${clientId}...`);
    const clientDoc = await db.collection('clients').doc(clientId).get();
    console.log(`Client exists: ${clientDoc.exists}`);

    if (!clientDoc.exists) {
      throw new Error(`Client ${clientId} not found`);
    }
    
    // Test 2: Verify we can access the unit data
    console.log(`Test 2: Accessing unit data for ${unitId}...`);
    const unitDocRef = db.collection('clients').doc(clientId).collection('units').doc(unitId);
    
    // Make sure the test unit exists, if not create it
    const unitDoc = await unitDocRef.get();
    if (!unitDoc.exists) {
      console.log(`Creating test unit ${unitId}...`);
      await unitDocRef.set({
        name: `Test Unit ${unitId}`,
        duesAmount: 4400,
        created: new Date()
      });
    }
    
    // Test 3: Verify we can access and create dues data
    console.log(`Test 3: Accessing dues data for ${unitId}, year ${year}...`);
    const duesDocRef = db.collection('clients').doc(clientId)
      .collection('units').doc(unitId)
      .collection('dues').doc(year.toString());
    
    // Initialize with test data if it doesn't exist
    const duesDoc = await duesDocRef.get();
    if (!duesDoc.exists) {
      console.log(`Creating test dues record for ${unitId}, year ${year}...`);
      await duesDocRef.set({
        scheduledAmount: 4400,
        creditBalance: 0,
        payments: []
      });
    }

    // Test 4: Create a test transaction
    console.log('Test 4: Creating test transaction...');
    const transactionRef = db.collection('clients').doc(clientId).collection('transactions').doc();
    const transactionId = transactionRef.id;
    const now = new Date();
    
    const transactionData = {
      date: now,
      amount: amount,
      category: 'HOA Dues',
      transactionType: 'income',
      accountType: 'Bank',  
      paymentMethod: 'Check',
      notes: `Test payment for Unit ${unitId} - June, July 2025`,
      unit: unitId,  
      vendor: 'Deposit',
      reference: `DUES-${unitId}-${year}`,
      checkNumber: '12345',
      duesDistribution: [
        { month: 6, amount: 2500, year },
        { month: 7, amount: 2500, year }
      ],
      metadata: {
        type: 'hoa_dues',
        unitId,
        year,
        months: [6, 7]
      },
      createdAt: now
    };
    
    await transactionRef.set(transactionData);
    console.log(`Created transaction with ID: ${transactionId}`);
    
    // Test 5: Update dues record with the payment
    console.log('Test 5: Updating dues record with payment...');
    const existingDuesData = (await duesDocRef.get()).data() || { 
      scheduledAmount: 4400,
      creditBalance: 0, 
      payments: [] 
    };
    
    // Add the payment records
    if (!Array.isArray(existingDuesData.payments)) {
      existingDuesData.payments = [];
    }
    
    // Add payment for June
    existingDuesData.payments.push({
      month: 6,
      paid: 2500,
      date: now.toISOString(),
      transactionId,
      notes: `Test payment (Transaction ID: ${transactionId})`
    });
    
    // Add payment for July
    existingDuesData.payments.push({
      month: 7,
      paid: 2500,
      date: now.toISOString(),
      transactionId,
      notes: `Test payment (Transaction ID: ${transactionId})`
    });
    
    // Update the dues record
    await duesDocRef.set(existingDuesData, { merge: true });
    console.log(`Updated dues record for ${unitId}, year ${year}`);
    
    // Test 6: Verify the data was saved correctly
    console.log('Test 6: Verifying saved data...');
    const savedTransaction = await transactionRef.get();
    const savedDues = await duesDocRef.get();
    
    console.log('Transaction data:', savedTransaction.data());
    console.log('Dues data:', savedDues.data());
    
    // Write the results to a file for examination
    writeFileSync('dues_test_results.json', JSON.stringify({
      transaction: savedTransaction.data(),
      dues: savedDues.data()
    }, null, 2));
    
    console.log('Test completed successfully, results written to dues_test_results.json');
  } catch (error) {
    console.error('Error during test:', error);
  }
}

main();
