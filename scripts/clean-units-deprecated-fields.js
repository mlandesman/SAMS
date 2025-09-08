#!/usr/bin/env node

/**
 * Script to remove deprecated fields from all unit records in Firestore
 * 
 * This script removes the following deprecated fields:
 * - squareMeters (now calculated on display)
 * - active (replaced with status field)
 * 
 * Usage: node scripts/clean-units-deprecated-fields.js
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin SDK
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '../backend/serviceAccountKey.json'), 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://your-project-id.firebaseio.com'
});

const db = admin.firestore();

async function cleanUnitDeprecatedFields() {
  console.log('🧹 Starting cleanup of deprecated fields from unit records...');
  
  try {
    // Get all clients
    const clientsSnapshot = await db.collection('clients').get();
    
    if (clientsSnapshot.empty) {
      console.log('No clients found');
      return;
    }
    
    let totalUnitsProcessed = 0;
    let totalUnitsUpdated = 0;
    
    for (const clientDoc of clientsSnapshot.docs) {
      const clientId = clientDoc.id;
      console.log(`\n📁 Processing client: ${clientId}`);
      
      // Get all units for this client
      const unitsSnapshot = await db.collection(`clients/${clientId}/units`).get();
      
      if (unitsSnapshot.empty) {
        console.log(`  No units found for client ${clientId}`);
        continue;
      }
      
      console.log(`  Found ${unitsSnapshot.docs.length} units`);
      
      for (const unitDoc of unitsSnapshot.docs) {
        const unitId = unitDoc.id;
        const unitData = unitDoc.data();
        totalUnitsProcessed++;
        
        // Check if any deprecated fields exist
        const hasDeprecatedFields = unitData.hasOwnProperty('squareMeters') || 
                                   unitData.hasOwnProperty('active');
        
        if (hasDeprecatedFields) {
          console.log(`  🔧 Updating unit ${unitData.unitId || unitId}...`);
          
          // Create update object by removing deprecated fields
          const updateData = { ...unitData };
          delete updateData.squareMeters;
          delete updateData.active;
          
          // Update the document
          await db.collection(`clients/${clientId}/units`).doc(unitId).set(updateData);
          totalUnitsUpdated++;
          
          console.log(`    ✅ Removed deprecated fields from unit ${unitData.unitId || unitId}`);
        } else {
          console.log(`  ✓ Unit ${unitData.unitId || unitId} already clean`);
        }
      }
    }
    
    console.log('\n🎉 Cleanup completed!');
    console.log(`📊 Summary:`);
    console.log(`   Total units processed: ${totalUnitsProcessed}`);
    console.log(`   Total units updated: ${totalUnitsUpdated}`);
    console.log(`   Units already clean: ${totalUnitsProcessed - totalUnitsUpdated}`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  } finally {
    // Clean up
    await admin.app().delete();
  }
}

// Run the cleanup
cleanUnitDeprecatedFields().catch(console.error);
