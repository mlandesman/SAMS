/**
 * Water Reading Service - REST API Version
 * Uses verified REST API endpoints instead of Firebase MCP
 * Matches patterns from desktop waterAPI.js
 */

import { 
  createEmptyReadingsDocument,
  WORKER_ROUTE_ORDER,
  UNIT_CONFIG 
} from '../utils/waterReadingHelpers.js';
import { getCurrentFiscalPeriod, getPreviousFiscalPeriod } from '../utils/fiscalYearUtils.js';

// API Configuration
const API_CONFIG = {
  baseUrl: 'http://localhost:5001/api',  // Legacy endpoints
  domainBaseUrl: 'http://localhost:5001', // Clean domain endpoints (/water/...)
  timeout: 30000
};

const CLIENT_ID = 'AVII';

/**
 * Get Firebase auth token
 */
async function getAuthToken() {
  // Import Firebase auth dynamically
  const { getAuth } = await import('firebase/auth');
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  return await user.getIdToken();
}

/**
 * Handle API response with proper error handling
 */
async function handleApiResponse(response) {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }
  
  const data = await response.json();
  return data;
}

/**
 * Load Client Information
 * GET /api/clients/{clientId}
 */
export const loadClientInfo = async () => {
  try {
    console.log('Loading client information for:', CLIENT_ID);
    
    const token = await getAuthToken();
    
    const response = await fetch(`${API_CONFIG.baseUrl}/clients/${CLIENT_ID}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const clientData = await handleApiResponse(response);
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
 * Load Previous Month Readings
 * GET /api/clients/{clientId}/projects/waterBills/readings/{year}/{month}
 */
export const loadPreviousReadings = async (inputYear = null, inputMonth = null) => {
  try {
    // Get current period or use provided values
    let currentPeriod;
    if (inputYear && inputMonth !== null) {
      // Convert provided year/month to period format
      currentPeriod = `${inputYear}-${String(inputMonth - 1).padStart(2, '0')}`;
    } else {
      // Get current fiscal period
      const current = getCurrentFiscalPeriod();
      currentPeriod = current.period;
    }
    
    // Get previous period using utility function
    const previousPeriod = getPreviousFiscalPeriod(currentPeriod);
    console.log('Loading previous readings:', { currentPeriod, previousPeriod });
    
    const token = await getAuthToken();
    
    // Split period format "2026-01" into year and month
    const [periodYear, periodMonth] = previousPeriod.split('-');
    
    const response = await fetch(
      `${API_CONFIG.domainBaseUrl}/water/clients/${CLIENT_ID}/readings/${periodYear}/${periodMonth}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        console.warn('No previous readings found');
        return {};
      }
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const previousDoc = await response.json();
    const previousReadings = {};
    
    // Extract previous readings for each unit
    if (previousDoc.readings) {
      Object.keys(previousDoc.readings).forEach(unitId => {
        const unitData = previousDoc.readings[unitId];
        if (unitData && typeof unitData === 'object') {
          // Handle both new format (reading field) and legacy format (direct number)
          previousReadings[unitId] = unitData.reading || unitData;
        } else if (typeof unitData === 'number') {
          // Legacy format - direct number
          previousReadings[unitId] = unitData;
        }
      });
    }
    
    console.log('Loaded previous readings:', previousReadings);
    return previousReadings;
    
  } catch (error) {
    console.error('Error loading previous readings:', error);
    return {};
  }
};

/**
 * Load Current Month Readings
 * GET /api/clients/{clientId}/projects/waterBills/readings/{year}/{month}
 */
export const loadCurrentReadings = async (inputYear = null, inputMonth = null) => {
  try {
    // Get current period or use provided values
    let currentPeriod;
    if (inputYear && inputMonth !== null) {
      // Convert provided year/month to period format
      currentPeriod = `${inputYear}-${String(inputMonth - 1).padStart(2, '0')}`;
    } else {
      // Get current fiscal period
      const current = getCurrentFiscalPeriod();
      currentPeriod = current.period;
    }
    
    console.log('Loading current readings:', { period: currentPeriod });
    
    const token = await getAuthToken();
    
    // Split period format "2026-01" into year and month
    const [currentYear, currentMonth] = currentPeriod.split('-');
    
    const response = await fetch(
      `${API_CONFIG.domainBaseUrl}/water/clients/${CLIENT_ID}/readings/${currentYear}/${currentMonth}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log('No current readings found, creating empty structure');
        const current = getCurrentFiscalPeriod();
        return createEmptyReadingsDocument(current.year, current.month);
      }
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const currentDoc = await response.json();
    console.log('Loaded current readings:', currentDoc);
    
    return currentDoc;
    
  } catch (error) {
    console.error('Error loading current readings:', error);
    // Return empty structure on error
    const current = getCurrentFiscalPeriod();
    return createEmptyReadingsDocument(current.year, current.month);
  }
};

/**
 * Save All Meter Readings
 * PUT /api/clients/{clientId}/projects/waterBills/readings/{year}/{month}
 */
export const saveAllReadings = async (readingsData, inputYear = null, inputMonth = null) => {
  try {
    // Get current period or use provided values
    let currentPeriod;
    if (inputYear && inputMonth !== null) {
      // Convert provided year/month to period format
      currentPeriod = `${inputYear}-${String(inputMonth - 1).padStart(2, '0')}`;
    } else {
      // Get current fiscal period
      const current = getCurrentFiscalPeriod();
      currentPeriod = current.period;
    }
    
    console.log('Saving all readings:', { readingsData, period: currentPeriod });
    
    const token = await getAuthToken();
    
    // Load existing document to preserve washes  
    const existingDoc = await loadCurrentReadings();
    
    // Merge new readings with existing washes
    const mergedReadings = { ...readingsData };
    
    Object.keys(mergedReadings).forEach(unitId => {
      if (existingDoc.readings && existingDoc.readings[unitId]?.washes) {
        // Preserve existing washes when updating readings
        mergedReadings[unitId] = {
          ...mergedReadings[unitId],
          washes: existingDoc.readings[unitId].washes
        };
      }
    });
    
    // Split period format "2026-01" into year and month
    const [saveYear, saveMonth] = currentPeriod.split('-');
    
    const response = await fetch(
      `${API_CONFIG.domainBaseUrl}/water/clients/${CLIENT_ID}/readings/${saveYear}/${saveMonth}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ readings: mergedReadings })
      }
    );
    
    const result = await handleApiResponse(response);
    console.log('All readings saved successfully');
    
    return { success: true, data: result };
    
  } catch (error) {
    console.error('Error saving all readings:', error);
    throw new Error(`Error guardando lecturas: ${error.message}`);
  }
};

/**
 * Save Wash Entry
 * This requires updating the existing readings document with the new wash
 */
export const saveWashEntry = async (unitId, washEntry, inputYear = null, inputMonth = null) => {
  try {
    // Get current period or use provided values
    let currentPeriod;
    if (inputYear && inputMonth !== null) {
      // Convert provided year/month to period format
      currentPeriod = `${inputYear}-${String(inputMonth - 1).padStart(2, '0')}`;
    } else {
      // Get current fiscal period
      const current = getCurrentFiscalPeriod();
      currentPeriod = current.period;
    }
    
    console.log('Saving wash entry:', { unitId, washEntry, period: currentPeriod });
    
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
    const updatedWashes = [...currentReadings.readings[unitId].washes, washEntry];
    currentReadings.readings[unitId].washes = updatedWashes;
    currentReadings.timestamp = new Date();
    
    // Save the updated document
    const token = await getAuthToken();
    
    // Split period format "2026-01" into year and month
    const [washYear, washMonth] = currentPeriod.split('-');
    
    const response = await fetch(
      `${API_CONFIG.domainBaseUrl}/water/clients/${CLIENT_ID}/readings/${washYear}/${washMonth}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ readings: currentReadings.readings })
      }
    );
    
    await handleApiResponse(response);
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
export const checkCurrentMonthExists = async (inputYear = null, inputMonth = null) => {
  try {
    const currentReadings = await loadCurrentReadings(inputYear, inputMonth);
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

// Simulate waterAPI.getAggregatedData() response format
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