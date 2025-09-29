#!/usr/bin/env node
/**
 * Test script to debug timezone issues in transaction ID generation
 * Investigates why IDs are creating date-1 timestamps
 */

import databaseFieldMappings from '../backend/utils/databaseFieldMappings.js';

const { generateTransactionId } = databaseFieldMappings;

async function testIdGeneration() {
  console.log('🔍 Testing Transaction ID Generation with Timezone Handling\n');
  
  // Test dates to check
  const testDates = [
    '2025-01-07T22:30:00.000Z',  // Late evening UTC (could be previous day in some timezones)
    '2025-01-07T00:00:00.000Z',  // Midnight UTC
    '2025-01-07T12:00:00.000Z',  // Noon UTC
    '2025-01-07T23:59:59.000Z',  // End of day UTC
    '2025-01-07T05:00:00.000Z',  // Midnight Cancun time (UTC-5)
    '2025-01-07T15:51:22-05:00', // Direct Cancun timezone format
    new Date('2025-01-07T22:30:00.000Z').toISOString(), // Current time as ISO
    new Date().toISOString()     // Current time
  ];
  
  console.log('Testing ID generation for various dates:\n');
  
  for (const testDate of testDates) {
    const date = new Date(testDate);
    
    // Get the Cancun time components
    const cancunTimeString = date.toLocaleString("en-CA", {
      timeZone: "America/Cancun",
      year: "numeric",
      month: "2-digit", 
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
    
    // Generate the ID
    const id = await generateTransactionId(testDate);
    
    console.log(`Input Date: ${testDate}`);
    console.log(`  UTC Time: ${date.toISOString()}`);
    console.log(`  Cancun Time: ${cancunTimeString}`);
    console.log(`  Generated ID: ${id}`);
    console.log(`  ID Date Part: ${id.split('_')[0]}`);
    console.log('---');
  }
  
  // Test the specific problematic scenario
  console.log('\n🔍 Testing specific scenario from transactionsController.js:\n');
  
  const transactionDate = new Date('2025-01-07T12:00:00.000Z'); // Transaction date
  const now = new Date('2025-01-07T22:30:00.000Z'); // Current time when creating
  
  // Simulate what the controller does
  const dateForId = new Date(
    transactionDate.getFullYear(),
    transactionDate.getMonth(),
    transactionDate.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds()
  );
  
  console.log('Transaction Date:', transactionDate.toISOString());
  console.log('Current Time:', now.toISOString());
  console.log('Combined dateForId:', dateForId.toISOString());
  
  const id = await generateTransactionId(dateForId.toISOString());
  console.log('Generated ID:', id);
  
  // Analyze the date construction
  console.log('\nDate construction analysis:');
  console.log('  Year:', transactionDate.getFullYear());
  console.log('  Month (0-based):', transactionDate.getMonth());
  console.log('  Date:', transactionDate.getDate());
  console.log('  Hours:', now.getHours());
  console.log('  Minutes:', now.getMinutes());
  console.log('  Seconds:', now.getSeconds());
  
  // Show what happens in Cancun timezone
  console.log('\nCancun timezone analysis:');
  const cancunFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Cancun',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  console.log('  dateForId in Cancun:', cancunFormatter.format(dateForId));
  console.log('  dateForId UTC hours:', dateForId.getUTCHours());
  console.log('  If UTC hours >= 19, it\'s the next day in Cancun (UTC-5)');
  
  process.exit(0);
}

testIdGeneration().catch(console.error);