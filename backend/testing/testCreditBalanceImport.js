/**
 * Test Credit Balance Import Process
 * 
 * Verifies that the import process:
 * 1. Writes credit balances to NEW Phase 1A structure (/units/creditBalances)
 * 2. Applies centavos validation to prevent floating point contamination
 * 3. Maintains credit balance history in dues document
 * 4. Produces clean integer centavos values
 * 
 * Usage: node backend/testing/testCreditBalanceImport.js
 */

import { getDb } from '../firebase.js';
import { validateCentavos } from '../utils/centavosValidation.js';

const TEST_CLIENT_ID = 'AVII'; // Use AVII for testing

/**
 * Verify credit balance structure and data integrity
 */
async function verifyCreditBalanceImport() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TESTING CREDIT BALANCE IMPORT PROCESS');
  console.log('='.repeat(80) + '\n');
  
  const db = await getDb();
  const results = {
    newStructureExists: false,
    allUnitsPresent: [],
    missingUnits: [],
    contaminatedFields: [],
    cleanFields: 0,
    totalFieldsChecked: 0,
    historyInDues: false,
    errors: []
  };
  
  try {
    // Step 1: Verify NEW structure exists
    console.log('📋 Step 1: Checking NEW credit balance structure...');
    const creditBalancesRef = db.doc(`clients/${TEST_CLIENT_ID}/units/creditBalances`);
    const creditBalancesDoc = await creditBalancesRef.get();
    
    if (!creditBalancesDoc.exists) {
      console.log('   ❌ NEW structure does NOT exist at /units/creditBalances');
      results.errors.push('NEW credit balance structure not found');
      return results;
    }
    
    results.newStructureExists = true;
    console.log('   ✅ NEW structure exists at /units/creditBalances');
    
    const allCreditBalances = creditBalancesDoc.data();
    const unitIds = Object.keys(allCreditBalances);
    console.log(`   📊 Found ${unitIds.length} units with credit balances: ${unitIds.join(', ')}`);
    
    // Step 2: Verify data integrity for each unit
    console.log('\n📋 Step 2: Verifying centavos integrity for each unit...');
    
    for (const unitId of unitIds) {
      const unitData = allCreditBalances[unitId];
      console.log(`\n   🏠 Unit ${unitId}:`);
      
      // Check creditBalance field
      if (unitData.creditBalance !== undefined) {
        results.totalFieldsChecked++;
        const value = unitData.creditBalance;
        
        if (Number.isInteger(value)) {
          results.cleanFields++;
          console.log(`      ✅ creditBalance: ${value} (clean integer)`);
        } else {
          results.contaminatedFields.push({
            unit: unitId,
            field: 'creditBalance',
            value: value,
            expected: Math.round(value)
          });
          console.log(`      ❌ creditBalance: ${value} (CONTAMINATED - should be ${Math.round(value)})`);
        }
      }
      
      // Check history entries
      if (unitData.history && Array.isArray(unitData.history)) {
        console.log(`      📜 History entries: ${unitData.history.length}`);
        
        unitData.history.forEach((entry, index) => {
          // Check amount
          if (entry.amount !== undefined) {
            results.totalFieldsChecked++;
            if (Number.isInteger(entry.amount)) {
              results.cleanFields++;
            } else {
              results.contaminatedFields.push({
                unit: unitId,
                field: `history[${index}].amount`,
                value: entry.amount,
                expected: Math.round(entry.amount)
              });
              console.log(`      ❌ history[${index}].amount: ${entry.amount} (CONTAMINATED)`);
            }
          }
          
          // Check balance fields
          ['balance', 'balanceBefore', 'balanceAfter'].forEach(field => {
            if (entry[field] !== undefined) {
              results.totalFieldsChecked++;
              if (Number.isInteger(entry[field])) {
                results.cleanFields++;
              } else {
                results.contaminatedFields.push({
                  unit: unitId,
                  field: `history[${index}].${field}`,
                  value: entry[field],
                  expected: Math.round(entry[field])
                });
                console.log(`      ❌ history[${index}].${field}: ${entry[field]} (CONTAMINATED)`);
              }
            }
          });
        });
      }
      
      results.allUnitsPresent.push(unitId);
    }
    
    // Step 3: Verify history is ALSO in dues documents (backward compatibility)
    console.log('\n📋 Step 3: Checking creditBalanceHistory in dues documents...');
    
    const sampleUnit = unitIds[0];
    if (sampleUnit) {
      // Find the fiscal year from the dues collection
      const duesSnapshot = await db.collection(`clients/${TEST_CLIENT_ID}/units/${sampleUnit}/dues`).get();
      
      if (!duesSnapshot.empty) {
        const firstDuesDoc = duesSnapshot.docs[0];
        const duesData = firstDuesDoc.data();
        
        if (duesData.creditBalanceHistory && Array.isArray(duesData.creditBalanceHistory)) {
          results.historyInDues = true;
          console.log(`   ✅ creditBalanceHistory found in dues/${firstDuesDoc.id}`);
          console.log(`      Entries: ${duesData.creditBalanceHistory.length}`);
        } else {
          console.log(`   ⚠️  No creditBalanceHistory in dues/${firstDuesDoc.id}`);
        }
        
        // Check if deprecated creditBalance field exists (should NOT exist in new imports)
        if (duesData.creditBalance !== undefined) {
          console.log(`   ⚠️  DEPRECATED creditBalance field still exists in dues document`);
          console.log(`      (This is OK for existing data, but new imports should NOT create this field)`);
        } else {
          console.log(`   ✅ No deprecated creditBalance field in dues document (correct)`);
        }
      }
    }
    
    // Step 4: Print summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(80));
    console.log(`NEW Structure Exists: ${results.newStructureExists ? '✅ YES' : '❌ NO'}`);
    console.log(`Units with Credit Balances: ${results.allUnitsPresent.length}`);
    console.log(`History in Dues Documents: ${results.historyInDues ? '✅ YES' : '❌ NO'}`);
    console.log(`\nData Integrity:`);
    console.log(`  Total Fields Checked: ${results.totalFieldsChecked}`);
    console.log(`  Clean Integer Fields: ${results.cleanFields}`);
    console.log(`  Contaminated Fields: ${results.contaminatedFields.length}`);
    
    if (results.contaminatedFields.length > 0) {
      console.log(`\n❌ CONTAMINATED FIELDS FOUND:`);
      results.contaminatedFields.forEach(field => {
        console.log(`   ${field.unit}/${field.field}: ${field.value} → should be ${field.expected}`);
      });
    } else {
      console.log(`\n✅ ALL CENTAVOS FIELDS ARE CLEAN INTEGERS!`);
    }
    
    if (results.errors.length > 0) {
      console.log(`\n❌ ERRORS:`);
      results.errors.forEach(error => console.log(`   ${error}`));
    }
    
    console.log('\n' + '='.repeat(80));
    
    // Determine pass/fail
    const passed = results.newStructureExists && 
                   results.allUnitsPresent.length > 0 && 
                   results.contaminatedFields.length === 0 &&
                   results.errors.length === 0;
    
    if (passed) {
      console.log('✅ TEST PASSED: Credit balance import process is working correctly!');
    } else {
      console.log('❌ TEST FAILED: Issues found with credit balance import process');
    }
    console.log('='.repeat(80) + '\n');
    
    return results;
    
  } catch (error) {
    console.error('❌ Test error:', error);
    results.errors.push(error.message);
    return results;
  }
}

// Run the test
verifyCreditBalanceImport()
  .then(() => {
    console.log('✅ Test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });

