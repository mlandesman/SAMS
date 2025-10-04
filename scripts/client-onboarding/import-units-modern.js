/**
 * Modern Units Import
 * Uses controllers and DateService for all operations
 * 
 * Phase 2: Import Script Modernization
 * Date: 2025-09-29
 */

import { initializeFirebase, getDb } from '../../backend/firebase.js';
import { createUnit } from '../../backend/controllers/unitsController.js';
import { 
  createMockContext, 
  createDateService,
  ProgressLogger,
  handleControllerResponse,
  validateImportData,
  loadJsonData,
  createImportSummary,
  convertLegacyDate
} from './utils/import-utils-modern.js';
import { augmentMTCUnit, validateAugmentedUnit } from './data-augmentation-utils.js';

const CLIENT_ID = 'MTC';

/**
 * Load and combine Units + UnitSizes data
 */
async function loadUnitsData() {
  console.log('📁 Loading Units and UnitSizes data...');
  
  const unitsData = await loadJsonData('./MTCdata/Units.json');
  const unitSizesData = await loadJsonData('./MTCdata/UnitSizes.json');
  
  console.log(`✅ Loaded ${unitsData.length} units and ${unitSizesData.length} size records`);
  
  // Create lookup map for size data by unitId
  const sizeDataMap = {};
  unitSizesData.forEach(sizeRecord => {
    const unitId = sizeRecord.Condo; // Use "Condo" field to match UnitID
    if (unitId) {
      sizeDataMap[unitId] = sizeRecord;
    }
  });
  
  console.log(`🔗 Created size mapping for ${Object.keys(sizeDataMap).length} units`);
  
  return { unitsData, sizeDataMap };
}

/**
 * Import units using modern controller
 */
async function importUnits(unitsData, sizeDataMap, mockContext, dateService) {
  console.log('\n🏠 Importing Units...\n');
  
  const logger = new ProgressLogger('Units', unitsData.length);
  const unitIds = [];
  let withSizeData = 0;
  let withoutSizeData = 0;
  let validationErrors = 0;
  
  for (const unitData of unitsData) {
    try {
      const unitId = unitData.UnitID;
      
      // Get corresponding size data
      const sizeData = sizeDataMap[unitId] || null;
      
      if (sizeData) {
        withSizeData++;
      } else {
        withoutSizeData++;
      }
      
      // Augment unit data
      const augmentedUnit = augmentMTCUnit(unitData, sizeData);
      
      // Validate augmented data
      const validation = validateAugmentedUnit(augmentedUnit);
      if (!validation.valid) {
        console.error(`   ❌ Validation failed for unit ${unitId}:`, validation.errors);
        validationErrors++;
        logger.logItem(unitId, 'error');
        continue;
      }
      
      // Convert any date fields using DateService
      if (augmentedUnit.lastPaymentDate) {
        augmentedUnit.lastPaymentDate = convertLegacyDate(augmentedUnit.lastPaymentDate, dateService);
      }
      
      // Remove fields that controller will add
      delete augmentedUnit.createdAt;
      delete augmentedUnit.updated;
      
      // Call controller through mock context
      mockContext.req.body = augmentedUnit;
      const result = await createUnit(CLIENT_ID, augmentedUnit, mockContext.req.user);
      
      const createdUnitId = handleControllerResponse(result);
      if (createdUnitId) {
        unitIds.push(createdUnitId);
        logger.logItem(unitId, 'success');
      } else {
        logger.logItem(unitId, 'error');
      }
      
    } catch (error) {
      logger.logError(unitData.UnitID || 'Unknown', error);
    }
  }
  
  const summary = logger.logSummary();
  summary.unitIds = unitIds;
  summary.withSizeData = withSizeData;
  summary.withoutSizeData = withoutSizeData;
  summary.validationErrors = validationErrors;
  return summary;
}

/**
 * Verify imports
 */
async function verifyImports() {
  console.log('\n🔍 Verifying imports...\n');
  
  const db = await getDb();
  const unitsRef = db.collection('clients').doc(CLIENT_ID).collection('units');
  const auditLogsRef = db.collection('auditLogs');
  
  const unitsSnapshot = await unitsRef.get();
  
  console.log(`🏠 Units in database: ${unitsSnapshot.size}`);
  
  // Sample unit structure
  if (unitsSnapshot.size > 0) {
    const sampleUnit = unitsSnapshot.docs[0].data();
    console.log(`\n📋 Sample unit structure:`);
    console.log(`   ID: ${sampleUnit.unitId}`);
    console.log(`   Owner: ${sampleUnit.owner?.name || 'N/A'}`);
    console.log(`   Size: ${sampleUnit.physicalInfo?.squareFeet || 'N/A'} ft²`);
    console.log(`   Migration data: ${sampleUnit.migrationData ? 'Present' : 'Missing'}`);
  }
  
  // Check recent audit logs
  const auditSnapshot = await auditLogsRef
    .where('clientId', '==', CLIENT_ID)
    .where('module', '==', 'units')
    .orderBy('timestamp', 'desc')
    .limit(10)
    .get();
  
  console.log(`📝 Recent audit logs: ${auditSnapshot.size}`);
  
  return {
    units: unitsSnapshot.size,
    auditLogs: auditSnapshot.size
  };
}

/**
 * Main import process
 */
async function main() {
  console.log('🚀 Starting Modern Units Import...\n');
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
    
    // Load data
    const { unitsData, sizeDataMap } = await loadUnitsData();
    
    // Validate data
    const validation = validateImportData(unitsData, ['UnitID']);
    if (!validation.valid) {
      throw new Error(`Units data validation failed: ${validation.errors.join(', ')}`);
    }
    
    // Import units
    const unitsResult = await importUnits(unitsData, sizeDataMap, mockContext, dateService);
    
    // Verify imports
    const verification = await verifyImports();
    
    // Create summary
    const summary = createImportSummary('Units Import', {
      total: unitsResult.total,
      success: unitsResult.success,
      duplicates: unitsResult.duplicates,
      errors: unitsResult.errors,
      units: unitsResult,
      verification: verification
    }, startTime);
    
    // Final report
    console.log('\n' + '='.repeat(70));
    console.log('🏠 MODERN UNITS IMPORT COMPLETE');
    console.log('='.repeat(70));
    console.log(`🎯 Client: ${CLIENT_ID}`);
    console.log(`⏰ Duration: ${summary.duration}`);
    console.log(`🏠 Units: ${unitsResult.success}/${unitsResult.total} imported`);
    console.log(`📐 With size data: ${unitsResult.withSizeData}`);
    console.log(`⚠️  Without size data: ${unitsResult.withoutSizeData}`);
    console.log(`❌ Validation errors: ${unitsResult.validationErrors}`);
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

export { importUnits, main as performUnitsImport };