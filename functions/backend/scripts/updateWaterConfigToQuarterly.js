#!/usr/bin/env node

/**
 * Update Water Billing Configuration for AVII to Quarterly Billing
 * Updates /clients/AVII/config/waterBills with quarterly settings
 */

import { getDb } from '../firebase.js';
import admin from 'firebase-admin';

async function updateWaterConfigToQuarterly() {
  console.log('💧 Updating AVII water billing configuration to quarterly...\n');
  
  try {
    const db = await getDb();
    
    // Read existing config
    const configPath = 'clients/AVII/config/waterBills';
    const configRef = db.doc(configPath);
    const configDoc = await configRef.get();
    
    if (!configDoc.exists) {
      console.error('❌ Config document not found at:', configPath);
      console.log('   Run setupWaterBillingConfig.js first to create the config');
      process.exit(1);
    }
    
    const existingConfig = configDoc.data();
    console.log('📋 Current Configuration:');
    console.log(`   billingPeriod: ${existingConfig.billingPeriod}`);
    console.log(`   penaltyDays: ${existingConfig.penaltyDays}`);
    console.log(`   penaltyRate: ${existingConfig.penaltyRate}`);
    console.log(`   compoundPenalty: ${existingConfig.compoundPenalty}`);
    console.log('');
    
    // Updates for quarterly billing
    const updates = {
      billingPeriod: 'quarterly',  // Changed from 'monthly'
      penaltyDays: 30,             // Changed from 10 (more time for larger bill)
      penaltyRate: 0.05,           // Keep 5% monthly
      compoundPenalty: true,       // Keep compounding
      updated: admin.firestore.Timestamp.now(),
      updatedBy: 'quarterlyMigration',
      notes: 'AVII Water Billing Configuration - Quarterly billing (in arrears), 30-day grace period'
    };
    
    // Update configuration
    await configRef.update(updates);
    
    console.log('✅ Configuration updated successfully!');
    console.log(`📍 Path: ${configPath}`);
    console.log('\n📋 New Configuration:');
    console.log(`   billingPeriod: ${updates.billingPeriod}`);
    console.log(`   penaltyDays: ${updates.penaltyDays}`);
    console.log(`   penaltyRate: ${updates.penaltyRate}`);
    console.log(`   compoundPenalty: ${updates.compoundPenalty}`);
    console.log('');
    console.log('🎯 Next Steps:');
    console.log('   1. Verify penalty recalculation service works with quarterly bills');
    console.log('   2. Test generating first quarterly bill with: POST /water/clients/AVII/bills/generate');
    console.log('      Body: { year: 2026, dueDate: "2025-10-01" }');
    console.log('   3. Update frontend History tab to display quarterly bills');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error updating configuration:', error);
    throw error;
  }
}

// Run the update
updateWaterConfigToQuarterly()
  .then(() => {
    console.log('✅ Update complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Update failed:', error);
    process.exit(1);
  });

