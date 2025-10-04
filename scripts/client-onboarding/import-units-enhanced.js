#!/usr/bin/env node

/**
 * Enhanced Units Import with DateService
 * 
 * Imports unit data with proper timezone handling for timestamps
 * Preserves unit/owner mapping logic and size data integration
 * 
 * Features:
 * - DateService for all timestamps
 * - Combines Units.json + UnitSizes.json data
 * - Client-agnostic implementation
 * - Preserves all business logic
 * 
 * Usage:
 *   node import-units-enhanced.js <CLIENT_ID> [DATA_PATH]
 * 
 * Created: September 29, 2025
 */

import { 
  dateService, 
  getImportConfig, 
  initializeImport,
  getCurrentTimestamp,
  createMigrationMetadata,
  logProgress 
} from './import-config.js';
import { augmentMTCUnit, validateAugmentedUnit } from '../data-augmentation-utils.js';
import { createUnit } from '../../backend/controllers/unitsController.js';
import fs from 'fs/promises';
import path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('❌ Usage: node import-units-enhanced.js <CLIENT_ID> [DATA_PATH]');
  process.exit(1);
}

const CLIENT_ID = args[0];
const DATA_PATH = args[1];

// Get import configuration
const config = getImportConfig(CLIENT_ID, DATA_PATH);

/**
 * Load and combine Units + UnitSizes data
 * Units.json is an array, UnitSizes uses "Condo" field for mapping
 */
async function loadUnitsData() {
  logProgress('Loading Units and UnitSizes data...', 'info');
  
  const unitsFile = path.join(config.dataPath, 'Units.json');
  const sizesFile = path.join(config.dataPath, 'UnitSizes.json');
  
  try {
    // Load units data
    const unitsData = JSON.parse(await fs.readFile(unitsFile, 'utf-8'));
    logProgress(`Loaded ${unitsData.length} units`, 'success');
    
    // Try to load sizes data (optional)
    let unitSizesData = [];
    try {
      unitSizesData = JSON.parse(await fs.readFile(sizesFile, 'utf-8'));
      logProgress(`Loaded ${unitSizesData.length} size records`, 'success');
    } catch (error) {
      logProgress('No UnitSizes.json found - proceeding without size data', 'warn');
    }
    
    // Create lookup map for size data by unitId (Condo field in UnitSizes.json)
    const sizeDataMap = {};
    unitSizesData.forEach(sizeRecord => {
      const unitId = sizeRecord.Condo;  // Use "Condo" field to match UnitID
      if (unitId) {
        sizeDataMap[unitId] = sizeRecord;
      }
    });
    
    logProgress(`Created size mapping for ${Object.keys(sizeDataMap).length} units`, 'info');
    
    return { unitsData, sizeDataMap };
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Units file not found at: ${unitsFile}`);
    }
    throw error;
  }
}

/**
 * Augment unit data based on client
 */
function augmentUnit(unitData, sizeData) {
  // For now, use MTC augmentation logic
  // TODO: Add client-specific augmentation
  if (CLIENT_ID === 'MTC') {
    return augmentMTCUnit(unitData, sizeData);
  } else {
    // Generic augmentation for other clients
    const unitId = unitData.UnitID || unitData.unitId;
    
    return {
      unitId: unitId,
      unitName: `Unit ${unitId}`,
      owner: unitData.Owner || unitData.owner || '',
      email: unitData.eMail || unitData.Email || unitData.email || '',
      monthlyDues: unitData.Dues || unitData.monthlyDues || 0,
      percentOwned: unitData['% Owner'] || unitData.percentOwned || 0,
      squareFeet: sizeData?.['ft² '] || sizeData?.squareFeet || null,
      squareMeters: sizeData?.['m² '] || sizeData?.squareMeters || null,
      percentOfBuilding: sizeData?.['%'] || unitData['% Owner'] || 0,
      owners: unitData.Owner ? [unitData.Owner] : [],
      emails: (unitData.eMail || unitData.Email) ? [unitData.eMail || unitData.Email] : [],
      managers: [],
      createdAt: getCurrentTimestamp(),
      migrationData: createMigrationMetadata({
        originalData: unitData,
        sizeData: sizeData,
        hasSize: !!sizeData
      })
    };
  }
}

/**
 * Import Units with DateService support
 */
async function importUnitsWithCRUD(unitsData, sizeDataMap) {
  logProgress('Starting units import...', 'info');
  
  const results = {
    total: unitsData.length,
    success: 0,
    errors: 0,
    validationErrors: 0,
    withSizeData: 0,
    withoutSizeData: 0,
    unitIds: []
  };
  
  // Initialize and ensure client exists
  const { db } = await initializeImport(CLIENT_ID);
  const clientRef = db.collection('clients').doc(CLIENT_ID);
  const clientDoc = await clientRef.get();
  
  if (!clientDoc.exists) {
    logProgress(`Creating ${CLIENT_ID} client document...`, 'info');
    await clientRef.set({
      name: CLIENT_ID,
      shortName: CLIENT_ID,
      createdAt: getCurrentTimestamp(),
      status: 'migration_in_progress',
      migrationData: createMigrationMetadata({
        source: 'enhanced-import'
      })
    });
  }
  
  // Process each unit
  for (const [index, unitData] of unitsData.entries()) {
    try {
      const unitId = unitData.UnitID || unitData.unitId;
      
      if ((index + 1) % 10 === 0) {
        logProgress(`Processing unit ${index + 1}/${results.total}`, 'info');
      }
      
      // Get corresponding size data
      const sizeData = sizeDataMap[unitId] || null;
      
      if (sizeData) {
        results.withSizeData++;
      } else {
        results.withoutSizeData++;
      }
      
      // Augment unit data
      const augmentedUnit = augmentUnit(unitData, sizeData);
      
      // Update timestamp with DateService
      augmentedUnit.createdAt = getCurrentTimestamp();
      
      // Validate augmented data
      const validation = validateAugmentedUnit(augmentedUnit);
      if (!validation.isValid) {
        logProgress(`Validation failed for unit ${unitId}: ${validation.errors.join(', ')}`, 'error');
        results.validationErrors++;
        continue;
      }
      
      // Check if unit already exists
      const existingUnitRef = db.collection('clients').doc(CLIENT_ID).collection('units').doc(unitId);
      const existingUnit = await existingUnitRef.get();
      if (existingUnit.exists) {
        logProgress(`Unit ${unitId} already exists - skipping`, 'warn');
        continue;
      }
      
      // Create mock request/response for controller
      const req = {
        params: { clientId: CLIENT_ID },
        body: augmentedUnit,
        user: { uid: 'import-script-enhanced' }
      };
      
      const res = {
        status: (code) => ({ json: (data) => data }),
        json: (data) => data
      };
      
      // Use CRUD function with specific unitId
      const result = await createUnit(req, res, unitId);
      const createdUnitId = result?.id;
      
      if (createdUnitId === unitId) {
        results.success++;
        results.unitIds.push(createdUnitId);
        
        // Log sample units for verification
        if (results.success <= 3) {
          logProgress(`Created unit ${unitId}`, 'success');
          console.log(`      Owner: ${unitData.Owner || 'N/A'}`);
          console.log(`      Email: ${unitData.eMail || unitData.Email || 'N/A'}`);
          console.log(`      Monthly Dues: $${unitData.Dues || 0}`);
          console.log(`      Size: ${sizeData?.['ft² '] || 'Unknown'} ft²`);
        }
      } else {
        logProgress(`Failed to create unit ${unitId}`, 'error');
        results.errors++;
      }
      
    } catch (error) {
      logProgress(`Error processing unit ${index + 1}: ${error.message}`, 'error');
      results.errors++;
    }
  }
  
  // Log summary
  console.log(`\n📊 Units Import Summary:`);
  console.log(`   Total: ${results.total}`);
  console.log(`   Success: ${results.success}`);
  console.log(`   Errors: ${results.errors}`);
  console.log(`   Validation Errors: ${results.validationErrors}`);
  console.log(`   With Size Data: ${results.withSizeData}`);
  console.log(`   Without Size Data: ${results.withoutSizeData}`);
  console.log(`   Audit logs: ${results.success} (automatic via CRUD)`);
  
  return results;
}

/**
 * Verify units import
 */
async function verifyUnitsImport(db) {
  logProgress('Verifying units import...', 'info');
  
  const unitsRef = db.collection('clients').doc(CLIENT_ID).collection('units');
  const unitsSnapshot = await unitsRef.limit(5).get();
  
  console.log(`\n🏠 Sample units in database:`);
  unitsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log(`   ${doc.id}: ${data.owner} (${data.email})`);
    console.log(`      Monthly Dues: $${data.monthlyDues}`);
    console.log(`      Size: ${data.squareFeet || 'N/A'} ft²`);
  });
  
  // Count total units
  const countSnapshot = await unitsRef.count().get();
  const totalCount = countSnapshot.data().count;
  
  return {
    totalUnits: totalCount,
    sampleCount: unitsSnapshot.size,
    unitIds: unitsSnapshot.docs.map(doc => doc.id)
  };
}

/**
 * Analyze data quality
 */
async function analyzeUnitsData(unitsData, sizeDataMap) {
  logProgress('Analyzing units data quality...', 'info');
  
  const analysis = {
    totalUnits: unitsData.length,
    unitsWithEmail: 0,
    unitsWithDues: 0,
    unitsWithOwner: 0,
    unitsWithSizeData: 0,
    duesRange: { min: Infinity, max: -Infinity },
    uniqueEmails: new Set(),
    duplicateEmails: []
  };
  
  unitsData.forEach(unitData => {
    const unitId = unitData.UnitID || unitData.unitId;
    
    // Check required fields
    if (unitData.eMail || unitData.Email) {
      analysis.unitsWithEmail++;
      analysis.uniqueEmails.add(unitData.eMail || unitData.Email);
    }
    if (unitData.Dues && typeof unitData.Dues === 'number') {
      analysis.unitsWithDues++;
      analysis.duesRange.min = Math.min(analysis.duesRange.min, unitData.Dues);
      analysis.duesRange.max = Math.max(analysis.duesRange.max, unitData.Dues);
    }
    if (unitData.Owner) {
      analysis.unitsWithOwner++;
    }
    if (sizeDataMap[unitId]) {
      analysis.unitsWithSizeData++;
    }
  });
  
  // Check for duplicate emails
  const emailCounts = {};
  unitsData.forEach(unitData => {
    const email = unitData.eMail || unitData.Email;
    if (email) {
      emailCounts[email] = (emailCounts[email] || 0) + 1;
    }
  });
  
  Object.entries(emailCounts).forEach(([email, count]) => {
    if (count > 1) {
      analysis.duplicateEmails.push({ email, count });
    }
  });
  
  console.log('\n📊 Units Data Analysis Results:');
  console.log(`   Total Units: ${analysis.totalUnits}`);
  console.log(`   Units with Email: ${analysis.unitsWithEmail}/${analysis.totalUnits}`);
  console.log(`   Units with Owner: ${analysis.unitsWithOwner}/${analysis.totalUnits}`);
  console.log(`   Units with Dues: ${analysis.unitsWithDues}/${analysis.totalUnits}`);
  console.log(`   Units with Size Data: ${analysis.unitsWithSizeData}/${analysis.totalUnits}`);
  console.log(`   Unique Emails: ${analysis.uniqueEmails.size}`);
  console.log(`   Duplicate Emails: ${analysis.duplicateEmails.length}`);
  
  if (analysis.duesRange.min !== Infinity) {
    console.log(`   Dues Range: $${analysis.duesRange.min} - $${analysis.duesRange.max}`);
  }
  
  if (analysis.duplicateEmails.length > 0) {
    console.log('\n⚠️ Duplicate Email Alert:');
    analysis.duplicateEmails.slice(0, 5).forEach(({ email, count }) => {
      console.log(`   ${email}: ${count} units`);
    });
  }
  
  return analysis;
}

/**
 * Main import process
 */
async function main() {
  console.log('🚀 Starting Enhanced Units Import with DateService...\n');
  console.log('✅ Features:');
  console.log('   - DateService for all timestamps');
  console.log('   - Unit/size data integration');
  console.log('   - Client-agnostic implementation');
  console.log('   - Automatic audit logging\n');
  
  const results = {
    timestamp: dateService.formatForFrontend(new Date()).iso,
    timestampDisplay: dateService.formatForFrontend(new Date()).displayFull,
    clientId: CLIENT_ID,
    dataPath: config.dataPath,
    dataAnalysis: null,
    import: null,
    verification: null,
    success: false
  };
  
  try {
    // Load data
    const { unitsData, sizeDataMap } = await loadUnitsData();
    
    // Analyze data quality
    console.log('\n=== STEP 1: DATA ANALYSIS ===');
    results.dataAnalysis = await analyzeUnitsData(unitsData, sizeDataMap);
    
    // Import units
    console.log('\n=== STEP 2: UNITS IMPORT ===');
    results.import = await importUnitsWithCRUD(unitsData, sizeDataMap);
    
    // Verify
    console.log('\n=== STEP 3: VERIFICATION ===');
    const { db } = await initializeImport(CLIENT_ID);
    results.verification = await verifyUnitsImport(db);
    
    // Check success
    results.success = results.import.success > 0 && results.import.errors === 0;
    
    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('📋 ENHANCED UNITS IMPORT SUMMARY');
    console.log('='.repeat(70));
    console.log(`🎯 Client: ${CLIENT_ID}`);
    console.log(`📁 Data Path: ${config.dataPath}`);
    console.log(`⏰ Completed: ${results.timestampDisplay}`);
    console.log(`🕐 Timezone: ${config.timezone}`);
    console.log('');
    console.log('📊 DATA ANALYSIS:');
    console.log(`   Total units processed: ${results.dataAnalysis.totalUnits}`);
    console.log(`   Units with all required fields: ${results.dataAnalysis.unitsWithOwner}`);
    console.log(`   Units with size data: ${results.dataAnalysis.unitsWithSizeData}`);
    console.log(`   Unique email addresses: ${results.dataAnalysis.uniqueEmails.size}`);
    console.log('');
    console.log('📁 IMPORT RESULTS:');
    console.log(`   Successfully imported: ${results.import.success}`);
    console.log(`   Import errors: ${results.import.errors}`);
    console.log(`   Validation errors: ${results.import.validationErrors}`);
    console.log(`   Units with size data: ${results.import.withSizeData}`);
    console.log('');
    console.log('🔍 VERIFICATION:');
    console.log(`   Total units in database: ${results.verification.totalUnits}`);
    
    if (results.success) {
      console.log('\n✅ ENHANCED UNITS IMPORT SUCCESSFUL!');
      console.log('🕐 All timestamps in America/Cancun timezone');
      console.log('📊 Unit data ready for user associations');
      console.log('🚀 Ready for next step: Users Import');
    } else {
      console.log('\n⚠️ UNITS IMPORT COMPLETED WITH ISSUES');
      console.log('🔧 Review errors before proceeding');
    }
    
    console.log('='.repeat(70));
    
    return results;
    
  } catch (error) {
    logProgress(`Import failed: ${error.message}`, 'error');
    console.error(error);
    results.error = error.message;
    throw error;
  }
}

// Execute if run directly
console.log('DEBUG: Checking if should run main...');
console.log('  import.meta.url:', import.meta.url);
console.log('  process.argv[1]:', process.argv[1]);
console.log('  Expected:', `file://${process.argv[1]}`);
const expectedUrl = new URL(`file://${process.argv[1]}`).href;
console.log('  Normalized expected:', expectedUrl);
console.log('  Match:', import.meta.url === expectedUrl);
if (import.meta.url === expectedUrl) {
  console.log('DEBUG: Condition met, calling main()');
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

// Export for testing
export { loadUnitsData, augmentUnit, importUnitsWithCRUD, analyzeUnitsData };