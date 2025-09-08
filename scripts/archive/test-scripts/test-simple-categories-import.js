#!/usr/bin/env node

/**
 * test-simple-categories-import.js
 * Simple test to import categories directly without CRUD functions to test timestamp compatibility
 */

import { initializeFirebase, printEnvironmentInfo } from './utils/environment-config.js';
import { validateCollectionData, removeDeprecatedFields } from './utils/field-validator.js';
import { createRequire } from 'module';

// Use require for JSON data
const require = createRequire(import.meta.url);
const categoriesData = require('../MTCdata/Categories.json');

const ENV = process.env.FIRESTORE_ENV || 'dev';
const CLIENT_ID = 'MTC';

// Generate document ID from name
function generateDocumentId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

async function testSimpleCategoriesImport() {
  console.log('🧪 Testing Simple Categories Import...\n');
  
  // Print environment information
  printEnvironmentInfo(ENV);
  
  try {
    // Initialize Firebase
    const { db, admin } = await initializeFirebase(ENV);
    
    // Use the same Timestamp from the Firebase instance
    const { Timestamp } = admin.firestore;
    
    console.log(`📁 Processing ${categoriesData.length} categories...\n`);
    
    let success = 0;
    let errors = 0;
    
    // Process first 3 categories as a test
    for (let i = 0; i < Math.min(3, categoriesData.length); i++) {
      const categoryData = categoriesData[i];
      const categoryName = categoryData.Categories;
      
      console.log(`📝 Processing category ${i + 1}: "${categoryName}"`);
      
      try {
        // Generate document ID
        const documentId = generateDocumentId(categoryName);
        
        // Create category data with proper field names for validation
        const augmentedCategory = {
          categoryId: documentId,
          categoryName: categoryName,
          clientId: CLIENT_ID,
          updated: Timestamp.now() // Use Firebase admin Timestamp directly
        };
        
        // Validate data
        const cleanedData = removeDeprecatedFields(augmentedCategory, 'categories');
        const validatedData = validateCollectionData(cleanedData, 'categories');
        
        // Store directly in Firestore
        const categoryRef = db.collection('clients').doc(CLIENT_ID).collection('categories').doc(documentId);
        await categoryRef.set(validatedData);
        
        console.log(`   ✅ Created category: "${categoryName}" (ID: ${documentId})`);
        success++;
        
      } catch (error) {
        console.error(`   ❌ Error creating category "${categoryName}":`, error.message);
        errors++;
      }
    }
    
    console.log(`\n📊 Test Results:`);
    console.log(`   Success: ${success}`);
    console.log(`   Errors: ${errors}`);
    
    if (success > 0) {
      console.log(`\n✅ Simple import test PASSED!`);
      console.log(`🔧 Issue is likely in CRUD function timestamp compatibility`);
    } else {
      console.log(`\n❌ Simple import test FAILED`);
      console.log(`🔧 Issue is in basic Firebase/timestamp setup`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Execute
testSimpleCategoriesImport()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Test script failed:', error);
    process.exit(1);
  });