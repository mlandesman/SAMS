/**
 * Water Bill Report Service
 * Generates structured data for Water Consumption Reports
 * 
 * Follows the Statement of Account pattern:
 * - Data service (this file) structures the data
 * - HTML service (Task 3) renders the data
 */

import { getDb } from '../firebase.js';
import {
  getQuarterMonthlyData,
  FISCAL_YEAR_START_MONTH
} from '../../shared/utils/waterBillReportUtils.js';
import { centavosToPesos } from '../../shared/utils/currencyUtils.js';
import { getNow } from '../../shared/services/DateService.js';
import { getOwnerNames, getManagerNames } from '../utils/unitContactUtils.js';
import { getFiscalYear, fiscalToCalendarMonth } from '../utils/fiscalYearUtils.js';
import { DateTime } from 'luxon';

/**
 * Generate Water Consumption Report data for a single unit
 * @param {string} clientId - Client ID (e.g., 'AVII')
 * @param {string} unitId - Unit ID (e.g., '103')
 * @param {Object} options - Optional parameters
 * @param {number} options.fiscalYear - Specific fiscal year (defaults to current)
 * @returns {Promise<Object>} Report data structure
 */
export async function generateWaterConsumptionReportData(clientId, unitId, options = {}) {
  const db = await getDb();
  
  // Get unit information
  const unitInfo = await getUnitInfo(db, clientId, unitId);
  if (!unitInfo) {
    return {
      error: 'Unit not found',
      clientId,
      unitId
    };
  }
  
  // Get client configuration
  const clientConfig = await getClientConfig(db, clientId);
  if (!clientConfig) {
    return {
      error: 'Client configuration not found',
      clientId
    };
  }
  
  // Determine fiscal year (default to current)
  const currentDate = getNow();
  const fiscalYearStartMonth = FISCAL_YEAR_START_MONTH; // July = 7
  const fiscalYear = options.fiscalYear || getFiscalYear(currentDate, fiscalYearStartMonth);
  
  // Get all quarterly bills for this unit
  // We'll need to get bills for all fiscal years that have data
  const billsRef = db.collection('clients').doc(clientId)
    .collection('projects').doc('waterBills')
    .collection('bills');
  
  const snapshot = await billsRef.get();
  const fiscalYearsSet = new Set();
  
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.billingPeriod === 'quarterly' && data.bills?.units?.[unitId]) {
      fiscalYearsSet.add(data.fiscalYear);
    }
  });
  
  const fiscalYearsArray = Array.from(fiscalYearsSet).sort((a, b) => a - b);
  
  // If no data found, return empty structure
  if (fiscalYearsArray.length === 0) {
    return {
      reportId: generateReportId(clientId, unitId),
      generatedAt: DateTime.now().setZone('America/Cancun').toISO(),
      clientId,
      unitId,
      unit: unitInfo,
      client: clientConfig,
      summary: {
        ytdConsumption: 0,
        ytdCharges: 0.00,
        ytdPayments: 0.00,
        currentBalance: 0.00,
        monthlyAverage: 0.0,
        dailyAverage: 0.0,
        monthsWithData: 0,
        daysWithData: 0
      },
      comparison: null,
      chartData: {
        months: [],
        average: 0,
        maxValue: 0,
        monthCount: 0
      },
      fiscalYears: [],
      grandTotals: {
        consumption: 0,
        totalCharge: 0.00,
        totalPaid: 0.00,
        balance: 0.00
      }
    };
  }
  
  // Process each fiscal year
  const fiscalYearsData = [];
  let grandTotalConsumption = 0;
  let grandTotalCharge = 0;
  let grandTotalPaid = 0;
  
  for (const fy of fiscalYearsArray) {
    const quarters = [];
    let yearTotalConsumption = 0;
    let yearTotalCharge = 0;
    let yearTotalPaid = 0;
    
    // Process each quarter (1-4)
    for (let quarter = 1; quarter <= 4; quarter++) {
      const quarterData = await getQuarterMonthlyData(db, clientId, fy, quarter, unitId);
      
      if (!quarterData) {
        continue; // Skip if no bill for this quarter
      }
      
      // Process months in the quarter
      const months = quarterData.months.map(month => {
        const calendarDate = getCalendarDateFromFiscalMonth(month.fiscalMonth, fy);
        const daysInMonth = getDaysInMonth(calendarDate.calendarYear, calendarDate.calendarMonth);
        const dailyAverage = month.consumption > 0 && daysInMonth > 0
          ? Math.round((month.consumption / daysInMonth) * 100) / 100
          : 0;
        
        return {
          monthName: month.monthName,
          monthNameSpanish: getSpanishMonthName(month.monthName),
          calendarLabel: month.calendarLabel,
          meterStart: month.meterStart,
          meterEnd: month.meterEnd,
          consumption: month.consumption,
          daysInMonth,
          dailyAverage,
          isAboveAverage: false, // Will be set after calculating average
          waterCharge: centavosToPesos(month.waterCharge),
          carWashCharge: centavosToPesos(month.carWashCharge),
          boatWashCharge: centavosToPesos(month.boatWashCharge),
          totalCharge: centavosToPesos(month.totalCharge)
        };
      });
      
      // Calculate quarter totals
      const quarterTotalConsumption = quarterData.quarterTotals.consumption;
      const quarterTotalCharge = centavosToPesos(quarterData.quarterTotals.totalCharge);
      const quarterTotalDays = months.reduce((sum, m) => sum + m.daysInMonth, 0);
      const quarterDailyAverage = quarterTotalConsumption > 0 && quarterTotalDays > 0
        ? Math.round((quarterTotalConsumption / quarterTotalDays) * 100) / 100
        : 0;
      
      // Process payments
      const payments = quarterData.payments.map(payment => ({
        date: payment.date,
        dateFormatted: formatDate(payment.date),
        dateFormattedLong: formatDateLong(payment.date),
        amount: centavosToPesos(payment.amount)
      }));
      
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      const status = calculatePaymentStatus(quarterTotalCharge, totalPaid);
      
      // Format quarter labels
      const quarterStartMonth = (quarter - 1) * 3; // 0, 3, 6, 9
      const quarterEndMonth = quarterStartMonth + 2;
      const startDate = getCalendarDateFromFiscalMonth(quarterStartMonth, fy);
      const endDate = getCalendarDateFromFiscalMonth(quarterEndMonth, fy);
      
      const periodLabel = formatPeriodLabel(startDate, endDate);
      const periodLabelSpanish = formatPeriodLabelSpanish(startDate, endDate);
      
      quarters.push({
        quarter,
        quarterLabel: `Q${quarter} ${fy}`,
        quarterLabelSpanish: `T${quarter} ${fy}`,
        periodLabel,
        periodLabelSpanish,
        dueDate: quarterData.dueDate,
        dueDateFormatted: formatDateLong(quarterData.dueDate),
        billDate: quarterData.billDate,
        months,
        totals: {
          consumption: quarterTotalConsumption,
          dailyAverage: quarterDailyAverage,
          waterCharge: centavosToPesos(quarterData.quarterTotals.waterCharge),
          carWashCharge: centavosToPesos(quarterData.quarterTotals.carWashCharge),
          boatWashCharge: centavosToPesos(quarterData.quarterTotals.boatWashCharge),
          totalCharge: quarterTotalCharge
        },
        payments,
        status
      });
      
      yearTotalConsumption += quarterTotalConsumption;
      yearTotalCharge += quarterTotalCharge;
      yearTotalPaid += totalPaid;
    }
    
    // Format fiscal year label
    const yearStartDate = getCalendarDateFromFiscalMonth(0, fy);
    const yearEndDate = getCalendarDateFromFiscalMonth(11, fy);
    const yearLabel = `FY ${fy} (${formatMonthYear(yearStartDate)} - ${formatMonthYear(yearEndDate)})`;
    
    fiscalYearsData.push({
      fiscalYear: fy,
      yearLabel,
      quarters,
      yearTotals: {
        consumption: yearTotalConsumption,
        waterCharge: centavosToPesos(yearTotalCharge - (yearTotalCharge * 0)), // Simplified - would need breakdown
        totalCharge: yearTotalCharge,
        totalPaid: yearTotalPaid,
        balance: yearTotalCharge - yearTotalPaid
      }
    });
    
    grandTotalConsumption += yearTotalConsumption;
    grandTotalCharge += yearTotalCharge;
    grandTotalPaid += yearTotalPaid;
  }
  
  // Calculate summary metrics (for current fiscal year)
  const currentFiscalYearData = fiscalYearsData.find(fy => fy.fiscalYear === fiscalYear) || fiscalYearsData[fiscalYearsData.length - 1];
  const summary = calculateSummaryMetrics(currentFiscalYearData || { quarters: [] });
  
  // Build chart data
  const chartData = buildChartData(fiscalYearsData);
  
  // Calculate comparison (percentile)
  const comparison = await calculateComparison(db, clientId, unitId, summary.ytdConsumption);
  
  // Generate report ID
  const reportId = generateReportId(clientId, unitId);
  
  return {
    reportId,
    generatedAt: DateTime.now().setZone('America/Cancun').toISO(),
    clientId,
    unitId,
    unit: unitInfo,
    client: clientConfig,
    summary,
    comparison,
    chartData,
    fiscalYears: fiscalYearsData,
    grandTotals: {
      consumption: grandTotalConsumption,
      totalCharge: grandTotalCharge,
      totalPaid: grandTotalPaid,
      balance: grandTotalCharge - grandTotalPaid
    }
  };
}

