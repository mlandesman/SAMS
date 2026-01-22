#!/usr/bin/env node
/**
 * Water Bill Calculation Breakdown Script
 * 
 * Shows water bill calculation breakdown for a single unit, organized by quarters.
 * This is Phase 1A of the Water Consumption Report (#129).
 * 
 * Usage:
 *   node scripts/waterBillBreakdown.js 101
 *   node scripts/waterBillBreakdown.js 101 --prod
 *   node scripts/waterBillBreakdown.js --all --file
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
 * Format date for display
 */
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  } catch (e) {
    return dateString;
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
 * Get quarterly bills for a unit
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
      if (unitBill) {
        quarterlyBills.push({
          billId,
          fiscalYear: data.fiscalYear,
          fiscalQuarter: data.fiscalQuarter,
          quarterMonths: data.quarterMonths || [],
          dueDate: data.dueDate,
          billDate: data.billDate,
          unitBill,
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
 * Get readings for a specific month
 */
async function getMonthReadings(db, clientId, fiscalYear, fiscalMonth) {
  const docId = `${fiscalYear}-${String(fiscalMonth).padStart(2, '0')}`;
  const doc = await db.collection('clients').doc(clientId)
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
 * Get prior month readings for consumption calculation
 */
async function getPriorMonthReadings(db, clientId, fiscalYear, fiscalMonth) {
  if (fiscalMonth === 0) {
    // Q1 starts in July (month 0), need June (month 11 of prior fiscal year)
    const priorYear = fiscalYear - 1;
    return await getMonthReadings(db, clientId, priorYear, 11);
  } else {
    return await getMonthReadings(db, clientId, fiscalYear, fiscalMonth - 1);
  }
}

/**
 * Get month name for a fiscal month
 */
function getMonthName(fiscalMonth) {
  return fiscalMonthNames[fiscalMonth] || `Month ${fiscalMonth}`;
}

/**
 * Format date for payments display (e.g., "July 17, 2025")
 */
function formatPaymentDate(dateString) {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const month = monthNames[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
  } catch (e) {
    return dateString;
  }
}

/**
 * Display quarter breakdown in table format
 */
function displayQuarterBreakdown(quarterBill, readingsData, priorReadingsData, unitId) {
  const { billId, fiscalYear, fiscalQuarter, quarterMonths, dueDate, unitBill, configSnapshot } = quarterBill;
  
  // Calculate quarter start and end months
  const quarterStartMonth = (fiscalQuarter - 1) * 3; // Q1=0, Q2=3, Q3=6, Q4=9
  const quarterEndMonth = quarterStartMonth + 2; // Q1=0-2, Q2=3-5, etc.
  
  // Get monthly breakdown from bill - ensure it's an array
  const monthlyBreakdown = Array.isArray(unitBill.monthlyBreakdown) 
    ? unitBill.monthlyBreakdown 
    : [];
  
  // Note: monthlyBreakdown can be either an array or an object keyed by month index (1-based)
  // The code handles both formats automatically
  
  // Build comparison table rows for months
  const monthRows = [];
  const discrepancies = []; // Track discrepancies for summary
  let quarterStartReading = null;
  let quarterEndReading = null;
  
  // Track totals for comparison
  let quarterTotalShouldBeConsumption = 0;
  let quarterTotalShouldBeCharge = 0;
  let quarterTotalWasBilledConsumption = 0;
  let quarterTotalWasBilledCharge = 0;
  let quarterTotalVariance = 0;
  
  // Note: Bill totals will be used later for quarter totals
  
  // Process each month in the quarter
  for (let monthIndex = quarterStartMonth; monthIndex <= quarterEndMonth; monthIndex++) {
    const monthName = getMonthName(monthIndex);
    const { calendarYear, calendarMonth } = getCalendarDate(monthIndex, fiscalYear);
    const calendarMonthName = calendarMonthNames[calendarMonth];
    
    // Find monthly breakdown entry - handle both array and object formats
    // CRITICAL: For quarterly bills, monthlyBreakdown keys are 0-based within the quarter, not fiscal year month index
    // Q1 (months 0-2): keys "0", "1", "2" = July, August, September
    // Q2 (months 3-5): keys "0", "1", "2" = October, November, December
    // So we need to calculate position within quarter: monthIndex - quarterStartMonth
    let monthBreakdown = null;
    if (Array.isArray(monthlyBreakdown)) {
      // Array format: find by month name
      monthBreakdown = monthlyBreakdown.find(m => m && m.month === monthName) || null;
    } else if (monthlyBreakdown && typeof monthlyBreakdown === 'object') {
      // Object format: Calculate position within quarter (0, 1, 2)
      const positionInQuarter = monthIndex - quarterStartMonth;
      
      // Try quarter position key first (most common for quarterly bills)
      const quarterPositionKey = String(positionInQuarter);
      monthBreakdown = monthlyBreakdown[quarterPositionKey] || null;
      
      // Fallback: Try fiscal year month index (for monthly bills or different structure)
      if (!monthBreakdown) {
        const monthIndexStr = String(monthIndex);
        monthBreakdown = monthlyBreakdown[monthIndexStr] || null;
      }
      
      // Fallback: Try 1-based indexing within quarter
      if (!monthBreakdown) {
        const oneBasedQuarterKey = String(positionInQuarter + 1);
        monthBreakdown = monthlyBreakdown[oneBasedQuarterKey] || null;
      }
      
      // Fallback: Try 1-based fiscal year month index
      if (!monthBreakdown) {
        const keys = Object.keys(monthlyBreakdown);
        if (keys.length > 0 && keys.includes("1") && !keys.includes("0")) {
          const oneBasedKey = String(monthIndex + 1);
          monthBreakdown = monthlyBreakdown[oneBasedKey] || null;
        }
      }
      
      // As last resort, try month name as key
      if (!monthBreakdown) {
        monthBreakdown = monthlyBreakdown[monthName] || null;
      }
    }
    
    // Get readings for this month
    const monthReadings = readingsData[monthIndex];
    const priorMonthReadings = monthIndex === quarterStartMonth 
      ? priorReadingsData 
      : readingsData[monthIndex - 1];
    
    // Extract unit reading (for meter readings display - reference only)
    const currentReading = monthReadings ? extractReading(monthReadings.readings?.[unitId]) : null;
    const priorReading = priorMonthReadings ? extractReading(priorMonthReadings.readings?.[unitId]) : null;
    
    // Get rate from config
    const ratePerM3 = configSnapshot.ratePerM3 || 0;
    
    // Calculate consumption from meter readings (what SHOULD HAVE BEEN billed)
    const readingsConsumption = (currentReading !== null && priorReading !== null) 
      ? Math.max(0, currentReading - priorReading) 
      : null;
    
    // Calculate what SHOULD HAVE BEEN charged based on meter readings (50 pesos per m³)
    const shouldBeCharge = readingsConsumption !== null ? readingsConsumption * ratePerM3 : 0;
    
    // Store start reading for quarter total
    if (monthIndex === quarterStartMonth && priorReading !== null) {
      quarterStartReading = priorReading;
    }
    
    // Store end reading for quarter total (last month's current reading)
    if (monthIndex === quarterEndMonth && currentReading !== null) {
      quarterEndReading = currentReading;
    }
    
    // Get what WAS BILLED from the bill document
    let baseCharge = 0;
    let waterCharge = 0;
    let carWashCharge = 0;
    let boatWashCharge = 0;
    let consumption = 0;
    let billConsumption = null; // Track what the bill says for discrepancy detection
    let hasDiscrepancy = false;
    
    if (monthBreakdown !== null && monthBreakdown !== undefined) {
      // Get charges from bill (these are what was actually billed)
      waterCharge = monthBreakdown.waterCharge || 0;
      carWashCharge = monthBreakdown.carWashCharge || 0;
      boatWashCharge = monthBreakdown.boatWashCharge || 0;
      baseCharge = waterCharge + carWashCharge + boatWashCharge;
      
      // CRITICAL: Consumption MUST match the base charge shown
      // Priority 1: Use consumption from bill if it exists and is valid
      if (monthBreakdown.consumption !== undefined && monthBreakdown.consumption !== null && monthBreakdown.consumption > 0) {
        consumption = monthBreakdown.consumption;
        
        // Validate that consumption × rate = waterCharge (with tolerance for rounding/car wash adjustments)
        if (waterCharge > 0 && ratePerM3 > 0) {
          const expectedWaterCharge = consumption * ratePerM3;
          // Allow up to 50 centavos (0.50 pesos) difference for rounding
          if (Math.abs(expectedWaterCharge - waterCharge) > 50) {
            // Bill's consumption doesn't match waterCharge - use waterCharge as source of truth
            // This ensures displayed consumption matches the base charge (waterCharge)
            consumption = Math.round(waterCharge / ratePerM3);
          }
        }
      } else if (waterCharge > 0 && ratePerM3 > 0) {
        // Priority 2: Consumption missing from bill - reverse-calculate from waterCharge to ensure math matches
        consumption = Math.round(waterCharge / ratePerM3);
      } else {
        // Priority 3: Both consumption and waterCharge are zero/missing
        // Check if this month actually had no charge (bill shows 0) or if data is missing
        // If bill totals exist for the quarter, this might be incomplete data
        consumption = 0;
      }
    } else {
      // No monthlyBreakdown entry for this month - incomplete bill data
      // For quarterly bills, this indicates the monthly breakdown is incomplete
      // Use readings as fallback to show something meaningful, ensuring math matches
      const readingsConsumption = (currentReading !== null && priorReading !== null) 
        ? Math.max(0, currentReading - priorReading) 
        : 0;
      
      if (readingsConsumption > 0 && ratePerM3 > 0) {
        // Use readings consumption and calculate matching base charge
        // This ensures math matches: consumption × rate = base charge
        consumption = readingsConsumption;
        waterCharge = consumption * ratePerM3;
        baseCharge = waterCharge; // No car/boat wash from readings (not available in readings)
      } else {
        // No readings either - show zero (month had no consumption or data unavailable)
        consumption = 0;
        baseCharge = 0;
        waterCharge = 0;
      }
    }
    
    // Format month label
    const monthLabel = `${monthName.substring(0, 3)} ${calendarYear}`;
    
    // Calculate variance (Should Have Been - Was Billed)
    // Positive = we should have charged MORE (we undercharged) = UNDER
    // Negative = we charged MORE than we should have (we overcharged) = OVER
    const variance = shouldBeCharge - baseCharge;
    
    // Track for totals
    quarterTotalShouldBeConsumption += (readingsConsumption || 0);
    quarterTotalShouldBeCharge += shouldBeCharge;
    quarterTotalWasBilledConsumption += consumption;
    quarterTotalWasBilledCharge += baseCharge;
    quarterTotalVariance += variance;
    
    // Check for discrepancy for summary
    if (readingsConsumption !== null && consumption !== readingsConsumption) {
      const diff = Math.abs(readingsConsumption - consumption);
      if (diff > 0) {
        const expectedBaseFromReadings = readingsConsumption * (ratePerM3 / 100); // In pesos
        const billBasePesos = centavosToPesos(baseCharge);
        discrepancies.push({
          month: monthLabel,
          billConsumption: consumption,
          readingsConsumption: readingsConsumption,
          difference: diff,
          billBase: billBasePesos,
          expectedBase: expectedBaseFromReadings,
          ratePerM3: ratePerM3
        });
      }
    }
    
    // Format values for display
    const shouldBeConsumptionStr = readingsConsumption !== null ? `${readingsConsumption} m³` : '-';
    const shouldBeChargeStr = shouldBeCharge > 0 ? `$${centavosToPesos(shouldBeCharge).toFixed(2)}` : '-';
    const wasBilledConsumptionStr = consumption > 0 ? `${consumption} m³` : '-';
    const wasBilledChargeStr = baseCharge > 0 ? `$${centavosToPesos(baseCharge).toFixed(2)}` : '-';
    // Variance logic: positive = undercharged (should have been more), negative = overcharged (charged too much)
    const varianceStr = Math.abs(variance) >= 50 // More than 0.50 pesos difference
      ? `$${centavosToPesos(Math.abs(variance)).toFixed(2)} ${variance > 0 ? 'UNDER' : 'OVER'}` 
      : '-';
    
    monthRows.push({
      month: monthLabel,
      meterStart: priorReading !== null ? priorReading.toLocaleString() : '-',
      meterEnd: currentReading !== null ? currentReading.toLocaleString() : '-',
      shouldBeConsumption: shouldBeConsumptionStr,
      shouldBeCharge: shouldBeChargeStr,
      wasBilledConsumption: wasBilledConsumptionStr,
      wasBilledCharge: wasBilledChargeStr,
      variance: varianceStr
    });
  }
  
  // Use bill's totals for "Was Billed" columns (more accurate than sum of individual months)
  const billTotalConsumption = unitBill.totalConsumption || 0;
  const billTotalWaterCharge = unitBill.waterCharge || 0;
  const billTotalCarWash = unitBill.carWashCharge || 0;
  const billTotalBoatWash = unitBill.boatWashCharge || 0;
  const billTotalBase = billTotalWaterCharge + billTotalCarWash + billTotalBoatWash;
  
  // Update totals from bill if available
  if (billTotalConsumption > 0) {
    quarterTotalWasBilledConsumption = billTotalConsumption;
  }
  if (billTotalBase > 0) {
    quarterTotalWasBilledCharge = billTotalBase;
  }
  
  // Recalculate variance from updated totals
  quarterTotalVariance = quarterTotalShouldBeCharge - quarterTotalWasBilledCharge;
  
  // Print comparison table header
  console.log('\n' + '='.repeat(120));
  console.log(`WATER BILL COMPARISON - Unit ${unitId} - Q${fiscalQuarter} ${fiscalYear}`);
  console.log('='.repeat(120));
  console.log('| Month    | Meter  | Meter  | SHOULD HAVE BEEN BILLED    | WAS BILLED              | Variance |');
  console.log('|          | Start  | End    | Consumption | Amount        | Consumption | Amount   |         |');
  console.log('| -------- | ------ | ------ | ----------- | ------------- | ----------- | -------- | ------- |');
  
  // Print month rows
  monthRows.forEach(row => {
    console.log(
      `| ${row.month.padEnd(8)} | ` +
      `${row.meterStart.padStart(6)} | ` +
      `${row.meterEnd.padStart(6)} | ` +
      `${row.shouldBeConsumption.padStart(11)} | ` +
      `${row.shouldBeCharge.padStart(13)} | ` +
      `${row.wasBilledConsumption.padStart(11)} | ` +
      `${row.wasBilledCharge.padStart(8)} | ` +
      `${row.variance.padStart(7)} |`
    );
  });
  
  // Print quarter total row
  const quarterTotalShouldBeConsumptionStr = quarterTotalShouldBeConsumption > 0 ? `${quarterTotalShouldBeConsumption} m³` : '-';
  const quarterTotalShouldBeChargeStr = quarterTotalShouldBeCharge > 0 ? `$${centavosToPesos(quarterTotalShouldBeCharge).toFixed(2)}` : '-';
  const quarterTotalWasBilledConsumptionStr = quarterTotalWasBilledConsumption > 0 ? `${quarterTotalWasBilledConsumption} m³` : '-';
  const quarterTotalWasBilledChargeStr = quarterTotalWasBilledCharge > 0 ? `$${centavosToPesos(quarterTotalWasBilledCharge).toFixed(2)}` : '-';
  const quarterTotalVarianceStr = Math.abs(quarterTotalVariance) >= 50 // More than 0.50 pesos difference
    ? `$${centavosToPesos(Math.abs(quarterTotalVariance)).toFixed(2)} ${quarterTotalVariance > 0 ? 'UNDER' : 'OVER'}` 
    : '-';
  
  console.log('| -------- | ------ | ------ | ----------- | ------------- | ----------- | -------- | ------- |');
  console.log(
    `| Q${fiscalQuarter} TOTAL | ` +
    `${quarterStartReading !== null ? quarterStartReading.toLocaleString().padStart(6) : '-'.padStart(6)} | ` +
    `${quarterEndReading !== null ? quarterEndReading.toLocaleString().padStart(6) : '-'.padStart(6)} | ` +
    `${quarterTotalShouldBeConsumptionStr.padStart(11)} | ` +
    `${quarterTotalShouldBeChargeStr.padStart(13)} | ` +
    `${quarterTotalWasBilledConsumptionStr.padStart(11)} | ` +
    `${quarterTotalWasBilledChargeStr.padStart(8)} | ` +
    `${quarterTotalVarianceStr.padStart(7)} |`
  );
  console.log('='.repeat(120));
  
  // Discrepancies are now shown in the table variance column - no need for separate section
  // Return discrepancies for optional summary at end (only if not writing to file)
  return discrepancies;
}

/**
 * Generate breakdown for a single unit
 */
async function generateBreakdownForUnit(unitId) {
  try {
    // Initialize Firebase (this will output init messages - we'll capture after this)
    const db = await getDb();
    
    // Start capturing output after Firebase init (if writing to file)
    if (writeToFile && outputBuffer.length === 0) {
      captureOutput();
    }
    
    // Get all quarterly bills for this unit
    const quarterlyBills = await getQuarterlyBillsForUnit(db, clientId, unitId);
    
    if (quarterlyBills.length === 0) {
      console.error(`❌ No quarterly bills found for unit ${unitId}`);
      return { payments: [], discrepancies: [] };
    }
    
    // Collect all payments and discrepancies across all quarters
    const allPayments = [];
    const allDiscrepancies = [];
    
    // Process each quarter
    for (const quarterBill of quarterlyBills) {
      const { fiscalYear, fiscalQuarter, unitBill } = quarterBill;
      const quarterStartMonth = (fiscalQuarter - 1) * 3;
      
      // Get readings for all months in this quarter
      const readingsData = {};
      
      for (let month = quarterStartMonth; month <= quarterStartMonth + 2; month++) {
        const readings = await getMonthReadings(db, clientId, fiscalYear, month);
        if (readings) {
          readingsData[month] = readings;
        }
      }
      
      // Get prior month readings (for first month of quarter)
      const priorReadings = await getPriorMonthReadings(db, clientId, fiscalYear, quarterStartMonth);
      
      // Display breakdown and collect discrepancies
      const quarterDiscrepancies = displayQuarterBreakdown(quarterBill, readingsData, priorReadings, unitId);
      if (quarterDiscrepancies && quarterDiscrepancies.length > 0) {
        allDiscrepancies.push(...quarterDiscrepancies);
      }
      
      // Collect payments from this quarter
      const payments = unitBill.payments || [];
      payments.forEach(payment => {
        if (payment.date && payment.amount > 0) {
          allPayments.push({
            date: payment.date,
            amount: payment.amount
          });
        }
      });
    }
    
      // Display payments section if any payments exist (only when not writing to file)
      if (!writeToFile && allPayments.length > 0) {
        console.log('\nPAYMENTS');
        console.log('| Date          | Amount   |');
        console.log('| ------------- | -------- |');
        
        // Sort payments by date
        allPayments.sort((a, b) => {
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          return dateA - dateB;
        });
        
        // Display payments (with dollar signs)
        allPayments.forEach(payment => {
          const formattedDate = formatPaymentDate(payment.date);
          const amountPesos = centavosToPesos(payment.amount);
          const formattedAmount = `$${amountPesos.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          console.log(`| ${formattedDate.padEnd(13)} | ${formattedAmount.padStart(8)} |`);
        });
      }
      
      return { payments: allPayments, discrepancies: allDiscrepancies };
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
    console.error('Usage: node scripts/waterBillBreakdown.js <unitNumber> [--prod] [--file]');
    console.error('       node scripts/waterBillBreakdown.js --all [--prod] [--file]');
    process.exit(1);
  }
  
  try {
    // Capture output if writing to file (after Firebase init messages)
    // We'll start capturing after the first getDb() call
    const allUnits = unitId === '--all' || unitId === 'all';
    
    if (allUnits) {
      // Process all units
      const db = await getDb();
      
      // Get all quarterly bills to find all units
      const billsRef = db.collection('clients').doc(clientId)
        .collection('projects').doc('waterBills')
        .collection('bills');
      
      const billsSnapshot = await billsRef.get();
      const unitIds = new Set();
      
      billsSnapshot.forEach(billDoc => {
        const billData = billDoc.data();
        const units = billData.bills?.units || {};
        Object.keys(units).forEach(id => unitIds.add(id));
      });
      
      console.log('='.repeat(120));
      console.log(`WATER BILL COMPARISON REPORT - ALL UNITS (${unitIds.size} units)`);
      console.log('='.repeat(120));
      
      const allPayments = [];
      const allDiscrepancies = [];
      
      for (const id of Array.from(unitIds).sort()) {
        const result = await generateBreakdownForUnit(id);
        if (result.payments) {
          allPayments.push(...result.payments);
        }
        if (result.discrepancies) {
          allDiscrepancies.push(...result.discrepancies);
        }
      }
      
      // Skip discrepancy summary when writing to file (table shows it clearly)
      if (!writeToFile && allDiscrepancies.length > 0) {
        console.log('\n' + '='.repeat(120));
        console.log('📊 DISCREPANCY SUMMARY - ALL UNITS');
        console.log('='.repeat(120));
        console.log(`Found ${allDiscrepancies.length} month(s) with discrepancies between bill data and meter readings:\n`);
        
        allDiscrepancies.forEach(disc => {
          const baseDifference = Math.abs(disc.billBase - disc.expectedBase);
          console.log(`⚠️  ${disc.month}:`);
          console.log(`   Bill Consumption: ${disc.billConsumption} m³ → Base: $${disc.billBase.toFixed(2)}`);
          console.log(`   Readings Consumption: ${disc.readingsConsumption} m³ → Expected Base: $${disc.expectedBase.toFixed(2)}`);
          console.log(`   Difference: ${disc.difference} m³ ($${baseDifference.toFixed(2)} difference in base charge)`);
          console.log('');
        });
        
        console.log('Note: Bill consumption values take precedence (what was actually billed/paid).');
        console.log('      Meter readings are shown for reference to identify data inconsistencies.');
        console.log('='.repeat(120) + '\n');
      }
    } else {
      // Process single unit
      const result = await generateBreakdownForUnit(unitId);
      const { payments: allPayments, discrepancies: allDiscrepancies } = result;
      
      // Display payments section if any payments exist (only when not writing to file)
      if (!writeToFile && allPayments.length > 0) {
        console.log('\nPAYMENTS');
        console.log('| Date          | Amount   |');
        console.log('| ------------- | -------- |');
        
        // Sort payments by date
        allPayments.sort((a, b) => {
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          return dateA - dateB;
        });
        
        allPayments.forEach(payment => {
          const formattedDate = formatPaymentDate(payment.date);
          const amountPesos = centavosToPesos(payment.amount);
          const formattedAmount = `$${amountPesos.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          console.log(`| ${formattedDate.padEnd(13)} | ${formattedAmount.padStart(8)} |`);
        });
      }
      
      // Skip discrepancy summary when writing to file (table shows it clearly)
      if (!writeToFile && allDiscrepancies.length > 0) {
        console.log('\n' + '='.repeat(70));
        console.log('📊 DISCREPANCY SUMMARY');
        console.log('='.repeat(70));
        console.log(`Found ${allDiscrepancies.length} month(s) with discrepancies between bill data and meter readings:\n`);
        
        allDiscrepancies.forEach(disc => {
          const baseDifference = Math.abs(disc.billBase - disc.expectedBase);
          console.log(`⚠️  ${disc.month}:`);
          console.log(`   Bill Consumption: ${disc.billConsumption} m³ → Base: $${disc.billBase.toFixed(2)}`);
          console.log(`   Readings Consumption: ${disc.readingsConsumption} m³ → Expected Base: $${disc.expectedBase.toFixed(2)}`);
          console.log(`   Difference: ${disc.difference} m³ ($${baseDifference.toFixed(2)} difference in base charge)`);
          console.log('');
        });
        
        console.log('Note: Bill consumption values take precedence (what was actually billed/paid).');
        console.log('      Meter readings are shown for reference to identify data inconsistencies.');
        console.log('='.repeat(70) + '\n');
      }
    }
    
    // Write to file if requested
    if (writeToFile) {
      restoreOutput(); // Restore console before writing status message
      const output = getOutput();
      
      // Generate filename with date
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const filename = `water-meter-reconciliation-${dateStr}.txt`;
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
(async () => {
  try {
    await generateBreakdown(unitId);
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    console.error(error.stack);
    process.exit(1);
  }
})();
