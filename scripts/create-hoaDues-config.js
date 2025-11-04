#!/usr/bin/env node
/**
 * Create hoaDues config document for AVII
 * One-time script to manually create the hoaDues config if import didn't catch it
 */

import { getDb } from '../backend/firebase.js';
import { getNow } from '../backend/services/DateService.js';

async function createHoaDuesConfig() {
  try {
    const clientId = 'AVII';
    
    console.log(`📝 Creating hoaDues config for ${clientId}...`);
    
    const db = await getDb();
    const configRef = db.collection(`clients/${clientId}/config`).doc('hoaDues');
    
    // Check if it already exists
    const existing = await configRef.get();
    if (existing.exists) {
      console.log(`⚠️  hoaDues config already exists for ${clientId}`);
      console.log('Current data:', existing.data());
      process.exit(0);
    }
    
    // Create the config
    const hoaDuesConfig = {
      _id: 'hoaDues',
      dueDay: 1,
      penaltyDays: 30,
      penaltyRate: 0.05,
      updatedAt: getNow().toISOString(),
      updatedBy: 'manual-script'
    };
    
    await configRef.set(hoaDuesConfig);
    
    console.log(`✅ Created hoaDues config for ${clientId}`);
    console.log('Data:', hoaDuesConfig);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createHoaDuesConfig();

