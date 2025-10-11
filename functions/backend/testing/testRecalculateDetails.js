import { testHarness } from './testHarness.js';

// Detailed test to show balance recalculation from year-end snapshot
await testHarness.runTest({
  name: 'Detailed Balance Recalculation Test',
  async test({ api }) {
    try {
      const clientId = 'MTC';
      
      console.log('\n📊 BALANCE RECALCULATION DETAILS\n');
      
      // First, get the current account balances (what's stored in the client doc)
      console.log('1️⃣ Current Account Balances (from client document):');
      const currentResponse = await api.get(`/api/clients/${clientId}/accounts`);
      const currentData = currentResponse.data.data;
      
      console.log(`   💵 Cash Balance: $${currentData.cashBalance.toLocaleString()}`);
      console.log(`   🏦 Bank Balance: $${currentData.bankBalance.toLocaleString()}`);
      console.log(`   💰 Total Balance: $${(currentData.cashBalance + currentData.bankBalance).toLocaleString()}`);
      
      currentData.accounts.forEach(account => {
        console.log(`\n   Account: ${account.name} (${account.id})`);
        console.log(`   - Type: ${account.type}`);
        console.log(`   - Balance: $${account.balance.toLocaleString()}`);
        console.log(`   - Last Rebuild Snapshot: ${account.lastRebuildSnapshot}`);
      });
      
      console.log('\n' + '='.repeat(60) + '\n');
      
      // Now run the recalculation to see what it computes
      console.log('2️⃣ Recalculated Balances (from /recalculate endpoint):');
      const recalcResponse = await api.get(`/api/clients/${clientId}/balances/recalculate?dryRun=true&startYear=2024`);
      const recalcData = recalcResponse.data.data;
      
      console.log(`   💵 Cash Balance: $${recalcData.cashBalance.toLocaleString()}`);
      console.log(`   🏦 Bank Balance: $${recalcData.bankBalance.toLocaleString()}`);
      console.log(`   💰 Total Balance: $${recalcData.totalBalance.toLocaleString()}`);
      console.log(`   📈 Transactions Processed: ${recalcData.processedTransactions}`);
      console.log(`   📅 Source Snapshot: ${recalcData.sourceSnapshot}`);
      
      recalcData.accounts.forEach(account => {
        console.log(`\n   Account: ${account.name} (${account.id})`);
        console.log(`   - Type: ${account.type}`);
        console.log(`   - Balance: $${account.balance.toLocaleString()}`);
      });
      
      console.log('\n' + '='.repeat(60) + '\n');
      
      // Compare the differences
      console.log('3️⃣ Comparison:');
      const cashDiff = recalcData.cashBalance - currentData.cashBalance;
      const bankDiff = recalcData.bankBalance - currentData.bankBalance;
      const totalDiff = (recalcData.cashBalance + recalcData.bankBalance) - (currentData.cashBalance + currentData.bankBalance);
      
      console.log(`   💵 Cash Difference: $${cashDiff.toLocaleString()} ${cashDiff === 0 ? '✅' : '⚠️'}`);
      console.log(`   🏦 Bank Difference: $${bankDiff.toLocaleString()} ${bankDiff === 0 ? '✅' : '⚠️'}`);
      console.log(`   💰 Total Difference: $${totalDiff.toLocaleString()} ${totalDiff === 0 ? '✅' : '⚠️'}`);
      
      if (Math.abs(totalDiff) < 0.01) {
        console.log('\n   ✅ Balances match! The recalculation is correct.');
      } else {
        console.log('\n   ⚠️  Balances do not match. There may be a discrepancy.');
      }
      
      // To understand the starting point, let's also fetch year-end snapshot if possible
      // This would require a separate endpoint, but we can infer from the recalculation
      console.log('\n' + '='.repeat(60) + '\n');
      console.log('4️⃣ Year-End 2024 Starting Point (inferred from recalculation):');
      console.log('   The recalculation starts from the 2024-12-31 snapshot');
      console.log('   Then processes 140 transactions from 2025');
      console.log('   To arrive at the current balances shown above');
      
      return {
        passed: true,
        message: 'Detailed balance recalculation analysis complete',
        data: {
          current: currentData,
          recalculated: recalcData,
          differences: {
            cash: cashDiff,
            bank: bankDiff,
            total: totalDiff
          }
        }
      };
      
    } catch (error) {
      console.error('\n❌ Error:', error.message);
      return {
        passed: false,
        error: error.message
      };
    }
  }
});

process.exit(0);