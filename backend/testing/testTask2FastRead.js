/**
 * Test Task 2: Verify fast read from aggregatedData document
 * Tests that the new endpoint reads from Firestore quickly (< 1 second)
 */

import { createApiClient } from './apiClient.js';
import { testConfig } from './config.js';

const TEST_CLIENT = 'AVII';
const TEST_YEAR = 2026;
const PERFORMANCE_TARGET_MS = 1000; // < 1 second

async function testFastRead() {
  console.log('🧪 Testing Task 2: Fast Read from aggregatedData');
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Initialize API client with authentication
    console.log('\n📝 Step 1: Authenticating...');
    const apiClient = await createApiClient(testConfig.DEFAULT_TEST_UID);
    console.log('✅ Authentication successful');
    
    // Step 2: Test SLOW PATH (legacy on-demand aggregation) for baseline
    console.log(`\n📊 Step 2: Baseline - Testing SLOW PATH (on-demand aggregation)...`);
    console.log(`   Calling: GET /water/clients/${TEST_CLIENT}/data/${TEST_YEAR}`);
    
    const slowStartTime = Date.now();
    const slowResponse = await apiClient.get(`/water/clients/${TEST_CLIENT}/data/${TEST_YEAR}`);
    const slowEndTime = Date.now();
    const slowDuration = slowEndTime - slowStartTime;
    
    console.log(`⏱️  Slow path duration: ${slowDuration}ms`);
    console.log(`   Response success: ${slowResponse.success}`);
    console.log(`   Months returned: ${slowResponse.data?.months?.length || 0}`);
    
    // Step 3: Test FAST PATH (read from aggregatedData)
    console.log(`\n⚡ Step 3: Testing FAST PATH (read from aggregatedData)...`);
    console.log(`   Calling: GET /water/clients/${TEST_CLIENT}/aggregatedData?year=${TEST_YEAR}`);
    
    const fastStartTime = Date.now();
    const fastResponse = await apiClient.get(`/water/clients/${TEST_CLIENT}/aggregatedData?year=${TEST_YEAR}`);
    const fastEndTime = Date.now();
    const fastDuration = fastEndTime - fastStartTime;
    
    console.log(`⏱️  Fast path duration: ${fastDuration}ms`);
    console.log(`   Response success: ${fastResponse.success}`);
    console.log(`   Source: ${fastResponse.source}`);
    console.log(`   Months returned: ${fastResponse.data?.months?.length || 0}`);
    console.log(`   Metadata timestamp: ${fastResponse.metadata?.calculationTimestamp}`);
    
    // Step 4: Calculate performance improvement
    console.log('\n📈 Step 4: Performance Analysis...');
    
    const improvement = ((slowDuration - fastDuration) / slowDuration * 100).toFixed(1);
    const speedup = (slowDuration / fastDuration).toFixed(1);
    
    console.log(`   Slow path: ${slowDuration}ms`);
    console.log(`   Fast path: ${fastDuration}ms`);
    console.log(`   Improvement: ${improvement}% faster`);
    console.log(`   Speed-up: ${speedup}x`);
    
    // Step 5: Validate results
    console.log('\n🔍 Step 5: Validation...');
    
    const checks = {
      'Fast path < 1 second target': fastDuration < PERFORMANCE_TARGET_MS,
      'Fast path faster than slow': fastDuration < slowDuration,
      'Response successful': fastResponse.success,
      'Source is firestore': fastResponse.source === 'firestore',
      'Has metadata': !!fastResponse.metadata,
      'Months count correct': fastResponse.data?.months?.length > 0,
      'Data structure matches': fastResponse.data?.months?.length === slowResponse.data?.months?.length,
      'Performance improvement > 50%': improvement > 50
    };
    
    let allPassed = true;
    for (const [check, passed] of Object.entries(checks)) {
      console.log(`   ${passed ? '✅' : '❌'} ${check}`);
      if (!passed) allPassed = false;
    }
    
    // Step 6: Test cache behavior (second request should be even faster)
    console.log('\n🔄 Step 6: Testing cache behavior (second read)...');
    
    const cachedStartTime = Date.now();
    const cachedResponse = await apiClient.get(`/water/clients/${TEST_CLIENT}/aggregatedData?year=${TEST_YEAR}`);
    const cachedEndTime = Date.now();
    const cachedDuration = cachedEndTime - cachedStartTime;
    
    console.log(`⏱️  Cached read duration: ${cachedDuration}ms`);
    console.log(`   Should be similar to first fast read (both read from Firestore)`);
    
    console.log('\n' + '='.repeat(60));
    if (allPassed) {
      console.log('✅ Task 2 PASSED: Fast read working with significant performance improvement');
      console.log(`   Performance target: < ${PERFORMANCE_TARGET_MS}ms ✓`);
      console.log(`   Actual performance: ${fastDuration}ms`);
      console.log(`   Improvement: ${improvement}% faster (${speedup}x speed-up)`);
      return true;
    } else {
      console.log('❌ Task 2 FAILED: Some validation checks did not pass');
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
testFastRead()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

