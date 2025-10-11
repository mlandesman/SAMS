#!/usr/bin/env node

import { getDb } from '../firebase.js';

async function createWaterData2025() {
  try {
    const db = await getDb();
    
    console.log('📅 Creating water data for FY 2025...\n');
    
    // Create the 2025 data structure (copy from 2026)
    const docRef2026 = db
      .collection('clients').doc('AVII')
      .collection('projects').doc('waterBills')
      .collection('2026').doc('data');
    
    const doc2026 = await docRef2026.get();
    const data2026 = doc2026.data();
    
    // Create 2025 data with slightly different values
    const data2025 = {
      year: 2025,
      config: data2026.config || { ratePerM3: 50 },
      months: [
        {
          month: 0,
          units: {}
        }
      ]
    };
    
    // Copy units with adjusted readings for 2025
    Object.entries(data2026.months[0].units).forEach(([unitId, unitData]) => {
      data2025.months[0].units[unitId] = {
        ...unitData,
        currentReading: Math.max(0, unitData.currentReading - 100), // Previous year readings
        priorReading: Math.max(0, unitData.currentReading - 200),
        consumption: 100,
        amount: 5000, // $50
        paid: true, // Mark as paid for previous year
        paymentDate: '2024-08-15',
        paymentRecord: {
          reference: `PAY-2025-${unitId}`,
          date: '2024-08-15',
          amount: 5000
        }
      };
    });
    
    // Save to Firebase
    const docRef2025 = db
      .collection('clients').doc('AVII')
      .collection('projects').doc('waterBills')
      .collection('2025').doc('data');
    
    await docRef2025.set(data2025);
    
    console.log('✅ Created water data for FY 2025');
    console.log('Units:', Object.keys(data2025.months[0].units).sort());
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  process.exit(0);
}

createWaterData2025();