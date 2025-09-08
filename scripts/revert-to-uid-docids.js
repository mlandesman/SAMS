import admin from 'firebase-admin';
import { initializeApp, cert } from 'firebase-admin/app';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const targetEnv = args[0] || 'dev';

console.log(`🔄 Reverting to UID-based document IDs in ${targetEnv} environment`);

// Load service account based on environment
let serviceAccountPath;
if (targetEnv === 'prod' || targetEnv === 'production') {
  serviceAccountPath = path.join(__dirname, '../serviceAccountKey-prod.json');
} else {
  serviceAccountPath = path.join(__dirname, '../backend/serviceAccountKey.json');
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();

async function revertToUidDocIds() {
  try {
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();
    
    console.log(`Found ${snapshot.size} user documents to check`);
    
    let revertedCount = 0;
    let skippedCount = 0;
    
    for (const doc of snapshot.docs) {
      const docId = doc.id;
      const userData = doc.data();
      
      // Check if this is an email-based doc ID (base64 encoded)
      // Email-based IDs are typically longer and contain only base64 chars
      const isEmailBasedId = /^[A-Za-z0-9\-_]{20,}$/.test(docId) && !docId.includes('@');
      
      if (isEmailBasedId && userData.uid) {
        console.log(`\n🔄 Reverting user: ${userData.email}`);
        console.log(`  Current Doc ID: ${docId}`);
        console.log(`  Target UID: ${userData.uid}`);
        
        // Check if UID document already exists
        const uidDoc = await usersRef.doc(userData.uid).get();
        if (uidDoc.exists) {
          console.log(`  ⚠️  UID document already exists, skipping`);
          skippedCount++;
          continue;
        }
        
        // Create new document with UID as ID
        const revertedData = {
          ...userData,
          id: userData.uid, // Use UID as the document ID
          _reverted: {
            from: docId,
            at: new Date(),
            method: 'revert-to-uid-script'
          }
        };
        
        // Remove migration metadata if present
        if (revertedData._migrated) {
          delete revertedData._migrated;
        }
        
        // Create the UID-based document
        await usersRef.doc(userData.uid).set(revertedData);
        console.log(`  ✅ Created UID-based document`);
        
        // Delete the email-based document
        await usersRef.doc(docId).delete();
        console.log(`  ✅ Deleted email-based document`);
        
        revertedCount++;
      } else if (!isEmailBasedId) {
        console.log(`\n⏭️  Skipping ${docId} - already using UID as doc ID`);
        skippedCount++;
      } else {
        console.log(`\n⚠️  Skipping ${docId} - no UID field found`);
        skippedCount++;
      }
    }
    
    console.log('\n✅ Reversion complete!');
    console.log(`  Reverted: ${revertedCount} users`);
    console.log(`  Skipped: ${skippedCount} users`);
    
  } catch (error) {
    console.error('❌ Error during reversion:', error);
  } finally {
    process.exit();
  }
}

// Run the reversion
revertToUidDocIds();