/**
 * Water Reading Service V2 - Mobile PWA Version
 * Uses waterAPI.getAggregatedData() pattern from desktop UI
 * Extracts needed months from aggregated response with session caching
 */

import waterAPI from '../api/waterAPI.js';
import { 
  createEmptyReadingsDocument,
  WORKER_ROUTE_ORDER,
  UNIT_CONFIG 
} from '../utils/waterReadingHelpers.js';
import { getCurrentFiscalPeriod, getPreviousFiscalPeriod } from '../utils/fiscalYearUtils.js';

const CLIENT_ID = 'AVII';

/**
 * Load Client Information
 */
export const loadClientInfo = async () => {
  try {
    console.log('Loading client information for:', CLIENT_ID);
    
    const clientData = await waterAPI.getClientInfo(CLIENT_ID);
    console.log('Loaded client info:', clientData);
    
    return {
      id: CLIENT_ID,
      name: clientData.name || CLIENT_ID,
      fullName: clientData.basicInfo?.fullName || clientData.fullName || 'Apartamentos Villa Isabel II',
      logo: clientData.branding?.logoUrl,
      color: clientData.branding?.primaryColor || '#059669'
    };
    
  } catch (error) {
    console.error('Error loading client info:', error);
    // Return fallback data
    return {
      id: CLIENT_ID,
      name: 'AVII', 
      fullName: 'Apartamentos Villa Isabel II'
    };
  }
};

/**
 * Get month readings directly from Firestore (lightweight - NO aggregator)
 * Pure direct read - returns null if document doesn't exist
 * @param {string} period - Period in format "YYYY-MM" (e.g., "2026-01")
 * @returns {Object|null} Readings data for the specified period, or null if not found
 */
const getMonthReadingsFromAggregated = async (period) => {
  const [year, month] = period.split('-');
  const monthNum = parseInt(month);
  
  try {
    // Lightweight direct read ONLY (no aggregator/penalty calculations)
    console.log(`📖 Direct Firestore read for period ${period}...`);
    const directReadings = await waterAPI.getMonthReadings(CLIENT_ID, parseInt(year), monthNum);
    
    if (directReadings && directReadings.readings && Object.keys(directReadings.readings).length > 0) {
      console.log(`✅ Direct read successful for period ${period}`);
      // Convert direct readings format to match expected format for compatibility
      return {
        year: parseInt(year),
        month: monthNum,
        fiscalYear: parseInt(year),
        readings: directReadings.readings || {},
        buildingMeter: directReadings.buildingMeter !== undefined ? { currentReading: directReadings.buildingMeter } : undefined,
        commonArea: directReadings.commonArea !== undefined ? { currentReading: directReadings.commonArea } : undefined
      };
    }
    
    // Also handle case where document exists but has no readings yet
    if (directReadings && (directReadings.buildingMeter !== undefined || directReadings.commonArea !== undefined)) {
      console.log(`✅ Direct read successful (building/common only) for period ${period}`);
      return {
        year: parseInt(year),
        month: monthNum,
        fiscalYear: parseInt(year),
        readings: directReadings.readings || {},
        buildingMeter: directReadings.buildingMeter !== undefined ? { currentReading: directReadings.buildingMeter } : undefined,
        commonArea: directReadings.commonArea !== undefined ? { currentReading: directReadings.commonArea } : undefined
      };
    }
    
    console.log(`No readings document found for period ${period} - this is expected for future periods`);
    return null;
    
  } catch (error) {
    console.error(`Error loading readings for period ${period}:`, error);
    return null;
  }
};

/**
 * Load Previous Month Readings
 * Extract from previous month's currentReading in aggregated data
 */
/**
 * Load previous readings for a specific period
 * @param {Object} period - Optional period object {year, month, period}. If not provided, uses current period.
 */
