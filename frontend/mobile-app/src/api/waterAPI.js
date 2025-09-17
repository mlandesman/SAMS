// Water Bills API Service - Mobile PWA Version
// Adapted from desktop waterAPI.js to use getAggregatedData pattern

/**
 * API Configuration for Mobile PWA
 */
const API_CONFIG = {
  baseUrl: 'http://localhost:5001/api',
  domainBaseUrl: 'http://localhost:5001'
};

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
    this.baseUrl = API_CONFIG.baseUrl;                // Legacy endpoints (/api/clients/...)
    this.domainBaseUrl = API_CONFIG.domainBaseUrl;    // Clean domain endpoints (/water/...)
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
    
    const response = await fetch(
      `${this.domainBaseUrl}/water/clients/${clientId}/data/${year}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    const data = await handleApiResponse(response);
    
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
      `${this.domainBaseUrl}/water/clients/${clientId}/readings/${year}/${month}`,
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
}

export default new WaterAPI();