/**
 * Propane Reading Service - Mobile PWA Version
 * Simplified version (no billing, no washes, just percentage levels)
 */

import propaneAPI from '../api/propaneAPI.js';
import { getCurrentFiscalPeriod, getPreviousFiscalPeriod } from '../utils/fiscalYearUtils.js';

const CLIENT_ID = 'MTC';
const FISCAL_YEAR_START = 1; // January (MTC fiscal year)

/**
 * Get current fiscal period for MTC (January start)
 */
function getCurrentFiscalPeriodMTC() {
  return getCurrentFiscalPeriod(undefined, FISCAL_YEAR_START);
}

/**
 * Get previous fiscal period
 */
function getPreviousFiscalPeriodMTC(currentPeriod) {
  return getPreviousFiscalPeriod(currentPeriod);
}

/**
 * Load propane configuration
 */
export const loadConfig = async () => {
  try {
    const config = await propaneAPI.getConfig(CLIENT_ID);
    return config;
  } catch (error) {
    console.error('Error loading propane config:', error);
    throw error;
  }
};

/**
 * Load previous month readings
 */
export const loadPreviousReadings = async (period = null) => {
  try {
    let currentPeriod;
    if (period) {
      currentPeriod = period.period || `${period.year}-${String(period.month).padStart(2, '0')}`;
    } else {
      const current = getCurrentFiscalPeriodMTC();
      currentPeriod = current.period;
    }
    
    const previousPeriod = getPreviousFiscalPeriodMTC(currentPeriod);
    console.log(`Loading previous readings: current=${currentPeriod}, previous=${previousPeriod}`);
    
    const [year, month] = previousPeriod.split('-');
    const monthData = await propaneAPI.getMonthReadings(CLIENT_ID, parseInt(year), parseInt(month));
    
    const previousReadings = {};
    if (monthData && monthData.readings) {
      Object.keys(monthData.readings).forEach(unitId => {
        const unitData = monthData.readings[unitId];
        // Handle both { level: 60 } and direct number formats
        previousReadings[unitId] = typeof unitData === 'object' ? unitData.level : unitData;
      });
    }
    
    return previousReadings;
  } catch (error) {
    console.error('Error loading previous readings:', error);
    return {};
  }
};

/**
 * Load current month readings
 */
export const loadCurrentReadings = async () => {
  try {
    const current = getCurrentFiscalPeriodMTC();
    const [year, month] = current.period.split('-');
    
    const monthData = await propaneAPI.getMonthReadings(CLIENT_ID, parseInt(year), parseInt(month));
    
    if (monthData && monthData.readings) {
      return {
        year: parseInt(year),
        month: parseInt(month),
        fiscalYear: parseInt(year),
        readings: monthData.readings,
        timestamp: monthData.timestamp || null
      };
    }
    
    // No existing data - return empty structure
    return {
      year: parseInt(year),
      month: parseInt(month),
      fiscalYear: parseInt(year),
      readings: {},
      timestamp: null
    };
  } catch (error) {
    console.error('Error loading current readings:', error);
    const current = getCurrentFiscalPeriodMTC();
    const [year, month] = current.period.split('-');
    return {
      year: parseInt(year),
      month: parseInt(month),
      fiscalYear: parseInt(year),
      readings: {},
      timestamp: null
    };
  }
};

/**
 * Load readings for a specific period
 */
export const loadCurrentReadingsForPeriod = async (year, month) => {
  try {
    const monthData = await propaneAPI.getMonthReadings(CLIENT_ID, year, month);
    
    if (monthData && monthData.readings) {
      return {
        year,
        month,
        fiscalYear: year,
        readings: monthData.readings,
        timestamp: monthData.timestamp || null
      };
    }
    
    return {
      year,
      month,
      fiscalYear: year,
      readings: {},
      timestamp: null
    };
  } catch (error) {
    console.error('Error loading readings for period:', error);
    return {
      year,
      month,
      fiscalYear: year,
      readings: {},
      timestamp: null
    };
  }
};

