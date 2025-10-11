// Verify Water Meter setup for AVII units
import { getDb } from '../firebase.js';

/**
 * Verification script to check that water meter setup completed successfully
 * Validates structure and data for all AVII units
 */

const AVII_UNITS = ['101', '102', '103', '104', '105', '106', '201', '202', '203', '204'];
const CLIENT_ID = 'AVII';
const YEAR = 2025;
const TEST_UNITS = ['101', '201']; // Units with complete test data

const verifyWaterMeterSetup = async () => {
  console.log('🔍 Verifying Water Meter setup for AVII units...');
  console.log('');

  try {
    const db = await getDb();
    const results = {
      success: true,
      totalUnits: AVII_UNITS.length,
      configsCreated: 0,
      testDataComplete: 0,
      errors: []
    };

    // Check each unit
    for (const unitId of AVII_UNITS) {
      console.log(`📋 Checking Unit ${unitId}:`);
      
      try {
        const unitResult = await verifyUnitSetup(db, unitId);
        
        if (unitResult.configExists) {
          results.configsCreated++;
          console.log(`   ✅ Configuration: Found`);
        } else {
          results.errors.push(`Unit ${unitId}: Missing configuration`);
          console.log(`   ❌ Configuration: Missing`);
        }
        
        if (TEST_UNITS.includes(unitId)) {
          if (unitResult.hasTestData) {
            results.testDataComplete++;
            console.log(`   ✅ Test Data: Complete (${unitResult.testDataDetails})`);
          } else {
            results.errors.push(`Unit ${unitId}: Incomplete test data`);
            console.log(`   ❌ Test Data: Incomplete`);
          }
        } else {
          console.log(`   ℹ️  Test Data: Not required (structure only)`);
        }
        
        console.log('');
        
      } catch (error) {
        results.errors.push(`Unit ${unitId}: ${error.message}`);
        console.log(`   ❌ Error: ${error.message}\n`);
      }
    }

    // Print summary
    console.log('📊 Verification Summary:');
    console.log(`   Total Units: ${results.totalUnits}`);
    console.log(`   Configs Created: ${results.configsCreated}/${results.totalUnits}`);
    console.log(`   Test Data Complete: ${results.testDataComplete}/${TEST_UNITS.length}`);
    
    if (results.errors.length > 0) {
      console.log(`   Errors: ${results.errors.length}`);
      results.errors.forEach(error => console.log(`     - ${error}`));
      results.success = false;
    } else {
      console.log(`   Status: ✅ All checks passed!`);
    }

    return results;

  } catch (error) {
    console.error('❌ Verification failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Verify setup for a single unit
 * @param {FirebaseFirestore.Firestore} db - Firestore database instance
 * @param {string} unitId - Unit identifier
 * @returns {Object} Verification results for the unit
 */
const verifyUnitSetup = async (db, unitId) => {
  const basePath = `clients/${CLIENT_ID}/units/${unitId}/waterMeter`;
  const result = {
    configExists: false,
    hasTestData: false,
    testDataDetails: ''
  };

  // Check configuration
  const configRef = db.doc(`${basePath}/config`);
  const configDoc = await configRef.get();
  result.configExists = configDoc.exists;

  // For test units, check complete test data
  if (TEST_UNITS.includes(unitId)) {
    const checks = [];
    
    // Check for readings
    const readingsSnapshot = await db.collection(`${basePath}/${YEAR}/readings`).limit(1).get();
    const hasReadings = !readingsSnapshot.empty;
    if (hasReadings) checks.push('reading');
    
    // Check for bills
    const billsSnapshot = await db.collection(`${basePath}/${YEAR}/bills`).limit(1).get();
    const hasBills = !billsSnapshot.empty;
    if (hasBills) checks.push('bill');
    
    // Check for balance
    const balanceRef = db.doc(`${basePath}/${YEAR}/balance`);
    const balanceDoc = await balanceRef.get();
    const hasBalance = balanceDoc.exists;
    if (hasBalance) checks.push('balance');
    
    result.hasTestData = hasReadings && hasBills && hasBalance;
    result.testDataDetails = checks.join(', ');
  }

  return result;
};

/**
 * Quick data sample check - shows actual data from test units
 */
const showTestDataSample = async () => {
  console.log('\n🧪 Sample Test Data:');
  
  try {
    const db = await getDb();
    
    for (const unitId of TEST_UNITS) {
      console.log(`\n📋 Unit ${unitId} Sample Data:`);
      
      const basePath = `clients/${CLIENT_ID}/units/${unitId}/waterMeter`;
      
      // Show config
      const configDoc = await db.doc(`${basePath}/config`).get();
      if (configDoc.exists) {
        const config = configDoc.data();
        console.log(`   Serial: ${config.serialNumber}`);
        console.log(`   Rate: $${(config.billingConfig.ratePerCubicMeter / 100).toFixed(2)} MXN/m³`);
      }
      
      // Show latest reading
      const readingSnapshot = await db.collection(`${basePath}/${YEAR}/readings`)
        .orderBy('date', 'desc')
        .limit(1)
        .get();
      
      if (!readingSnapshot.empty) {
        const reading = readingSnapshot.docs[0].data();
        const date = reading.date.toDate().toLocaleDateString();
        console.log(`   Latest Reading: ${reading.reading} m³ (${date})`);
      }
      
      // Show balance
      const balanceDoc = await db.doc(`${basePath}/${YEAR}/balance`).get();
      if (balanceDoc.exists) {
        const balance = balanceDoc.data();
        console.log(`   Current Balance: $${(balance.currentBalance / 100).toFixed(2)} MXN`);
        console.log(`   Bills: ${balance.pendingBills} pending, ${balance.paidBills} paid`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error showing sample data:', error);
  }
};

// Check if this script is run directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  verifyWaterMeterSetup()
    .then(async (results) => {
      if (results.success) {
        await showTestDataSample();
        console.log('\n✅ Verification completed successfully');
        process.exit(0);
      } else {
        console.log('\n❌ Verification failed');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Verification script failed:', error);
      process.exit(1);
    });
}

export { verifyWaterMeterSetup, showTestDataSample };