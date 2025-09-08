/**
 * Create Empty Collections for New Client Onboarding
 * 
 * Creates empty collections for data types that may not exist during migration
 * but are required for the list management system to function properly.
 * 
 * Task ID: MTC-MIGRATION-001 - Create Empty Collections
 * Date: June 27, 2025
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';
import { writeAuditLog } from '../backend/utils/auditLogger.js';

const CLIENT_ID = 'MTC';

/**
 * Collection definitions with their required structure
 */
const COLLECTION_DEFINITIONS = {
  paymentTypes: {
    description: 'Payment method types (Credit Card, Bank Transfer, etc.)',
    sampleDocument: {
      name: 'Bank Transfer',
      description: 'Electronic bank transfer payment',
      isActive: true,
      sortOrder: 1,
      createdAt: new Date(),
      createdBy: 'system-initialization'
    }
  },
  projects: {
    description: 'Project tracking for expenses and budgets',
    sampleDocument: {
      name: 'General Operations',
      description: 'General operational expenses',
      status: 'active',
      startDate: new Date(),
      budget: 0,
      isActive: true,
      createdAt: new Date(),
      createdBy: 'system-initialization'
    }
  },
  budgets: {
    description: 'Budget categories and allocations',
    sampleDocument: {
      name: 'Annual Operating Budget',
      year: new Date().getFullYear(),
      totalAmount: 0,
      allocations: {},
      status: 'draft',
      isActive: true,
      createdAt: new Date(),
      createdBy: 'system-initialization'
    }
  },
  paymentMethods: {
    description: 'Specific payment methods (bank accounts, cards, etc.)',
    sampleDocument: {
      name: 'Primary Operating Account',
      type: 'bank_account',
      accountNumber: '****-001',
      isActive: true,
      isDefault: true,
      createdAt: new Date(),
      createdBy: 'system-initialization'
    }
  },
  costCenters: {
    description: 'Cost center allocations for expense tracking',
    sampleDocument: {
      name: 'Administration',
      code: 'ADMIN',
      description: 'Administrative costs and overhead',
      isActive: true,
      createdAt: new Date(),
      createdBy: 'system-initialization'
    }
  },
  documentTemplates: {
    description: 'Document templates for receipts and reports',
    sampleDocument: {
      name: 'Standard Receipt Template',
      type: 'receipt',
      template: '{}',
      isActive: true,
      isDefault: true,
      createdAt: new Date(),
      createdBy: 'system-initialization'
    }
  }
};

/**
 * Check if collection exists and has documents
 */
async function checkCollectionExists(db, clientId, collectionName) {
  try {
    const collectionRef = db.collection('clients').doc(clientId).collection(collectionName);
    const snapshot = await collectionRef.limit(1).get();
    return {
      exists: !snapshot.empty,
      documentCount: snapshot.size
    };
  } catch (error) {
    console.error(`Error checking collection ${collectionName}:`, error);
    return { exists: false, documentCount: 0 };
  }
}

/**
 * Create empty collection with sample document
 */
async function createEmptyCollection(db, clientId, collectionName, definition) {
  try {
    const collectionRef = db.collection('clients').doc(clientId).collection(collectionName);
    
    // Create a sample document to establish the collection
    const docRef = await collectionRef.add(definition.sampleDocument);
    
    // Write audit log
    const auditSuccess = await writeAuditLog({
      module: collectionName,
      action: 'create',
      parentPath: `clients/${clientId}/${collectionName}`,
      docId: docRef.id,
      friendlyName: definition.sampleDocument.name,
      notes: `Empty collection created for list management system. ${definition.description}`,
      clientId: clientId
    });
    
    if (!auditSuccess) {
      console.warn(`Failed to write audit log for ${collectionName} collection creation`);
    }
    
    return {
      success: true,
      documentId: docRef.id,
      documentName: definition.sampleDocument.name
    };
    
  } catch (error) {
    console.error(`Error creating collection ${collectionName}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Main function to create empty collections
 */
async function createEmptyCollections() {
  console.log('🏗️  Creating empty collections for list management system...\n');
  
  try {
    await initializeFirebase();
    const db = await getDb();
    
    const results = {
      collectionsChecked: 0,
      collectionsCreated: 0,
      collectionsExisted: 0,
      collectionsSkipped: 0,
      errors: []
    };
    
    console.log(`📋 Checking ${Object.keys(COLLECTION_DEFINITIONS).length} collection types for client ${CLIENT_ID}...\n`);
    
    for (const [collectionName, definition] of Object.entries(COLLECTION_DEFINITIONS)) {
      console.log(`🔍 Checking collection: ${collectionName}`);
      console.log(`   📄 Description: ${definition.description}`);
      
      results.collectionsChecked++;
      
      // Check if collection already exists
      const status = await checkCollectionExists(db, CLIENT_ID, collectionName);
      
      if (status.exists) {
        console.log(`   ✅ Collection already exists with ${status.documentCount} documents`);
        results.collectionsExisted++;
      } else {
        console.log(`   🏗️  Creating empty collection...`);
        
        const createResult = await createEmptyCollection(db, CLIENT_ID, collectionName, definition);
        
        if (createResult.success) {
          console.log(`   ✅ Created collection with sample document: "${createResult.documentName}" (ID: ${createResult.documentId})`);
          results.collectionsCreated++;
        } else {
          console.log(`   ❌ Failed to create collection: ${createResult.error}`);
          results.errors.push({
            collection: collectionName,
            error: createResult.error
          });
        }
      }
      
      console.log(''); // Add spacing between collections
    }
    
    // Final summary
    console.log('=' .repeat(70));
    console.log('📊 EMPTY COLLECTIONS CREATION SUMMARY');
    console.log('='.repeat(70));
    console.log(`🎯 Client: ${CLIENT_ID}`);
    console.log(`📋 Collections checked: ${results.collectionsChecked}`);
    console.log(`✅ Collections created: ${results.collectionsCreated}`);
    console.log(`📄 Collections already existed: ${results.collectionsExisted}`);
    console.log(`❌ Errors: ${results.errors.length}`);
    
    if (results.errors.length > 0) {
      console.log('\n❌ Collection creation errors:');
      results.errors.forEach(err => {
        console.log(`   ${err.collection}: ${err.error}`);
      });
    }
    
    if (results.collectionsCreated > 0) {
      console.log('\n🎉 List management system collections are now available!');
      console.log('📋 You can now access and manage:');
      Object.keys(COLLECTION_DEFINITIONS).forEach(collectionName => {
        console.log(`   - ${collectionName}`);
      });
      console.log('\n💡 These collections contain sample documents that can be edited or deleted.');
      console.log('💡 New documents can be added through the list management interface.');
    }
    
    console.log('='.repeat(70));
    
    return results;
    
  } catch (error) {
    console.error('💥 Failed to create empty collections:', error);
    throw error;
  }
}

// Execute
createEmptyCollections()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });