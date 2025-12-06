// Propane Tank API Service
import { handleApiResponse } from './apiUtils';
import { config } from '../config';

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
    const { getAuthInstance } = await import('../firebaseClient');
    const auth = getAuthInstance();
    const token = await auth.currentUser?.getIdToken();
    
    if (!token) {
      throw new Error('User not authenticated');
    }
    
    return token;
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
    
    return handleApiResponse(response);
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
    
    return handleApiResponse(response);
  }
}

export default new PropaneAPI();
