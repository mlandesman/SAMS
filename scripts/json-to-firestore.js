#!/usr/bin/env node

import { initializeFirebase } from './utils/environment-config.js';
import fs from 'fs/promises';

// Initialize Firebase
const { db } = await initializeFirebase();

async function jsonToFirestore(jsonPath, firestorePath) {
  try {
    if (!jsonPath || !firestorePath) {
      console.error('❌ Please provide both JSON file path and Firestore path');
      console.log('Usage: node json-to-firestore.js <json-file> <firestore-path>');
      console.log('Example: node json-to-firestore.js MTC.json clients/MTC');
      console.log('Example: node json-to-firestore.js activities.json clients/MTC/config/activities');
      process.exit(1);
    }

    console.log(`📋 Reading JSON from: ${jsonPath}`);
    
    // Read JSON file
    const jsonData = await fs.readFile(jsonPath, 'utf-8');
    const data = JSON.parse(jsonData);
    
    // Remove _id field if present (Firestore will use the doc ID)
    const dataToWrite = { ...data };
    delete dataToWrite._id;
    
    console.log(`🚀 Writing to Firestore: ${firestorePath}`);
    
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
    
    // Check if it's a document or collection
    if (pathSegments.length % 2 === 0) {
      // Even number = document path
      await ref.set(dataToWrite, { merge: true });
      console.log(`✅ Document written successfully to: ${firestorePath}`);
    } else {
      // Odd number = collection path
      // If the data is an object with multiple items, write each as a document
      if (typeof dataToWrite === 'object' && !Array.isArray(dataToWrite)) {
        const promises = [];
        for (const [docId, docData] of Object.entries(dataToWrite)) {
          // Remove _id from each doc if present
          const cleanData = { ...docData };
          delete cleanData._id;
          promises.push(ref.doc(docId).set(cleanData, { merge: true }));
        }
        await Promise.all(promises);
        console.log(`✅ ${promises.length} documents written to collection: ${firestorePath}`);
      } else {
        throw new Error('Collection data must be an object with document IDs as keys');
      }
    }
    
    console.log('🎉 Import complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Get arguments from command line
const jsonPath = process.argv[2];
const firestorePath = process.argv[3];

await jsonToFirestore(jsonPath, firestorePath);
process.exit(0);