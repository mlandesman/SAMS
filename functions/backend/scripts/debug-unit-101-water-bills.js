/**
 * Debug Unit 101 Water Bills
 * 
 * Shows detailed breakdown of SAMS water bill data for unit 101,
 * specifically focusing on Q1 2025 water bills and payments
 */

import { testHarness } from '../testing/testHarness.js';
import { getStatementData } from "../services/statementDataService.js";
import { getConsolidatedUnitData } from "../services/statementDataService.js";

const CLIENT_ID = 'AVII';
const UNIT_ID = '101';
const FISCAL_YEAR = 2026;

async function main() {
  await testHarness.runTest({
    name: 'Debug Unit 101 Water Bills',
    async test({ api }) {
      console.log('\n🔍 Debugging Unit 101 Water Bills');
      console.log('='.repeat(70));
      
      // Get raw consolidated data to see water bills details
      const rawData = await getConsolidatedUnitData(api, CLIENT_ID, UNIT_ID, FISCAL_YEAR, true);
      
      console.log('\n💧 RAW Water Bills Data:');
      console.log('='.repeat(70));
      if (rawData.waterBillsRaw && rawData.waterBillsRaw.length > 0) {
        rawData.waterBillsRaw.forEach((bill, idx) => {
          console.log(`\n${idx + 1}. Water Bill:`);
          console.log(`   Bill Period: ${bill.billPeriod || 'N/A'}`);
          console.log(`   Fiscal Quarter: Q${bill.fiscalQuarter || 'N/A'}`);
          console.log(`   Calendar Year: ${bill.calendarYear || 'N/A'}`);
          console.log(`   Current Charge: $${(bill.currentCharge || 0).toFixed(2)}`);
          console.log(`   Penalty Amount: $${(bill.penaltyAmount || 0).toFixed(2)}`);
          console.log(`   Total Amount: $${(bill.totalAmount || 0).toFixed(2)}`);
          console.log(`   Paid Amount: $${(bill.paidAmount || 0).toFixed(2)}`);
          console.log(`   Due Date: ${bill.dueDate || 'N/A'}`);
          console.log(`   Bill Notes: ${bill.billNotes || 'N/A'}`);
          console.log(`   Payments: ${bill.payments?.length || 0}`);
          if (bill.payments && bill.payments.length > 0) {
            let totalPayments = 0;
            bill.payments.forEach((payment, pIdx) => {
              console.log(`\n     Payment ${pIdx + 1}:`);
              console.log(`       Amount: $${(payment.amount || 0).toFixed(2)}`);
              console.log(`       Date: ${payment.date || 'N/A'}`);
              console.log(`       Transaction ID: ${payment.transactionId || 'N/A'}`);
              totalPayments += payment.amount || 0;
            });
            console.log(`\n     Total Payments: $${totalPayments.toFixed(2)}`);
          }
        });
      } else {
        console.log('  ❌ No water bills found in raw data');
      }
      
      // Fetch the specific transaction that's showing as the payment
      console.log('\n\n🔍 Fetching Payment Transaction Details:');
      console.log('='.repeat(70));
      
      // Fetch the specific transaction ID from the water bill payment
      const paymentTxnId = '2025-07-23_113711_011';
      try {
        const paymentTxn = await api.get(`/clients/${CLIENT_ID}/transactions/${paymentTxnId}`);
        const txn = paymentTxn.data;
        
        console.log(`\n💳 Transaction: ${txn.id}`);
        console.log(`   Date: ${txn.date?.display || txn.date || 'N/A'}`);
        console.log(`   Amount: $${((txn.amount || 0) / 100).toFixed(2)} (in centavos: ${txn.amount})`);
        console.log(`   Type: ${txn.type || 'N/A'}`);
        console.log(`   Notes: ${txn.notes || 'N/A'}`);
        console.log(`   Allocations: ${txn.allocations?.length || 0}`);
        
        if (txn.allocations && txn.allocations.length > 0) {
          let totalAllocated = 0;
          console.log(`\n   Allocation Breakdown:`);
          txn.allocations.forEach((alloc, aIdx) => {
            const allocAmount = (alloc.amount || 0) / 100;
            totalAllocated += allocAmount;
            console.log(`     ${aIdx + 1}. ${alloc.categoryName || 'N/A'} - ${alloc.type || 'N/A'}`);
            console.log(`        Amount: $${allocAmount.toFixed(2)}`);
            console.log(`        Target: ${alloc.targetName || 'N/A'}`);
            console.log(`        Category ID: ${alloc.categoryId || 'N/A'}`);
          });
          console.log(`\n   Total Allocated: $${totalAllocated.toFixed(2)}`);
          console.log(`   Transaction Amount: $${((txn.amount || 0) / 100).toFixed(2)}`);
          console.log(`   Difference: $${Math.abs(((txn.amount || 0) / 100) - totalAllocated).toFixed(2)}`);
        }
      } catch (error) {
        console.log(`   ❌ Could not fetch transaction: ${error.message}`);
      }
      
      // Check all transactions for water-related payments
      if (rawData.transactions) {
        const waterPayments = rawData.transactions.filter(txn => {
          const desc = (txn.notes || '').toLowerCase();
          const allocations = txn.allocations || [];
          return desc.includes('water') || desc.includes('agua') ||
                 allocations.some(a => 
                   (a.categoryId || '').includes('water') ||
                   (a.type || '').includes('water')
                 );
        });
        
        console.log(`\n\n💳 All Water-Related Payment Transactions (${waterPayments.length}):`);
        waterPayments.forEach((txn, idx) => {
          console.log(`\n${idx + 1}. Transaction: ${txn.id || 'N/A'}`);
          console.log(`   Date: ${txn.date?.display || txn.date || 'N/A'}`);
          console.log(`   Amount: $${((txn.amount || 0) / 100).toFixed(2)} (in centavos: ${txn.amount})`);
          console.log(`   Notes: ${txn.notes || 'N/A'}`);
        });
      }
      
      // Get processed statement data
      const statement = await getStatementData(api, CLIENT_ID, UNIT_ID, FISCAL_YEAR, true);
      
      console.log('\n\n📊 Statement Summary:');
      console.log(`  Closing Balance: $${statement.summary?.closingBalance?.toFixed(2) || 'N/A'}`);
      console.log(`  Total Line Items: ${statement.lineItems?.length || 0}`);
      
      // Show ALL line items first
      console.log(`\n📋 ALL Line Items (${statement.lineItems?.length || 0}):`);
      console.log('-'.repeat(70));
      (statement.lineItems || []).forEach((item, idx) => {
        console.log(`\n${idx + 1}. ${item.date}`);
        console.log(`   Description: ${item.description || 'N/A'}`);
        console.log(`   Category: ${item.category || 'N/A'}`);
        console.log(`   Type: ${item.type || 'N/A'}`);
        console.log(`   Charge: $${(item.charge || 0).toFixed(2)}`);
        console.log(`   Payment: $${(item.payment || 0).toFixed(2)}`);
        console.log(`   Balance: ${item.balance !== null ? '$' + item.balance.toFixed(2) : 'N/A'}`);
      });
      
      // Filter water-related transactions
      const waterBills = (statement.lineItems || []).filter(item => {
        const desc = (item.description || '').toLowerCase();
        const category = (item.category || '').toLowerCase();
        return desc.includes('water') || desc.includes('agua') || 
               category.includes('water') || category.includes('agua');
      });
      
      console.log(`\n\n💧 Water-Related Transactions: ${waterBills.length}`);
      console.log('-'.repeat(70));
      
      // Group by quarter and show details
      const waterByQuarter = new Map();
      
      for (const item of waterBills) {
        const date = new Date(item.date);
        const month = date.getMonth(); // 0-11
        
        // Determine fiscal quarter
        let quarter, year;
        if (month >= 6 && month <= 8) { // Jul-Sep
          quarter = 1;
          year = date.getFullYear();
        } else if (month >= 9 && month <= 11) { // Oct-Dec
          quarter = 2;
          year = date.getFullYear();
        } else if (month >= 0 && month <= 2) { // Jan-Mar
          quarter = 3;
          year = date.getFullYear();
        } else { // Apr-Jun
          quarter = 4;
          year = date.getFullYear();
        }
        
        const key = `Q${quarter}-${year}`;
        if (!waterByQuarter.has(key)) {
          waterByQuarter.set(key, { charges: [], payments: [] });
        }
        
        const quarterData = waterByQuarter.get(key);
        if (item.charge > 0) {
          quarterData.charges.push(item);
        } else if (item.payment > 0) {
          quarterData.payments.push(item);
        }
      }
      
      // Show Q1 2025 specifically
      console.log('\n📋 Q1 2025 (Jul-Sep 2025) Water Bills:');
      console.log('='.repeat(70));
      
      const q1Data = waterByQuarter.get('Q1-2025');
      if (q1Data) {
        console.log('\n💰 CHARGES:');
        let totalCharges = 0;
        q1Data.charges.forEach((item, idx) => {
          console.log(`\n  ${idx + 1}. ${item.date}`);
          console.log(`     Description: ${item.description}`);
          console.log(`     Category: ${item.category || 'N/A'}`);
          console.log(`     Type: ${item.type || 'N/A'}`);
          console.log(`     Charge: $${item.charge.toFixed(2)}`);
          console.log(`     Payment: $${item.payment.toFixed(2)}`);
          console.log(`     Balance: ${item.balance !== null ? '$' + item.balance.toFixed(2) : 'N/A'}`);
          console.log(`     Raw Data:`, JSON.stringify({
            date: item.date,
            description: item.description,
            category: item.category,
            type: item.type,
            charge: item.charge,
            payment: item.payment,
            balance: item.balance
          }, null, 2));
          totalCharges += item.charge;
        });
        console.log(`\n  📊 Total Charges: $${totalCharges.toFixed(2)}`);
        
        console.log('\n💳 PAYMENTS:');
        let totalPayments = 0;
        q1Data.payments.forEach((item, idx) => {
          console.log(`\n  ${idx + 1}. ${item.date}`);
          console.log(`     Description: ${item.description}`);
          console.log(`     Category: ${item.category || 'N/A'}`);
          console.log(`     Type: ${item.type || 'N/A'}`);
          console.log(`     Charge: $${item.charge.toFixed(2)}`);
          console.log(`     Payment: $${item.payment.toFixed(2)}`);
          console.log(`     Balance: ${item.balance !== null ? '$' + item.balance.toFixed(2) : 'N/A'}`);
          console.log(`     Raw Data:`, JSON.stringify({
            date: item.date,
            description: item.description,
            category: item.category,
            type: item.type,
            charge: item.charge,
            payment: item.payment,
            balance: item.balance
          }, null, 2));
          totalPayments += item.payment;
        });
        console.log(`\n  📊 Total Payments: $${totalPayments.toFixed(2)}`);
      } else {
        console.log('  ❌ No Q1 2025 water bills found');
      }
      
      // Show all water bills for reference
      console.log('\n\n📋 ALL Water Bills (for reference):');
      console.log('='.repeat(70));
      waterBills.forEach((item, idx) => {
        const date = new Date(item.date);
        const month = date.getMonth();
        let quarter;
        if (month >= 6 && month <= 8) quarter = 'Q1';
        else if (month >= 9 && month <= 11) quarter = 'Q2';
        else if (month >= 0 && month <= 2) quarter = 'Q3';
        else quarter = 'Q4';
        
        console.log(`\n${idx + 1}. ${item.date} (${quarter})`);
        console.log(`   Description: ${item.description}`);
        console.log(`   Charge: $${item.charge.toFixed(2)} | Payment: $${item.payment.toFixed(2)}`);
      });
      
      return { passed: true, message: 'Debug complete' };
    }
  });
}

main();
