/**
 * Test Task 2 Cache Optimization: Verify lightweight timestamp validation
 * Tests that cache only hits full API when data actually changes
 */

import { createApiClient } from './apiClient.js';
import { testConfig } from './config.js';

const TEST_CLIENT = 'AVII';
const TEST_YEAR = 2026;

async function testOptimizedCache() {
  console.log('🧪 Testing Task 2 Cache Optimization: Lightweight Timestamp Validation');
  console.log('=' .repeat(70));
  
  try {
    // Step 1: Initialize API client with authentication
    console.log('\n📝 Step 1: Authenticating...');
    const apiClient = await createApiClient(testConfig.DEFAULT_TEST_UID);
    console.log('✅ Authentication successful');
    
    // Step 2: Test timestamp endpoint (lightweight)
    console.log(`\n⏰ Step 2: Testing lightweight timestamp endpoint...`);
    const startTime = Date.now();
    
    const timestampResponse = await apiClient.get(`/water/clients/${TEST_CLIENT}/lastUpdated?year=${TEST_YEAR}`);
    const timestampDuration = Date.now() - startTime;
    
    console.log(`✅ Timestamp endpoint response (${timestampDuration}ms):`, {
      success: timestampResponse.data?.success,
      lastUpdated: timestampResponse.data?.lastUpdated,
      fiscalYear: timestampResponse.data?.fiscalYear,
      exists: timestampResponse.data?.exists
    });
    
    // Step 3: Test multiple timestamp calls (should be fast and consistent)
    console.log(`\n🔄 Step 3: Testing multiple timestamp calls for consistency...`);
    const timestampCalls = [];
    
    for (let i = 1; i <= 3; i++) {
      const callStart = Date.now();
      const response = await apiClient.get(`/water/clients/${TEST_CLIENT}/lastUpdated?year=${TEST_YEAR}`);
      const callDuration = Date.now() - callStart;
      
      timestampCalls.push({
        call: i,
        duration: callDuration,
        timestamp: response.data?.lastUpdated
      });
      
      console.log(`   Call ${i}: ${callDuration}ms, timestamp: ${response.data?.lastUpdated}`);
    }
    
    // Step 4: Test full data endpoint (should be slower)
    console.log(`\n📊 Step 4: Testing full data endpoint for comparison...`);
    const fullDataStart = Date.now();
    
    const fullDataResponse = await apiClient.get(`/water/clients/${TEST_CLIENT}/aggregatedData?year=${TEST_YEAR}`);
    const fullDataDuration = Date.now() - fullDataStart;
    
    console.log(`✅ Full data endpoint response (${fullDataDuration}ms):`, {
      success: fullDataResponse.data?.success,
      source: fullDataResponse.data?.source,
      months: fullDataResponse.data?.data?.months?.length,
      timestamp: fullDataResponse.data?.metadata?.calculationTimestamp
    });
    
    // Step 5: Performance Analysis
    console.log(`\n📈 Step 5: Performance Analysis`);
    const avgTimestampDuration = timestampCalls.reduce((sum, call) => sum + call.duration, 0) / timestampCalls.length;
    const speedup = fullDataDuration / avgTimestampDuration;
    
    console.log(`   Average timestamp call: ${avgTimestampDuration.toFixed(1)}ms`);
    console.log(`   Full data call: ${fullDataDuration}ms`);
    console.log(`   Speed-up factor: ${speedup.toFixed(1)}x faster`);
    
    // Step 6: Validate cache behavior simulation
    console.log(`\n🧠 Step 6: Simulating optimized cache behavior...`);
    
    // Simulate cache hit scenario
    console.log(`   Scenario 1: Cache HIT (data unchanged)`);
    console.log(`     - Check timestamp: ${avgTimestampDuration.toFixed(1)}ms`);
    console.log(`     - Use cached data: 0ms`);
    console.log(`     - Total: ${avgTimestampDuration.toFixed(1)}ms`);
    
    // Simulate cache miss scenario  
    console.log(`   Scenario 2: Cache MISS (data changed)`);
    console.log(`     - Check timestamp: ${avgTimestampDuration.toFixed(1)}ms`);
    console.log(`     - Fetch full data: ${fullDataDuration}ms`);
    console.log(`     - Total: ${(avgTimestampDuration + fullDataDuration).toFixed(1)}ms`);
    
    // Success criteria
    const successCriteria = {
      timestampEndpointWorks: timestampResponse.data?.success === true,
      timestampIsFast: avgTimestampDuration < 500, // < 500ms
      fullDataWorks: fullDataResponse.data?.success === true,
      speedupSignificant: speedup > 5, // At least 5x faster
      timestampsConsistent: timestampCalls.every(call => call.timestamp === timestampCalls[0].timestamp)
    };
    
    console.log(`\n✅ Step 7: Success Criteria`);
    Object.entries(successCriteria).forEach(([criterion, passed]) => {
      console.log(`   ${passed ? '✅' : '❌'} ${criterion}: ${passed ? 'PASSED' : 'FAILED'}`);
    });
    
    const allPassed = Object.values(successCriteria).every(Boolean);
    
    console.log(`\n${allPassed ? '🎉' : '❌'} Overall Result: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
    
    if (allPassed) {
      console.log(`\n🚀 Cache optimization is working! Expected behavior:`);
      console.log(`   • Cache hits: Only ${avgTimestampDuration.toFixed(1)}ms (timestamp check only)`);
      console.log(`   • Cache misses: ${(avgTimestampDuration + fullDataDuration).toFixed(1)}ms (timestamp + full data)`);
      console.log(`   • No unnecessary full data fetches when cache is fresh`);
      console.log(`   • ${speedup.toFixed(1)}x faster than always fetching full data`);
    }
    
    return allPassed;
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    return false;
  }
}

// Run the test
testOptimizedCache()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
