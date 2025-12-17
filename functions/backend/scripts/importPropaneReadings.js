/**
 * Import Propane Tank Readings from CSV
 * 
 * Usage:
 *   node backend/scripts/importPropaneReadings.js [prod|dev]
 * 
 * Imports to: clients/MTC/projects/propaneTanks/readings/{YYYY-MM}
 */

import admin from 'firebase-admin';
import fs from 'fs';

const ENV = process.argv[2] || 'dev';
const CLIENT_ID = 'MTC';

// Initialize Firebase based on environment (using Application Default Credentials)
function initFirebase() {
  if (ENV === 'prod') {
    admin.initializeApp({
      projectId: 'sams-sandyland-prod',
      storageBucket: 'sams-sandyland-prod.firebasestorage.app'
    });
    console.log('🔥 Connected to PRODUCTION (using ADC)');
  } else {
    admin.initializeApp({
      projectId: 'sandyland-management-system',
      storageBucket: 'sandyland-management-system.firebasestorage.app'
    });
    console.log('🔥 Connected to DEV (using ADC)');
  }
  return admin.firestore();
}

// Parse date string like "Fri, Jan 5, 2024" to { year, month }
function parseDate(dateStr) {
  const date = new Date(dateStr);
  return {
    year: date.getFullYear(),
    month: date.getMonth(), // 0-indexed (Jan = 0)
    day: date.getDate(),
    fullDate: date
  };
}

// Parse percentage string like "70%" to number 70
function parsePercentage(pctStr) {
  return parseInt(pctStr.replace('%', ''), 10);
}

// Parse CSV content
function parseCSV(content) {
  // Normalize line endings and remove any BOM
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/^\uFEFF/, '');
  const lines = normalizedContent.trim().split('\n');
  const headers = lines[0].split(',');
  const unitIds = headers.slice(1); // Skip 'Date' column
  
  console.log(`  Units found: ${unitIds.join(', ')}`);
  
  const readings = [];
  
  for (let i = 1; i < lines.length; i++) {
    // Handle quoted date field - more flexible parsing
    const line = lines[i].trim();
    if (!line) continue;
    
    // Split by comma but handle quoted fields
    let dateStr, values;
    if (line.startsWith('"')) {
      // Find the closing quote
      const endQuote = line.indexOf('",', 1);
      if (endQuote === -1) {
        console.warn(`Skipping malformed line ${i}: ${line.substring(0, 50)}...`);
        continue;
      }
      dateStr = line.substring(1, endQuote);
      values = line.substring(endQuote + 2).split(',');
    } else {
      const parts = line.split(',');
      dateStr = parts[0];
      values = parts.slice(1);
    }
    
    const { year, month, day, fullDate } = parseDate(dateStr);
    
    if (isNaN(year) || isNaN(month)) {
      console.warn(`Skipping line ${i} with invalid date: ${dateStr}`);
      continue;
    }
    
    const readingData = {
      date: dateStr,
      year,
      month,
      day,
      fullDate,
      readings: {}
    };
    
    unitIds.forEach((unitId, idx) => {
      const val = values[idx] ? parsePercentage(values[idx]) : 0;
      readingData.readings[unitId.trim()] = val;
    });
    
    readings.push(readingData);
  }
  
  return readings;
}

// Group readings by year-month (using the last reading of each month)
function groupByMonth(readings) {
  const grouped = {};
  
  for (const reading of readings) {
    const key = `${reading.year}-${String(reading.month).padStart(2, '0')}`;
    // Keep the latest reading for each month (overwrite if exists)
    if (!grouped[key] || reading.day > grouped[key].day) {
      grouped[key] = reading;
    }
  }
  
  return grouped;
}

async function importReadings(db, readings) {
  const grouped = groupByMonth(readings);
  
  // Ensure propaneTanks document exists
  const propaneTanksRef = db
    .collection('clients').doc(CLIENT_ID)
    .collection('projects').doc('propaneTanks');
  
  const propaneTanksDoc = await propaneTanksRef.get();
  if (!propaneTanksDoc.exists) {
    console.log('📝 Creating propaneTanks document...');
    await propaneTanksRef.set({
      _purgeMarker: 'DO_NOT_DELETE',
      _createdBy: 'importPropaneReadings',
      _createdAt: admin.firestore.FieldValue.serverTimestamp(),
      _structure: 'propaneTanks'
    });
  }
  
  // Import each month's readings
  const batch = db.batch();
  let count = 0;
  
  for (const [monthKey, data] of Object.entries(grouped)) {
    const docRef = propaneTanksRef.collection('readings').doc(monthKey);
    
    const docData = {
      year: data.year,
      month: data.month,
      readings: data.readings,
      recordedDate: data.date,
      importedAt: admin.firestore.FieldValue.serverTimestamp(),
      importedFrom: 'propaneTankscsv.csv'
    };
    
    batch.set(docRef, docData);
    console.log(`  📊 ${monthKey}: year=${data.year}, month=${data.month}, ${Object.keys(data.readings).length} units`);
    count++;
  }
  
  await batch.commit();
  console.log(`\n✅ Imported ${count} monthly readings`);
}

async function main() {
  console.log(`\n🔧 Propane Readings Import Script`);
  console.log(`   Environment: ${ENV.toUpperCase()}`);
  console.log(`   Client: ${CLIENT_ID}\n`);
  
  const db = initFirebase();
  
  // Read CSV file
  const csvPath = '/Users/michael/My Drive (michael@landesman.com)/SAMS Import Data/MTCdata/propaneTankscsv.csv';
  
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV file not found: ${csvPath}`);
    process.exit(1);
  }
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  console.log(`📄 Read CSV file: ${csvPath}\n`);
  
  // Parse CSV
  const readings = parseCSV(csvContent);
  console.log(`📊 Parsed ${readings.length} readings\n`);
  
  // Import to Firestore
  console.log(`📤 Importing to clients/${CLIENT_ID}/projects/propaneTanks/readings/...`);
  await importReadings(db, readings);
  
  console.log(`\n🎉 Import complete!`);
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
