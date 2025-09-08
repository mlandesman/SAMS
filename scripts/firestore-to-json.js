#!/usr/bin/env node

import { initializeFirebase } from './utils/environment-config.js';
import fs from 'fs/promises';
import path from 'path';

// Initialize Firebase
const { db } = await initializeFirebase();

async function firestoreToJson(firestorePath) {
  try {
    if (!firestorePath) {
      console.error('❌ Please provide a Firestore path');
      console.log('Usage: node firestore-to-json.js <path>');
      console.log('Example: node firestore-to-json.js clients/MTC/units/PH4D/dues/2025');
      process.exit(1);
    }

    console.log(`📋 Fetching data from: ${firestorePath}`);
    
    // Split the path into segments
    const pathSegments = firestorePath.split('/');
    
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
    
    // Save to file
    const outputPath = `${outputName}.json`;
    await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
    
    console.log(`✅ Data saved to: ${outputPath}`);
    console.log(`📄 ${Object.keys(data).length} items exported`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Get path from command line
const firestorePath = process.argv[2];
await firestoreToJson(firestorePath);
process.exit(0);