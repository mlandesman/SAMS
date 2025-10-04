#!/usr/bin/env node

/**
 * Debug Import - Check what's happening with the import scripts
 */

import { initializeImport } from './import-config.js';
import fs from 'fs/promises';
import path from 'path';

const CLIENT_ID = 'MTC';
const dataPath = '/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/MTCdata';

async function debugImport() {
  console.log('\n=== Debug Import Process ===\n');
  
  try {
    // Initialize
    const { db, dateService } = await initializeImport(CLIENT_ID);
    
    // Load Units.json
    console.log('\n1. Loading Units.json...');
    const unitsFile = path.join(dataPath, 'Units.json');
    const unitsData = JSON.parse(await fs.readFile(unitsFile, 'utf-8'));
    console.log('   Units data type:', Array.isArray(unitsData) ? 'Array' : 'Object');
    console.log('   Units count:', Array.isArray(unitsData) ? unitsData.length : Object.keys(unitsData).length);
    
    if (!Array.isArray(unitsData)) {
      console.log('   Sample unit keys:', Object.keys(unitsData).slice(0, 5));
    }
    
    // Load Transactions.json  
    console.log('\n2. Loading Transactions.json...');
    const transFile = path.join(dataPath, 'Transactions.json');
    const transData = JSON.parse(await fs.readFile(transFile, 'utf-8'));
    console.log('   Transactions count:', transData.length);
    console.log('   Sample transaction:', transData[0]);
    
    // Load HOADues.json
    console.log('\n3. Loading HOADues.json...');
    const hoaFile = path.join(dataPath, 'HOADues.json');
    const hoaData = JSON.parse(await fs.readFile(hoaFile, 'utf-8'));
    console.log('   HOA data type:', Array.isArray(hoaData) ? 'Array' : 'Object');
    console.log('   HOA units:', Object.keys(hoaData).length);
    console.log('   Sample HOA unit:', Object.keys(hoaData)[0], hoaData[Object.keys(hoaData)[0]]);
    
    // Check what's in Firebase
    console.log('\n4. Checking Firebase...');
    
    // Check if MTC client exists
    const clientDoc = await db.collection('clients').doc(CLIENT_ID).get();
    console.log('   MTC client exists:', clientDoc.exists);
    
    // Check units collection
    const unitsSnapshot = await db.collection('units')
      .where('clientId', '==', CLIENT_ID)
      .limit(5)
      .get();
    console.log('   Units in Firebase:', unitsSnapshot.size);
    
    // Check transactions collection
    const transSnapshot = await db.collection('transactions')
      .where('clientId', '==', CLIENT_ID)
      .limit(5)
      .get();
    console.log('   Transactions in Firebase:', transSnapshot.size);
    
    // Check HOA dues
    const hoaSnapshot = await db.collection('hoaDues')
      .where('clientId', '==', CLIENT_ID)
      .limit(5)
      .get();
    console.log('   HOA Dues in Firebase:', hoaSnapshot.size);
    
  } catch (error) {
    console.error('Error during debug:', error.message);
    console.error(error);
  }
}

// Run debug
debugImport().then(() => {
  console.log('\n✅ Debug complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Debug failed:', error);
  process.exit(1);
});