/**
 * Simple Data Validation for MTC Import
 * Focuses on data quality without Firebase connectivity
 */

import fs from 'fs/promises';
import { linkUsersToUnits } from './data-augmentation-utils.js';

async function validateMTCData() {
  console.log('🧪 Starting MTC Data Validation...\n');
  
  const results = {
    files: {},
    validation: {},
    readyForImport: false
  };
  
  try {
    // Load all data files
    console.log('📁 Loading MTC data files...');
    
    const users = JSON.parse(await fs.readFile('./MTCdata/Users.json', 'utf-8'));
    const units = JSON.parse(await fs.readFile('./MTCdata/Units.json', 'utf-8'));
    const unitSizes = JSON.parse(await fs.readFile('./MTCdata/UnitSizes.json', 'utf-8'));
    const categories = JSON.parse(await fs.readFile('./MTCdata/Categories.json', 'utf-8'));
    const vendors = JSON.parse(await fs.readFile('./MTCdata/Vendors.json', 'utf-8'));
    const transactions = JSON.parse(await fs.readFile('./MTCdata/Transactions.json', 'utf-8'));
    const hoaDues = JSON.parse(await fs.readFile('./MTCdata/HOADues.json', 'utf-8'));
    
    results.files = {
      users: users.length,
      units: Object.keys(units).length,
      unitSizes: unitSizes.length,
      categories: categories.length,
      vendors: vendors.length,
      transactions: transactions.length,
      hoaDues: Object.keys(hoaDues).length
    };
    
    console.log('✅ All files loaded successfully:');
    Object.entries(results.files).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} records`);
    });
    
    // Validate Users
    console.log('\n👥 Validating Users...');
    const userIssues = [];
    users.forEach((user, index) => {
      if (!user.Email) userIssues.push(`User ${index}: Missing email`);
      if (!user.LastName) userIssues.push(`User ${index}: Missing LastName`);
      if (!user.Unit) userIssues.push(`User ${index}: Missing Unit`);
    });
    
    results.validation.users = {
      totalUsers: users.length,
      issues: userIssues,
      valid: userIssues.length === 0
    };
    
    if (userIssues.length === 0) {
      console.log('✅ All users have required fields');
    } else {
      console.log(`⚠️ ${userIssues.length} user validation issues found`);
    }
    
    // Validate Units
    console.log('\n🏠 Validating Units...');
    const unitIssues = [];
    Object.entries(units).forEach(([unitId, unit]) => {
      if (!unit.Owner) unitIssues.push(`Unit ${unitId}: Missing Owner`);
      if (!unit.eMail) unitIssues.push(`Unit ${unitId}: Missing eMail`);
      if (typeof unit.Dues !== 'number') unitIssues.push(`Unit ${unitId}: Invalid Dues`);
    });
    
    results.validation.units = {
      totalUnits: Object.keys(units).length,
      issues: unitIssues,
      valid: unitIssues.length === 0
    };
    
    if (unitIssues.length === 0) {
      console.log('✅ All units have required fields');
    } else {
      console.log(`⚠️ ${unitIssues.length} unit validation issues found`);
    }
    
    // Validate Transactions
    console.log('\n💰 Validating Transactions...');
    const txnIssues = [];
    const knownAccounts = ['MTC Bank', 'Cash Account'];
    
    transactions.forEach((txn, index) => {
      if (typeof txn.Amount !== 'number') txnIssues.push(`Transaction ${index}: Invalid Amount`);
      if (!txn.Account) txnIssues.push(`Transaction ${index}: Missing Account`);
      else if (!knownAccounts.includes(txn.Account)) {
        txnIssues.push(`Transaction ${index}: Unknown Account "${txn.Account}"`);
      }
    });
    
    results.validation.transactions = {
      totalTransactions: transactions.length,
      issues: txnIssues,
      valid: txnIssues.length === 0
    };
    
    if (txnIssues.length === 0) {
      console.log('✅ All transactions are valid');
    } else {
      console.log(`⚠️ ${txnIssues.length} transaction validation issues found`);
    }
    
    // Test User-Unit Mapping
    console.log('\n🔗 Testing User-Unit Mapping...');
    const mappingResult = linkUsersToUnits(users, units);
    
    results.validation.mapping = {
      totalUsers: mappingResult.stats.totalUsers,
      totalUnits: mappingResult.stats.totalUnits,
      successfullyLinked: mappingResult.stats.matched,
      unmatchedUsers: mappingResult.stats.unmatchedUsers,
      unmatchedUnits: mappingResult.stats.unmatchedUnits,
      valid: mappingResult.stats.unmatchedUsers === 0
    };
    
    console.log(`✅ Successfully linked: ${mappingResult.stats.matched} users`);
    if (mappingResult.stats.unmatchedUsers > 0) {
      console.log(`⚠️ Unmatched users: ${mappingResult.stats.unmatchedUsers}`);
    }
    if (mappingResult.stats.unmatchedUnits > 0) {
      console.log(`⚠️ Unmatched units: ${mappingResult.stats.unmatchedUnits}`);
    }
    
    // Overall Assessment
    const allValid = results.validation.users.valid && 
                    results.validation.units.valid && 
                    results.validation.transactions.valid &&
                    results.validation.mapping.valid;
    
    results.readyForImport = allValid;
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 VALIDATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`👥 Users: ${results.validation.users.valid ? '✅ Valid' : '❌ Issues'}`);
    console.log(`🏠 Units: ${results.validation.units.valid ? '✅ Valid' : '❌ Issues'}`);
    console.log(`💰 Transactions: ${results.validation.transactions.valid ? '✅ Valid' : '❌ Issues'}`);
    console.log(`🔗 User-Unit Mapping: ${results.validation.mapping.valid ? '✅ Valid' : '❌ Issues'}`);
    console.log('');
    console.log(`🚦 READY FOR IMPORT: ${results.readyForImport ? '✅ YES' : '❌ NO'}`);
    
    if (results.readyForImport) {
      console.log('\n✅ All validation checks passed!');
      console.log('🚀 Data is ready for import');
    } else {
      console.log('\n❌ Validation issues found');
      console.log('🔧 Review and fix issues before importing');
    }
    
    console.log('='.repeat(60));
    
    return results;
    
  } catch (error) {
    console.error('💥 Validation failed:', error);
    throw error;
  }
}

validateMTCData()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });