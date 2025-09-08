/**
 * Pre-Migration Validation Script for MTC Data
 * 
 * Validates all MTC JSON files before import and identifies issues
 * Implements data quality checks based on Phase 0 findings
 * 
 * Task ID: MTC-MIGRATION-001
 * Date: June 27, 2025
 */

import fs from 'fs/promises';
import path from 'path';
import { 
  linkUsersToUnits, 
  augmentMTCUser, 
  augmentMTCTransaction, 
  augmentMTCUnit,
  validateAugmentedUser,
  validateAugmentedTransaction,
  validateAugmentedUnit
} from './data-augmentation-utils.js';

// MTC data directory
const MTC_DATA_DIR = './MTCdata';

// Validation results
const validationResults = {
  files: {},
  dataQuality: {},
  mapping: {},
  summary: {
    totalErrors: 0,
    totalWarnings: 0,
    readyForImport: false
  }
};

/**
 * Load and validate all MTC JSON files
 */
async function loadMTCData() {
  console.log('📁 Loading MTC data files...\n');
  
  const requiredFiles = [
    'Users.json',
    'Units.json', 
    'UnitSizes.json',
    'Categories.json',
    'Vendors.json',
    'Transactions.json',
    'HOADues.json',
    'AutoCategorize.json'
  ];
  
  const data = {};
  
  for (const filename of requiredFiles) {
    const filePath = path.join(MTC_DATA_DIR, filename);
    
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const jsonData = JSON.parse(fileContent);
      
      data[filename.replace('.json', '')] = jsonData;
      
      console.log(`✅ ${filename}: ${Array.isArray(jsonData) ? jsonData.length : Object.keys(jsonData).length} records`);
      
      validationResults.files[filename] = {
        status: 'loaded',
        recordCount: Array.isArray(jsonData) ? jsonData.length : Object.keys(jsonData).length
      };
      
    } catch (error) {
      console.error(`❌ Failed to load ${filename}:`, error.message);
      validationResults.files[filename] = {
        status: 'error',
        error: error.message
      };
      validationResults.summary.totalErrors++;
    }
  }
  
  return data;
}

/**
 * Validate user data quality
 */
function validateUsers(users) {
  console.log('\n👥 Validating Users data...');
  
  const issues = {
    missingEmail: [],
    missingLastName: [],
    missingUnit: [],
    invalidEmail: [],
    duplicateEmails: []
  };
  
  const emailSet = new Set();
  
  users.forEach((user, index) => {
    // Check required fields
    if (!user.Email) {
      issues.missingEmail.push({ index, user });
    }
    if (!user.LastName) {
      issues.missingLastName.push({ index, user });
    }
    if (!user.Unit) {
      issues.missingUnit.push({ index, user });
    }
    
    // Validate email format
    if (user.Email && !user.Email.includes('@')) {
      issues.invalidEmail.push({ index, user });
    }
    
    // Check for duplicates
    if (user.Email) {
      if (emailSet.has(user.Email)) {
        issues.duplicateEmails.push({ index, user });
      }
      emailSet.add(user.Email);
    }
  });
  
  // Report issues
  Object.entries(issues).forEach(([issueType, problemUsers]) => {
    if (problemUsers.length > 0) {
      console.log(`⚠️ ${issueType}: ${problemUsers.length} users`);
      validationResults.summary.totalWarnings += problemUsers.length;
    }
  });
  
  validationResults.dataQuality.users = issues;
  return issues;
}

/**
 * Validate units data quality
 */
function validateUnits(units, unitSizes) {
  console.log('\n🏠 Validating Units data...');
  
  const issues = {
    missingOwner: [],
    missingEmail: [],
    missingDues: [],
    missingPercentOwned: [],
    noSizeData: []
  };
  
  Object.entries(units).forEach(([unitId, unit]) => {
    if (!unit.Owner) {
      issues.missingOwner.push({ unitId, unit });
    }
    if (!unit.eMail) {
      issues.missingEmail.push({ unitId, unit });
    }
    if (typeof unit.Dues !== 'number') {
      issues.missingDues.push({ unitId, unit });
    }
    if (typeof unit['% Owner'] !== 'number') {
      issues.missingPercentOwned.push({ unitId, unit });
    }
    
    // Check if unit has size data
    const hasSize = unitSizes.find(size => size.Condo === unitId);
    if (!hasSize) {
      issues.noSizeData.push({ unitId, unit });
    }
  });
  
  // Report issues
  Object.entries(issues).forEach(([issueType, problemUnits]) => {
    if (problemUnits.length > 0) {
      console.log(`⚠️ ${issueType}: ${problemUnits.length} units`);
      validationResults.summary.totalWarnings += problemUnits.length;
    }
  });
  
  validationResults.dataQuality.units = issues;
  return issues;
}

/**
 * Validate transactions data quality
 */
function validateTransactions(transactions) {
  console.log('\n💰 Validating Transactions data...');
  
  const issues = {
    missingAmount: [],
    invalidAmount: [],
    missingAccount: [],
    unknownAccount: [],
    missingDate: [],
    invalidDate: []
  };
  
  const knownAccounts = ['MTC Bank', 'Cash Account'];
  
  transactions.forEach((txn, index) => {
    // Check amount
    if (txn.Amount === undefined || txn.Amount === null) {
      issues.missingAmount.push({ index, txn });
    } else if (typeof txn.Amount !== 'number' && isNaN(parseFloat(txn.Amount))) {
      issues.invalidAmount.push({ index, txn });
    }
    
    // Check account
    if (!txn.Account) {
      issues.missingAccount.push({ index, txn });
    } else if (!knownAccounts.includes(txn.Account)) {
      issues.unknownAccount.push({ index, txn });
    }
    
    // Check date
    if (!txn.Date) {
      issues.missingDate.push({ index, txn });
    } else if (isNaN(new Date(txn.Date).getTime())) {
      issues.invalidDate.push({ index, txn });
    }
  });
  
  // Report issues
  Object.entries(issues).forEach(([issueType, problemTxns]) => {
    if (problemTxns.length > 0) {
      console.log(`${issueType.includes('missing') || issueType.includes('invalid') ? '❌' : '⚠️'} ${issueType}: ${problemTxns.length} transactions`);
      if (issueType.includes('missing') || issueType.includes('invalid')) {
        validationResults.summary.totalErrors += problemTxns.length;
      } else {
        validationResults.summary.totalWarnings += problemTxns.length;
      }
    }
  });
  
  validationResults.dataQuality.transactions = issues;
  return issues;
}

/**
 * Test user-unit mapping
 */
function validateUserUnitMapping(users, units) {
  console.log('\n🔗 Validating User-Unit mapping...');
  
  const mappingResult = linkUsersToUnits(users, units);
  
  console.log(`✅ Successfully linked: ${mappingResult.stats.matched} users`);
  
  if (mappingResult.unmatchedUsers.length > 0) {
    console.log(`⚠️ Unmatched users: ${mappingResult.unmatchedUsers.length}`);
    mappingResult.unmatchedUsers.forEach(user => {
      console.log(`   - ${user.LastName} (${user.Email})`);
    });
    validationResults.summary.totalWarnings += mappingResult.unmatchedUsers.length;
  }
  
  if (mappingResult.unmatchedUnits.length > 0) {
    console.log(`⚠️ Unmatched units: ${mappingResult.unmatchedUnits.length}`);
    mappingResult.unmatchedUnits.forEach(unit => {
      console.log(`   - ${unit.unitId}: ${unit.Owner}`);
    });
    validationResults.summary.totalWarnings += mappingResult.unmatchedUnits.length;
  }
  
  validationResults.mapping.userUnit = mappingResult;
  return mappingResult;
}

/**
 * Test data augmentation
 */
function validateDataAugmentation(mappingResult, transactions, units, unitSizes) {
  console.log('\n🔧 Testing data augmentation...');
  
  let augmentationErrors = 0;
  
  // Test user augmentation
  const testUserMappings = Object.values(mappingResult.userUnitMap).slice(0, 3);
  testUserMappings.forEach((mapping, index) => {
    try {
      const augmentedUser = augmentMTCUser(mapping);
      const validation = validateAugmentedUser(augmentedUser);
      
      if (!validation.isValid) {
        console.log(`❌ User augmentation failed for ${mapping.email}:`, validation.errors);
        augmentationErrors++;
      }
    } catch (error) {
      console.log(`❌ User augmentation error for ${mapping.email}:`, error.message);
      augmentationErrors++;
    }
  });
  
  // Test transaction augmentation
  const testTransactions = transactions.slice(0, 5);
  testTransactions.forEach((txn, index) => {
    try {
      const augmentedTxn = augmentMTCTransaction(txn);
      const validation = validateAugmentedTransaction(augmentedTxn);
      
      if (!validation.isValid) {
        console.log(`❌ Transaction augmentation failed:`, validation.errors);
        augmentationErrors++;
      }
    } catch (error) {
      console.log(`❌ Transaction augmentation error:`, error.message);
      augmentationErrors++;
    }
  });
  
  // Test unit augmentation
  const testUnits = Object.entries(units).slice(0, 3);
  testUnits.forEach(([unitId, unitData]) => {
    try {
      const sizeData = unitSizes.find(size => size.Condo === unitId);
      const augmentedUnit = augmentMTCUnit(unitId, unitData, sizeData);
      const validation = validateAugmentedUnit(augmentedUnit);
      
      if (!validation.isValid) {
        console.log(`❌ Unit augmentation failed for ${unitId}:`, validation.errors);
        augmentationErrors++;
      }
    } catch (error) {
      console.log(`❌ Unit augmentation error for ${unitId}:`, error.message);
      augmentationErrors++;
    }
  });
  
  if (augmentationErrors === 0) {
    console.log('✅ All augmentation tests passed');
  } else {
    console.log(`❌ ${augmentationErrors} augmentation errors found`);
    validationResults.summary.totalErrors += augmentationErrors;
  }
  
  return augmentationErrors;
}

/**
 * Generate validation report
 */
function generateValidationReport() {
  console.log('\n' + '='.repeat(80));
  console.log('📋 PRE-MIGRATION VALIDATION REPORT');
  console.log('='.repeat(80));
  
  // File loading status
  console.log('\n📁 FILE LOADING STATUS:');
  Object.entries(validationResults.files).forEach(([filename, result]) => {
    const status = result.status === 'loaded' ? '✅' : '❌';
    console.log(`${status} ${filename}: ${result.status} (${result.recordCount || 0} records)`);
  });
  
  // Data quality summary
  console.log('\n📊 DATA QUALITY SUMMARY:');
  console.log(`Total Errors: ${validationResults.summary.totalErrors}`);
  console.log(`Total Warnings: ${validationResults.summary.totalWarnings}`);
  
  // Mapping summary
  if (validationResults.mapping.userUnit) {
    const mapping = validationResults.mapping.userUnit;
    console.log('\n🔗 USER-UNIT MAPPING:');
    console.log(`Total Users: ${mapping.stats.totalUsers}`);
    console.log(`Total Units: ${mapping.stats.totalUnits}`);
    console.log(`Successfully Linked: ${mapping.stats.matched}`);
    console.log(`Unmatched Users: ${mapping.stats.unmatchedUsers}`);
    console.log(`Unmatched Units: ${mapping.stats.unmatchedUnits}`);
  }
  
  // Ready for import assessment
  const readyForImport = validationResults.summary.totalErrors === 0;
  validationResults.summary.readyForImport = readyForImport;
  
  console.log('\n🚦 MIGRATION READINESS:');
  if (readyForImport) {
    console.log('✅ READY FOR IMPORT - No critical errors found');
    if (validationResults.summary.totalWarnings > 0) {
      console.log(`⚠️ Note: ${validationResults.summary.totalWarnings} warnings found (non-blocking)`);
    }
  } else {
    console.log('❌ NOT READY FOR IMPORT - Critical errors must be resolved');
    console.log(`Errors to fix: ${validationResults.summary.totalErrors}`);
  }
  
  // Recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  if (validationResults.summary.totalErrors > 0) {
    console.log('1. Fix all critical errors before proceeding');
    console.log('2. Review data quality issues in source files');
    console.log('3. Re-run validation after fixes');
  } else {
    console.log('1. Proceed with backup creation');
    console.log('2. Execute database purge');
    console.log('3. Begin import process');
  }
  
  console.log('\n' + '='.repeat(80));
  
  return validationResults;
}

/**
 * Main validation function
 */
async function main() {
  try {
    console.log('🚀 Starting Pre-Migration Validation for MTC Data...\n');
    
    // Load all data files
    const data = await loadMTCData();
    
    if (Object.keys(data).length === 0) {
      console.error('❌ No data files loaded successfully');
      process.exit(1);
    }
    
    // Validate individual data types
    if (data.Users) {
      validateUsers(data.Users);
    }
    
    if (data.Units && data.UnitSizes) {
      validateUnits(data.Units, data.UnitSizes);
    }
    
    if (data.Transactions) {
      validateTransactions(data.Transactions);
    }
    
    // Validate cross-data relationships
    if (data.Users && data.Units) {
      const mappingResult = validateUserUnitMapping(data.Users, data.Units);
      
      // Test augmentation with sample data
      if (data.Transactions) {
        validateDataAugmentation(mappingResult, data.Transactions, data.Units, data.UnitSizes);
      }
    }
    
    // Generate final report
    const finalResults = generateValidationReport();
    
    // Save results to file
    await fs.writeFile(
      './validation-results.json',
      JSON.stringify(finalResults, null, 2)
    );
    console.log('\n💾 Validation results saved to validation-results.json');
    
    // Exit with appropriate code
    process.exit(finalResults.summary.readyForImport ? 0 : 1);
    
  } catch (error) {
    console.error('💥 Validation failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { validateUsers, validateUnits, validateTransactions, validateUserUnitMapping, generateValidationReport };