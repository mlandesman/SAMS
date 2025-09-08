const { getDb } = require('../src/firebase');
const db = getDb();

/**
 * Recursively deletes a Firestore collection and all subcollections.
 * @param {FirebaseFirestore.CollectionReference} collectionRef 
 */
async function deleteCollectionRecursive(collectionRef) {
  const snapshot = await collectionRef.get();

  for (const doc of snapshot.docs) {
    if (doc.id === '_KEEP_') continue; // Skip special marker docs

    const subcollections = await doc.ref.listCollections();
    for (const subcol of subcollections) {
      console.log(`🔎 Found subcollection: ${subcol.path}`);
      await deleteCollectionRecursive(subcol);
    }

    console.log(`🗑️ Deleting document: ${doc.ref.path}`);
    await doc.ref.delete();
  }
}

/**
 * Fully resets Firestore collections for clients, auditLogs, and contacts.
 */
async function resetFirestore() {
  console.log('🧹 Starting full Firestore reset...');

  // Delete all client documents
  const clientSnapshot = await db.collection('clients').get();
  for (const doc of clientSnapshot.docs) {
    if (doc.id === '_KEEP_') continue;
    console.log(`🧹 Deleting client: ${doc.id}`);

    const subcollections = await doc.ref.listCollections();
    for (const subcol of subcollections) {
      console.log(`🔎 Found subcollection under client ${doc.id}: ${subcol.id}`);
      await deleteCollectionRecursive(subcol);
    }

    await doc.ref.delete();
  }

  // Delete all auditLogs
  const auditLogsRef = db.collection('auditLogs');
  console.log('🧹 Deleting auditLogs...');
  await deleteCollectionRecursive(auditLogsRef);

  // Delete all contacts
  const contactsRef = db.collection('contacts');
  console.log('🧹 Deleting contacts...');
  await deleteCollectionRecursive(contactsRef);

  console.log('✅ Firestore reset complete.');
}

resetFirestore().catch((error) => {
  console.error('❌ Error during reset:', error);
});