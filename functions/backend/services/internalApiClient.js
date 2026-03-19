/**
 * Internal API Client for Scheduled Functions
 * 
 * Creates an authenticated axios instance for server-to-server calls
 * from scheduled Cloud Functions (e.g., nightly scheduler) to the SAMS API.
 * 
 * Uses Firebase Admin SDK to mint a custom token for a synthetic "system-scheduler"
 * UID, exchanges it for an ID token via the Identity Toolkit REST API, then
 * creates an axios instance with that token.
 */

import admin from 'firebase-admin';
import axios from 'axios';
import { getDb } from '../firebase.js';

const SYSTEM_UID = 'system-scheduler';

const FIREBASE_API_KEYS = {
  'sams-sandyland-prod': 'AIzaSyCuRdgX3QTl0O5XVcucp_6P2C2uQx1fu0c',
  'sandyland-management-system': 'AIzaSyCvZ7_mhNbIQDHGg_CSxOYBmSqvKBW5lJo'
};

function getFirebaseApiKey() {
  const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_CONFIG && JSON.parse(process.env.FIREBASE_CONFIG).projectId;
  return FIREBASE_API_KEYS[projectId] || FIREBASE_API_KEYS['sandyland-management-system'];
}

export function getApiBaseUrl() {
  if (process.env.API_BASE_URL) return process.env.API_BASE_URL;
  if (process.env.GCLOUD_PROJECT === 'sams-sandyland-prod') {
    return 'https://sams.sandyland.com.mx';
  }
  return 'http://localhost:5001';
}

async function ensureSystemUser() {
  const db = await getDb();
  const userRef = db.collection('users').doc(SYSTEM_UID);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    console.log('📋 [INTERNAL-API] Creating system-scheduler user document...');
    await userRef.set({
      email: 'system@sams.sandyland.com.mx',
      displayName: 'System Scheduler',
      globalRole: 'superAdmin',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isSystemAccount: true
    });
  }

  try {
    await admin.auth().getUser(SYSTEM_UID);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.log('📋 [INTERNAL-API] Creating system-scheduler Auth user...');
      await admin.auth().createUser({
        uid: SYSTEM_UID,
        email: 'system@sams.sandyland.com.mx',
        displayName: 'System Scheduler',
        disabled: false
      });
    } else {
      throw error;
    }
  }
}

/**
 * Create an authenticated axios instance for internal API calls.
 * Caches the token for the lifetime of the function invocation.
 */
export async function createInternalApiClient() {
  await ensureSystemUser();

  const customToken = await admin.auth().createCustomToken(SYSTEM_UID);

  const apiKey = getFirebaseApiKey();
  const tokenResponse = await axios.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    { token: customToken, returnSecureToken: true }
  );

  const idToken = tokenResponse.data.idToken;
  const baseURL = getApiBaseUrl();

  console.log(`🔑 [INTERNAL-API] Authenticated as ${SYSTEM_UID}, API: ${baseURL}`);

  return axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    timeout: 120000
  });
}
