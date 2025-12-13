/**
 * Standalone script to import Water Bills only
 * Useful for testing water bills import without running full purge/import
 * 
 * Usage:
 *   node backend/testing/importWaterBillsOnly.js AVII
 *   node backend/testing/importWaterBillsOnly.js MTC
 */

import { ImportService } from '../services/importService.js';
import { getDb } from '../firebase.js';

// Simple user mock for testing (minimal implementation)
class TestUser {
  constructor(email) {
    this.email = email;
    this.uid = `test-${Date.now()}`;
  }
  
  isSuperAdmin() {
    return true; // Allow for testing
  }
}

async function importWaterBillsOnly(clientId) {
  console.log('🌊 Water Bills Import Only');
  console.log('='.repeat(60));
  console.log(`📋 Client: ${clientId}`);
  console.log(`📅 Started: ${new Date().toISOString()}\n`);
  
  try {
    // Create a test user (minimal implementation for testing)
    const user = new TestUser('test@example.com');
    
    // Use Firebase Storage as data path (same as web-based import)
    const dataPath = 'firebase_storage';
    
    // Create ImportService instance
    const importService = new ImportService(clientId, dataPath, user);
    
    // Run water bills import
    console.log('🚀 Starting Water Bills import...\n');
    const result = await importService.importWaterBills(user);
    
    // Display results
    console.log('\n' + '='.repeat(60));
    console.log('📊 Import Results:');
    console.log('='.repeat(60));
    
    if (result.skipped) {
      console.log(`⏭️  Import skipped: ${result.reason}`);
    } else {
      console.log(`✅ Readings imported: ${result.readingsImported || 0}`);
      console.log(`✅ Bills generated: ${result.billsGenerated || 0}`);
      console.log(`✅ Payments applied: ${result.paymentsApplied || 0}`);
      console.log(`✅ Cycles processed: ${result.cyclesProcessed || 0}`);
      
      if (result.errors && result.errors.length > 0) {
        console.log(`\n⚠️  Errors (${result.errors.length}):`);
        result.errors.forEach((error, index) => {
          console.log(`   ${index + 1}. ${error.quarter || 'Unknown'}: ${error.error}`);
        });
      }
    }
    
    console.log(`\n📅 Completed: ${new Date().toISOString()}`);
    console.log('='.repeat(60));
    
    return result;
    
  } catch (error) {
    console.error('\n❌ Import failed:');
    console.error(error);
    process.exit(1);
  }
}

// Get clientId from command line argument
const clientId = process.argv[2];

if (!clientId) {
  console.error('❌ Error: Client ID required');
  console.error('Usage: node backend/testing/importWaterBillsOnly.js <CLIENT_ID>');
  console.error('Example: node backend/testing/importWaterBillsOnly.js AVII');
  process.exit(1);
}

// Run the import
importWaterBillsOnly(clientId).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});



















