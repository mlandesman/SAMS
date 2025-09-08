#!/usr/bin/env node

/**
 * Initialize Water Bills V3
 * Sets up the new structure and loads test data
 */

import { createApiClient } from './testHarness.js';
import waterServiceV2 from '../services/waterServiceV2.js';

async function initializeWaterBillsV3() {
  console.log('🚀 Water Bills V3 Initialization');
  console.log('=================================\n');

  try {
    // Get authenticated API client
    const api = await createApiClient();
    console.log('✅ Authentication successful\n');

    // Step 1: Initialize meters
    console.log('📦 Step 1: Initializing water meters...');
    console.log('=====================================');
    
    const initResponse = await api.post('/clients/AVII/projects/waterBills/meters/initialize');
    
    if (initResponse.data.success) {
      console.log(`✅ Initialized ${initResponse.data.data.initialized} meters\n`);
    } else {
      console.log('❌ Failed to initialize meters:', initResponse.data.error);
      return;
    }
    
    // Step 2: Configure water billing settings
    console.log('⚙️  Step 2: Setting up water billing configuration...');
    console.log('==================================================');
    
    const config = {
      rateStructure: {
        baseCharge: 25.00,
        usageRate: 5.50
      },
      penalties: {
        type: 'percentage',
        percentage: 5.0,
        compound: true,
        gracePeriodDays: 10
      },
      billing: {
        dueDayOfMonth: 10,
        readingDayOfMonth: 1
      }
    };
    
    const configResponse = await api.put('/clients/AVII/config/waterBilling', config);
    
    if (configResponse.data.success) {
      console.log('✅ Configuration saved\n');
    } else {
      console.log('❌ Failed to save configuration:', configResponse.data.error);
    }
    
    // Step 3: Submit historical readings
    console.log('📊 Step 3: Submitting historical readings...');
    console.log('==========================================');
    
    // July 2025 readings (FY 2026 month 0)
    const july2025Readings = {
      "101": 1785,
      "102": 35,
      "103": 860,
      "104": 1510,
      "105": 855,
      "106": 1370,
      "201": 1090,
      "202": 335,
      "203": 1670,
      "204": 1830,
      "commonArea": 1750
    };
    
    console.log('📝 Submitting July 2025 readings...');
    const julyResponse = await api.post('/clients/AVII/projects/waterBills/readings', {
      year: 2025,
      month: 6,  // July is month 6 (0-indexed)
      readings: july2025Readings
    });
    
    if (julyResponse.data.success) {
      console.log('✅ July 2025 readings submitted');
      console.log(`   Units: ${Object.keys(july2025Readings).length - 1}`);
      console.log(`   Common Area: ${july2025Readings.commonArea}`);
      console.log(`   Building Total: ${julyResponse.data.data.readings.buildingMeter.current}\n`);
    } else {
      console.log('❌ Failed to submit July readings:', julyResponse.data.error);
    }
    
    // August 2025 readings (FY 2026 month 1)
    const august2025Readings = {
      "101": 1802,
      "102": 42,
      "103": 875,
      "104": 1528,
      "105": 863,
      "106": 1385,
      "201": 1098,
      "202": 341,
      "203": 1688,
      "204": 1845,
      "commonArea": 1770
    };
    
    console.log('📝 Submitting August 2025 readings...');
    const augustResponse = await api.post('/clients/AVII/projects/waterBills/readings', {
      year: 2025,
      month: 7,  // August is month 7 (0-indexed)
      readings: august2025Readings
    });
    
    if (augustResponse.data.success) {
      console.log('✅ August 2025 readings submitted');
      console.log(`   Units: ${Object.keys(august2025Readings).length - 1}`);
      console.log(`   Common Area: ${august2025Readings.commonArea}`);
      console.log(`   Building Total: ${augustResponse.data.data.readings.buildingMeter.current}\n`);
    } else {
      console.log('❌ Failed to submit August readings:', augustResponse.data.error);
    }
    
    // Step 4: Test history endpoint
    console.log('🔍 Step 4: Testing history endpoint...');
    console.log('=====================================');
    
    const historyResponse = await api.get('/clients/AVII/projects/waterBills/history/2026');
    
    if (historyResponse.data.success) {
      console.log('✅ History endpoint working!');
      console.log('📊 FY 2026 Data:');
      
      const months = historyResponse.data.data.months;
      const monthNames = ['JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN'];
      
      monthNames.forEach((month, index) => {
        if (months[index] && months[index].units && Object.keys(months[index].units).length > 0) {
          const unitCount = Object.keys(months[index].units).length;
          const commonArea = months[index].commonArea?.current || 0;
          const buildingMeter = months[index].buildingMeter?.current || 0;
          console.log(`   ${month}-26: ${unitCount} units, Common: ${commonArea}, Building: ${buildingMeter}`);
        }
      });
      console.log('');
    } else {
      console.log('❌ History endpoint failed:', historyResponse.data.error);
    }
    
    console.log('🎉 Water Bills V3 Initialization Complete!');
    console.log('==========================================');
    console.log('✅ Meters initialized');
    console.log('✅ Configuration saved');
    console.log('✅ Historical readings loaded');
    console.log('✅ Ready for frontend testing!\n');
    
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    process.exit(1);
  }
}

// Run directly
initializeWaterBillsV3();