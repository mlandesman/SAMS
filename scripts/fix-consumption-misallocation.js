#!/usr/bin/env node
/**
 * Fix Consumption Misallocation
 * 
 * Problem: When monthly bills were converted to quarterly bills, consumption values
 * got misallocated across months. Meter readings show the actual consumption.
 * 
 * Solution: For each quarter, if the sum of meter readings matches the bill total
 * consumption, redistribute monthly consumption values from readings.
 * 
 * Usage:
 *   node scripts/fix-consumption-misallocation.js <unitId> [--dry-run]
 *   node scripts/fix-consumption-misallocation.js --all [--dry-run]
 *   node scripts/fix-consumption-misallocation.js <unitId> --prod [--dry-run]
 *   node scripts/fix-consumption-misallocation.js --all --prod [--dry-run]
 * 
 * Environment:
 * Development: Uses service account key from firebase.js
 * Production: Uses Application Default Credentials (ADC) with --prod flag
 *   Run 'gcloud auth application-default login' if not authenticated
 */

import admin from 'firebase-admin';
import { existsSync } from 'fs';

const CLIENT_ID = 'AVII';
const RATE_PER_M3 = 5000; // 50 pesos in centavos
const productionProjectId = 'sams-sandyland-prod';

// Known credit already applied: $289.73 overcharge from sewer service in Q1
// This was already credited to units who paid their Q1 bill
const KNOWN_Q1_CREDIT_AMOUNT = 28973; // $289.73 in centavos

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

let dbInstance = null;

async function getDb() {
  if (!dbInstance) {
    dbInstance = await initializeFirebase();
  }
  return dbInstance;
}

// Quarter month mappings (fiscal year)
const QUARTER_MONTHS = {
  1: ['July', 'August', 'September'],
  2: ['October', 'November', 'December'],
  3: ['January', 'February', 'March'],
  4: ['April', 'May', 'June']
};

// Fiscal year month to readings doc ID mapping
// Fiscal year starts July (month 0) = calendar July
function getReadingsDocId(fiscalYear, monthIndex) {
  // monthIndex: 0=July, 1=August, ..., 11=June
  // Readings docs: 2026-00=July, 2026-01=August, etc.
  if (monthIndex === 0) {
    // July is month 0, use current fiscal year format
    return `${fiscalYear}-00`;
  } else if (monthIndex < 12) {
    // August through May
    const docMonth = monthIndex.toString().padStart(2, '0');
    return `${fiscalYear}-${docMonth}`;
  } else {
    // June is month 11 of fiscal year, doc is month 11 of previous calendar year
    // Actually, June would be fiscalYear+1-00... wait, let me check
    // Fiscal year 2026: July 2025 - June 2026
    // So July 2025 = 2026-00, June 2026 = 2027-00... no wait
    
    // Actually, readings docs use fiscal year directly:
    // 2026-00 = July 2025 (fiscal year 2026, month 0)
    // 2026-01 = August 2025
    // 2026-11 = June 2026
    
    // So month 11 (June) = fiscalYear-11
    return `${fiscalYear}-11`;
  }
}

