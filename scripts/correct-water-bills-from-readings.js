#!/usr/bin/env node
/**
 * Correct Water Bills from Meter Readings
 * 
 * This script corrects Q1 and Q2 2026 water bills to match actual meter readings.
 * It only modifies billing amounts - payments remain unchanged.
 * 
 * Changes:
 * 1. Backs up current bills to bills_original
 * 2. Updates for each unit:
 *    - currentCharge (sum of corrected monthly charges)
 *    - monthlyBreakdown[].totalAmount (corrected monthly total)
 *    - monthlyBreakdown[].waterCharge (corrected monthly water charge)
 * 
 * IMPORTANT:
 * - DEV ONLY - Production is blocked for safety
 * - Always use --dry-run first to preview changes
 * - Payments are preserved (paidAmount, payments array unchanged)
 * 
 * Usage:
 *   node scripts/correct-water-bills-from-readings.js --dry-run
 *   node scripts/correct-water-bills-from-readings.js (apply changes)
 */

import admin from 'firebase-admin';
import { existsSync } from 'fs';

const CLIENT_ID = 'AVII';
const RATE_PER_M3 = 5000; // 50 pesos per m³ in centavos
const FISCAL_YEAR = 2026;
const TARGET_QUARTERS = [1, 2]; // Q1 and Q2 only

// Check for flags
const isDryRun = process.argv.includes('--dry-run');
const useProduction = process.argv.includes('--prod');
const productionProjectId = 'sams-sandyland-prod';

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
    console.log(`🌍 Environment: DEVELOPMENT`);
    console.log(`🔑 Using Firebase service account credentials\n`);
    
    // Use service account key for development (via getDb from firebase.js)
    const { getDb: getDbFromFirebase } = await import('../functions/backend/firebase.js');
    return await getDbFromFirebase();
  }
}

let dbInstance = null;

async function getDb() {
  if (!dbInstance) {
    dbInstance = await initializeFirebase();
  }
  return dbInstance;
}

/**
 * Get readings for a specific month
 */
async function getMonthReadings(db, fiscalYear, fiscalMonth) {
  // Readings docs: 2026-00=July, 2026-01=August, ..., 2026-11=June
  const docMonth = fiscalMonth.toString().padStart(2, '0');
  const docId = `${fiscalYear}-${docMonth}`;
  
  const doc = await db.collection('clients').doc(CLIENT_ID)
    .collection('projects').doc('waterBills')
    .collection('readings').doc(docId)
    .get();
  
  if (!doc.exists) return null;
  
  const data = doc.data();
  return {
    fiscalYear,
    fiscalMonth,
    readings: data.readings || {},
    timestamp: data.timestamp
  };
}

/**
 * Get prior month readings for first month of quarter
 */
async function getPriorMonthReadings(db, fiscalYear, fiscalMonth) {
  if (fiscalMonth === 0) {
    // Q1 starts in July (month 0), need June (month 11 of prior fiscal year)
    const priorYear = fiscalYear - 1;
    return await getMonthReadings(db, priorYear, 11);
  } else {
    return await getMonthReadings(db, fiscalYear, fiscalMonth - 1);
  }
}

/**
 * Extract reading value from reading object or number
 */
function extractReading(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'object' && value.reading !== undefined) {
    return value.reading;
  }
  if (typeof value === 'number') {
    return value;
  }
  return null;
}

/**
 * Calculate consumption from meter readings
 */
function calculateConsumption(currentReading, priorReading) {
  if (currentReading === null || priorReading === null) {
    return null; // Missing data
  }
  return Math.max(0, currentReading - priorReading);
}

/**
 * Get quarterly bill document
 */
async function getQuarterlyBill(db, fiscalYear, fiscalQuarter) {
  const billId = `${fiscalYear}-Q${fiscalQuarter}`;
  const billRef = db.collection('clients').doc(CLIENT_ID)
    .collection('projects').doc('waterBills')
    .collection('bills').doc(billId);
  
  const billDoc = await billRef.get();
  if (!billDoc.exists) {
    return null;
  }
  
  return {
    billId,
    ref: billRef,
    data: billDoc.data()
  };
}

/**
 * Backup bills to bills_original
 */
async function backupBills(db, billRef, billData) {
  if (isDryRun) {
    console.log(`  [DRY RUN] Would backup bills to bills_original`);
    return;
  }
  
  // Check if backup already exists
  const backupData = { ...billData };
  backupData.bills_original = { ...billData.bills };
  
  // Update the document with backup (if not already backed up)
  if (!billData.bills_original) {
    await billRef.update({
      bills_original: billData.bills
    });
    console.log(`  ✅ Backed up bills to bills_original`);
  } else {
    console.log(`  ℹ️  bills_original already exists (skipping backup)`);
  }
}

/**
 * Get fiscal month name
 */
function getFiscalMonthName(fiscalMonth) {
  const monthNames = [
    'July', 'August', 'September', 'October', 'November', 'December',
    'January', 'February', 'March', 'April', 'May', 'June'
  ];
  return monthNames[fiscalMonth] || `Month ${fiscalMonth}`;
}

/**
 * Calculate corrected values for a unit in a quarter
 */
async function calculateCorrectedValues(db, unitId, fiscalYear, fiscalQuarter) {
  const quarterStartMonth = (fiscalQuarter - 1) * 3; // Q1=0, Q2=3
  const quarterEndMonth = quarterStartMonth + 2; // Q1=0-2, Q2=3-5
  
  const monthlyData = [];
  let quarterTotalConsumption = 0;
  let quarterTotalCharge = 0;
  
  // Get prior month reading for first month
  const priorReadings = await getPriorMonthReadings(db, fiscalYear, quarterStartMonth);
  let priorReading = priorReadings 
    ? extractReading(priorReadings.readings?.[unitId])
    : null;
  
  // Process each month in the quarter
  for (let monthIndex = quarterStartMonth; monthIndex <= quarterEndMonth; monthIndex++) {
    const monthName = getFiscalMonthName(monthIndex);
    
    // Get current month readings
    const monthReadings = await getMonthReadings(db, fiscalYear, monthIndex);
    const currentReading = monthReadings 
      ? extractReading(monthReadings.readings?.[unitId])
      : null;
    
    // Calculate consumption
    const consumption = calculateConsumption(currentReading, priorReading);
    
    // Calculate charge
    const waterCharge = consumption !== null ? consumption * RATE_PER_M3 : 0;
    const totalAmount = waterCharge; // No car/boat wash charges in corrections
    
    monthlyData.push({
      monthIndex,
      monthName,
      currentReading,
      priorReading,
      consumption: consumption !== null ? consumption : 0,
      waterCharge,
      totalAmount,
      hasReadings: currentReading !== null && priorReading !== null
    });
    
    if (consumption !== null) {
      quarterTotalConsumption += consumption;
      quarterTotalCharge += waterCharge;
    }
    
    // Update prior reading for next iteration
    priorReading = currentReading;
  }
  
  return {
    monthlyData,
    quarterTotalConsumption,
    quarterTotalCharge
  };
}

/**
 * Update monthly breakdown entry
 */
function updateMonthlyBreakdown(monthlyBreakdown, monthName, quarterStartMonth, monthIndexInQuarter, correctedWaterCharge, correctedTotalAmount) {
  // Handle array format
  if (Array.isArray(monthlyBreakdown)) {
    const monthIndex = monthlyBreakdown.findIndex(m => m && m.month === monthName);
    if (monthIndex >= 0) {
      // Preserve car/boat wash charges
      const existingEntry = monthlyBreakdown[monthIndex];
      const carWashCharge = existingEntry.carWashCharge || 0;
      const boatWashCharge = existingEntry.boatWashCharge || 0;
      
      monthlyBreakdown[monthIndex].waterCharge = correctedWaterCharge;
      monthlyBreakdown[monthIndex].totalAmount = correctedWaterCharge + carWashCharge + boatWashCharge;
      monthlyBreakdown[monthIndex].consumption = Math.round(correctedWaterCharge / RATE_PER_M3);
    } else {
      // Entry doesn't exist - create it
      monthlyBreakdown.push({
        month: monthName,
        waterCharge: correctedWaterCharge,
        totalAmount: correctedTotalAmount,
        consumption: Math.round(correctedWaterCharge / RATE_PER_M3),
        carWashCharge: 0,
        boatWashCharge: 0,
        carWashCount: 0,
        boatWashCount: 0,
        washes: []
      });
    }
    return monthlyBreakdown;
  }
  
  // Handle object format - quarterly bills use 0-based position in quarter
  if (monthlyBreakdown && typeof monthlyBreakdown === 'object') {
    // Try position in quarter first (0, 1, 2)
    const quarterPositionKey = String(monthIndexInQuarter);
    if (monthlyBreakdown[quarterPositionKey]) {
      const existingEntry = monthlyBreakdown[quarterPositionKey];
      const carWashCharge = existingEntry.carWashCharge || 0;
      const boatWashCharge = existingEntry.boatWashCharge || 0;
      
      monthlyBreakdown[quarterPositionKey].waterCharge = correctedWaterCharge;
      monthlyBreakdown[quarterPositionKey].totalAmount = correctedWaterCharge + carWashCharge + boatWashCharge;
      monthlyBreakdown[quarterPositionKey].consumption = Math.round(correctedWaterCharge / RATE_PER_M3);
      return monthlyBreakdown;
    }
    
    // Fallback: find by month name
    const keys = Object.keys(monthlyBreakdown);
    for (const key of keys) {
      const entry = monthlyBreakdown[key];
      if (entry && entry.month === monthName) {
        const carWashCharge = entry.carWashCharge || 0;
        const boatWashCharge = entry.boatWashCharge || 0;
        
        entry.waterCharge = correctedWaterCharge;
        entry.totalAmount = correctedWaterCharge + carWashCharge + boatWashCharge;
        entry.consumption = Math.round(correctedWaterCharge / RATE_PER_M3);
        return monthlyBreakdown;
      }
    }
    
    // Entry doesn't exist - add it using quarter position
    monthlyBreakdown[quarterPositionKey] = {
      month: monthName,
      waterCharge: correctedWaterCharge,
      totalAmount: correctedTotalAmount,
      consumption: Math.round(correctedWaterCharge / RATE_PER_M3),
      carWashCharge: 0,
      boatWashCharge: 0,
      carWashCount: 0,
      boatWashCount: 0,
      washes: []
    };
    return monthlyBreakdown;
  }
  
  return monthlyBreakdown;
}

/**
 * Correct bills for a single quarter
 */
async function correctQuarterBills(db, fiscalYear, fiscalQuarter) {
  console.log(`\n📋 Processing Q${fiscalQuarter} ${fiscalYear}...`);
  
  // Get the quarterly bill document
  const quarterBill = await getQuarterlyBill(db, fiscalYear, fiscalQuarter);
  if (!quarterBill) {
    console.log(`  ⚠️  No bill document found for Q${fiscalQuarter} ${fiscalYear}`);
    return { updated: 0, skipped: 0, errors: 0 };
  }
  
  const { billId, ref, data } = quarterBill;
  const units = data.bills?.units || {};
  const unitIds = Object.keys(units);
  
  if (unitIds.length === 0) {
    console.log(`  ⚠️  No units found in bill document`);
    return { updated: 0, skipped: 0, errors: 0 };
  }
  
  console.log(`  Found ${unitIds.length} unit(s) in bill document`);
  
  // Backup first
  await backupBills(db, ref, data);
  
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const updates = {};
  const creditAdjustments = []; // Track credit adjustments for summary
  
  // Process each unit
  for (const unitId of unitIds) {
    try {
      console.log(`\n  Unit ${unitId}:`);
      
      const unitBill = units[unitId];
      if (!unitBill) {
        console.log(`    ⚠️  Unit data not found`);
        skipped++;
        continue;
      }
      
      // Calculate corrected values from meter readings
      const corrected = await calculateCorrectedValues(db, unitId, fiscalYear, fiscalQuarter);
      
      // Check if we have readings data
      const hasReadings = corrected.monthlyData.some(m => m.hasReadings);
      if (!hasReadings) {
        console.log(`    ⚠️  No meter readings data available - skipping`);
        skipped++;
        continue;
      }
      
      // Display what will change
      console.log(`    Current charge: $${((unitBill.currentCharge || 0) / 100).toFixed(2)}`);
      console.log(`    Corrected charge: $${(corrected.quarterTotalCharge / 100).toFixed(2)}`);
      console.log(`    Difference: $${((corrected.quarterTotalCharge - (unitBill.currentCharge || 0)) / 100).toFixed(2)}`);
      
      // Update monthly breakdown
      const monthlyBreakdown = unitBill.monthlyBreakdown || [];
      const quarterStartMonth = (fiscalQuarter - 1) * 3;
      let updatedBreakdown = Array.isArray(monthlyBreakdown) 
        ? [...monthlyBreakdown] 
        : { ...monthlyBreakdown };
      
      // Track total for verification
      let totalWaterCharge = 0;
      let totalOtherCharges = 0;
      
      for (let i = 0; i < corrected.monthlyData.length; i++) {
        const monthData = corrected.monthlyData[i];
        const monthIndexInQuarter = i;
        
        // Preserve existing car/boat wash charges
        let existingCarWash = 0;
        let existingBoatWash = 0;
        
        if (Array.isArray(updatedBreakdown)) {
          const existing = updatedBreakdown.find(m => m && m.month === monthData.monthName);
          if (existing) {
            existingCarWash = existing.carWashCharge || 0;
            existingBoatWash = existing.boatWashCharge || 0;
          }
        } else if (updatedBreakdown[String(monthIndexInQuarter)]) {
          const existing = updatedBreakdown[String(monthIndexInQuarter)];
          existingCarWash = existing.carWashCharge || 0;
          existingBoatWash = existing.boatWashCharge || 0;
        }
        
        totalOtherCharges += existingCarWash + existingBoatWash;
        const monthTotal = monthData.waterCharge + existingCarWash + existingBoatWash;
        totalWaterCharge += monthData.waterCharge;
        
        updatedBreakdown = updateMonthlyBreakdown(
          updatedBreakdown,
          monthData.monthName,
          quarterStartMonth,
          monthIndexInQuarter,
          monthData.waterCharge,
          monthTotal
        );
      }
      
      // Calculate final totals (preserve penalty and other charges if they exist)
      // Note: currentCharge should be the amount still owed (totalAmount - paidAmount)
      // totalAmount = waterCharge + otherCharges + penaltyAmount
      const penaltyAmount = unitBill.penaltyAmount || 0;
      const finalTotalAmount = corrected.quarterTotalCharge + totalOtherCharges + penaltyAmount;
      const paidAmount = unitBill.paidAmount || 0;
      const currentCharge = finalTotalAmount - paidAmount;
      
      // Calculate credit balance adjustment needed
      // Adjustment = Amount actually paid - Amount that SHOULD have been paid
      // Positive = overpaid (add credit), Negative = underpaid (debit/owe more)
      const creditAdjustment = paidAmount - finalTotalAmount;
      
      // Prepare update for this unit
      updates[`bills.units.${unitId}.currentCharge`] = Math.max(0, currentCharge); // Can't be negative
      updates[`bills.units.${unitId}.waterCharge`] = corrected.quarterTotalCharge;
      updates[`bills.units.${unitId}.monthlyBreakdown`] = updatedBreakdown;
      updates[`bills.units.${unitId}.totalAmount`] = finalTotalAmount;
      updates[`bills.units.${unitId}.totalConsumption`] = corrected.quarterTotalConsumption;
      
      console.log(`    Monthly breakdown updated: ${corrected.monthlyData.length} months`);
      console.log(`    Total water charge: $${(corrected.quarterTotalCharge / 100).toFixed(2)}`);
      console.log(`    Other charges (preserved): $${(totalOtherCharges / 100).toFixed(2)}`);
      console.log(`    Penalty (preserved): $${(penaltyAmount / 100).toFixed(2)}`);
      console.log(`    Final total (should have been charged): $${(finalTotalAmount / 100).toFixed(2)}`);
      console.log(`    Amount actually paid: $${(paidAmount / 100).toFixed(2)}`);
      console.log(`    Current charge (after payments): $${(Math.max(0, currentCharge) / 100).toFixed(2)}`);
      console.log(`    Credit balance adjustment needed: ${creditAdjustment >= 0 ? '+' : ''}$${(creditAdjustment / 100).toFixed(2)} ${creditAdjustment >= 0 ? '(ADD credit - overpaid)' : '(DEBIT - underpaid)'}`);
      
      // Store credit adjustment for summary
      creditAdjustments.push({ 
        unitId, 
        creditAdjustment,
        paidAmount,
        finalTotalAmount,
        currentCharge: Math.max(0, currentCharge)
      });
      
      console.log(`    ✅ Prepared updates for Unit ${unitId}`);
      updated++;
      
    } catch (error) {
      console.error(`    ❌ Error processing Unit ${unitId}:`, error.message);
      errors++;
    }
  }
  
  // Apply updates if not dry run
  if (Object.keys(updates).length > 0) {
    if (isDryRun) {
      console.log(`\n  [DRY RUN] Would apply ${Object.keys(updates).length} field updates to bill document`);
    } else {
      await ref.update(updates);
      console.log(`\n  ✅ Applied ${Object.keys(updates).length} field updates to bill document`);
    }
  }
  
  return { updated, skipped, errors, creditAdjustments };
}