export const loadPreviousReadings = async (period = null) => {
  try {
    console.log('Loading previous readings from aggregated data...');
    
    // Use provided period or get current period
    let currentPeriod;
    if (period) {
      currentPeriod = period.period || `${period.year}-${String(period.month).padStart(2, '0')}`;
    } else {
      const current = getCurrentFiscalPeriod();
      currentPeriod = current.period;
    }
    
    const previousPeriod = getPreviousFiscalPeriod(currentPeriod);
    console.log(`Loading previous readings: current=${currentPeriod}, previous=${previousPeriod}`);
    
    // Get previous month data from aggregated response
    const previousMonthData = await getMonthReadingsFromAggregated(previousPeriod);
    
    const previousReadings = {};
    
    if (previousMonthData) {
      // Handle direct read format: { readings: {...}, buildingMeter: number, commonArea: number }
      if (previousMonthData.readings) {
        Object.keys(previousMonthData.readings).forEach(unitId => {
          const unitData = previousMonthData.readings[unitId];
          // Direct read format: { reading: 1808 } or just number
          if (typeof unitData === 'object' && unitData.reading !== undefined) {
            previousReadings[unitId] = unitData.reading;
          } else if (typeof unitData === 'number') {
            previousReadings[unitId] = unitData;
          }
        });
      }
      
      // Handle aggregated format: { units: {...}, buildingMeter: {currentReading: ...} }
      if (previousMonthData.units) {
        Object.keys(previousMonthData.units).forEach(unitId => {
          const unitData = previousMonthData.units[unitId];
          if (unitData && unitData.currentReading) {
            const reading = unitData.currentReading.reading || unitData.currentReading;
            if (typeof reading === 'number') {
              previousReadings[unitId] = reading;
            }
          }
        });
      }
      
      // Extract building meter and common area (handle both formats)
      if (previousMonthData.buildingMeter !== undefined) {
        if (typeof previousMonthData.buildingMeter === 'object' && previousMonthData.buildingMeter.currentReading !== undefined) {
          // Aggregated format: { currentReading: number }
          const buildingReading = previousMonthData.buildingMeter.currentReading;
          previousReadings.buildingMeter = typeof buildingReading === 'number' ? buildingReading : (buildingReading.reading || buildingReading);
        } else if (typeof previousMonthData.buildingMeter === 'number') {
          // Direct read format: number
          previousReadings.buildingMeter = previousMonthData.buildingMeter;
        }
      }
      
      if (previousMonthData.commonArea !== undefined) {
        if (typeof previousMonthData.commonArea === 'object' && previousMonthData.commonArea.currentReading !== undefined) {
          // Aggregated format: { currentReading: number }
          const commonReading = previousMonthData.commonArea.currentReading;
          previousReadings.commonArea = typeof commonReading === 'number' ? commonReading : (commonReading.reading || commonReading);
        } else if (typeof previousMonthData.commonArea === 'number') {
          // Direct read format: number
          previousReadings.commonArea = previousMonthData.commonArea;
        }
      }
    }
    
    console.log('Final previous readings extracted:', previousReadings);
    return previousReadings;
    
  } catch (error) {
    console.error('Error loading previous readings:', error);
    return {};
  }
};

/**
 * Create current month document if it doesn't exist
 * Populate it with previous readings and return it
 */
