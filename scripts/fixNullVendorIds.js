/**
 * Fix vendors with null IDs by creating new documents with proper IDs
 * and removing the corrupted ones
 */

import { getDb } from '../backend/firebase.js';

async function fixNullVendorIds() {
  try {
    const db = await getDb();
    const clientId = 'MTC'; // Adjust if needed
    
    console.log('🔧 Starting to fix vendors with null IDs...');
    
    // Get all vendors
    const snapshot = await db.collection(`clients/${clientId}/vendors`).get();
    const vendorsToFix = [];
    const docsToDelete = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const docId = doc.id;
      
      // Check if this is a null ID vendor by examining the data structure
      // Null ID vendors will have newer fields like 'category', 'contactName', etc.
      if (data.category !== undefined || data.contactName !== undefined || data.email !== undefined) {
        console.log(`🔍 Found potential null ID vendor: ${data.name} (doc ID: ${docId})`);
        vendorsToFix.push({
          docId: docId,
          data: data
        });
      }
    });
    
    console.log(`📋 Found ${vendorsToFix.length} vendors to potentially fix`);
    
    // For each vendor to fix, create a new document and delete the old one
    for (const vendor of vendorsToFix) {
      try {
        console.log(`🔧 Fixing vendor: ${vendor.data.name}`);
        
        // Create new vendor document (this will generate a proper ID)
        const newVendorRef = await db.collection(`clients/${clientId}/vendors`).add({
          ...vendor.data,
          updatedAt: new Date(),
        });
        
        console.log(`✅ Created new vendor with ID: ${newVendorRef.id}`);
        
        // Delete the old document
        await db.doc(`clients/${clientId}/vendors/${vendor.docId}`).delete();
        console.log(`🗑️ Deleted old vendor document: ${vendor.docId}`);
        
      } catch (error) {
        console.error(`❌ Error fixing vendor ${vendor.data.name}:`, error);
      }
    }
    
    console.log('✅ Finished fixing null ID vendors');
    
  } catch (error) {
    console.error('❌ Error in fixNullVendorIds:', error);
  }
}

// Run the fix
fixNullVendorIds();
