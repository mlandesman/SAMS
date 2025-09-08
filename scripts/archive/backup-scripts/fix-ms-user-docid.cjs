const admin = require('firebase-admin');
const serviceAccount = require('../backend/serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function fixMsUser() {
  const uid = 'YHk0uE4Qha5XQrBss1Yw';
  const email = 'ms@landesman.com';
  const emailDocId = Buffer.from(email).toString('base64url');
  
  console.log('🔍 Checking ms@landesman.com user document...');
  console.log('UID:', uid);
  console.log('Email doc ID:', emailDocId);
  console.log('');
  
  // Check both documents
  const uidDoc = await db.collection('users').doc(uid).get();
  const emailDoc = await db.collection('users').doc(emailDocId).get();
  
  if (uidDoc.exists && !emailDoc.exists) {
    console.log('✅ Found document by UID, missing by email ID');
    console.log('🔄 Migrating document...');
    
    const userData = uidDoc.data();
    
    // Create new document with email ID
    await db.collection('users').doc(emailDocId).set(userData);
    console.log('✅ Created document with email ID');
    
    // Delete old UID document
    await db.collection('users').doc(uid).delete();
    console.log('✅ Deleted old UID document');
    
    console.log('\n✨ Migration complete!');
  } else if (emailDoc.exists) {
    console.log('✅ Document already exists with email ID');
    if (uidDoc.exists) {
      console.log('⚠️  Old UID document also exists - deleting it');
      await db.collection('users').doc(uid).delete();
      console.log('✅ Deleted duplicate UID document');
    }
  } else {
    console.log('❌ No document found for this user!');
  }
}

fixMsUser()
  .then(() => process.exit(0))
  .catch(console.error);