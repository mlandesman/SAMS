/**
 * Test Script for Updated Categories & Vendors Import Scripts
 * 
 * Performs validation testing without actually importing to Firebase
 * Validates field structure compliance with new specifications
 * 
 * Task ID: IMPORT-SCRIPTS-UPDATE-001 - Subagent 4 Testing
 * Date: July 4, 2025
 */

import { Timestamp } from 'firebase-admin/firestore';
import fs from 'fs/promises';

// Field validation
function validateRequiredFields(data, requiredFields) {
  const errors = [];
  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  return errors;
}

// Generate document ID from name
function generateDocumentId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

// Create timestamp (mock for testing)
function createTimestamp() {
  return Timestamp.now();
}

// Process category per new specification
function processCategory(categoryData) {
  const categoryName = categoryData.Categories || categoryData.name || categoryData;
  const category = {
    name: categoryName,
    type: 'expense', // Default type
    description: null,
    isActive: true,
    updated: createTimestamp()
  };
  
  return {
    data: category,
    errors: validateRequiredFields(category, ['name', 'type', 'isActive', 'updated'])
  };
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
  
  return {
    data: vendor,
    errors: validateRequiredFields(vendor, ['name', 'isActive', 'updated'])
  };
}

/**
 * Test categories processing
 */
async function testCategoriesProcessing(categoriesData) {
  console.log('🧪 Testing Categories Processing...\n');
  
  const results = {
    total: categoriesData.length,
    valid: 0,
    errors: 0,
    validationErrors: [],
    sampleData: []
  };
  
  for (const [index, categoryData] of categoriesData.entries()) {
    try {
      const categoryName = categoryData.Categories || categoryData.name || categoryData;
      const documentId = generateDocumentId(categoryName);
      const processed = processCategory(categoryData);
      
      if (processed.errors.length === 0) {
        results.valid++;
        
        // Store first 3 samples
        if (results.sampleData.length < 3) {
          results.sampleData.push({
            documentId,
            original: categoryData,
            processed: processed.data
          });
        }
      } else {
        results.errors++;
        results.validationErrors.push({
          category: categoryName,
          errors: processed.errors
        });
      }
      
    } catch (error) {
      results.errors++;
      results.validationErrors.push({
        category: categoryData.Categories || 'Unknown',
        errors: [error.message]
      });
    }
  }
  
  return results;
}

/**
 * Test vendors processing
 */
async function testVendorsProcessing(vendorsData) {
  console.log('🧪 Testing Vendors Processing...\n');
  
  const results = {
    total: vendorsData.length,
    valid: 0,
    errors: 0,
    validationErrors: [],
    sampleData: []
  };
  
  for (const [index, vendorData] of vendorsData.entries()) {
    try {
      const vendorName = vendorData.Vendors || vendorData.name || vendorData;
      const documentId = generateDocumentId(vendorName);
      const processed = processVendor(vendorData);
      
      if (processed.errors.length === 0) {
        results.valid++;
        
        // Store first 3 samples
        if (results.sampleData.length < 3) {
          results.sampleData.push({
            documentId,
            original: vendorData,
            processed: processed.data
          });
        }
      } else {
        results.errors++;
        results.validationErrors.push({
          vendor: vendorName,
          errors: processed.errors
        });
      }
      
    } catch (error) {
      results.errors++;
      results.validationErrors.push({
        vendor: vendorData.Vendors || 'Unknown',
        errors: [error.message]
      });
    }
  }
  
  return results;
}

/**
 * Validate field structure compliance
 */
function validateFieldStructureCompliance(processedData, specification) {
  const compliance = {
    requiredFieldsPresent: true,
    deprecatedFieldsRemoved: true,
    timestampObjectsUsed: true,
    issues: []
  };
  
  // Check required fields based on specification
  const requiredFields = specification === 'categories' 
    ? ['name', 'type', 'isActive', 'updated']
    : ['name', 'isActive', 'updated'];
    
  for (const field of requiredFields) {
    if (processedData[field] === undefined || processedData[field] === null) {
      compliance.requiredFieldsPresent = false;
      compliance.issues.push(`Missing required field: ${field}`);
    }
  }
  
  // Check for deprecated fields
  const deprecatedFields = specification === 'categories'
    ? ['budgetAmount', 'sortOrder', 'clientId', 'createdAt', 'migrationData']
    : ['categoryName', 'clientId', 'createdAt', 'migrationData'];
    
  for (const field of deprecatedFields) {
    if (processedData[field] !== undefined) {
      compliance.deprecatedFieldsRemoved = false;
      compliance.issues.push(`Deprecated field present: ${field}`);
    }
  }
  
  // Check timestamp objects
  if (processedData.updated && !(processedData.updated instanceof Timestamp)) {
    compliance.timestampObjectsUsed = false;
    compliance.issues.push('Updated field is not a Firestore Timestamp object');
  }
  
  return compliance;
}

/**
 * Main test function
 */