/**
 * Generate Water Consumption Report data for all units
 * Designed for Phase 2 - loops through all units with water bill data
 * @param {string} clientId - Client ID (e.g., 'AVII')
 * @param {Object} options - Optional parameters
 * @returns {Promise<Array<Object>>} Array of report data for each unit
 */
export async function generateAllUnitsReportData(clientId, options = {}) {
  const db = await getDb();
  
  // Get all unit IDs that have water bill data
  const unitIds = await getAllUnitsWithWaterBills(db, clientId);
  
  const reports = [];
  for (const unitId of unitIds) {
    const report = await generateWaterConsumptionReportData(clientId, unitId, options);
    if (report && !report.error) {
      reports.push(report);
    }
  }
  
  return reports;
}

/**
 * Get unit information (owners, address)
 */
async function getUnitInfo(db, clientId, unitId) {
  try {
    const unitDoc = await db.collection('clients').doc(clientId)
      .collection('units').doc(unitId)
      .get();
    
    if (!unitDoc.exists) {
      return null;
    }
    
    const data = unitDoc.data();
    
    return {
      id: unitId,
      address: data.address || `Unit ${unitId}`,
      owners: getOwnerNames(data.owners),
      managers: getManagerNames(data.managers)
    };
  } catch (error) {
    console.error(`Error fetching unit info for ${clientId}/${unitId}:`, error);
    return null;
  }
}

