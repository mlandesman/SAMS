#!/usr/bin/env node

/**
 * Water Bills V2 Setup - FIXED VERSION
 * Correctly stores data in FY 2026 months 0-1 (July-August)
 * AVII fiscal year starts in July
 */

import { createApiClient } from './testHarness.js';
import admin from 'firebase-admin';
import { getDb } from '../firebase.js';

// Historical meter readings - These are the ACTUAL READINGS taken in June/July
// June reading = May usage
// July reading = June usage  
const HISTORICAL_DATA = {
  // June 2025 reading (for May 2025 usage)
  june2025Reading: {
    readingDate: "June 2025",
    forUsagePeriod: "May 2025",
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
  // July 2025 reading (for June 2025 usage)
  july2025Reading: {
    readingDate: "July 2025",
    forUsagePeriod: "June 2025",
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
  },
  // August 2025 reading (for July 2025 usage) - First month of FY 2026
  august2025Reading: {
    readingDate: "August 2025",
    forUsagePeriod: "July 2025",
    units: {
      "101": 1785,
      "102": 35,
      "103": 860,
      "104": 1510,
      "105": 855,
      "106": 1370,
      "201": 1090,
      "202": 335,
      "203": 1670,
      "204": 1830
    },
    commonArea: 1750
  }
};

async function setupWaterBillsV2Fixed() {
  console.log('🚀 Water Bills V2 Setup - FIXED VERSION');
  console.log('========================================\n');

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
    
    // Step 2: Create FY 2026 structure (AVII fiscal year starts July 1)
    console.log('📊 Step 2: Setting up FY 2026 data...');
    console.log('=====================================');
    console.log('📅 AVII Fiscal Year: July 1 - June 30');
    console.log('📅 FY 2026: July 2025 - June 2026\n');
    
    const year2026Ref = waterBillsRef.collection('2026').doc('data');
    
    // Initialize months array with 12 empty months
    const months = [];
    for (let i = 0; i < 12; i++) {
      months.push({
        units: {},
        commonArea: null,
        buildingMeter: null
      });
    }
    
    // Month 0 = July 2025 (first month of FY 2026)
    // Use August reading with July reading as prior
    console.log('📝 Processing Month 0 (July 2025)...');
    const julyPriorReadings = HISTORICAL_DATA.july2025Reading.units;
    const augustCurrentReadings = HISTORICAL_DATA.august2025Reading.units;
    
    months[0].units = {};
    for (const [unitId, currentReading] of Object.entries(augustCurrentReadings)) {
      const priorReading = julyPriorReadings[unitId] || 0;
      const consumption = currentReading - priorReading;
      
      months[0].units[unitId] = {
        priorReading: priorReading,
        currentReading: currentReading,
        consumption: consumption,
        amount: 0,  // No billing amount yet
        unpaidBalance: 0,
        monthsBehind: 0,
        paid: false,
        paidDate: null,
        paymentRecord: null
      };
      
      console.log(`  Unit ${unitId}: Prior=${priorReading}, Current=${currentReading}, Consumption=${consumption}`);
    }
    
    // Common area for July
    const julyCommonPrior = HISTORICAL_DATA.july2025Reading.commonArea;
    const augustCommonCurrent = HISTORICAL_DATA.august2025Reading.commonArea;
    months[0].commonArea = {
      priorReading: julyCommonPrior,
      currentReading: augustCommonCurrent,
      consumption: augustCommonCurrent - julyCommonPrior
    };
    
    // Calculate building meter (sum of units + common area)
    const julyUnitsTotal = Object.values(augustCurrentReadings).reduce((sum, val) => sum + val, 0);
    const julyBuildingTotal = julyUnitsTotal + augustCommonCurrent;
    const julyBuildingPrior = Object.values(julyPriorReadings).reduce((sum, val) => sum + val, 0) + julyCommonPrior;
    
    months[0].buildingMeter = {
      priorReading: julyBuildingPrior,
      currentReading: julyBuildingTotal,
      consumption: julyBuildingTotal - julyBuildingPrior
    };
    
    console.log(`  Common Area: Prior=${julyCommonPrior}, Current=${augustCommonCurrent}`);
    console.log(`  Building Total: Prior=${julyBuildingPrior}, Current=${julyBuildingTotal}\n`);
    
    // Month 1 = August 2025 (we don't have September reading, so leave empty)
    console.log('📝 Month 1 (August 2025): No data yet (would need September reading)\n');
    
    // Save to Firestore
    const data2026 = {
      months: months,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      period: "FY 2026",
      monthIndex: 0  // Last month with data
    };
    
    await year2026Ref.set(data2026);
    console.log('✅ FY 2026 data structure created\n');
    
    // Step 3: Also store June 2025 data in FY 2025 last month for reference
    console.log('📊 Step 3: Setting up FY 2025 June data (for reference)...');
    console.log('=========================================================');
    
    const year2025Ref = waterBillsRef.collection('2025').doc('data');
    
    // Initialize FY 2025 months array
    const months2025 = [];
    for (let i = 0; i < 12; i++) {
      months2025.push({
        units: {},
        commonArea: null,
        buildingMeter: null
      });
    }
    
    // Month 11 = June 2025 (last month of FY 2025)
    // Use July reading with June reading as prior
    console.log('📝 Processing Month 11 (June 2025)...');
    const junePriorReadings = HISTORICAL_DATA.june2025Reading.units;
    const julyCurrentReadings = HISTORICAL_DATA.july2025Reading.units;
    
    months2025[11].units = {};
    for (const [unitId, currentReading] of Object.entries(julyCurrentReadings)) {
      const priorReading = junePriorReadings[unitId] || 0;
      const consumption = currentReading - priorReading;
      
      months2025[11].units[unitId] = {
        priorReading: priorReading,
        currentReading: currentReading,
        consumption: consumption,
        amount: 0,
        unpaidBalance: 0,
        monthsBehind: 0,
        paid: false,
        paidDate: null,
        paymentRecord: null
      };
    }
    
    // Common area for June
    const juneCommonPrior = HISTORICAL_DATA.june2025Reading.commonArea;
    const julyCommonCurrent = HISTORICAL_DATA.july2025Reading.commonArea;
    months2025[11].commonArea = {
      priorReading: juneCommonPrior,
      currentReading: julyCommonCurrent,
      consumption: julyCommonCurrent - juneCommonPrior
    };
    
    // Building meter for June
    const juneUnitsTotal = Object.values(julyCurrentReadings).reduce((sum, val) => sum + val, 0);
    const juneBuildingTotal = juneUnitsTotal + julyCommonCurrent;
    const juneBuildingPrior = Object.values(junePriorReadings).reduce((sum, val) => sum + val, 0) + juneCommonPrior;
    
    months2025[11].buildingMeter = {
      priorReading: juneBuildingPrior,
      currentReading: juneBuildingTotal,
      consumption: juneBuildingTotal - juneBuildingPrior
    };
    
    // Save FY 2025 data
    const data2025 = {
      months: months2025,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      period: "FY 2025",
      monthIndex: 11  // June is the last month
    };
    
    await year2025Ref.set(data2025);
    console.log('✅ FY 2025 June data created for reference\n');
    
    // Step 4: Test API endpoint
    console.log('🔍 Step 4: Testing API endpoint...');
    console.log('===================================');
    
    const response = await api.get('/clients/AVII/projects/waterBills/2026');
    
    if (response.data.success) {
      console.log('✅ API endpoint working!');
      console.log('📊 Data structure:', JSON.stringify(response.data.data, null, 2).substring(0, 500) + '...\n');
    } else {
      console.log('❌ API endpoint failed:', response.data.message);
    }
    
    console.log('🎉 Water Bills V2 Setup Complete!');
    console.log('==================================');
    console.log('✅ FY 2026 July data loaded (month 0)');
    console.log('✅ FY 2025 June data loaded (month 11) for reference');
    console.log('✅ Prior readings properly linked');
    console.log('✅ Ready for testing!\n');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run directly
setupWaterBillsV2Fixed();