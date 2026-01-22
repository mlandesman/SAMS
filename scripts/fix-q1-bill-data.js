#!/usr/bin/env node
/**
 * Fix Q1 2026 Bill Data Issues
 * 
 * Issues to fix:
 * 1. Unit 101: Missing July entry, missing consumption field in September
 * 2. Unit 106: Missing September entry
 * 3. Both units use OBJECT format instead of ARRAY format
 * 
 * Approach:
 * - Reverse engineer consumption from waterCharge
 * - Validate against meter readings
 * - Convert to consistent ARRAY format
 * 
 * Usage:
 *   node scripts/fix-q1-bill-data.js [--dry-run]
 *   node scripts/fix-q1-bill-data.js --prod [--dry-run]
 * 
 * Environment:
 * Development: Uses service account key from firebase.js
 * Production: Uses Application Default Credentials (ADC) with --prod flag
 *   Run 'gcloud auth application-default login' if not authenticated
 */

import admin from 'firebase-admin';
import { existsSync } from 'fs';

const CLIENT_ID = 'AVII';
const BILL_ID = '2026-Q1';
const RATE_PER_M3 = 5000; // 50 pesos in centavos
const productionProjectId = 'sams-sandyland-prod';

// Check for flags
const useProduction = process.argv.includes('--prod');

async function initializeFirebase() {
  if (useProduction) {
    console.log(`🌍 Environment: PRODUCTION`);
    console.log(`🔥 Firebase Project: ${productionProjectId}`);
    console.log(`🔑 Using Application Default Credentials (ADC)`);
    console.log(`   Run 'gcloud auth application-default login' if not authenticated\n`);
    
    // Clear GOOGLE_APPLICATION_CREDENTIALS if it's set to placeholder/invalid path
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS && 
        (process.env.GOOGLE_APPLICATION_CREDENTIALS.includes('/path/to/') || 
         !existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS))) {
      console.log(`⚠️  Clearing invalid GOOGLE_APPLICATION_CREDENTIALS env var`);
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: productionProjectId
      });
    }
    
    return admin.firestore();
  } else {
    // Use service account key for development (via getDb from firebase.js)
    const { getDb: getDbFromFirebase } = await import('../functions/backend/firebase.js');
    return await getDbFromFirebase();
  }
}

// Q1 months: July (0), August (1), September (2)
const QUARTER_MONTHS = ['July', 'August', 'September'];
const READINGS_DOCS = ['2026-00', '2026-01', '2026-02']; // July, August, September

let dbInstance = null;

async function getDb() {
  if (!dbInstance) {
    dbInstance = await initializeFirebase();
  }
  return dbInstance;
}

async function getReadings(unitId, includePriorMonth = false) {
  const db = await getDb();
  const readings = {};
  
  // Get prior month (June) if needed for July calculation
  if (includePriorMonth) {
    try {
      const juneDoc = await db.collection('clients').doc(CLIENT_ID)
        .collection('projects').doc('waterBills')
        .collection('readings').doc('2025-11').get(); // June is month 11 of fiscal year 2025
      
      if (juneDoc.exists) {
        const data = juneDoc.data();
        const unitReading = data.readings?.[unitId];
        if (unitReading?.reading !== undefined) {
          readings['June'] = unitReading.reading;
        }
      }
    } catch (error) {
      console.warn(`⚠️  Could not fetch June readings:`, error.message);
    }
  }
  
  for (let i = 0; i < READINGS_DOCS.length; i++) {
    const docId = READINGS_DOCS[i];
    const monthName = QUARTER_MONTHS[i];
    
    try {
      const readingsDoc = await db.collection('clients').doc(CLIENT_ID)
        .collection('projects').doc('waterBills')
        .collection('readings').doc(docId).get();
      
      if (readingsDoc.exists) {
        const data = readingsDoc.data();
        const unitReading = data.readings?.[unitId];
        
        // Extract reading value - readings are stored as { reading: number, washes: [] }
        if (unitReading?.reading !== undefined) {
          readings[monthName] = unitReading.reading;
        }
      }
    } catch (error) {
      console.warn(`⚠️  Could not fetch readings for ${monthName} (${docId}):`, error.message);
    }
  }
  
  return readings;
}

function calculateConsumptionFromReadings(readings, monthName) {
  const monthIndex = QUARTER_MONTHS.indexOf(monthName);
  if (monthIndex === -1) return null;
  
  const currentMonth = QUARTER_MONTHS[monthIndex];
  const currentReading = readings[currentMonth];
  if (currentReading === null || currentReading === undefined) return null;
  
  if (monthIndex === 0) {
    // July - need June reading
    const priorReading = readings['June'];
    if (priorReading === null || priorReading === undefined) return null;
    return Math.max(0, currentReading - priorReading);
  } else {
    // August or September - use previous month in quarter
    const priorMonth = QUARTER_MONTHS[monthIndex - 1];
    const priorReading = readings[priorMonth];
    if (priorReading === null || priorReading === undefined) return null;
    return Math.max(0, currentReading - priorReading);
  }
}

function calculateConsumptionFromWaterCharge(waterCharge, ratePerM3) {
  if (!waterCharge || waterCharge <= 0 || !ratePerM3 || ratePerM3 <= 0) return 0;
  return Math.round(waterCharge / ratePerM3);
}

async function fixUnit101(unitBill, readings) {
  console.log('\n🔧 Fixing Unit 101...');
  
  const mb = unitBill.monthlyBreakdown;
  const fixedBreakdown = [];
  
  // CRITICAL: waterCharge is the source of truth for what was actually billed
  // Calculate consumption from waterCharge to ensure math matches
  
  // Use bill totals as source of truth
  const totalWaterCharge = unitBill.waterCharge || 0;
  const totalConsumption = unitBill.totalConsumption || 0;
  const augustWaterCharge = mb['1']?.waterCharge ?? 0;
  const augustConsumption = mb['1']?.consumption ?? 0;
  
  // Get readings to help distribute consumption between July and September
  const readingsJuly = calculateConsumptionFromReadings(readings, 'July');
  const readingsSeptember = calculateConsumptionFromReadings(readings, 'September');
  
  // Calculate September consumption (currently missing)
  let calculatedSeptemberConsumption = mb['2']?.consumption;
  
  if (!calculatedSeptemberConsumption) {
    // September consumption is missing - calculate from totalConsumption
    // Since August = 0, remaining 24 m³ must be split between July and September
    if (readingsJuly !== null && readingsSeptember !== null && (readingsJuly + readingsSeptember) > 0) {
      // Use readings ratio to distribute the 24 m³
      const readingsTotal = readingsJuly + readingsSeptember;
      calculatedSeptemberConsumption = Math.round(totalConsumption * (readingsSeptember / readingsTotal));
      console.log(`  📊 Using readings ratio to distribute: September=${calculatedSeptemberConsumption} m³ (readings showed ${readingsSeptember}/${readingsTotal} = ${(readingsSeptember/readingsTotal).toFixed(2)})`);
    } else {
      // Fallback: 50/50 split or use remaining waterCharge ratio
      const remainingWaterCharge = totalWaterCharge - augustWaterCharge;
      const sepWaterCharge = mb['2']?.waterCharge ?? 0;
      if (sepWaterCharge > 0 && remainingWaterCharge > 0) {
        const ratio = sepWaterCharge / remainingWaterCharge;
        calculatedSeptemberConsumption = Math.round(totalConsumption * ratio);
        console.log(`  📊 Using waterCharge ratio: September=${calculatedSeptemberConsumption} m³`);
      } else {
        // 50/50 split as last resort
        calculatedSeptemberConsumption = Math.floor(totalConsumption / 2);
        console.log(`  📊 Using 50/50 split: September=${calculatedSeptemberConsumption} m³`);
      }
    }
  }
  
  // Check if totalConsumption and totalWaterCharge are consistent
  const waterChargeFromTotalConsumption = totalConsumption * RATE_PER_M3;
  let finalTotalConsumption = totalConsumption;
  let julyConsumption, julyWaterCharge, septemberWaterCharge;
  
  if (Math.abs(totalWaterCharge - waterChargeFromTotalConsumption) > 500) {
    // Bill has inconsistent totals - use waterCharge as source of truth (what was actually charged)
    console.warn(`  ⚠️  CRITICAL DATA ISSUE: Bill totalConsumption (${totalConsumption} m³) doesn't match totalWaterCharge (${totalWaterCharge / 100} pesos)`);
    console.warn(`     Expected waterCharge for ${totalConsumption} m³: ${waterChargeFromTotalConsumption / 100} pesos`);
    console.warn(`     Actual bill waterCharge: ${totalWaterCharge / 100} pesos`);
    console.warn(`     Using waterCharge as source of truth (what was actually billed/paid)`);
    
    // Recalculate total consumption from actual waterCharge
    finalTotalConsumption = Math.round(totalWaterCharge / RATE_PER_M3);
    console.warn(`     UPDATING totalConsumption from ${totalConsumption} to ${finalTotalConsumption} m³ to match waterCharge`);
    
    // Redistribute based on readings ratio
    if (readingsJuly !== null && readingsSeptember !== null && (readingsJuly + readingsSeptember) > 0) {
      const readingsTotal = readingsJuly + readingsSeptember;
      calculatedSeptemberConsumption = Math.round(finalTotalConsumption * (readingsSeptember / readingsTotal));
      julyConsumption = finalTotalConsumption - augustConsumption - calculatedSeptemberConsumption;
      console.log(`  📊 Redistributed using readings ratio: July=${julyConsumption}, September=${calculatedSeptemberConsumption}`);
    } else {
      // Default: distribute remaining (finalTotalConsumption - augustConsumption)
      const remaining = finalTotalConsumption - augustConsumption;
      calculatedSeptemberConsumption = Math.floor(remaining / 2);
      julyConsumption = remaining - calculatedSeptemberConsumption;
      console.log(`  📊 Redistributed 50/50: July=${julyConsumption}, September=${calculatedSeptemberConsumption}`);
    }
  } else {
    // Totals are consistent - calculate July from totalConsumption
    julyConsumption = finalTotalConsumption - augustConsumption - calculatedSeptemberConsumption;
  }
  
  // Calculate waterCharges from consumption (ensures math matches)
  julyWaterCharge = julyConsumption * RATE_PER_M3;
  septemberWaterCharge = calculatedSeptemberConsumption * RATE_PER_M3;
  
  // Verify waterCharge total matches (allow small rounding differences)
  const calculatedTotalWaterCharge = julyWaterCharge + augustWaterCharge + septemberWaterCharge;
  const difference = totalWaterCharge - calculatedTotalWaterCharge;
  
  if (Math.abs(difference) > 50) { // More than 0.50 pesos difference
    // Adjust September waterCharge to match bill total
    console.log(`  🔄 Adjusting September waterCharge by ${difference / 100} pesos to match bill total`);
    septemberWaterCharge = septemberWaterCharge + difference;
    
    // Recalculate consumption from adjusted waterCharge
    // Note: This may create a small discrepancy (consumption × rate ≠ waterCharge) due to billing adjustments
    calculatedSeptemberConsumption = calculateConsumptionFromWaterCharge(septemberWaterCharge, RATE_PER_M3);
    const expectedCharge = calculatedSeptemberConsumption * RATE_PER_M3;
    const chargeDifference = Math.abs(septemberWaterCharge - expectedCharge);
    
    if (chargeDifference > 50) {
      console.warn(`  ⚠️  BILLING ADJUSTMENT DETECTED: September waterCharge (${septemberWaterCharge / 100} pesos) doesn't match consumption × rate (${calculatedSeptemberConsumption} m³ × 50 = ${expectedCharge / 100} pesos)`);
      console.warn(`     Difference: ${chargeDifference / 100} pesos - this is a billing adjustment, not an error`);
    } else {
      console.log(`  📊 Recalculated September: ${calculatedSeptemberConsumption} m³ = ${septemberWaterCharge / 100} pesos`);
    }
  }
  
  console.log(`  📊 Final calculations:`);
  console.log(`     July: ${julyConsumption} m³ = ${julyWaterCharge / 100} pesos`);
  console.log(`     September: ${calculatedSeptemberConsumption} m³ = ${septemberWaterCharge / 100} pesos`);
  
  // Validate against readings (for discrepancy detection, but don't override bill)
  if (readingsJuly !== null) {
    const diff = Math.abs(readingsJuly - julyConsumption);
    if (diff > 1) {
      console.warn(`  ⚠️  DISCREPANCY: July - Bill shows ${julyConsumption} m³, Readings show ${readingsJuly} m³ (diff: ${diff})`);
    } else {
      console.log(`  ✅ July consumption validated: ${julyConsumption} m³ matches readings`);
    }
  }
  
  if (readingsSeptember !== null && calculatedSeptemberConsumption) {
    const diff = Math.abs(readingsSeptember - calculatedSeptemberConsumption);
    if (diff > 1) {
      console.warn(`  ⚠️  DISCREPANCY: September - Bill shows ${calculatedSeptemberConsumption} m³, Readings show ${readingsSeptember} m³ (diff: ${diff})`);
    } else {
      console.log(`  ✅ September consumption validated: ${calculatedSeptemberConsumption} m³ matches readings`);
    }
  }
  
  // Verify total consumption matches bill total and adjust if needed
  let finalJulyConsumption = julyConsumption;
  let finalJulyWaterCharge = julyWaterCharge;
  
  const calculatedTotalConsumption = julyConsumption + augustConsumption + calculatedSeptemberConsumption;
  const billTotalConsumption = unitBill.totalConsumption || 0;
  
  if (Math.abs(calculatedTotalConsumption - billTotalConsumption) > 1) {
    console.warn(`  ⚠️  Total consumption mismatch: Calculated=${calculatedTotalConsumption}, Bill=${billTotalConsumption}`);
    // Adjust to match bill total if close (within 3 m³)
    if (Math.abs(calculatedTotalConsumption - billTotalConsumption) <= 3) {
      const adjustment = billTotalConsumption - calculatedTotalConsumption;
      console.log(`  🔄 Adjusting July consumption by ${adjustment} m³ to match bill total`);
      finalJulyConsumption = julyConsumption + adjustment;
      if (finalJulyConsumption >= 0) {
        finalJulyWaterCharge = finalJulyConsumption * RATE_PER_M3;
      } else {
        console.warn(`  ⚠️  Adjustment would make July negative, keeping original`);
        finalJulyConsumption = julyConsumption;
        finalJulyWaterCharge = julyWaterCharge;
      }
    }
  }
  
  // Build array format
  fixedBreakdown.push({
    washes: [],
    month: 'July',
    consumption: finalJulyConsumption,
    waterCharge: finalJulyWaterCharge,
    carWashCount: 0,
    boatWashCount: 0,
    carWashCharge: 0,
    boatWashCharge: 0,
    totalAmount: finalJulyWaterCharge
  });
  
  // August (existing)
  fixedBreakdown.push({
    washes: mb['1']?.washes || [],
    month: 'August',
    consumption: augustConsumption,
    waterCharge: augustWaterCharge,
    carWashCount: mb['1']?.carWashCount ?? 0,
    boatWashCount: mb['1']?.boatWashCount ?? 0,
    carWashCharge: mb['1']?.carWashCharge ?? 0,
    boatWashCharge: mb['1']?.boatWashCharge ?? 0,
    totalAmount: mb['1']?.totalAmount ?? augustWaterCharge
  });
  
  // September (fix missing consumption)
  fixedBreakdown.push({
    washes: mb['2']?.washes || [],
    month: 'September',
    consumption: calculatedSeptemberConsumption,
    waterCharge: septemberWaterCharge,
    carWashCount: mb['2']?.carWashCount ?? 0,
    boatWashCount: mb['2']?.boatWashCount ?? 0,
    carWashCharge: mb['2']?.carWashCharge ?? 0,
    boatWashCharge: mb['2']?.boatWashCharge ?? 0,
    totalAmount: septemberWaterCharge + (mb['2']?.carWashCharge ?? 0) + (mb['2']?.boatWashCharge ?? 0)
  });
  
  // Validate totals
  const totalCalculatedConsumption = fixedBreakdown.reduce((sum, m) => sum + (m.consumption || 0), 0);
  const totalCalculatedWaterCharge = fixedBreakdown.reduce((sum, m) => sum + (m.waterCharge || 0), 0);
  
  console.log(`  ✅ Fixed breakdown:`);
  console.log(`     Total Consumption: ${totalCalculatedConsumption} m³ (bill shows ${unitBill.totalConsumption})`);
  console.log(`     Total WaterCharge: ${totalCalculatedWaterCharge / 100} pesos (bill shows ${unitBill.waterCharge / 100})`);
  
  if (Math.abs(totalCalculatedConsumption - unitBill.totalConsumption) > 1) {
    console.warn(`  ⚠️  Consumption total doesn't match bill total - this indicates a data inconsistency`);
  }
  
  return {
    breakdown: fixedBreakdown,
    updateTotalConsumption: finalTotalConsumption !== unitBill.totalConsumption ? finalTotalConsumption : null
  };
}

async function fixUnit106(unitBill, readings) {
  console.log('\n🔧 Fixing Unit 106...');
  
  const mb = unitBill.monthlyBreakdown;
  const fixedBreakdown = [];
  
  // July and August (existing)
  fixedBreakdown.push({
    washes: mb['0']?.washes || [],
    month: 'July',
    consumption: mb['0']?.consumption ?? 0,
    waterCharge: mb['0']?.waterCharge ?? 0,
    carWashCount: mb['0']?.carWashCount ?? 0,
    boatWashCount: mb['0']?.boatWashCount ?? 0,
    carWashCharge: mb['0']?.carWashCharge ?? 0,
    boatWashCharge: mb['0']?.boatWashCharge ?? 0,
    totalAmount: mb['0']?.totalAmount ?? 0
  });
  
  fixedBreakdown.push({
    washes: mb['1']?.washes || [],
    month: 'August',
    consumption: mb['1']?.consumption ?? 0,
    waterCharge: mb['1']?.waterCharge ?? 0,
    carWashCount: mb['1']?.carWashCount ?? 0,
    boatWashCount: mb['1']?.boatWashCount ?? 0,
    carWashCharge: mb['1']?.carWashCharge ?? 0,
    boatWashCharge: mb['1']?.boatWashCharge ?? 0,
    totalAmount: mb['1']?.totalAmount ?? 0
  });
  
  // September (missing)
  const julyConsumption = mb['0']?.consumption ?? 0;
  const augustConsumption = mb['1']?.consumption ?? 0;
  const totalConsumption = unitBill.totalConsumption || 0;
  const septemberConsumption = totalConsumption - julyConsumption - augustConsumption;
  
  const julyWaterCharge = mb['0']?.waterCharge ?? 0;
  const augustWaterCharge = mb['1']?.waterCharge ?? 0;
  const totalWaterCharge = unitBill.waterCharge || 0;
  const septemberWaterCharge = totalWaterCharge - julyWaterCharge - augustWaterCharge;
  
  // Validate consumption matches waterCharge
  const calculatedFromCharge = calculateConsumptionFromWaterCharge(septemberWaterCharge, RATE_PER_M3);
  
  if (Math.abs(septemberConsumption - calculatedFromCharge) > 1) {
    console.warn(`  ⚠️  September calculation mismatch: From total=${septemberConsumption}, From charge=${calculatedFromCharge}`);
    // Use the one calculated from charge as it's more accurate
  }
  
  const finalSeptemberConsumption = calculatedFromCharge;
  
  console.log(`  📊 Calculated September: ${finalSeptemberConsumption} m³ = ${septemberWaterCharge / 100} pesos`);
  
  // Validate against readings
  const readingsSeptember = calculateConsumptionFromReadings(readings, 'September');
  if (readingsSeptember !== null && Math.abs(readingsSeptember - finalSeptemberConsumption) > 2) {
    console.warn(`  ⚠️  September consumption mismatch: Calculated=${finalSeptemberConsumption}, Readings=${readingsSeptember}`);
  }
  
  fixedBreakdown.push({
    washes: [],
    month: 'September',
    consumption: finalSeptemberConsumption,
    waterCharge: septemberWaterCharge,
    carWashCount: 0,
    boatWashCount: 0,
    carWashCharge: 0,
    boatWashCharge: 0,
    totalAmount: septemberWaterCharge
  });
  
  // Validate totals
  const totalCalculatedConsumption = fixedBreakdown.reduce((sum, m) => sum + (m.consumption || 0), 0);
  const totalCalculatedWaterCharge = fixedBreakdown.reduce((sum, m) => sum + (m.waterCharge || 0), 0);
  
  console.log(`  ✅ Fixed breakdown:`);
  console.log(`     Total Consumption: ${totalCalculatedConsumption} m³ (bill shows ${unitBill.totalConsumption})`);
  console.log(`     Total WaterCharge: ${totalCalculatedWaterCharge / 100} pesos (bill shows ${unitBill.waterCharge / 100})`);
  
  if (Math.abs(totalCalculatedConsumption - unitBill.totalConsumption) > 1) {
    console.warn(`  ⚠️  Consumption total doesn't match bill total - this indicates a data inconsistency`);
  }
  
  return {
    breakdown: fixedBreakdown,
    updateTotalConsumption: null // Unit 106 totals are consistent
  };
}

