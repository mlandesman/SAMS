// Propane Tank API Service - Mobile PWA Version
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
 * Propane Tank API
 * Handles all propane tank reading related API calls
 */
class PropaneAPI {
  constructor() {
    this.baseUrl = config.api.baseUrl;
  }

  /**
   * Get Firebase auth token
   */
  async getAuthToken() {
    const { getAuth } = await import('firebase/auth');
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    return await user.getIdToken();
  }

  /**
   * Get propane configuration for a client
   */
  async getConfig(clientId) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.baseUrl}/propane/clients/${clientId}/config`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    const result = await handleApiResponse(response);
    return result.data;
  }

  /**
   * Get aggregated data for a fiscal year
   */
  async getAggregatedData(clientId, year) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.baseUrl}/propane/clients/${clientId}/data/${year}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    const result = await handleApiResponse(response);
    return result;
  }

  /**
   * Get readings for a specific month
   */
  async getMonthReadings(clientId, year, month) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.baseUrl}/propane/clients/${clientId}/readings/${year}/${month}`,
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
   * Save readings for a month
   */
  async saveReadings(clientId, year, month, payload) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.baseUrl}/propane/clients/${clientId}/readings/${year}/${month}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      }
    );
    
    return handleApiResponse(response);
  }

  /**
   * Batch check which months have readings (lightweight - existence check only)
   * Returns map of month (0-11) -> boolean
   */
  async getReadingsExistenceForYear(clientId, year) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.baseUrl}/propane/clients/${clientId}/readings/exists/${year}`,
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

export default new PropaneAPI();
