#!/usr/bin/env node

/**
 * Get Firebase Auth Token for Testing
 * 
 * This script demonstrates how to get a Firebase ID token for testing API endpoints.
 * It supports multiple authentication methods:
 * 1. Email/Password authentication
 * 2. Custom token authentication (using Firebase Admin SDK)
 * 3. Anonymous authentication
 * 
 * Usage:
 *   node scripts/get-firebase-test-token.js --email user@example.com --password yourpassword
 *   node scripts/get-firebase-test-token.js --custom-auth user@example.com
 *   node scripts/get-firebase-test-token.js --anonymous
 */

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  signInAnonymously,
  signInWithCustomToken
} from 'firebase/auth';
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { Command } from 'commander';

// Parse command line arguments
const program = new Command();
program
  .name('get-firebase-test-token')
  .description('Get Firebase ID token for testing')
  .option('-e, --email <email>', 'User email for authentication')
  .option('-p, --password <password>', 'User password for email auth')
  .option('-c, --custom-auth <email>', 'Use custom token auth with email')
  .option('-a, --anonymous', 'Use anonymous authentication')
  .option('--env <environment>', 'Environment (dev|staging|production)', 'dev')
  .option('--show-usage', 'Show example usage in tests')
  .parse();

const options = program.opts();

// Firebase configurations for different environments
const firebaseConfigs = {
  dev: {
    apiKey: "AIzaSyCvZ7_mhNbIQDHGg_CSxOYBmSqvKBW5lJo",
    authDomain: "sandyland-management-system.firebaseapp.com",
    projectId: "sandyland-management-system",
    storageBucket: "sandyland-management-system.firebasestorage.app",
    messagingSenderId: "1086002290145",
    appId: "1:1086002290145:web:a1a1fe980ead7630d186a0",
    measurementId: "G-BSPD6YFJ25"
  },
  staging: {
    // Add staging config here if different
    apiKey: "AIzaSyCvZ7_mhNbIQDHGg_CSxOYBmSqvKBW5lJo",
    authDomain: "sandyland-management-system.firebaseapp.com",
    projectId: "sandyland-management-system",
    storageBucket: "sandyland-management-system.firebasestorage.app",
    messagingSenderId: "1086002290145",
    appId: "1:1086002290145:web:a1a1fe980ead7630d186a0",
    measurementId: "G-BSPD6YFJ25"
  },
  production: {
    // Add production config here if different
    apiKey: "AIzaSyCvZ7_mhNbIQDHGg_CSxOYBmSqvKBW5lJo",
    authDomain: "sandyland-management-system.firebaseapp.com",
    projectId: "sandyland-management-system",
    storageBucket: "sandyland-management-system.firebasestorage.app",
    messagingSenderId: "1086002290145",
    appId: "1:1086002290145:web:a1a1fe980ead7630d186a0",
    measurementId: "G-BSPD6YFJ25"
  }
};

// Service account paths for different environments
const serviceAccountPaths = {
  dev: '../backend/serviceAccountKey.json',
  staging: '../backend/serviceAccountKey-staging.json',
  production: '../backend/serviceAccountKey-production.json'
};

/**
 * Initialize Firebase Admin SDK for custom token generation
 */
