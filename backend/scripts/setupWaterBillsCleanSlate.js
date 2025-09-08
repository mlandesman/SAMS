#!/usr/bin/env node

/**
 * Clean slate setup for Water Bills
 * - Removes ALL existing test data
 * - Sets up May-July 2025 historical data with correct structure
 * - Includes units, commonArea, and buildingMeter
 */

import { testHarness, createApiClient } from '../testing/testHarness.js';
import admin from 'firebase-admin';
import { getDb } from '../firebase.js';

// Historical meter readings from the task
const HISTORICAL_DATA = {
  may2025: {
    monthIndex: 4,
    period: "May 2025",
    units: {
      "101": 1749,
      "102": 7,
      "103": 835,
      "104": 1481,
      "105": 830,
      "106": 1340,
      "201": 1083,
      "202": 325,
      "203": 1576,
      "204": 1819
    },
    commonArea: 1664
  },
  june2025: {
    monthIndex: 5,
    period: "June 2025",
    units: {
      "101": 1767,
      "102": 26,
      "103": 842,
      "104": 1489,
      "105": 846,
      "106": 1351,
      "201": 1084,
      "202": 325,
      "203": 1619,
      "204": 1820
    },
    commonArea: 1700
  },
  july2025: {
    monthIndex: 6,
    period: "July 2025",
    units: {
      "101": 1774,
      "102": 30,
      "103": 850,
      "104": 1497,
      "105": 850,
      "106": 1362,
      "201": 1084,
      "202": 331,
      "203": 1653,
      "204": 1824
    },
    commonArea: 1730
  }
};

async function cleanAndSetupWaterBills() {
  console.log('🧹 Water Bills Clean Slate Setup');
  console.log('================================\n');

  try {
    const db = await getDb();
    
    // Step 1: Clean out ALL existing water bills data
    console.log('Step 1: Removing ALL existing water bills data...');
    
    const waterBillsRef = db.collection('clients').doc('AVII').collection('projects').doc('waterBills');
    
    // Get all year subcollections
    const yearCollections = await waterBillsRef.listCollections();
    
    for (const yearColl of yearCollections) {
      console.log(`  Deleting year: ${yearColl.id}`);
      const docs = await yearColl.listDocuments();
      for (const doc of docs) {
        await doc.delete();
      }
    }
    
    console.log('✅ All existing water bills data removed\n');
    
    // Step 2: Create the 2025 structure with historical data
    console.log('Step 2: Setting up 2025 historical data...');
    
    const months2025 = [];
    
    // Process each historical month
    for (const [key, monthData] of Object.entries(HISTORICAL_DATA)) {
      console.log(`  Processing ${monthData.period}...`);
      
      const monthEntry = {
        monthIndex: monthData.monthIndex,
        period: monthData.period,
        units: {},
        commonArea: null,
        buildingMeter: null
      };
      
      // Calculate total for building meter
      let buildingTotal = 0;
      
      // Process each unit
      for (const [unitId, currentReading] of Object.entries(monthData.units)) {
        // Get prior reading from previous month if available
        let priorReading = 0;
        if (monthData.monthIndex > 4 && months2025[monthData.monthIndex - 5]) {
          const prevMonth = months2025[monthData.monthIndex - 5];
          priorReading = prevMonth.units[unitId]?.currentReading || 0;
        }
        
        const consumption = Math.max(0, currentReading - priorReading);
        
        monthEntry.units[unitId] = {
          currentReading,
          priorReading,
          consumption
        };
        
        buildingTotal += currentReading;
      }
      
      // Process common area
      let commonPriorReading = 0;
      if (monthData.monthIndex > 4 && months2025[monthData.monthIndex - 5]) {
        const prevMonth = months2025[monthData.monthIndex - 5];
        commonPriorReading = prevMonth.commonArea?.currentReading || 0;
      }
      
      monthEntry.commonArea = {
        currentReading: monthData.commonArea,
        priorReading: commonPriorReading,
        consumption: Math.max(0, monthData.commonArea - commonPriorReading)
      };
      
      buildingTotal += monthData.commonArea;
      
      // Set building meter (sum of all units + common area)
      let buildingPriorReading = 0;
      if (monthData.monthIndex > 4 && months2025[monthData.monthIndex - 5]) {
        const prevMonth = months2025[monthData.monthIndex - 5];
        buildingPriorReading = prevMonth.buildingMeter?.currentReading || 0;
      }
      
      monthEntry.buildingMeter = {
        currentReading: buildingTotal,
        priorReading: buildingPriorReading,
        consumption: Math.max(0, buildingTotal - buildingPriorReading)
      };
      
      months2025[monthData.monthIndex] = monthEntry;
      
      console.log(`    Units total: ${buildingTotal - monthData.commonArea}`);
      console.log(`    Common area: ${monthData.commonArea}`);
      console.log(`    Building meter: ${buildingTotal}`);
    }
    
    // Save to Firebase
    const year2025Ref = waterBillsRef.collection('2025').doc('data');
    await year2025Ref.set({
      year: 2025,
      months: months2025,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Historical data saved to Firebase\n');
    
    // Step 3: Initialize empty 2026 structure for future entries
    console.log('Step 3: Initializing empty 2026 structure...');
    
    const months2026 = [];
    for (let i = 0; i < 12; i++) {
      months2026[i] = null; // Empty months, will be populated when data is entered
    }
    
    const year2026Ref = waterBillsRef.collection('2026').doc('data');
    await year2026Ref.set({
      year: 2026,
      months: months2026,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ 2026 structure initialized\n');
    
    // Step 4: Verify the data
    console.log('Step 4: Verifying stored data...');
    
    const verification = await year2025Ref.get();
    const data = verification.data();
    
    if (data && data.months) {
      const mayData = data.months[4];
      const juneData = data.months[5];
      const julyData = data.months[6];
      
      console.log('\n📊 Verification Results:');
      console.log('May 2025:');
      console.log(`  - Units stored: ${Object.keys(mayData.units).length}`);
      console.log(`  - Common area: ${mayData.commonArea.currentReading}`);
      console.log(`  - Building meter: ${mayData.buildingMeter.currentReading}`);
      
      console.log('June 2025:');
      console.log(`  - Units stored: ${Object.keys(juneData.units).length}`);
      console.log(`  - Common area: ${juneData.commonArea.currentReading}`);
      console.log(`  - Building meter: ${juneData.buildingMeter.currentReading}`);
      
      console.log('July 2025:');
      console.log(`  - Units stored: ${Object.keys(julyData.units).length}`);
      console.log(`  - Common area: ${julyData.commonArea.currentReading}`);
      console.log(`  - Building meter: ${julyData.buildingMeter.currentReading}`);
    }
    
    console.log('\n✅ SETUP COMPLETE!');
    console.log('Water bills data has been cleaned and historical data loaded.');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the setup
cleanAndSetupWaterBills();