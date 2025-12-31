/**
 * Export AVII Statement Data to CSV for all 10 units
 * Direct Firestore query - shows credit balances and transactions
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getCreditBalance } from '../../shared/utils/creditBalanceUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const environment = process.argv[2] || 'dev';

// Initialize Firebase
if (getApps().length === 0) {
  const serviceAccountPath = environment === 'prod'
    ? path.resolve(__dirname, '../serviceAccountKey-prod.json')
    : path.resolve(__dirname, '../serviceAccountKey.json');
  
  const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

// All 10 AVII units
const units = ['101', '102', '103', '104', '105', '106', '201', '202', '203', '204'];

function formatCurrency(amount) {
  return `$${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateVal) {
  if (!dateVal) return '';
  if (typeof dateVal === 'string') return dateVal.split('T')[0];
  if (dateVal.toDate) return dateVal.toDate().toISOString().split('T')[0];
  return '';
}

async function exportToCSV() {
  console.log(`\n📊 Exporting AVII Statement Data to CSV (${environment.toUpperCase()})\n`);
  
  const allTransactions = [];
  const creditHistoryRows = [];
  const summaryRows = [];
  
  for (const unitId of units) {
    console.log(`\n--- Unit ${unitId} ---`);
    
    try {
      // Get credit balance document
      const creditRef = db.collection('clients').doc('AVII')
        .collection('units').doc(unitId)
        .collection('creditBalances').doc('current');
      const creditDoc = await creditRef.get();
      const creditData = creditDoc.exists ? creditDoc.data() : { history: [] };
      
      // Calculate credit balance from history
      const creditBalance = getCreditBalance(creditData) / 100; // Convert to pesos
      
      // Get transactions for this unit (no orderBy to avoid index requirement)
      const txnRef = db.collection('clients').doc('AVII')
        .collection('transactions')
        .where('unitId', '==', unitId);
      const txnSnapshot = await txnRef.get();
      
      // Sort in memory
      const txns = [];
      txnSnapshot.forEach(doc => txns.push({ id: doc.id, ...doc.data() }));
      txns.sort((a, b) => {
        const dateA = formatDate(a.date);
        const dateB = formatDate(b.date);
        return dateA.localeCompare(dateB);
      });
      
      let totalCharges = 0;
      let totalPayments = 0;
      
      for (const txn of txns) {
        const amount = (txn.amount || 0) / 100; // Convert centavos to pesos
        const date = formatDate(txn.date);
        
        if (amount < 0) {
          // Expense/charge
          totalCharges += Math.abs(amount);
          allTransactions.push({
            unit: unitId,
            date,
            description: txn.notes || txn.description || '',
            charge: Math.abs(amount).toFixed(2),
            payment: '',
            type: txn.type || ''
          });
        } else if (amount > 0) {
          // Payment/income
          totalPayments += amount;
          allTransactions.push({
            unit: unitId,
            date,
            description: txn.notes || txn.description || '',
            charge: '',
            payment: amount.toFixed(2),
            type: txn.type || ''
          });
        }
      }
      
      // Calculate final balance (charges - payments)
      const finalBalance = totalCharges - totalPayments;
      
      console.log(`   Transactions: ${txns.length}`);
      console.log(`   Total Charges: ${formatCurrency(totalCharges)}`);
      console.log(`   Total Payments: ${formatCurrency(totalPayments)}`);
      console.log(`   Final Balance: ${formatCurrency(finalBalance)}`);
      console.log(`   Credit Balance: ${formatCurrency(creditBalance)}`);
      
      // Credit history
      if (creditData.history && creditData.history.length > 0) {
        console.log(`   Credit History: ${creditData.history.length} entries`);
        for (const entry of creditData.history) {
          creditHistoryRows.push({
            unit: unitId,
            date: entry.timestamp ? entry.timestamp.split('T')[0] : '',
            type: entry.type || '',
            amount: (entry.amount / 100).toFixed(2),
            notes: entry.notes || '',
            transactionId: entry.transactionId || ''
          });
        }
      }
      
      summaryRows.push({
        unit: unitId,
        transactionCount: txns.length,
        totalCharges,
        totalPayments,
        finalBalance,
        creditBalance,
        creditHistoryCount: creditData.history?.length || 0
      });
      
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
      summaryRows.push({
        unit: unitId,
        transactionCount: 0,
        totalCharges: 0,
        totalPayments: 0,
        finalBalance: 0,
        creditBalance: 0,
        creditHistoryCount: 0,
        error: err.message
      });
    }
  }
  
  // Write summary CSV
  const summaryCSV = [
    'Unit,Transaction Count,Total Charges,Total Payments,Final Balance,Credit Balance,Credit History Entries',
    ...summaryRows.map(r => 
      `${r.unit},${r.transactionCount},${r.totalCharges.toFixed(2)},${r.totalPayments.toFixed(2)},${r.finalBalance.toFixed(2)},${r.creditBalance.toFixed(2)},${r.creditHistoryCount}`
    )
  ].join('\n');
  
  const summaryPath = path.resolve(__dirname, '../../../test-results/AVII_Statement_Summary.csv');
  await writeFile(summaryPath, summaryCSV);
  console.log(`\n💾 Summary saved: ${summaryPath}`);
  
  // Write transactions CSV  
  const txnCSV = [
    'Unit,Date,Description,Charge,Payment,Type',
    ...allTransactions.map(t => 
      `${t.unit},"${t.date}","${(t.description || '').replace(/"/g, '""')}",${t.charge},${t.payment},${t.type}`
    )
  ].join('\n');
  
  const txnPath = path.resolve(__dirname, '../../../test-results/AVII_Statement_Transactions.csv');
  await writeFile(txnPath, txnCSV);
  console.log(`💾 Transactions saved: ${txnPath}`);
  
  // Write credit history CSV
  const creditCSV = [
    'Unit,Date,Type,Amount,Notes,Transaction ID',
    ...creditHistoryRows.map(c => 
      `${c.unit},"${c.date}",${c.type},${c.amount},"${(c.notes || '').replace(/"/g, '""')}",${c.transactionId}`
    )
  ].join('\n');
  
  const creditPath = path.resolve(__dirname, '../../../test-results/AVII_Credit_History.csv');
  await writeFile(creditPath, creditCSV);
  console.log(`💾 Credit History saved: ${creditPath}`);
  
  // Print summary table
  console.log('\n' + '='.repeat(110));
  console.log('📋 STATEMENT SUMMARY');
  console.log('='.repeat(110));
  console.log('Unit  | Txns  | Charges      | Payments     | Balance      | Credit Bal   | History');
  console.log('-'.repeat(110));
  
  for (const r of summaryRows) {
    console.log(
      `${String(r.unit).padEnd(5)} | ` +
      `${String(r.transactionCount).padStart(5)} | ` +
      `${formatCurrency(r.totalCharges).padStart(12)} | ` +
      `${formatCurrency(r.totalPayments).padStart(12)} | ` +
      `${formatCurrency(r.finalBalance).padStart(12)} | ` +
      `${formatCurrency(r.creditBalance).padStart(12)} | ` +
      `${String(r.creditHistoryCount).padStart(7)}`
    );
  }
  
  console.log('='.repeat(110));
}

exportToCSV()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });

