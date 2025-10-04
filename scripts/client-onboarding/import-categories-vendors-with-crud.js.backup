/**
 * Categories & Vendors Import with CRUD Functions
 * 
 * Refactored to use proper CRUD functions with automatic audit logging
 * Uses createCategory() and createVendor() controllers for full compliance
 * 
 * Task ID: MTC-MIGRATION-001 - Phase 3 Refactored Import
 * Date: June 27, 2025
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';
import { augmentMTCCategory, augmentMTCVendor } from './data-augmentation-utils.js';
import fs from 'fs/promises';

// Import CRUD functions with audit logging
import { createCategory } from '../backend/controllers/categoriesController.js';
import { createVendor } from '../backend/controllers/vendorsController.js';

const CLIENT_ID = 'MTC';

/**
 * Import Categories using CRUD functions
 */
async function importCategoriesWithCRUD(categoriesData) {
  console.log('📋 Importing Categories using CRUD functions...\n');
  
  const results = {
    total: categoriesData.length,
    success: 0,
    errors: 0,
    duplicates: 0,
    categoryIds: []
  };
  
  // Ensure client exists first
  const db = await getDb();
  const clientRef = db.collection('clients').doc(CLIENT_ID);
  const clientDoc = await clientRef.get();
  
  if (!clientDoc.exists) {
    console.log('🏢 Creating MTC client document...');
    await clientRef.set({
      name: 'Mariscal Tower Condominiums',
      shortName: 'MTC',
      createdAt: new Date(),
      status: 'migration_in_progress'
    });
  }
  
  for (const [index, categoryData] of categoriesData.entries()) {
    try {
      console.log(`📝 Processing category ${index + 1}/${categoriesData.length}: "${categoryData.Categories}"`);
      
      // Check for duplicates first
      const categoriesRef = db.collection('clients').doc(CLIENT_ID).collection('categories');
      const existingQuery = await categoriesRef.where('name', '==', categoryData.Categories).get();
      
      if (!existingQuery.empty) {
        console.log(`   ⚠️ Category already exists: "${categoryData.Categories}"`);
        results.duplicates++;
        continue;
      }
      
      // Augment category data
      const augmentedCategory = augmentMTCCategory(categoryData);
      
      // Remove createdAt since CRUD function will add it
      delete augmentedCategory.createdAt;
      
      // Use CRUD function (includes automatic audit logging)
      const categoryId = await createCategory(CLIENT_ID, augmentedCategory);
      
      if (categoryId) {
        console.log(`   ✅ Created category: "${categoryData.Categories}" (ID: ${categoryId})`);
        results.success++;
        results.categoryIds.push(categoryId);
      } else {
        console.log(`   ❌ Failed to create category: "${categoryData.Categories}"`);
        results.errors++;
      }
      
    } catch (error) {
      console.error(`   ❌ Error processing category "${categoryData.Categories}":`, error);
      results.errors++;
    }
  }
  
  console.log(`\n📊 Categories Import Summary:`);
  console.log(`   Total: ${results.total}`);
  console.log(`   Success: ${results.success}`);
  console.log(`   Duplicates: ${results.duplicates}`);
  console.log(`   Errors: ${results.errors}`);
  console.log(`   Audit logs: ${results.success} (automatic via CRUD)`);
  
  return results;
}

/**
 * Import Vendors using CRUD functions
 */
async function importVendorsWithCRUD(vendorsData) {
  console.log('\n🏪 Importing Vendors using CRUD functions...\n');
  
  const results = {
    total: vendorsData.length,
    success: 0,
    errors: 0,
    duplicates: 0,
    vendorIds: []
  };
  
  const db = await getDb();
  
  for (const [index, vendorData] of vendorsData.entries()) {
    try {
      console.log(`🏪 Processing vendor ${index + 1}/${vendorsData.length}: "${vendorData.Vendors}"`);
      
      // Check for duplicates first
      const vendorsRef = db.collection('clients').doc(CLIENT_ID).collection('vendors');
      const existingQuery = await vendorsRef.where('name', '==', vendorData.Vendors).get();
      
      if (!existingQuery.empty) {
        console.log(`   ⚠️ Vendor already exists: "${vendorData.Vendors}"`);
        results.duplicates++;
        continue;
      }
      
      // Augment vendor data
      const augmentedVendor = augmentMTCVendor(vendorData);
      
      // Remove createdAt since CRUD function will add it
      delete augmentedVendor.createdAt;
      
      // Use CRUD function (includes automatic audit logging)
      const vendorId = await createVendor(CLIENT_ID, augmentedVendor);
      
      if (vendorId) {
        console.log(`   ✅ Created vendor: "${vendorData.Vendors}" (ID: ${vendorId})`);
        results.success++;
        results.vendorIds.push(vendorId);
      } else {
        console.log(`   ❌ Failed to create vendor: "${vendorData.Vendors}"`);
        results.errors++;
      }
      
    } catch (error) {
      console.error(`   ❌ Error processing vendor "${vendorData.Vendors}":`, error);
      results.errors++;
    }
  }
  
  console.log(`\n📊 Vendors Import Summary:`);
  console.log(`   Total: ${results.total}`);
  console.log(`   Success: ${results.success}`);
  console.log(`   Duplicates: ${results.duplicates}`);
  console.log(`   Errors: ${results.errors}`);
  console.log(`   Audit logs: ${results.success} (automatic via CRUD)`);
  
  return results;
}

/**
 * Verify imports and audit trail
 */
async function verifyImportsAndAuditTrail(db) {
  console.log('\n🔍 Verifying imports and audit trail...\n');
  
  const categoriesRef = db.collection('clients').doc(CLIENT_ID).collection('categories');
  const vendorsRef = db.collection('clients').doc(CLIENT_ID).collection('vendors');
  const auditLogsRef = db.collection('auditLogs');
  
  const [categoriesSnapshot, vendorsSnapshot] = await Promise.all([
    categoriesRef.get(),
    vendorsRef.get()
  ]);
  
  console.log(`📋 Categories in database: ${categoriesSnapshot.size}`);
  console.log(`🏪 Vendors in database: ${vendorsSnapshot.size}`);
  
  // Check audit logs for this import
  const auditSnapshot = await auditLogsRef
    .where('clientId', '==', CLIENT_ID)
    .where('module', 'in', ['categories', 'vendors'])
    .orderBy('timestamp', 'desc')
    .limit(50)
    .get();
  
  console.log(`📋 Recent audit logs found: ${auditSnapshot.size}`);
  
  if (auditSnapshot.size > 0) {
    console.log('\n📋 Recent audit log entries:');
    auditSnapshot.docs.slice(0, 5).forEach(doc => {
      const data = doc.data();
      console.log(`   ${data.module}/${data.action}: ${data.friendlyName} (${data.timestamp.toDate().toLocaleTimeString()})`);
    });
  }
  
  // Sample structures
  if (categoriesSnapshot.size > 0) {
    const sampleCategory = categoriesSnapshot.docs[0].data();
    console.log(`\n📋 Sample category structure:`);
    console.log(`   Name: ${sampleCategory.name}`);
    console.log(`   Client ID: ${sampleCategory.clientId}`);
    console.log(`   Migration data: ${sampleCategory.migrationData ? 'Present' : 'Missing'}`);
  }
  
  if (vendorsSnapshot.size > 0) {
    const sampleVendor = vendorsSnapshot.docs[0].data();
    console.log(`\n🏪 Sample vendor structure:`);
    console.log(`   Name: ${sampleVendor.name}`);
    console.log(`   Client ID: ${sampleVendor.clientId}`);
    console.log(`   Migration data: ${sampleVendor.migrationData ? 'Present' : 'Missing'}`);
  }
  
  return {
    categories: categoriesSnapshot.size,
    vendors: vendorsSnapshot.size,
    auditLogs: auditSnapshot.size
  };
}

/**
 * Main import process with CRUD functions
 */
async function performCategoriesVendorsImportWithCRUD() {
  console.log('🚀 Starting Categories & Vendors Import with CRUD Functions...\n');
  
  const results = {
    timestamp: new Date().toISOString(),
    clientId: CLIENT_ID,
    categories: null,
    vendors: null,
    verification: null,
    success: false
  };
  
  try {
    // Initialize Firebase
    await initializeFirebase();
    const db = await getDb();
    
    // Load data files
    console.log('📁 Loading MTC data files...');
    const categoriesData = JSON.parse(await fs.readFile('./MTCdata/Categories.json', 'utf-8'));
    const vendorsData = JSON.parse(await fs.readFile('./MTCdata/Vendors.json', 'utf-8'));
    
    console.log(`✅ Loaded ${categoriesData.length} categories and ${vendorsData.length} vendors\n`);
    
    // Import Categories using CRUD
    console.log('=== STEP 1: CATEGORIES IMPORT (CRUD) ===');
    results.categories = await importCategoriesWithCRUD(categoriesData);
    
    // Import Vendors using CRUD
    console.log('\n=== STEP 2: VENDORS IMPORT (CRUD) ===');
    results.vendors = await importVendorsWithCRUD(vendorsData);
    
    // Verify imports and audit trail
    console.log('\n=== STEP 3: VERIFICATION & AUDIT TRAIL ===');
    results.verification = await verifyImportsAndAuditTrail(db);
    
    // Check overall success
    const categoriesSuccess = results.categories.success > 0 && results.categories.errors === 0;
    const vendorsSuccess = results.vendors.success > 0 && results.vendors.errors === 0;
    results.success = categoriesSuccess && vendorsSuccess;
    
    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('📋 CATEGORIES & VENDORS IMPORT WITH CRUD SUMMARY');
    console.log('='.repeat(70));
    console.log(`🎯 Client: ${CLIENT_ID}`);
    console.log(`⏰ Completed: ${results.timestamp}`);
    console.log('');
    console.log('📋 CATEGORIES (CRUD):');
    console.log(`   Total processed: ${results.categories.total}`);
    console.log(`   Successfully imported: ${results.categories.success}`);
    console.log(`   Duplicates skipped: ${results.categories.duplicates}`);
    console.log(`   Errors: ${results.categories.errors}`);
    console.log(`   Audit logs created: ${results.categories.success} (automatic)`);
    console.log('');
    console.log('🏪 VENDORS (CRUD):');
    console.log(`   Total processed: ${results.vendors.total}`);
    console.log(`   Successfully imported: ${results.vendors.success}`);
    console.log(`   Duplicates skipped: ${results.vendors.duplicates}`);
    console.log(`   Errors: ${results.vendors.errors}`);
    console.log(`   Audit logs created: ${results.vendors.success} (automatic)`);
    console.log('');
    console.log('🔍 VERIFICATION:');
    console.log(`   Categories in database: ${results.verification.categories}`);
    console.log(`   Vendors in database: ${results.verification.vendors}`);
    console.log(`   Audit logs found: ${results.verification.auditLogs}`);
    
    if (results.success) {
      console.log('\n✅ CATEGORIES & VENDORS IMPORT WITH CRUD SUCCESSFUL!');
      console.log('🔍 Full audit trail automatically created via CRUD functions');
      console.log('🚀 Ready for next step: Units Import with CRUD');
    } else {
      console.log('\n⚠️ IMPORT COMPLETED WITH ISSUES');
      console.log('🔧 Review errors before proceeding to next step');
    }
    
    console.log('='.repeat(70));
    
    return results;
    
  } catch (error) {
    console.error('\n💥 Categories & Vendors import with CRUD failed:', error);
    results.error = error.message;
    throw error;
  }
}

// Execute
performCategoriesVendorsImportWithCRUD()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });