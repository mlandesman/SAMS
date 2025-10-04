/**
 * Modern Categories & Vendors Import
 * Uses controllers and DateService for all operations
 * 
 * Phase 2: Import Script Modernization
 * Date: 2025-09-29
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';
import { createCategory } from '../backend/controllers/categoriesController.js';
import { createVendor } from '../backend/controllers/vendorsController.js';
import { 
  createMockContext, 
  createDateService,
  ProgressLogger,
  handleControllerResponse,
  validateImportData,
  loadJsonData,
  createImportSummary
} from './utils/import-utils-modern.js';
import { augmentMTCCategory, augmentMTCVendor } from './data-augmentation-utils.js';

const CLIENT_ID = 'MTC';

/**
 * Import categories using modern controller
 */
async function importCategories(categoriesData, mockContext) {
  console.log('\n📋 Importing Categories...\n');
  
  const logger = new ProgressLogger('Categories', categoriesData.length);
  const db = await getDb();
  const categoryIds = [];
  
  for (const categoryData of categoriesData) {
    try {
      // Check for duplicates
      const categoriesRef = db.collection('clients').doc(CLIENT_ID).collection('categories');
      const existingQuery = await categoriesRef.where('name', '==', categoryData.Categories).get();
      
      if (!existingQuery.empty) {
        logger.logItem(categoryData.Categories, 'duplicate');
        continue;
      }
      
      // Augment category data
      const augmentedCategory = augmentMTCCategory(categoryData);
      
      // Remove fields that controller will add
      delete augmentedCategory.createdAt;
      delete augmentedCategory.updated;
      
      // Call controller through mock context
      mockContext.req.body = augmentedCategory;
      const result = await createCategory(CLIENT_ID, augmentedCategory, mockContext.req.user);
      
      const categoryId = handleControllerResponse(result);
      if (categoryId) {
        categoryIds.push(categoryId);
        logger.logItem(categoryData.Categories, 'success');
      } else {
        logger.logItem(categoryData.Categories, 'error');
      }
      
    } catch (error) {
      logger.logError(categoryData.Categories, error);
    }
  }
  
  const summary = logger.logSummary();
  summary.categoryIds = categoryIds;
  return summary;
}

/**
 * Import vendors using modern controller
 */
async function importVendors(vendorsData, mockContext) {
  console.log('\n🏪 Importing Vendors...\n');
  
  const logger = new ProgressLogger('Vendors', vendorsData.length);
  const db = await getDb();
  const vendorIds = [];
  
  for (const vendorData of vendorsData) {
    try {
      // Check for duplicates
      const vendorsRef = db.collection('clients').doc(CLIENT_ID).collection('vendors');
      const existingQuery = await vendorsRef.where('name', '==', vendorData.Vendors).get();
      
      if (!existingQuery.empty) {
        logger.logItem(vendorData.Vendors, 'duplicate');
        continue;
      }
      
      // Augment vendor data
      const augmentedVendor = augmentMTCVendor(vendorData);
      
      // Remove fields that controller will add
      delete augmentedVendor.createdAt;
      delete augmentedVendor.updated;
      
      // Call controller through mock context
      mockContext.req.body = augmentedVendor;
      const result = await createVendor(CLIENT_ID, augmentedVendor, mockContext.req.user);
      
      const vendorId = handleControllerResponse(result);
      if (vendorId) {
        vendorIds.push(vendorId);
        logger.logItem(vendorData.Vendors, 'success');
      } else {
        logger.logItem(vendorData.Vendors, 'error');
      }
      
    } catch (error) {
      logger.logError(vendorData.Vendors, error);
    }
  }
  
  const summary = logger.logSummary();
  summary.vendorIds = vendorIds;
  return summary;
}

/**
 * Verify imports
 */
async function verifyImports() {
  console.log('\n🔍 Verifying imports...\n');
  
  const db = await getDb();
  const categoriesRef = db.collection('clients').doc(CLIENT_ID).collection('categories');
  const vendorsRef = db.collection('clients').doc(CLIENT_ID).collection('vendors');
  const auditLogsRef = db.collection('auditLogs');
  
  const [categoriesSnapshot, vendorsSnapshot] = await Promise.all([
    categoriesRef.get(),
    vendorsRef.get()
  ]);
  
  console.log(`📋 Categories in database: ${categoriesSnapshot.size}`);
  console.log(`🏪 Vendors in database: ${vendorsSnapshot.size}`);
  
  // Check recent audit logs
  const auditSnapshot = await auditLogsRef
    .where('clientId', '==', CLIENT_ID)
    .where('module', 'in', ['categories', 'vendors'])
    .orderBy('timestamp', 'desc')
    .limit(10)
    .get();
  
  console.log(`📝 Recent audit logs: ${auditSnapshot.size}`);
  
  return {
    categories: categoriesSnapshot.size,
    vendors: vendorsSnapshot.size,
    auditLogs: auditSnapshot.size
  };
}

/**
 * Main import process
 */
async function main() {
  console.log('🚀 Starting Modern Categories & Vendors Import...\n');
  const startTime = Date.now();
  
  try {
    // Initialize Firebase
    await initializeFirebase();
    const db = await getDb();
    
    // Create mock context for controllers
    const { req, res } = createMockContext(CLIENT_ID);
    const mockContext = { req, res };
    
    // Create DateService
    const dateService = createDateService();
    
    // Ensure client exists
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
    
    // Load data files
    console.log('📁 Loading data files...');
    const categoriesData = await loadJsonData('./MTCdata/Categories.json');
    const vendorsData = await loadJsonData('./MTCdata/Vendors.json');
    
    // Validate data
    const categoryValidation = validateImportData(categoriesData, ['Categories']);
    if (!categoryValidation.valid) {
      throw new Error(`Category data validation failed: ${categoryValidation.errors.join(', ')}`);
    }
    
    const vendorValidation = validateImportData(vendorsData, ['Vendors']);
    if (!vendorValidation.valid) {
      throw new Error(`Vendor data validation failed: ${vendorValidation.errors.join(', ')}`);
    }
    
    console.log(`✅ Loaded ${categoriesData.length} categories and ${vendorsData.length} vendors\n`);
    
    // Import categories
    const categoriesResult = await importCategories(categoriesData, mockContext);
    
    // Import vendors
    const vendorsResult = await importVendors(vendorsData, mockContext);
    
    // Verify imports
    const verification = await verifyImports();
    
    // Create summary
    const summary = createImportSummary('Categories & Vendors Import', {
      total: categoriesResult.total + vendorsResult.total,
      success: categoriesResult.success + vendorsResult.success,
      duplicates: categoriesResult.duplicates + vendorsResult.duplicates,
      errors: categoriesResult.errors + vendorsResult.errors,
      categories: categoriesResult,
      vendors: vendorsResult,
      verification: verification
    }, startTime);
    
    // Final report
    console.log('\n' + '='.repeat(70));
    console.log('📋 MODERN CATEGORIES & VENDORS IMPORT COMPLETE');
    console.log('='.repeat(70));
    console.log(`🎯 Client: ${CLIENT_ID}`);
    console.log(`⏰ Duration: ${summary.duration}`);
    console.log(`📋 Categories: ${categoriesResult.success}/${categoriesResult.total} imported`);
    console.log(`🏪 Vendors: ${vendorsResult.success}/${vendorsResult.total} imported`);
    console.log(`📝 Audit logs created: ${verification.auditLogs}`);
    
    if (summary.success) {
      console.log('\n✅ IMPORT SUCCESSFUL!');
    } else {
      console.log('\n⚠️ IMPORT COMPLETED WITH ERRORS');
      console.log('Please review the errors above before proceeding.');
    }
    
    console.log('='.repeat(70));
    
    return summary;
    
  } catch (error) {
    console.error('\n💥 Import failed:', error);
    throw error;
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { importCategories, importVendors, main as performCategoriesVendorsImport };