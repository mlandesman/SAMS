#!/usr/bin/env node

/**
 * Validate AVII Quarterly Billing Configuration
 * 
 * This script verifies that AVII is properly configured for quarterly billing.
 * It checks:
 * - Client document has duesFrequency: 'quarterly'
 * - Client document has correct fiscalYearStartMonth (7 for July)
 * - HOA Dues config exists and has correct settings
 * - Water Bills config exists and has billingPeriod: 'quarterly'
 * 
 * Usage:
 *   node scripts/client-onboarding/validate-avii-quarterly.js
 * 
 * Environment:
 *   FIRESTORE_ENV=dev|staging|prod (default: dev)
 */

import { initializeFirebase, printEnvironmentInfo } from './utils/environment-config.js';
import { AVII_IMPORT_CONFIG } from './config/avii-import-config.js';

const CLIENT_ID = 'AVII';
const ENV = process.env.FIRESTORE_ENV || 'dev';

/**
 * Validation check result
 */
class ValidationCheck {
  constructor(name, path, expected, actual) {
    this.name = name;
    this.path = path;
    this.expected = expected;
    this.actual = actual;
    this.passed = this._compare(expected, actual);
  }
  
  _compare(expected, actual) {
    if (typeof expected === 'object' && expected !== null) {
      return JSON.stringify(expected) === JSON.stringify(actual);
    }
    return expected === actual;
  }
  
  print() {
    const icon = this.passed ? '✅' : '❌';
    const status = this.passed ? 'PASS' : 'FAIL';
    
    console.log(`${icon} ${this.name} - ${status}`);
    console.log(`   Path: ${this.path}`);
    console.log(`   Expected: ${JSON.stringify(this.expected)}`);
    console.log(`   Actual: ${JSON.stringify(this.actual)}`);
    
    if (!this.passed) {
      console.log(`   ⚠️  Fix needed: Update this field to match expected value`);
    }
    console.log('');
  }
}

/**
 * Validate client document configuration
 */
async function validateClientDocument(db) {
  console.log('📋 Validating client document configuration...\n');
  
  const clientDoc = await db.collection('clients').doc(CLIENT_ID).get();
  
  if (!clientDoc.exists) {
    throw new Error(`Client ${CLIENT_ID} does not exist`);
  }
  
  const clientData = clientDoc.data();
  const checks = [];
  
  // Check duesFrequency
  checks.push(new ValidationCheck(
    'HOA Dues Frequency',
    'clients/AVII/feeStructure.duesFrequency',
    'quarterly',
    clientData.feeStructure?.duesFrequency
  ));
  
  // Fallback check for duesFrequency in configuration
  if (!clientData.feeStructure?.duesFrequency) {
    checks.push(new ValidationCheck(
      'HOA Dues Frequency (fallback)',
      'clients/AVII/configuration.duesFrequency',
      'quarterly',
      clientData.configuration?.duesFrequency
    ));
  }
  
  // Check fiscal year start month
  checks.push(new ValidationCheck(
    'Fiscal Year Start Month',
    'clients/AVII/configuration.fiscalYearStartMonth',
    7,
    clientData.configuration?.fiscalYearStartMonth
  ));
  
  // Check timezone
  checks.push(new ValidationCheck(
    'Timezone',
    'clients/AVII/configuration.timezone',
    'America/Cancun',
    clientData.configuration?.timezone
  ));
  
  return checks;
}

/**
 * Validate HOA Dues configuration
 */
async function validateHOADuesConfig(db) {
  console.log('🏠 Validating HOA Dues configuration...\n');
  
  const configDoc = await db.collection(`clients/${CLIENT_ID}/config`).doc('hoaDues').get();
  const checks = [];
  
  if (!configDoc.exists) {
    checks.push(new ValidationCheck(
      'HOA Dues Config Exists',
      `clients/${CLIENT_ID}/config/hoaDues`,
      'exists',
      'not found'
    ));
    return checks;
  }
  
  const configData = configDoc.data();
  
  // Check penalty days (should be 30 for quarterly)
  checks.push(new ValidationCheck(
    'HOA Penalty Grace Period',
    `clients/${CLIENT_ID}/config/hoaDues.penaltyDays`,
    30,
    configData.penaltyDays
  ));
  
  // Check penalty rate
  checks.push(new ValidationCheck(
    'HOA Penalty Rate',
    `clients/${CLIENT_ID}/config/hoaDues.penaltyRate`,
    0.05,
    configData.penaltyRate
  ));
  
  // Check compound penalty
  checks.push(new ValidationCheck(
    'HOA Compound Penalty',
    `clients/${CLIENT_ID}/config/hoaDues.compoundPenalty`,
    true,
    configData.compoundPenalty
  ));
  
  return checks;
}

/**
 * Validate Water Bills configuration
 */
async function validateWaterBillsConfig(db) {
  console.log('💧 Validating Water Bills configuration...\n');
  
  const configDoc = await db.collection(`clients/${CLIENT_ID}/config`).doc('waterBills').get();
  const checks = [];
  
  if (!configDoc.exists) {
    checks.push(new ValidationCheck(
      'Water Bills Config Exists',
      `clients/${CLIENT_ID}/config/waterBills`,
      'exists',
      'not found'
    ));
    return checks;
  }
  
  const configData = configDoc.data();
  
  // Check billing period (key setting for quarterly)
  checks.push(new ValidationCheck(
    'Water Bills Billing Period',
    `clients/${CLIENT_ID}/config/waterBills.billingPeriod`,
    'quarterly',
    configData.billingPeriod
  ));
  
  // Check penalty days (should be 30 for quarterly)
  checks.push(new ValidationCheck(
    'Water Penalty Grace Period',
    `clients/${CLIENT_ID}/config/waterBills.penaltyDays`,
    30,
    configData.penaltyDays
  ));
  
  // Check penalty rate
  checks.push(new ValidationCheck(
    'Water Penalty Rate',
    `clients/${CLIENT_ID}/config/waterBills.penaltyRate`,
    0.05,
    configData.penaltyRate
  ));
  
  // Check compound penalty
  checks.push(new ValidationCheck(
    'Water Compound Penalty',
    `clients/${CLIENT_ID}/config/waterBills.compoundPenalty`,
    true,
    configData.compoundPenalty
  ));
  
  return checks;
}

/**
 * Main validation function
 */
async function validateAVIIQuarterly() {
  console.log('🔍 AVII Quarterly Billing Configuration Validator\n');
  console.log(`Client: ${CLIENT_ID}`);
  console.log(`Environment: ${ENV}\n`);
  
  // Print environment information
  printEnvironmentInfo(ENV);
  
  try {
    // Initialize Firebase
    const { db } = await initializeFirebase(ENV);
    console.log('✅ Connected to Firestore\n');
    console.log('═'.repeat(60));
    console.log('\n');
    
    // Run all validations
    const allChecks = [
      ...(await validateClientDocument(db)),
      ...(await validateHOADuesConfig(db)),
      ...(await validateWaterBillsConfig(db))
    ];
    
    // Print all results
    console.log('═'.repeat(60));
    console.log('\n📊 VALIDATION RESULTS\n');
    console.log('═'.repeat(60));
    console.log('');
    
    allChecks.forEach(check => check.print());
    
    // Summary
    const passed = allChecks.filter(c => c.passed).length;
    const failed = allChecks.filter(c => !c.passed).length;
    const total = allChecks.length;
    
    console.log('═'.repeat(60));
    console.log('\n📈 SUMMARY\n');
    console.log(`   Total Checks: ${total}`);
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log('');
    
    if (failed === 0) {
      console.log('🎉 All validation checks passed!');
      console.log('✅ AVII is properly configured for quarterly billing');
      console.log('');
      console.log('🎯 Next Steps:');
      console.log('   - Import client data (if not already done)');
      console.log('   - Generate quarterly water bills');
      console.log('   - Test HOA dues display in UI');
    } else {
      console.log('⚠️  Some validation checks failed');
      console.log('');
      console.log('🔧 To fix issues:');
      console.log('   Run: node scripts/client-onboarding/setup-avii-config.js');
      console.log('   Then re-run this validation script');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Validation error:', error);
    console.error('   Message:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the validation
validateAVIIQuarterly();
