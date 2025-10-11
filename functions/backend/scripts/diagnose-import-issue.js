#!/usr/bin/env node

/**
 * Diagnostic script to investigate why run-complete-import.js fails silently
 * 
 * This script will:
 * 1. Test Firebase connectivity
 * 2. Run units import with detailed logging
 * 3. Run HOA dues import with detailed logging
 * 4. Check for error swallowing in the master script
 */

import { initializeFirebase, getDb } from '../firebase.js';
import { runUnitsImport, importUnitsComplete, loadUnitsData } from './production-import-package/04-units-import.js';
import { runHOADuesImport, importHOADuesComplete, loadHOADuesData } from './production-import-package/06-hoa-dues-import.js';

const CLIENT_ID = 'MTC';

console.log(`🔍 Diagnostic Script for Import Issue`);
console.log(`⏰ Started at: ${new Date().toISOString()}`);
console.log(`─────────────────────────────────────────────────────────`);

// Test 1: Firebase Connection
async function testFirebaseConnection() {
  console.log(`\n🔥 Test 1: Firebase Connection`);
  
  try {
    const db = await getDb();
    console.log(`✅ Firebase connection successful`);
    
    // Test write capability
    const testRef = db.collection('test').doc('diagnostic');
    await testRef.set({ timestamp: new Date(), test: true });
    console.log(`✅ Write test successful`);
    
    // Test read capability
    const doc = await testRef.get();
    console.log(`✅ Read test successful: ${doc.exists ? 'Document exists' : 'Document not found'}`);
    
    // Clean up
    await testRef.delete();
    console.log(`✅ Cleanup successful`);
    
    return true;
  } catch (error) {
    console.error(`❌ Firebase connection test failed:`, error);
    return false;
  }
}

// Test 2: Data Loading
async function testDataLoading() {
  console.log(`\n📖 Test 2: Data Loading`);
  
  try {
    // Test units data
    console.log(`\n  Loading units data...`);
    const unitsData = await loadUnitsData();
    console.log(`  ✅ Units data loaded: ${unitsData.length} units`);
    
    // Test HOA dues data
    console.log(`\n  Loading HOA dues data...`);
    const hoaDuesData = await loadHOADuesData();
    console.log(`  ✅ HOA dues data loaded: ${Object.keys(hoaDuesData).length} units`);
    
    return true;
  } catch (error) {
    console.error(`❌ Data loading test failed:`, error);
    return false;
  }
}

// Test 3: Direct Import Functions
async function testDirectImports() {
  console.log(`\n🚀 Test 3: Direct Import Functions`);
  
  try {
    // Count before import
    const db = await getDb();
    
    const unitsBeforeSnapshot = await db.collection(`clients/${CLIENT_ID}/units`).get();
    const hoaDuesBeforeSnapshot = await db.collection(`clients/${CLIENT_ID}/hoaDues`).get();
    
    console.log(`\n  Before import:`);
    console.log(`  - Units: ${unitsBeforeSnapshot.size}`);
    console.log(`  - HOA Dues: ${hoaDuesBeforeSnapshot.size}`);
    
    // Test units import
    console.log(`\n  Testing units import...`);
    try {
      const unitsResult = await importUnitsComplete();
      console.log(`  ✅ Units import returned: ${unitsResult.length} units`);
    } catch (error) {
      console.error(`  ❌ Units import error:`, error);
    }
    
    // Test HOA dues import
    console.log(`\n  Testing HOA dues import...`);
    try {
      const hoaDuesResult = await importHOADuesComplete();
      console.log(`  ✅ HOA dues import returned: ${hoaDuesResult.length} dues`);
    } catch (error) {
      console.error(`  ❌ HOA dues import error:`, error);
    }
    
    // Count after import
    const unitsAfterSnapshot = await db.collection(`clients/${CLIENT_ID}/units`).get();
    const hoaDuesAfterSnapshot = await db.collection(`clients/${CLIENT_ID}/hoaDues`).get();
    
    console.log(`\n  After import:`);
    console.log(`  - Units: ${unitsAfterSnapshot.size} (+${unitsAfterSnapshot.size - unitsBeforeSnapshot.size})`);
    console.log(`  - HOA Dues: ${hoaDuesAfterSnapshot.size} (+${hoaDuesAfterSnapshot.size - hoaDuesBeforeSnapshot.size})`);
    
    return true;
  } catch (error) {
    console.error(`❌ Direct import test failed:`, error);
    return false;
  }
}

// Test 4: Master Script Behavior
async function testMasterScriptBehavior() {
  console.log(`\n🔄 Test 4: Master Script Behavior Analysis`);
  
  try {
    // Check if the master script is handling errors properly
    console.log(`\n  Analyzing error handling in master script...`);
    
    // Test the executePhase function behavior
    async function simulateExecutePhase(phaseName, phaseFunction) {
      console.log(`\n  Simulating phase: ${phaseName}`);
      
      try {
        const result = await phaseFunction();
        console.log(`  ✅ Phase completed, result:`, typeof result);
        
        // Check if result is being properly returned
        if (result === null || result === undefined) {
          console.warn(`  ⚠️  Phase returned null/undefined`);
        } else if (Array.isArray(result) && result.length === 0) {
          console.warn(`  ⚠️  Phase returned empty array`);
        } else if (typeof result === 'object' && Object.keys(result).length === 0) {
          console.warn(`  ⚠️  Phase returned empty object`);
        }
        
        return result;
      } catch (error) {
        console.error(`  ❌ Phase error:`, error.message);
        throw error;
      }
    }
    
    // Test with units import
    await simulateExecutePhase('Units Import', runUnitsImport);
    
    // Test with HOA dues import
    await simulateExecutePhase('HOA Dues Import', runHOADuesImport);
    
    return true;
  } catch (error) {
    console.error(`❌ Master script behavior test failed:`, error);
    return false;
  }
}

// Test 5: Check for Silent Failures
async function checkForSilentFailures() {
  console.log(`\n🔇 Test 5: Checking for Silent Failures`);
  
  try {
    // Test if errors are being swallowed
    console.log(`\n  Testing error propagation...`);
    
    // Create a function that throws an error
    async function throwingFunction() {
      throw new Error('Test error - this should be caught');
    }
    
    // Test if errors bubble up properly
    try {
      await throwingFunction();
      console.error(`  ❌ Error was not thrown - error handling issue!`);
    } catch (error) {
      console.log(`  ✅ Error properly caught: ${error.message}`);
    }
    
    // Test promise rejection handling
    console.log(`\n  Testing promise rejection handling...`);
    
    const rejectedPromise = Promise.reject(new Error('Test rejection'));
    try {
      await rejectedPromise;
      console.error(`  ❌ Rejection was not caught - promise handling issue!`);
    } catch (error) {
      console.log(`  ✅ Rejection properly caught: ${error.message}`);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Silent failure check failed:`, error);
    return false;
  }
}

// Run all tests
async function runDiagnostics() {
  const results = {
    firebaseConnection: false,
    dataLoading: false,
    directImports: false,
    masterScriptBehavior: false,
    silentFailures: false
  };
  
  try {
    results.firebaseConnection = await testFirebaseConnection();
    results.dataLoading = await testDataLoading();
    results.directImports = await testDirectImports();
    results.masterScriptBehavior = await testMasterScriptBehavior();
    results.silentFailures = await checkForSilentFailures();
    
    console.log(`\n📊 Diagnostic Summary:`);
    console.log(`─────────────────────────────────────────────────────────`);
    console.log(`  Firebase Connection: ${results.firebaseConnection ? '✅' : '❌'}`);
    console.log(`  Data Loading: ${results.dataLoading ? '✅' : '❌'}`);
    console.log(`  Direct Imports: ${results.directImports ? '✅' : '❌'}`);
    console.log(`  Master Script Behavior: ${results.masterScriptBehavior ? '✅' : '❌'}`);
    console.log(`  Silent Failures: ${results.silentFailures ? '✅' : '❌'}`);
    
    // Provide recommendations
    console.log(`\n💡 Recommendations:`);
    
    if (!results.firebaseConnection) {
      console.log(`  - Check Firebase credentials and network connectivity`);
    }
    
    if (!results.dataLoading) {
      console.log(`  - Verify data files exist in MTCdata directory`);
    }
    
    if (!results.directImports) {
      console.log(`  - Check individual import script error handling`);
    }
    
    if (!results.masterScriptBehavior) {
      console.log(`  - Review executePhase function in master script`);
      console.log(`  - Check if results are being properly returned`);
    }
    
    if (!results.silentFailures) {
      console.log(`  - Look for try-catch blocks that don't re-throw errors`);
      console.log(`  - Check for unhandled promise rejections`);
    }
    
  } catch (error) {
    console.error(`\n💥 Diagnostic script failed:`, error);
  }
}

// Run diagnostics
if (import.meta.url === `file://${process.argv[1]}`) {
  runDiagnostics()
    .then(() => {
      console.log(`\n🎯 Diagnostic complete`);
      process.exit(0);
    })
    .catch(error => {
      console.error(`\n💥 Diagnostic failed:`, error);
      process.exit(1);
    });
}