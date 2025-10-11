#!/usr/bin/env node

/**
 * SECURITY VERIFICATION ROUND 2 - PROPER TESTING WITH TEST HARNESS
 * 
 * Using the correct test harness and API endpoints
 * Backend: http://localhost:5001/api/
 * 
 * VERIFICATION TARGETS:
 * 1. Admin routes protection (/api/admin/*)
 * 2. Field validation middleware
 * 3. Authentication bypass prevention
 * 4. Public routes justification
 */

import { testHarness, createApiClient } from './testHarness.js';

console.log('🔍 SECURITY VERIFICATION ROUND 2 - PROPER TESTING');
console.log('=================================================');
console.log('Using test harness and correct API endpoints\n');

const allTests = [];

// =================================================================
// 1. ADMIN ROUTE PROTECTION TESTS
// =================================================================

allTests.push({
  name: '1.1 Admin Route - Enable Unit Management (No Auth)',
  plainEnglish: 'Testing if admin route requires authentication',
  expectFailure: true,
  async test({ api }) {
    try {
      // Remove auth header for this test
      const noAuthApi = await createApiClient(null);
      delete noAuthApi.defaults.headers.common['Authorization'];
      
      await noAuthApi.get('/admin/enable-unit-management');
      
      return {
        passed: false,
        plainResult: '❌ CRITICAL: Admin route accessible without authentication!',
        securityRisk: true
      };
    } catch (error) {
      const statusCode = error.response?.status;
      return {
        passed: statusCode === 401 || statusCode === 403,
        plainResult: statusCode === 401 
          ? '✅ Admin route properly requires authentication'
          : statusCode === 403
          ? '✅ Admin route properly requires authorization'  
          : `⚠️ Unexpected response: ${statusCode} - ${error.response?.data?.error}`,
        statusCode,
        errorMessage: error.response?.data?.error
      };
    }
  }
});

allTests.push({
  name: '1.2 Admin Route - Test Unit Management (No Auth)',
  plainEnglish: 'Testing if test admin route requires authentication',
  expectFailure: true,
  async test({ api }) {
    try {
      const noAuthApi = await createApiClient(null);
      delete noAuthApi.defaults.headers.common['Authorization'];
      
      await noAuthApi.get('/admin/test-unit-management');
      
      return {
        passed: false,
        plainResult: '❌ CRITICAL: Test admin route accessible without authentication!',
        securityRisk: true
      };
    } catch (error) {
      const statusCode = error.response?.status;
      return {
        passed: statusCode === 401 || statusCode === 403,
        plainResult: statusCode === 401 
          ? '✅ Test admin route properly requires authentication'
          : statusCode === 403
          ? '✅ Test admin route properly requires authorization'
          : `⚠️ Unexpected response: ${statusCode} - ${error.response?.data?.error}`,
        statusCode,
        errorMessage: error.response?.data?.error
      };
    }
  }
});

// =================================================================
// 2. FIELD VALIDATION TESTS (WITH AUTHENTICATION)
// =================================================================

allTests.push({
  name: '2.1 Forbidden Field "vendor" Rejection',
  plainEnglish: 'Testing if system rejects forbidden field "vendor" with valid authentication',
  expectFailure: true,
  async test({ api }) {
    try {
      await api.post('/user/select-client', {
        clientId: 'test-client',
        vendor: 'FORBIDDEN_FIELD_VALUE'
      });
      
      return {
        passed: false,
        plainResult: '❌ CRITICAL: System accepted forbidden field "vendor"!',
        securityRisk: true,
        legacyCodeActive: true
      };
    } catch (error) {
      const statusCode = error.response?.status;
      const errorMsg = error.response?.data?.error;
      
      if (statusCode === 400 && errorMsg?.includes('FORBIDDEN')) {
        return {
          passed: true,
          plainResult: '✅ System correctly rejected forbidden field "vendor"',
          errorMessage: errorMsg
        };
      } else if (statusCode === 403) {
        return {
          passed: true,
          plainResult: '✅ Client selection properly blocked (insufficient permissions)',
          statusCode
        };
      } else {
        return {
          passed: false,
          plainResult: `⚠️ Unexpected response to forbidden field: ${statusCode} - ${errorMsg}`,
          statusCode,
          errorMessage: errorMsg
        };
      }
    }
  }
});

allTests.push({
  name: '2.2 Forbidden Field "category" Rejection',
  plainEnglish: 'Testing if system rejects forbidden field "category" with valid authentication',
  expectFailure: true,
  async test({ api }) {
    try {
      await api.post('/user/select-client', {
        clientId: 'test-client',
        category: 'FORBIDDEN_FIELD_VALUE'
      });
      
      return {
        passed: false,
        plainResult: '❌ CRITICAL: System accepted forbidden field "category"!',
        securityRisk: true
      };
    } catch (error) {
      const statusCode = error.response?.status;
      const errorMsg = error.response?.data?.error;
      
      if (statusCode === 400 && errorMsg?.includes('FORBIDDEN')) {
        return {
          passed: true,
          plainResult: '✅ System correctly rejected forbidden field "category"',
          errorMessage: errorMsg
        };
      } else if (statusCode === 403) {
        return {
          passed: true,
          plainResult: '✅ Client selection properly blocked (insufficient permissions)',
          statusCode
        };
      } else {
        return {
          passed: false,
          plainResult: `⚠️ Unexpected response to forbidden field: ${statusCode} - ${errorMsg}`,
          statusCode,
          errorMessage: errorMsg
        };
      }
    }
  }
});

allTests.push({
  name: '2.3 Multiple Forbidden Fields Rejection',
  plainEnglish: 'Testing if system rejects multiple forbidden fields at once',
  expectFailure: true,
  async test({ api }) {
    try {
      await api.post('/user/select-client', {
        clientId: 'test-client',
        vendor: 'bad1',
        category: 'bad2',
        account: 'bad3',
        unit: 'bad4'
      });
      
      return {
        passed: false,
        plainResult: '❌ CRITICAL: System accepted multiple forbidden fields!',
        securityRisk: true
      };
    } catch (error) {
      const statusCode = error.response?.status;
      const errorMsg = error.response?.data?.error;
      
      if (statusCode === 400 && errorMsg?.includes('FORBIDDEN')) {
        return {
          passed: true,
          plainResult: '✅ System correctly rejected multiple forbidden fields',
          errorMessage: errorMsg
        };
      } else if (statusCode === 403) {
        return {
          passed: true,
          plainResult: '✅ Client selection properly blocked (insufficient permissions)',
          statusCode
        };
      } else {
        return {
          passed: false,
          plainResult: `⚠️ Unexpected response to multiple forbidden fields: ${statusCode} - ${errorMsg}`,
          statusCode,
          errorMessage: errorMsg
        };
      }
    }
  }
});

// =================================================================
// 3. PUBLIC ROUTE VERIFICATION
// =================================================================

allTests.push({
  name: '3.1 Exchange Rates Public Access',
  plainEnglish: 'Verifying that exchange rates are intentionally public (as claimed)',
  async test({ api }) {
    try {
      const noAuthApi = await createApiClient(null);
      delete noAuthApi.defaults.headers.common['Authorization'];
      
      const response = await noAuthApi.get('/exchange-rates/');
      
      return {
        passed: response.status === 200,
        plainResult: response.status === 200
          ? '⚠️ Exchange rates are public (Implementation Agent claims this is intentional)'
          : `❌ Exchange rates returned unexpected status: ${response.status}`,
        warning: true,
        data: {
          isPublic: response.status === 200,
          hasRateData: response.data?.data?.length > 0
        }
      };
    } catch (error) {
      return {
        passed: false,
        plainResult: `✅ Exchange rates are protected: ${error.response?.status}`,
        statusCode: error.response?.status
      };
    }
  }
});

allTests.push({
  name: '3.2 Onboarding Templates Public Access',
  plainEnglish: 'Verifying that onboarding templates are intentionally public (as claimed)',
  async test({ api }) {
    try {
      const noAuthApi = await createApiClient(null);
      delete noAuthApi.defaults.headers.common['Authorization'];
      
      const response = await noAuthApi.get('/onboarding/templates');
      
      return {
        passed: response.status === 200,
        plainResult: response.status === 200
          ? '⚠️ Onboarding templates are public (Implementation Agent claims this is intentional)'
          : `❌ Onboarding templates returned unexpected status: ${response.status}`,
        warning: true,
        data: {
          isPublic: response.status === 200,
          hasTemplateData: response.data?.templates?.length > 0
        }
      };
    } catch (error) {
      return {
        passed: false,
        plainResult: `✅ Onboarding templates are protected: ${error.response?.status}`,
        statusCode: error.response?.status
      };
    }
  }
});

// =================================================================
// 4. AUTHENTICATION BYPASS TESTS
// =================================================================

allTests.push({
  name: '4.1 User Profile Access (No Auth)',
  plainEnglish: 'Testing if user profile endpoint requires authentication',
  expectFailure: true,
  async test({ api }) {
    try {
      const noAuthApi = await createApiClient(null);
      delete noAuthApi.defaults.headers.common['Authorization'];
      
      await noAuthApi.get('/user/profile');
      
      return {
        passed: false,
        plainResult: '❌ CRITICAL: User profile accessible without authentication!',
        securityRisk: true
      };
    } catch (error) {
      const statusCode = error.response?.status;
      return {
        passed: statusCode === 401,
        plainResult: statusCode === 401
          ? '✅ User profile properly requires authentication'
          : `⚠️ Unexpected response: ${statusCode}`,
        statusCode
      };
    }
  }
});

allTests.push({
  name: '4.2 User Clients Access (No Auth)', 
  plainEnglish: 'Testing if user clients endpoint requires authentication',
  expectFailure: true,
  async test({ api }) {
    try {
      const noAuthApi = await createApiClient(null);
      delete noAuthApi.defaults.headers.common['Authorization'];
      
      await noAuthApi.get('/user/clients');
      
      return {
        passed: false,
        plainResult: '❌ CRITICAL: User clients accessible without authentication!',
        securityRisk: true
      };
    } catch (error) {
      const statusCode = error.response?.status;
      return {
        passed: statusCode === 401,
        plainResult: statusCode === 401
          ? '✅ User clients properly requires authentication'
          : `⚠️ Unexpected response: ${statusCode}`,
        statusCode
      };
    }
  }
});

// =================================================================
// RUN VERIFICATION SUITE
// =================================================================

async function runSecurityVerification() {
  console.log(`🚀 Starting ${allTests.length} security verification tests...\n`);

  const results = await testHarness.runTests(allTests, {
    stopOnFailure: false,
    showSummary: true
  });

  // Analyze results
  console.log('\n📊 SECURITY ANALYSIS');
  console.log('====================\n');

  const securityRisks = results.results.filter(r => r.securityRisk);
  const warnings = results.results.filter(r => r.warning);
  const legacyCodeActive = results.results.filter(r => r.legacyCodeActive);

  if (securityRisks.length > 0) {
    console.log('🚨 CRITICAL SECURITY RISKS:');
    securityRisks.forEach(risk => {
      console.log(`   • ${risk.name}: ${risk.plainResult}`);
    });
    console.log('');
  }

  if (warnings.length > 0) {
    console.log('⚠️  WARNINGS (NEED BUSINESS JUSTIFICATION):');
    warnings.forEach(warning => {
      console.log(`   • ${warning.name}: ${warning.plainResult}`);
    });
    console.log('');
  }

  if (legacyCodeActive.length > 0) {
    console.log('🔴 LEGACY CODE STILL ACTIVE:');
    legacyCodeActive.forEach(legacy => {
      console.log(`   • ${legacy.name}: ${legacy.plainResult}`);
    });
    console.log('');
  }

  const overallSecurity = securityRisks.length === 0 && legacyCodeActive.length === 0;

  console.log(`🎯 VERIFICATION VERDICT: ${overallSecurity ? (warnings.length > 0 ? '⚠️ MOSTLY SECURE' : '✅ SECURE') : '❌ STILL VULNERABLE'}`);
  console.log(`   Tests Passed: ${results.passed}/${results.totalTests}`);
  console.log(`   Critical Security Risks: ${securityRisks.length}`);
  console.log(`   Warnings: ${warnings.length}`);
  console.log(`   Legacy Code Issues: ${legacyCodeActive.length}`);

  if (!overallSecurity) {
    console.log('\n🚨 IMPLEMENTATION AGENT CLAIMS: PARTIALLY FALSE');
    console.log('   System still has critical vulnerabilities despite claimed fixes');
  } else if (warnings.length > 0) {
    console.log('\n⚠️  IMPLEMENTATION AGENT CLAIMS: MOSTLY ACCURATE');
    console.log('   Security fixes appear effective, but public routes need justification');
  } else {
    console.log('\n✅ IMPLEMENTATION AGENT CLAIMS: ACCURATE');
    console.log('   All security vulnerabilities appear to be properly fixed');
  }

  return {
    totalTests: results.totalTests,
    passed: results.passed,
    failed: results.failed,
    securityRisks: securityRisks.length,
    warnings: warnings.length,
    legacyCodeActive: legacyCodeActive.length,
    overallSecure: overallSecurity,
    results: results.results
  };
}

// Execute verification
runSecurityVerification()
  .then((summary) => {
    console.log('\n🏁 SECURITY VERIFICATION COMPLETE');
    console.log('==================================');
    console.log(`Final Security Status: ${summary.overallSecure ? '✅ SECURE' : '❌ VULNERABLE'}`);
    
    process.exit(summary.overallSecure ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n💥 VERIFICATION FAILED:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  });