const ensureCurrentMonthDocument = async () => {
  const current = getCurrentFiscalPeriod();
  const currentPeriod = current.period;
  const previousPeriod = getPreviousFiscalPeriod(currentPeriod);
  
  console.log('Ensuring current month document exists:', { currentPeriod, previousPeriod });
  
  // Try to get current month data from aggregated
  let currentMonthData = await getMonthReadingsFromAggregated(currentPeriod);
  
  if (!currentMonthData) {
    console.log('Current month document does not exist, creating it...');
    
    // Get previous month data to extract prior readings
    const previousMonthData = await getMonthReadingsFromAggregated(previousPeriod);
    
    // Create new document structure with previous readings as prior readings
    const [periodYear, periodMonth] = currentPeriod.split('-');
    const newDocument = {
      year: parseInt(periodYear),
      month: parseInt(periodMonth),
      readings: {}
    };
    
    // Populate with previous readings
    WORKER_ROUTE_ORDER.forEach(unitId => {
      if (UNIT_CONFIG[unitId].type === 'unit') {
        // Units have readings and washes
        let priorReading = null;
        if (previousMonthData?.units?.[unitId]?.currentReading) {
          priorReading = previousMonthData.units[unitId].currentReading.reading || previousMonthData.units[unitId].currentReading;
        }
        
        newDocument.readings[unitId] = {
          reading: null,
          washes: [],
          priorReading: priorReading
        };
      } else {
        // Building/common meters have same structure as units but no washes
        let priorReading = null;
        if (unitId === 'buildingMeter' && previousMonthData?.buildingMeter) {
          // Use the aggregated API's priorReading which is the actual reading value
          priorReading = previousMonthData.buildingMeter.priorReading;
        } else if (unitId === 'commonArea' && previousMonthData?.commonArea) {
          // Use the aggregated API's priorReading which is the actual reading value  
          priorReading = previousMonthData.commonArea.priorReading;
        } else if (previousMonthData?.units?.[unitId]?.currentReading) {
          priorReading = previousMonthData.units[unitId].currentReading.reading || previousMonthData.units[unitId].currentReading;
        }
        newDocument.readings[unitId] = {
          reading: null,
          priorReading: priorReading
        };
      }
    });
    
    console.log('Created new current month document:', newDocument);
    
    // Save the new document to backend
    try {
      await waterAPI.saveReadings(CLIENT_ID, periodYear, periodMonth, newDocument.readings);
      console.log('Saved new current month document to backend');
    } catch (error) {
      console.warn('Could not save new document to backend, using local version:', error);
    }
    
    return newDocument;
  }
  
  // Document exists, convert from aggregated format
  console.log('Current month document exists, converting from aggregated format');
  const [periodYear, periodMonth] = currentPeriod.split('-');
  
  return {
    year: parseInt(periodYear),
    month: parseInt(periodMonth),
    readings: convertAggregatedToMobileFormat(currentMonthData),
    timestamp: currentMonthData.timestamp || null
  };
};

/**
 * Convert aggregated format to mobile format
 * Only shows washes for the current month
 */
const convertAggregatedToMobileFormat = (monthData) => {
  console.log('Converting aggregated format, full monthData:', JSON.stringify(monthData, null, 2));
  const readings = {};
  
  WORKER_ROUTE_ORDER.forEach(unitId => {
    if (unitId === 'buildingMeter' && monthData.buildingMeter) {
      // Handle buildingMeter from top level of aggregated response
      readings[unitId] = {
        reading: monthData.buildingMeter.currentReading || null,
        priorReading: monthData.buildingMeter.priorReading || null
      };
    } else if (unitId === 'commonArea' && monthData.commonArea) {
      // Handle commonArea from top level of aggregated response
      readings[unitId] = {
        reading: monthData.commonArea.currentReading || null,
        priorReading: monthData.commonArea.priorReading || null
      };
    } else if (monthData.units && monthData.units[unitId]) {
      const unitData = monthData.units[unitId];
      
      if (UNIT_CONFIG[unitId].type === 'unit') {
        // Units have readings and washes
        // Only extract washes from current month's currentReading
        const currentWashes = unitData.currentReading?.washes || [];
        
        console.log(`Unit ${unitId} data:`, JSON.stringify(unitData, null, 2));
        console.log(`Unit ${unitId} current month washes:`, currentWashes);
        
        readings[unitId] = {
          reading: unitData.currentReading?.reading || null,
          washes: currentWashes,
          priorReading: unitData.priorReading?.reading || unitData.priorReading || null
        };
      } else {
        // Building/common meters have same structure as units but no washes
        readings[unitId] = {
          reading: unitData.currentReading?.reading || unitData.currentReading || null,
          priorReading: unitData.priorReading?.reading || unitData.priorReading || null
        };
      }
    } else {
      // Create empty structure for missing units
      if (UNIT_CONFIG[unitId].type === 'unit') {
        readings[unitId] = { reading: null, washes: [], priorReading: null };
      } else {
        readings[unitId] = { reading: null, priorReading: null };
      }
    }
  });
  
  return readings;
};

