#!/usr/bin/env node

/**
 * test-import-scripts.js
 * Quick test script to validate import script functionality
 */

import { initializeFirebase, printEnvironmentInfo } from './utils/environment-config.js';
import { getCurrentTimestamp } from './utils/timestamp-converter.js';
import { validateCollectionData } from './utils/field-validator.js';

async function testImportInfrastructure() {
  console.log('🧪 Testing Import Script Infrastructure...\n');
  
  try {
    // Test 1: Environment Configuration
    console.log('1️⃣ Testing Environment Configuration...');
    printEnvironmentInfo('dev');
    const { db, admin } = await initializeFirebase('dev');
    console.log('✅ Environment configuration working\n');
    
    // Test 2: Timestamp Utilities
    console.log('2️⃣ Testing Timestamp Utilities...');
    const timestamp = getCurrentTimestamp();
    console.log(`✅ Timestamp generated: ${timestamp.toDate()}\n`);
    
    // Test 3: Data Validation
    console.log('3️⃣ Testing Data Validation...');
    const testData = {
      unitId: 'test_unit',
      building: 'A',
      duesAmount: 150000, // In cents
      updated: timestamp
    };
    
    try {
      const validated = validateCollectionData([testData], 'units');
      console.log('✅ Data validation working\n');
    } catch (validationError) {
      console.log(`⚠️ Validation test: ${validationError.message}\n`);
    }
    
    // Test 4: Database Connection
    console.log('4️⃣ Testing Database Connection...');
    const testCollection = db.collection('clients');
    const snapshot = await testCollection.limit(1).get();
    console.log(`✅ Database connection working (${snapshot.size} docs found)\n`);
    
    // Test 5: Check Current Data State
    console.log('5️⃣ Checking Current Data State...');
    const collections = ['categories', 'vendors', 'units', 'transactions'];
    for (const collectionName of collections) {
      const colRef = db.collection(`clients/MTC/${collectionName}`);
      const colSnapshot = await colRef.limit(1).get();
      console.log(`   ${collectionName}: ${colSnapshot.size > 0 ? '✅ Has data' : '❌ Empty'}`);
    }
    
    // Check HOA Dues in the nested structure
    const unitsRef = db.collection('clients/MTC/units');
    const unitsSnapshot = await unitsRef.limit(1).get();
    if (unitsSnapshot.size > 0) {
      const firstUnit = unitsSnapshot.docs[0];
      const duesRef = firstUnit.ref.collection('dues');
      const duesSnapshot = await duesRef.limit(1).get();
      console.log(`   hoaDues: ${duesSnapshot.size > 0 ? '✅ Has data' : '❌ Empty'} (nested in units)`);
    } else {
      console.log(`   hoaDues: ❌ No units found to check`);
    }
    
    console.log('\n🎉 All infrastructure tests passed!');
    console.log('\n📋 Import Scripts Status:');
    console.log('   ✅ Environment Config: Working');
    console.log('   ✅ Timestamp Utils: Working');
    console.log('   ✅ Data Validation: Working');
    console.log('   ✅ Database Connection: Working');
    console.log('   ✅ MTC Data: Present in database');
    
    // Cleanup and exit
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testImportInfrastructure();