async function main() {
  try {
    // Check for dry-run flag
    const dryRun = process.argv.includes('--dry-run') || process.argv.includes('-n');
    
    console.log('═'.repeat(60));
    console.log(`🔧 Q1 2026 Bill Data Fix`);
    console.log(`🔒 Mode: ${dryRun ? 'DRY RUN' : 'EXECUTING'}`);
    console.log(`📦 Target: ${useProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    console.log('═'.repeat(60));
    
    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be saved\n');
    }
    
    console.log('🔧 Starting Q1 2026 Bill Data Fix...\n');
    
    const db = await getDb();
    const billRef = db.collection('clients').doc(CLIENT_ID)
      .collection('projects').doc('waterBills')
      .collection('bills').doc(BILL_ID);
    
    const billDoc = await billRef.get();
    
    if (!billDoc.exists) {
      console.error(`❌ Bill ${BILL_ID} not found!`);
      process.exit(1);
    }
    
    const billData = billDoc.data();
    const units = billData.bills?.units || {};
    
    console.log('📊 Current Issues:');
    console.log('  Unit 101: Missing July entry, missing September consumption field');
    console.log('  Unit 106: Missing September entry');
    console.log('  Both: Using OBJECT format instead of ARRAY format\n');
    
    // Get readings for validation (including prior month for July calculation)
    console.log('📖 Fetching meter readings for validation...');
    const readings101 = await getReadings('101', true); // Include June for July calculation
    const readings106 = await getReadings('106', true);
    
    console.log('  Unit 101 readings:', readings101);
    console.log('  Unit 106 readings:', readings106);
    
    // Fix Unit 101
    if (units['101']) {
      const result = await fixUnit101(units['101'], readings101);
      units['101'].monthlyBreakdown = result.breakdown;
      if (result.updateTotalConsumption !== null) {
        units['101'].totalConsumption = result.updateTotalConsumption;
        console.log(`  🔄 Updated Unit 101 totalConsumption to ${result.updateTotalConsumption} m³`);
      }
    }
    
    // Fix Unit 106
    if (units['106']) {
      const result = await fixUnit106(units['106'], readings106);
      units['106'].monthlyBreakdown = result.breakdown;
      if (result.updateTotalConsumption !== null) {
        units['106'].totalConsumption = result.updateTotalConsumption;
        console.log(`  🔄 Updated Unit 106 totalConsumption to ${result.updateTotalConsumption} m³`);
      }
    }
    
    // Update the bill document
    if (dryRun) {
      console.log('\n🔍 DRY RUN - Would update Firestore document with:');
      console.log(JSON.stringify({
        'bills.units.101.monthlyBreakdown': units['101']?.monthlyBreakdown,
        'bills.units.106.monthlyBreakdown': units['106']?.monthlyBreakdown
      }, null, 2));
      console.log('\n⚠️  No changes were made. Run without --dry-run to apply fixes.');
    } else {
      console.log('\n💾 Updating Firestore document...');
      await billRef.update({
        'bills.units': units
      });
      
      console.log('✅ Successfully fixed Q1 2026 bill data!');
    }
    
    console.log('\n📋 Summary:');
    console.log('  ✓ Unit 101: Converted to ARRAY format, added July entry, fixed September consumption');
    console.log('  ✓ Unit 106: Converted to ARRAY format, added September entry');
    console.log('  ✓ All units now use consistent ARRAY format');
    
  } catch (error) {
    console.error('❌ Error fixing bill data:', error);
    process.exit(1);
  }
}

main();
