const admin = require('firebase-admin');
const serviceAccount = require('../backend/serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function migrateUserBackToUID() {
  const uid = 'YHk0uE4Qha5XQrBss1Yw';
  const email = 'ms@landesman.com';
  const emailDocId = Buffer.from(email).toString('base64url');
  
  console.log('🔄 Migrating user back to UID-based document...');
  console.log('From:', emailDocId);
  console.log('To:', uid);
  
  // Get the email-based document
  const emailDoc = await db.collection('users').doc(emailDocId).get();
  
  if (!emailDoc.exists) {
    console.log('❌ Email-based document not found');
    return;
  }
  
  const userData = emailDoc.data();
  console.log('✅ Found user data with clientAccess for:', Object.keys(userData.clientAccess || {}));
  
  // Create UID-based document
  await db.collection('users').doc(uid).set(userData);
  console.log('✅ Created UID-based document');
  
  // Delete email-based document
  await db.collection('users').doc(emailDocId).delete();
  console.log('✅ Deleted email-based document');
  
  console.log('🎉 Migration complete!');
}

migrateUserBackToUID().then(() => process.exit(0)).catch(console.error);