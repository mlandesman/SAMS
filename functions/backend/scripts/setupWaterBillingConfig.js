#!/usr/bin/env node

/**
 * Setup Water Billing Configuration for AVII
 * Creates the required config document at /clients/AVII/config/waterBills
 */

import { getDb } from '../firebase.js';
import admin from 'firebase-admin';

async function setupWaterBillingConfig() {
  console.log('💧 Setting up water billing configuration for AVII...\n');
  
  try {
    const db = await getDb();
    
    // Water billing configuration for AVII
    const waterConfig = {
      // Billing rates (stored as integers in cents)
      ratePerM3: 2739,        // $27.39 MXN per cubic meter
      minimumCharge: 0,       // No minimum charge for AVII
      ivaRate: 0,             // No IVA for AVII (0%)
      
      // Penalty configuration  
      penaltyRate: 0.05,      // 5% monthly penalty (as decimal)
      penaltyDays: 10,        // Apply penalty after 10 days late
      compoundPenalty: true,  // Compound penalties monthly
      
      // Billing periods
      billingPeriod: 'monthly',
      readingDay: 1,         // Read meters on 1st of month
      billingDay: 1,         // Generate bills on 1st
      dueDay: 10,            // Due on 10th
      
      // Display configuration
      currency: 'MXN',
      currencySymbol: '$',
      decimalPlaces: 2,
      
      // Features
      allowCreditBalance: true,  // Allow credit balances
      autoApplyCredit: true,     // Automatically apply credits to bills
      emailBills: false,         // Email bills (will be enabled in Phase 5)
      
      // Metadata
      created: admin.firestore.Timestamp.now(),
      updated: admin.firestore.Timestamp.now(),
      createdBy: 'system',
      notes: 'AVII Water Billing Configuration - No minimum charge, No IVA'
    };
    
    // Save configuration
    const configPath = 'clients/AVII/config/waterBills';
    await db.doc(configPath).set(waterConfig);
    
    console.log('✅ Water billing configuration created successfully!');
    console.log(`📍 Path: ${configPath}`);
    console.log('\n📋 Configuration:');
    console.log(`   Rate: $${waterConfig.ratePerM3 / 100} MXN/m³`);
    console.log(`   Minimum: $${waterConfig.minimumCharge / 100} MXN`);
    console.log(`   IVA: ${waterConfig.ivaRate * 100}%`);
    console.log(`   Penalty: ${waterConfig.penaltyRate * 100}% after ${waterConfig.penaltyDays} days`);
    console.log(`   Billing: ${waterConfig.billingPeriod}`);
    console.log(`   Due Day: ${waterConfig.dueDay}th of month`);
    
    // Verify it was saved
    const savedDoc = await db.doc(configPath).get();
    if (savedDoc.exists) {
      console.log('\n✅ Verification: Config document exists in Firestore');
    } else {
      console.error('\n❌ Verification failed: Document not found');
    }
    
  } catch (error) {
    console.error('❌ Error setting up water billing config:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run setup
setupWaterBillingConfig();