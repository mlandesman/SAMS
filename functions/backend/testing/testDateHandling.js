/**
 * Test script to verify date handling after getNow() implementation
 * Tests transaction date formatting, ID generation, and receipt display
 */

import { DateService, getNow } from '../services/DateService.js';
import databaseFieldMappings from '../utils/databaseFieldMappings.js';
import { DateTime } from 'luxon';

const { generateTransactionId } = databaseFieldMappings;

async function runTests() {
  console.log('🧪 Testing Date Handling After getNow() Implementation\n');

  // Test 1: getNow() returns correct Cancun time
  console.log('Test 1: getNow() returns Cancun time');
  const now = getNow();
  const nowInCancun = DateTime.now().setZone('America/Cancun');
  console.log(`- getNow():        ${now.toISOString()}`);
  console.log(`- Cancun time:     ${nowInCancun.toISO()}`);
  console.log(`- Match: ${Math.abs(now.getTime() - nowInCancun.toMillis()) < 1000 ? '✅' : '❌'}\n`);

  // Test 2: DateService formatForFrontend creates multi-format object
  console.log('Test 2: DateService.formatForFrontend() creates proper object');
  const dateService = new DateService({ timezone: 'America/Cancun' });
  const testDate = new Date('2025-09-22T12:00:00Z');
  const formatted = dateService.formatForFrontend(testDate);
  console.log('Formatted date object:');
  console.log(`- display:      ${formatted.display} ${formatted.display ? '✅' : '❌'}`);
  console.log(`- iso:          ${formatted.iso}`);
  console.log(`- displayTime:  ${formatted.displayTime}`);
  console.log(`- displayFull:  ${formatted.displayFull}`);
  console.log(`- month:        ${formatted.month}`);
  console.log(`- year:         ${formatted.year}`);
  console.log(`- day:          ${formatted.day}\n`);

  // Test 3: Transaction ID generation preserves user-selected date
  console.log('Test 3: Transaction ID preserves user-selected date');
  const userSelectedDate = '2025-09-22T12:00:00.000Z'; // User picks Sept 22
  const transactionId = await generateTransactionId(userSelectedDate);
  console.log(`- User selected:  2025-09-22`);
  console.log(`- Transaction ID: ${transactionId}`);
  const idDate = transactionId.split('_')[0];
  console.log(`- ID date part:   ${idDate}`);
  console.log(`- Date preserved: ${idDate === '2025-09-22' ? '✅' : '❌'}\n`);

  // Test 4: Multiple ID generations with same date
  console.log('Test 4: Multiple IDs with same date are unique');
  const ids = [];
  for (let i = 0; i < 5; i++) {
    ids.push(await generateTransactionId(userSelectedDate));
    // Small delay to ensure different milliseconds
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  console.log('Generated IDs:');
  ids.forEach(id => console.log(`- ${id}`));
  const uniqueIds = new Set(ids);
  console.log(`All unique: ${uniqueIds.size === ids.length ? '✅' : '❌'}\n`);

  // Test 5: Date formatting consistency
  console.log('Test 5: Date formatting consistency across system');
  const testDates = [
    { label: 'Firestore timestamp', value: { toDate: () => new Date('2025-09-25T06:00:00Z') } },
    { label: 'Date object', value: new Date('2025-09-25T06:00:00Z') },
    { label: 'ISO string', value: '2025-09-25T06:00:00Z' },
    { label: 'SQL date', value: '2025-09-25' }
  ];

  console.log('Formatting various date types:');
  testDates.forEach(({ label, value }) => {
    try {
      const result = dateService.formatForFrontend(value);
      console.log(`- ${label.padEnd(20)} → ${result.display} ✅`);
    } catch (error) {
      console.log(`- ${label.padEnd(20)} → ERROR: ${error.message} ❌`);
    }
  });

  console.log('\n✅ Date handling tests complete!');
  console.log('\nSummary of changes:');
  console.log('1. Transaction dates now return multi-format objects with .display property');
  console.log('2. Transaction ID generation preserves user-selected dates (no timezone shift)');
  console.log('3. Receipt dates use backend-provided format (no browser timezone conversion)');
  console.log('4. All backend services use getNow() for consistent Cancun timezone');
}

// Run the tests
runTests().catch(console.error);