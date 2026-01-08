// services/waterConsumptionAnalysisService.js
import { waterDataService } from './waterDataService.js';

// Fiscal year configuration (AVII starts in July)
const FISCAL_YEAR_START_MONTH = 7;

// Calendar month names for display
const calendarMonthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

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
 * Calculate consumption for a month
 */
function calculateConsumption(currentReading, priorReading) {
  if (currentReading === null || priorReading === null) return null;
  return currentReading - priorReading;
}

/**
 * Get calendar month name for fiscal month
 * Fiscal year 2026 = July 2025 through June 2026
 * Months 0-5 (July-Dec) are in calendar year (fiscalYear - 1)
 * Months 6-11 (Jan-Jun) are in calendar year fiscalYear
 */
function getCalendarMonthName(fiscalMonth, fiscalYear) {
  let calendarMonth = fiscalMonth + (FISCAL_YEAR_START_MONTH - 1);
  let calendarYear = fiscalMonth < 6 ? fiscalYear - 1 : fiscalYear;
  
  if (calendarMonth >= 12) {
    calendarMonth -= 12;
    calendarYear += 1;
  }
  
  return `${calendarMonthNames[calendarMonth]} ${calendarYear}`;
}

/**
 * Calculate consumption analysis for a fiscal year
 * Returns array of month data with consumption calculations
 */
export async function calculateConsumptionAnalysis(clientId, fiscalYear) {
  try {
    // Fetch all readings for the fiscal year
    const allReadings = await waterDataService.fetchAllReadingsForYear(clientId, fiscalYear);
    
    if (!allReadings || Object.keys(allReadings).length === 0) {
      return [];
    }

    const analysisData = [];
    
    // Process each fiscal month (0-11)
    for (let month = 0; month < 12; month++) {
      const currentKey = month;
      const priorKey = month === 0 ? 'prior-11' : (month - 1);
      
      const currentMonthData = allReadings[currentKey];
      const priorMonthData = allReadings[priorKey];
      
      // Skip if no current month data
      if (!currentMonthData || !currentMonthData.readings || Object.keys(currentMonthData.readings).length === 0) {
        continue;
      }
      
      // Extract readings
      const currentReadings = currentMonthData.readings || {};
      const priorReadings = priorMonthData?.readings || {};
      
      // Calculate unit consumption
      let totalUnitConsumption = 0;
      let unitCount = 0;
      
      for (const [unitId, reading] of Object.entries(currentReadings)) {
        // Skip commonArea and buildingMeter (they're at root level)
        if (unitId === 'commonArea' || unitId === 'buildingMeter') continue;
        
        const currentReading = extractReading(reading);
        const priorReading = extractReading(priorReadings[unitId]);
        
        if (currentReading !== null && priorReading !== null) {
          const consumption = currentReading - priorReading;
          totalUnitConsumption += consumption;
          unitCount++;
        }
      }
      
      // Calculate common area consumption
      const currentCommonArea = extractReading(currentMonthData.readings.commonArea);
      const priorCommonArea = extractReading(priorMonthData?.readings?.commonArea);
      const commonAreaConsumption = calculateConsumption(currentCommonArea, priorCommonArea);
      
      // Calculate building meter consumption
      const currentBuildingMeter = extractReading(currentMonthData.readings.buildingMeter);
      const priorBuildingMeter = extractReading(priorMonthData?.readings?.buildingMeter);
      const buildingConsumption = calculateConsumption(currentBuildingMeter, priorBuildingMeter);
      
      // Calculate delta
      let delta = null;
      if (commonAreaConsumption !== null && buildingConsumption !== null) {
        delta = (totalUnitConsumption + commonAreaConsumption) - buildingConsumption;
      }
      
      // Calculate percentage
      let percentage = null;
      if (delta !== null && buildingConsumption !== null && buildingConsumption !== 0) {
        percentage = (delta / buildingConsumption) * 100;
      }
      
      // Get calendar month name
      const monthName = getCalendarMonthName(month, fiscalYear);
      
      // Set unitsTotal to null if we couldn't calculate any consumption
      let unitsTotalValue = null;
      if (unitCount > 0) {
        unitsTotalValue = totalUnitConsumption;
      }
      
      analysisData.push({
        month,
        monthName,
        unitsTotal: unitsTotalValue,
        commonArea: commonAreaConsumption,
        building: buildingConsumption,
        delta,
        percentage,
        unitCount
      });
    }
    
    return analysisData;
  } catch (error) {
    console.error('Error calculating consumption analysis:', error);
    throw error;
  }
}
