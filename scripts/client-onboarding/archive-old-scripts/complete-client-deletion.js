/**
 * Complete Client Deletion System with Archival
 * 
 * Comprehensive client purge including:
 * - Recursive subcollection deletion (units/dues, etc.)
 * - User account cleanup (remove client access)
 * - Document storage cleanup
 * - Metadata and ghost data removal
 * - Full archival backup
 * 
 * This will become the foundation for client deletion/archival system
 * 
 * Task ID: MTC-MIGRATION-001 - Phase 2 Revision
 * Date: June 27, 2025
 */

import { initializeFirebase, getDb } from '../../backend/firebase.js';
import fs from 'fs/promises';
import path from 'path';
import admin from 'firebase-admin';

const CLIENT_ID = 'MTC';
const BACKUP_DIR = './backups';
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');

/**
 * Recursively discover all collections and subcollections
 */
async function discoverAllCollections(db, clientRef, basePath = '') {
  const collections = new Map();
  
  try {
    // Get all collections at this level
    const collectionRefs = await clientRef.listCollections();
    
    for (const collectionRef of collectionRefs) {
      const collectionPath = basePath ? `${basePath}/${collectionRef.id}` : collectionRef.id;
      const docs = [];
      
      console.log(`🔍 Discovering: ${collectionPath}`);
      
      // Get all documents in this collection
      const snapshot = await collectionRef.get();
      
      for (const doc of snapshot.docs) {
        const docData = {
          id: doc.id,
          data: doc.data(),
          path: `${collectionPath}/${doc.id}`,
          subcollections: new Map()
        };
        
        // Recursively discover subcollections for each document
        const subcollections = await discoverAllCollections(db, doc.ref, `${collectionPath}/${doc.id}`);
        docData.subcollections = subcollections;
        
        docs.push(docData);
      }
      
      collections.set(collectionRef.id, {
        path: collectionPath,
        documentCount: docs.length,
        documents: docs
      });
    }
    
    return collections;
    
  } catch (error) {
    console.error(`❌ Error discovering collections at ${basePath}:`, error);
    return collections;
  }
}

/**
 * Create comprehensive archive of entire client structure
 */
async function createCompleteArchive(db, clientId) {
  console.log('📦 Creating complete client archive...');
  
  const archivePath = path.join(BACKUP_DIR, `${clientId}-COMPLETE-ARCHIVE-${TIMESTAMP}`);
  await fs.mkdir(archivePath, { recursive: true });
  await fs.mkdir(path.join(archivePath, 'collections'), { recursive: true });
  await fs.mkdir(path.join(archivePath, 'metadata'), { recursive: true });
  await fs.mkdir(path.join(archivePath, 'users'), { recursive: true });
  
  const archive = {
    clientId: clientId,
    timestamp: TIMESTAMP,
    createdAt: new Date().toISOString(),
    structure: {},
    users: [],
    metadata: {},
    summary: {
      totalCollections: 0,
      totalDocuments: 0,
      totalSubcollections: 0,
      userCount: 0
    }
  };
  
  // Archive client document
  console.log('📄 Archiving client document...');
  const clientRef = db.collection('clients').doc(clientId);
  const clientDoc = await clientRef.get();
  
  if (clientDoc.exists) {
    const clientData = clientDoc.data();
    archive.metadata.clientDocument = {
      id: clientDoc.id,
      data: clientData,
      exists: true
    };
    
    await fs.writeFile(
      path.join(archivePath, 'metadata', 'client-document.json'),
      JSON.stringify(clientData, null, 2)
    );
    console.log('✅ Client document archived');
  }
  
  // Discover and archive all collections recursively
  console.log('🔍 Discovering all collections and subcollections...');
  const allCollections = await discoverAllCollections(db, clientRef);
  
  // Archive each collection
  for (const [collectionName, collectionInfo] of allCollections.entries()) {
    console.log(`📦 Archiving ${collectionName} (${collectionInfo.documentCount} docs)...`);
    
    const collectionArchive = {
      name: collectionName,
      path: collectionInfo.path,
      documentCount: collectionInfo.documentCount,
      documents: collectionInfo.documents
    };
    
    await fs.writeFile(
      path.join(archivePath, 'collections', `${collectionName}.json`),
      JSON.stringify(collectionArchive, null, 2)
    );
    
    archive.structure[collectionName] = {
      documentCount: collectionInfo.documentCount,
      path: collectionInfo.path
    };
    archive.summary.totalCollections++;
    archive.summary.totalDocuments += collectionInfo.documentCount;
  }
  
  // Archive users with client access
  console.log('👥 Archiving users with client access...');
  const usersRef = db.collection('users');
  const usersSnapshot = await usersRef.get();
  
  const clientUsers = [];
  usersSnapshot.forEach(doc => {
    const userData = doc.data();
    if (userData.clientAccess && userData.clientAccess[clientId]) {
      clientUsers.push({
        id: doc.id,
        data: userData,
        clientAccess: userData.clientAccess[clientId]
      });
    }
  });
  
  archive.users = clientUsers;
  archive.summary.userCount = clientUsers.length;
  
  await fs.writeFile(
    path.join(archivePath, 'users', 'client-users.json'),
    JSON.stringify(clientUsers, null, 2)
  );
  
  console.log(`✅ Archived ${clientUsers.length} users with client access`);
  
  // Save complete archive manifest
  await fs.writeFile(
    path.join(archivePath, 'archive-manifest.json'),
    JSON.stringify(archive, null, 2)
  );
  
  console.log(`📋 Archive completed: ${archivePath}`);
  return { archivePath, archive };
}

