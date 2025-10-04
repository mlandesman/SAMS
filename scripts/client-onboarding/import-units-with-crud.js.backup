/**
 * Units Import with CRUD Functions
 * 
 * Refactored to use createUnit() controller with automatic audit logging
 * Handles complex unit data structure with owner info and physical specs
 * 
 * Task ID: MTC-MIGRATION-001 - Phase 3 Refactored Units Import
 * Date: June 27, 2025
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';
import { augmentMTCUnit, validateAugmentedUnit } from './data-augmentation-utils.js';
import fs from 'fs/promises';

// Import CRUD function with audit logging
import { createUnit } from '../backend/controllers/unitsController.js';

const CLIENT_ID = 'MTC';

/**
 * Load and combine Units + UnitSizes data
 * CORRECTED: Units.json is an array, UnitSizes uses "Condo" field for mapping
 */
async function loadUnitsData() {
  console.log('📁 Loading Units and UnitSizes data...');
  
  const unitsData = JSON.parse(await fs.readFile('./MTCdata/Units.json', 'utf-8'));
  const unitSizesData = JSON.parse(await fs.readFile('./MTCdata/UnitSizes.json', 'utf-8'));
  
  console.log(`✅ Loaded ${unitsData.length} units and ${unitSizesData.length} size records`);
  
  // Create lookup map for size data by unitId (Condo field in UnitSizes.json)
  const sizeDataMap = {};
  unitSizesData.forEach(sizeRecord => {
    const unitId = sizeRecord.Condo;  // Use "Condo" field to match UnitID
    if (unitId) {
      sizeDataMap[unitId] = sizeRecord;
    }
  });
  
  console.log(`🔗 Created size mapping for ${Object.keys(sizeDataMap).length} units`);
  
  return { unitsData, sizeDataMap };
}

/**
 * Import Units using CRUD functions
 */
async function importUnitsWithCRUD(unitsData, sizeDataMap) {
  console.log('\n🏠 Importing Units using CRUD functions...\n');
  
  const results = {
    total: unitsData.length,  // Array length
    success: 0,
    errors: 0,
    validationErrors: 0,
    withSizeData: 0,
    withoutSizeData: 0,
    unitIds: []
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
  
  // CORRECTED: Iterate over array, not object entries
  for (const [index, unitData] of unitsData.entries()) {
    try {
      const unitId = unitData.UnitID;  // Get UnitID from data
      console.log(`🏠 Processing unit ${index + 1}/${results.total}: "${unitId}"`);
      
      // Get corresponding size data using unitId
      const sizeData = sizeDataMap[unitId] || null;
      
      if (sizeData) {
        console.log(`   📐 Size data found: ${sizeData['ft² ']} ft², ${sizeData['%']}% of building`);
        results.withSizeData++;
      } else {
        console.log(`   ⚠️ No size data found for unit ${unitId}`);
        results.withoutSizeData++;
      }
      
      // Augment unit data (function now takes unitData directly)
      const augmentedUnit = augmentMTCUnit(unitData, sizeData);
      
      // Remove createdAt since CRUD function will add it
      delete augmentedUnit.createdAt;
      
      // Validate augmented data
      const validation = validateAugmentedUnit(augmentedUnit);
      if (!validation.isValid) {
        console.error(`   ❌ Validation failed for unit ${unitId}:`, validation.errors);
        results.validationErrors++;
        continue;
      }
      
      // Check if unit already exists
      const existingUnitRef = db.collection('clients').doc(CLIENT_ID).collection('units').doc(unitId);
      const existingUnit = await existingUnitRef.get();
      if (existingUnit.exists) {
        console.log(`   ⚠️ Unit ${unitId} already exists - skipping...`);
        continue;
      }
      
      // Use CRUD function with specific unitId (includes automatic audit logging)
      const createdUnitId = await createUnit(CLIENT_ID, augmentedUnit, unitId);
      
      if (createdUnitId === unitId) {
        console.log(`   ✅ Created unit ${unitId} (ID: ${createdUnitId})`);
        console.log(`      Owner: ${unitData.Owner}`);
        console.log(`      Email: ${unitData.eMail}`);
        console.log(`      Monthly Dues: $${unitData.Dues}`);
        console.log(`      Size: ${sizeData?.['ft² '] || 'Unknown'} ft²`);
        
        results.success++;
        results.unitIds.push(createdUnitId);
      } else {
        console.log(`   ❌ Failed to create unit ${unitId}`);
        results.errors++;
      }
      
    } catch (error) {
      console.error(`   ❌ Error processing unit:`, error);
      results.errors++;
    }
  }
  
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
 * Verify units import and audit trail
 */
async function verifyUnitsImportAndAuditTrail(db) {
  console.log('\n🔍 Verifying units import and audit trail...\n');
  
  const unitsRef = db.collection('clients').doc(CLIENT_ID).collection('units');
  const unitsSnapshot = await unitsRef.get();
  
  console.log(`🏠 Units in database: ${unitsSnapshot.size}`);
  
  // Check audit logs for units import
  try {
    const auditLogsRef = db.collection('auditLogs');
    const auditSnapshot = await auditLogsRef
      .where('clientId', '==', CLIENT_ID)
      .where('module', '==', 'units')
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();
    
    console.log(`📋 Recent units audit logs found: ${auditSnapshot.size}`);
    
    if (auditSnapshot.size > 0) {
      console.log('\n📋 Recent units audit log entries:');
      auditSnapshot.docs.slice(0, 5).forEach(doc => {
        const data = doc.data();
        console.log(`   ${data.action}: ${data.friendlyName} (${data.timestamp.toDate().toLocaleTimeString()})`);
      });
    }
  } catch (error) {
    console.log('⚠️ Could not query audit logs (index may be needed)');
  }
  
  if (unitsSnapshot.size > 0) {
    // Sample first unit
    const sampleUnit = unitsSnapshot.docs[0];
    const unitData = sampleUnit.data();
    
    console.log(`\n🏠 Sample unit structure (${sampleUnit.id}):`);
    console.log(`   Owner: ${unitData.owner}`);
    console.log(`   Email: ${unitData.email}`);
    console.log(`   Monthly Dues: $${unitData.monthlyDues}`);
    console.log(`   Square Feet: ${unitData.squareFeet || 'N/A'}`);
    console.log(`   Percent Owned: ${unitData.percentOwned}%`);
    console.log(`   Migration data: ${unitData.migrationData ? 'Present' : 'Missing'}`);
    
    // Show all unit IDs
    console.log('\n🏠 All unit IDs in database:');
    unitsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`   ${doc.id}: ${data.owner} (${data.email})`);
    });
  }
  
  return {
    totalUnits: unitsSnapshot.size,
    unitIds: unitsSnapshot.docs.map(doc => doc.id)
  };
}

/**
 * Analyze data quality and mappings
 * CORRECTED: Handle Units.json as array
 */
async function analyzeUnitsData(unitsData, sizeDataMap) {
  console.log('\n📊 Analyzing units data quality...\n');
  
  const analysis = {
    totalUnits: unitsData.length,  // Array length
    unitsWithEmail: 0,
    unitsWithDues: 0,
    unitsWithOwner: 0,
    unitsWithSizeData: 0,
    duesRange: { min: Infinity, max: -Infinity },
    uniqueEmails: new Set(),
    duplicateEmails: []
  };
  
  // CORRECTED: Iterate over array
  unitsData.forEach(unitData => {
    const unitId = unitData.UnitID;
    
    // Check required fields
    if (unitData.eMail) {
      analysis.unitsWithEmail++;
      analysis.uniqueEmails.add(unitData.eMail);
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
    if (unitData.eMail) {
      emailCounts[unitData.eMail] = (emailCounts[unitData.eMail] || 0) + 1;
    }
  });
  
  Object.entries(emailCounts).forEach(([email, count]) => {
    if (count > 1) {
      analysis.duplicateEmails.push({ email, count });
    }
  });
  
  console.log('📊 Units Data Analysis Results:');
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
    analysis.duplicateEmails.forEach(({ email, count }) => {
      console.log(`   ${email}: ${count} units`);
    });
  }
  
  return analysis;
}

/**
 * Main units import process with CRUD
 */
async function performUnitsImportWithCRUD() {
  console.log('🚀 Starting Units Import with CRUD Functions...\n');
  
  const results = {
    timestamp: new Date().toISOString(),
    clientId: CLIENT_ID,
    dataAnalysis: null,
    import: null,
    verification: null,
    success: false
  };
  
  try {
    // Initialize Firebase
    await initializeFirebase();
    const db = await getDb();
    
    // Load units data
    const { unitsData, sizeDataMap } = await loadUnitsData();
    
    // Analyze data quality
    console.log('\n=== STEP 1: DATA ANALYSIS ===');
    results.dataAnalysis = await analyzeUnitsData(unitsData, sizeDataMap);
    
    // Import units using CRUD
    console.log('\n=== STEP 2: UNITS IMPORT (CRUD) ===');
    results.import = await importUnitsWithCRUD(unitsData, sizeDataMap);
    
    // Verify import and audit trail
    console.log('\n=== STEP 3: VERIFICATION & AUDIT TRAIL ===');
    results.verification = await verifyUnitsImportAndAuditTrail(db);
    
    // Check success
    results.success = results.import.success > 0 && results.import.errors === 0;
    
    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('📋 UNITS IMPORT WITH CRUD SUMMARY');
    console.log('='.repeat(70));
    console.log(`🎯 Client: ${CLIENT_ID}`);
    console.log(`⏰ Completed: ${results.timestamp}`);
    console.log('');
    console.log('📊 DATA ANALYSIS:');
    console.log(`   Total units processed: ${results.dataAnalysis.totalUnits}`);
    console.log(`   Units with all required fields: ${results.dataAnalysis.unitsWithOwner}`);
    console.log(`   Units with size data: ${results.dataAnalysis.unitsWithSizeData}`);
    console.log(`   Unique email addresses: ${results.dataAnalysis.uniqueEmails.size}`);
    console.log('');
    console.log('📁 IMPORT RESULTS (CRUD):');
    console.log(`   Successfully imported: ${results.import.success}`);
    console.log(`   Import errors: ${results.import.errors}`);
    console.log(`   Validation errors: ${results.import.validationErrors}`);
    console.log(`   Units with size data: ${results.import.withSizeData}`);
    console.log(`   Audit logs created: ${results.import.success} (automatic)`);
    console.log('');
    console.log('🔍 VERIFICATION:');
    console.log(`   Units in database: ${results.verification.totalUnits}`);
    console.log(`   Unit IDs: ${results.verification.unitIds.join(', ')}`);
    
    if (results.success) {
      console.log('\n✅ UNITS IMPORT WITH CRUD SUCCESSFUL!');
      console.log('🔍 Full audit trail automatically created via CRUD functions');
      console.log('🚀 Ready for next step: Users Import with CRUD');
    } else {
      console.log('\n⚠️ UNITS IMPORT COMPLETED WITH ISSUES');
      console.log('🔧 Review errors before proceeding to next step');
    }
    
    console.log('='.repeat(70));
    
    return results;
    
  } catch (error) {
    console.error('\n💥 Units import with CRUD failed:', error);
    results.error = error.message;
    throw error;
  }
}

// Execute
performUnitsImportWithCRUD()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });