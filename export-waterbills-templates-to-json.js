#!/usr/bin/env node

/**
 * Export Water Bills Email Templates to JSON Files
 * 
 * This script exports the water bills templates from Firebase to local JSON files
 * so they won't be lost in future imports/exports.
 * 
 * Creates:
 * - AVII_emailTemplates_waterBill.json - Complete waterBill config
 * - AVII_waterBill_body_en.json - English HTML as string
 * - AVII_waterBill_body_es.json - Spanish HTML as string
 * - AVII_waterBill_subjects.json - Both subject lines
 */

import { getDb } from './backend/firebase.js';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const CLIENT_ID = process.argv[2] || 'AVII';
const OUTPUT_DIR = process.argv[3] || './config-backups';

async function exportWaterBillsTemplates() {
  console.log('💾 Exporting Water Bills Email Templates to JSON Files\n');
  console.log(`   Client: ${CLIENT_ID}`);
  console.log(`   Output Directory: ${OUTPUT_DIR}\n`);

  try {
    // Step 1: Fetch from Firebase
    console.log('📥 Step 1: Fetching templates from Firebase...');
    const db = await getDb();
    const emailTemplatesRef = db.collection('clients').doc(CLIENT_ID)
      .collection('config').doc('emailTemplates');
    
    const doc = await emailTemplatesRef.get();
    
    if (!doc.exists) {
      throw new Error(`Email templates document not found for client ${CLIENT_ID}`);
    }
    
    const data = doc.data();
    const waterBill = data.waterBill;
    
    if (!waterBill) {
      throw new Error('waterBill templates not found in emailTemplates document');
    }
    
    console.log('   ✅ Templates fetched from Firebase\n');
    
    // Step 2: Create output directory
    console.log('📁 Step 2: Creating output directory...');
    const fs = await import('fs');
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    console.log(`   ✅ Directory ready: ${OUTPUT_DIR}\n`);
    
    // Step 3: Export complete waterBill object
    console.log('💾 Step 3: Exporting files...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const prefix = `${CLIENT_ID}_waterBill`;
    
    // Complete waterBill config
    const completeFile = resolve(OUTPUT_DIR, `${prefix}_COMPLETE_${timestamp}.json`);
    writeFileSync(completeFile, JSON.stringify({ waterBill }, null, 2));
    console.log(`   ✅ ${completeFile}`);
    console.log(`      Complete waterBill configuration`);
    
    // English body
    const bodyEnFile = resolve(OUTPUT_DIR, `${prefix}_body_en_${timestamp}.json`);
    writeFileSync(bodyEnFile, JSON.stringify({ 
      body_en: waterBill.body_en,
      extracted: timestamp,
      client: CLIENT_ID,
      length: waterBill.body_en.length
    }, null, 2));
    console.log(`   ✅ ${bodyEnFile}`);
    console.log(`      English HTML template (${waterBill.body_en.length} chars)`);
    
    // Spanish body
    const bodyEsFile = resolve(OUTPUT_DIR, `${prefix}_body_es_${timestamp}.json`);
    writeFileSync(bodyEsFile, JSON.stringify({ 
      body_es: waterBill.body_es,
      extracted: timestamp,
      client: CLIENT_ID,
      length: waterBill.body_es.length
    }, null, 2));
    console.log(`   ✅ ${bodyEsFile}`);
    console.log(`      Spanish HTML template (${waterBill.body_es.length} chars)`);
    
    // Subject lines
    const subjectsFile = resolve(OUTPUT_DIR, `${prefix}_subjects_${timestamp}.json`);
    writeFileSync(subjectsFile, JSON.stringify({
      subject_en: waterBill.subject_en,
      subject_es: waterBill.subject_es,
      extracted: timestamp,
      client: CLIENT_ID
    }, null, 2));
    console.log(`   ✅ ${subjectsFile}`);
    console.log(`      Subject lines (both languages)`);
    
    // Also save as HTML files for easy viewing
    const bodyEnHtml = resolve(OUTPUT_DIR, `${prefix}_body_en_${timestamp}.html`);
    writeFileSync(bodyEnHtml, waterBill.body_en);
    console.log(`   ✅ ${bodyEnHtml}`);
    console.log(`      English HTML (for viewing)`);
    
    const bodyEsHtml = resolve(OUTPUT_DIR, `${prefix}_body_es_${timestamp}.html`);
    writeFileSync(bodyEsHtml, waterBill.body_es);
    console.log(`   ✅ ${bodyEsHtml}`);
    console.log(`      Spanish HTML (for viewing)`);
    
    console.log('\n' + '='.repeat(70));
    console.log('🎉 SUCCESS! Water Bills Templates Exported');
    console.log('='.repeat(70));
    console.log(`\n📂 Output Directory: ${OUTPUT_DIR}`);
    console.log('\n📝 Files Created:');
    console.log(`   1. ${prefix}_COMPLETE_${timestamp}.json - Full config`);
    console.log(`   2. ${prefix}_body_en_${timestamp}.json - English HTML as JSON`);
    console.log(`   3. ${prefix}_body_es_${timestamp}.json - Spanish HTML as JSON`);
    console.log(`   4. ${prefix}_subjects_${timestamp}.json - Subject lines`);
    console.log(`   5. ${prefix}_body_en_${timestamp}.html - English HTML file`);
    console.log(`   6. ${prefix}_body_es_${timestamp}.html - Spanish HTML file`);
    
    console.log('\n💡 Usage:');
    console.log('   - Add the COMPLETE file to your import/export configs');
    console.log('   - Keep these files in version control');
    console.log('   - Reference them during future client imports');
    
    console.log('\n📋 Import Command (if needed in future):');
    console.log(`   node import-waterbills-templates-from-json.js ${CLIENT_ID} ${completeFile}\n`);
    
    // Create a simple import script too
    const importScriptContent = `#!/usr/bin/env node

/**
 * Import Water Bills Templates from Backup JSON
 * Usage: node import-waterbills-templates-from-json.js <clientId> <jsonFile>
 */

import { getDb } from './backend/firebase.js';
import { readFileSync } from 'fs';

const CLIENT_ID = process.argv[2];
const JSON_FILE = process.argv[3];

if (!CLIENT_ID || !JSON_FILE) {
  console.error('Usage: node import-waterbills-templates-from-json.js <clientId> <jsonFile>');
  process.exit(1);
}

async function importTemplates() {
  console.log('📥 Importing water bills templates from backup...');
  console.log(\`   Client: \${CLIENT_ID}\`);
  console.log(\`   File: \${JSON_FILE}\\n\`);
  
  const data = JSON.parse(readFileSync(JSON_FILE, 'utf8'));
  
  if (!data.waterBill) {
    throw new Error('Invalid backup file - missing waterBill object');
  }
  
  const db = await getDb();
  await db.collection('clients').doc(CLIENT_ID)
    .collection('config').doc('emailTemplates')
    .set({ waterBill: data.waterBill }, { merge: true });
  
  console.log('✅ Templates imported successfully!\\n');
}

importTemplates().catch(console.error);
`;
    
    const importScriptFile = resolve(OUTPUT_DIR, 'import-waterbills-templates-from-json.js');
    writeFileSync(importScriptFile, importScriptContent);
    console.log(`📜 Import script created: ${importScriptFile}\n`);
    
  } catch (error) {
    console.error('\n❌ Error exporting templates:', error);
    console.error('\nDetails:', error.message);
    process.exit(1);
  }
}

// Run the export
exportWaterBillsTemplates()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

