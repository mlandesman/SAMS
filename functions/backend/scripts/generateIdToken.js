#!/usr/bin/env node

/**
 * Generate Firebase ID Token for Testing
 * Creates a custom token and exchanges it for an ID token
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  const serviceAccountPath = join(__dirname, '../serviceAccountKey.json');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

/**
 * Generate ID token for the test user
 */
async function generateIdToken() {
  const TEST_UID = 'fjXv8gX1CYWBvOZ1CS27j96oRCT2';
  
  try {
    // First, create a custom token
    console.log('🔐 Creating custom token...');
    const customToken = await admin.auth().createCustomToken(TEST_UID);
    console.log('✅ Custom token created');
    
    // Get the API key from service account
    const serviceAccountPath = join(__dirname, '../serviceAccountKey.json');
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    const projectId = serviceAccount.project_id;
    
    // Exchange custom token for ID token using Firebase Auth REST API
    console.log('🔄 Exchanging custom token for ID token...');
    const response = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.FIREBASE_API_KEY || 'YOUR_API_KEY'}`,
      {
        token: customToken,
        returnSecureToken: true
      }
    );
    
    const idToken = response.data.idToken;
    console.log('✅ ID token generated successfully');
    
    return idToken;
  } catch (error) {
    console.error('❌ Error generating ID token:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    
    // Fallback: just return the custom token (might work for testing)
    console.log('⚠️  Returning custom token as fallback...');
    const customToken = await admin.auth().createCustomToken(TEST_UID);
    return customToken;
  }
}

// If run directly, print token
if (import.meta.url === `file://${process.argv[1]}`) {
  generateIdToken()
    .then(token => {
      console.log('\\n🔑 Firebase Token for Testing:');
      console.log(token);
      console.log('\\nUse this token in Authorization header:');
      console.log(`Authorization: Bearer ${token}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}

export { generateIdToken };