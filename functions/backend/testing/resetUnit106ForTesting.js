#!/usr/bin/env node
/**
 * Reset Unit 106 HOA data to pre-payment state for testing Enhancement #74
 * 
 * This restores the data to:
 * - Q1 (months 0-2): Fully paid ($12,020.31 each)
 * - Q2 month 0 (index 3, Oct): Fully paid ($12,020.31) 
 * - Q2 months 1-2 (indices 4-5, Nov-Dec): Unpaid
 * - Credit balance: $10,125.86
 */

import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const serviceAccountPath = join(__dirname, '../serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Service account key not found at:', serviceAccountPath);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function resetUnit106() {
  const clientId = 'AVII';
  const unitId = '106';
  const year = '2026';
  
  console.log(`🔄 Resetting Unit ${unitId} HOA data for year ${year}...`);
  
  const duesRef = db.collection('clients').doc(clientId)
    .collection('units').doc(unitId)
    .collection('dues').doc(year);
  
  const doc = await duesRef.get();
  if (!doc.exists) {
    console.error('❌ Dues document not found');
    process.exit(1);
  }
  
  const data = doc.data();
  const scheduledAmount = data.scheduledAmount; // 1202031 centavos
  
  // Restore payments to pre-Dec-17 state
  const restoredPayments = [
    // Q1 - months 0, 1, 2 (Jul, Aug, Sep) - PAID
    {
      date: "2025-07-11T05:00:00.000Z",
      method: "bank",
      amount: scheduledAmount,
      reference: "2025-07-11_120619_414",
      transactionId: "2025-07-11_120619_414",
      basePaid: scheduledAmount,
      penaltyPaid: 0,
      paid: true,
      status: 'paid',
      notes: "Jul 2025 - Q1 Month 1"
    },
    {
      date: "2025-07-11T05:00:00.000Z",
      method: "bank", 
      amount: scheduledAmount,
      reference: "2025-07-11_120619_414",
      transactionId: "2025-07-11_120619_414",
      basePaid: scheduledAmount,
      penaltyPaid: 0,
      paid: true,
      status: 'paid',
      notes: "Aug 2025 - Q1 Month 2"
    },
    {
      date: "2025-10-16T05:00:00.000Z",
      method: "bank",
      amount: scheduledAmount,
      reference: "2025-10-16_120729_285",
      transactionId: "2025-10-16_120729_285",
      basePaid: scheduledAmount,
      penaltyPaid: 0,
      paid: true,
      status: 'paid',
      notes: "Sep 2025 - Q1 Month 3"
    },
    // Q2 - month 3 (Oct) - PAID (this is the key partial payment)
    {
      date: "2025-11-27T05:00:00.466Z",
      method: "bank",
      amount: scheduledAmount,
      reference: "2025-11-27_120747_822",
      transactionId: "2025-11-27_120747_822",
      basePaid: scheduledAmount,
      penaltyPaid: 0,
      paid: true,
      status: 'paid',
      notes: "Oct 2025 - Q2 Month 1"
    },
    // Q2 - months 4, 5 (Nov, Dec) - UNPAID
    {
      amount: 0,
      basePaid: 0,
      penaltyPaid: 0,
      paid: false,
      status: 'unpaid',
      date: null,
      reference: null,
      notes: null
    },
    {
      amount: 0,
      basePaid: 0,
      penaltyPaid: 0,
      paid: false,
      status: 'unpaid',
      date: null,
      reference: null,
      notes: null
    },
    // Q3 and Q4 - unpaid
    null, null, null, null, null, null
  ];
  
  // Calculate total paid
  const totalPaid = restoredPayments.reduce((sum, p) => sum + (p?.amount || 0), 0);
  
  // Update the dues document
  await duesRef.update({
    payments: restoredPayments,
    totalPaid: totalPaid,
    _resetForTesting: new Date().toISOString()
  });
  
  console.log(`✅ HOA Reset complete!`);
  console.log(`   - Q1 (Jul-Sep): 3 months paid @ $${(scheduledAmount/100).toFixed(2)}`);
  console.log(`   - Q2 Oct: 1 month paid @ $${(scheduledAmount/100).toFixed(2)}`);
  console.log(`   - Q2 Nov-Dec: 2 months UNPAID`);
  console.log(`   - Total paid: $${(totalPaid/100).toFixed(2)}`);
  console.log(`\n   Ready for testing: Q2 should show ~$24,040.62 base + ~$2,464.16 penalty owed`);
  console.log(`\n⚠️  NOTE: Credit balance must be reset manually via Firebase Console`);
  console.log(`   Path: /clients/AVII/units/creditBalances -> 106.balance = 1012586`);
  
  process.exit(0);
}

resetUnit106().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
