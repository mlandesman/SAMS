#!/usr/bin/env node

import { getDb } from '../firebase.js';

async function setupProperWaterData() {
  try {
    const db = await getDb();
    
    console.log('📊 Setting up proper water data structure for FY 2026...\n');
    
    // The proper structure should have monthly readings for each unit
    // This matches the HOA Dues pattern
    const data2026 = {
      year: 2026,
      config: { ratePerM3: 50 },
      months: []
    };
    
    // Create 12 months of data (July 2025 - June 2026 for FY 2026)
    const monthlyReadings = {
      '101': [1700, 1710, 1720, 1730, 1740, 1750, 1760, 1770, 1775, 1780, 1790, 1800],
      '102': [2300, 2310, 2320, 2330, 2340, 2345, 2350, 2355, 2360, 2365, 2370, 2375],
      '103': [3400, 3410, 3420, 3430, 3440, 3450, 3455, 3460, 3465, 3470, 3475, 3480],
      '104': [4400, 4410, 4420, 4430, 4440, 4450, 4460, 4470, 4480, 4490, 4495, 4500],
      '105': [5500, 5510, 5520, 5530, 5540, 5550, 5560, 5570, 5580, 5590, 5595, 5600],
      '106': [6600, 6610, 6620, 6630, 6640, 6650, 6660, 6670, 6680, 6690, 6695, 6700],
      '201': [1150, 1160, 1170, 1180, 1185, 1190, 1195, 1200, 1201, 1202, 1203, 1204],
      '202': [1150, 1160, 1170, 1180, 1185, 1190, 1195, 1200, 1201, 1202, 1203, 1204],
      '203': [1150, 1160, 1170, 1180, 1185, 1190, 1195, 1200, 1201, 1202, 1203, 1204],
      '204': [1150, 1160, 1170, 1180, 1185, 1190, 1195, 1200, 1201, 1202, 1203, 1204]
    };
    
    // Create month entries (0-11 for July through June)
    for (let month = 0; month < 12; month++) {
      const monthData = {
        month: month,
        units: {}
      };
      
      Object.keys(monthlyReadings).forEach(unitId => {
        const currentReading = monthlyReadings[unitId][month];
        const priorReading = month > 0 ? monthlyReadings[unitId][month - 1] : currentReading - 10;
        const consumption = currentReading - priorReading;
        const amount = consumption * 50; // 50 pesos per unit
        
        monthData.units[unitId] = {
          unitId: unitId,
          currentReading: currentReading,
          priorReading: priorReading,
          consumption: consumption,
          amount: amount,
          paid: month < 3, // First 3 months paid
          paymentDate: month < 3 ? `2025-${String(7 + month).padStart(2, '0')}-15` : null,
          paymentRecord: month < 3 ? {
            reference: `PAY-2026-${unitId}-${month}`,
            date: `2025-${String(7 + month).padStart(2, '0')}-15`,
            amount: amount
          } : null
        };
      });
      
      data2026.months.push(monthData);
    }
    
    // Save to Firebase
    const docRef = db
      .collection('clients').doc('AVII')
      .collection('projects').doc('waterBills')
      .collection('2026').doc('data');
    
    await docRef.set(data2026);
    
    console.log('✅ Created proper monthly water data for FY 2026');
    console.log('   - 12 months of readings (July 2025 - June 2026)');
    console.log('   - 10 units with progressive readings');
    console.log('   - First 3 months marked as paid');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  process.exit(0);
}

setupProperWaterData();