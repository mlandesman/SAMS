#!/usr/bin/env node

/**
 * Debug HOA Import - Test just the HOA dues processing
 */

import { getDb } from './backend/firebase.js';
import { ImportService } from './backend/services/importService.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function debugHoaImport() {
  console.log('🔍 Debugging HOA Dues Import...\n');

  try {
    // Load HOADues data
    const hoaPath = join(__dirname, 'MTCdata/HOADues.json');
    const duesData = JSON.parse(readFileSync(hoaPath, 'utf8'));
    
    console.log('📋 HOA Data loaded:');
    console.log(`Total units: ${Object.keys(duesData).length}`);
    
    // Test unit 1A specifically
       const unit1A = duesData['1A'];
       console.log('\n🏠 Unit 1A data:');
       console.log(`Credit Balance: ${unit1A.creditBalance}`);
       console.log(`Total Paid: ${unit1A.totalPaid}`);
       console.log(`Payments: ${unit1A.payments.length}`);
       console.log('Sample payment:', unit1A.payments[0]);

    // Initialize import service
    const importService = new ImportService('MTC-TEST', './MTCdata');
    
    console.log('\n🚀 Calling importHOADues...');
    
    // Test with dry run first
    const result = await importService.importHOADues(2025, { dryRun: true });
    
    console.log('\n📊 Import Result:');
    console.log('Success:', result.success);
    console.log('Failed:', result.failed);
    console.log('Errors:', result.errors.length);
    
    if (result.errors.length > 0) {
      console.log('\n❌ First few errors:');
      result.errors.slice(0, 5).forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Debug test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

debugHoaImport();
