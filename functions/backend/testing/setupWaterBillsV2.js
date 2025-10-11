#!/usr/bin/env node

/**
 * Water Bills V2 Setup - Using Test Harness
 * Clean slate setup with proper authentication
 */

import { testHarness, createApiClient } from './testHarness.js';
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

async function setupWaterBillsV2() {
  console.log('🚀 Water Bills V2 Setup');
  console.log('=======================\n');

  try {
    // Get authenticated API client
    const api = await createApiClient();
    console.log('✅ Authentication successful\n');

    // Get direct Firestore access for cleanup
    const db = await getDb();
    
    // Step 1: Clean out ALL existing water bills data
    console.log('📦 Step 1: Cleaning existing data...');
    console.log('====================================');
    
    const waterBillsRef = db.collection('clients').doc('AVII').collection('projects').doc('waterBills');
    
    // Get all year subcollections
    const yearCollections = await waterBillsRef.listCollections();
    
    for (const yearColl of yearCollections) {
      console.log(`  🗑️  Deleting year: ${yearColl.id}`);
      const docs = await yearColl.listDocuments();
      for (const doc of docs) {
        await doc.delete();
      }
    }
    
    console.log('✅ All existing water bills data removed\n');
    
    // Step 2: Create the 2025 structure with historical data
    console.log('📊 Step 2: Setting up 2025 historical data...');
    console.log('=============================================');
    
    const months2025 = new Array(12).fill(null);
    
    // Process each historical month
    for (const [key, monthData] of Object.entries(HISTORICAL_DATA)) {
      console.log(`\n  📅 Processing ${monthData.period}...`);
      
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
        if (monthData.monthIndex > 4 && months2025[monthData.monthIndex - 1]) {
          const prevMonth = months2025[monthData.monthIndex - 1];
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
      if (monthData.monthIndex > 4 && months2025[monthData.monthIndex - 1]) {
        const prevMonth = months2025[monthData.monthIndex - 1];
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
      if (monthData.monthIndex > 4 && months2025[monthData.monthIndex - 1]) {
        const prevMonth = months2025[monthData.monthIndex - 1];
        buildingPriorReading = prevMonth.buildingMeter?.currentReading || 0;
      }
      
      monthEntry.buildingMeter = {
        currentReading: buildingTotal,
        priorReading: buildingPriorReading,
        consumption: Math.max(0, buildingTotal - buildingPriorReading)
      };
      
      months2025[monthData.monthIndex] = monthEntry;
      
      console.log(`    📊 Units total: ${buildingTotal - monthData.commonArea}`);
      console.log(`    💧 Common area: ${monthData.commonArea}`);
      console.log(`    🏢 Building meter: ${buildingTotal}`);
      console.log(`    ✅ Consumption: ${monthEntry.buildingMeter.consumption} m³`);
    }
    
    // Save to Firebase
    const year2025Ref = waterBillsRef.collection('2025').doc('data');
    await year2025Ref.set({
      year: 2025,
      months: months2025,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('\n✅ Historical data saved to Firebase\n');
    
    // Step 3: Initialize empty 2026 structure for future entries
    console.log('📅 Step 3: Initializing 2026 structure...');
    console.log('=========================================');
    
    const months2026 = new Array(12).fill(null);
    
    const year2026Ref = waterBillsRef.collection('2026').doc('data');
    await year2026Ref.set({
      year: 2026,
      months: months2026,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ 2026 structure initialized\n');
    
    // Step 4: Verify via API
    console.log('🔍 Step 4: Verifying via API...');
    console.log('================================');
    
    // Test May 2025 data retrieval
    try {
      const response = await api.get('/api/clients/AVII/projects/waterBills/2025/4');
      const mayData = response.data;
      
      console.log('\n📊 May 2025 Verification:');
      console.log(`  ✓ Period: ${mayData.period}`);
      console.log(`  ✓ Units: ${Object.keys(mayData.units).length}`);
      console.log(`  ✓ Common Area: ${mayData.commonArea?.currentReading}`);
      console.log(`  ✓ Building Meter: ${mayData.buildingMeter?.currentReading}`);
      
      // Sample unit check
      console.log(`  ✓ Unit 101: ${mayData.units['101']?.currentReading}`);
      
    } catch (error) {
      console.log('⚠️  API verification failed:', error.response?.data || error.message);
      console.log('   (This may be normal if the endpoint needs updating for new structure)');
    }
    
    // Verify directly from Firebase
    console.log('\n📊 Direct Firebase Verification:');
    const verification = await year2025Ref.get();
    const data = verification.data();
    
    if (data && data.months) {
      const months = [4, 5, 6]; // May, June, July
      const monthNames = ['May', 'June', 'July'];
      
      months.forEach((monthIndex, i) => {
        const monthData = data.months[monthIndex];
        if (monthData) {
          console.log(`\n  ${monthNames[i]} 2025:`);
          console.log(`    - Units: ${Object.keys(monthData.units).length}`);
          console.log(`    - Common: ${monthData.commonArea.currentReading}`);
          console.log(`    - Building: ${monthData.buildingMeter.currentReading}`);
        }
      });
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ SETUP COMPLETE!');
    console.log('='.repeat(50));
    console.log('\n📝 Summary:');
    console.log('  • All test data cleaned');
    console.log('  • May-July 2025 historical data loaded');
    console.log('  • 2026 structure initialized');
    console.log('  • Ready for UI implementation');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the setup
setupWaterBillsV2();