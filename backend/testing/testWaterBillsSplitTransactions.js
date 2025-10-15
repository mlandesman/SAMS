#!/usr/bin/env node
/**
 * Test: Water Bills Split Transactions Implementation
 * Priority 1 - Verification Test
 * 
 * This test verifies that water bill payments create proper split transactions
 * with separate allocations for base charges and penalties.
 */

import { testHarness } from './testHarness.js';

const tests = [
  {
    name: 'Verify Split Transaction with Penalties',
    test: async ({ api }) => {
      console.log('\n📊 TEST 1: Payment with Base Charge + Penalty\n');
      
      // Get unpaid bills for a unit that has penalties
      const billsResponse = await api.get('/water/clients/AVII/bills/unpaid/203');
      
      if (!billsResponse.data.success) {
        throw new Error('Failed to load unpaid bills');
      }
      
      const unpaidBills = billsResponse.data.data.unpaidBills || [];
      console.log(`📋 Found ${unpaidBills.length} unpaid bills`);
      
      // Find a bill with penalties
      const billWithPenalty = unpaidBills.find(b => b.penaltyAmount > 0);
      
      if (!billWithPenalty) {
        console.log('⚠️  No bills with penalties found - skipping penalty test');
        return { passed: true, skipped: true, reason: 'No penalties available' };
      }
      
      console.log(`💰 Bill ${billWithPenalty.period}:`);
      console.log(`   Base charge unpaid: $${billWithPenalty.currentCharge - (billWithPenalty.basePaid || 0)}`);
      console.log(`   Penalty unpaid: $${billWithPenalty.penaltyAmount - (billWithPenalty.penaltyPaid || 0)}`);
      console.log(`   Total unpaid: $${billWithPenalty.unpaidAmount}`);
      
      // Record payment for this bill
      const paymentAmount = billWithPenalty.unpaidAmount;
      
      console.log(`\n💳 Recording payment of $${paymentAmount}...\n`);
      
      const paymentResponse = await api.post('/clients/AVII/water/payments/record', {
        unitId: '203',
        amount: paymentAmount,
        paymentDate: '2025-10-14',
        paymentMethod: 'bank_transfer',
        reference: 'TEST-SPLIT-001',
        notes: 'Priority 1 Split Transaction Test',
        accountId: 'bank_scotiabank',
        accountType: 'bank'
      });
      
      if (!paymentResponse.data.success) {
        throw new Error('Payment failed: ' + (paymentResponse.data.error || 'Unknown error'));
      }
      
      const result = paymentResponse.data.data;
      console.log(`✅ Payment recorded successfully`);
      console.log(`📄 Transaction ID: ${result.transactionId}`);
      console.log(`📋 Bills paid: ${result.billsPaid.length}`);
      
      // Now fetch the transaction to verify allocations
      console.log(`\n🔍 Fetching transaction to verify allocations...\n`);
      
      const transactionResponse = await api.get(`/clients/AVII/transactions/${result.transactionId}`);
      
      if (!transactionResponse.data.success) {
        throw new Error('Failed to fetch transaction');
      }
      
      const transaction = transactionResponse.data.data;
      
      // VERIFICATION CHECKS
      console.log('🧪 VERIFICATION CHECKS:\n');
      
      // Check 1: Transaction has allocations array
      if (!transaction.allocations || !Array.isArray(transaction.allocations)) {
        throw new Error('❌ Transaction missing allocations array');
      }
      console.log(`✅ Check 1: Transaction has allocations array (${transaction.allocations.length} allocations)`);
      
      // Check 2: Penalties are separate allocations
      const baseAllocations = transaction.allocations.filter(a => a.type === 'water_bill');
      const penaltyAllocations = transaction.allocations.filter(a => a.type === 'water_penalty');
      
      console.log(`✅ Check 2: ${baseAllocations.length} base charge allocation(s)`);
      console.log(`✅ Check 3: ${penaltyAllocations.length} penalty allocation(s)`);
      
      if (penaltyAllocations.length === 0 && billWithPenalty.penaltyAmount > 0) {
        throw new Error('❌ Expected penalty allocations but found none');
      }
      
      // Check 3: Category is "-Split-" for multiple allocations
      if (transaction.allocations.length > 1) {
        if (transaction.categoryName !== '-Split-') {
          throw new Error(`❌ Expected categoryName "-Split-" but got "${transaction.categoryName}"`);
        }
        console.log(`✅ Check 4: Category is "-Split-" for multiple allocations`);
      }
      
      // Check 4: Allocation structure matches HOA Dues pattern
      for (const allocation of transaction.allocations) {
        const requiredFields = ['id', 'type', 'targetName', 'amount', 'categoryName', 'data'];
        for (const field of requiredFields) {
          if (!(field in allocation)) {
            throw new Error(`❌ Allocation missing required field: ${field}`);
          }
        }
      }
      console.log(`✅ Check 5: All allocations have required fields`);
      
      // Display allocation details
      console.log(`\n📋 ALLOCATION DETAILS:\n`);
      transaction.allocations.forEach((alloc, idx) => {
        console.log(`${idx + 1}. ${alloc.targetName}`);
        console.log(`   Type: ${alloc.type}`);
        console.log(`   Category: ${alloc.categoryName}`);
        console.log(`   Amount: $${(alloc.amount / 100).toFixed(2)}`);
        console.log(`   Bill Type: ${alloc.data.billType}`);
        console.log('');
      });
      
      return { 
        passed: true, 
        data: {
          transactionId: result.transactionId,
          allocationCount: transaction.allocations.length,
          baseAllocations: baseAllocations.length,
          penaltyAllocations: penaltyAllocations.length,
          categoryName: transaction.categoryName
        }
      };
    }
  },
  
  {
    name: 'Verify Single Allocation (No Penalties)',
    test: async ({ api }) => {
      console.log('\n📊 TEST 2: Payment without Penalties\n');
      
      // Get unpaid bills
      const billsResponse = await api.get('/water/clients/AVII/bills/unpaid/102');
      
      if (!billsResponse.data.success) {
        throw new Error('Failed to load unpaid bills');
      }
      
      const unpaidBills = billsResponse.data.data.unpaidBills || [];
      
      // Find a bill WITHOUT penalties
      const billWithoutPenalty = unpaidBills.find(b => !b.penaltyAmount || b.penaltyAmount === 0);
      
      if (!billWithoutPenalty) {
        console.log('⚠️  All bills have penalties - skipping single allocation test');
        return { passed: true, skipped: true, reason: 'No non-penalty bills available' };
      }
      
      console.log(`💰 Bill ${billWithoutPenalty.period}: $${billWithoutPenalty.unpaidAmount} (no penalties)`);
      
      // Record payment
      const paymentResponse = await api.post('/water/clients/AVII/payments/record', {
        unitId: '102',
        amount: billWithoutPenalty.unpaidAmount,
        paymentDate: '2025-10-14',
        paymentMethod: 'cash',
        reference: 'TEST-SINGLE-001',
        notes: 'Single allocation test',
        accountId: 'cash_main',
        accountType: 'cash'
      });
      
      if (!paymentResponse.data.success) {
        throw new Error('Payment failed');
      }
      
      const result = paymentResponse.data.data;
      
      // Fetch transaction
      const transactionResponse = await api.get(`/clients/AVII/transactions/${result.transactionId}`);
      const transaction = transactionResponse.data.data;
      
      console.log('\n🧪 VERIFICATION CHECKS:\n');
      
      // Check: Single allocation
      if (transaction.allocations.length !== 1) {
        throw new Error(`❌ Expected 1 allocation but got ${transaction.allocations.length}`);
      }
      console.log(`✅ Check 1: Single allocation created`);
      
      // Check: Category is NOT "-Split-"
      if (transaction.categoryName === '-Split-') {
        throw new Error('❌ Single allocation should not have "-Split-" category');
      }
      console.log(`✅ Check 2: Category is "${transaction.categoryName}" (not "-Split-")`);
      
      // Check: Allocation is water_bill type
      if (transaction.allocations[0].type !== 'water_bill') {
        throw new Error(`❌ Expected type "water_bill" but got "${transaction.allocations[0].type}"`);
      }
      console.log(`✅ Check 3: Allocation type is "water_bill"`);
      
      return { 
        passed: true,
        data: {
          transactionId: result.transactionId,
          allocationCount: 1,
          categoryName: transaction.categoryName
        }
      };
    }
  }
];

console.log('🧪 Water Bills Split Transactions - Priority 1 Verification');
console.log('='.repeat(60));
await testHarness.runTests(tests);

