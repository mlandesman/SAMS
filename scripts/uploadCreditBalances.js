#!/usr/bin/env node
/**
 * Upload creditBalances.json to Firebase
 * Usage: USE_ADC=true node scripts/uploadCreditBalances.js
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs/promises';

// Initialize Firebase with ADC
initializeApp({ 
  credential: applicationDefault(), 
  projectId: 'sandyland-management-system' 
});

const db = getFirestore();

async function uploadCreditBalances() {
  try {
    const jsonPath = '/Users/michael/Projects/SAMS/test-results/creditbalances.json';
    console.log(`📂 Reading: ${jsonPath}`);
    
    const jsonData = await fs.readFile(jsonPath, 'utf8');
    const data = JSON.parse(jsonData);
    
    // Remove the _id field (not needed in Firestore)
    delete data._id;
    
    console.log(`📋 Found ${Object.keys(data).length} units to upload`);
    
    // Upload to Firestore
    const creditBalancesRef = db.collection('clients').doc('AVII')
      .collection('units').doc('creditBalances');
    
    await creditBalancesRef.set(data);
    
    console.log(`✅ Successfully uploaded creditBalances for AVII`);
    console.log(`   Units: ${Object.keys(data).join(', ')}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

await uploadCreditBalances();
process.exit(0);
