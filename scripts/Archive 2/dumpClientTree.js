const { getDb } = require('../src/firebase');
const db = getDb();

const clientId = process.argv[2] || 'MTC'; // Get clientId from command-line argument or default to 'MTC'

/**
 * Recursively logs the collection, documents, and subcollection structure starting at a document reference.
 * @param {FirebaseFirestore.DocumentReference} docRef 
 * @param {string} indent 
 */
async function logSubcollections(docRef, indent) {
  const docSnap = await docRef.get();
  const data = docSnap.data();
  const label = (data && data.name) ? data.name : docRef.id;
  console.log(`${indent}- ${label}`);
  const subcollections = await docRef.listCollections();
  for (const subcol of subcollections) {
    console.log(`${indent}  - ${subcol.id}/`);
    const snapshot = await subcol.get();
    for (const doc of snapshot.docs) {
      if (doc.id === '_KEEP_') continue;
      await logSubcollections(doc.ref, indent + '    ');
    }
  }
}

/**
 * Recursively logs the collection, documents, and subcollection structure starting at a collection reference.
 * @param {FirebaseFirestore.CollectionReference} collectionRef 
 * @param {string} indent 
 */
async function logCollection(collectionRef, indent) {
  console.log(`${indent}- ${collectionRef.id}/`);
  const snapshot = await collectionRef.get();
  for (const doc of snapshot.docs) {
    if (doc.id === '_KEEP_') continue;
    await logSubcollections(doc.ref, indent + '  ');
  }
}

async function main() {
  console.log(`🔍 Structure for clientId: ${clientId}`);

  const clientDocRef = db.collection('clients').doc(clientId);
  const clientCollections = await clientDocRef.listCollections();

  for (const col of clientCollections) {
    console.log(`- ${col.id}/`);
    const snapshot = await col.get();
    for (const doc of snapshot.docs) {
      if (doc.id === '_KEEP_') continue;
      await logSubcollections(doc.ref, '  ');
    }
  }
}

main().catch(error => {
  console.error('❌ Error during structure dump:', error);
});