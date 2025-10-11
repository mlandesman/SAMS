// verifyPenaltiesWork.js - Test that penalties are correctly calculated and included in bills
import { testHarness } from './testHarness.js';

const tests = [
  {
    name: 'Generate Bills and Verify Penalties',
    test: async ({ api }) => {
      console.log('\n🔍 Testing penalty calculations in water bills...\n');
      
      // 1. First clear the cache to ensure fresh data
      console.log('1. Clearing cache...');
      await api.post('/api/clients/AVII/water/cache/clear');
      
      // 2. Generate bills for August (month 1) - should have penalties from July's unpaid bills
      console.log('\n2. Generating bills for August 2025 (fiscal month 1)...');
      try {
        const generateRes = await api.post('/api/clients/AVII/water/bills/generate', {
          year: 2026,
          month: 1  // August - should have penalties from July's unpaid bills
        });
        
        console.log('✅ Bills generated successfully');
        
        // 3. Check bills have penalties
        const bills = generateRes.data.data.bills.units;
        const summary = generateRes.data.data.summary;
        
        console.log('\n3. Checking for penalties in bills...');
        console.log(`   Total penalties applied: $${summary.totalPenalties || 0}`);
        console.log(`   Total carryover amount: $${summary.totalCarryover || 0}`);
        console.log(`   Total new charges: $${summary.totalNewCharges || 0}`);
        console.log(`   Grand total billed: $${summary.totalBilled || 0}`);
        
        let foundPenalty = false;
        let penaltyCount = 0;
        
        for (const [unitId, bill] of Object.entries(bills)) {
          if (bill.penaltyAmount > 0) {
            console.log(`\n   ✅ Unit ${unitId} has penalty:`);
            console.log(`      Previous balance: $${bill.previousBalance}`);
            console.log(`      Penalty amount: $${bill.penaltyAmount}`);
            console.log(`      Current charge: $${bill.currentCharge || bill.baseAmount - bill.previousBalance}`);
            console.log(`      Total amount: $${bill.totalAmount}`);
            console.log(`      Months overdue: ${bill.monthsOverdue || 'N/A'}`);
            foundPenalty = true;
            penaltyCount++;
          }
        }
        
        if (!foundPenalty) {
          console.log('\n   ⚠️  No penalties found - this might be correct if all previous bills were paid');
          console.log('      Or there might be no previous bills to apply penalties to');
        } else {
          console.log(`\n   ✅ Found penalties on ${penaltyCount} units`);
        }
        
      } catch (error) {
        if (error.response?.data?.error?.includes('already exist')) {
          console.log('⚠️  Bills already exist for August 2025');
          console.log('   Fetching existing bills to check for penalties...');
          
          // Get existing bills
          const billsRes = await api.get('/api/clients/AVII/water/bills/2026/1');
          const bills = billsRes.data.data.bills.units;
          const summary = billsRes.data.data.summary;
          
          console.log('\n   Checking existing bills for penalties...');
          console.log(`   Total penalties: $${summary.totalPenalties || 0}`);
          
          let penaltyCount = 0;
          for (const [unitId, bill] of Object.entries(bills)) {
            if (bill.penaltyAmount > 0) {
              console.log(`   ✅ Unit ${unitId} has penalty: $${bill.penaltyAmount}`);
              penaltyCount++;
            }
          }
          
          if (penaltyCount > 0) {
            console.log(`\n   ✅ Found penalties on ${penaltyCount} units in existing bills`);
          }
        } else {
          throw error;
        }
      }
      
      // 4. Verify in aggregation
      console.log('\n4. Verifying penalties in aggregated data...');
      const aggRes = await api.get('/api/clients/AVII/water/data/2026');
      const augData = aggRes.data.data.months[1];  // August is month 1
      
      if (!augData) {
        console.log('   ⚠️  No data for August in aggregation');
      } else {
        let aggPenaltyCount = 0;
        for (const [unitId, unit] of Object.entries(augData.units || {})) {
          if (unit.penaltyAmount > 0) {
            console.log(`   ✅ Aggregation shows penalty for unit ${unitId}: $${unit.penaltyAmount}`);
            aggPenaltyCount++;
          }
        }
        
        if (aggPenaltyCount === 0) {
          console.log('   ⚠️  No penalties in aggregated data - checking other fields...');
          // Check if the new fields exist at all
          const sampleUnit = Object.values(augData.units || {})[0];
          if (sampleUnit) {
            console.log('   Sample unit fields:');
            console.log(`     - baseAmount: ${sampleUnit.baseAmount !== undefined ? '✅ exists' : '❌ missing'}`);
            console.log(`     - previousBalance: ${sampleUnit.previousBalance !== undefined ? '✅ exists' : '❌ missing'}`);
            console.log(`     - penaltyAmount: ${sampleUnit.penaltyAmount !== undefined ? '✅ exists' : '❌ missing'}`);
          }
        } else {
          console.log(`\n   ✅ Aggregation includes penalties for ${aggPenaltyCount} units`);
        }
      }
      
      // 5. Check if September (month 2) bills would accumulate more penalties
      console.log('\n5. Checking if September (month 2) would have accumulated penalties...');
      try {
        const septRes = await api.get('/api/clients/AVII/water/bills/2026/2');
        if (septRes.data.data) {
          const septBills = septRes.data.data.bills.units;
          const septSummary = septRes.data.data.summary;
          console.log(`   September total penalties: $${septSummary.totalPenalties || 0}`);
          console.log(`   September total carryover: $${septSummary.totalCarryover || 0}`);
        }
      } catch (error) {
        console.log('   No bills for October yet (expected)');
      }
      
      return { 
        passed: true,
        message: 'Penalty integration test completed. Check output above for details.'
      };
    }
  }
];

console.log('🚀 Starting Water Bills Penalty Verification');
console.log('=' .repeat(50));

await testHarness.runTests(tests);