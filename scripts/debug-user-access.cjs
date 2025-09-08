const admin = require('firebase-admin');
const serviceAccount = require('../backend/serviceAccountKey.json');

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
  
  console.log('Checking user documents:');
  console.log('UID:', uid);
  console.log('Email doc ID:', emailDocId);
  
  // Check UID document
  const uidDoc = await db.collection('users').doc(uid).get();
  console.log('\n1. UID document exists:', uidDoc.exists);
  
  if (uidDoc.exists) {
    const data = uidDoc.data();
    console.log('   clientAccess:', Object.keys(data.clientAccess || {}));
  }
  
  // Check email document
  const emailDoc = await db.collection('users').doc(emailDocId).get();
  console.log('\n2. Email document exists:', emailDoc.exists);
  
  if (emailDoc.exists) {
    const data = emailDoc.data();
    console.log('   clientAccess:', Object.keys(data.clientAccess || {}));
  }
  
  // Check email query
  const emailQuery = await db.collection('users').where('email', '==', email).get();
  console.log('\n3. Email query results:', emailQuery.size, 'documents');
  
  if (!emailQuery.empty) {
    emailQuery.docs.forEach((doc, i) => {
      const data = doc.data();
      console.log('   Doc', i, 'ID:', doc.id);
      console.log('   clientAccess:', Object.keys(data.clientAccess || {}));
    });
  }
}

checkUser().then(() => process.exit(0)).catch(console.error);