/**
 * Get client configuration (name, rate per m³, contact info)
 */
async function getClientConfig(db, clientId) {
  try {
    const clientDoc = await db.collection('clients').doc(clientId).get();
    
    if (!clientDoc.exists) {
      return null;
    }
    
    const data = clientDoc.data();
    
    // Get water bills config for rate
    const waterConfigDoc = await db.collection('clients').doc(clientId)
      .collection('projects').doc('waterBills')
      .collection('config').doc('settings')
      .get();
    
    const waterConfig = waterConfigDoc.exists ? waterConfigDoc.data() : {};
    const ratePerM3 = waterConfig.ratePerM3 ? centavosToPesos(waterConfig.ratePerM3) : 0;
    
    return {
      id: clientId,
      name: data.name || clientId,
      ratePerM3,
      contactEmail: data.contactEmail || '',
      contactPhone: data.contactPhone || ''
    };
  } catch (error) {
    console.error(`Error fetching client config for ${clientId}:`, error);
    return null;
  }
}

/**
 * Determine payment status for a quarter
 * @returns {'paid' | 'partial' | 'unpaid'}
 */
function calculatePaymentStatus(totalCharge, payments) {
  const totalPaid = Array.isArray(payments) 
    ? payments.reduce((sum, p) => sum + (typeof p === 'number' ? p : p.amount || 0), 0)
    : payments || 0;
  
  if (totalPaid >= totalCharge - 0.01) { // Allow 1 centavo tolerance
    return 'paid';
  } else if (totalPaid > 0) {
    return 'partial';
  } else {
    return 'unpaid';
  }
}

/**
 * Generate unique report ID
 */
function generateReportId(clientId, unitId) {
  const now = DateTime.now().setZone('America/Cancun');
  const dateStr = now.toFormat('yyyy-MM-dd');
  const timeStr = now.toFormat('HHmmss');
  const random = Math.random().toString(36).substring(2, 8);
  return `WCR-${clientId}-${unitId}-${dateStr}-${random}`;
}

/**
 * Calculate summary metrics for At-a-Glance section
 */
function calculateSummaryMetrics(fiscalYearData) {
  const quarters = fiscalYearData.quarters || [];
  
  let ytdConsumption = 0;
  let ytdCharges = 0;
  let ytdPayments = 0;
  let totalDays = 0;
  let monthCount = 0;
  
  for (const quarter of quarters) {
    ytdConsumption += quarter.totals.consumption;
    ytdCharges += quarter.totals.totalCharge;
    ytdPayments += quarter.payments.reduce((sum, p) => sum + p.amount, 0);
    
    for (const month of quarter.months) {
      totalDays += month.daysInMonth;
      if (month.consumption > 0) {
        monthCount++;
      }
    }
  }
  
  const monthlyAverage = monthCount > 0 ? Math.round((ytdConsumption / monthCount) * 100) / 100 : 0;
  const dailyAverage = totalDays > 0 ? Math.round((ytdConsumption / totalDays) * 100) / 100 : 0;
  
  return {
    ytdConsumption,
    ytdCharges: Math.round(ytdCharges * 100) / 100,
    ytdPayments: Math.round(ytdPayments * 100) / 100,
    currentBalance: Math.round((ytdCharges - ytdPayments) * 100) / 100,
    monthlyAverage,
    dailyAverage,
    monthsWithData: monthCount,
    daysWithData: totalDays
  };
}

/**
 * Calculate daily average consumption
 * @param {number} consumption - Total consumption in m³
 * @param {number} days - Number of days in period
 * @returns {number} Daily average rounded to 2 decimals
 */
function calculateDailyAverage(consumption, days) {
  if (!days || days === 0) return 0;
  return Math.round((consumption / days) * 100) / 100;
}

/**
 * Build chart data for SVG bar graph
 * Extracts monthly consumption into array for graphing
 */
function buildChartData(fiscalYearsData) {
  const months = [];
  let totalConsumption = 0;
  let monthCount = 0;
  
  for (const fy of fiscalYearsData) {
    for (const quarter of fy.quarters) {
      for (const month of quarter.months) {
        if (month.consumption > 0) {
          months.push({
            label: month.calendarLabel,
            shortLabel: month.calendarLabel.split(' ')[0], // "Jul" from "Jul 2025"
            consumption: month.consumption,
            daysInMonth: month.daysInMonth,
            dailyAvg: month.dailyAverage,
            isAboveAverage: false // Will be set after calculating average
          });
          totalConsumption += month.consumption;
          monthCount++;
        }
      }
    }
  }
  
  const average = monthCount > 0 ? Math.round((totalConsumption / monthCount) * 100) / 100 : 0;
  const maxValue = months.length > 0 
    ? Math.max(...months.map(m => m.consumption))
    : 0;
  
  // Mark months above average
  months.forEach(month => {
    month.isAboveAverage = month.consumption > average;
  });
  
  return {
    months,
    average,
    maxValue,
    monthCount
  };
}

/**
 * Calculate percentile comparison to other units
 * Compares this unit's consumption to all other units
 */
async function calculateComparison(db, clientId, unitId, ytdConsumption) {
  try {
    const allConsumption = await getAllUnitsConsumption(db, clientId);
    
    if (allConsumption.length < 2) {
      // Not enough data for meaningful comparison
      return null;
    }
    
    // Sort by consumption (ascending)
    const sorted = [...allConsumption].sort((a, b) => a.consumption - b.consumption);
    
    // Find this unit's rank
    const unitIndex = sorted.findIndex(u => u.unitId === unitId);
    if (unitIndex === -1) {
      return null; // Unit not found in comparison data
    }
    
    const unitRank = unitIndex + 1;
    
    // Calculate percentile (how many units have LOWER consumption)
    const belowCount = sorted.filter(u => u.consumption < ytdConsumption).length;
    const percentile = Math.round((belowCount / sorted.length) * 100);
    
    // Calculate building average
    const total = sorted.reduce((sum, u) => sum + u.consumption, 0);
    const buildingAverage = Math.round(total / sorted.length);
    
    return {
      percentile,
      totalUnits: sorted.length,
      unitRank,
      lowestConsumption: sorted[0].consumption,
      lowestUnitId: sorted[0].unitId,
      highestConsumption: sorted[sorted.length - 1].consumption,
      highestUnitId: sorted[sorted.length - 1].unitId,
      buildingAverage
    };
  } catch (error) {
    console.error(`Error calculating comparison for ${clientId}/${unitId}:`, error);
    return null;
  }
}

/**
 * Get all units' YTD consumption for comparison
 */
async function getAllUnitsConsumption(db, clientId) {
  const billsRef = db.collection('clients').doc(clientId)
    .collection('projects').doc('waterBills')
    .collection('bills');
  
  const snapshot = await billsRef.get();
  
  // Aggregate consumption by unit for current fiscal year
  const currentDate = getNow();
  const fiscalYearStartMonth = FISCAL_YEAR_START_MONTH;
  const currentFiscalYear = getFiscalYear(currentDate, fiscalYearStartMonth);
  
  const unitConsumption = new Map();
  
  snapshot.forEach(doc => {
    const data = doc.data();
    
    // Only include bills for current fiscal year
    if (data.fiscalYear === currentFiscalYear && 
        data.billingPeriod === 'quarterly' && 
        data.bills?.units) {
      
      const units = data.bills.units;
      
      for (const [unitId, unitData] of Object.entries(units)) {
        const current = unitConsumption.get(unitId) || 0;
        const consumption = unitData.totalConsumption || 0;
        unitConsumption.set(unitId, current + consumption);
      }
    }
  });
  
  // Convert to array
  return Array.from(unitConsumption.entries()).map(([unitId, consumption]) => ({
    unitId,
    consumption
  }));
}

/**
 * Get all unit IDs that have water bill data
 */
async function getAllUnitsWithWaterBills(db, clientId) {
  const billsRef = db.collection('clients').doc(clientId)
    .collection('projects').doc('waterBills')
    .collection('bills');
  
  const snapshot = await billsRef.limit(100).get(); // Limit to avoid timeout
  
  const unitIdsSet = new Set();
  
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.bills?.units) {
      Object.keys(data.bills.units).forEach(unitId => {
        unitIdsSet.add(unitId);
      });
    }
  });
  
  return Array.from(unitIdsSet);
}

/**
 * Get calendar date from fiscal month
 * Matches logic from waterBillReportUtils.js
 */
function getCalendarDateFromFiscalMonth(fiscalMonth, fiscalYear) {
  // Fiscal month is 0-indexed (0 = July, 11 = June)
  // Convert 0-11 to 1-12 for fiscalYearUtils (which uses 1-based months)
  const fiscalMonth1Based = fiscalMonth + 1;
  const calendarMonth1Based = fiscalToCalendarMonth(fiscalMonth1Based, FISCAL_YEAR_START_MONTH);
  const calendarMonth0Based = calendarMonth1Based - 1; // Convert back to 0-based
  
  // Calculate calendar year
  // Fiscal year 2026 starts in calendar year 2025
  let calendarYear = fiscalYear - 1;
  if (calendarMonth1Based < FISCAL_YEAR_START_MONTH) {
    // Months 6-11 (Jan-Jun) are in the fiscal year's calendar year
    calendarYear = fiscalYear;
  }
  
  return { calendarYear, calendarMonth: calendarMonth0Based };
}

/**
 * Get days in month
 */
function getDaysInMonth(year, month) {
  // month is 0-indexed (0 = January, 11 = December)
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Format date
 */
function formatDate(dateValue) {
  if (!dateValue) return '';
  const dt = DateTime.fromISO(dateValue, { zone: 'America/Cancun' });
  if (!dt.isValid) return '';
  return dt.toFormat('MM/dd/yyyy');
}

/**
 * Format date long
 */
function formatDateLong(dateValue) {
  if (!dateValue) return '';
  const dt = DateTime.fromISO(dateValue, { zone: 'America/Cancun' });
  if (!dt.isValid) return '';
  return dt.toFormat('MMMM d, yyyy');
}

/**
 * Format period label
 */
function formatPeriodLabel(startDate, endDate) {
  const startMonth = getMonthName(startDate.calendarMonth);
  const endMonth = getMonthName(endDate.calendarMonth);
  return `${startMonth} - ${endMonth} ${startDate.calendarYear}`;
}

/**
 * Format period label Spanish
 */
function formatPeriodLabelSpanish(startDate, endDate) {
  const startMonth = getSpanishMonthName(getMonthName(startDate.calendarMonth));
  const endMonth = getSpanishMonthName(getMonthName(endDate.calendarMonth));
  return `${startMonth} - ${endMonth} ${startDate.calendarYear}`;
}

/**
 * Format month year
 */
function formatMonthYear(date) {
  const month = getMonthName(date.calendarMonth);
  return `${month} ${date.calendarYear}`;
}

/**
 * Get month name
 */
function getMonthName(monthIndex) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[monthIndex] || '';
}

/**
 * Get Spanish month name
 */
function getSpanishMonthName(englishMonth) {
  const translations = {
    'January': 'Enero',
    'February': 'Febrero',
    'March': 'Marzo',
    'April': 'Abril',
    'May': 'Mayo',
    'June': 'Junio',
    'July': 'Julio',
    'August': 'Agosto',
    'September': 'Septiembre',
    'October': 'Octubre',
    'November': 'Noviembre',
    'December': 'Diciembre'
  };
  return translations[englishMonth] || englishMonth;
}
