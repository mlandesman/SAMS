#!/usr/bin/env node

/**
 * Example: Using Firebase Auth Token in Tests
 * 
 * This script demonstrates how to authenticate and use the ID token
 * to test protected API endpoints.
 * 
 * Usage: node scripts/test-with-auth-token.js
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import fetch from 'node-fetch';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCvZ7_mhNbIQDHGg_CSxOYBmSqvKBW5lJo",
  authDomain: "sandyland-management-system.firebaseapp.com",
  projectId: "sandyland-management-system",
  storageBucket: "sandyland-management-system.firebasestorage.app",
  messagingSenderId: "1086002290145",
  appId: "1:1086002290145:web:a1a1fe980ead7630d186a0",
  measurementId: "G-BSPD6YFJ25"
};

// API configuration
const API_BASE_URL = 'http://localhost:5001/api';

// Test user credentials (replace with your test user)
const TEST_USER = {
  email: 'michael@landesman.com',
  password: 'your-password-here' // Replace with actual password
};

/**
 * Step 1: Authenticate and get ID token
 */
async function authenticateUser() {
  console.log('🔐 Authenticating user...');
  
  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  
  try {
    // Sign in with email and password
    const userCredential = await signInWithEmailAndPassword(
      auth, 
      TEST_USER.email, 
      TEST_USER.password
    );
    
    // Get the ID token
    const idToken = await userCredential.user.getIdToken();
    
    console.log('✅ Authentication successful!');
    console.log(`   User: ${userCredential.user.email}`);
    console.log(`   UID: ${userCredential.user.uid}`);
    console.log(`   Token length: ${idToken.length} characters`);
    
    return idToken;
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    throw error;
  }
}

/**
 * Step 2: Make authenticated API request
 */
async function testAuthenticatedEndpoint(token) {
  console.log('\n📡 Testing authenticated API endpoint...');
  
  try {
    // Example 1: Get user profile
    console.log('\n1️⃣ Getting user profile:');
    const profileResponse = await fetch(`${API_BASE_URL}/user/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (profileResponse.ok) {
      const profile = await profileResponse.json();
      console.log('✅ Profile retrieved:');
      console.log(`   Name: ${profile.name}`);
      console.log(`   Email: ${profile.email}`);
      console.log(`   Role: ${profile.globalRole}`);
      console.log(`   Clients: ${profile.samsProfile?.clientAccess?.join(', ') || 'None'}`);
    } else {
      console.error('❌ Profile request failed:', profileResponse.status, await profileResponse.text());
    }
    
    // Example 2: Get available clients
    console.log('\n2️⃣ Getting available clients:');
    const clientsResponse = await fetch(`${API_BASE_URL}/user/clients`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (clientsResponse.ok) {
      const { clients } = await clientsResponse.json();
      console.log('✅ Available clients:');
      clients.forEach(client => {
        console.log(`   - ${client.id}: ${client.name}`);
      });
    } else {
      console.error('❌ Clients request failed:', clientsResponse.status, await clientsResponse.text());
    }
    
    // Example 3: Test protected resource
    console.log('\n3️⃣ Testing client-specific endpoint:');
    const testClientId = 'MTC'; // Replace with a client the user has access to
    const transactionsResponse = await fetch(`${API_BASE_URL}/clients/${testClientId}/transactions?limit=5`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (transactionsResponse.ok) {
      const transactions = await transactionsResponse.json();
      console.log(`✅ Retrieved ${transactions.length} transactions from ${testClientId}`);
    } else {
      console.error('❌ Transactions request failed:', transactionsResponse.status, await transactionsResponse.text());
    }
    
  } catch (error) {
    console.error('❌ API test failed:', error.message);
    throw error;
  }
}

/**
 * Step 3: Test unauthorized access (should fail)
 */
async function testUnauthorizedAccess() {
  console.log('\n🚫 Testing unauthorized access (should fail)...');
  
  try {
    // Try to access without token
    const response = await fetch(`${API_BASE_URL}/user/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.status === 401) {
      console.log('✅ Correctly rejected unauthorized request');
    } else {
      console.error('❌ Security issue: Expected 401, got', response.status);
    }
    
  } catch (error) {
    console.error('❌ Unauthorized test failed:', error.message);
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🧪 Firebase Auth Token Test Script');
  console.log('=' * 50);
  
  try {
    // Test unauthorized access first
    await testUnauthorizedAccess();
    
    // Authenticate and get token
    const token = await authenticateUser();
    
    // Test authenticated endpoints
    await testAuthenticatedEndpoint(token);
    
    console.log('\n✅ All tests completed!');
    console.log('\n💡 Tips for using auth tokens in tests:');
    console.log('   1. Store test credentials securely (use environment variables)');
    console.log('   2. Create dedicated test users with limited permissions');
    console.log('   3. Tokens expire after 1 hour - refresh as needed');
    console.log('   4. Use try-catch blocks to handle auth failures gracefully');
    console.log('   5. Always include Bearer prefix in Authorization header');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run the tests
runTests();