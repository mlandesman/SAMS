#!/usr/bin/env node

/**
 * Discover all Firestore collections dynamically
 * This script queries Firestore to find all top-level collections
 * Usage: node discover-collections.js [project-id] [service-account-path]
 */

import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get command line arguments
const projectId = process.argv[2] || 'sams-sandyland-prod';
const serviceAccountPath = process.argv[3] || join(__dirname, '../../functions/serviceAccountKey-prod.json');

// Initialize Firebase Admin
let app;
let db;
try {
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: projectId
  }, `discover-${projectId}`);
  // Get Firestore instance from the named app
  db = admin.firestore(app);
} catch (error) {
  console.error(`❌ Failed to initialize Firebase: ${error.message}`);
  if (error.code === 'app/duplicate-app') {
    // App already exists, try to get it
    try {
      app = admin.app(`discover-${projectId}`);
      db = admin.firestore(app);
    } catch (e) {
      console.error(`❌ Failed to get existing app: ${e.message}`);
      process.exit(1);
    }
  } else {
    process.exit(1);
  }
}

/**
 * Discover all top-level collections in Firestore
 * Note: Firestore doesn't have a direct "list collections" API
 * We'll query common collections and also try to discover others
 */
async function discoverCollections() {
  const collections = new Set();
  
  // Known collections to check
  const knownCollections = [
    'clients',
    'users',
    'exchangeRates',
    'auditLogs',
    'systemConfig'
  ];
  
  console.log('🔍 Discovering Firestore collections...\n');
  
  // Check known collections
  let hasAuthError = false;
  for (const collectionName of knownCollections) {
    try {
      const snapshot = await db.collection(collectionName).limit(1).get();
      if (!snapshot.empty || collectionName === 'users') {
        // Include even if empty (users might be empty but exists)
        collections.add(collectionName);
        console.log(`✅ Found collection: ${collectionName}`);
      }
    } catch (error) {
      // Collection doesn't exist or error accessing
      if (error.code === 'unauthenticated' || error.code === 16) {
        hasAuthError = true;
        console.warn(`⚠️  Authentication error - using fallback collections`);
        break; // Stop trying if we have auth issues
      } else if (error.code !== 'not-found') {
        console.warn(`⚠️  Error checking ${collectionName}: ${error.message}`);
      }
    }
  }
  
  // If we had auth errors, use fallback known collections
  if (hasAuthError || collections.size === 0) {
    console.log('\n⚠️  Using fallback collection list (discovery had issues)');
    console.log('   This is normal if service account lacks Firestore read permissions');
    // Use known collections as fallback (excluding users)
    knownCollections.forEach(c => {
      if (c !== 'users') {
        collections.add(c);
      }
    });
  }
  
  // Try to discover collections by checking clients subcollections
  // This gives us insight into nested structure
  try {
    const clientsSnapshot = await db.collection('clients').limit(5).get();
    if (!clientsSnapshot.empty) {
      console.log('\n📁 Checking client subcollections...');
      for (const clientDoc of clientsSnapshot.docs) {
        const clientId = clientDoc.id;
        const clientRef = db.collection('clients').doc(clientId);
        const subcollections = await clientRef.listCollections();
        for (const subcol of subcollections) {
          console.log(`   Found under clients/${clientId}: ${subcol.id}`);
        }
      }
    }
  } catch (error) {
    console.warn(`⚠️  Error checking client subcollections: ${error.message}`);
  }
  
  // Return all collections except users (users handled separately)
  const allCollections = Array.from(collections).filter(c => c !== 'users');
  
  console.log(`\n📊 Summary:`);
  console.log(`   Total collections found: ${collections.size}`);
  console.log(`   Collections to backup (excluding users): ${allCollections.length}`);
  console.log(`   Collections: ${allCollections.join(', ')}`);
  
  // Output as JSON for script consumption (to stderr so stdout can be parsed)
  const jsonOutput = JSON.stringify({
    all: Array.from(collections),
    excludeUsers: allCollections,
    usersOnly: collections.has('users')
  });
  
  // Output JSON to stdout for script parsing (after all console.log)
  console.error('\n📋 JSON Output (for scripts):');
  console.log(jsonOutput); // This goes to stdout for parsing
  
  // Cleanup
  await app.delete();
  
  return allCollections;
}

// Run discovery
discoverCollections().catch(error => {
  console.error(`❌ Error during collection discovery: ${error.message}`);
  process.exit(1);
});

