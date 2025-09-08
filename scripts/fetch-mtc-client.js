#!/usr/bin/env node

/**
 * Fetch MTC Client Document
 * 
 * This script retrieves the complete MTC client document
 * to analyze all fields currently stored.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../backend/serviceAccountKey.json'), 'utf8')
);

const app = initializeApp({
  credential: cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
});

const db = getFirestore(app);

async function fetchMTCClient() {
  console.log('🔍 Fetching MTC client document...\n');
  
  try {
    // Get the MTC client document
    const clientDoc = await db.collection('clients').doc('MTC').get();
    
    if (!clientDoc.exists) {
      console.error('❌ MTC client document not found!');
      return;
    }
    
    const clientData = clientDoc.data();
    
    // Save the complete JSON
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `MTC_client_complete_${timestamp}.json`;
    const filepath = path.join(__dirname, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(clientData, null, 2));
    console.log(`✅ Complete MTC client data saved to: ${filename}\n`);
    
    // Display field analysis
    console.log('📊 Field Analysis:\n');
    console.log(`Total root fields: ${Object.keys(clientData).length}`);
    console.log('\nRoot fields found:');
    Object.keys(clientData).sort().forEach(field => {
      const value = clientData[field];
      const type = Array.isArray(value) ? 'array' : typeof value;
      console.log(`  - ${field} (${type})`);
    });
    
    // Check for nested objects
    console.log('\n📦 Nested structures:');
    Object.entries(clientData).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        console.log(`\n  ${key}:`);
        Object.keys(value).forEach(subkey => {
          console.log(`    - ${subkey}`);
        });
      }
    });
    
    // Check array lengths
    console.log('\n📋 Array field sizes:');
    Object.entries(clientData).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        console.log(`  - ${key}: ${value.length} items`);
      }
    });
    
    console.log(`\n✅ Full data saved to: ${filepath}`);
    
  } catch (error) {
    console.error('❌ Error fetching MTC client:', error);
  }
}

// Run the fetch
fetchMTCClient().then(() => {
  console.log('\n✨ Done!');
  process.exit(0);
}).catch(error => {
  console.error('Failed:', error);
  process.exit(1);
});