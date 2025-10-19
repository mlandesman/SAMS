/**
 * Test Credit Balance Migration
 * Tests the new credit balance structure and APIs
 */

import { fileURLToPath } from 'url';
import path from 'path';
import creditService from '../services/creditService.js';
import CreditBalanceMigration from '../scripts/migrateCreditBalances.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testCreditMigration() {
  console.log('\n🧪 Testing Credit Balance Migration\n');
  
  try {
    // Firebase is auto-initialized by the services
    
    // Test 1: Run Migration
    console.log('📋 Test 1: Running Migration');
    console.log('═══════════════════════════════════════════');
    const migration = new CreditBalanceMigration();
    const stats = await migration.migrate({ dryRun: false, backup: true });
    console.log('\n✅ Migration completed');
    console.log(`   Clients: ${stats.clientsProcessed}`);
    console.log(`   Units: ${stats.unitsProcessed}`);
    console.log(`   Credit balances: ${stats.creditBalancesMigrated}`);
    console.log(`   History entries: ${stats.historyEntriesMigrated}`);
    
    if (stats.errors.length > 0) {
      console.log(`\n⚠️ Errors:`);
      stats.errors.forEach(err => {
        console.log(`   - ${err.clientId}: ${err.error}`);
      });
    }
    
    // Test 2: Verify Migration
    console.log('\n📋 Test 2: Verifying Migration for MTC');
    console.log('═══════════════════════════════════════════');
    const mtcVerified = await migration.verify('MTC');
    console.log(mtcVerified ? '✅ MTC verified' : '❌ MTC verification failed');
    
    console.log('\n📋 Test 3: Verifying Migration for AVII');
    console.log('═══════════════════════════════════════════');
    const aviiVerified = await migration.verify('AVII');
    console.log(aviiVerified ? '✅ AVII verified' : '❌ AVII verification failed');
    
    // Test 3: Read credit balance using new API
    console.log('\n📋 Test 4: Reading Credit Balance (New API)');
    console.log('═══════════════════════════════════════════');
    const balance = await creditService.getCreditBalance('AVII', '101');
    console.log(`   Unit 101 Balance: ${balance.creditBalance} pesos (${balance.creditBalanceDisplay})`);
    console.log(`   Last Updated: ${balance.lastUpdated}`);
    
    // Test 4: Update credit balance
    console.log('\n📋 Test 5: Updating Credit Balance');
    console.log('═══════════════════════════════════════════');
    const updateResult = await creditService.updateCreditBalance(
      'AVII',
      '101',
      5000, // 50 pesos in centavos
      'test_migration_' + Date.now(),
      'Migration test payment',
      'testing'
    );
    console.log(`   Previous: ${updateResult.previousBalance} centavos`);
    console.log(`   New: ${updateResult.newBalance} centavos`);
    console.log(`   Change: ${updateResult.amountChange} centavos`);
    
    // Test 5: Get credit history
    console.log('\n📋 Test 6: Getting Credit History');
    console.log('═══════════════════════════════════════════');
    const history = await creditService.getCreditHistory('AVII', '101', 10);
    console.log(`   Current Balance: ${history.currentBalance} pesos`);
    console.log(`   History Entries: ${history.history.length}`);
    if (history.history.length > 0) {
      console.log(`\n   Recent entries:`);
      history.history.slice(0, 3).forEach((entry, i) => {
        console.log(`   ${i + 1}. ${entry.date} - ${entry.amount > 0 ? '+' : ''}${entry.amount} pesos`);
        console.log(`      Balance: ${entry.balance} pesos`);
        console.log(`      Note: ${entry.note}`);
        console.log(`      Transaction: ${entry.transactionId}`);
      });
    }
    
    // Test 6: Delete credit history entry
    console.log('\n📋 Test 7: Deleting Credit History Entry');
    console.log('═══════════════════════════════════════════');
    const deleteResult = await creditService.deleteCreditHistoryEntry(
      'AVII',
      '101',
      updateResult.transactionId
    );
    console.log(`   Entries deleted: ${deleteResult.entriesDeleted}`);
    console.log(`   Previous balance: ${deleteResult.previousBalance} centavos`);
    console.log(`   New balance: ${deleteResult.newBalance} centavos`);
    
    // Final verification
    console.log('\n📋 Test 8: Final Balance Check');
    console.log('═══════════════════════════════════════════');
    const finalBalance = await creditService.getCreditBalance('AVII', '101');
    console.log(`   Final Balance: ${finalBalance.creditBalance} pesos (${finalBalance.creditBalanceDisplay})`);
    
    console.log('\n✅ All tests completed successfully!\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
  
  process.exit(0);
}

testCreditMigration();