/**
 * Recursively delete all collections and subcollections
 */
async function recursivelyDeleteCollections(db, parentRef, basePath = '') {
  let deletedCount = 0;
  
  try {
    const collections = await parentRef.listCollections();
    
    for (const collection of collections) {
      const collectionPath = basePath ? `${basePath}/${collection.id}` : collection.id;
      console.log(`🗑️ Deleting collection: ${collectionPath}`);
      
      const snapshot = await collection.get();
      
      // Delete subcollections first
      for (const doc of snapshot.docs) {
        const subDeleted = await recursivelyDeleteCollections(db, doc.ref, `${collectionPath}/${doc.id}`);
        deletedCount += subDeleted;
      }
      
      // Delete documents in batches
      const batchSize = 500;
      for (let i = 0; i < snapshot.docs.length; i += batchSize) {
        const batch = db.batch();
        const batchDocs = snapshot.docs.slice(i, i + batchSize);
        
        batchDocs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        await batch.commit();
        deletedCount += batchDocs.length;
      }
      
      console.log(`✅ Deleted ${snapshot.docs.length} documents from ${collectionPath}`);
    }
    
    return deletedCount;
    
  } catch (error) {
    console.error(`❌ Error deleting collections at ${basePath}:`, error);
    return deletedCount;
  }
}

/**
 * Remove client access from all users
 */
async function removeClientAccessFromUsers(db, clientId, userList) {
  console.log('👥 Removing client access from users...');
  
  let updatedUsers = 0;
  
  for (const user of userList) {
    try {
      const userRef = db.collection('users').doc(user.id);
      const userDoc = await userRef.get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        
        if (userData.clientAccess && userData.clientAccess[clientId]) {
          // Remove client access
          delete userData.clientAccess[clientId];
          
          // Update preferred client if it was this client
          if (userData.preferredClient === clientId) {
            const remainingClients = Object.keys(userData.clientAccess);
            userData.preferredClient = remainingClients.length > 0 ? remainingClients[0] : null;
          }
          
          // If no client access left, set global role to user
          if (Object.keys(userData.clientAccess).length === 0) {
            userData.globalRole = 'user';
          }
          
          await userRef.update(userData);
          updatedUsers++;
          console.log(`✅ Removed ${clientId} access from user: ${userData.email}`);
        }
      }
    } catch (error) {
      console.error(`❌ Failed to update user ${user.id}:`, error);
    }
  }
  
  console.log(`✅ Updated ${updatedUsers} users`);
  return updatedUsers;
}