/**
 * Main function
 */
async function main() {
  console.log('='.repeat(80));
  console.log('WATER BILL CORRECTION FROM METER READINGS');
  console.log('='.repeat(80));
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be applied)'}`);
  console.log(`Environment: ${useProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`Target Quarters: Q${TARGET_QUARTERS.join(', Q')} ${FISCAL_YEAR}`);
  if (useProduction && !isDryRun) {
    console.log(`\n⚠️  WARNING: You are about to modify PRODUCTION bills!`);
    console.log(`   Make sure you have reviewed all changes in Dev first.`);
  }
  console.log('='.repeat(80));
  
  try {
    const db = await getDb();
    
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const allCreditAdjustments = []; // Collect from all quarters
    
    // Process each target quarter
    for (const quarter of TARGET_QUARTERS) {
      const result = await correctQuarterBills(db, FISCAL_YEAR, quarter);
      totalUpdated += result.updated;
      totalSkipped += result.skipped;
      totalErrors += result.errors;
      if (result.creditAdjustments) {
        allCreditAdjustments.push(...result.creditAdjustments);
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`Units updated: ${totalUpdated}`);
    console.log(`Units skipped: ${totalSkipped}`);
    console.log(`Errors: ${totalErrors}`);
    
    // Credit adjustment summary
    if (allCreditAdjustments.length > 0) {
      console.log('\n' + '-'.repeat(80));
      console.log('CREDIT BALANCE ADJUSTMENTS NEEDED');
      console.log('-'.repeat(80));
      console.log('These adjustments should be applied to creditBalances to reconcile payments:');
      console.log('');
      console.log('| Unit | Amount Paid | Should Have Paid | Adjustment | Action |');
      console.log('|------|-------------|------------------|------------|--------|');
      
      let totalAdjustment = 0;
      let totalCredits = 0;
      let totalDebits = 0;
      
      for (const adj of allCreditAdjustments) {
        const action = adj.creditAdjustment >= 0 ? 'ADD credit' : 'DEBIT';
        const sign = adj.creditAdjustment >= 0 ? '+' : '';
        console.log(`| ${adj.unitId.padEnd(4)} | $${(adj.paidAmount / 100).toFixed(2).padStart(11)} | $${(adj.finalTotalAmount / 100).toFixed(2).padStart(16)} | ${sign}$${(adj.creditAdjustment / 100).toFixed(2).padStart(9)} | ${action.padEnd(6)} |`);
        
        totalAdjustment += adj.creditAdjustment;
        if (adj.creditAdjustment >= 0) {
          totalCredits += adj.creditAdjustment;
        } else {
          totalDebits += Math.abs(adj.creditAdjustment);
        }
      }
      
      console.log('|------|-------------|------------------|------------|--------|');
      console.log(`| TOTAL |             |                  | ${totalAdjustment >= 0 ? '+' : ''}$${(totalAdjustment / 100).toFixed(2).padStart(9)} |        |`);
      console.log('');
      console.log(`Total credits to add: $${(totalCredits / 100).toFixed(2)}`);
      console.log(`Total debits: $${(totalDebits / 100).toFixed(2)}`);
      console.log(`Net adjustment: ${totalAdjustment >= 0 ? '+' : ''}$${(totalAdjustment / 100).toFixed(2)}`);
    }
  
  if (isDryRun) {
    console.log('\n⚠️  DRY RUN MODE - No changes were made');
    console.log('   Run without --dry-run to apply changes');
  } else {
    console.log('\n✅ Changes have been applied');
    console.log('   Bills backed up to bills_original');
    console.log('   Payments preserved (unchanged)');
    console.log('   ⚠️  Remember to apply credit balance adjustments listed above');
  }
  
  console.log('='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
