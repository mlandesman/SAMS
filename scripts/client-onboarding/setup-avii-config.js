#!/usr/bin/env node

/**
 * Setup AVII Client Configuration for Quarterly Billing
 * 
 * This script configures the AVII client for quarterly billing:
 * - Sets duesFrequency to 'quarterly' for HOA Dues
 * - Sets billingPeriod to 'quarterly' for Water Bills
 * - Configures fiscal year (July 1 - June 30)
 * - Sets appropriate penalty grace periods (30 days for quarterly)
 * 
 * Run this script AFTER creating the AVII client but BEFORE importing data
 * 
 * Usage:
 *   node scripts/client-onboarding/setup-avii-config.js
 * 
 * Environment:
 *   FIRESTORE_ENV=dev|staging|prod (default: dev)
 */

import { initializeFirebase, printEnvironmentInfo } from './utils/environment-config.js';
import { getCurrentTimestamp } from './utils/timestamp-converter.js';
import { AVII_IMPORT_CONFIG } from './config/avii-import-config.js';

const CLIENT_ID = 'AVII';
const ENV = process.env.FIRESTORE_ENV || 'dev';

/**
 * Update client document with quarterly billing configuration
 */
async function updateClientDocument(db) {
  console.log('📝 Updating AVII client document...');
  
  const clientRef = db.collection('clients').doc(CLIENT_ID);
  const clientDoc = await clientRef.get();
  
  if (!clientDoc.exists) {
    throw new Error(`Client ${CLIENT_ID} does not exist. Create the client first.`);
  }
  
  // Update client document with quarterly configuration
  await clientRef.update({
    'feeStructure.duesFrequency': AVII_IMPORT_CONFIG.billingFrequency.hoaDues,
    'configuration.fiscalYearStartMonth': AVII_IMPORT_CONFIG.fiscalYear.startMonth,
    'configuration.timezone': AVII_IMPORT_CONFIG.timezone,
    updatedAt: getCurrentTimestamp(),
    updatedBy: 'setup-avii-config-script'
  });
  
  console.log('✅ Client document updated');
  console.log(`   duesFrequency: ${AVII_IMPORT_CONFIG.billingFrequency.hoaDues}`);
  console.log(`   fiscalYearStartMonth: ${AVII_IMPORT_CONFIG.fiscalYear.startMonth} (July)`);
  console.log(`   timezone: ${AVII_IMPORT_CONFIG.timezone}`);
}

/**
 * Setup HOA Dues configuration
 */
async function setupHOADuesConfig(db) {
  console.log('\n📋 Setting up HOA Dues configuration...');
  
  const configRef = db.collection(`clients/${CLIENT_ID}/config`).doc('hoaDues');
  
  // Check if config already exists
  const existingDoc = await configRef.get();
  const action = existingDoc.exists ? 'updated' : 'created';
  
  const hoaConfig = {
    ...AVII_IMPORT_CONFIG.hoaDuesConfig,
    fiscalYearStartMonth: AVII_IMPORT_CONFIG.fiscalYear.startMonth,
    updatedAt: getCurrentTimestamp(),
    updatedBy: 'setup-avii-config-script'
  };
  
  await configRef.set(hoaConfig, { merge: true });
  
  console.log(`✅ HOA Dues configuration ${action}`);
  console.log(`   Path: clients/${CLIENT_ID}/config/hoaDues`);
  console.log(`   duesFrequency: ${hoaConfig.duesFrequency}`);
  console.log(`   penaltyDays: ${hoaConfig.penaltyDays}`);
  console.log(`   penaltyRate: ${hoaConfig.penaltyRate * 100}%`);
  console.log(`   compoundPenalty: ${hoaConfig.compoundPenalty}`);
}

/**
 * Setup Water Bills configuration
 */
async function setupWaterBillsConfig(db) {
  console.log('\n💧 Setting up Water Bills configuration...');
  
  const configRef = db.collection(`clients/${CLIENT_ID}/config`).doc('waterBills');
  
  // Check if config already exists
  const existingDoc = await configRef.get();
  const action = existingDoc.exists ? 'updated' : 'created';
  
  const waterConfig = {
    ...AVII_IMPORT_CONFIG.waterBillsConfig,
    fiscalYearStartMonth: AVII_IMPORT_CONFIG.fiscalYear.startMonth,
    updatedAt: getCurrentTimestamp(),
    updatedBy: 'setup-avii-config-script',
    notes: 'AVII Water Billing Configuration - Quarterly billing (in arrears), 30-day grace period'
  };
  
  await configRef.set(waterConfig, { merge: true });
  
  console.log(`✅ Water Bills configuration ${action}`);
  console.log(`   Path: clients/${CLIENT_ID}/config/waterBills`);
  console.log(`   billingPeriod: ${waterConfig.billingPeriod}`);
  console.log(`   penaltyDays: ${waterConfig.penaltyDays}`);
  console.log(`   penaltyRate: ${waterConfig.penaltyRate * 100}%`);
  console.log(`   compoundPenalty: ${waterConfig.compoundPenalty}`);
}

/**
 * Main setup function
 */
async function setupAVIIConfig() {
  console.log('🚀 AVII Quarterly Billing Configuration Setup\n');
  console.log(`Client: ${CLIENT_ID}`);
  console.log(`Environment: ${ENV}\n`);
  
  // Print environment information
  printEnvironmentInfo(ENV);
  
  try {
    // Initialize Firebase
    const { db } = await initializeFirebase(ENV);
    console.log('✅ Connected to Firestore\n');
    
    // Run configuration updates
    await updateClientDocument(db);
    await setupHOADuesConfig(db);
    await setupWaterBillsConfig(db);
    
    // Success message
    console.log('\n✨ AVII quarterly billing configuration complete!');
    console.log('\n📍 Configuration Summary:');
    console.log('   ✅ Client document updated with quarterly billing flags');
    console.log(`   ✅ HOA Dues config: clients/${CLIENT_ID}/config/hoaDues`);
    console.log(`   ✅ Water Bills config: clients/${CLIENT_ID}/config/waterBills`);
    
    console.log('\n🎯 Next Steps:');
    console.log('   1. Verify configuration: node scripts/client-onboarding/validate-avii-quarterly.js');
    console.log('   2. Import client data (HOA dues, water readings, etc.)');
    console.log('   3. Generate quarterly water bills: node backend/scripts/generateWaterQ1Bills.js');
    console.log('   4. Test HOA dues display in UI (should show quarterly grouping)');
    
  } catch (error) {
    console.error('\n❌ Error setting up AVII configuration:', error);
    console.error('   Message:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the setup
setupAVIIConfig();
