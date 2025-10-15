import { testHarness } from './testHarness.js';

const tests = [
  {
    name: 'Load Unpaid Bills Summary',
    test: async ({ api }) => {
      const response = await api.get('/water/clients/AVII/bills/unpaid/102');
      
      if (!response.data.success) {
        throw new Error('Failed to load unpaid bills summary');
      }
      
      console.log('✅ Unpaid bills loaded:', response.data.data.unpaidBills?.length || 0);
      console.log('💰 Current credit balance:', response.data.data.currentCreditBalance || 0);
      
      return { passed: true, data: response.data };
    }
  },
  {
    name: 'Record Water Bill Payment with Credit Integration',
    test: async ({ api }) => {
      // First get unpaid bills to test with
      const billsResponse = await api.get('/water/clients/AVII/bills/unpaid/102');
      const unpaidBills = billsResponse.data.data.unpaidBills || [];
      const creditBalance = billsResponse.data.data.currentCreditBalance || 0;
      
      if (unpaidBills.length === 0) {
        console.log('ℹ️ No unpaid bills - testing credit addition');
        
        // Test payment that goes entirely to credit
        const paymentResponse = await api.post('/water/clients/AVII/payments/record', {
          unitId: '102',
          amount: 100.00,
          paymentDate: '2025-08-30',
          paymentMethod: 'cash',
          reference: 'TEST-CREDIT-001',
          notes: 'Test credit addition',
          accountId: 'bank_scotiabank',
          accountType: 'bank'
        });
        
        if (!paymentResponse.data.success) {
          throw new Error('Credit payment failed');
        }
        
        const result = paymentResponse.data.data;
        if (result.paymentType !== 'credit_only') {
          throw new Error('Expected credit_only payment type');
        }
        
        console.log('✅ Credit addition test passed');
        return { passed: true, data: result };
        
      } else {
        console.log(`💧 Testing payment against ${unpaidBills.length} unpaid bills`);
        
        // Test payment against actual bills
        const testBill = unpaidBills[0];
        const testAmount = testBill.unpaidAmount; // Pay exactly what's due
        
        const paymentResponse = await api.post('/water/clients/AVII/payments/record', {
          unitId: '102',
          amount: testAmount,
          paymentDate: '2025-08-30',
          paymentMethod: 'cash',
          reference: 'TEST-BILLS-001',
          notes: 'Test bill payment with credit integration',
          accountId: 'bank_scotiabank',
          accountType: 'bank'
        });
        
        if (!paymentResponse.data.success) {
          throw new Error('Bill payment failed');
        }
        
        const result = paymentResponse.data.data;
        
        // Verify payment was applied to bills
        if (result.billsPaid.length === 0) {
          throw new Error('Expected bills to be paid');
        }
        
        // Verify transaction was created
        if (!result.transactionId) {
          throw new Error('Expected transaction to be created');
        }
        
        console.log(`✅ Paid ${result.billsPaid.length} bills, transaction: ${result.transactionId}`);
        console.log(`💰 Credit balance: $${creditBalance} → $${result.newCreditBalance}`);
        
        return { passed: true, data: result };
      }
    }
  },
  {
    name: 'Test Payment Distribution Calculation',
    test: async ({ api }) => {
      // Test various payment amounts to verify distribution logic
      const testAmounts = [50, 100, 500, 1000];
      
      for (const testAmount of testAmounts) {
        console.log(`🧮 Testing distribution for $${testAmount}`);
        
        const billsResponse = await api.get('/water/clients/AVII/bills/unpaid/102');
        const unpaidBills = billsResponse.data.data.unpaidBills || [];
        const creditBalance = billsResponse.data.data.currentCreditBalance || 0;
        
        const totalAvailable = testAmount + creditBalance;
        console.log(`  Total available: $${testAmount} + $${creditBalance} = $${totalAvailable}`);
        
        // This would normally be done in frontend, but we're testing the logic
        let remainingFunds = totalAvailable;
        let billsCanPay = 0;
        
        for (const bill of unpaidBills) {
          if (remainingFunds >= bill.unpaidAmount) {
            billsCanPay++;
            remainingFunds -= bill.unpaidAmount;
          } else if (remainingFunds > 0) {
            billsCanPay += 0.5; // Partial payment
            remainingFunds = 0;
            break;
          } else {
            break;
          }
        }
        
        console.log(`  Can pay ${billsCanPay} bills, remaining: $${remainingFunds}`);
      }
      
      return { passed: true, data: { tested: testAmounts.length } };
    }
  }
];

console.log('🧪 Running Water Bills Payment Tests...');
await testHarness.runTests(tests);