async function getReadings(unitId, fiscalYear, monthIndex) {
  const db = await getDb();
  const readings = {};
  
  // Get prior month for first month of quarter
  const quarterStartMonth = Math.floor(monthIndex / 3) * 3;
  if (monthIndex === quarterStartMonth) {
    // First month - need prior month (monthIndex - 1, or June of previous fiscal year)
    const priorMonthIndex = monthIndex === 0 ? 11 : monthIndex - 1;
    const priorFiscalYear = monthIndex === 0 ? fiscalYear - 1 : fiscalYear;
    
    try {
      const priorDocId = getReadingsDocId(priorFiscalYear, priorMonthIndex);
      const priorDoc = await db.collection('clients').doc(CLIENT_ID)
        .collection('projects').doc('waterBills')
        .collection('readings').doc(priorDocId).get();
      
      if (priorDoc.exists) {
        const data = priorDoc.data();
        const unitReading = data.readings?.[unitId];
        if (unitReading?.reading !== undefined) {
          const monthNames = QUARTER_MONTHS[Math.floor(priorMonthIndex / 3) + 1] || ['Unknown'];
          const priorMonthName = monthNames[priorMonthIndex % 3] || 'Unknown';
          readings[priorMonthName] = unitReading.reading;
        }
      }
    } catch (error) {
      console.warn(`⚠️  Could not fetch prior month readings:`, error.message);
    }
  }
  
  // Get readings for the three months in the quarter
  const quarterNumber = Math.floor(monthIndex / 3) + 1;
  const monthNames = QUARTER_MONTHS[quarterNumber];
  
  for (let i = 0; i < 3; i++) {
    const currentMonthIndex = quarterStartMonth + i;
    const monthName = monthNames[i];
    const docId = getReadingsDocId(fiscalYear, currentMonthIndex);
    
    try {
      const readingsDoc = await db.collection('clients').doc(CLIENT_ID)
        .collection('projects').doc('waterBills')
        .collection('readings').doc(docId).get();
      
      if (readingsDoc.exists) {
        const data = readingsDoc.data();
        const unitReading = data.readings?.[unitId];
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

function calculateConsumptionFromReadings(readings, monthName, priorMonthName) {
  const currentReading = readings[monthName];
  const priorReading = priorMonthName ? readings[priorMonthName] : null;
  
  if (currentReading === null || currentReading === undefined) return null;
  if (priorReading === null || priorReading === undefined) return null;
  
  return Math.max(0, currentReading - priorReading);
}

function isBillPaid(unitBill) {
  const totalAmount = unitBill.totalAmount || (unitBill.waterCharge || 0) + (unitBill.penaltyAmount || 0);
  const payments = unitBill.payments || [];
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  return totalPaid >= totalAmount;
}

async function fixQuarterMisallocation(unitBill, readings, fiscalQuarter, quarterMonths, unitId, billId) {
  const mb = unitBill.monthlyBreakdown;
  
  // Check if bill is paid - if so, skip fix but calculate discrepancy for credit
  if (isBillPaid(unitBill)) {
    console.log(`  💰 Bill is PAID - skipping fix, calculating discrepancy for credit...`);
    // Calculate discrepancy for credit
    return calculatePaidBillDiscrepancy(unitBill, readings, fiscalQuarter, quarterMonths, unitId, billId);
  }
  
  // Ensure monthlyBreakdown is an array
  if (!Array.isArray(mb)) {
    console.warn(`  ⚠️  monthlyBreakdown is not an array - cannot fix misallocation`);
    return null;
  }
  
  // Calculate consumption from readings for all three months
  const readingsConsumption = {};
  let readingsTotal = 0;
  
  // Determine prior month name for first month of quarter
  const priorMonthMap = {
    'July': 'June',
    'October': 'September',
    'January': 'December',
    'April': 'March'
  };
  
  for (let i = 0; i < 3; i++) {
    const monthName = quarterMonths[i];
    const priorMonthName = i === 0 ? priorMonthMap[monthName] : quarterMonths[i - 1];
    
    const consumption = calculateConsumptionFromReadings(readings, monthName, priorMonthName);
    if (consumption !== null) {
      readingsConsumption[monthName] = consumption;
      readingsTotal += consumption;
    }
  }
  
  // Check if readings total matches bill total
  const billTotalConsumption = unitBill.totalConsumption || 0;
  const consumptionDifference = Math.abs(readingsTotal - billTotalConsumption);
  
  if (consumptionDifference > 5) {
    console.warn(`  ⚠️  Readings total (${readingsTotal} m³) doesn't match bill total (${billTotalConsumption} m³)`);
    console.warn(`     Difference: ${consumptionDifference} m³ - too large, cannot auto-fix without manual review`);
    return null;
  }
  
  // If readings total is close but not exact, we'll adjust proportionally
  let finalReadingsConsumption = readingsConsumption;
  if (consumptionDifference > 0 && consumptionDifference <= 5) {
    // Adjust readings proportionally to match bill total
    if (readingsTotal > 0) {
      const ratio = billTotalConsumption / readingsTotal;
      console.log(`  📊 Adjusting readings consumption proportionally (ratio: ${ratio.toFixed(3)}) to match bill total`);
      Object.keys(finalReadingsConsumption).forEach(month => {
        finalReadingsConsumption[month] = Math.round(finalReadingsConsumption[month] * ratio);
      });
      // Recalculate total after adjustment
      readingsTotal = Object.values(finalReadingsConsumption).reduce((sum, val) => sum + val, 0);
      // Distribute any remaining difference to largest month
      const remaining = billTotalConsumption - readingsTotal;
      if (remaining !== 0) {
        const largestMonth = Object.entries(finalReadingsConsumption)
          .reduce((max, [month, val]) => val > (max[1] || 0) ? [month, val] : max, ['', 0])[0];
        finalReadingsConsumption[largestMonth] += remaining;
        console.log(`  📊 Adjusting ${largestMonth} by ${remaining} m³ to match bill total exactly`);
      }
    }
  }
  
  // Check if there are any discrepancies in monthly values (using adjusted readings if applicable)
  let hasMisallocation = false;
  const discrepancies = [];
  
  for (let i = 0; i < 3; i++) {
    const monthName = quarterMonths[i];
    const monthBreakdown = mb.find(m => m.month === monthName);
    
    if (!monthBreakdown) continue;
    
    const billConsumption = monthBreakdown.consumption || 0;
    const readingsCons = finalReadingsConsumption[monthName];
    
    if (readingsCons !== undefined && billConsumption !== readingsCons) {
      hasMisallocation = true;
      discrepancies.push({
        month: monthName,
        billConsumption,
        readingsConsumption: readingsCons,
        difference: Math.abs(billConsumption - readingsCons)
      });
    }
  }
  
  if (!hasMisallocation) {
    console.log(`  ✅ No misallocation detected - consumption matches readings`);
    return null;
  }
  
  // Fix misallocation: redistribute consumption from readings
  console.log(`  🔧 Fixing misallocation - redistributing from meter readings:`);
  discrepancies.forEach(disc => {
    console.log(`     ${disc.month}: ${disc.billConsumption} m³ → ${disc.readingsConsumption} m³ (${disc.difference > 0 ? '+' : ''}${disc.readingsConsumption - disc.billConsumption} m³)`);
  });
  
  // Update monthlyBreakdown with readings consumption (adjusted to match bill total)
  const fixedBreakdown = mb.map(monthBreakdown => {
    const monthName = monthBreakdown.month;
    const readingsCons = finalReadingsConsumption[monthName];
    
    if (readingsCons !== undefined) {
      // Recalculate waterCharge from readings consumption
      const newWaterCharge = readingsCons * RATE_PER_M3;
      
      return {
        ...monthBreakdown,
        consumption: readingsCons,
        waterCharge: newWaterCharge,
        totalAmount: newWaterCharge + (monthBreakdown.carWashCharge || 0) + (monthBreakdown.boatWashCharge || 0)
      };
    }
    
    return monthBreakdown;
  });
  
  // Verify and adjust total waterCharge to match bill total
  const totalWaterCharge = unitBill.waterCharge || 0;
  const newTotalWaterCharge = fixedBreakdown.reduce((sum, m) => sum + (m.waterCharge || 0), 0);
  const totalDifference = totalWaterCharge - newTotalWaterCharge;
  
  if (Math.abs(totalDifference) > 50) { // More than 0.50 pesos difference
    console.log(`  🔄 Adjusting waterCharges by ${totalDifference / 100} pesos to match bill total`);
    // Distribute adjustment proportionally to months with consumption
    const totalConsumption = fixedBreakdown.reduce((sum, m) => sum + (m.consumption || 0), 0);
    if (totalConsumption > 0) {
      let distributedAdjustment = 0;
      fixedBreakdown.forEach((month, index) => {
        if (month.consumption > 0) {
          const ratio = month.consumption / totalConsumption;
          const adjustment = index === fixedBreakdown.length - 1 
            ? totalDifference - distributedAdjustment // Last month gets remainder
            : Math.round(totalDifference * ratio);
          month.waterCharge += adjustment;
          month.totalAmount += adjustment;
          distributedAdjustment += adjustment;
        }
      });
      console.log(`  ✅ WaterCharges adjusted to match bill total`);
    }
  }
  
  return fixedBreakdown;
}

function calculatePaidBillDiscrepancy(unitBill, readings, fiscalQuarter, quarterMonths, unitId, billId) {
  // Calculate what the bill SHOULD have been based on meter readings
  const mb = unitBill.monthlyBreakdown;
  
  if (!Array.isArray(mb)) {
    return null; // Can't calculate if not an array
  }
  
  // Calculate consumption from readings
  const readingsConsumption = {};
  let readingsTotal = 0;
  
  const priorMonthMap = {
    'July': 'June',
    'October': 'September',
    'January': 'December',
    'April': 'March'
  };
  
  for (let i = 0; i < 3; i++) {
    const monthName = quarterMonths[i];
    const priorMonthName = i === 0 ? priorMonthMap[monthName] : quarterMonths[i - 1];
    
    const consumption = calculateConsumptionFromReadings(readings, monthName, priorMonthName);
    if (consumption !== null) {
      readingsConsumption[monthName] = consumption;
      readingsTotal += consumption;
    }
  }
  
  // Calculate what waterCharge should have been
  const currentWaterCharge = unitBill.waterCharge || 0;
  const currentTotalConsumption = unitBill.totalConsumption || 0;
  const expectedWaterCharge = readingsTotal * RATE_PER_M3;
  let waterChargeDifference = expectedWaterCharge - currentWaterCharge;
  
  // Special handling: Q1 had a $289.73 overcharge that was already credited
  // If the discrepancy matches this amount in Q1, it's not a real discrepancy
  const isQ1 = fiscalQuarter === 1;
  const isKnownQ1Credit = isQ1 && Math.abs(Math.abs(waterChargeDifference) - KNOWN_Q1_CREDIT_AMOUNT) < 50; // Within 50 centavos (0.50 pesos)
  
  if (isKnownQ1Credit) {
    console.log(`  ✅ Recognizing known Q1 credit: $${(KNOWN_Q1_CREDIT_AMOUNT / 100).toFixed(2)} sewer service overcharge already credited`);
    // Adjust the difference to exclude the known credit
    if (waterChargeDifference < 0) {
      // Was overcharged, so the difference is negative - adjust by adding back the known credit
      waterChargeDifference = waterChargeDifference + KNOWN_Q1_CREDIT_AMOUNT;
    } else if (waterChargeDifference > 0) {
      // Was undercharged, adjust by subtracting the known credit
      waterChargeDifference = waterChargeDifference - KNOWN_Q1_CREDIT_AMOUNT;
    }
  }
  
  // Calculate monthly discrepancies
  const monthlyDiscrepancies = [];
  let totalExpectedCharge = 0;
  
  for (let i = 0; i < 3; i++) {
    const monthName = quarterMonths[i];
    const monthBreakdown = mb.find(m => m.month === monthName);
    
    if (!monthBreakdown) continue;
    
    const billConsumption = monthBreakdown.consumption || 0;
    const readingsCons = readingsConsumption[monthName];
    
    if (readingsCons !== undefined && billConsumption !== readingsCons) {
      const expectedMonthCharge = readingsCons * RATE_PER_M3;
      const actualMonthCharge = monthBreakdown.waterCharge || 0;
      const monthDifference = expectedMonthCharge - actualMonthCharge;
      
      monthlyDiscrepancies.push({
        month: monthName,
        billConsumption,
        readingsConsumption: readingsCons,
        billCharge: actualMonthCharge / 100, // Convert to pesos
        expectedCharge: expectedMonthCharge / 100,
        difference: monthDifference / 100
      });
      
      totalExpectedCharge += expectedMonthCharge;
    } else if (readingsCons !== undefined) {
      totalExpectedCharge += (monthBreakdown.waterCharge || 0);
    }
  }
  
  // If no discrepancies found (after accounting for known Q1 credit), return null
  if (monthlyDiscrepancies.length === 0 && Math.abs(waterChargeDifference) < 50) {
    if (isKnownQ1Credit) {
      console.log(`  ✅ After accounting for known Q1 credit, no additional discrepancy found`);
    }
    return null;
  }
  
  // Return discrepancy info for display (don't fix)
  return {
    isPaid: true,
    discrepancy: {
      unitId,
      billId,
      quarter: fiscalQuarter,
      currentWaterCharge: currentWaterCharge / 100,
      expectedWaterCharge: expectedWaterCharge / 100,
      waterChargeDifference: waterChargeDifference / 100,
      currentConsumption: currentTotalConsumption,
      readingsConsumption: readingsTotal,
      monthlyDiscrepancies,
      knownQ1CreditApplied: isKnownQ1Credit ? KNOWN_Q1_CREDIT_AMOUNT / 100 : 0
    }
  };
}

async function fixUnitMisallocation(unitId, dryRun = false) {
  console.log(`\n🔧 Fixing consumption misallocation for Unit ${unitId}...\n`);
  
  const db = await getDb();
  
  // Get all quarterly bills for this unit
  const billsRef = db.collection('clients').doc(CLIENT_ID)
    .collection('projects').doc('waterBills')
    .collection('bills');
  
  const billsSnapshot = await billsRef.get();
  const updates = {};
  const paidBillDiscrepancies = []; // Track discrepancies for paid bills
  
  for (const billDoc of billsSnapshot.docs) {
    const billData = billDoc.data();
    const units = billData.bills?.units || {};
    const unitBill = units[unitId];
    
    if (!unitBill) continue;
    
    const billId = billDoc.id;
    const fiscalYear = billData.fiscalYear || parseInt(billId.match(/\d{4}/)?.[0] || '2026');
    const fiscalQuarter = billData.fiscalQuarter || parseInt(billId.match(/Q(\d)/)?.[1] || '1');
    const quarterMonths = QUARTER_MONTHS[fiscalQuarter] || QUARTER_MONTHS[1];
    
    console.log(`\n📊 Processing ${billId} (FY ${fiscalYear}, Q${fiscalQuarter})...`);
    
    // Get readings for this quarter
    const quarterStartMonth = (fiscalQuarter - 1) * 3;
    const readings = await getReadings(unitId, fiscalYear, quarterStartMonth);
    
    if (Object.keys(readings).length < 4) { // Need 3 months + prior month
      console.warn(`  ⚠️  Missing readings data - cannot fix`);
      continue;
    }
    
    // Fix misallocation (or calculate discrepancy if paid)
    const result = await fixQuarterMisallocation(unitBill, readings, fiscalQuarter, quarterMonths, unitId, billId);
    
    // Check if bill is paid - if so, collect discrepancy info instead of fixing
    if (result && result.isPaid) {
      paidBillDiscrepancies.push(result.discrepancy);
      continue; // Skip fixing paid bills
    }
    
    if (result) {
      const fixedBreakdown = result;
      if (!updates[billId]) {
        updates[billId] = {
          ...billData,
          bills: {
            ...billData.bills,
            units: {
              ...units
            }
          }
        };
      }
      updates[billId].bills.units[unitId].monthlyBreakdown = fixedBreakdown;
      console.log(`  ✅ Fixed misallocation for ${billId}`);
    }
  }
  
  if (Object.keys(updates).length === 0) {
    console.log(`\n✅ No misallocation found for Unit ${unitId}`);
    return;
  }
  
  // Apply updates
  if (dryRun) {
    console.log(`\n🔍 DRY RUN - Would update ${Object.keys(updates).length} bill(s):`);
    Object.entries(updates).forEach(([billId, billData]) => {
      console.log(`\n  ${billId}:`);
      console.log(JSON.stringify({
        [`bills.units.${unitId}.monthlyBreakdown`]: billData.bills.units[unitId].monthlyBreakdown
      }, null, 2));
    });
  } else {
    console.log(`\n💾 Updating ${Object.keys(updates).length} bill(s)...`);
    for (const [billId, billData] of Object.entries(updates)) {
      await billsRef.doc(billId).update({
        [`bills.units.${unitId}.monthlyBreakdown`]: billData.bills.units[unitId].monthlyBreakdown
      });
    }
    console.log(`✅ Successfully fixed consumption misallocation for Unit ${unitId}`);
  }
  
  // Return paid bill discrepancies for display
  return paidBillDiscrepancies;
}

async function fixAllUnits(dryRun = false) {
  console.log(`\n🔧 Fixing consumption misallocation for ALL units...\n`);
  
  const db = await getDb();
  
  // Get all bills to find all units
  const billsRef = db.collection('clients').doc(CLIENT_ID)
    .collection('projects').doc('waterBills')
    .collection('bills');
  
  const billsSnapshot = await billsRef.get();
  const unitIds = new Set();
  
  billsSnapshot.forEach(billDoc => {
    const billData = billDoc.data();
    const units = billData.bills?.units || {};
    Object.keys(units).forEach(unitId => unitIds.add(unitId));
  });
  
  console.log(`Found ${unitIds.size} unit(s) to process\n`);
  
  const allPaidBillDiscrepancies = [];
  
  for (const unitId of Array.from(unitIds).sort()) {
    const unitPaidDiscrepancies = await fixUnitMisallocation(unitId, dryRun);
    if (unitPaidDiscrepancies && unitPaidDiscrepancies.length > 0) {
      allPaidBillDiscrepancies.push(...unitPaidDiscrepancies);
    }
  }
  
  console.log(`\n✅ Completed processing all units`);
  
  // Return paid bill discrepancies for display
  return allPaidBillDiscrepancies;
}

function displayPaidBillDiscrepancies(discrepancies, environment) {
  console.log('\n' + '='.repeat(80));
  console.log('💰 PAID BILL DISCREPANCIES - CREDIT CALCULATIONS');
  console.log('='.repeat(80));
  console.log(`Environment: ${environment}`);
  console.log(`Found ${discrepancies.length} paid bill(s) with consumption misallocation\n`);
  console.log('⚠️  These bills were PAID and cannot be modified.');
  console.log('📊 Use the amounts below to offer credits to unit owners.\n');
  
  let totalCreditAmount = 0;
  
  // Group by unit
  const byUnit = {};
  discrepancies.forEach(disc => {
    if (!byUnit[disc.unitId]) {
      byUnit[disc.unitId] = [];
    }
    byUnit[disc.unitId].push(disc);
  });
  
  Object.keys(byUnit).sort().forEach(unitId => {
    const unitDiscrepancies = byUnit[unitId];
    console.log(`\n🏠 Unit ${unitId}:`);
    console.log('-'.repeat(80));
    
    let unitTotalCredit = 0;
    
    unitDiscrepancies.forEach(disc => {
      console.log(`\n  📋 ${disc.billId} (Q${disc.quarter}):`);
      console.log(`     Current Bill: ${disc.currentConsumption} m³ = $${disc.currentWaterCharge.toFixed(2)}`);
      console.log(`     Should Be: ${disc.readingsConsumption} m³ = $${disc.expectedWaterCharge.toFixed(2)}`);
      
      // Show known Q1 credit if applicable
      if (disc.knownQ1CreditApplied > 0) {
        console.log(`     ⚠️  Known Q1 Credit Already Applied: $${disc.knownQ1CreditApplied.toFixed(2)} (sewer service overcharge)`);
        console.log(`     (This credit was already issued - not included in discrepancy calculation)`);
      }
      
      console.log(`     Difference: ${(disc.readingsConsumption - disc.currentConsumption)} m³ = $${Math.abs(disc.waterChargeDifference).toFixed(2)}`);
      
      // Only show credit/overcharge if there's an actual discrepancy (excluding known Q1 credit)
      if (Math.abs(disc.waterChargeDifference) >= 0.50) {
        if (disc.waterChargeDifference < 0) {
          console.log(`     💰 CREDIT DUE: $${Math.abs(disc.waterChargeDifference).toFixed(2)}`);
          unitTotalCredit += Math.abs(disc.waterChargeDifference);
        } else if (disc.waterChargeDifference > 0) {
          console.log(`     ⚠️  Overcharged: $${disc.waterChargeDifference.toFixed(2)}`);
          unitTotalCredit -= disc.waterChargeDifference;
        }
      } else {
        console.log(`     ✅ No discrepancy after accounting for known Q1 credit`);
      }
      
      if (disc.monthlyDiscrepancies && disc.monthlyDiscrepancies.length > 0) {
        console.log(`\n     Monthly Breakdown:`);
        disc.monthlyDiscrepancies.forEach(month => {
          console.log(`       ${month.month}: Bill ${month.billConsumption} m³ ($${month.billCharge.toFixed(2)}) → Should be ${month.readingsConsumption} m³ ($${month.expectedCharge.toFixed(2)})`);
          if (month.difference !== 0) {
            console.log(`         ${month.difference > 0 ? 'Overcharged' : 'Credit'}: $${Math.abs(month.difference).toFixed(2)}`);
          }
        });
      }
    });
    
    if (unitTotalCredit !== 0) {
      console.log(`\n  💰 UNIT ${unitId} TOTAL ${unitTotalCredit > 0 ? 'CREDIT DUE' : 'OVERCHARGE'}: $${Math.abs(unitTotalCredit).toFixed(2)}`);
      totalCreditAmount += unitTotalCredit;
    }
  });
  
  console.log('\n' + '='.repeat(80));
  if (totalCreditAmount > 0) {
    console.log(`💰 TOTAL CREDITS TO ISSUE: $${totalCreditAmount.toFixed(2)}`);
  } else if (totalCreditAmount < 0) {
    console.log(`⚠️  TOTAL OVERCHARGE: $${Math.abs(totalCreditAmount).toFixed(2)}`);
  } else {
    console.log(`✅ No credits or overcharges (discrepancies balanced out)`);
  }
  console.log('='.repeat(80) + '\n');
}

async function main() {
  try {
    const dryRun = process.argv.includes('--dry-run') || process.argv.includes('-n');
    const allUnits = process.argv.includes('--all');
    const unitId = process.argv.find(arg => /^\d{3}$/.test(arg));
    
    console.log('═'.repeat(60));
    console.log(`🔧 Consumption Misallocation Fix`);
    console.log(`🔒 Mode: ${dryRun ? 'DRY RUN' : 'EXECUTING'}`);
    console.log(`📦 Target: ${useProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    console.log('═'.repeat(60));
    
    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be saved\n');
    }
    
    let paidBillDiscrepancies = [];
    
    if (allUnits) {
      paidBillDiscrepancies = await fixAllUnits(dryRun) || [];
    } else if (unitId) {
      paidBillDiscrepancies = await fixUnitMisallocation(unitId, dryRun) || [];
    } else {
      console.error('❌ Error: Unit number or --all flag required');
      console.error('Usage: node scripts/fix-consumption-misallocation.js <unitId> [--dry-run]');
      console.error('       node scripts/fix-consumption-misallocation.js --all [--dry-run]');
      process.exit(1);
    }
    
    // Display paid bill discrepancies if any
    if (paidBillDiscrepancies.length > 0) {
      displayPaidBillDiscrepancies(paidBillDiscrepancies, useProduction ? 'PRODUCTION' : 'DEVELOPMENT');
    }
    
  } catch (error) {
    console.error('❌ Error fixing consumption misallocation:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
