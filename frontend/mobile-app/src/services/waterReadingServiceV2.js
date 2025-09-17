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
 * Get aggregated data and extract month readings
 * @param {string} period - Period in format "YYYY-MM" (e.g., "2026-01")
 * @returns {Object} Readings data for the specified period
 */
const getMonthReadingsFromAggregated = async (period) => {
  const [year] = period.split('-');
  
  try {
    // Get all year data using desktop pattern
    const aggregatedData = await waterAPI.getAggregatedData(CLIENT_ID, year);
    
    console.log(`Aggregated data structure for ${year}:`, JSON.stringify(aggregatedData, null, 2));
    
    // Extract the specific month from aggregated data
    if (aggregatedData?.data?.months) {
      console.log(`Available months:`, aggregatedData.data.months.map(m => ({
        year: m.year,
        month: m.month,
        computedPeriod: `${m.year}-${String(m.month).padStart(2, '0')}`
      })));
      
      const monthData = aggregatedData.data.months.find(m => {
        // Backend month is already 0-based fiscal month, no need to subtract 1
        const monthPeriod = `${m.year}-${String(m.month).padStart(2, '0')}`;
        console.log(`Comparing ${monthPeriod} === ${period}`);
        return monthPeriod === period;
      });
      
      if (monthData) {
        console.log(`Found month data for period ${period}:`, monthData);
        return monthData;
      }
    }
    
    console.log(`No data found for period ${period} - this is expected for future periods that haven't been created yet`);
    return null;
    
  } catch (error) {
    console.error(`Error loading aggregated data for period ${period}:`, error);
    return null;
  }
};

/**
 * Load Previous Month Readings
 * Extract from previous month's currentReading in aggregated data
 */
export const loadPreviousReadings = async () => {
  try {
    console.log('Loading previous readings from aggregated data...');
    
    const current = getCurrentFiscalPeriod();
    const previousPeriod = getPreviousFiscalPeriod(current.period);
    
    // Get previous month data from aggregated response
    const previousMonthData = await getMonthReadingsFromAggregated(previousPeriod);
    
    const previousReadings = {};
    
    if (previousMonthData) {
      // Extract unit readings from previous month
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
      
      // Extract building meter and common area from previous month
      if (previousMonthData.buildingMeter && previousMonthData.buildingMeter.currentReading) {
        previousReadings.buildingMeter = previousMonthData.buildingMeter.currentReading;
      }
      
      if (previousMonthData.commonArea && previousMonthData.commonArea.currentReading) {
        previousReadings.commonArea = previousMonthData.commonArea.currentReading;
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
 * Save All Meter Readings
 * Uses waterAPI.saveReadings (domain endpoint)
 */
export const saveAllReadings = async (readingsData) => {
  try {
    const current = getCurrentFiscalPeriod();
    const [year, month] = current.period.split('-');
    
    console.log('Saving all readings:', { readingsData, period: current.period });
    
    // Build the complete payload with correct structure
    const apiPayload = {
      month: parseInt(month),
      year: parseInt(year),
      readings: {},
      buildingMeter: null,
      commonArea: null
    };
    
    Object.keys(readingsData).forEach(unitId => {
      const unitData = readingsData[unitId];
      
      if (UNIT_CONFIG[unitId]?.type === 'unit') {
        // Units: Send reading + washes array (if has washes)
        const cleanUnit = { reading: unitData.reading };
        
        // Only include washes array if there are actual washes
        if (unitData.washes && unitData.washes.length > 0) {
          cleanUnit.washes = unitData.washes;
        }
        
        apiPayload.readings[unitId] = cleanUnit;
      } else if (unitId === 'buildingMeter') {
        // Building meter: flat numeric value at root
        apiPayload.buildingMeter = unitData.reading;
      } else if (unitId === 'commonArea') {
        // Common area: flat numeric value at root
        apiPayload.commonArea = unitData.reading;
      }
    });
    
    console.log('Complete payload being sent:', JSON.stringify(apiPayload, null, 2));
    
    // Send the complete payload
    const result = await waterAPI.saveReadings(CLIENT_ID, year, month, apiPayload);
    console.log('All readings saved successfully');
    
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

export default {
  loadPreviousReadings,
  loadCurrentReadings,
  saveWashEntry,
  saveAllReadings,
  loadClientInfo,
  checkCurrentMonthExists,
  getFiscalPeriodInfo,
  getAggregatedDataFormat
};