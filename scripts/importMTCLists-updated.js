/**
 * Import MTC Lists (Categories & Vendors) 
 * 
 * Simplified import script for categories and vendors with new field structure
 * - Uses Firestore Timestamp objects
 * - Removes deprecated fields (budgetAmount, sortOrder, categoryName)
 * - Adds proper validation
 * - Supports environment configuration
 * 
 * Task ID: IMPORT-SCRIPTS-UPDATE-001 - Subagent 4
 * Date: July 4, 2025
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';
import { Timestamp } from 'firebase-admin/firestore';
import fs from 'fs/promises';

// Environment configuration
const ENV = process.env.FIRESTORE_ENV || 'dev';
const projectId = {
  dev: 'sandyland-management-system',
  prod: 'sandyland-management-system',
  staging: 'sandyland-management-staging'
}[ENV];

const CLIENT_ID = 'MTC';

// Field validation
function validateRequiredFields(data, requiredFields) {
  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
}

// Generate document ID from name
function generateDocumentId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

// Create timestamp
function createTimestamp() {
  return Timestamp.now();
}

// Process category per new specification
function processCategory(categoryData) {
  const categoryName = categoryData.Categories || categoryData.name || categoryData;
  const category = {
    name: categoryName,
    type: 'expense', // Default type - can be manually updated to 'income' if needed
    description: null,
    isActive: true,
    updated: createTimestamp()
  };
  
  // Validate required fields
  validateRequiredFields(category, ['name', 'type', 'isActive', 'updated']);
  
  return category;
}

// Process vendor per new specification  
function processVendor(vendorData) {
  const vendorName = vendorData.Vendors || vendorData.name || vendorData;
  const vendor = {
    name: vendorName,
    categoryId: null,
    taxId: null,
    email: null,
    phone: null,
    address: null,
    paymentTerms: null,
    preferredPaymentMethod: null,
    bankAccount: null,
    isActive: true,
    notes: null,
    updated: createTimestamp()
  };
  
  // Validate required fields
  validateRequiredFields(vendor, ['name', 'isActive', 'updated']);
  
  return vendor;
}

/**
 * Import categories
 */
async function importCategories(db, categoriesData) {
  console.log('📋 Importing Categories...\n');
  
  const results = {
    total: categoriesData.length,
    success: 0,
    errors: 0,
    duplicates: 0
  };
  
  const categoriesRef = db.collection('clients').doc(CLIENT_ID).collection('categories');
  
  for (const [index, categoryData] of categoriesData.entries()) {
    try {
      const categoryName = categoryData.Categories || categoryData.name || categoryData;
      console.log(`📝 Processing category ${index + 1}/${categoriesData.length}: "${categoryName}"`);
      
      // Generate document ID
      const documentId = generateDocumentId(categoryName);
      
      // Check if category already exists by document ID
      const existingDoc = await categoriesRef.doc(documentId).get();
      
      if (existingDoc.exists) {
        console.log(`   ⚠️ Category already exists: "${categoryName}" (ID: ${documentId})`);
        results.duplicates++;
        continue;
      }
      
      // Process category data
      const processedCategory = processCategory(categoryData);
      
      // Add to Firestore with specific document ID
      await categoriesRef.doc(documentId).set(processedCategory);
      
      console.log(`   ✅ Imported: "${categoryName}" (ID: ${documentId})`);
      results.success++;
      
    } catch (error) {
      console.error(`   ❌ Failed to import category:`, error);
      results.errors++;
    }
  }
  
  console.log(`\n📊 Categories Import Summary:`);
  console.log(`   Total: ${results.total}`);
  console.log(`   Success: ${results.success}`);
  console.log(`   Duplicates: ${results.duplicates}`);
  console.log(`   Errors: ${results.errors}`);
  
  return results;
}

/**
 * Import vendors
 */
async function importVendors(db, vendorsData) {
  console.log('\n🏪 Importing Vendors...\n');
  
  const results = {
    total: vendorsData.length,
    success: 0,
    errors: 0,
    duplicates: 0
  };
  
  const vendorsRef = db.collection('clients').doc(CLIENT_ID).collection('vendors');
  
  for (const [index, vendorData] of vendorsData.entries()) {
    try {
      const vendorName = vendorData.Vendors || vendorData.name || vendorData;
      console.log(`🏪 Processing vendor ${index + 1}/${vendorsData.length}: "${vendorName}"`);
      
      // Generate document ID
      const documentId = generateDocumentId(vendorName);
      
      // Check if vendor already exists by document ID
      const existingDoc = await vendorsRef.doc(documentId).get();
      
      if (existingDoc.exists) {
        console.log(`   ⚠️ Vendor already exists: "${vendorName}" (ID: ${documentId})`);
        results.duplicates++;
        continue;
      }
      
      // Process vendor data
      const processedVendor = processVendor(vendorData);
      
      // Add to Firestore with specific document ID
      await vendorsRef.doc(documentId).set(processedVendor);
      
      console.log(`   ✅ Imported: "${vendorName}" (ID: ${documentId})`);
      results.success++;
      
    } catch (error) {
      console.error(`   ❌ Failed to import vendor:`, error);
      results.errors++;
    }
  }
  
  console.log(`\n📊 Vendors Import Summary:`);
  console.log(`   Total: ${results.total}`);
  console.log(`   Success: ${results.success}`);
  console.log(`   Duplicates: ${results.duplicates}`);
  console.log(`   Errors: ${results.errors}`);
  
  return results;
}

/**
 * Verify imports
 */
