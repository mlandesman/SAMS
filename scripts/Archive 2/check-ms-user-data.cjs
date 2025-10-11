const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkUser() {
  const uid = 'YHk0uE4Qha5XQrBss1Yw';
  const email = 'ms@landesman.com';
  const emailDocId = Buffer.from(email).toString('base64url');
  
  console.log('Checking user: ms@landesman.com');
  console.log('UID:', uid);
  console.log('Expected email doc ID:', emailDocId);
  console.log('');
  
  // Check UID-based document
  const uidDoc = await db.collection('users').doc(uid).get();
  if (uidDoc.exists) {
    const data = uidDoc.data();
    console.log('✅ Document found by UID');
    console.log('clientAccess:', JSON.stringify(data.clientAccess, null, 2));
  } else {
    console.log('❌ No document found by UID');
  }
  
  console.log('\n---\n');
  
  // Check email-based document
  const emailDoc = await db.collection('users').doc(emailDocId).get();
  if (emailDoc.exists) {
    const data = emailDoc.data();
    console.log('✅ Document found by email ID');
    console.log('clientAccess:', JSON.stringify(data.clientAccess, null, 2));
  } else {
    console.log('❌ No document found by email ID');
  }
}

checkUser()
  .then(() => process.exit(0))
  .catch(console.error);