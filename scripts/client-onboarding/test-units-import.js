#!/usr/bin/env node

/**
 * Test Units Import - Debug enhanced units import
 */

import { initializeImport, logProgress } from './import-config.js';
import fs from 'fs/promises';
import path from 'path';

const CLIENT_ID = 'MTC';
const dataPath = '/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/MTCdata';

async function testUnitsImport() {
  console.log('\n=== Test Units Import ===\n');
  
  try {
    // Initialize
    const { db } = await initializeImport(CLIENT_ID);
    
    // Load Units.json
    console.log('Loading Units.json...');
    const unitsFile = path.join(dataPath, 'Units.json');
    const unitsData = JSON.parse(await fs.readFile(unitsFile, 'utf-8'));
    console.log('Units loaded:', unitsData.length);
    
    // Check first unit structure
    console.log('\nFirst unit data:');
    console.log(JSON.stringify(unitsData[0], null, 2));
    
    // Try to create the first unit
    const firstUnit = unitsData[0];
    const unitNumber = firstUnit.unitNumber || firstUnit.UnitNumber || firstUnit.UnitID || firstUnit.unit;
    
    console.log('\nAttempting to create unit:', unitNumber);
    
    const unitRef = db.collection('units').doc(`${CLIENT_ID}_${unitNumber}`);
    
    const unitDoc = {
      clientId: CLIENT_ID,
      unitNumber: unitNumber,
      owner: firstUnit.owner || firstUnit.Owner || 'Unknown',
      balance: firstUnit.balance || 0,
      email: firstUnit.email || firstUnit.eMail || '',
      phone: firstUnit.phone || '',
      size: firstUnit.size || 0,
      sizeFactor: firstUnit.sizeFactor || 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      migrationData: {
        importDate: new Date(),
        importScript: 'enhanced-import-test',
        timezone: 'America/Cancun',
        environment: 'dev',
        originalData: firstUnit
      }
    };
    
    console.log('\nUnit document to create:');
    console.log(JSON.stringify(unitDoc, null, 2));
    
    // Create the unit
    await unitRef.set(unitDoc);
    console.log('✅ Unit created successfully');
    
    // Verify it was created
    const verifyDoc = await unitRef.get();
    console.log('Unit exists after creation:', verifyDoc.exists);
    
    // Check count
    const countSnapshot = await db.collection('units')
      .where('clientId', '==', CLIENT_ID)
      .count()
      .get();
    console.log('\nTotal MTC units in Firebase:', countSnapshot.data().count);
    
  } catch (error) {
    console.error('Error during test:', error.message);
    console.error(error);
  }
}

// Run test
testUnitsImport().then(() => {
  console.log('\n✅ Test complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});