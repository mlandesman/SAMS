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

console.log(`\n🔍 Checking ${env} user document structure...`);

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

async function checkUserStructure() {
  try {
    const usersSnapshot = await db.collection('users').limit(10).get();
    
    console.log(`\nFound ${usersSnapshot.size} users:`);
    console.log('================================');
    
    let uidBasedCount = 0;
    let emailBasedCount = 0;
    
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      const isUidBased = doc.id === data.uid;
      
      console.log(`\nDoc ID: ${doc.id}`);
      console.log(`UID: ${data.uid || 'missing'}`);
      console.log(`Email: ${data.email}`);
      console.log(`Structure: ${isUidBased ? 'UID-based ✅' : 'Email-based ❌'}`);
      
      if (isUidBased) uidBasedCount++;
      else emailBasedCount++;
    });
    
    console.log('\n================================');
    console.log(`Summary:`);
    console.log(`- UID-based documents: ${uidBasedCount}`);
    console.log(`- Email-based documents: ${emailBasedCount}`);
    console.log(`- Total: ${usersSnapshot.size}`);
    
    if (emailBasedCount > 0) {
      console.log('\n⚠️  Warning: Found email-based documents that need migration');
    } else {
      console.log('\n✅ All documents are UID-based');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit();
  }
}

checkUserStructure();