/**
 * Load Current Month Readings
 * Ensures current month document exists and returns it
 */
export const loadCurrentReadings = async () => {
  try {
    const currentDoc = await ensureCurrentMonthDocument();
    console.log('Loaded current readings:', currentDoc);
    return currentDoc;
    
  } catch (error) {
    console.error('Error loading current readings:', error);
    // Return empty structure on error
    const current = getCurrentFiscalPeriod();
    const [periodYear, periodMonth] = current.period.split('-');
    return createEmptyReadingsDocument(parseInt(periodYear), parseInt(periodMonth));
  }
};

/**
 * Load readings for a specific period
 * @param {number} year - Fiscal year
 * @param {number} month - Fiscal month (0-11)
 */
export const loadCurrentReadingsForPeriod = async (year, month) => {
  try {
    const period = `${year}-${String(month).padStart(2, '0')}`;
    console.log('Loading readings for period:', period);
    
    // Try to get month data from aggregated
    const monthData = await getMonthReadingsFromAggregated(period);
    
    if (monthData) {
      console.log('Found existing readings for period:', period);
      return monthData;
    }
    
    // No existing data - create empty structure
    console.log('No existing readings, creating empty structure for period:', period);
    return createEmptyReadingsDocument(year, month);
    
  } catch (error) {
    console.error('Error loading readings for period:', error);
    return createEmptyReadingsDocument(year, month);
  }
};

/**
 * Save All Meter Readings
 * Uses waterAPI.saveReadings (domain endpoint)
 */
export const saveAllReadings = async (readingsData) => {
  try {
    const current = getCurrentFiscalPeriod();
    const [year, month] = current.period.split('-');
    
    console.log('Saving all readings:', { readingsData, period: current.period });
    
    return await saveAllReadingsForPeriod(readingsData, parseInt(year), parseInt(month));
  } catch (error) {
    console.error('Error saving all readings:', error);
    throw error;
  }
};

/**
 * Save readings for a specific period
 * @param {Object} readingsData - Readings data object
 * @param {number} year - Fiscal year
 * @param {number} month - Fiscal month (0-11)
 */
export const saveAllReadingsForPeriod = async (readingsPayload, year, month) => {
  try {
    console.log('Saving all readings for period:', { readingsPayload, year, month });
    
    // readingsPayload can be either:
    // 1. { readings: {...}, buildingMeter: number, commonArea: number } (from component)
    // 2. { "101": { reading: ... }, buildingMeter: { reading: ... }, ... } (legacy format)
    
    // Build the complete payload with correct structure
    const apiPayload = {
      month: month, // Already 0-based
      year: year,
      readings: {},
      buildingMeter: null,
      commonArea: null
    };
    
    // Handle new format: { readings: {...}, buildingMeter: number, commonArea: number }
    if (readingsPayload.readings) {
      apiPayload.readings = readingsPayload.readings;
      apiPayload.buildingMeter = readingsPayload.buildingMeter;
      apiPayload.commonArea = readingsPayload.commonArea;
    } else {
      // Handle legacy format: { "101": { reading: ... }, ... }
      Object.keys(readingsPayload).forEach(unitId => {
        const unitData = readingsPayload[unitId];
        
        if (UNIT_CONFIG[unitId]?.type === 'unit') {
          // Units: Send reading + washes array (if has washes)
          const cleanUnit = { reading: unitData.reading || unitData };
          
          // Only include washes array if there are actual washes
          if (unitData.washes && unitData.washes.length > 0) {
            cleanUnit.washes = unitData.washes;
          }
          
          apiPayload.readings[unitId] = cleanUnit;
        } else if (unitId === 'buildingMeter') {
          // Building meter: flat numeric value at root
          apiPayload.buildingMeter = typeof unitData === 'object' ? (unitData.reading || unitData) : unitData;
        } else if (unitId === 'commonArea') {
          // Common area: flat numeric value at root
          apiPayload.commonArea = typeof unitData === 'object' ? (unitData.reading || unitData) : unitData;
        }
      });
    }
    
    console.log('Complete payload being sent:', JSON.stringify(apiPayload, null, 2));
    
    // Send the complete payload
    const result = await waterAPI.saveReadings(CLIENT_ID, year, month, apiPayload);
    console.log('All readings saved successfully');
    
    // Clear existence cache since we just saved readings
    clearExistenceCache();
    
    return { success: true, data: result };
    
  } catch (error) {
    console.error('Error saving all readings:', error);
    throw new Error(`Error guardando lecturas: ${error.message}`);
  }
};

