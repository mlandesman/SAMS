// Water Meter API Service
import { handleApiResponse } from './apiUtils';
import { config } from '../config';

/**
 * SAMS Pattern Bulk Fetch - Get ALL water data for a year in one call
 * This replaces multiple individual API calls with a single efficient call
 * @param {string} clientId - The client ID
 * @param {number} year - The year to fetch
 * @returns {Promise<object>} Complete water data for all units
 */
export const fetchAllWaterDataForYear = async (clientId, year) => {
  console.log('🚀 [WaterAPI] fetchAllWaterDataForYear called:', { clientId, year });
  
  try {
    const API_BASE_URL = config.api.baseUrl;
    
    // Get Firebase auth token like all other services
    const { getAuthInstance } = await import('../firebaseClient');
    const auth = getAuthInstance();
    const token = await auth.currentUser?.getIdToken();
    
    if (!token) {
      throw new Error('User not authenticated');
    }
    
    // Use the NEW projects endpoint for full year data
    const url = `${API_BASE_URL}/clients/${clientId}/projects/waterBills/${year}`;
    
    console.log('🔗 [WaterAPI] Fetching from URL:', url);
    console.log('🔑 [WaterAPI] Using token:', token ? 'Token present' : 'No token');
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('📡 [WaterAPI] Response received:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });
    
    const data = await handleApiResponse(response);
    
    // The backend returns the full year data structure
    // We need to return it in a format the context expects
    // Context expects: { waterData: <the actual data object> }
    
    console.log('✅ [WaterAPI] Data received from backend:', {
      hasData: !!data?.data,
      hasMonths: !!data?.data?.months,
      monthsCount: data?.data?.months?.length || 0,
      firstMonthHasData: !!(data?.data?.months?.[0]?.units)
    });
    
    // Return the full data structure from the backend
    // The context will use this to display the history table
    return {
      waterData: data?.data || {}
    };
  } catch (error) {
    console.error('❌ [WaterAPI] Error fetching all water data:', {
      message: error.message,
      stack: error.stack,
      response: error.response
    });
    throw error;
  }
};

/**
 * Fetch latest meter readings for all units
 * @param {string} clientId - The client ID
 * @returns {Promise<object>} Latest meter readings
 */
export const fetchLatestReadings = async (clientId) => {
  try {
    const API_BASE_URL = config.api.baseUrl;
    
    // Get Firebase auth token
    const { getAuthInstance } = await import('../firebaseClient');
    const auth = getAuthInstance();
    const token = await auth.currentUser?.getIdToken();
    
    if (!token) {
      throw new Error('User not authenticated');
    }
    
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/watermeters/readings/latest`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    return handleApiResponse(response);
  } catch (error) {
    console.error('Error fetching latest readings:', error);
    throw error;
  }
};

/**
 * Submit batch meter readings
 * @param {string} clientId - The client ID
 * @param {Array} readings - Array of reading objects
 * @param {string} readingDate - Date of readings
 * @returns {Promise<object>} Result of batch submission
 */
export const submitBatchReadings = async (clientId, readings, readingDate) => {
  try {
    const API_BASE_URL = config.api.baseUrl;
    
    // Get Firebase auth token
    const { getAuthInstance } = await import('../firebaseClient');
    const auth = getAuthInstance();
    const token = await auth.currentUser?.getIdToken();
    
    if (!token) {
      throw new Error('User not authenticated');
    }
    
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/watermeters/readings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        clientId,
        readings,
        readingDate
      })
    });
    
    return handleApiResponse(response);
  } catch (error) {
    console.error('Error submitting batch readings:', error);
    throw error;
  }
};

/**
 * Generate water bills for a billing period
 * @param {string} clientId - The client ID
 * @param {string} billingMonth - Month in YYYY-MM format
 * @param {string} dueDate - Due date for bills
 * @param {object} options - Additional options (rateOverride, etc)
 * @returns {Promise<object>} Generated bills
 */
export const generateBills = async (clientId, billingMonth, dueDate, options = {}) => {
  try {
    const API_BASE_URL = config.api.baseUrl;
    
    // Get Firebase auth token
    const { getAuthInstance } = await import('../firebaseClient');
    const auth = getAuthInstance();
    const token = await auth.currentUser?.getIdToken();
    
    if (!token) {
      throw new Error('User not authenticated');
    }
    
    // CORRECTED: Split billingMonth into year and month as backend expects
    const [year, month] = billingMonth.split('-');
    
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/watermeters/bills/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        clientId,
        year: parseInt(year),  // Backend expects year as number
        month: parseInt(month), // Backend expects month as number
        dueDate,
        ...options
      })
    });
    
    return handleApiResponse(response);
  } catch (error) {
    console.error('Error generating bills:', error);
    throw error;
  }
};

/**
 * Fetch water bills for a specific year
 * CORRECTED: Changed to use year parameter as required by backend
 * @param {string} clientId - The client ID
 * @param {number} year - The year to fetch bills for
 * @returns {Promise<object>} Water bills
 */
export const fetchWaterBills = async (clientId, year = new Date().getFullYear()) => {
  try {
    const API_BASE_URL = config.api.baseUrl;
    
    // Get Firebase auth token
    const { getAuthInstance } = await import('../firebaseClient');
    const auth = getAuthInstance();
    const token = await auth.currentUser?.getIdToken();
    
    if (!token) {
      throw new Error('User not authenticated');
    }
    
    // CORRECTED: Use the actual route structure /bills/:year
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/watermeters/bills/${year}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    return handleApiResponse(response);
  } catch (error) {
    console.error('Error fetching water bills:', error);
    throw error;
  }
};

/**
 * Record water bill payment
 * @param {string} clientId - The client ID
 * @param {string} billId - The bill ID
 * @param {object} paymentData - Payment details
 * @returns {Promise<object>} Payment result
 */
export const recordPayment = async (clientId, billId, paymentData) => {
  try {
    const API_BASE_URL = config.api.baseUrl;
    
    // Get Firebase auth token
    const { getAuthInstance } = await import('../firebaseClient');
    const auth = getAuthInstance();
    const token = await auth.currentUser?.getIdToken();
    
    if (!token) {
      throw new Error('User not authenticated');
    }
    
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/watermeters/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        clientId,
        billId,
        ...paymentData
      })
    });
    
    return handleApiResponse(response);
  } catch (error) {
    console.error('Error recording payment:', error);
    throw error;
  }
};

/**
 * Fetch water meter for a specific unit
 * CORRECTED: Changed to use actual route /unit/:unitId
 * @param {string} clientId - The client ID
 * @param {string} unitId - The unit ID
 * @returns {Promise<object>} Water meter configuration
 */
export const fetchUnitWaterMeter = async (clientId, unitId) => {
  try {
    const API_BASE_URL = config.api.baseUrl;
    
    // Get Firebase auth token
    const { getAuthInstance } = await import('../firebaseClient');
    const auth = getAuthInstance();
    const token = await auth.currentUser?.getIdToken();
    
    if (!token) {
      throw new Error('User not authenticated');
    }
    
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/watermeters/unit/${unitId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    return handleApiResponse(response);
  } catch (error) {
    console.error('Error fetching unit water meter:', error);
    throw error;
  }
};

/**
 * Fetch all water meters by getting units list first
 * NOTE: There is no direct endpoint to get all meters at once
 * @param {string} clientId - The client ID
 * @returns {Promise<object>} Water meters for all units
 */
export const fetchWaterMeters = async (clientId) => {
  try {
    const API_BASE_URL = config.api.baseUrl;
    
    // Get Firebase auth token
    const { getAuthInstance } = await import('../firebaseClient');
    const auth = getAuthInstance();
    const token = await auth.currentUser?.getIdToken();
    
    if (!token) {
      throw new Error('User not authenticated');
    }
    
    // First fetch the units list
    const unitsResponse = await fetch(`${API_BASE_URL}/clients/${clientId}/units`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    const unitsData = await handleApiResponse(unitsResponse);
    
    // If we have units, we could fetch each meter individually
    // For now, return units as meters placeholder
    return { 
      meters: unitsData.units?.map(unit => ({
        unitId: unit.unitId,
        unitName: unit.unitName || unit.unitId,
        meterNumber: `WM-${unit.unitId}`,
        status: 'active'
      })) || []
    };
  } catch (error) {
    console.error('Error fetching water meters:', error);
    // Return empty array on error to prevent UI crash
    return { meters: [] };
  }
};

/**
 * Import readings from CSV (if backend supports it)
 * @param {string} clientId - The client ID
 * @param {File} file - CSV file
 * @param {string} readingDate - Date of readings
 * @returns {Promise<object>} Import result
 */
export const importReadingsFromCSV = async (clientId, file, readingDate) => {
  try {
    const API_BASE_URL = config.api.baseUrl;
    
    // Get Firebase auth token
    const { getAuthInstance } = await import('../firebaseClient');
    const auth = getAuthInstance();
    const token = await auth.currentUser?.getIdToken();
    
    if (!token) {
      throw new Error('User not authenticated');
    }
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('clientId', clientId);
    formData.append('readingDate', readingDate);
    
    // Note: This endpoint may not exist in backend
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/watermeters/readings/import`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    return handleApiResponse(response);
  } catch (error) {
    console.error('Error importing CSV:', error);
    throw error;
  }
};

/**
 * Fetch water readings for a specific month
 * @param {string} clientId - The client ID
 * @param {number} year - The year
 * @param {number} month - The month (1-12)
 * @returns {Promise<object>} Water readings
 */
export const fetchMonthlyReadings = async (clientId, year, month) => {
  try {
    const API_BASE_URL = config.api.baseUrl;
    
    // Get Firebase auth token
    const { getAuthInstance } = await import('../firebaseClient');
    const auth = getAuthInstance();
    const token = await auth.currentUser?.getIdToken();
    
    if (!token) {
      throw new Error('User not authenticated');
    }
    
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/watermeters/readings/${year}/${month}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    return handleApiResponse(response);
  } catch (error) {
    console.error('Error fetching monthly readings:', error);
    throw error;
  }
};

/**
 * Get a specific water bill
 * @param {string} clientId - The client ID
 * @param {string} unitId - The unit ID
 * @param {string} billId - The bill ID
 * @returns {Promise<object>} Water bill details
 */
export const fetchWaterBill = async (clientId, unitId, billId) => {
  try {
    const API_BASE_URL = config.api.baseUrl;
    
    // Get Firebase auth token
    const { getAuthInstance } = await import('../firebaseClient');
    const auth = getAuthInstance();
    const token = await auth.currentUser?.getIdToken();
    
    if (!token) {
      throw new Error('User not authenticated');
    }
    
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/watermeters/bills/${unitId}/${billId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    return handleApiResponse(response);
  } catch (error) {
    console.error('Error fetching water bill:', error);
    throw error;
  }
};

/**
 * Get outstanding balances for all units
 * @param {string} clientId - The client ID
 * @returns {Promise<object>} Outstanding balances
 */
export const fetchOutstandingBalances = async (clientId) => {
  try {
    const API_BASE_URL = config.api.baseUrl;
    
    // Get Firebase auth token
    const { getAuthInstance } = await import('../firebaseClient');
    const auth = getAuthInstance();
    const token = await auth.currentUser?.getIdToken();
    
    if (!token) {
      throw new Error('User not authenticated');
    }
    
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/watermeters/outstanding`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    return handleApiResponse(response);
  } catch (error) {
    console.error('Error fetching outstanding balances:', error);
    throw error;
  }
};