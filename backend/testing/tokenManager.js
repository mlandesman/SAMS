import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Firebase client config (from get-firebase-test-token.js)
const firebaseConfig = {
  apiKey: "AIzaSyCvZ7_mhNbIQDHGg_CSxOYBmSqvKBW5lJo",
  authDomain: "sandyland-management-system.firebaseapp.com",
  projectId: "sandyland-management-system",
  storageBucket: "sandyland-management-system.firebasestorage.app",
  messagingSenderId: "1086002290145",
  appId: "1:1086002290145:web:a1a1fe980ead7630d186a0",
  measurementId: "G-BSPD6YFJ25"
};

// Initialize Firebase Admin SDK for testing (following get-firebase-test-token.js pattern)
function initializeTestFirebaseAdmin() {
  const serviceAccountPath = join(__dirname, '../serviceAccountKey.json');
  
  try {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath));
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      console.log('🔥 Test harness Firebase Admin initialized');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin for testing:', error.message);
    return false;
  }
}

/**
 * Get Firebase ID token using custom token authentication
 * Based on getTokenWithCustomAuth from get-firebase-test-token.js (lines 138-175)
 */
async function getTestIdToken(uid = 'fjXv8gX1CYWBvOZ1CS27j96oRCT2') {
  try {
    // Step 1: Initialize Firebase Admin SDK
    if (!initializeTestFirebaseAdmin()) {
      throw new Error('Failed to initialize Firebase Admin');
    }

    // Step 2: Create custom token
    console.log(`🔑 Creating custom token for UID: ${uid}...`);
    const customToken = await admin.auth().createCustomToken(uid, {
      // Add any custom claims here if needed
    });

    // Step 3: Sign in with custom token using Firebase client SDK
    const app = initializeApp(firebaseConfig, 'test-harness-client');
    const auth = getAuth(app);

    console.log('🔄 Exchanging custom token for ID token...');
    const userCredential = await signInWithCustomToken(auth, customToken);
    const user = userCredential.user;
    
    // Step 4: Get the ID token
    const idToken = await user.getIdToken();

    console.log(`✅ ID token generated successfully for UID: ${user.uid}`);
    return idToken;

  } catch (error) {
    console.error('❌ Failed to generate ID token:', error.message);
    throw error;
  }
}

class TokenManager {
  constructor() {
    this.tokenCache = new Map();
    this.tokenExpiry = new Map();
    this.DEFAULT_TEST_UID = 'fjXv8gX1CYWBvOZ1CS27j96oRCT2';
  }

  /**
   * Get a valid ID token for testing, with caching
   * @param {string} uid - User ID for token generation (optional, uses default test UID)
   * @returns {Promise<string>} - Valid Firebase ID token
   */
  async getToken(uid = this.DEFAULT_TEST_UID) {
    // Check if we have a cached token that's still valid
    const cached = this.tokenCache.get(uid);
    const expiry = this.tokenExpiry.get(uid);
    
    if (cached && expiry && Date.now() < expiry) {
      return cached;
    }

    // Generate new ID token using the working pattern
    try {
      const idToken = await getTestIdToken(uid);
      
      // Cache token for 50 minutes (tokens are valid for 1 hour)
      this.tokenCache.set(uid, idToken);
      this.tokenExpiry.set(uid, Date.now() + (50 * 60 * 1000));
      
      return idToken;
    } catch (error) {
      console.error(`Failed to generate token for UID ${uid}:`, error);
      throw new Error(`Token generation failed: ${error.message}`);
    }
  }

  /**
   * Generate a new ID token for a specific UID (alias for consistency)
   * @param {string} uid - User ID for token generation
   * @returns {Promise<string>} - Valid Firebase ID token
   */
  async generateTokenForUid(uid) {
    return await getTestIdToken(uid);
  }

  /**
   * Clear token cache (useful for testing token refresh)
   */
  clearCache() {
    this.tokenCache.clear();
    this.tokenExpiry.clear();
  }

  /**
   * Get the default test UID
   * @returns {string} - Default test UID
   */
  getDefaultTestUid() {
    return this.DEFAULT_TEST_UID;
  }

  /**
   * Validate if a token is still cached and valid
   * @param {string} uid - User ID to check
   * @returns {boolean} - True if token is cached and valid
   */
  isTokenCached(uid = this.DEFAULT_TEST_UID) {
    const expiry = this.tokenExpiry.get(uid);
    return expiry && Date.now() < expiry;
  }
}

// Export singleton instance
const tokenManager = new TokenManager();
export { tokenManager };