/**
 * Save Wash Entry
 * Updates local data and saves via saveAllReadings
 */
export const saveWashEntry = async (unitId, washEntry) => {
  try {
    console.log('Saving wash entry:', { unitId, washEntry });
    
    // First, load current document to get existing data
    const currentReadings = await loadCurrentReadings();
    
    // Ensure unit exists and has washes array
    if (!currentReadings.readings[unitId]) {
      currentReadings.readings[unitId] = { reading: null, washes: [] };
    }
    
    if (!currentReadings.readings[unitId].washes) {
      currentReadings.readings[unitId].washes = [];
    }
    
    // Add new wash to the array
    currentReadings.readings[unitId].washes.push(washEntry);
    currentReadings.timestamp = new Date();
    
    // Save the updated document using saveAllReadings with clean format
    await saveAllReadings(currentReadings.readings);
    console.log('Wash entry saved successfully');
    
    return { success: true, washEntry };
    
  } catch (error) {
    console.error('Error saving wash entry:', error);
    throw new Error(`Error guardando lavado: ${error.message}`);
  }
};

/**
 * Validation and Integration Helpers
 */

// Check if readings document exists for current month
export const checkCurrentMonthExists = async () => {
  try {
    const currentReadings = await loadCurrentReadings();
    return currentReadings && currentReadings.readings;
  } catch (error) {
    console.error('Error checking current month:', error);
    return false;
  }
};

// Get fiscal period info for display
export const getFiscalPeriodInfo = () => {
  const { year, month } = getCurrentFiscalPeriod();
  
  const monthNames = [
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio'
  ];
  
  return {
    year,
    month,
    monthName: monthNames[month],
    displayText: `${monthNames[month]} ${year + (month >= 6 ? 1 : 0)}` // Calendar year for display
  };
};

/**
 * Format fiscal period for display
 * @param {number} year - Fiscal year
 * @param {number} month - Fiscal month (0-11, 0-based)
 * @returns {Object} Display info with month name and calendar year
 */
export const formatFiscalPeriodForDisplay = (year, month) => {
  const monthNames = [
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio'
  ];
  
  // Convert 0-based month to 1-based for lookup
  const monthIndex = month; // month is already 0-based (0=July, 5=December, 6=January)
  const monthName = monthNames[monthIndex];
  
  // Calculate calendar year
  // Fiscal year 2026 starts July 2025
  // Month 0-5 (Jul-Dec) = calendar year (fiscalYear - 1)
  // Month 6-11 (Jan-Jun) = calendar year (fiscalYear)
  const calendarYear = month < 6 ? year - 1 : year;
  
  return {
    year,
    month: monthIndex,
    monthName,
    calendarYear,
    displayText: `${monthName} ${calendarYear}`
  };
};

/**
 * Legacy API Integration
 * For compatibility with existing desktop patterns
 */

// Simulate waterAPI.getAggregatedData() response format for mobile components
export const getAggregatedDataFormat = (readingsData, previousReadings) => {
  const units = {};
  
  WORKER_ROUTE_ORDER.forEach(unitId => {
    if (UNIT_CONFIG[unitId].type === 'unit') {
      const currentReading = readingsData.readings[unitId]?.reading;
      const previousReading = previousReadings[unitId];
      
      units[unitId] = {
        currentReading: {
          reading: currentReading
        },
        previousReading: previousReading,
        consumption: currentReading && previousReading 
          ? Math.max(0, currentReading - previousReading)
          : 0,
        washes: readingsData.readings[unitId]?.washes || []
      };
    }
  });
  
  return {
    data: {
      months: [{
        month: readingsData.month,
        year: readingsData.year,
        units
      }]
    }
  };
};