function initializeFirebaseAdmin(env = 'dev') {
  const serviceAccountPath = serviceAccountPaths[env];
  try {
    const serviceAccount = JSON.parse(readFileSync(new URL(serviceAccountPath, import.meta.url)));
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
    }
    
    console.log(`🔧 Firebase Admin initialized for ${env.toUpperCase()} environment`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to initialize Firebase Admin:`, error.message);
    console.error(`   Make sure ${serviceAccountPath} exists`);
    return false;
  }
}

/**
 * Get ID token using email/password authentication
 */
async function getTokenWithEmailPassword(email, password, env = 'dev') {
  console.log('\n📧 Using Email/Password Authentication');
  console.log(`Environment: ${env.toUpperCase()}`);
  console.log(`Email: ${email}`);
  
  const app = initializeApp(firebaseConfigs[env]);
  const auth = getAuth(app);
  
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const token = await user.getIdToken();
    
    console.log('\n✅ Authentication successful!');
    console.log(`User ID: ${user.uid}`);
    console.log(`Email: ${user.email}`);
    
    return { token, user };
  } catch (error) {
    console.error('❌ Email/Password authentication failed:', error.message);
    throw error;
  }
}

/**
 * Get ID token using custom token authentication
 */
async function getTokenWithCustomAuth(email, env = 'dev') {
  console.log('\n🔐 Using Custom Token Authentication');
  console.log(`Environment: ${env.toUpperCase()}`);
  console.log(`Email: ${email}`);
  
  // Initialize admin SDK
  if (!initializeFirebaseAdmin(env)) {
    throw new Error('Failed to initialize Firebase Admin');
  }
  
  // Create custom token
  try {
    console.log('Creating custom token...');
    const customToken = await admin.auth().createCustomToken(email, {
      email: email,
      // Add any custom claims here if needed
    });
    
    console.log('✅ Custom token created');
    
    // Sign in with custom token using client SDK
    const app = initializeApp(firebaseConfigs[env]);
    const auth = getAuth(app);
    
    console.log('Exchanging custom token for ID token...');
    const userCredential = await signInWithCustomToken(auth, customToken);
    const user = userCredential.user;
    const token = await user.getIdToken();
    
    console.log('\n✅ Authentication successful!');
    console.log(`User ID: ${user.uid}`);
    
    return { token, user };
  } catch (error) {
    console.error('❌ Custom token authentication failed:', error.message);
    throw error;
  }
}

/**
 * Get ID token using anonymous authentication
 */
async function getTokenAnonymously(env = 'dev') {
  console.log('\n👤 Using Anonymous Authentication');
  console.log(`Environment: ${env.toUpperCase()}`);
  
  const app = initializeApp(firebaseConfigs[env]);
  const auth = getAuth(app);
  
  try {
    const userCredential = await signInAnonymously(auth);
    const user = userCredential.user;
    const token = await user.getIdToken();
    
    console.log('\n✅ Authentication successful!');
    console.log(`User ID: ${user.uid}`);
    console.log(`Anonymous: ${user.isAnonymous}`);
    
    return { token, user };
  } catch (error) {
    console.error('❌ Anonymous authentication failed:', error.message);
    throw error;
  }
}

/**
 * Show example usage in tests
 */
function showTestUsageExamples(token) {
  console.log('\n📚 Example Usage in Tests:\n');
  
  console.log('1️⃣ Using with fetch:');
  console.log(`
const response = await fetch('http://localhost:5001/api/user/profile', {
  headers: {
    'Authorization': \`Bearer \${token}\`,
    'Content-Type': 'application/json'
  }
});
`);

  console.log('2️⃣ Using with axios:');
  console.log(`
const axios = require('axios');
axios.defaults.headers.common['Authorization'] = \`Bearer \${token}\`;

const response = await axios.get('http://localhost:5001/api/user/profile');
`);

  console.log('3️⃣ Using in test scripts:');
  console.log(`
// Save token to environment variable
process.env.TEST_AUTH_TOKEN = token;

// Or save to file for other scripts
fs.writeFileSync('.test-token', token);
`);

  console.log('4️⃣ Testing with curl:');
  console.log(`
curl -H "Authorization: Bearer ${token.substring(0, 20)}..." \\
     -H "Content-Type: application/json" \\
     http://localhost:5001/api/user/profile
`);
}

/**
 * Main function
 */
async function main() {
  try {
    let result;
    
    if (options.email && options.password) {
      // Email/Password authentication
      result = await getTokenWithEmailPassword(options.email, options.password, options.env);
    } else if (options.customAuth) {
      // Custom token authentication
      result = await getTokenWithCustomAuth(options.customAuth, options.env);
    } else if (options.anonymous) {
      // Anonymous authentication
      result = await getTokenAnonymously(options.env);
    } else {
      console.error('❌ Please specify an authentication method:');
      console.error('   --email <email> --password <password>');
      console.error('   --custom-auth <email>');
      console.error('   --anonymous');
      process.exit(1);
    }
    
    const { token, user } = result;
    
    console.log('\n' + '='.repeat(80));
    console.log('🎫 ID TOKEN (use this for API testing):');
    console.log('='.repeat(80));
    console.log(token);
    console.log('='.repeat(80));
    
    // Decode token to show claims
    const decodedToken = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    console.log('\n📋 Token Claims:');
    console.log(`Issuer: ${decodedToken.iss}`);
    console.log(`Subject (UID): ${decodedToken.sub}`);
    console.log(`Email: ${decodedToken.email || 'N/A'}`);
    console.log(`Expires: ${new Date(decodedToken.exp * 1000).toLocaleString()}`);
    
    if (options.showUsage) {
      showTestUsageExamples(token);
    }
    
    console.log('\n✅ Token generation complete!');
    console.log('ℹ️  This token is valid for 1 hour');
    console.log('ℹ️  Use --show-usage flag to see example usage in tests');
    
  } catch (error) {
    console.error('\n❌ Token generation failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main();