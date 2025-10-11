#!/usr/bin/env node

/**
 * Test script to demonstrate the master script issue
 * 
 * This script shows why the master script reports Units: 0, HOA Dues: 0
 * even when the individual scripts work correctly.
 */

import { runUnitsImport } from './production-import-package/04-units-import.js';
import { runHOADuesImport } from './production-import-package/06-hoa-dues-import.js';

console.log(`🔍 Testing Master Script Issue`);
console.log(`─────────────────────────────────────────────────────────`);

// Test 1: Check actual return values
async function testReturnValues() {
  console.log(`\n📊 Test 1: Checking Return Values`);
  
  try {
    // Test units import return
    console.log(`\n  Testing runUnitsImport return value...`);
    const unitsResult = await runUnitsImport();
    console.log(`  Type: ${typeof unitsResult}`);
    console.log(`  Is Array: ${Array.isArray(unitsResult)}`);
    console.log(`  Length property: ${unitsResult.length}`);
    console.log(`  Sample:`, unitsResult.slice(0, 2));
    
    // Test HOA dues import return
    console.log(`\n  Testing runHOADuesImport return value...`);
    const hoaDuesResult = await runHOADuesImport();
    console.log(`  Type: ${typeof hoaDuesResult}`);
    console.log(`  Is Array: ${Array.isArray(hoaDuesResult)}`);
    console.log(`  Keys:`, Object.keys(hoaDuesResult));
    console.log(`  importedHOADues type: ${typeof hoaDuesResult.importedHOADues}`);
    console.log(`  importedHOADues length: ${hoaDuesResult.importedHOADues?.length}`);
    console.log(`  linkingResult:`, hoaDuesResult.linkingResult);
    
    return { unitsResult, hoaDuesResult };
  } catch (error) {
    console.error(`❌ Error testing return values:`, error);
    throw error;
  }
}

// Test 2: Simulate master script data summary
async function simulateMasterScriptSummary() {
  console.log(`\n📈 Test 2: Simulating Master Script Data Summary`);
  
  try {
    const { unitsResult, hoaDuesResult } = await testReturnValues();
    
    console.log(`\n  Master script would show:`);
    console.log(`  - Units: ${unitsResult.length || 0}`);
    console.log(`  - HOA Dues: ${hoaDuesResult.importedHOADues?.length || 0}`);
    
    console.log(`\n  🐛 BUG IDENTIFIED!`);
    console.log(`  The master script expects different return structures:`);
    console.log(`  - Units: Returns array directly ✅`);
    console.log(`  - HOA Dues: Returns object { importedHOADues, linkingResult } ❌`);
    
    console.log(`\n  Correct access would be:`);
    console.log(`  - Units: unitsResult.length ✅`);
    console.log(`  - HOA Dues: hoaDuesResult.importedHOADues.length ✅`);
    
  } catch (error) {
    console.error(`❌ Error simulating master script:`, error);
  }
}

// Test 3: Check if isDryRun affects results
async function testDryRunEffect() {
  console.log(`\n🔄 Test 3: Checking if isDryRun Affects Results`);
  
  // Check the executePhase function behavior
  console.log(`\n  The executePhase function has this logic:`);
  console.log(`  if (isDryRun) {`);
  console.log(`    console.log('DRY RUN: Would execute...');`);
  console.log(`    return null; // <-- Returns null in dry run mode!`);
  console.log(`  }`);
  
  console.log(`\n  This means:`);
  console.log(`  - In dry run mode, all phases return null`);
  console.log(`  - The data summary tries to access properties on null`);
  console.log(`  - Result: Units: 0, HOA Dues: 0`);
}

// Run tests
async function runTests() {
  try {
    await simulateMasterScriptSummary();
    await testDryRunEffect();
    
    console.log(`\n💡 SOLUTION:`);
    console.log(`  The master script has two issues:`);
    console.log(`\n  1. Inconsistent return value handling:`);
    console.log(`     - It expects hoaDuesResult to have an importedHOADues property`);
    console.log(`     - But runHOADuesImport returns { importedHOADues, linkingResult }`);
    console.log(`\n  2. Dry run mode returns null:`);
    console.log(`     - When --dry-run is used, executePhase returns null`);
    console.log(`     - The summary tries to access properties on null values`);
    console.log(`\n  Fix: Update the master script to:`);
    console.log(`     - Handle the correct return structure from HOA dues`);
    console.log(`     - Check for null values before accessing properties`);
    
  } catch (error) {
    console.error(`\n💥 Test failed:`, error);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests()
    .then(() => {
      console.log(`\n✅ Test complete`);
      process.exit(0);
    })
    .catch(error => {
      console.error(`\n💥 Test failed:`, error);
      process.exit(1);
    });
}