/**
 * Check if a month has bills (lightweight - uses cached batch data)
 * Uses new lightweight batch endpoint that checks all months at once
 * No aggregator, no penalty calculations, super fast
 * 
 * @param {number} year - Fiscal year
 * @param {number} month - Fiscal month (0-11)
 * @returns {Promise<boolean>} True if bills exist for this month (can't edit), False if no bills (can edit)
 */
export const hasBillsForMonth = async (year, month) => {
  try {
    // Use batch endpoint if cache is invalid
    if (!billsExistenceCache || cacheYear !== year) {
      console.log(`📦 Batch loading bills existence for year ${year}...`);
      billsExistenceCache = await waterAPI.getBillsExistenceForYear(CLIENT_ID, year);
      cacheYear = year;
    }
    
    const exists = billsExistenceCache[month] === true;
    console.log(`📋 Bill check for ${year}-${month}: ${exists ? 'EXISTS (cannot edit)' : 'NOT EXISTS (can edit)'}`);
    return exists;
  } catch (error) {
    console.error(`Error checking if bill exists for month ${year}-${month}:`, error);
    // If we can't check, assume no bills (allow editing)
    return false;
  }
};

/**
 * Batch check which months have readings (lightweight - uses batch endpoint)
 * Cached per year to avoid repeated calls
 */
let readingsExistenceCache = null;
let billsExistenceCache = null;
let cacheYear = null;

/**
 * Clear existence cache (call after saving readings to refresh)
 */
export const clearExistenceCache = () => {
  readingsExistenceCache = null;
  billsExistenceCache = null;
  cacheYear = null;
  console.log('🗑️ Cleared existence cache');
};

/**
 * Check if readings exist for a month (lightweight - uses cached batch data)
 * @param {number} year - Fiscal year
 * @param {number} month - Fiscal month (0-11)
 * @returns {Promise<boolean>} True if readings exist
 */
const hasReadingsForMonth = async (year, month) => {
  try {
    // Use batch endpoint if cache is invalid
    if (!readingsExistenceCache || cacheYear !== year) {
      console.log(`📦 Batch loading readings existence for year ${year}...`);
      readingsExistenceCache = await waterAPI.getReadingsExistenceForYear(CLIENT_ID, year);
      cacheYear = year;
    }
    
    return readingsExistenceCache[month] === true;
  } catch (error) {
    console.error(`Error checking readings for ${year}-${month}:`, error);
    return false;
  }
};

/**
 * Find the first editable month (no readings, no bills)
 * Returns the first month that has no readings AND no bills
 * Also returns the prior month if it's editable (no bills)
 * Uses lightweight direct Firestore reads instead of aggregator
 * @param {number} year - Fiscal year to check
 * @returns {Promise<Object>} { current: {...}, prior: {...} | null }
 */