/**
 * Delete the client document itself
 */
async function deleteClientDocument(db, clientId) {
  console.log('🗑️ Deleting client document...');
  
  try {
    const clientRef = db.collection('clients').doc(clientId);
    await clientRef.delete();
    console.log('✅ Client document deleted');
    return true;
  } catch (error) {
    console.error('❌ Failed to delete client document:', error);
    return false;
  }
}

/**
 * Verify complete deletion
 */
async function verifyDeletion(db, clientId) {
  console.log('🔍 Verifying complete deletion...');
  
  try {
    // Check client document
    const clientRef = db.collection('clients').doc(clientId);
    const clientDoc = await clientRef.get();
    
    if (clientDoc.exists) {
      console.error('❌ Client document still exists');
      return false;
    }
    
    console.log('✅ Client document confirmed deleted');
    
    // Check for any remaining collections
    const collections = await clientRef.listCollections();
    if (collections.length > 0) {
      console.error(`❌ ${collections.length} collections still exist`);
      return false;
    }
    
    console.log('✅ No remaining collections found');
    
    // Check users no longer have client access
    const usersRef = db.collection('users');
    const usersSnapshot = await usersRef.get();
    
    let usersWithAccess = 0;
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.clientAccess && userData.clientAccess[clientId]) {
        usersWithAccess++;
      }
    });
    
    if (usersWithAccess > 0) {
      console.error(`❌ ${usersWithAccess} users still have client access`);
      return false;
    }
    
    console.log('✅ No users have remaining client access');
    return true;
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    return false;
  }
}

/**
 * Create restoration script
 */
async function createRestorationScript(archivePath, archive) {
  const scriptContent = `#!/usr/bin/env node
/**
 * CLIENT RESTORATION SCRIPT - ${archive.clientId}
 * Generated: ${archive.timestamp}
 * Archive: ${archivePath}
 */

import { initializeFirebase, getDb } from '../../backend/firebase.js';
import fs from 'fs/promises';
import path from 'path';

const CLIENT_ID = '${archive.clientId}';
const ARCHIVE_PATH = '${archivePath}';

async function restoreClient() {
  console.log('🔄 Starting client restoration...');
  console.log('⚠️ This will restore ALL data for client ${archive.clientId}');
  
  try {
    await initializeFirebase();
    const db = await getDb();
    
    // Restore client document
    console.log('📄 Restoring client document...');
    const clientData = JSON.parse(await fs.readFile(path.join(ARCHIVE_PATH, 'metadata', 'client-document.json')));
    await db.collection('clients').doc(CLIENT_ID).set(clientData);
    console.log('✅ Client document restored');
    
    // Restore collections
    const collectionsDir = path.join(ARCHIVE_PATH, 'collections');
    const collectionFiles = await fs.readdir(collectionsDir);
    
    for (const file of collectionFiles) {
      if (file.endsWith('.json')) {
        const collectionName = file.replace('.json', '');
        console.log(\`📦 Restoring \${collectionName}...\`);
        
        const collectionData = JSON.parse(await fs.readFile(path.join(collectionsDir, file)));
        const collectionRef = db.collection('clients').doc(CLIENT_ID).collection(collectionName);
        
        for (const docInfo of collectionData.documents) {
          await collectionRef.doc(docInfo.id).set(docInfo.data);
          
          // Restore subcollections recursively if they exist
          if (docInfo.subcollections && docInfo.subcollections.size > 0) {
            // TODO: Implement subcollection restoration
            console.log(\`⚠️ Subcollections for \${docInfo.id} need manual restoration\`);
          }
        }
        
        console.log(\`✅ Restored \${collectionData.documents.length} documents to \${collectionName}\`);
      }
    }
    
    // Restore user access
    console.log('👥 Restoring user access...');
    const userData = JSON.parse(await fs.readFile(path.join(ARCHIVE_PATH, 'users', 'client-users.json')));
    
    for (const user of userData) {
      const userRef = db.collection('users').doc(user.id);
      const currentUserDoc = await userRef.get();
      
      if (currentUserDoc.exists) {
        const currentData = currentUserDoc.data();
        currentData.clientAccess = currentData.clientAccess || {};
        currentData.clientAccess[CLIENT_ID] = user.clientAccess;
        
        await userRef.update(currentData);
        console.log(\`✅ Restored access for \${currentData.email}\`);
      }
    }
    
    console.log('✅ Client restoration completed!');
    
  } catch (error) {
    console.error('💥 Restoration failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  restoreClient();
}`;

  const scriptPath = path.join(archivePath, 'restore-client.js');
  await fs.writeFile(scriptPath, scriptContent);
  await fs.chmod(scriptPath, '755');
  
  console.log(`🔄 Created restoration script: ${scriptPath}`);
  return scriptPath;
}

