#!/usr/bin/env node

/**
 * Test API authentication endpoints
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5001/api';
const FRONTEND_BASE = 'http://localhost:3000';

async function testEndpoints() {
  console.log('\n🔍 API Endpoint Testing\n');
  
  // Test backend health
  console.log('1. Testing Backend Health:');
  try {
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();
    console.log('   ✅ Backend is running:', data);
  } catch (error) {
    console.log('   ❌ Backend error:', error.message);
  }
  
  // Test frontend
  console.log('\n2. Testing Frontend:');
  try {
    const response = await fetch(FRONTEND_BASE);
    if (response.ok) {
      console.log('   ✅ Frontend is running on port 3000');
    } else {
      console.log('   ⚠️  Frontend returned status:', response.status);
    }
  } catch (error) {
    console.log('   ❌ Frontend not accessible:', error.message);
  }
  
  // Test auth endpoints
  console.log('\n3. Testing Auth Endpoints:');
  
  // Test user profile endpoint
  console.log('\n   a) /api/user/profile (without auth):');
  try {
    const response = await fetch(`${API_BASE}/user/profile`);
    console.log(`      Status: ${response.status}`);
    const data = await response.json();
    console.log(`      Response: ${JSON.stringify(data)}`);
  } catch (error) {
    console.log('      Error:', error.message);
  }
  
  // Test user list endpoint
  console.log('\n   b) /api/user/list (without auth):');
  try {
    const response = await fetch(`${API_BASE}/user/list`);
    console.log(`      Status: ${response.status}`);
    const data = await response.json();
    console.log(`      Response: ${JSON.stringify(data)}`);
  } catch (error) {
    console.log('      Error:', error.message);
  }
  
  // Check CORS headers
  console.log('\n4. Testing CORS Configuration:');
  try {
    const response = await fetch(`${API_BASE}/health`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET'
      }
    });
    
    const corsHeaders = {
      'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
      'access-control-allow-credentials': response.headers.get('access-control-allow-credentials'),
      'access-control-allow-methods': response.headers.get('access-control-allow-methods')
    };
    
    console.log('   CORS Headers:', corsHeaders);
    
    if (corsHeaders['access-control-allow-origin']) {
      console.log('   ✅ CORS is configured');
    } else {
      console.log('   ⚠️  CORS may not be properly configured');
    }
  } catch (error) {
    console.log('   Error checking CORS:', error.message);
  }
  
  console.log('\n✅ API endpoint tests complete!\n');
  console.log('To test authenticated endpoints, you need to:');
  console.log('1. Login through the frontend at http://localhost:3000');
  console.log('2. Check the browser console for any errors');
  console.log('3. Monitor the backend logs for authentication flow\n');
}

testEndpoints().catch(console.error);