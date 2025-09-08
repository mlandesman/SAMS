import admin from 'firebase-admin';
import { initializeApp, cert } from 'firebase-admin/app';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Creating michael@landesman.com user in production');

// Load production service account
const serviceAccountPath = path.join(__dirname, '../serviceAccountKey-prod.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();

async function createMichaelUser() {
  try {
    const email = 'michael@landesman.com';
    const uid = 'dxJd6xfM4NMYFOI350hiBV9jJes2'; // The persistent production UID
    
    console.log(`Creating user document for ${email}`);
    console.log(`Using UID: ${uid}`);
    
    // Check if document already exists
    const existingDoc = await db.collection('users').doc(uid).get();
    if (existingDoc.exists) {
      console.log('✅ User document already exists:', existingDoc.data());
      return;
    }
    
    // Create the user document with UID as document ID
    const userData = {
      id: uid,
      uid: uid,
      email: email,
      name: 'Michael Landesman',
      globalRole: 'superAdmin',
      clientAccess: {
        MTC: { 
          role: 'admin', 
          permissions: ['all'] 
        }
      },
      preferredClient: 'MTC',
      isActive: true,
      accountState: 'active',
      createdAt: new Date(),
      lastLogin: new Date(),
      creationMethod: 'production-manual-fix'
    };
    
    await db.collection('users').doc(uid).set(userData);
    console.log('✅ User document created successfully');
    
    // Verify the document exists
    const doc = await db.collection('users').doc(uid).get();
    if (doc.exists) {
      console.log('✅ Verified: Document exists with data:', doc.data());
    } else {
      console.log('❌ Error: Document was not created');
    }
    
    // Clean up any email-based document if it exists
    const emailBasedId = 'bWljaGFlbEBsYW5kZXNtYW4uY29t';
    const emailDoc = await db.collection('users').doc(emailBasedId).get();
    if (emailDoc.exists) {
      console.log('🧹 Cleaning up email-based document...');
      await db.collection('users').doc(emailBasedId).delete();
      console.log('✅ Email-based document deleted');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit();
  }
}

createMichaelUser();