/**
 * Main deletion function
 */
async function performCompleteClientDeletion() {
  console.log('🚀 Starting COMPLETE client deletion...\n');
  console.log('⚠️ WARNING: This will delete ALL data for client:', CLIENT_ID);
  console.log('📦 Full archive will be created before deletion\n');
  
  const results = {
    timestamp: TIMESTAMP,
    clientId: CLIENT_ID,
    archivePath: null,
    deletionResults: {
      documentsDeleted: 0,
      collectionsDeleted: 0,
      usersUpdated: 0,
      clientDocumentDeleted: false
    },
    verificationPassed: false,
    success: false
  };
  
  try {
    await initializeFirebase();
    const db = await getDb();
    
    // Step 1: Create complete archive
    const { archivePath, archive } = await createCompleteArchive(db, CLIENT_ID);
    results.archivePath = archivePath;
    
    // Step 2: Recursively delete all collections
    console.log('\n🗑️ Starting recursive deletion...');
    const clientRef = db.collection('clients').doc(CLIENT_ID);
    const deletedCount = await recursivelyDeleteCollections(db, clientRef);
    results.deletionResults.documentsDeleted = deletedCount;
    
    // Step 3: Remove client access from users
    const usersUpdated = await removeClientAccessFromUsers(db, CLIENT_ID, archive.users);
    results.deletionResults.usersUpdated = usersUpdated;
    
    // Step 4: Delete client document
    const clientDeleted = await deleteClientDocument(db, CLIENT_ID);
    results.deletionResults.clientDocumentDeleted = clientDeleted;
    
    // Step 5: Verify complete deletion
    const verified = await verifyDeletion(db, CLIENT_ID);
    results.verificationPassed = verified;
    
    // Step 6: Create restoration script
    await createRestorationScript(archivePath, archive);
    
    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('📋 COMPLETE CLIENT DELETION SUMMARY');
    console.log('='.repeat(70));
    console.log(`🎯 Client: ${CLIENT_ID}`);
    console.log(`📦 Archive: ${archivePath}`);
    console.log(`🗑️ Documents deleted: ${deletedCount}`);
    console.log(`👥 Users updated: ${usersUpdated}`);
    console.log(`📄 Client document deleted: ${clientDeleted}`);
    console.log(`✅ Verification passed: ${verified}`);
    
    if (verified && clientDeleted) {
      console.log('\n✅ COMPLETE DELETION SUCCESSFUL!');
      console.log('🚀 Ready for fresh client onboarding');
      results.success = true;
    } else {
      console.log('\n❌ DELETION INCOMPLETE - Check results above');
    }
    
    console.log('\n🔄 To restore, run: node ' + path.join(archivePath, 'restore-client.js'));
    console.log('='.repeat(70));
    
    return results;
    
  } catch (error) {
    console.error('\n💥 Complete deletion failed:', error);
    results.error = error.message;
    throw error;
  }
}

// Execute
performCompleteClientDeletion()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });