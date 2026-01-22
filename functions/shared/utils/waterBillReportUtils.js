/**
 * Water Bill Report Utilities
 * Provides data retrieval functions for Water Consumption Reports
 * 
 * This module provides the unique getQuarterMonthlyData() function that combines
 * bill data with meter readings for report generation. All other utilities use
 * existing services and utilities from the codebase.
 * 
 * @module shared/utils/waterBillReportUtils
 */

import { getFiscalMonthName as getFiscalMonthNameUtil, fiscalToCalendarMonth } from '../../backend/utils/fiscalYearUtils.js';
import waterReadingsService from '../../backend/services/waterReadingsService.js';

// Fiscal year configuration (AVII starts in July)
const FISCAL_YEAR_START_MONTH = 7;

/**
 * Get calendar year and month for a fiscal month (0-indexed)
 * Uses existing fiscalYearUtils but converts 0-11 to 1-12 format
 * 
 * @param {number} fiscalMonth - Fiscal month (0-11, where 0 = July)
 * @param {number} fiscalYear - Fiscal year (e.g., 2026)
 * @returns {{calendarYear: number, calendarMonth: number}} Calendar year and month (0-indexed)
 * 
 * @example
 * getCalendarDate(0, 2026); // { calendarYear: 2025, calendarMonth: 6 } (July 2025)
 * getCalendarDate(6, 2026); // { calendarYear: 2026, calendarMonth: 0 } (January 2026)
 */
function getCalendarDate(fiscalMonth, fiscalYear) {
  // Convert 0-11 to 1-12 for fiscalYearUtils (which uses 1-based months)
  const fiscalMonth1Based = fiscalMonth + 1;
  const calendarMonth1Based = fiscalToCalendarMonth(fiscalMonth1Based, FISCAL_YEAR_START_MONTH);
  const calendarMonth0Based = calendarMonth1Based - 1; // Convert back to 0-based
  
  // Calculate calendar year
  let calendarYear = fiscalYear - 1; // Fiscal year 2026 starts in calendar year 2025
  if (calendarMonth1Based < FISCAL_YEAR_START_MONTH) {
    calendarYear = fiscalYear; // Months 6-11 (Jan-Jun) are in the fiscal year's calendar year
  }
  
  return { calendarYear, calendarMonth: calendarMonth0Based };
}

/**
 * Get month name for a fiscal month (0-indexed)
 * Uses existing fiscalYearUtils
 * 
 * @param {number} fiscalMonth - Fiscal month (0-11, where 0 = July)
 * @returns {string} Month name (e.g., 'July', 'August')
 */
function getFiscalMonthName(fiscalMonth) {
  // Convert 0-11 to 1-12 for fiscalYearUtils
  return getFiscalMonthNameUtil(fiscalMonth + 1, FISCAL_YEAR_START_MONTH);
}

/**
 * Extract reading value from reading object or number
 * Helper function for processing meter readings
 * 
 * @param {any} value - Reading value (can be number, object with .reading property, or null/undefined)
 * @returns {number|null} Reading value or null if not available
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
 * Helper function used internally by getQuarterMonthlyData()
 * 
 * @param {FirebaseFirestore.Firestore} db - Firestore database instance
 * @param {string} clientId - Client ID (e.g., 'AVII')
 * @param {string} unitId - Unit ID (e.g., '101')
 * @returns {Promise<Array>} Array of quarterly bill data, sorted by fiscal year and quarter
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
 * Uses existing waterReadingsService
 * 
 * @param {FirebaseFirestore.Firestore} db - Firestore database instance (unused, kept for API compatibility)
 * @param {string} clientId - Client ID (e.g., 'AVII')
 * @param {number} fiscalYear - Fiscal year (e.g., 2026)
 * @param {number} fiscalMonth - Fiscal month (0-11, where 0 = July)
 * @returns {Promise<Object|null>} Readings data or null if not found
 */
async function getMonthReadings(db, clientId, fiscalYear, fiscalMonth) {
  // Use existing service method
  const data = await waterReadingsService.getMonthReadings(clientId, fiscalYear, fiscalMonth);
  if (!data) return null;
  
  return {
    fiscalYear,
    fiscalMonth,
    readings: data.readings || {},
    timestamp: data.timestamp
  };
}

/**
 * Get prior month readings for consumption calculation
 * 
 * @param {FirebaseFirestore.Firestore} db - Firestore database instance
 * @param {string} clientId - Client ID (e.g., 'AVII')
 * @param {number} fiscalYear - Fiscal year (e.g., 2026)
 * @param {number} fiscalMonth - Fiscal month (0-11, where 0 = July)
 * @returns {Promise<Object|null>} Prior month readings or null if not found
 * 
 * @private
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
 * Get quarter monthly data - combines bill data with meter readings for a quarter
 * 
 * This is the main function that report services will call. It retrieves:
 * 1. The quarterly bill for the unit
 * 2. Meter readings for each month in the quarter
 * 3. Prior month reading (for first month consumption calculation)
 * 4. Returns structured data ready for report generation
 * 
 * @param {FirebaseFirestore.Firestore} db - Firestore database instance
 * @param {string} clientId - Client ID (e.g., 'AVII')
 * @param {number} fiscalYear - Fiscal year (e.g., 2026)
 * @param {number} fiscalQuarter - Fiscal quarter (1-4)
 * @param {string} unitId - Unit ID (e.g., '101')
 * @returns {Promise<Object|null>} Structured quarter data or null if bill not found
 * 
 * @example
 * const db = await getDb();
 * const quarterData = await getQuarterMonthlyData(db, 'AVII', 2026, 1, '103');
 * // Returns: { billId: '2026-Q1', fiscalYear: 2026, months: [...], quarterTotals: {...}, payments: [...] }
 */
export async function getQuarterMonthlyData(db, clientId, fiscalYear, fiscalQuarter, unitId) {
  // Get the quarterly bill for this unit
  const quarterlyBills = await getQuarterlyBillsForUnit(db, clientId, unitId);
  const quarterBill = quarterlyBills.find(
    bill => bill.fiscalYear === fiscalYear && bill.fiscalQuarter === fiscalQuarter
  );
  
  if (!quarterBill) {
    return null;
  }
  
  const { billId, fiscalYear: billFiscalYear, fiscalQuarter: billFiscalQuarter, quarterMonths, dueDate, billDate, unitBill, configSnapshot } = quarterBill;
  
  // Calculate quarter start and end months
  const quarterStartMonth = (fiscalQuarter - 1) * 3; // Q1=0, Q2=3, Q3=6, Q4=9
  const quarterEndMonth = quarterStartMonth + 2; // Q1=0-2, Q2=3-5, etc.
  
  // Get meter readings for all months in the quarter
  const readingsData = {};
  for (let month = quarterStartMonth; month <= quarterEndMonth; month++) {
    const readings = await getMonthReadings(db, clientId, fiscalYear, month);
    if (readings) {
      readingsData[month] = readings;
    }
  }
  
  // Get prior month readings (for first month of quarter)
  const priorReadings = await getPriorMonthReadings(db, clientId, fiscalYear, quarterStartMonth);
  
  // Get monthly breakdown from bill - ensure it's an array or object
  const monthlyBreakdown = unitBill.monthlyBreakdown || {};
  
  // Build month data array
  const months = [];
  let quarterTotalConsumption = 0;
  let quarterTotalWaterCharge = 0;
  let quarterTotalCarWashCharge = 0;
  let quarterTotalBoatWashCharge = 0;
  
  const ratePerM3 = configSnapshot.ratePerM3 || 0;
  
  // Process each month in the quarter
  for (let monthIndex = quarterStartMonth; monthIndex <= quarterEndMonth; monthIndex++) {
    const monthName = getFiscalMonthName(monthIndex);
    const { calendarYear, calendarMonth } = getCalendarDate(monthIndex, fiscalYear);
    // Get month name using fiscalYearUtils (calendar months use startMonth=1)
    const calendarMonthName = getFiscalMonthNameUtil(calendarMonth + 1, 1);
    const calendarLabel = `${calendarMonthName.substring(0, 3)} ${calendarYear}`;
    
    // Get readings for this month
    const monthReadings = readingsData[monthIndex];
    const priorMonthReadings = monthIndex === quarterStartMonth 
      ? priorReadings 
      : readingsData[monthIndex - 1];
    
    // Extract unit reading
    const meterEnd = monthReadings ? extractReading(monthReadings.readings?.[unitId]) : null;
    const meterStart = priorMonthReadings ? extractReading(priorMonthReadings.readings?.[unitId]) : null;
    
    // Find monthly breakdown entry - handle both array and object formats
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
      
      // Fallback: Try fiscal year month index
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
    
    // Get charges from bill (these are what was actually billed)
    let waterCharge = 0;
    let carWashCharge = 0;
    let boatWashCharge = 0;
    let consumption = 0;
    
    if (monthBreakdown !== null && monthBreakdown !== undefined) {
      waterCharge = monthBreakdown.waterCharge || 0;
      carWashCharge = monthBreakdown.carWashCharge || 0;
      boatWashCharge = monthBreakdown.boatWashCharge || 0;
      
      // Get consumption from bill - prioritize bill's consumption value
      if (monthBreakdown.consumption !== undefined && monthBreakdown.consumption !== null && monthBreakdown.consumption > 0) {
        consumption = monthBreakdown.consumption;
        
        // Validate that consumption × rate = waterCharge (with tolerance for rounding)
        if (waterCharge > 0 && ratePerM3 > 0) {
          const expectedWaterCharge = consumption * ratePerM3;
          // Allow up to 50 centavos (0.50 pesos) difference for rounding
          if (Math.abs(expectedWaterCharge - waterCharge) > 50) {
            // Bill's consumption doesn't match waterCharge - use waterCharge as source of truth
            consumption = Math.round(waterCharge / ratePerM3);
          }
        }
      } else if (waterCharge > 0 && ratePerM3 > 0) {
        // Consumption missing from bill - reverse-calculate from waterCharge
        consumption = Math.round(waterCharge / ratePerM3);
      }
    }
    
    const totalCharge = waterCharge + carWashCharge + boatWashCharge;
    
    // Accumulate quarter totals
    quarterTotalConsumption += consumption;
    quarterTotalWaterCharge += waterCharge;
    quarterTotalCarWashCharge += carWashCharge;
    quarterTotalBoatWashCharge += boatWashCharge;
    
    months.push({
      fiscalMonth: monthIndex,
      monthName,
      calendarLabel,
      meterStart,
      meterEnd,
      consumption,
      waterCharge,
      carWashCharge,
      boatWashCharge,
      totalCharge
    });
  }
  
  // Use bill's totals if available (more accurate than sum of individual months)
  const billTotalConsumption = unitBill.totalConsumption || 0;
  const billTotalWaterCharge = unitBill.waterCharge || 0;
  const billTotalCarWash = unitBill.carWashCharge || 0;
  const billTotalBoatWash = unitBill.boatWashCharge || 0;
  
  // Override with bill totals if available
  if (billTotalConsumption > 0) {
    quarterTotalConsumption = billTotalConsumption;
  }
  if (billTotalWaterCharge > 0) {
    quarterTotalWaterCharge = billTotalWaterCharge;
  }
  if (billTotalCarWash > 0) {
    quarterTotalCarWashCharge = billTotalCarWash;
  }
  if (billTotalBoatWash > 0) {
    quarterTotalBoatWashCharge = billTotalBoatWash;
  }
  
  const quarterTotalCharge = quarterTotalWaterCharge + quarterTotalCarWashCharge + quarterTotalBoatWashCharge;
  
  // Format quarter label
  const quarterLabel = `Q${fiscalQuarter} ${fiscalYear}`;
  
  // Extract payments
  const payments = (unitBill.payments || []).map(payment => ({
    date: payment.date,
    amount: payment.amount, // in centavos
    transactionId: payment.transactionId || null
  })).filter(p => p.date && p.amount > 0);
  
  return {
    billId,
    fiscalYear: billFiscalYear,
    fiscalQuarter: billFiscalQuarter,
    quarterLabel,
    dueDate,
    billDate,
    ratePerM3,
    months,
    quarterTotals: {
      consumption: quarterTotalConsumption,
      waterCharge: quarterTotalWaterCharge,
      carWashCharge: quarterTotalCarWashCharge,
      boatWashCharge: quarterTotalBoatWashCharge,
      totalCharge: quarterTotalCharge
    },
    payments
  };
}

// Export fiscal year constant for use in report services
export { FISCAL_YEAR_START_MONTH };
