#!/usr/bin/env node

import { getDb } from '../firebase.js';

async function addMissingUnits() {
  try {
    const db = await getDb();
    
    // Get current data
    const docRef = db
      .collection('clients').doc('AVII')
      .collection('projects').doc('waterBills')
      .collection('2026').doc('data');
    
    const doc = await docRef.get();
    const data = doc.data();
    
    // Add missing units 201-204
    const missingUnits = ['201', '202', '203', '204'];
    
    missingUnits.forEach(unitId => {
      if (!data.months[0].units[unitId]) {
        data.months[0].units[unitId] = {
          unitId: unitId,
          currentReading: 1000 + parseInt(unitId), // Initial reading
          priorReading: 0,
          consumption: 0,
          amount: 0,
          paid: false,
          paymentDate: null,
          paymentRecord: null
        };
        console.log(`Added unit ${unitId} with initial reading ${1000 + parseInt(unitId)}`);
      }
    });
    
    // Update Firebase
    await docRef.update(data);
    console.log('\n✅ Successfully added missing units to water bills data');
    
    // Verify
    console.log('\nVerifying all units are now present:');
    const updatedDoc = await docRef.get();
    const updatedData = updatedDoc.data();
    const allUnits = Object.keys(updatedData.months[0].units).sort();
    console.log('Units in water bills:', allUnits);
    console.log('Total count:', allUnits.length);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  process.exit(0);
}

addMissingUnits();