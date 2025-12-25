#!/usr/bin/env node
/**
 * Generate Q2 Water Bill for AVII
 * 
 * This script calls the water bills generate API to create Q2 (Oct-Dec) bill
 * for fiscal year 2026.
 * 
 * Usage:
 *   node scripts/generate-q2-water-bill.js          # Dev environment
 * 
 * Prerequisites:
 *   - Backend running on localhost:5001
 *   - Q1 data restored (not overwritten)
 */

import { testHarness } from '../functions/backend/testing/testHarness.js';

const CLIENT_ID = 'AVII';
const FISCAL_YEAR = 2026;
const QUARTER = 2;
const DUE_DATE = '2026-01-10';  // January 10, 2026

async function main() {
  console.log('='.repeat(60));
  console.log('Generate Q2 Water Bill for AVII');
  console.log('='.repeat(60));
  console.log(`Client: ${CLIENT_ID}`);
  console.log(`Fiscal Year: ${FISCAL_YEAR}`);
  console.log(`Quarter: Q${QUARTER} (Oct-Dec 2025)`);
  console.log(`Due Date: ${DUE_DATE}`);
  console.log('');
  
  const result = await testHarness.runTest({
    name: 'Generate Q2 Water Bill',
    async test({ api }) {
      console.log('📡 Calling generate API...');
      
      const response = await api.request({
        method: 'POST',
        url: `/water/clients/${CLIENT_ID}/bills/generate`,
        data: {
          year: FISCAL_YEAR,
          quarter: QUARTER,
          dueDate: DUE_DATE
        }
      });
      
      // testHarness expects { passed: true }, API returns { success: true }
      return { 
        passed: response.data?.success === true,
        data: response.data
      };
    }
  });
  
  console.log('');
  
  if (result.passed) {
    console.log('✅ Q2 Bill Generated Successfully!');
    console.log('');
    console.log('Response:', JSON.stringify(result.result?.data || result.result, null, 2));
    console.log('');
    console.log('Next steps:');
    console.log('  1. Check Firestore for 2026-Q2 document');
    console.log('  2. Verify dueDate is 2026-01-10 (not 2027-01-10)');
    console.log('  3. Check Statement of Accounts for AVII unit');
  } else {
    console.error('❌ Failed to generate Q2 bill:');
    console.error(`   ${result.error || 'Unknown error'}`);
    
    if (result.error?.includes('existing payments')) {
      console.log('');
      console.log('ℹ️  The overwrite protection is working correctly.');
      console.log('   Q2 already exists and has payments.');
    }
  }
  
  console.log('');
  console.log('='.repeat(60));
}

// Run
main().catch(error => {
  console.error('Script error:', error.message);
  process.exit(1);
});
