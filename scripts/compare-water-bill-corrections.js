#!/usr/bin/env node
/**
 * Compare Water Bill Corrections
 * 
 * Compares bills_original (original bills) to bills (corrected bills) to show
 * what changed when bills were corrected from meter readings.
 * 
 * This script does NOT read meter readings - it only compares the two bill versions
 * to show the differences in billing amounts.
 * 
 * Usage:
 *   node scripts/compare-water-bill-corrections.js 101
 *   node scripts/compare-water-bill-corrections.js 101 --prod
 *   node scripts/compare-water-bill-corrections.js --all
 *   node scripts/compare-water-bill-corrections.js --all --file
 */

import { getDb } from '../functions/backend/firebase.js';
import { centavosToPesos } from '../functions/shared/utils/currencyUtils.js';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const useProduction = args.includes('--prod');
const allUnits = args.includes('--all');
const writeToFile = args.includes('--file');
const unitId = allUnits ? '--all' : args.find(arg => /^\d{3}$/.test(arg) || arg === '--all' || arg === 'all');

// Suppress Firebase logging if writing to file
if (writeToFile) {
  process.env.SUPPRESS_FIREBASE_LOGGING = 'true';
}

const clientId = 'AVII'; // Only AVII has water bills

// Fiscal year configuration (AVII starts in July)
const FISCAL_YEAR_START_MONTH = 7;

// Calendar month names for display
const calendarMonthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Fiscal month names (for quarterly bills)
const fiscalMonthNames = [
  'July', 'August', 'September', 'October', 'November', 'December',
  'January', 'February', 'March', 'April', 'May', 'June'
];

/**
 * Get calendar year and month for a fiscal month
 */
function getCalendarDate(fiscalMonth, fiscalYear) {
  let calendarYear = fiscalYear - 1; // Fiscal year 2026 starts in calendar year 2025
  let calendarMonth = fiscalMonth + FISCAL_YEAR_START_MONTH - 1; // Fiscal month 0 (July) = calendar month 6 (0-indexed)
  
  if (calendarMonth >= 12) {
    calendarMonth -= 12;
    calendarYear += 1;
  }
  
  return { calendarYear, calendarMonth };
}

/**
 * Format currency in pesos with thousands separator
 */
function formatCurrency(centavos) {
  const pesos = centavosToPesos(centavos);
  return pesos.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Get fiscal month name
 */
function getMonthName(fiscalMonth) {
  return fiscalMonthNames[fiscalMonth] || `Month ${fiscalMonth}`;
}

/**
 * Get quarterly bills for a unit (from bills field)
 */
async function getQuarterlyBillsForUnit(db, clientId, unitId) {
  const billsRef = db.collection('clients').doc(clientId)
    .collection('projects').doc('waterBills')
    .collection('bills');
  
  const snapshot = await billsRef.get();
  const quarterlyBills = [];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const billId = doc.id;
    
    // Only include quarterly bills (format: YYYY-Q#)
    if (/^\d{4}-Q[1-4]$/.test(billId) && data.billingPeriod === 'quarterly') {
      const unitBill = data.bills?.units?.[unitId];
      const unitBillOriginal = data.bills_original?.units?.[unitId];
      
      // Only include if we have both original and corrected bills
      if (unitBill && unitBillOriginal) {
        quarterlyBills.push({
          billId,
          fiscalYear: data.fiscalYear,
          fiscalQuarter: data.fiscalQuarter,
          quarterMonths: data.quarterMonths || [],
          dueDate: data.dueDate,
          billDate: data.billDate,
          unitBill,
          unitBillOriginal,
          configSnapshot: data.configSnapshot || {}
        });
      }
    }
  });
  
  // Sort by fiscal year and quarter
  quarterlyBills.sort((a, b) => {
    if (a.fiscalYear !== b.fiscalYear) return a.fiscalYear - b.fiscalYear;
    return a.fiscalQuarter - b.fiscalQuarter;
  });
  
  return quarterlyBills;
}

/**
 * Display quarter breakdown in table format
 */
function displayQuarterBreakdown(quarterBill, unitId) {
  const { billId, fiscalYear, fiscalQuarter, quarterMonths, unitBill, unitBillOriginal } = quarterBill;
  
  // Calculate quarter start and end months
  const quarterStartMonth = (fiscalQuarter - 1) * 3; // Q1=0, Q2=3, Q3=6, Q4=9
  const quarterEndMonth = quarterStartMonth + 2; // Q1=0-2, Q2=3-5, etc.
  
  // Get monthly breakdown from both versions - ensure they're arrays
  const monthlyBreakdown = Array.isArray(unitBill.monthlyBreakdown) 
    ? unitBill.monthlyBreakdown 
    : [];
  
  const monthlyBreakdownOriginal = Array.isArray(unitBillOriginal.monthlyBreakdown) 
    ? unitBillOriginal.monthlyBreakdown 
    : [];
  
  // Get rate from config
  const ratePerM3 = quarterBill.configSnapshot.ratePerM3 || 5000; // Default to 50 pesos
  
  // Build comparison table rows for months
  const monthRows = [];
  
  // Track totals for comparison
  let quarterTotalOriginalConsumption = 0;
  let quarterTotalOriginalCharge = 0;
  let quarterTotalCorrectedConsumption = 0;
  let quarterTotalCorrectedCharge = 0;
  let quarterTotalVariance = 0;
  
  // Process each month in the quarter
  for (let monthIndex = quarterStartMonth; monthIndex <= quarterEndMonth; monthIndex++) {
    const monthName = getMonthName(monthIndex);
    const { calendarYear, calendarMonth } = getCalendarDate(monthIndex, fiscalYear);
    const calendarMonthName = calendarMonthNames[calendarMonth];
    
    // Find monthly breakdown entries in both versions
    const monthBreakdownOriginal = monthlyBreakdownOriginal.find(m => m && m.month === monthName) || null;
    const monthBreakdownCorrected = monthlyBreakdown.find(m => m && m.month === monthName) || null;
    
    // Get original values
    const originalConsumption = monthBreakdownOriginal?.consumption || 0;
    const originalWaterCharge = monthBreakdownOriginal?.waterCharge || 0;
    const originalTotalAmount = monthBreakdownOriginal?.totalAmount || 0;
    
    // Get corrected values
    const correctedConsumption = monthBreakdownCorrected?.consumption || 0;
    const correctedWaterCharge = monthBreakdownCorrected?.waterCharge || 0;
    const correctedTotalAmount = monthBreakdownCorrected?.totalAmount || 0;
    
    // Calculate variance (corrected - original)
    const variance = correctedWaterCharge - originalWaterCharge;
    
    // Track totals
    quarterTotalOriginalConsumption += originalConsumption;
    quarterTotalOriginalCharge += originalWaterCharge;
    quarterTotalCorrectedConsumption += correctedConsumption;
    quarterTotalCorrectedCharge += correctedWaterCharge;
    quarterTotalVariance += variance;
    
    // Format values for display
    const originalConsumptionStr = originalConsumption > 0 ? `${originalConsumption} m³` : '-';
    const originalChargeStr = originalWaterCharge > 0 ? `$${formatCurrency(originalWaterCharge)}` : '-';
    const correctedConsumptionStr = correctedConsumption > 0 ? `${correctedConsumption} m³` : '-';
    const correctedChargeStr = correctedWaterCharge > 0 ? `$${formatCurrency(correctedWaterCharge)}` : '-';
    
    // Format variance
    let varianceStr = '-';
    if (Math.abs(variance) >= 50) { // More than 0.50 pesos difference
      const variancePesos = Math.abs(variance) / 100;
      const varianceDirection = variance > 0 ? 'INCREASED' : 'DECREASED';
      varianceStr = `$${variancePesos.toFixed(2)} ${varianceDirection}`;
    }
    
    monthRows.push({
      month: `${calendarMonthName.substring(0, 3)} ${calendarYear}`,
      originalConsumption: originalConsumptionStr,
      originalCharge: originalChargeStr,
      correctedConsumption: correctedConsumptionStr,
      correctedCharge: correctedChargeStr,
      variance: varianceStr
    });
  }
  
  // Print comparison table header
  console.log('\n' + '='.repeat(120));
  console.log(`WATER BILL CORRECTION COMPARISON - Unit ${unitId} - Q${fiscalQuarter} ${fiscalYear}`);
  console.log('='.repeat(120));
  console.log('| Month    | ORIGINAL BILLED                    | CORRECTED BILLED                  | Variance |');
  console.log('|          | Consumption | Amount               | Consumption | Amount               |         |');
  console.log('| -------- | ----------- | -------------------- | ----------- | -------------------- | ------- |');
  
  // Print month rows
  monthRows.forEach(row => {
    const monthPadded = row.month.padEnd(8);
    const origConsPadded = row.originalConsumption.padEnd(11);
    const origChgPadded = row.originalCharge.padEnd(20);
    const corrConsPadded = row.correctedConsumption.padEnd(11);
    const corrChgPadded = row.correctedCharge.padEnd(20);
    const varPadded = row.variance.padEnd(7);
    
    console.log(`| ${monthPadded} | ${origConsPadded} | ${origChgPadded} | ${corrConsPadded} | ${corrChgPadded} | ${varPadded} |`);
  });
  
  // Print quarter totals
  console.log('| -------- | ----------- | -------------------- | ----------- | -------------------- | ------- |');
  
  const origTotalConsStr = quarterTotalOriginalConsumption > 0 ? `${quarterTotalOriginalConsumption} m³` : '-';
  const origTotalChgStr = quarterTotalOriginalCharge > 0 ? `$${formatCurrency(quarterTotalOriginalCharge)}` : '-';
  const corrTotalConsStr = quarterTotalCorrectedConsumption > 0 ? `${quarterTotalCorrectedConsumption} m³` : '-';
  const corrTotalChgStr = quarterTotalCorrectedCharge > 0 ? `$${formatCurrency(quarterTotalCorrectedCharge)}` : '-';
  
  let totalVarianceStr = '-';
  if (Math.abs(quarterTotalVariance) >= 50) {
    const totalVariancePesos = Math.abs(quarterTotalVariance) / 100;
    const totalVarianceDirection = quarterTotalVariance > 0 ? 'INCREASED' : 'DECREASED';
    totalVarianceStr = `$${totalVariancePesos.toFixed(2)} ${totalVarianceDirection}`;
  }
  
  console.log(`| Q${fiscalQuarter} TOTAL | ${origTotalConsStr.padEnd(11)} | ${origTotalChgStr.padEnd(20)} | ${corrTotalConsStr.padEnd(11)} | ${corrTotalChgStr.padEnd(20)} | ${totalVarianceStr.padEnd(7)} |`);
  console.log('='.repeat(120));
  
  // Show overall bill totals comparison
  const originalTotalAmount = unitBillOriginal.totalAmount || 0;
  const correctedTotalAmount = unitBill.totalAmount || 0;
  const totalDifference = correctedTotalAmount - originalTotalAmount;
  const paidAmount = unitBill.paidAmount || 0;
  
  console.log(`\nOverall Bill Totals:`);
  console.log(`  Original total: $${formatCurrency(originalTotalAmount)}`);
  console.log(`  Corrected total: $${formatCurrency(correctedTotalAmount)}`);
  console.log(`  Difference: ${totalDifference >= 0 ? '+' : ''}$${formatCurrency(Math.abs(totalDifference))} ${totalDifference >= 0 ? 'INCREASED' : 'DECREASED'}`);
  console.log(`  Amount paid: $${formatCurrency(paidAmount)}`);
  console.log(`  Credit adjustment needed: ${(paidAmount - correctedTotalAmount) >= 0 ? '+' : ''}$${formatCurrency(Math.abs(paidAmount - correctedTotalAmount))} ${(paidAmount - correctedTotalAmount) >= 0 ? '(ADD credit)' : '(DEBIT)'}`);
}

/**
 * Generate breakdown for a single unit
 */
async function generateBreakdownForUnit(unitId) {
  try {
    // Initialize Firebase
    const db = await getDb();
    
    // Get all quarterly bills for this unit
    const quarterlyBills = await getQuarterlyBillsForUnit(db, clientId, unitId);
    
    if (quarterlyBills.length === 0) {
      console.error(`❌ No quarterly bills found for unit ${unitId} (or bills_original not found)`);
      return { bills: 0 };
    }
    
    console.log(`\n📋 Found ${quarterlyBills.length} quarterly bill(s) for Unit ${unitId}`);
    
    // Display breakdown for each quarter
    for (const quarterBill of quarterlyBills) {
      displayQuarterBreakdown(quarterBill, unitId);
    }
    
    return { bills: quarterlyBills.length };
  } catch (error) {
    console.error(`❌ Error generating breakdown for unit ${unitId}:`, error);
    throw error;
  }
}

/**
 * Capture console output
 */
let outputBuffer = [];
let originalConsoleLog = console.log;
let originalConsoleError = console.error;

function captureOutput() {
  outputBuffer = [];
  const originalLog = console.log;
  const originalError = console.error;
  
  console.log = (...args) => {
    const message = args.map(arg => {
      if (typeof arg === 'string') return arg;
      if (typeof arg === 'object' && arg !== null) return JSON.stringify(arg);
      return String(arg);
    }).join(' ');
    
    // Filter out Firebase logging and other noise
    if (!message.includes('🔥') && !message.includes('🔑') && !message.includes('✅') && 
        !message.includes('Initializing Firebase') && !message.includes('Using Firebase') &&
        !message.includes('Firebase Admin SDK') && !message.includes('Firebase project') &&
        !message.includes('already initialized') && message.trim() !== '') {
      outputBuffer.push(message);
    }
    // Don't output to console when writing to file (suppress all output)
  };
  
  console.error = (...args) => {
    const message = args.map(arg => {
      if (typeof arg === 'string') return arg;
      if (typeof arg === 'object' && arg !== null) return JSON.stringify(arg);
      return String(arg);
    }).join(' ');
    
    // Only capture actual errors, not Firebase init messages
    if (!message.includes('🔥') && !message.includes('🔑') && !message.includes('✅') &&
        !message.includes('Initializing Firebase') && !message.includes('Using Firebase') &&
        message.trim() !== '') {
      outputBuffer.push(message);
    }
    // Don't output to console when writing to file
  };
}

function restoreOutput() {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
}

function getOutput() {
  return outputBuffer.join('\n');
}

/**
 * Main function
 */
async function generateBreakdown(unitId) {
  if (!unitId) {
    console.error('❌ Error: Unit number or --all flag is required');
    console.error('Usage: node scripts/compare-water-bill-corrections.js <unitNumber> [--prod] [--file]');
    console.error('       node scripts/compare-water-bill-corrections.js --all [--prod] [--file]');
    process.exit(1);
  }
  
  // Capture output if writing to file
  if (writeToFile) {
    captureOutput();
  }
  
  try {
    const allUnits = unitId === '--all' || unitId === 'all';
    
    if (allUnits) {
      // Get all units from Q1 or Q2 bill
      const db = await getDb();
      const q1BillRef = db.collection('clients').doc(clientId)
        .collection('projects').doc('waterBills')
        .collection('bills').doc('2026-Q1');
      
      const q1BillDoc = await q1BillRef.get();
      if (!q1BillDoc.exists) {
        console.error('❌ No Q1 2026 bill found');
        return;
      }
      
      const q1BillData = q1BillDoc.data();
      const units = q1BillData.bills?.units || {};
      const unitIds = Object.keys(units);
      
      if (unitIds.length === 0) {
        console.error('❌ No units found in bill document');
        return;
      }
      
      console.log(`\n📋 Processing ${unitIds.length} unit(s)...\n`);
      
      // Process each unit
      for (const unit of unitIds) {
        // Start capturing after Firebase init for first unit
        if (writeToFile && unit === unitIds[0]) {
          await getDb(); // Initialize Firebase
          captureOutput(); // Start capturing after init
        }
        
        await generateBreakdownForUnit(unit);
      }
    } else {
      // Start capturing after Firebase init
      if (writeToFile) {
        await getDb(); // Initialize Firebase
        captureOutput(); // Start capturing after init
      }
      
      // Process single unit
      await generateBreakdownForUnit(unitId);
    }
    
    // Write to file if requested
    if (writeToFile) {
      restoreOutput(); // Restore console before writing status message
      const output = getOutput();
      
      // Generate filename with date
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const filename = `water-bill-correction-comparison-${dateStr}.txt`;
      const filepath = `${__dirname}/../test-results/${filename}`;
      
      // Ensure test-results directory exists
      const testResultsDir = `${__dirname}/../test-results`;
      if (!existsSync(testResultsDir)) {
        await mkdir(testResultsDir, { recursive: true });
      }
      
      // Write to file (remove leading blank line if present)
      const cleanOutput = output.trimStart();
      await writeFile(filepath, cleanOutput, 'utf8');
      console.log(`\n✅ Report written to: ${filepath}`);
    } else {
      restoreOutput();
    }
    
  } catch (error) {
    restoreOutput();
    console.error('❌ Error generating breakdown:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
generateBreakdown(unitId);
