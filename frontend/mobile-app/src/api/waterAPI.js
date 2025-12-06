// Water Bills API Service - Mobile PWA Version
// Adapted from desktop waterAPI.js to use getAggregatedData pattern

import { config } from '../config/index.js';

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
 * Water Bills API
 * Handles all water billing related API calls
 */
class WaterAPI {
  constructor() {
    this.baseUrl = config.api.baseUrl;                // Unified baseURL configuration
    this.cache = new Map();                           // Session cache for year data
  }

  /**
   * Get Firebase auth token
   */
  async getAuthToken() {
    // Import Firebase auth dynamically for mobile
    const { getAuth } = await import('firebase/auth');
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    return await user.getIdToken();
  }

  /**
   * Get aggregated water data for a fiscal year
   * This endpoint returns everything: readings, bills, payments, status
   * CACHED for session to minimize re-fetching
   * 
   * NOTE: Backend endpoint changed from /data/ to /bills/ in refactor
   */
  async getAggregatedData(clientId, year) {
    const cacheKey = `${clientId}-${year}`;
    
    // Return cached data if available
    if (this.cache.has(cacheKey)) {
      console.log(`Using cached data for ${cacheKey}`);
      return this.cache.get(cacheKey);
    }
    
    console.log(`Fetching aggregated data for ${clientId} year ${year}`);
    const token = await this.getAuthToken();
    
    // Backend route: GET /water/clients/:clientId/bills/:year
    // Returns: { success: true, data: { year, months: [...], summary: {...} } }
    const response = await fetch(
      `${this.baseUrl}/water/clients/${clientId}/bills/${year}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    const result = await handleApiResponse(response);
    
    // Backend returns { success: true, data: {...} }
    // Extract data property to match expected format
    const data = result.data || result;
    
    // Cache the data for session
    this.cache.set(cacheKey, data);
    
    return data;
  }

  /**
   * Clear cache (useful for refresh)
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Save readings for a month (using domain endpoint)
   */
  async saveReadings(clientId, year, month, readings) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.baseUrl}/water/clients/${clientId}/readings/${year}/${month}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(readings)
      }
    );
    
    // Clear cache after successful save to force refresh
    const cacheKey = `${clientId}-${year}`;
    this.cache.delete(cacheKey);
    
    return handleApiResponse(response);
  }

  /**
   * Get bills for entire fiscal year (12 months)
   * Returns calculated year data with months array
   * DIRECT READ from bill documents (no aggregatedData caching)
   */
  async getBillsForYear(clientId, year) {
    const token = await this.getAuthToken();
    
    console.log(`💧 WaterAPI (Mobile) fetching bills for ${clientId} year ${year}`);
    
    // Add cache-busting parameter to ensure fresh data
    const cacheBuster = `_t=${Date.now()}`;
    const response = await fetch(
      `${this.baseUrl}/water/clients/${clientId}/bills/${year}?${cacheBuster}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      }
    );
    
    const result = await handleApiResponse(response);
    console.log(`✅ WaterAPI (Mobile) received ${result.data?.months?.length || 0} months of bills`);
    
    return result;
  }

  /**
   * Get bills for specific month
   * @param {string} clientId - Client ID
   * @param {number} year - Fiscal year
   * @param {number} month - Fiscal month (0-11)
   * @param {boolean} unpaidOnly - Only return unpaid bills
   */
  async getBillsForMonth(clientId, year, month, unpaidOnly = false) {
    const token = await this.getAuthToken();
    
    const url = new URL(`${this.baseUrl}/water/clients/${clientId}/bills/${year}/${month}`);
    if (unpaidOnly) {
      url.searchParams.append('unpaidOnly', 'true');
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    return handleApiResponse(response);
  }

  /**
   * Get water billing configuration for client
   * Returns rates, penalties, and billing settings
   */
  async getBillingConfig(clientId) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.baseUrl}/water/clients/${clientId}/config`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    return handleApiResponse(response);
  }

  /**
   * Get client configuration
   */
  async getClientInfo(clientId) {
    const token = await this.getAuthToken();
    
    const response = await fetch(`${this.baseUrl}/clients/${clientId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    return handleApiResponse(response);
  }

  /**
   * Get all quarterly bills for a fiscal year
   * @param {string} clientId - Client ID
   * @param {number} year - Fiscal year
   */
  async getQuarterlyBillsForYear(clientId, year) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.baseUrl}/water/clients/${clientId}/bills/quarterly/${year}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    const result = await handleApiResponse(response);
    return result.data || [];
  }

  /**
   * Get readings for a specific month (lightweight - no aggregator/penalty calculations)
   * This is much faster than getAggregatedData as it only reads from Firestore
   * @param {string} clientId - Client ID
   * @param {number} year - Fiscal year
   * @param {number} month - Fiscal month (0-11)
   */
  async getMonthReadings(clientId, year, month) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.baseUrl}/water/clients/${clientId}/readings/${year}/${month}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    const result = await handleApiResponse(response);
    return result.data || { readings: {} };
  }

  /**
   * Check if a bill exists for a month (super lightweight - document existence check only)
   * No aggregator, no penalty calculations, just checks if document ID exists
   * @param {string} clientId - Client ID
   * @param {number} year - Fiscal year
   * @param {number} month - Fiscal month (0-11)
   * @returns {Promise<boolean>} True if bill document exists
   */
  async billExists(clientId, year, month) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.baseUrl}/water/clients/${clientId}/bills/exists/${year}/${month}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    const result = await handleApiResponse(response);
    return result.exists === true;
  }

  /**
   * Batch check which months have readings (lightweight - existence check only)
   * Returns map of month (0-11) -> boolean
   * @param {string} clientId - Client ID
   * @param {number} year - Fiscal year
   * @returns {Promise<Object>} Map of month -> boolean
   */
  async getReadingsExistenceForYear(clientId, year) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.baseUrl}/water/clients/${clientId}/readings/exists/${year}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    const result = await handleApiResponse(response);
    return result.data || {};
  }

  /**
   * Batch check which months have bills (lightweight - existence check only)
   * Returns map of month (0-11) -> boolean
   * @param {string} clientId - Client ID
   * @param {number} year - Fiscal year
   * @returns {Promise<Object>} Map of month -> boolean
   */
  async getBillsExistenceForYear(clientId, year) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.baseUrl}/water/clients/${clientId}/bills/exists/${year}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    const result = await handleApiResponse(response);
    return result.data || {};
  }
}

export default new WaterAPI();