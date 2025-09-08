import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
 * Generate test token for the dev superadmin account
 */
export async function generateTestToken() {
  const TEST_UID = 'fjXv8gX1CYWBvOZ1CS27j96oRCT2';
  
  try {
    // Create custom token
    const token = await admin.auth().createCustomToken(TEST_UID);
    console.log('Test token generated successfully');
    return token;
  } catch (error) {
    console.error('Failed to generate test token:', error);
    throw error;
  }
}

// If run directly, print token
if (import.meta.url === `file://${process.argv[1]}`) {
  generateTestToken()
    .then(token => {
      console.log('\nTest token for UID fjXv8gX1CYWBvOZ1CS27j96oRCT2:');
      console.log(token);
      console.log('\nUse this token in Authorization header:');
      console.log(`Authorization: Bearer ${token}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}