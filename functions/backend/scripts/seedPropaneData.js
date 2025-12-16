// Script to seed propane tank data from CSV
// Run with: node backend/scripts/seedPropaneData.js
// CSV format: Date,docId,1A,1B,1C,2A,2C,PH1A,PH2B,PH3C,PH4D
// Date format: "Fri, Jan 5, 2024" (actual date readings were taken)
// docId format: "2024-00" (used as document name)
// Values format: "90%" (percentage with % sign)

import fs from 'fs';
import csv from 'csv-parser';
import admin from 'firebase-admin';
import { initializeFirebase, getDb } from '../firebase.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CSV file path - update this to point to your CSV file
const CSV_PATH = '/Users/michael/Projects/SAMS-Docs/docs/Report Samples/propaneTank.csv';

const CLIENT_ID = 'MTC';
const FISCAL_YEAR_START = 1; // January (MTC fiscal year)

/**
 * Parse docId string like "2024-00" to year and month
 * Format: "{year}-{month}" where month is 0-based (0-11)
 */
function parseDocId(docIdStr) {
  if (!docIdStr) {
    throw new Error('docId is required');
  }
  
  const parts = docIdStr.split('-');
  if (parts.length !== 2) {
    throw new Error(`Invalid docId format: ${docIdStr}. Expected format: "YYYY-MM"`);
  }
  
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  
  if (isNaN(year) || isNaN(month)) {
    throw new Error(`Invalid docId format: ${docIdStr}. Year and month must be numbers`);
  }
  
  if (month < 0 || month > 11) {
    throw new Error(`Invalid month in docId: ${docIdStr}. Month must be 0-11`);
  }
  
  return { year, month };
}

/**
 * Parse date string like "Fri, Jan 5, 2024" to a Date object
 * This is stored as the actual reading date
 */
function parseReadingDate(dateStr) {
  if (!dateStr) return null;
  
  // Remove day of week prefix if present (e.g., "Fri, ")
  const cleanDate = dateStr.replace(/^[A-Za-z]+,?\s*/, '');
  
  // Parse date
  const date = new Date(cleanDate);
  if (isNaN(date.getTime())) {
    console.warn(`Warning: Could not parse date "${dateStr}", storing as string`);
    return dateStr; // Fallback to string if parsing fails
  }
  
  return admin.firestore.Timestamp.fromDate(date);
}

/**
 * Parse level string like "90%" to integer
 */
function parseLevel(levelStr) {
  if (!levelStr || levelStr === '') return null;
  
  // Remove % sign and whitespace
  const cleaned = levelStr.toString().replace(/%/g, '').trim();
  const level = parseInt(cleaned, 10);
  
  if (isNaN(level)) {
    console.warn(`Warning: Could not parse level "${levelStr}", skipping`);
    return null;
  }
  
  // Validate range
  if (level < 0 || level > 100) {
    console.warn(`Warning: Level ${level} is out of range (0-100), skipping`);
    return null;
  }
  
  return level;
}

async function seedPropaneData() {
  try {
    console.log('🚀 Starting propane data seeding...');
    
    // Check if CSV file exists
    if (!fs.existsSync(CSV_PATH)) {
      throw new Error(`CSV file not found: ${CSV_PATH}`);
    }
    
    // Initialize Firebase
    await initializeFirebase();
    const db = await getDb();
    
    console.log('✅ Firebase initialized');
    console.log(`📖 Reading CSV from: ${CSV_PATH}`);
    
    // Parse CSV file
    const readings = [];
    
    await new Promise((resolve, reject) => {
      fs.createReadStream(CSV_PATH)
        .pipe(csv())
        .on('data', (row) => {
          try {
            // Get docId (required - used as document name)
            const docId = row.docId || row.DocId || row.DOCID;
            if (!docId) {
              console.warn('Skipping row with no docId:', row);
              return;
            }
            
            // Parse docId to get year and month
            const { year, month } = parseDocId(docId);
            
            // Get reading date (actual date readings were taken)
            const dateStr = row.Date || row.date;
            const readingDate = parseReadingDate(dateStr);
            
            // Extract readings for each unit
            const unitReadings = {};
            const unitIds = ['1A', '1B', '1C', '2A', '2C', 'PH1A', 'PH2B', 'PH3C', 'PH4D'];
            
            unitIds.forEach(unitId => {
              const levelStr = row[unitId];
              if (levelStr !== undefined && levelStr !== '') {
                const level = parseLevel(levelStr);
                if (level !== null) {
                  unitReadings[unitId] = { level };
                }
              }
            });
            
            // Only add if we have at least one reading
            if (Object.keys(unitReadings).length > 0) {
              readings.push({
                docId, // Store docId for document naming
                year,
                month,
                readingDate, // Store actual reading date
                readings: unitReadings
              });
            }
          } catch (error) {
            console.error(`Error parsing row:`, row, error);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });
    
    console.log(`✅ Parsed ${readings.length} readings from CSV`);
    
    // Group by year-month and save to Firestore
    const readingsRef = db
      .collection('clients').doc(CLIENT_ID)
      .collection('projects').doc('propaneTanks')
      .collection('readings');
    
    // Ensure project document exists
    const projectRef = db
      .collection('clients').doc(CLIENT_ID)
      .collection('projects').doc('propaneTanks');
    
    const projectDoc = await projectRef.get();
    if (!projectDoc.exists) {
      await projectRef.set({
        _purgeMarker: 'DO_NOT_DELETE',
        _createdBy: 'seedPropaneData',
        _createdAt: admin.firestore.FieldValue.serverTimestamp(),
        _structure: 'propaneTanks'
      });
      console.log('✅ Created propaneTanks project document');
    }
    
    // Save readings
    let savedCount = 0;
    let skippedCount = 0;
    
    for (const reading of readings) {
      // Use docId directly from CSV as document name
      const docId = reading.docId;
      const docRef = readingsRef.doc(docId);
      
      // Check if document already exists
      const existingDoc = await docRef.get();
      if (existingDoc.exists) {
        console.log(`⏭️  Skipping ${docId} - already exists`);
        skippedCount++;
        continue;
      }
      
      // Build document data
      const docData = {
        year: reading.year,
        month: reading.month,
        readings: reading.readings,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        _importedBy: 'seedPropaneData',
        _importedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      // Add reading date if available
      if (reading.readingDate) {
        docData.readingDate = reading.readingDate;
      }
      
      // Save document
      await docRef.set(docData);
      
      savedCount++;
      console.log(`✅ Saved ${docId}: ${Object.keys(reading.readings).length} units${reading.readingDate ? ` (date: ${reading.readingDate})` : ''}`);
    }
    
    console.log('\n📊 Seeding Summary:');
    console.log(`   Total rows parsed: ${readings.length}`);
    console.log(`   Documents saved: ${savedCount}`);
    console.log(`   Documents skipped (already exist): ${skippedCount}`);
    console.log('✅ Propane data seeding complete!');
    
  } catch (error) {
    console.error('❌ Error seeding propane data:', error);
    process.exit(1);
  }
}

seedPropaneData();
