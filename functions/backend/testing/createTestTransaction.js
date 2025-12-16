/**
 * Create a test unified transaction and inspect its structure
 */

import { tokenManager } from './tokenManager.js';
import fetch from 'node-fetch';
import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccount = JSON.parse(
  await import('fs').then(fs => 
    fs.promises.readFile(join(__dirname, '../../sandyland-management-system-firebase-adminsdk-fbsvc-a06371f054.json'), 'utf8')
  )
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const BASE_URL = 'http://localhost:5001';
const TEST_CLIENT = 'AVII';
const TEST_UNIT = '102';
const PAYMENT_AMOUNT = 25000;

async function getAuthHeaders() {
  const token = await tokenManager.getToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

async function createAndInspect() {
  console.log(`\n🔧 Creating test unified transaction...\n`);
  
  try {
    // Get preview
    const previewResponse = await fetch(`${BASE_URL}/payments/unified/preview`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        clientId: TEST_CLIENT,
        unitId: TEST_UNIT,
        amount: PAYMENT_AMOUNT,
        paymentDate: new Date().toISOString().split('T')[0]
      })
    });
    
    const previewResult = await previewResponse.json();
    const preview = previewResult.preview;
    
    console.log(`Preview: HOA=${preview.hoa.monthsAffected?.length || 0}, Water=${preview.water.billsAffected?.length || 0}`);
    
    // Record payment
    const recordResponse = await fetch(`${BASE_URL}/payments/unified/record`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        clientId: TEST_CLIENT,
        unitId: TEST_UNIT,
        amount: PAYMENT_AMOUNT,
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'eTransfer',
        reference: 'INSPECT-TEST',
        accountId: 'bank-001',
        accountType: 'bank',
        preview: preview
      })
    });
    
    const recordResult = await recordResponse.json();
    const transactionId = recordResult.result?.transactionId;
    
    console.log(`\n✅ Transaction created: ${transactionId}\n`);
    
    // Wait for Firestore consistency
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Inspect the transaction document
    const doc = await db
      .collection('clients').doc(TEST_CLIENT)
      .collection('transactions').doc(transactionId)
      .get();
    
    if (!doc.exists) {
      console.log('❌ Transaction document not found in Firestore!');
      process.exit(1);
    }
    
    const data = doc.data();
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('FULL TRANSACTION DOCUMENT');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log(JSON.stringify(data, null, 2));
    
    console.log('\n\n═══════════════════════════════════════════════════════');
    console.log('ALLOCATION STRUCTURE ANALYSIS');
    console.log('═══════════════════════════════════════════════════════\n');
    
    if (data.allocations) {
      data.allocations.forEach((a, i) => {
        console.log(`Allocation ${i + 1}:`);
        console.log(`  Type: ${a.type}`);
        console.log(`  Category: ${a.categoryName}`);
        console.log(`  Amount: $${(a.amount / 100).toFixed(2)}`);
        console.log(`  Data:`, a.data);
        console.log('');
      });
    } else {
      console.log('NO ALLOCATIONS FOUND');
    }
    
    console.log('\n💾 Transaction NOT deleted - available for inspection');
    console.log(`📋 Transaction ID: ${transactionId}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

createAndInspect();

