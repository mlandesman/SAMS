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

  /**
   * Get rolling graph point data for a specific unit (prototype).
   */
  async getSixMonthGraphData(clientId, unitId, options = {}) {
    const token = await this.getAuthToken();
    const params = new URLSearchParams();

    if (options.months) params.set('months', String(options.months));
    if (Number.isFinite(options.asOfYear)) params.set('asOfYear', String(options.asOfYear));
    if (Number.isFinite(options.asOfMonth)) params.set('asOfMonth', String(options.asOfMonth));

    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(
      `${this.baseUrl}/propane/clients/${clientId}/graph/${encodeURIComponent(unitId)}/data${query}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return handleApiResponse(response);
  }

  /**
   * Get rolling graph SVG for a specific unit (prototype).
   */
  async getSixMonthGraphSvg(clientId, unitId, options = {}) {
    const token = await this.getAuthToken();
    const params = new URLSearchParams();

    if (options.months) params.set('months', String(options.months));
    if (Number.isFinite(options.asOfYear)) params.set('asOfYear', String(options.asOfYear));
    if (Number.isFinite(options.asOfMonth)) params.set('asOfMonth', String(options.asOfMonth));

    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(
      `${this.baseUrl}/propane/clients/${clientId}/graph/${encodeURIComponent(unitId)}/svg${query}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Graph SVG request failed (${response.status})`);
    }

    return response.text();
  }
}

export default new PropaneAPI();
