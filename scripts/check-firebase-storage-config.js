#!/usr/bin/env node
/**
 * Check what Config.json actually contains in Firebase Storage
 */

import { readFileFromFirebaseStorage } from '../backend/api/importStorage.js';

async function checkStorageConfig() {
  try {
    const clientId = 'AVII';
    const filePath = `imports/${clientId}/Config.json`;
    
    console.log(`📂 Reading Config.json from Firebase Storage...`);
    console.log(`Path: ${filePath}`);
    
    // Read from Firebase Storage (need user context, but system access should work)
    const content = await readFileFromFirebaseStorage(filePath, null);
    const configData = JSON.parse(content);
    
    console.log('\n📋 Config keys found in Firebase Storage:');
    const keys = Object.keys(configData);
    keys.forEach((key, index) => {
      console.log(`  ${index + 1}. ${key}`);
    });
    
    console.log(`\nTotal: ${keys.length} config documents`);
    
    if (keys.includes('hoaDues')) {
      console.log('\n✅ hoaDues IS in Firebase Storage Config.json');
      console.log('Data:', configData.hoaDues);
    } else {
      console.log('\n❌ hoaDues is NOT in Firebase Storage Config.json');
      console.log('\nThis is why it wasn\'t imported!');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\nMake sure you have Firebase Storage access configured.');
    process.exit(1);
  }
}

checkStorageConfig();

