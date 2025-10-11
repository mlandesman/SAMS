#!/usr/bin/env node

/**
 * Test Water Bills Using Aggregation Service
 */

import { testHarness } from './testHarness.js';

const tests = [
  {
    name: 'Check Aggregated Data Structure',
    test: async ({ api }) => {
      // Get aggregated data for FY 2026
      const response = await api.get('/api/clients/AVII/water/data/2026');
      
      if (!response.success || !response.data) {
        throw new Error('Failed to get aggregated data');
      }
      
      const data = response.data.data;
      console.log(`   Fiscal Year: ${data.year}`);
      console.log(`   Total months: ${data.months.length}`);
      
      // Check July (month 0) data
      const july = data.months[0];
      console.log(`\n   July ${july.calendarYear} (Month 0):`);
      console.log(`   Units with readings: ${Object.keys(july.units).length}`);
      
      // Check a sample unit
      const unit101 = july.units['101'];
      if (unit101) {
        console.log(`\n   Unit 101 July data:`);
        console.log(`   - Prior: ${unit101.priorReading}`);
        console.log(`   - Current: ${unit101.currentReading}`);
        console.log(`   - Consumption: ${unit101.consumption} m³`);
        console.log(`   - Bill Amount: $${unit101.billAmount}`);
        console.log(`   - Status: ${unit101.status}`);
      }
      
      return { 
        passed: true, 
        data: july,
        message: 'Aggregated data structure verified'
      };
    }
  },
  {
    name: 'Generate Bills for July FY2026',
    test: async ({ api }) => {
      // First check aggregated data
      const dataResponse = await api.get('/api/clients/AVII/water/data/2026');
      const julyData = dataResponse.data.data.months[0]; // Month 0 = July
      
      // Check if we have readings but no bills
      const hasReadings = Object.values(julyData.units).some(u => u.currentReading > 0);
      const hasBills = Object.values(julyData.units).some(u => u.billAmount > 0);
      
      console.log(`   Has readings: ${hasReadings}`);
      console.log(`   Has bills: ${hasBills}`);
      
      if (!hasReadings) {
        throw new Error('No readings found for July - cannot generate bills');
      }
      
      if (hasBills) {
        console.log('   Bills already exist for July');
        return { passed: true, message: 'Bills already generated' };
      }
      
      // Generate bills
      console.log('\n   Generating bills for July FY2026...');
      const billResponse = await api.post('/api/clients/AVII/water/bills/generate', {
        year: 2026,
        month: 0  // July
      });
      
      if (!billResponse.success || !billResponse.data) {
        throw new Error('Failed to generate bills');
      }
      
      const bills = billResponse.data.data;  // Note: response.data.data
      console.log(`   ✅ Generated bills for ${bills.summary.totalUnits} units`);
      console.log(`   Total billed: ${bills.summary.currencySymbol}${bills.summary.totalBilled.toFixed(2)}`);
      
      // Verify a sample calculation
      const firstUnit = Object.entries(bills.bills.units)[0];
      if (firstUnit) {
        const [unitId, bill] = firstUnit;
        const rateInPesos = bills.configSnapshot.ratePerM3 / 100;
        const expectedAmount = bill.consumption * rateInPesos;
        
        console.log(`\n   Sample calculation for Unit ${unitId}:`);
        console.log(`   - Consumption: ${bill.consumption} m³`);
        console.log(`   - Rate: $${rateInPesos.toFixed(2)}/m³`);
        console.log(`   - Amount: $${bill.baseAmount.toFixed(2)}`);
        
        const correct = Math.abs(bill.baseAmount - expectedAmount) < 0.01;
        if (!correct) {
          throw new Error(`Bill amount incorrect: expected ${expectedAmount}, got ${bill.baseAmount}`);
        }
      }
      
      return { 
        passed: true, 
        data: bills,
        message: `Bills generated: ${bills.summary.totalUnits} units, total ${bills.summary.currencySymbol}${bills.summary.totalBilled.toFixed(2)}`
      };
    }
  },
  {
    name: 'Verify Bills Appear in Aggregated Data',
    test: async ({ api }) => {
      // Fetch updated aggregated data
      const response = await api.get('/api/clients/AVII/water/data/2026');
      const julyData = response.data.data.months[0];
      
      // Check that bills now exist
      const unit101 = julyData.units['101'];
      if (!unit101) {
        throw new Error('Unit 101 not found in aggregated data');
      }
      
      if (unit101.billAmount === 0) {
        console.log('   ⚠️  Bill not yet reflected in aggregated data');
        console.log('   This may be due to cache - waiting for invalidation...');
        
        // Try clearing cache manually
        await api.post('/api/clients/AVII/water/cache/clear');
        
        // Fetch again
        const retryResponse = await api.get('/api/clients/AVII/water/data/2026');
        const retryJuly = retryResponse.data.data.months[0];
        const retryUnit101 = retryJuly.units['101'];
        
        if (retryUnit101.billAmount === 0) {
          throw new Error('Bill still not reflected after cache clear');
        }
      }
      
      console.log(`   ✅ Unit 101 bill: $${unit101.billAmount.toFixed(2)}`);
      console.log(`   - Consumption: ${unit101.consumption} m³`);
      console.log(`   - Status: ${unit101.status}`);
      console.log(`   - Unpaid: $${unit101.unpaidAmount.toFixed(2)}`);
      
      return { 
        passed: true,
        message: 'Bills successfully reflected in aggregated data'
      };
    }
  },
  {
    name: 'Generate Bills for August FY2026',
    test: async ({ api }) => {
      // Check August data
      const dataResponse = await api.get('/api/clients/AVII/water/data/2026');
      const augustData = dataResponse.data.data.months[1]; // Month 1 = August
      
      const hasReadings = Object.values(augustData.units).some(u => u.currentReading > 0);
      const hasBills = Object.values(augustData.units).some(u => u.billAmount > 0);
      
      if (!hasReadings) {
        console.log('   No readings for August - skipping');
        return { passed: true, message: 'No August readings to bill' };
      }
      
      if (hasBills) {
        console.log('   Bills already exist for August');
        return { passed: true, message: 'August bills already generated' };
      }
      
      // Generate bills
      console.log('   Generating bills for August FY2026...');
      const billResponse = await api.post('/api/clients/AVII/water/bills/generate', {
        year: 2026,
        month: 1  // August
      });
      
      const bills = billResponse.data.data;  // Note: response.data.data
      console.log(`   ✅ Generated bills for ${bills.summary.totalUnits} units`);
      console.log(`   Total: ${bills.summary.currencySymbol}${bills.summary.totalBilled.toFixed(2)}`);
      
      return { 
        passed: true,
        data: bills,
        message: `August bills generated successfully`
      };
    }
  }
];

// Run tests
testHarness.runTests(tests)
  .then(() => {
    console.log('\n✅ All tests completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });