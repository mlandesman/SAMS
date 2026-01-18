#!/usr/bin/env node

import { initializeFirebase, printEnvironmentInfo } from './utils/environment-config.js';
import fs from 'fs/promises';
import path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
const useProd = args.includes('--prod');
const firestorePathArg = args.find(arg => !arg.startsWith('--'));

// Initialize Firebase with appropriate environment
const env = useProd ? 'prod' : 'dev';
const { db } = await initializeFirebase(env, { useADC: useProd });

if (useProd) {
  console.log('\x1b[31m🔴 Connected to PRODUCTION database (read-only)\x1b[0m\n');
}

async function firestoreToJson(firestorePath) {
  try {
    if (!firestorePath) {
      console.error('❌ Please provide a Firestore path');
      console.log('Usage: node firestore-to-json.js <path> [--prod]');
      console.log('');
      console.log('Options:');
      console.log('  --prod    Read from production database (uses ADC)');
      console.log('');
      console.log('Examples:');
      console.log('  node firestore-to-json.js clients/MTC/units/PH4D/dues/2025');
      console.log('  node firestore-to-json.js clients/MTC --prod');
      console.log('  node firestore-to-json.js /clients/MTC  (leading slash optional)');
      process.exit(1);
    }

    // Remove leading slash if present
    const normalizedPath = firestorePath.startsWith('/') ? firestorePath.slice(1) : firestorePath;
    
    console.log(`📋 Fetching data from: ${normalizedPath}`);
    
    // Split the path into segments
    const pathSegments = normalizedPath.split('/');
    
    // Build the reference
    let ref = db;
    for (let i = 0; i < pathSegments.length; i++) {
      if (i % 2 === 0) {
        // Collection
        ref = ref.collection(pathSegments[i]);
      } else {
        // Document
        ref = ref.doc(pathSegments[i]);
      }
    }
    
    let data;
    let outputName;
    
    // Check if it's a document or collection
    if (pathSegments.length % 2 === 0) {
      // Even number = document path
      const doc = await ref.get();
      if (!doc.exists) {
        throw new Error(`Document not found: ${firestorePath}`);
      }
      data = {
        _id: doc.id,
        ...doc.data()
      };
      outputName = pathSegments[pathSegments.length - 1];
    } else {
      // Odd number = collection path
      const snapshot = await ref.get();
      data = {};
      snapshot.forEach(doc => {
        data[doc.id] = {
          _id: doc.id,
          ...doc.data()
        };
      });
      outputName = pathSegments[pathSegments.length - 1];
    }
    
    // Save to file (include environment suffix for clarity)
    const envSuffix = useProd ? '-PROD' : '';
    const outputPath = `/Users/michael/Projects/SAMS/test-results/${outputName}${envSuffix}.json`;
    await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
    
    console.log(`✅ Data saved to: ${outputPath}`);
    console.log(`📄 ${Object.keys(data).length} items exported`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run with parsed path
await firestoreToJson(firestorePathArg);
process.exit(0);