/**
 * Save all readings for current period
 */
export const saveAllReadings = async (readingsData) => {
  try {
    const current = getCurrentFiscalPeriodMTC();
    const [year, month] = current.period.split('-');
    
    return await saveAllReadingsForPeriod(readingsData, parseInt(year), parseInt(month));
  } catch (error) {
    console.error('Error saving all readings:', error);
    throw error;
  }
};

/**
 * Save readings for a specific period
 */
export const saveAllReadingsForPeriod = async (readingsPayload, year, month) => {
  try {
    console.log('Saving propane readings:', { readingsPayload, year, month });
    
    // Ensure readings are in correct format { unitId: { level: number } }
    const formattedReadings = {};
    Object.keys(readingsPayload).forEach(unitId => {
      const value = readingsPayload[unitId];
      if (value !== null && value !== undefined && value !== '') {
        formattedReadings[unitId] = {
          level: typeof value === 'object' ? value.level : parseInt(value)
        };
      }
    });
    
    const payload = {
      readings: formattedReadings
    };
    
    const result = await propaneAPI.saveReadings(CLIENT_ID, year, month, payload);
    console.log('Propane readings saved successfully:', result);
    
    return result;
  } catch (error) {
    console.error('Error saving propane readings:', error);
    throw error;
  }
};

/**
 * Find first editable month (month with no readings or current month)
 */
export const findFirstEditableMonth = async (year) => {
  try {
    const existenceMap = await propaneAPI.getReadingsExistenceForYear(CLIENT_ID, year);
    const current = getCurrentFiscalPeriodMTC();
    const currentYear = current.year;
    const currentMonth = current.month - 1; // Convert to 0-based
    
    // If current year, start from current month
    if (year === currentYear) {
      // Check if current month is editable (no readings or current month)
      if (!existenceMap[currentMonth] || currentMonth === (current.month - 1)) {
        return currentMonth;
      }
    }
    
    // Find first month without readings
    for (let month = 0; month < 12; month++) {
      if (!existenceMap[month]) {
        return month;
      }
    }
    
    // All months have readings, return current month
    return currentMonth;
  } catch (error) {
    console.error('Error finding first editable month:', error);
    const current = getCurrentFiscalPeriodMTC();
    return current.month - 1; // Convert to 0-based
  }
};

/**
 * Check if a month is editable
 */
export const isMonthEditable = async (year, month) => {
  try {
    const current = getCurrentFiscalPeriodMTC();
    const currentYear = current.year;
    const currentMonth = current.month - 1; // Convert to 0-based
    
    // Current month is always editable
    if (year === currentYear && month === currentMonth) {
      return true;
    }
    
    // Future months are not editable
    if (year > currentYear || (year === currentYear && month > currentMonth)) {
      return false;
    }
    
    // Past months are editable if they don't have readings
    const existenceMap = await propaneAPI.getReadingsExistenceForYear(CLIENT_ID, year);
    return !existenceMap[month];
  } catch (error) {
    console.error('Error checking if month is editable:', error);
    return false;
  }
};

/**
 * Format fiscal period for display
 */
export const formatFiscalPeriodForDisplay = (year, month) => {
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  
  // MTC fiscal year starts in January, so fiscal month 0 = January
  const calendarMonth = month; // 0-based fiscal month = 0-based calendar month for MTC
  const monthName = monthNames[calendarMonth] || `Mes ${month + 1}`;
  
  return `${monthName} ${year}`;
};

// Default export for compatibility with component imports
export default {
  loadConfig,
  loadPreviousReadings,
  loadCurrentReadings,
  loadCurrentReadingsForPeriod,
  saveAllReadings,
  saveAllReadingsForPeriod,
  findFirstEditableMonth,
  isMonthEditable,
  formatFiscalPeriodForDisplay
};
