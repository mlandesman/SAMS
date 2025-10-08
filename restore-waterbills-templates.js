#!/usr/bin/env node

/**
 * Restore Water Bills Email Templates to Firebase
 * 
 * This script restores the bilingual water bills email templates
 * that were missing after the AVII client re-import.
 * 
 * Usage:
 *   node restore-waterbills-templates.js [clientId]
 * 
 * Example:
 *   node restore-waterbills-templates.js AVII
 */

import { getDb } from './backend/firebase.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get client ID from command line or default to AVII
const clientId = process.argv[2] || 'AVII';

// Subject lines
const SUBJECT_EN = "💧 Water Bill for Unit {{UnitNumber}} - {{BillingPeriod}} | Due: {{DueDate}}";
const SUBJECT_ES = "💧 Estado de Cuenta de Agua - Unidad {{UnitNumber}} - {{BillingPeriod}} | Vencimiento: {{DueDate}}";

async function restoreWaterBillsTemplates() {
  try {
    console.log(`\n🔧 Restoring water bills email templates for client: ${clientId}`);
    console.log('━'.repeat(60));
    
    // Read the template files
    console.log('\n📄 Reading template files...');
    const body_en = readFileSync(join(__dirname, 'fixed_body_en.html'), 'utf8');
    console.log(`   ✅ English template: ${body_en.length} characters`);
    
    const body_es = readFileSync(join(__dirname, 'waterBills_body_es.html'), 'utf8');
    console.log(`   ✅ Spanish template: ${body_es.length} characters`);
    
    // Get Firestore database
    console.log('\n🔌 Connecting to Firebase...');
    const db = await getDb();
    console.log('   ✅ Connected to Firestore');
    
    // Reference to the emailTemplates document
    const emailTemplatesRef = db.collection('clients').doc(clientId)
      .collection('config').doc('emailTemplates');
    
    // Check if document exists
    console.log('\n🔍 Checking existing configuration...');
    const existingDoc = await emailTemplatesRef.get();
    
    if (existingDoc.exists) {
      const existingData = existingDoc.data();
      console.log('   📋 Existing emailTemplates document found');
      
      if (existingData.waterBill) {
        console.log('   ⚠️  Warning: waterBill configuration already exists');
        console.log('   ℹ️  Existing fields:', Object.keys(existingData.waterBill));
        
        // Ask for confirmation (in production, you might want to add a --force flag)
        console.log('\n   ℹ️  This operation will merge/update the waterBill configuration');
      } else {
        console.log('   ℹ️  No waterBill configuration found - will create new');
      }
    } else {
      console.log('   ℹ️  No emailTemplates document found - will create new');
    }
    
    // Update the emailTemplates document
    console.log('\n📤 Uploading templates to Firebase...');
    await emailTemplatesRef.set({
      waterBill: {
        subject_en: SUBJECT_EN,
        subject_es: SUBJECT_ES,
        body_en: body_en,
        body_es: body_es
      }
    }, { merge: true });
    
    console.log('   ✅ Templates uploaded successfully!');
    
    // Verify the upload
    console.log('\n🔍 Verifying upload...');
    const verifyDoc = await emailTemplatesRef.get();
    
    if (verifyDoc.exists) {
      const data = verifyDoc.data();
      
      if (data.waterBill) {
        const wb = data.waterBill;
        console.log('   ✅ waterBill configuration verified');
        console.log(`   ✅ subject_en: ${wb.subject_en ? 'Present (' + wb.subject_en.substring(0, 50) + '...)' : 'MISSING'}`);
        console.log(`   ✅ subject_es: ${wb.subject_es ? 'Present (' + wb.subject_es.substring(0, 50) + '...)' : 'MISSING'}`);
        console.log(`   ✅ body_en: ${wb.body_en ? 'Present (' + wb.body_en.length + ' chars)' : 'MISSING'}`);
        console.log(`   ✅ body_es: ${wb.body_es ? 'Present (' + wb.body_es.length + ' chars)' : 'MISSING'}`);
      } else {
        console.log('   ❌ Error: waterBill configuration not found after upload!');
        process.exit(1);
      }
    } else {
      console.log('   ❌ Error: emailTemplates document not found after upload!');
      process.exit(1);
    }
    
    // Success message
    console.log('\n' + '━'.repeat(60));
    console.log('✨ Water bills email templates restored successfully!');
    console.log('\nFirebase Path:');
    console.log(`   /clients/${clientId}/config/emailTemplates/waterBill`);
    console.log('\nTemplate Languages:');
    console.log('   ✅ English (en)');
    console.log('   ✅ Spanish (es)');
    console.log('\nNext Steps:');
    console.log('   1. Test by sending a water bill email');
    console.log('   2. Verify both English and Spanish versions render correctly');
    console.log('   3. Check mobile responsiveness');
    console.log('━'.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ Error restoring water bills templates:');
    console.error(error);
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the restoration
restoreWaterBillsTemplates()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  });
