#!/usr/bin/env node

/**
 * Validation script for the test harness
 * Tests the harness components without requiring backend to be running
 */

import { tokenManager } from './tokenManager.js';
import { testConfig, validateConfig } from './config.js';

async function validateHarness() {
  console.log('🔍 Validating SAMS Test Harness Components\n');

  let allPassed = true;
  const results = [];

  // Test 1: Configuration validation
  console.log('1️⃣ Testing Configuration...');
  try {
    const configValidation = validateConfig();
    const passed = configValidation.isValid;
    results.push({ test: 'Configuration', passed, error: null });
    
    if (passed) {
      console.log('   ✅ Configuration is valid');
      console.log(`   📍 API Base URL: ${testConfig.API_BASE_URL}`);
      console.log(`   👤 Default Test UID: ${testConfig.DEFAULT_TEST_UID}`);
    } else {
      console.log('   ❌ Configuration missing:', configValidation.missing.join(', '));
      allPassed = false;
    }
  } catch (error) {
    console.log('   💥 Configuration error:', error.message);
    results.push({ test: 'Configuration', passed: false, error: error.message });
    allPassed = false;
  }

  // Test 2: Token manager validation
  console.log('\n2️⃣ Testing Token Manager...');
  try {
    const defaultUid = tokenManager.getDefaultTestUid();
    const passed = defaultUid === 'fjXv8gX1CYWBvOZ1CS27j96oRCT2';
    results.push({ test: 'Token Manager UID', passed, error: null });
    
    if (passed) {
      console.log('   ✅ Token manager initialized correctly');
      console.log(`   🔑 Default UID: ${defaultUid}`);
    } else {
      console.log('   ❌ Token manager UID mismatch');
      allPassed = false;
    }

    // Test token caching methods
    tokenManager.clearCache();
    const isCached = tokenManager.isTokenCached();
    const cacheTestPassed = isCached === false;
    results.push({ test: 'Token Manager Cache', passed: cacheTestPassed, error: null });
    
    if (cacheTestPassed) {
      console.log('   ✅ Token caching methods work');
    } else {
      console.log('   ❌ Token caching issue');
      allPassed = false;
    }

  } catch (error) {
    console.log('   💥 Token manager error:', error.message);
    results.push({ test: 'Token Manager', passed: false, error: error.message });
    allPassed = false;
  }

  // Test 3: Module imports
  console.log('\n3️⃣ Testing Module Imports...');
  try {
    const { createApiClient } = await import('./apiClient.js');
    const { testHarness } = await import('./testHarness.js');
    
    const passed = typeof createApiClient === 'function' && 
                   typeof testHarness === 'object' &&
                   typeof testHarness.runTest === 'function';
    
    results.push({ test: 'Module Imports', passed, error: null });
    
    if (passed) {
      console.log('   ✅ All modules import correctly');
      console.log('   📦 createApiClient function available');
      console.log('   📦 testHarness object available');
      console.log('   📦 testHarness.runTest method available');
    } else {
      console.log('   ❌ Module import issue');
      allPassed = false;
    }
  } catch (error) {
    console.log('   💥 Module import error:', error.message);
    results.push({ test: 'Module Imports', passed: false, error: error.message });
    allPassed = false;
  }

  // Test 4: ES Module syntax validation
  console.log('\n4️⃣ Testing ES Module Syntax...');
  try {
    // Check that we're using ES modules properly by testing import.meta
    const isESModule = typeof import.meta !== 'undefined';
    results.push({ test: 'ES Modules', passed: isESModule, error: null });
    
    if (isESModule) {
      console.log('   ✅ ES Module syntax is working');
      console.log('   🔧 import.meta available');
    } else {
      console.log('   ❌ ES Module issue');
      allPassed = false;
    }
  } catch (error) {
    console.log('   💥 ES Module error:', error.message);
    results.push({ test: 'ES Modules', passed: false, error: error.message });
    allPassed = false;
  }

  // Test 5: Test harness basic structure
  console.log('\n5️⃣ Testing Test Harness Structure...');
  try {
    const { testHarness } = await import('./testHarness.js');
    
    const hasRequiredMethods = typeof testHarness.runTest === 'function' &&
                              typeof testHarness.runTests === 'function' &&
                              typeof testHarness.showSummary === 'function' &&
                              typeof testHarness.reset === 'function';
    
    results.push({ test: 'Test Harness Structure', passed: hasRequiredMethods, error: null });
    
    if (hasRequiredMethods) {
      console.log('   ✅ Test harness has all required methods');
      console.log('   🔧 runTest method available');
      console.log('   🔧 runTests method available');
      console.log('   🔧 showSummary method available');
      console.log('   🔧 reset method available');
    } else {
      console.log('   ❌ Test harness missing required methods');
      allPassed = false;
    }
  } catch (error) {
    console.log('   💥 Test harness structure error:', error.message);
    results.push({ test: 'Test Harness Structure', passed: false, error: error.message });
    allPassed = false;
  }

  // Summary
  console.log('\n📊 Validation Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach(result => {
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${result.test}`);
    if (!result.passed && result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Results: ${passed}/${total} passed`);
  
  if (allPassed) {
    console.log('\n🎉 All components validated successfully!');
    console.log('📝 The test harness is ready for use.');
    console.log('🚀 To test with live backend, start backend with: npm run dev');
    console.log('📖 See examples in: backend/testing/examples/');
  } else {
    console.log('\n⚠️  Some components failed validation.');
    console.log('🔧 Please fix the issues above before using the test harness.');
  }

  return allPassed;
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateHarness()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n💥 Validation failed:', error);
      process.exit(1);
    });
}

export { validateHarness };