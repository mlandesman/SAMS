// Script to create propane configuration document for MTC
// Run with: node backend/scripts/createPropaneConfig.js

import { initializeFirebase, getDb } from '../firebase.js';

const PROPANE_CONFIG = {
  enabled: true,
  units: [
    { id: '1A', tankSizeLiters: 120 },
    { id: '1B', tankSizeLiters: 120 },
    { id: '1C', tankSizeLiters: 120 },
    { id: '2A', tankSizeLiters: 120 },
    { id: '2C', tankSizeLiters: 120 },
    { id: 'PH1A', tankSizeLiters: 120 },
    { id: 'PH2B', tankSizeLiters: 120 },
    { id: 'PH3C', tankSizeLiters: 120 },
    { id: 'PH4D', tankSizeLiters: 120 }
  ],
  workerRouteOrder: ['1A', '1B', '1C', '2A', '2C', 'PH1A', 'PH2B', 'PH3C', 'PH4D'],
  thresholds: {
    critical: 10,    // Red: 0-10%
    low: 30          // Amber: 10-30%, Green: 30-100%
  },
  fiscalYearStart: 1  // January (MTC fiscal year)
};

async function createConfig() {
  try {
    await initializeFirebase();
    const db = await getDb();
    
    const clientId = 'MTC';
    const configRef = db
      .collection('clients').doc(clientId)
      .collection('config').doc('propaneTanks');
    
    await configRef.set(PROPANE_CONFIG);
    
    console.log('✅ Propane configuration created successfully for', clientId);
    console.log('📋 Config:', JSON.stringify(PROPANE_CONFIG, null, 2));
  } catch (error) {
    console.error('❌ Error creating propane config:', error);
    process.exit(1);
  }
}

createConfig();
