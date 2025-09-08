/**
 * Demonstrate Real Firebase Token Usage in Tests
 */

import { testHarness, createApiClient } from './testHarness.js';
import { tokenManager } from './tokenManager.js';

async function main() {
  console.log('🔬 Demonstrating Real Firebase Token Testing\n');
  
  // 1. Show how to generate real tokens
  console.log('1️⃣ Generating Real Firebase Tokens:');
  
  const adminUid = 'michael@landesman.com';
  const regularUid = 'test-user@example.com';
  
  // Get real admin token
  const adminToken = await tokenManager.getToken(adminUid);
  console.log(`✅ Admin token generated: ${adminToken.substring(0, 20)}...`);
  
  // 2. Test with real admin token
  await testHarness.runTest({
    name: 'Test Admin Access with Real Token',
    testUser: adminUid,
    async test({ api, token }) {
      console.log(`   Using real token: ${token.substring(0, 20)}...`);
      
      const response = await api.get('/api/admin/users');
      
      return {
        passed: response.status === 200,
        data: response.data,
        message: `Admin endpoint accessed with real Firebase token`
      };
    }
  });
  
  // 3. Test field validation with real admin auth
  await testHarness.runTest({
    name: 'Test Field Validation with Admin Auth',
    testUser: adminUid,
    async test({ api }) {
      // Try to create user with forbidden field
      const response = await api.request({
        method: 'POST',
        url: '/api/admin/users',
        data: {
          email: 'newuser@example.com',
          name: 'Test User',
          vendor: 'forbidden-field' // This should be rejected
        },
        validateStatus: () => true
      });
      
      const passed = response.status === 400 && 
                    response.data.code === 'FORBIDDEN_USER_FIELDS';
      
      return {
        passed: passed,
        actualStatus: response.status,
        data: response.data,
        message: passed ? 
          'Forbidden field correctly rejected' : 
          `Expected field validation error, got ${response.status}`
      };
    }
  });
  
  // 4. Test permission denied scenario
  await testHarness.runTest({
    name: 'Test Regular User Denied Admin Access',
    testUser: regularUid,
    async test({ api }) {
      const response = await api.request({
        method: 'GET',
        url: '/api/admin/users',
        validateStatus: () => true
      });
      
      const passed = response.status === 403;
      
      return {
        passed: passed,
        actualStatus: response.status,
        message: passed ? 
          'Regular user correctly denied admin access' : 
          `Expected 403, got ${response.status}`
      };
    }
  });
  
  // 5. Document token limitations
  console.log('\n📝 Token Test Limitations:');
  console.log('- Expired Token: Firebase tokens expire after 1 hour');
  console.log('  Solution: Save expired tokens from previous runs or wait');
  console.log('- Wrong Project: Requires token from different Firebase project');
  console.log('  Solution: Set up test project or document for manual testing');
  console.log('\n💡 Best Practice: Maintain test token library with:');
  console.log('- Valid tokens for different user roles');
  console.log('- Recently expired tokens (save when tests fail after 1hr)');
  console.log('- Tokens from staging/test Firebase projects');
  
  // Show summary
  testHarness.showSummary();
}

main().catch(console.error);