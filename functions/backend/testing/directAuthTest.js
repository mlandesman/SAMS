#!/usr/bin/env node

/**
 * Direct Auth Routes Test (bypassing health check)
 * Tests auth endpoints directly without using test harness health check
 */

import { tokenManager } from './tokenManager.js';
import { testConfig } from './config.js';

const API_BASE_URL = testConfig.API_BASE_URL;

async function testAuthEndpoints() {
  console.log('🧪 Direct Auth Endpoints Test');
  console.log(`🔗 Testing against: ${API_BASE_URL}`);
  
  try {
    // Get test token
    console.log('🔑 Getting test authentication token...');
    const token = await tokenManager.getToken();
    console.log('✅ Token acquired');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Test 1: New auth user profile endpoint
    console.log('\n📋 Test 1: Auth User Profile (/auth/user/profile)');
    try {
      const response1 = await fetch(`${API_BASE_URL}/auth/user/profile`, {
        method: 'GET',
        headers
      });
      
      console.log(`   Status: ${response1.status}`);
      
      if (response1.status === 200) {
        const data = await response1.json();
        console.log('   ✅ SUCCESS - Auth user profile working');
        console.log(`   Response has data: ${!!data.data}`);
      } else {
        const error = await response1.text();
        console.log('   ❌ FAILED - Auth user profile not working');
        console.log(`   Error: ${error}`);
      }
    } catch (error) {
      console.log('   ❌ FAILED - Network error');
      console.log(`   Error: ${error.message}`);
    }
    
    // Test 2: New auth user clients endpoint  
    console.log('\n📋 Test 2: Auth User Clients (/auth/user/clients)');
    try {
      const response2 = await fetch(`${API_BASE_URL}/auth/user/clients`, {
        method: 'GET',
        headers
      });
      
      console.log(`   Status: ${response2.status}`);
      
      if (response2.status === 200) {
        const data = await response2.json();
        console.log('   ✅ SUCCESS - Auth user clients working');
        console.log(`   Response has data: ${!!data.data}`);
      } else {
        const error = await response2.text();
        console.log('   ❌ FAILED - Auth user clients not working');
        console.log(`   Error: ${error}`);
      }
    } catch (error) {
      console.log('   ❌ FAILED - Network error');
      console.log(`   Error: ${error.message}`);
    }
    
    // Test 3: Legacy route should fail
    console.log('\n📋 Test 3: Legacy Route (/api/user/profile) - Should Fail');
    try {
      const response3 = await fetch(`${API_BASE_URL}/api/user/profile`, {
        method: 'GET',
        headers
      });
      
      console.log(`   Status: ${response3.status}`);
      
      if (response3.status === 404) {
        console.log('   ✅ SUCCESS - Legacy route properly removed (404)');
      } else {
        console.log('   ❌ FAILED - Legacy route still exists');
        console.log(`   Should be 404, got ${response3.status}`);
      }
    } catch (error) {
      console.log('   ❌ Network error (might still be good if 404)');
      console.log(`   Error: ${error.message}`);
    }
    
    // Test 4: System health check
    console.log('\n📋 Test 4: System Health Check (/system/health)');
    try {
      const response4 = await fetch(`${API_BASE_URL}/system/health`, {
        method: 'GET'
      });
      
      console.log(`   Status: ${response4.status}`);
      
      if (response4.status === 200) {
        const data = await response4.json();
        console.log('   ✅ SUCCESS - System health working');
        console.log(`   Health status: ${data.status}`);
      } else {
        console.log('   ❌ FAILED - System health not working');
      }
    } catch (error) {
      console.log('   ❌ FAILED - Network error');
      console.log(`   Error: ${error.message}`);
    }
    
    console.log('\n🏁 Direct auth test completed');
    
  } catch (error) {
    console.error('❌ Test setup failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testAuthEndpoints().catch(console.error);