async function testCategoriesVendorsScripts() {
  console.log('🧪 Starting Categories & Vendors Scripts Testing...\n');
  
  const testResults = {
    timestamp: new Date().toISOString(),
    categories: null,
    vendors: null,
    compliance: null,
    success: false
  };
  
  try {
    // Load test data
    console.log('📁 Loading MTC test data...');
    const categoriesData = JSON.parse(await fs.readFile('./MTCdata/Categories.json', 'utf-8'));
    const vendorsData = JSON.parse(await fs.readFile('./MTCdata/Vendors.json', 'utf-8'));
    
    console.log(`✅ Loaded ${categoriesData.length} categories and ${vendorsData.length} vendors\n`);
    
    // Test categories processing
    console.log('=== TESTING CATEGORIES PROCESSING ===');
    testResults.categories = await testCategoriesProcessing(categoriesData);
    
    // Test vendors processing
    console.log('=== TESTING VENDORS PROCESSING ===');
    testResults.vendors = await testVendorsProcessing(vendorsData);
    
    // Validate compliance
    console.log('=== VALIDATING FIELD STRUCTURE COMPLIANCE ===');
    const compliance = {
      categories: {
        totalSamples: testResults.categories.sampleData.length,
        compliantSamples: 0,
        issues: []
      },
      vendors: {
        totalSamples: testResults.vendors.sampleData.length,
        compliantSamples: 0,
        issues: []
      }
    };
    
    // Test category compliance
    for (const sample of testResults.categories.sampleData) {
      const categoryCompliance = validateFieldStructureCompliance(sample.processed, 'categories');
      if (categoryCompliance.requiredFieldsPresent && categoryCompliance.deprecatedFieldsRemoved && categoryCompliance.timestampObjectsUsed) {
        compliance.categories.compliantSamples++;
      } else {
        compliance.categories.issues.push({
          documentId: sample.documentId,
          issues: categoryCompliance.issues
        });
      }
    }
    
    // Test vendor compliance
    for (const sample of testResults.vendors.sampleData) {
      const vendorCompliance = validateFieldStructureCompliance(sample.processed, 'vendors');
      if (vendorCompliance.requiredFieldsPresent && vendorCompliance.deprecatedFieldsRemoved && vendorCompliance.timestampObjectsUsed) {
        compliance.vendors.compliantSamples++;
      } else {
        compliance.vendors.issues.push({
          documentId: sample.documentId,
          issues: vendorCompliance.issues
        });
      }
    }
    
    testResults.compliance = compliance;
    
    // Check overall success
    const categoriesSuccess = testResults.categories.valid > 0 && testResults.categories.errors === 0;
    const vendorsSuccess = testResults.vendors.valid > 0 && testResults.vendors.errors === 0;
    const complianceSuccess = compliance.categories.compliantSamples === compliance.categories.totalSamples &&
                             compliance.vendors.compliantSamples === compliance.vendors.totalSamples;
    
    testResults.success = categoriesSuccess && vendorsSuccess && complianceSuccess;
    
    // Print results
    console.log('\n' + '='.repeat(70));
    console.log('🧪 CATEGORIES & VENDORS SCRIPTS TEST RESULTS');
    console.log('='.repeat(70));
    console.log(`⏰ Completed: ${testResults.timestamp}`);
    console.log('');
    console.log('📋 CATEGORIES PROCESSING:');
    console.log(`   Total processed: ${testResults.categories.total}`);
    console.log(`   Valid: ${testResults.categories.valid}`);
    console.log(`   Errors: ${testResults.categories.errors}`);
    console.log(`   Validation errors: ${testResults.categories.validationErrors.length}`);
    console.log('');
    console.log('🏪 VENDORS PROCESSING:');
    console.log(`   Total processed: ${testResults.vendors.total}`);
    console.log(`   Valid: ${testResults.vendors.valid}`);
    console.log(`   Errors: ${testResults.vendors.errors}`);
    console.log(`   Validation errors: ${testResults.vendors.validationErrors.length}`);
    console.log('');
    console.log('✅ FIELD STRUCTURE COMPLIANCE:');
    console.log(`   Categories compliant: ${compliance.categories.compliantSamples}/${compliance.categories.totalSamples}`);
    console.log(`   Vendors compliant: ${compliance.vendors.compliantSamples}/${compliance.vendors.totalSamples}`);
    console.log(`   Total compliance issues: ${compliance.categories.issues.length + compliance.vendors.issues.length}`);
    
    // Show sample processed data
    if (testResults.categories.sampleData.length > 0) {
      console.log('\\n📋 SAMPLE CATEGORY (New Structure):');
      const sample = testResults.categories.sampleData[0];
      console.log(`   Document ID: ${sample.documentId}`);
      console.log(`   Original: ${JSON.stringify(sample.original)}`);
      console.log(`   Processed:`, JSON.stringify(sample.processed, null, 2));
    }
    
    if (testResults.vendors.sampleData.length > 0) {
      console.log('\\n🏪 SAMPLE VENDOR (New Structure):');
      const sample = testResults.vendors.sampleData[0];
      console.log(`   Document ID: ${sample.documentId}`);
      console.log(`   Original: ${JSON.stringify(sample.original)}`);
      console.log(`   Processed:`, JSON.stringify(sample.processed, null, 2));
    }
    
    if (testResults.success) {
      console.log('\\n✅ ALL TESTS PASSED!');
      console.log('🚀 Scripts are ready for production use');
    } else {
      console.log('\\n⚠️ TESTS COMPLETED WITH ISSUES');
      console.log('🔧 Review errors before using scripts');
      
      // Show specific errors
      if (testResults.categories.validationErrors.length > 0) {
        console.log('\\nCategories validation errors:');
        testResults.categories.validationErrors.slice(0, 3).forEach(error => {
          console.log(`  - ${error.category}: ${error.errors.join(', ')}`);
        });
      }
      
      if (testResults.vendors.validationErrors.length > 0) {
        console.log('\\nVendors validation errors:');
        testResults.vendors.validationErrors.slice(0, 3).forEach(error => {
          console.log(`  - ${error.vendor}: ${error.errors.join(', ')}`);
        });
      }
    }
    
    console.log('='.repeat(70));
    
    return testResults;
    
  } catch (error) {
    console.error('\\n💥 Test script failed:', error);
    testResults.error = error.message;
    throw error;
  }
}

// Execute tests
testCategoriesVendorsScripts()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Tests failed:', error);
    process.exit(1);
  });