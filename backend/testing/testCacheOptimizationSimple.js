/**
 * Simple test for Task 2 Cache Optimization
 * Verifies that timestamp endpoint is much faster than full data endpoint
 */

import { createApiClient } from './apiClient.js';
import { testConfig } from './config.js';

async function testCacheOptimization() {
  console.log('🧪 Testing Cache Optimization: Timestamp vs Full Data');
  
  try {
    const apiClient = await createApiClient(testConfig.DEFAULT_TEST_UID);
    
    // Test timestamp endpoint (should be fast)
    console.log('\n⏰ Testing timestamp endpoint...');
    const timestampStart = Date.now();
    const timestampResponse = await apiClient.get('/water/clients/AVII/lastUpdated?year=2026');
    const timestampDuration = Date.now() - timestampStart;
    
    console.log(`✅ Timestamp: ${timestampDuration}ms`);
    console.log(`   Response: ${timestampResponse.data?.lastUpdated ? 'OK' : 'FAILED'}`);
    
    // Test full data endpoint (should be slower)
    console.log('\n📊 Testing full data endpoint...');
    const fullDataStart = Date.now();
    const fullDataResponse = await apiClient.get('/water/clients/AVII/aggregatedData?year=2026');
    const fullDataDuration = Date.now() - fullDataStart;
    
    console.log(`✅ Full data: ${fullDataDuration}ms`);
    console.log(`   Response: ${fullDataResponse.data?.data ? 'OK' : 'FAILED'}`);
    
    // Calculate speedup
    const speedup = fullDataDuration / timestampDuration;
    
    console.log('\n📈 Results:');
    console.log(`   Timestamp endpoint: ${timestampDuration}ms`);
    console.log(`   Full data endpoint: ${fullDataDuration}ms`);
    console.log(`   Speed-up: ${speedup.toFixed(1)}x faster`);
    
    const success = timestampDuration < 1000 && speedup > 2;
    console.log(`\n${success ? '🎉' : '❌'} ${success ? 'SUCCESS' : 'FAILED'}: Cache optimization ${success ? 'working' : 'needs improvement'}`);
    
    return success;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

testCacheOptimization();
