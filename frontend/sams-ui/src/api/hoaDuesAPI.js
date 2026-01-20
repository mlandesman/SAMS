// HOA Dues API Service
import { handleApiResponse } from './apiUtils';
import { config } from '../config';

/**
 * HOA Dues API
 * Handles all HOA Dues related API calls
 * Pattern copied from waterAPI.js for consistency
 */
class HOADuesAPI {
  constructor() {
    this.baseUrl = config.api.baseUrl;  // Unified baseURL configuration
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
   * Get all dues data for a specific fiscal year
   * This fetches complete HOA dues data for all units
   * 
   * @param {string} clientId - Client ID
   * @param {number} year - Fiscal year
   * @returns {Promise<object>} Dues data for all units (amounts in pesos)
   */
  async getDuesForYear(clientId, year) {
    const token = await this.getAuthToken();
    
    console.log(`💰 HOADuesAPI fetching dues for ${clientId} year ${year}`);
    
    // Add cache-busting parameter to ensure fresh data after payments
    const cacheBuster = `_t=${Date.now()}`;
    const response = await fetch(
      `${this.baseUrl}/hoadues/${clientId}/year/${year}?${cacheBuster}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
          // Removed Cache-Control and Pragma headers - they cause CORS preflight issues
          // Cache-busting query parameter (_t=timestamp) is sufficient for fresh data
        }
      }
    );
    
    const result = await handleApiResponse(response);
    console.log(`✅ HOADuesAPI received dues data for ${Object.keys(result || {}).length} units`);
    
    return result;
  }

  /**
   * Preview payment distribution before recording
   * 
   * @param {string} clientId - Client ID
   * @param {object} paymentData - Payment preview data
   * @returns {Promise<object>} Payment preview (amounts in pesos)
   */
  async previewPayment(clientId, paymentData) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.baseUrl}/hoadues/${clientId}/payment/preview`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(paymentData)
      }
    );
    
    return handleApiResponse(response);
  }

  /**
   * Record a HOA dues payment
   * 
   * @param {string} clientId - Client ID
   * @param {object} paymentData - Payment data (amounts in pesos)
   * @returns {Promise<object>} Payment result
   */
  async recordPayment(clientId, paymentData) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.baseUrl}/hoadues/${clientId}/payment/record`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(paymentData)
      }
    );
    
    return handleApiResponse(response);
  }

  /**
   * Get dues data for a specific unit and year
   * 
   * @param {string} clientId - Client ID
   * @param {string} unitId - Unit ID
   * @param {number} year - Fiscal year
   * @returns {Promise<object>} Unit dues data (amounts in pesos)
   */
  async getUnitDues(clientId, unitId, year) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.baseUrl}/hoadues/${clientId}/unit/${unitId}/${year}`,
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
   * Update credit balance for a unit
   * 
   * @param {string} clientId - Client ID
   * @param {string} unitId - Unit ID
   * @param {number} year - Fiscal year
   * @param {number} creditBalance - New credit balance (in pesos)
   * @param {string} notes - Notes explaining the change
   * @returns {Promise<object>} Update result
   */
  async updateCreditBalance(clientId, unitId, year, creditBalance, notes) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.baseUrl}/hoadues/${clientId}/credit/${unitId}/${year}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ creditBalance, notes })
      }
    );
    
    return handleApiResponse(response);
  }
}

export default new HOADuesAPI();

