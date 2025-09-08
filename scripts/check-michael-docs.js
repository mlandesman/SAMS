import admin from 'firebase-admin';
import { initializeApp, cert } from 'firebase-admin/app';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const env = args[0] || 'dev';

console.log(`\n🔍 Checking michael@landesman.com documents in ${env}...`);

// Load service account
const serviceAccountPath = env === 'prod' 
  ? path.join(__dirname, '../serviceAccountKey-prod.json')
  : path.join(__dirname, '../backend/serviceAccountKey.json');

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();

async function checkMichaelDocs() {
  try {
    // Check for UID-based documents (production UID)
    const prodUid = 'dxJd6xfM4NMYFOI350hiBV9jJes2';
    const uidDoc1 = await db.collection('users').doc(prodUid).get();
    
    console.log(`\nUID-based doc (${prodUid}):`);
    console.log(`Exists: ${uidDoc1.exists ? '✅' : '❌'}`);
    if (uidDoc1.exists) {
      const data = uidDoc1.data();
      console.log(`Email: ${data.email}`);
      console.log(`Global Role: ${data.globalRole}`);
      console.log(`Has UID field: ${data.uid ? '✅' : '❌'}`);
    }
    
    // Check for dev UID
    const devUid = 'fjXv8gX1RNYMEGJJTJLlXBo8z8f1';
    const uidDoc2 = await db.collection('users').doc(devUid).get();
    
    console.log(`\nUID-based doc (${devUid}):`);
    console.log(`Exists: ${uidDoc2.exists ? '✅' : '❌'}`);
    if (uidDoc2.exists) {
      const data = uidDoc2.data();
      console.log(`Email: ${data.email}`);
      console.log(`Global Role: ${data.globalRole}`);
      console.log(`Has UID field: ${data.uid ? '✅' : '❌'}`);
    }
    
    // Check for email-based documents
    console.log(`\nSearching for email-based documents...`);
    const emailQuery = await db.collection('users').where('email', '==', 'michael@landesman.com').get();
    
    console.log(`Found ${emailQuery.size} document(s) with email = michael@landesman.com`);
    emailQuery.forEach(doc => {
      const data = doc.data();
      console.log(`\nDoc ID: ${doc.id}`);
      console.log(`Email: ${data.email}`);
      console.log(`UID field: ${data.uid || 'missing'}`);
      console.log(`Global Role: ${data.globalRole}`);
      console.log(`Is UID-based: ${doc.id === data.uid ? '✅' : '❌'}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit();
  }
}

checkMichaelDocs();