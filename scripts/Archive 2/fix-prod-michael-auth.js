import admin from 'firebase-admin';
import { initializeApp, cert } from 'firebase-admin/app';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load production service account
const serviceAccount = JSON.parse(
  readFileSync(path.join(__dirname, '../keys/sams-sandyland-prod-firebase-adminsdk-16sod-fcfea7b95f.json'), 'utf8')
);

initializeApp({
  credential: cert(serviceAccount),
  projectId: 'sams-sandyland-prod'
});

const db = admin.firestore();

// Email to base64URL encoding
function sanitizeEmailForDocId(email) {
  const base64 = Buffer.from(email.toLowerCase().trim()).toString('base64');
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function fixMichaelAuth() {
  try {
    const email = 'michael@landesman.com';
    const uid = 'dxJd6xfM4NMYFOI350hiBV9jJes2'; // The persistent UID
    const emailDocId = sanitizeEmailForDocId(email);
    
    console.log(`Creating user document for ${email}`);
    console.log(`Email Doc ID: ${emailDocId}`);
    console.log(`Firebase UID: ${uid}`);
    
    // Create the user document with email-based ID
    const userData = {
      id: emailDocId,
      uid: uid,
      email: email,
      name: 'Michael Landesman',
      globalRole: 'superAdmin',
      clientAccess: {
        MTC: { role: 'admin', permissions: ['all'] }
      },
      preferredClient: 'MTC',
      isActive: true,
      accountState: 'active',
      createdAt: new Date(),
      lastLogin: new Date(),
      creationMethod: 'production-fix',
      _migrated: {
        method: 'manual-production-fix',
        at: new Date(),
        reason: 'Fix persistent UID issue after email-based migration'
      }
    };
    
    await db.collection('users').doc(emailDocId).set(userData);
    console.log('✅ User document created successfully');
    
    // Verify the document exists
    const doc = await db.collection('users').doc(emailDocId).get();
    if (doc.exists) {
      console.log('✅ Verified: Document exists with data:', doc.data());
    } else {
      console.log('❌ Error: Document was not created');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

fixMichaelAuth();