export const findFirstEditableMonth = async (year) => {
  try {
    // Pre-load batch data for all months (single API call instead of 24)
    console.log(`📦 Pre-loading batch existence data for year ${year}...`);
    await Promise.all([
      hasReadingsForMonth(year, 0), // This will trigger batch load
      hasBillsForMonth(year, 0)     // This will trigger batch load
    ]);
    
    let firstEmptyMonth = null;
    
    // Check each month (0-11) to find first without readings
    // Now using cached batch data (no additional API calls)
    for (let month = 0; month < 12; month++) {
      const period = `${year}-${String(month).padStart(2, '0')}`;
      
      // Lightweight check: does this month have readings? (uses cached batch data)
      const hasReadings = await hasReadingsForMonth(year, month);
      
      // If no readings for this month, check if bills exist (uses cached batch data)
      if (!hasReadings) {
        // No readings - check if bills exist (lightweight check)
        const hasBills = await hasBillsForMonth(year, month);
        
        if (!hasBills) {
          // Found first editable month (no readings, no bills)
          firstEmptyMonth = {
            year,
            month,
            period
          };
          break;
        }
        // Has bills but no readings - skip this month (can't edit)
        continue;
      }
    }
    
    // If all months have readings, return next month
    if (!firstEmptyMonth) {
      const current = getCurrentFiscalPeriod();
      const [currentYear, currentMonth] = current.period.split('-');
      const nextMonth = parseInt(currentMonth) + 1;
      
      if (nextMonth >= 12) {
        // Wrap to next fiscal year
        firstEmptyMonth = {
          year: parseInt(currentYear) + 1,
          month: 0,
          period: `${parseInt(currentYear) + 1}-00`
        };
      } else {
        firstEmptyMonth = {
          year: parseInt(currentYear),
          month: nextMonth,
          period: `${currentYear}-${String(nextMonth).padStart(2, '0')}`
        };
      }
    }
    
    // Now check if prior month is editable (has readings but no bills)
    let priorMonth = null;
    if (firstEmptyMonth && firstEmptyMonth.month > 0) {
      const priorMonthNum = firstEmptyMonth.month - 1;
      const priorPeriod = `${firstEmptyMonth.year}-${String(priorMonthNum).padStart(2, '0')}`;
      
      console.log(`Checking prior month ${priorPeriod} for editability...`);
      
      // Check if prior month has bills
      const priorHasBills = await hasBillsForMonth(firstEmptyMonth.year, priorMonthNum);
      
      console.log(`Prior month ${priorPeriod} has bills: ${priorHasBills}`);
      
      if (!priorHasBills) {
        // Prior month is editable (may have readings but no bills)
        priorMonth = {
          year: firstEmptyMonth.year,
          month: priorMonthNum,
          period: priorPeriod
        };
        console.log(`Prior month ${priorPeriod} is editable - added to available periods`);
      } else {
        console.log(`Prior month ${priorPeriod} has bills - cannot edit`);
      }
    } else if (firstEmptyMonth && firstEmptyMonth.month === 0) {
      // Current month is 0 (July), check prior year month 11 (June)
      const priorYear = firstEmptyMonth.year - 1;
      const priorPeriod = `${priorYear}-11`;
      
      console.log(`Checking prior year month ${priorPeriod} for editability...`);
      
      const priorHasBills = await hasBillsForMonth(priorYear, 11);
      
      console.log(`Prior month ${priorPeriod} has bills: ${priorHasBills}`);
      
      if (!priorHasBills) {
        priorMonth = {
          year: priorYear,
          month: 11,
          period: priorPeriod
        };
        console.log(`Prior month ${priorPeriod} is editable - added to available periods`);
      } else {
        console.log(`Prior month ${priorPeriod} has bills - cannot edit`);
      }
    }
    
    return {
      current: firstEmptyMonth,
      prior: priorMonth
    };
    
  } catch (error) {
    console.error('Error finding first editable month:', error);
    // Fallback to current month
    const current = getCurrentFiscalPeriod();
    return {
      current: {
        year: current.year,
        month: current.month - 1,
        period: current.period
      },
      prior: null
    };
  }
};

/**
 * Check if a month is editable (no bills exist)
 * @param {number} year - Fiscal year
 * @param {number} month - Fiscal month (0-11)
 * @returns {Promise<boolean>} True if month can be edited
 */
export const isMonthEditable = async (year, month) => {
  const hasBills = await hasBillsForMonth(year, month);
  return !hasBills;
};

export default {
  loadPreviousReadings,
  loadCurrentReadings,
  loadCurrentReadingsForPeriod,
  saveWashEntry,
  saveAllReadings,
  saveAllReadingsForPeriod,
  loadClientInfo,
  checkCurrentMonthExists,
  getFiscalPeriodInfo,
  getAggregatedDataFormat,
  hasBillsForMonth,
  findFirstEditableMonth,
  isMonthEditable,
  formatFiscalPeriodForDisplay,
  clearExistenceCache
};