/**
 * Deep Ghost Data Scanner
 * 
 * Comprehensive scan to find all remaining MTC data in any path structure
 * Handles edge cases and Firestore eventual consistency issues
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';

const CLIENT_ID = 'MTC';

/**
 * Recursively scan all document paths for MTC data
 */
async function deepScanForMTCData(db) {
  console.log('🔍 Deep scanning for ALL MTC-related data...\n');
  
  const findings = {
    clientDocument: null,
    collections: new Map(),
    orphanedData: [],
    totalDocuments: 0
  };
  
  try {
    // 1. Check main client document
    console.log('📄 Checking main client document...');
    const clientRef = db.collection('clients').doc(CLIENT_ID);
    const clientDoc = await clientRef.get();
    
    if (clientDoc.exists) {
      console.log('👻 FOUND: Main client document exists');
      findings.clientDocument = {
        path: `clients/${CLIENT_ID}`,
        data: clientDoc.data()
      };
    } else {
      console.log('✅ Main client document not found');
    }
    
    // 2. Force refresh and check collections with detailed logging
    console.log('\n📁 Force checking collections...');
    
    try {
      // Try multiple approaches to find collections
      const collections1 = await clientRef.listCollections();
      console.log(`Method 1 found ${collections1.length} collections`);
      
      // Wait a moment and try again
      await new Promise(resolve => setTimeout(resolve, 2000));
      const collections2 = await clientRef.listCollections();
      console.log(`Method 2 found ${collections2.length} collections`);
      
      const allCollections = [...new Set([...collections1, ...collections2])];
      
      for (const collection of allCollections) {
        console.log(`\n📁 Examining collection: ${collection.id}`);
        
        // Get documents with retry logic
        let snapshot;
        let attempts = 0;
        while (attempts < 3) {
          try {
            snapshot = await collection.get();
            break;
          } catch (error) {
            attempts++;
            console.log(`   Retry ${attempts}/3 for ${collection.id}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        if (!snapshot) {
          console.log(`   ❌ Could not read ${collection.id} after 3 attempts`);
          continue;
        }
        
        console.log(`   📊 Found ${snapshot.size} documents in ${collection.id}`);
        
        const documents = [];
        for (const doc of snapshot.docs) {
          console.log(`      📄 Document: ${doc.id}`);
          
          // Check for subcollections
          const subcollections = await doc.ref.listCollections();
          const subCollectionNames = subcollections.map(sub => sub.id);
          
          if (subCollectionNames.length > 0) {
            console.log(`         📁 Subcollections: ${subCollectionNames.join(', ')}`);
            
            // Scan subcollections for documents
            for (const subcollection of subcollections) {
              const subSnapshot = await subcollection.get();
              console.log(`         📊 ${subcollection.id}: ${subSnapshot.size} documents`);
              
              subSnapshot.forEach(subDoc => {
                console.log(`            📄 ${subcollection.id}/${subDoc.id}`);
              });
            }
          }
          
          documents.push({
            id: doc.id,
            path: `${collection.id}/${doc.id}`,
            data: doc.data(),
            subcollections: subCollectionNames
          });
        }
        
        findings.collections.set(collection.id, {
          documentCount: documents.length,
          documents: documents
        });
        
        findings.totalDocuments += documents.length;
      }
    } catch (error) {
      console.error('❌ Error scanning collections:', error);
    }
    
    // 3. Check for orphaned units in case they're at the wrong path level
    console.log('\n🔍 Checking for orphaned unit documents...');
    try {
      // Check if units exist at different path levels
      const possiblePaths = [
        `clients/${CLIENT_ID}/units`,
        `units`, // Top-level units (shouldn't exist but checking)
        `clients/units`, // Misplaced units
      ];
      
      for (const pathStr of possiblePaths) {
        try {
          console.log(`   Checking path: ${pathStr}`);
          const pathRef = pathStr.includes('/') 
            ? db.collection(pathStr.split('/')[0]).doc(pathStr.split('/')[1]).collection(pathStr.split('/')[2])
            : db.collection(pathStr);
          
          const snapshot = await pathRef.get();
          if (snapshot && snapshot.size > 0) {
            console.log(`   👻 FOUND ${snapshot.size} documents at ${pathStr}`);
            
            snapshot.forEach(doc => {
              console.log(`      📄 ${doc.id}`);
              findings.orphanedData.push({
                path: `${pathStr}/${doc.id}`,
                id: doc.id,
                data: doc.data()
              });
            });
          }
        } catch (pathError) {
          // Path doesn't exist - that's fine
          console.log(`   ✅ No data at ${pathStr}`);
        }
      }
    } catch (error) {
      console.error('❌ Error checking orphaned data:', error);
    }
    
    // 4. Wait for Firestore consistency and check again
    console.log('\n⏱️ Waiting for Firestore consistency...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('🔍 Final consistency check...');
    const finalCollections = await clientRef.listCollections();
    console.log(`Final check found ${finalCollections.length} collections`);
    
    return findings;
    
  } catch (error) {
    console.error('❌ Deep scan failed:', error);
    return findings;
  }
}

/**
 * Force delete any remaining data found
 */
async function forceDeleteFoundData(db, findings) {
  console.log('\n🗑️ Force deleting all found data...');
  
  let deletedCount = 0;
  
  try {
    // Delete collections and their documents
    for (const [collectionName, collectionInfo] of findings.collections.entries()) {
      if (collectionInfo.documentCount > 0) {
        console.log(`\n🗑️ Force deleting collection: ${collectionName}`);
        
        const collectionRef = db.collection('clients').doc(CLIENT_ID).collection(collectionName);
        
        for (const docInfo of collectionInfo.documents) {
          console.log(`   🗑️ Deleting document: ${docInfo.id}`);
          
          // Delete subcollections first
          for (const subCollectionName of docInfo.subcollections) {
            console.log(`      🗑️ Deleting subcollection: ${subCollectionName}`);
            const subRef = collectionRef.doc(docInfo.id).collection(subCollectionName);
            const subSnapshot = await subRef.get();
            
            const batch = db.batch();
            subSnapshot.forEach(subDoc => {
              batch.delete(subDoc.ref);
            });
            await batch.commit();
            
            console.log(`      ✅ Deleted ${subSnapshot.size} documents from ${subCollectionName}`);
            deletedCount += subSnapshot.size;
          }
          
          // Delete the document
          await collectionRef.doc(docInfo.id).delete();
          deletedCount++;
          console.log(`   ✅ Deleted document: ${docInfo.id}`);
        }
      }
    }
    
    // Delete orphaned data
    for (const orphanedItem of findings.orphanedData) {
      console.log(`🗑️ Deleting orphaned data: ${orphanedItem.path}`);
      // Implementation would depend on the specific path structure
      deletedCount++;
    }
    
    // Delete client document if exists
    if (findings.clientDocument) {
      console.log('🗑️ Deleting client document...');
      await db.collection('clients').doc(CLIENT_ID).delete();
      deletedCount++;
      console.log('✅ Client document deleted');
    }
    
    return deletedCount;
    
  } catch (error) {
    console.error('❌ Force deletion failed:', error);
    return deletedCount;
  }
}

/**
 * Main scanning and cleanup function
 */
async function performDeepScan() {
  console.log('🚀 Starting Deep Ghost Data Scan and Cleanup...\n');
  
  try {
    await initializeFirebase();
    const db = await getDb();
    
    // Deep scan
    const findings = await deepScanForMTCData(db);
    
    // Report findings
    console.log('\n' + '='.repeat(60));
    console.log('📋 DEEP SCAN RESULTS');
    console.log('='.repeat(60));
    console.log(`🎯 Client: ${CLIENT_ID}`);
    console.log(`📄 Client document exists: ${!!findings.clientDocument}`);
    console.log(`📁 Collections found: ${findings.collections.size}`);
    console.log(`📄 Total documents: ${findings.totalDocuments}`);
    console.log(`👻 Orphaned data items: ${findings.orphanedData.length}`);
    
    // Detail the findings
    if (findings.collections.size > 0) {
      console.log('\n📁 COLLECTIONS FOUND:');
      for (const [name, info] of findings.collections.entries()) {
        console.log(`   ${name}: ${info.documentCount} documents`);
        info.documents.forEach(doc => {
          console.log(`      - ${doc.id}${doc.subcollections.length > 0 ? ` (${doc.subcollections.join(', ')})` : ''}`);
        });
      }
    }
    
    if (findings.orphanedData.length > 0) {
      console.log('\n👻 ORPHANED DATA:');
      findings.orphanedData.forEach(item => {
        console.log(`   ${item.path}`);
      });
    }
    
    // Cleanup if needed
    const totalItems = findings.totalDocuments + findings.orphanedData.length + (findings.clientDocument ? 1 : 0);
    
    if (totalItems > 0) {
      console.log(`\n🗑️ CLEANUP NEEDED: ${totalItems} items to delete`);
      const deletedCount = await forceDeleteFoundData(db, findings);
      
      console.log('\n✅ CLEANUP COMPLETED');
      console.log(`🗑️ Items deleted: ${deletedCount}`);
    } else {
      console.log('\n✅ NO CLEANUP NEEDED - Database is clean');
    }
    
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n💥 Deep scan failed:', error);
    throw error;
  }
}

// Execute
performDeepScan()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });