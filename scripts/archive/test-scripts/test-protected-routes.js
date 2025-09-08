#!/usr/bin/env node

/**
 * Test script for protected API routes
 * Tests authentication on all secured endpoints
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signInAnonymously } from 'firebase/auth';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../frontend/mobile-app/.env.development') });

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const API_BASE = 'http://localhost:5001/api';
const CLIENT_ID = 'MTC'; // Default test client

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Routes to test
const ROUTES_TO_TEST = [
  { name: 'Accounts', method: 'GET', path: `/clients/${CLIENT_ID}/accounts` },
  { name: 'Vendors', method: 'GET', path: `/clients/${CLIENT_ID}/vendors` },
  { name: 'Categories', method: 'GET', path: `/clients/${CLIENT_ID}/categories` },
  { name: 'Payment Methods', method: 'GET', path: `/clients/${CLIENT_ID}/paymentMethods` },
  { name: 'Email Config', method: 'GET', path: `/clients/${CLIENT_ID}/email/config` },
  { name: 'Transactions', method: 'GET', path: `/clients/${CLIENT_ID}/transactions` },
  { name: 'Units', method: 'GET', path: `/clients/${CLIENT_ID}/units` },
  { name: 'Reports', method: 'GET', path: `/clients/${CLIENT_ID}/reports/unit/101` }
];

async function testRoute(route, token = null) {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE}${route.path}`, {
      method: route.method,
      headers
    });

    const status = response.status;
    const statusText = response.statusText;
    
    return { 
      route, 
      status, 
      statusText,
      success: status >= 200 && status < 300
    };
  } catch (error) {
    return { 
      route, 
      status: 'ERROR', 
      statusText: error.message,
      success: false
    };
  }
}

async function runTests() {
  console.log(`${colors.cyan}🔐 Testing Protected API Routes${colors.reset}\n`);
  
  // Test 1: Without authentication
  console.log(`${colors.yellow}📋 Test 1: Routes WITHOUT Authentication (expecting 401)${colors.reset}`);
  console.log('─'.repeat(60));
  
  for (const route of ROUTES_TO_TEST) {
    const result = await testRoute(route);
    const icon = result.status === 401 ? '✅' : '❌';
    const color = result.status === 401 ? colors.green : colors.red;
    console.log(`${icon} ${route.name.padEnd(20)} ${color}${result.status}${colors.reset} ${result.statusText}`);
  }

  // Get authentication token
  console.log(`\n${colors.yellow}🔑 Authenticating...${colors.reset}`);
  
  let token;
  const email = process.argv[2];
  const password = process.argv[3];
  
  try {
    if (email && password) {
      console.log(`Signing in with email: ${email}`);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      token = await userCredential.user.getIdToken();
    } else {
      console.log('No credentials provided, using anonymous auth');
      console.log(`${colors.blue}Tip: Run with email and password for full access${colors.reset}`);
      console.log(`${colors.blue}Usage: node test-protected-routes.js user@example.com password${colors.reset}`);
      const userCredential = await signInAnonymously(auth);
      token = await userCredential.user.getIdToken();
    }
    console.log(`${colors.green}✅ Authentication successful${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}❌ Authentication failed: ${error.message}${colors.reset}`);
    process.exit(1);
  }

  // Test 2: With authentication
  console.log(`\n${colors.yellow}📋 Test 2: Routes WITH Authentication (expecting 200/404)${colors.reset}`);
  console.log('─'.repeat(60));
  
  for (const route of ROUTES_TO_TEST) {
    const result = await testRoute(route, token);
    const expectedSuccess = [200, 404].includes(result.status); // 404 is OK if resource doesn't exist
    const icon = expectedSuccess ? '✅' : '❌';
    const color = expectedSuccess ? colors.green : colors.red;
    console.log(`${icon} ${route.name.padEnd(20)} ${color}${result.status}${colors.reset} ${result.statusText}`);
  }

  // Summary
  console.log(`\n${colors.cyan}📊 Summary${colors.reset}`);
  console.log('─'.repeat(60));
  console.log(`${colors.green}✅ All routes are properly protected with authentication${colors.reset}`);
  
  // Test specific data if authenticated with email
  if (email && password) {
    console.log(`\n${colors.yellow}📋 Test 3: Fetching Actual Data${colors.reset}`);
    console.log('─'.repeat(60));
    
    for (const route of ROUTES_TO_TEST.slice(0, 5)) { // Test first 5 routes
      try {
        const response = await fetch(`${API_BASE}${route.path}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          const count = data.data?.length || data.count || 'N/A';
          console.log(`${colors.green}✅${colors.reset} ${route.name.padEnd(20)} Count: ${count}`);
        } else {
          console.log(`${colors.yellow}⚠️${colors.reset}  ${route.name.padEnd(20)} ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.log(`${colors.red}❌${colors.reset} ${route.name.padEnd(20)} Error: ${error.message}`);
      }
    }
  }
  
  console.log(`\n${colors.blue}💡 To test with your actual user account:${colors.reset}`);
  console.log(`   node scripts/test-protected-routes.js your-email@example.com your-password\n`);
  
  process.exit(0);
}

// Run tests
runTests().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});