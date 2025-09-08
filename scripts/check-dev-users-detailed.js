import admin from 'firebase-admin';
import { initializeApp, cert } from 'firebase-admin/app';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin (dev environment)
const serviceAccountPath = path.join(__dirname, '../backend/serviceAccountKey.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();
const auth = admin.auth();

async function checkUsers() {
  console.log('=== SAMS Dev Environment Users Check ===\n');
  
  try {
    // Check Firestore users
    console.log('FIRESTORE USERS:');
    const usersSnapshot = await db.collection('users').get();
    
    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      console.log(`\nUser Doc ID: ${doc.id}`);
      console.log('User Data:', JSON.stringify(userData, null, 2));
      
      // Try to find corresponding Firebase Auth user
      try {
        if (userData.email) {
          const authUser = await auth.getUserByEmail(userData.email);
          console.log(`Firebase Auth User: ${authUser.uid} (${authUser.email})`);
        } else {
          console.log('No email field in user document');
        }
      } catch (authError) {
        console.log('No corresponding Firebase Auth user found');
      }
    }
    
    // Check all Firebase Auth users
    console.log('\n\nFIREBASE AUTH USERS:');
    const listUsersResult = await auth.listUsers(1000);
    
    listUsersResult.users.forEach(userRecord => {
      console.log(`\nAuth UID: ${userRecord.uid}`);
      console.log(`Email: ${userRecord.email}`);
      console.log(`Display Name: ${userRecord.displayName || 'Not set'}`);
      console.log(`Created: ${userRecord.metadata.creationTime}`);
      console.log(`Last Sign In: ${userRecord.metadata.lastSignInTime}`);
    });
    
    console.log(`\nTotal Firestore users: ${usersSnapshot.size}`);
    console.log(`Total Firebase Auth users: ${listUsersResult.users.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkUsers();