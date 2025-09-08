/**
 * Enhanced Ghost Data Cleanup System
 * 
 * Fixes the recursive deletion issues by properly handling subcollections
 * Uses a depth-first approach to ensure all nested data is removed
 * 
 * Task ID: MTC-MIGRATION-001 - Phase 2 Ghost Cleanup
 * Date: June 27, 2025
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';

const CLIENT_ID = 'MTC';

/**
 * Improved recursive subcollection deletion
 * Uses depth-first traversal to ensure all nested collections are removed
 */
async function deleteSubcollectionsRecursively(db, docRef, path = '') {
  let totalDeleted = 0;
  
  try {
    console.log(`🔍 Scanning subcollections at: ${path}`);
    
    // Get all subcollections of this document
    const subcollections = await docRef.listCollections();
    
    for (const subcollection of subcollections) {
      const subPath = path ? `${path}/${subcollection.id}` : subcollection.id;
      console.log(`📁 Found subcollection: ${subPath}`);
      
      // Get all documents in this subcollection
      const snapshot = await subcollection.get();
      
      for (const doc of snapshot.docs) {
        const docPath = `${subPath}/${doc.id}`;
        console.log(`📄 Processing document: ${docPath}`);
        
        // Recursively delete subcollections of this document FIRST
        const subDeleted = await deleteSubcollectionsRecursively(db, doc.ref, docPath);
        totalDeleted += subDeleted;
        
        // Then delete the document itself
        await doc.ref.delete();
        totalDeleted++;
        console.log(`✅ Deleted document: ${docPath}`);
      }
      
      console.log(`✅ Completed subcollection: ${subPath} (${snapshot.size} documents)`);
    }
    
    return totalDeleted;
    
  } catch (error) {
    console.error(`❌ Error processing subcollections at ${path}:`, error);
    return totalDeleted;
  }
}

/**
 * Scan and report all remaining ghost data
 */
async function scanForGhostData(db) {
  console.log('🔍 Scanning for ghost data...\n');
  
  const ghostData = {
    clientExists: false,
    collections: new Map(),
    totalDocuments: 0
  };
  
  try {
    // Check if client document exists
    const clientRef = db.collection('clients').doc(CLIENT_ID);
    const clientDoc = await clientRef.get();
    
    if (clientDoc.exists) {
      console.log('👻 GHOST: Client document still exists');
      ghostData.clientExists = true;
    }
    
    // Check for ghost collections
    const collections = await clientRef.listCollections();
    
    for (const collection of collections) {
      console.log(`👻 GHOST COLLECTION: ${collection.id}`);
      
      const snapshot = await collection.get();
      const documents = [];
      
      for (const doc of snapshot.docs) {
        const subcollections = await doc.ref.listCollections();
        documents.push({
          id: doc.id,
          data: doc.data(),
          subcollections: subcollections.map(sub => sub.id)
        });
      }
      
      ghostData.collections.set(collection.id, {
        documentCount: documents.length,
        documents: documents
      });
      
      ghostData.totalDocuments += documents.length;
      
      console.log(`   📄 ${documents.length} documents found`);
      documents.forEach(doc => {
        console.log(`      - ${doc.id}${doc.subcollections.length > 0 ? ` (subcollections: ${doc.subcollections.join(', ')})` : ''}`);
      });
    }
    
    return ghostData;
    
  } catch (error) {
    console.error('❌ Error scanning for ghost data:', error);
    return ghostData;
  }
}

/**
 * Enhanced client deletion with proper subcollection handling
 */
async function enhancedClientDeletion(db) {
  console.log('🗑️ Starting enhanced client deletion...\n');
  
  let totalDeleted = 0;
  const clientRef = db.collection('clients').doc(CLIENT_ID);
  
  try {
    // Get all top-level collections
    const collections = await clientRef.listCollections();
    
    for (const collection of collections) {
      console.log(`\n🗑️ Processing collection: ${collection.id}`);
      
      const snapshot = await collection.get();
      
      for (const doc of snapshot.docs) {
        console.log(`\n📄 Processing document: ${collection.id}/${doc.id}`);
        
        // Delete all subcollections first (depth-first)
        const subDeleted = await deleteSubcollectionsRecursively(
          db, 
          doc.ref, 
          `${collection.id}/${doc.id}`
        );
        totalDeleted += subDeleted;
        
        // Then delete the document itself
        await doc.ref.delete();
        totalDeleted++;
        console.log(`✅ Deleted document: ${collection.id}/${doc.id}`);
      }
      
      console.log(`✅ Completed collection: ${collection.id} (${snapshot.size} documents)`);
    }
    
    // Finally, delete the client document
    const clientDoc = await clientRef.get();
    if (clientDoc.exists) {
      await clientRef.delete();
      totalDeleted++;
      console.log('✅ Deleted client document');
    }
    
    return totalDeleted;
    
  } catch (error) {
    console.error('❌ Enhanced deletion failed:', error);
    throw error;
  }
}

/**
 * Verify complete cleanup
 */
async function verifyCompleteCleanup(db) {
  console.log('\n🔍 Verifying complete cleanup...');
  
  try {
    const ghostData = await scanForGhostData(db);
    
    const hasGhosts = ghostData.clientExists || ghostData.collections.size > 0;
    
    if (hasGhosts) {
      console.log('\n❌ CLEANUP INCOMPLETE:');
      if (ghostData.clientExists) {
        console.log('   - Client document still exists');
      }
      if (ghostData.collections.size > 0) {
        console.log(`   - ${ghostData.collections.size} collections still exist`);
        console.log(`   - ${ghostData.totalDocuments} ghost documents found`);
      }
      return false;
    } else {
      console.log('\n✅ CLEANUP COMPLETE - No ghost data found');
      return true;
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    return false;
  }
}

/**
 * Main cleanup function
 */
async function performEnhancedCleanup() {
  console.log('🚀 Starting Enhanced Ghost Data Cleanup...\n');
  
  try {
    await initializeFirebase();
    const db = await getDb();
    
    // Step 1: Scan for existing ghost data
    console.log('=== STEP 1: SCANNING FOR GHOST DATA ===');
    const initialGhosts = await scanForGhostData(db);
    
    if (initialGhosts.totalDocuments === 0 && !initialGhosts.clientExists) {
      console.log('\n✅ No ghost data found - cleanup not needed');
      return;
    }
    
    console.log(`\n📊 Found ${initialGhosts.totalDocuments} ghost documents in ${initialGhosts.collections.size} collections`);
    
    // Step 2: Enhanced deletion
    console.log('\n=== STEP 2: ENHANCED DELETION ===');
    const deletedCount = await enhancedClientDeletion(db);
    
    // Step 3: Verification
    console.log('\n=== STEP 3: VERIFICATION ===');
    const cleanupComplete = await verifyCompleteCleanup(db);
    
    // Step 4: Final report
    console.log('\n' + '='.repeat(60));
    console.log('📋 ENHANCED CLEANUP SUMMARY');
    console.log('='.repeat(60));
    console.log(`🎯 Client: ${CLIENT_ID}`);
    console.log(`🗑️ Documents deleted: ${deletedCount}`);
    console.log(`✅ Cleanup complete: ${cleanupComplete}`);
    
    if (cleanupComplete) {
      console.log('\n✅ SUCCESS: All ghost data eliminated!');
      console.log('🚀 Ready for fresh client onboarding');
    } else {
      console.log('\n❌ FAILURE: Ghost data still remains');
      console.log('🔧 Manual intervention may be required');
    }
    
    console.log('='.repeat(60));
    
    return {
      success: cleanupComplete,
      deletedCount: deletedCount,
      initialGhosts: initialGhosts.totalDocuments
    };
    
  } catch (error) {
    console.error('\n💥 Enhanced cleanup failed:', error);
    throw error;
  }
}

// Execute
performEnhancedCleanup()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });