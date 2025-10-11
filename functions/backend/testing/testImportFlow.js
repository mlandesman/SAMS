import { ImportService } from '../services/importService.js';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Test the complete import flow with a small dataset
 * Tests the CrossRef generation and HOA allocation updates
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testImportFlow() {
  console.log('🧪 Testing Import Flow with CrossRef Generation\n');
  
  // Set up test parameters
  const clientId = 'MTC-TEST';
  const dataPath = path.join(__dirname, '../../MTCdata'); // Adjust path as needed
  
  // Mock user for import (since we're not using auth in test)
  const mockUser = {
    uid: 'test-import-user',
    email: 'test@import.com'
  };
  
  try {
    // Create import service instance
    const importService = new ImportService(clientId, dataPath);
    
    // Set up progress tracking
    importService.onProgress = (component, status, details) => {
      console.log(`📊 ${component}: ${status} - ${details.percent}% (${details.processed}/${details.total})`);
    };
    
    console.log('\n1️⃣ Importing Categories...');
    const categoriesResult = await importService.importCategories(mockUser);
    console.log(`✅ Categories: ${categoriesResult.success} success, ${categoriesResult.failed} failed`);
    
    console.log('\n2️⃣ Importing Vendors...');
    const vendorsResult = await importService.importVendors(mockUser);
    console.log(`✅ Vendors: ${vendorsResult.success} success, ${vendorsResult.failed} failed`);
    
    console.log('\n3️⃣ Importing Units...');
    const unitsResult = await importService.importUnits(mockUser);
    console.log(`✅ Units: ${unitsResult.success} success, ${unitsResult.failed} failed`);
    
    console.log('\n4️⃣ Importing Transactions (will generate CrossRef)...');
    const transactionsResult = await importService.importTransactions(mockUser);
    console.log(`✅ Transactions: ${transactionsResult.success} success, ${transactionsResult.failed} failed`);
    if (transactionsResult.hoaCrossRefGenerated) {
      console.log(`📝 HOA CrossRef generated with ${transactionsResult.hoaCrossRefRecords} entries`);
    }
    
    console.log('\n5️⃣ Importing HOA Dues (will use CrossRef and update transactions)...');
    const hoaDuesResult = await importService.importHOADues(mockUser);
    console.log(`✅ HOA Dues: ${hoaDuesResult.success} success, ${hoaDuesResult.failed} failed`);
    console.log(`🔗 Payments linked: ${hoaDuesResult.linkedPayments}, unlinked: ${hoaDuesResult.unlinkedPayments}`);
    if (hoaDuesResult.transactionsUpdated) {
      console.log(`📝 Transactions updated: ${hoaDuesResult.transactionsUpdated} successful, ${hoaDuesResult.transactionUpdatesFailed} failed`);
    }
    
    console.log('\n6️⃣ Importing Year-End Balances...');
    const yearEndResult = await importService.importYearEndBalances(mockUser);
    console.log(`✅ Year-End Balances: ${yearEndResult.success} success, ${yearEndResult.failed} failed`);
    
    // Summary
    console.log('\n📊 Import Summary:');
    console.log(`- Categories: ${categoriesResult.success}/${categoriesResult.total || 0}`);
    console.log(`- Vendors: ${vendorsResult.success}/${vendorsResult.total || 0}`);
    console.log(`- Units: ${unitsResult.success}/${unitsResult.total || 0}`);
    console.log(`- Transactions: ${transactionsResult.success}/${transactionsResult.total || 0}`);
    console.log(`- HOA Dues: ${hoaDuesResult.success}/${hoaDuesResult.total || 0}`);
    console.log(`- HOA CrossRef: ${transactionsResult.hoaCrossRefRecords || 0} entries`);
    console.log(`- Linked Payments: ${hoaDuesResult.linkedPayments || 0}`);
    console.log(`- Updated Transactions: ${hoaDuesResult.transactionsUpdated || 0}`);
    
    // Show any errors
    const allErrors = [
      ...categoriesResult.errors,
      ...vendorsResult.errors,
      ...unitsResult.errors,
      ...transactionsResult.errors,
      ...hoaDuesResult.errors,
      ...yearEndResult.errors
    ];
    
    if (allErrors.length > 0) {
      console.log('\n❌ Errors encountered:');
      allErrors.slice(0, 10).forEach(error => console.log(`  - ${error}`));
      if (allErrors.length > 10) {
        console.log(`  ... and ${allErrors.length - 10} more errors`);
      }
    }
    
    console.log('\n✅ Import test completed!');
    
  } catch (error) {
    console.error('\n❌ Import test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
console.log('🚀 Starting Import Flow Test...');
console.log('📁 Make sure the backend is running and data files are in place\n');

testImportFlow()
  .then(() => {
    console.log('\n🎉 Test completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  });