/**
 * Test Task 1: Verify aggregated data is written to Firestore
 * Tests that buildYearData() writes aggregated data to the aggregatedData document
 */

import { createApiClient } from './apiClient.js';
import admin from 'firebase-admin';
import { testConfig } from './config.js';

const TEST_CLIENT = 'AVII';
const TEST_YEAR = 2026;

async function testAggregatedDataWrite() {
  console.log('🧪 Testing Task 1: Aggregated Data Write to Firestore');
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Initialize API client with authentication
    console.log('\n📝 Step 1: Authenticating...');
    const apiClient = await createApiClient(testConfig.DEFAULT_TEST_UID);
    console.log('✅ Authentication successful');
    
    // Step 2: Trigger aggregation by calling the data endpoint
    console.log(`\n📊 Step 2: Triggering aggregation for ${TEST_CLIENT} FY${TEST_YEAR}...`);
    console.log(`   Calling: GET /water/clients/${TEST_CLIENT}/data/${TEST_YEAR}`);
    
    const startTime = Date.now();
    const response = await apiClient.get(`/water/clients/${TEST_CLIENT}/data/${TEST_YEAR}`);
    const endTime = Date.now();
    
    console.log(`✅ Aggregation completed in ${endTime - startTime}ms`);
    console.log(`   Response: ${response.success ? 'Success' : 'Failed'}`);
    console.log(`   Months returned: ${response.data?.months?.length || 0}`);
    
    // Step 3: Verify Firestore document was written
    console.log('\n🔍 Step 3: Verifying Firestore document...');
    
    const db = admin.firestore();
    const aggregatedDataRef = db
      .collection('clients').doc(TEST_CLIENT)
      .collection('projects').doc('waterBills')
      .collection('bills').doc('aggregatedData');
    
    const doc = await aggregatedDataRef.get();
    
    if (!doc.exists) {
      console.error('❌ FAILED: aggregatedData document not found in Firestore');
      return false;
    }
    
    console.log('✅ aggregatedData document exists in Firestore');
    
    // Step 4: Validate document structure
    console.log('\n📋 Step 4: Validating document structure...');
    const data = doc.data();
    
    const checks = {
      '_metadata exists': !!data._metadata,
      '_metadata.fiscalYear': data._metadata?.fiscalYear === TEST_YEAR,
      '_metadata.clientId': data._metadata?.clientId === TEST_CLIENT,
      '_metadata.calculationTimestamp': !!data._metadata?.calculationTimestamp,
      'year field': data.year === TEST_YEAR,
      'months array': Array.isArray(data.months),
      'months count': data.months?.length > 0,
      'summary object': !!data.summary,
      'carWashRate': typeof data.carWashRate === 'number',
      'boatWashRate': typeof data.boatWashRate === 'number'
    };
    
    let allPassed = true;
    for (const [check, passed] of Object.entries(checks)) {
      console.log(`   ${passed ? '✅' : '❌'} ${check}`);
      if (!passed) allPassed = false;
    }
    
    // Step 5: Display metadata
    console.log('\n📊 Document Metadata:');
    console.log(`   Fiscal Year: ${data._metadata?.fiscalYear}`);
    console.log(`   Client ID: ${data._metadata?.clientId}`);
    console.log(`   Calculation Timestamp: ${data._metadata?.calculationTimestamp}`);
    console.log(`   Bills Processed: ${data._metadata?.billsProcessed}`);
    console.log(`   Units Processed: ${data._metadata?.unitsProcessed}`);
    console.log(`   Last Calculated: ${data._metadata?.lastCalculated?.toDate?.() || 'N/A'}`);
    
    console.log('\n📈 Data Summary:');
    console.log(`   Months: ${data.months?.length}`);
    console.log(`   Total Units per Month: ${Object.keys(data.months?.[0]?.units || {}).length}`);
    console.log(`   Car Wash Rate: $${data.carWashRate}`);
    console.log(`   Boat Wash Rate: $${data.boatWashRate}`);
    
    // Step 6: Compare with API response
    console.log('\n🔄 Step 5: Comparing Firestore data with API response...');
    const apiMonthsCount = response.data?.months?.length || 0;
    const firestoreMonthsCount = data.months?.length || 0;
    
    if (apiMonthsCount === firestoreMonthsCount) {
      console.log(`✅ Month counts match: ${apiMonthsCount} months`);
    } else {
      console.log(`❌ Month counts mismatch: API=${apiMonthsCount}, Firestore=${firestoreMonthsCount}`);
      allPassed = false;
    }
    
    console.log('\n' + '='.repeat(60));
    if (allPassed) {
      console.log('✅ Task 1 PASSED: Aggregated data successfully written to Firestore');
      console.log('   Document path: clients/AVII/projects/waterBills/bills/aggregatedData');
      return true;
    } else {
      console.log('❌ Task 1 FAILED: Some validation checks did not pass');
      return false;
    }
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
    console.error('   Stack:', error.stack);
    return false;
  }
}

// Run the test
testAggregatedDataWrite()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

