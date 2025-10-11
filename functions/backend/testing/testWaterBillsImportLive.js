/**
 * Live Water Bills Import Test
 * 
 * This test runs ONLY the water bills import against existing data.
 * Assumes transactions and HOA Dues are already imported.
 * 
 * This allows testing water bills import without a full reimport.
 */

import { ImportService } from '../services/importService.js';

const CLIENT_ID = 'AVII';
const TEST_USER_ID = 'fjXv8gX1CYWBvOZ1CS27j96oRCT2';

async function runLiveWaterBillsImport() {
  try {
    console.log('\n🌊 Live Water Bills Import Test');
    console.log('='.repeat(80));
    console.log(`Client: ${CLIENT_ID}`);
    console.log(`Mode: LIVE (will write to Firestore)`);
    console.log('='.repeat(80));
    
    console.log('\n⚠️  WARNING: This will write data to Firestore!');
    console.log('   Make sure transactions and HOA Dues are already imported.');
    console.log('   Press Ctrl+C within 3 seconds to cancel...\n');
    
    // Wait 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('🚀 Starting water bills import...\n');
    
    // Create import service instance
    const importService = new ImportService(CLIENT_ID, 'firebase_storage', { uid: TEST_USER_ID });
    
    // Run water bills import
    const results = await importService.importWaterBills({ uid: TEST_USER_ID });
    
    // Display results
    console.log('\n' + '='.repeat(80));
    console.log('📊 IMPORT RESULTS');
    console.log('='.repeat(80));
    
    if (results.skipped) {
      console.log(`⏭️  Import skipped: ${results.reason}`);
      return false;
    }
    
    console.log(`✅ Cycles Processed: ${results.cyclesProcessed}`);
    console.log(`✅ Readings Imported: ${results.readingsImported}`);
    console.log(`✅ Bills Generated: ${results.billsGenerated}`);
    console.log(`✅ Payments Applied: ${results.paymentsApplied}`);
    
    if (results.errors && results.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered: ${results.errors.length}`);
      for (const error of results.errors) {
        console.log(`   • ${error.cycle}: ${error.error}`);
      }
    }
    
    console.log('\n✅ Water Bills Import Complete!');
    console.log('='.repeat(80));
    
    // Verification queries
    console.log('\n📋 VERIFICATION QUERIES:');
    console.log('Run these in Firebase Console to verify:');
    console.log('');
    console.log('1. Check readings:');
    console.log('   /clients/AVII/projects/waterBills/readings/2026-00');
    console.log('');
    console.log('2. Check bills:');
    console.log('   /clients/AVII/projects/waterBills/bills/2026-00');
    console.log('');
    console.log('3. Check bill payment status for Unit 101:');
    console.log('   /clients/AVII/projects/waterBills/bills/2026-00');
    console.log('   Look for: bills.units.101.paidAmount, status');
    console.log('');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Water Bills import failed:', error.message);
    console.error(error.stack);
    return false;
  }
}

// Run live import
runLiveWaterBillsImport()
  .then(success => {
    console.log(success ? '\n✅ Import SUCCEEDED' : '\n❌ Import FAILED');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 Error:', error);
    process.exit(1);
  });