async function verifyImports(db) {
  console.log('\n🔍 Verifying imports...\n');
  
  const categoriesRef = db.collection('clients').doc(CLIENT_ID).collection('categories');
  const vendorsRef = db.collection('clients').doc(CLIENT_ID).collection('vendors');
  
  const [categoriesSnapshot, vendorsSnapshot] = await Promise.all([
    categoriesRef.get(),
    vendorsRef.get()
  ]);
  
  console.log(`📋 Categories in database: ${categoriesSnapshot.size}`);
  console.log(`🏪 Vendors in database: ${vendorsSnapshot.size}`);
  
  // Sample a few records to verify structure
  if (categoriesSnapshot.size > 0) {
    const sampleCategory = categoriesSnapshot.docs[0].data();
    console.log(`\n📋 Sample category structure:`);
    console.log(`   Document ID: ${categoriesSnapshot.docs[0].id}`);
    console.log(`   Name: ${sampleCategory.name}`);
    console.log(`   Type: ${sampleCategory.type}`);
    console.log(`   Is Active: ${sampleCategory.isActive}`);
    console.log(`   Updated: ${sampleCategory.updated?.toDate?.()}`);
    console.log(`   Has deprecated fields: ${sampleCategory.budgetAmount || sampleCategory.sortOrder ? 'Yes (needs cleanup)' : 'No'}`);
  }
  
  if (vendorsSnapshot.size > 0) {
    const sampleVendor = vendorsSnapshot.docs[0].data();
    console.log(`\n🏪 Sample vendor structure:`);
    console.log(`   Document ID: ${vendorsSnapshot.docs[0].id}`);
    console.log(`   Name: ${sampleVendor.name}`);
    console.log(`   Category ID: ${sampleVendor.categoryId}`);
    console.log(`   Is Active: ${sampleVendor.isActive}`);
    console.log(`   Updated: ${sampleVendor.updated?.toDate?.()}`);
    console.log(`   Has deprecated fields: ${sampleVendor.categoryName ? 'Yes (needs cleanup)' : 'No'}`);
  }
  
  return {
    categories: categoriesSnapshot.size,
    vendors: vendorsSnapshot.size
  };
}

/**
 * Main import process
 */
async function importMTCLists() {
  console.log('🚀 Starting MTC Lists Import...\n');
  console.log(`🌍 Environment: ${ENV}`);
  console.log(`🔥 Project ID: ${projectId}\n`);
  
  const results = {
    timestamp: new Date().toISOString(),
    environment: ENV,
    projectId: projectId,
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
    const categoriesData = JSON.parse(await fs.readFile('../MTCdata/Categories.json', 'utf-8'));
    const vendorsData = JSON.parse(await fs.readFile('../MTCdata/Vendors.json', 'utf-8'));
    
    console.log(`✅ Loaded ${categoriesData.length} categories and ${vendorsData.length} vendors\n`);
    
    // Ensure client document exists
    const clientRef = db.collection('clients').doc(CLIENT_ID);
    const clientDoc = await clientRef.get();
    
    if (!clientDoc.exists) {
      console.log('🏢 Creating MTC client document...');
      await clientRef.set({
        name: 'Mariscal Tower Condominiums',
        shortName: 'MTC',
        updated: createTimestamp(),
        status: 'migration_in_progress'
      });
    }
    
    // Import Categories
    console.log('=== STEP 1: CATEGORIES IMPORT ===');
    results.categories = await importCategories(db, categoriesData);
    
    // Import Vendors  
    console.log('\n=== STEP 2: VENDORS IMPORT ===');
    results.vendors = await importVendors(db, vendorsData);
    
    // Verify imports
    console.log('\n=== STEP 3: VERIFICATION ===');
    results.verification = await verifyImports(db);
    
    // Check overall success
    const categoriesSuccess = results.categories.success > 0 && results.categories.errors === 0;
    const vendorsSuccess = results.vendors.success > 0 && results.vendors.errors === 0;
    results.success = categoriesSuccess && vendorsSuccess;
    
    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('📋 MTC LISTS IMPORT SUMMARY');
    console.log('='.repeat(70));
    console.log(`🎯 Client: ${CLIENT_ID}`);
    console.log(`🌍 Environment: ${ENV}`);
    console.log(`🔥 Project: ${projectId}`);
    console.log(`⏰ Completed: ${results.timestamp}`);
    console.log('');
    console.log('📋 CATEGORIES:');
    console.log(`   Total processed: ${results.categories.total}`);
    console.log(`   Successfully imported: ${results.categories.success}`);
    console.log(`   Duplicates skipped: ${results.categories.duplicates}`);
    console.log(`   Errors: ${results.categories.errors}`);
    console.log('');
    console.log('🏪 VENDORS:');
    console.log(`   Total processed: ${results.vendors.total}`);
    console.log(`   Successfully imported: ${results.vendors.success}`);
    console.log(`   Duplicates skipped: ${results.vendors.duplicates}`);
    console.log(`   Errors: ${results.vendors.errors}`);
    console.log('');
    console.log('🔍 VERIFICATION:');
    console.log(`   Categories in database: ${results.verification.categories}`);
    console.log(`   Vendors in database: ${results.verification.vendors}`);
    
    if (results.success) {
      console.log('\n✅ MTC LISTS IMPORT SUCCESSFUL!');
      console.log('🚀 Ready for next step: Transaction Import');
    } else {
      console.log('\n⚠️ IMPORT COMPLETED WITH ISSUES');
      console.log('🔧 Review errors before proceeding to next step');
    }
    
    console.log('='.repeat(70));
    
    return results;
    
  } catch (error) {
    console.error('\n💥 MTC Lists import failed:', error);
    results.error = error.message;
    throw error;
  }
}

// Execute
importMTCLists()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });