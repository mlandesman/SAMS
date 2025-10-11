// Test consumption calculation with object-based readings
import { waterDataService } from '../services/waterDataService.js';

console.log('Testing consumption calculation with object-based readings...\n');

// Simulate the exact data structure from Firebase
const testData = {
  // July 2025 - mixed format (number for prior, object for current)
  july2025: {
    priorReadings: {
      '101': 1749,  // number
      '102': 7      // number
    },
    currentReadings: {
      '101': { reading: 1767 },  // object
      '102': { reading: 26 }     // object
    }
  },
  // August 2025 - both as objects
  august2025: {
    priorReadings: {
      '101': { reading: 1767 },  // object
      '102': { reading: 26 }     // object
    },
    currentReadings: {
      '101': { reading: 1774 },  // object
      '102': { reading: 30 }     // object
    }
  }
};

// Test extraction logic
function testExtraction(unitId, priorReadings, currentReadings) {
  console.log(`\nTesting Unit ${unitId}:`);
  console.log(`  Raw prior:`, JSON.stringify(priorReadings[unitId]));
  console.log(`  Raw current:`, JSON.stringify(currentReadings[unitId]));
  
  // Extract current reading
  let currentReading = currentReadings[unitId] || 0;
  if (typeof currentReading === 'object' && currentReading.reading !== undefined) {
    currentReading = currentReading.reading;
  }
  console.log(`  Extracted current:`, currentReading);
  
  // Extract prior reading
  let priorReading = priorReadings[unitId] || 0;
  if (typeof priorReading === 'object' && priorReading.reading !== undefined) {
    priorReading = priorReading.reading;
  }
  console.log(`  Extracted prior:`, priorReading);
  
  // Calculate consumption
  const consumption = currentReading - priorReading;
  console.log(`  Consumption: ${currentReading} - ${priorReading} = ${consumption}`);
  console.log(`  Type:`, typeof consumption);
  console.log(`  Is NaN:`, isNaN(consumption));
  console.log(`  Is null:`, consumption === null);
  
  return consumption;
}

// Test July 2025 (mixed format)
console.log('\n=== JULY 2025 (Mixed Format) ===');
testExtraction('101', testData.july2025.priorReadings, testData.july2025.currentReadings);
testExtraction('102', testData.july2025.priorReadings, testData.july2025.currentReadings);

// Test August 2025 (both objects)
console.log('\n=== AUGUST 2025 (Both Objects) ===');
testExtraction('101', testData.august2025.priorReadings, testData.august2025.currentReadings);
testExtraction('102', testData.august2025.priorReadings, testData.august2025.currentReadings);

// Test direct calculation
console.log('\n=== DIRECT CALCULATION TEST ===');
const test1 = 1774 - 1767;
console.log(`Direct: 1774 - 1767 = ${test1} (type: ${typeof test1})`);

const reading1 = { reading: 1774 };
const reading2 = { reading: 1767 };
const test2 = reading1 - reading2;
console.log(`Objects: {reading:1774} - {reading:1767} = ${test2} (type: ${typeof test2})`);

const extracted1 = reading1.reading;
const extracted2 = reading2.reading;
const test3 = extracted1 - extracted2;
console.log(`Extracted: ${extracted1} - ${extracted2} = ${test3} (type: ${typeof test3})`);

console.log('\nDone.');