/**
 * Water Reading Helper Functions
 * Clean DRY approach - eliminates duplicate count storage
 * Always calculates from source washes[] array for accuracy
 */

// Worker physical route order (Humberto's actual path)
export const WORKER_ROUTE_ORDER = [
  '101', '201', '102', '202', '103', '203', 
  '104', '204', '105', '106', 'buildingMeter', 'commonArea'
];

// Unit display configuration
export const UNIT_CONFIG = {
  '101': { label: '101', type: 'unit' },
  '201': { label: '201', type: 'unit' },
  '102': { label: '102', type: 'unit' },
  '202': { label: '202', type: 'unit' },
  '103': { label: '103', type: 'unit' },
  '203': { label: '203', type: 'unit' },
  '104': { label: '104', type: 'unit' },
  '204': { label: '204', type: 'unit' },
  '105': { label: '105', type: 'unit' },
  '106': { label: '106', type: 'unit' },
  'buildingMeter': { label: 'Edif.', type: 'building' },
  'commonArea': { label: 'Común', type: 'common' }
};

// Wash pricing (for display)
export const WASH_PRICES = {
  car: 100,   // $100 pesos
  boat: 200   // $200 pesos
};

// Wash type labels (Spanish)
export const WASH_LABELS = {
  car: 'Auto',
  boat: 'Barco'
};

/**
 * Clean DRY Helper Functions
 * Always calculate from washes[] array - never store counts
 */

// Get car wash count for a unit
export const getCarWashCount = (unitData) => {
  if (!unitData?.washes || !Array.isArray(unitData.washes)) return 0;
  return unitData.washes.filter(wash => wash.type === 'car').length;
};

// Get boat wash count for a unit  
export const getBoatWashCount = (unitData) => {
  if (!unitData?.washes || !Array.isArray(unitData.washes)) return 0;
  return unitData.washes.filter(wash => wash.type === 'boat').length;
};

// Get total wash count for a unit
export const getTotalWashCount = (unitData) => {
  if (!unitData?.washes || !Array.isArray(unitData.washes)) return 0;
  return unitData.washes.length;
};

// Get wash summary for billing integration
export const getUnitWashSummary = (unitData) => ({
  carWashes: getCarWashCount(unitData),
  boatWashes: getBoatWashCount(unitData),
  totalWashes: getTotalWashCount(unitData),
  totalCost: (getCarWashCount(unitData) * WASH_PRICES.car) + 
             (getBoatWashCount(unitData) * WASH_PRICES.boat)
});

// Get all washes for a readings document (across all units)
export const getAllWashSummary = (readingsData) => {
  if (!readingsData?.readings) return { carWashes: 0, boatWashes: 0, totalWashes: 0, totalCost: 0 };
  
  let carTotal = 0;
  let boatTotal = 0;
  let totalCost = 0;
  
  Object.values(readingsData.readings).forEach(unitData => {
    if (unitData && typeof unitData === 'object' && unitData.washes) {
      carTotal += getCarWashCount(unitData);
      boatTotal += getBoatWashCount(unitData);
    }
  });
  
  totalCost = (carTotal * WASH_PRICES.car) + (boatTotal * WASH_PRICES.boat);
  
  return {
    carWashes: carTotal,
    boatWashes: boatTotal, 
    totalWashes: carTotal + boatTotal,
    totalCost
  };
};

/**
 * Date Helpers (Mexico Timezone)
 */

// Get current date in Mexico timezone
export const getCurrentMexicoDate = () => {
  return new Date().toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

// Format date for wash entry (YYYY-MM-DD)
export const formatWashDate = (date = new Date()) => {
  return date.toISOString().split('T')[0];
};

// Re-export fiscal year functions for backward compatibility
export { getCurrentFiscalPeriod, getPreviousFiscalPeriod } from './fiscalYearUtils.js';

/**
 * Reading Validation Helpers
 */

// Validate a meter reading
export const validateReading = (unitId, currentReading, previousReading) => {
  const current = parseInt(currentReading);
  const previous = parseInt(previousReading);
  
  if (isNaN(current)) {
    return { valid: false, error: 'Lectura inválida - debe ser un número' };
  }
  
  if (isNaN(previous)) {
    return { valid: false, error: `Lectura anterior no encontrada para ${UNIT_CONFIG[unitId]?.label || unitId}` };
  }
  
  // Check for backwards reading (possible meter rollover)
  if (current < previous) {
    // For 5-digit meters, rollover is possible (99999 → 00000)
    const rolloverConsumption = (99999 - previous) + current + 1;
    if (rolloverConsumption <= 200) { // Reasonable rollover consumption
      return { 
        valid: true, 
        rollover: true,
        consumption: rolloverConsumption,
        warning: `Posible reinicio del medidor. Consumo calculado: ${rolloverConsumption}m³`
      };
    } else {
      return { valid: false, error: 'Lectura menor que la anterior - verificar número' };
    }
  }
  
  const consumption = current - previous;
  
  // High consumption warning (>100m³)
  if (consumption > 100) {
    return { 
      valid: true, 
      consumption,
      warning: `Consumo alto: ${consumption}m³ - verificar lectura`
    };
  }
  
  return { valid: true, consumption };
};

// Calculate consumption for display
export const calculateConsumption = (currentReading, previousReading) => {
  const validation = validateReading('temp', currentReading, previousReading);
  return validation.valid ? (validation.consumption || 0) : 0;
};

/**
 * Data Structure Helpers
 */

// Create empty readings document structure
export const createEmptyReadingsDocument = (year, month) => ({
  year,
  month,
  readings: Object.fromEntries(
    WORKER_ROUTE_ORDER.map(unitId => [
      unitId,
      UNIT_CONFIG[unitId].type === 'unit' 
        ? { reading: null, washes: [] }
        : null // Building/common meters don't have washes
    ])
  ),
  timestamp: null // Will be set on save
});

// Merge existing washes with new readings
export const mergeReadingsWithWashes = (newReadings, existingWashes = {}) => {
  const merged = { ...newReadings };
  
  Object.keys(merged).forEach(unitId => {
    if (existingWashes[unitId]?.washes) {
      merged[unitId] = {
        ...merged[unitId],
        washes: existingWashes[unitId].washes
      };
    }
  });
  
  return merged;
};

// Format reading for display (preserve leading zeros)
export const formatReading = (reading) => {
  if (reading === null || reading === undefined || reading === '') return '';
  const num = parseInt(reading);
  if (isNaN(num)) return reading;
  return num.toString().padStart(5, '0');
};

// Parse reading input (remove leading zeros for calculation)
export const parseReading = (input) => {
  if (!input || input === '') return null;
  const num = parseInt(input);
  return isNaN(num) ? null : num;
};