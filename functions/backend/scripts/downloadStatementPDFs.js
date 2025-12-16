/**
 * Download Statement of Account PDFs from Firebase Storage
 * 
 * Usage: node backend/scripts/downloadStatementPDFs.js --client=AVII --folder=2026-05 --output=/path/to/output
 * 
 * Options:
 *   --client=MTC|AVII     Client ID (required)
 *   --folder=YYYY-MM      Fiscal year folder (required)
 *   --output=/path        Local output directory (required)
 */

import admin from 'firebase-admin';
import { readFile, mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Parse command line arguments
const args = {};
process.argv.slice(2).forEach(arg => {
  if (arg.startsWith('--')) {
    const [key, value] = arg.substring(2).split('=');
    args[key] = value;
  }
});

// Validate required arguments
if (!args.client || !args.folder || !args.output) {
  console.error('❌ Missing required arguments');
  console.log('Usage: node backend/scripts/downloadStatementPDFs.js --client=AVII --folder=2026-05 --output=/path/to/output');
  process.exit(1);
}

const CLIENT_ID = args.client.toUpperCase();
const FOLDER = args.folder;
const OUTPUT_DIR = args.output;

// Initialize Firebase Admin
async function initFirebase() {
  if (admin.apps.length === 0) {
    const serviceAccountPath = new URL('../serviceAccountKey.json', import.meta.url);
    const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: 'sandyland-management-system.firebasestorage.app'
    });
  }
  return admin;
}

/**
 * Download all PDFs from a storage folder
 */
async function downloadStatements() {
  console.log('📥 Statement PDF Downloader');
  console.log('===========================');
  console.log(`📋 Client: ${CLIENT_ID}`);
  console.log(`📁 Folder: ${FOLDER}`);
  console.log(`💾 Output: ${OUTPUT_DIR}`);
  console.log('');

  // Initialize Firebase
  await initFirebase();
  const bucket = admin.storage().bucket();

  // Create output directory if it doesn't exist
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Created output directory: ${OUTPUT_DIR}`);
  }

  // List files in the storage folder
  const storagePath = `clients/${CLIENT_ID}/accountStatements/${FOLDER}/`;
  console.log(`🔍 Listing files in: ${storagePath}`);
  
  const [files] = await bucket.getFiles({ prefix: storagePath });
  
  if (files.length === 0) {
    console.log('❌ No files found in the specified folder');
    process.exit(1);
  }

  console.log(`📄 Found ${files.length} files\n`);

  // Download each file
  let downloaded = 0;
  let failed = 0;

  for (const file of files) {
    const fileName = path.basename(file.name);
    
    // Skip if not a PDF
    if (!fileName.endsWith('.pdf')) {
      console.log(`⏭️  Skipping non-PDF: ${fileName}`);
      continue;
    }

    const outputPath = path.join(OUTPUT_DIR, fileName);
    
    try {
      process.stdout.write(`   Downloading ${fileName}... `);
      
      // Download file content
      const [content] = await file.download();
      
      // Write to local file
      await writeFile(outputPath, content);
      
      const sizeKB = Math.round(content.length / 1024);
      console.log(`✅ (${sizeKB} KB)`);
      downloaded++;
      
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
      failed++;
    }
  }

  // Summary
  console.log('\n===========================');
  console.log('📊 SUMMARY');
  console.log('===========================');
  console.log(`✅ Downloaded: ${downloaded}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📁 Output: ${OUTPUT_DIR}`);
  
  if (failed > 0) {
    process.exit(1);
  }
  
  console.log('\n🎉 Download complete!');
  process.exit(0);
}

// Run
downloadStatements().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
