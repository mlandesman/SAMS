/**
 * Exchange Rates API Service
 * 
 * Handles communication with the backend for exchange rate operations
 */

import { config } from '../config';
const API_BASE_URL = config.api.baseUrl;

/**
 * Call the daily exchange rates update endpoint
 * This should be called after successful user login
 */
export async function triggerDailyExchangeRatesUpdate() {
  try {
    console.log('🔄 Triggering daily exchange rates update...');
    
    const response = await fetch(`${API_BASE_URL}/exchange-rates/daily-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for authentication
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Daily exchange rates update completed:', result.message);
    } else {
      console.warn('⚠️ Exchange rates update had issues:', result.message);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Failed to trigger daily exchange rates update:', error);
    // Don't throw - this shouldn't prevent login
    return { 
      success: false, 
      error: error.message,
      message: 'Failed to trigger exchange rates update'
    };
  }
}

/**
 * Manual exchange rates update with options
 * @param {Object} options - Update options
 * @param {string} options.mode - 'quick', 'bulk', or 'fill-gaps'
 * @param {string} options.startDate - Start date (YYYY-MM-DD)
 * @param {string} options.endDate - End date (YYYY-MM-DD)
 * @param {boolean} options.dryRun - Whether to run in dry-run mode
 */
export async function triggerManualExchangeRatesUpdate(options = {}) {
  try {
    console.log('🔧 Triggering manual exchange rates update...', options);
    
    const response = await fetch(`${API_BASE_URL}/exchange-rates/manual-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(options)
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Manual exchange rates update completed:', result.message);
    } else {
      console.error('❌ Manual exchange rates update failed:', result.error);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Failed to trigger manual exchange rates update:', error);
    throw error;
  }
}

/**
 * Check if exchange rates exist for today
 */
export async function checkTodaysExchangeRates() {
  try {
    const response = await fetch(`${API_BASE_URL}/exchange-rates/check`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    
    return await response.json();
    
  } catch (error) {
    console.error('❌ Failed to check today\'s exchange rates:', error);
    throw error;
  }
}

/**
 * Fetch all exchange rate records via backend API
 * Returns all historical records sorted by date (newest first)
 */
export async function fetchAllExchangeRates() {
  try {
    console.log('📊 Fetching all exchange rate records...');
    
    const response = await fetch(`${API_BASE_URL}/exchange-rates/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'Failed to fetch exchange rates');
    }
    
    if (result.success) {
      console.log(`✅ Fetched ${result.data.length} exchange rate records`);
      return result.data;
    } else {
      throw new Error(result.error || 'Unknown error fetching exchange rates');
    }
    
  } catch (error) {
    console.error('❌ Failed to fetch exchange rates:', error);
    throw error;
  }
}

/**
 * Get exchange rates for a specific date (or most recent before that date)
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Object} Exchange rate data with actualDate info
 */
export async function getExchangeRatesForDate(date) {
  try {
    console.log(`📊 Fetching exchange rates for ${date}...`);
    
    const response = await fetch(`${API_BASE_URL}/exchange-rates/date/${date}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || `Failed to fetch exchange rates for ${date}`);
    }
    
    if (result.success) {
      console.log(`✅ Found exchange rates for ${result.actualDate} (requested: ${date})`);
      return result;
    } else {
      throw new Error(result.error || 'Unknown error fetching exchange rates');
    }
    
  } catch (error) {
    console.error(`❌ Failed to fetch exchange rates for ${date}:`, error);
    throw error;
  }
}

/**
 * Format date string (YYYY-MM-DD) for human-readable display
 */
function formatDateForDisplay(dateStr) {
  try {
    const date = new Date(dateStr + 'T12:00:00'); // Add time to avoid timezone issues
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  } catch (error) {
    return dateStr; // Fallback to original string
  }
}
