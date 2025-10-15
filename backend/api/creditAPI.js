import axios from 'axios';

/**
 * Credit API Helper
 * Provides clean interface to the /credit endpoint for cross-module usage
 * Used by Water Bills, Special Billings, and other modules that need credit balance access
 */

export class CreditAPI {
  
  /**
   * Get current credit balance for a unit
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier
   * @returns {Promise<Object>} Credit balance data
   */
  static async getCreditBalance(clientId, unitId) {
    try {
      // Use internal API call to /credit endpoint
      const response = await axios.get(`/credit/${clientId}/${unitId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting credit balance via CreditAPI:', error);
      throw error;
    }
  }
  
  /**
   * Update credit balance for a unit
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier
   * @param {Object} data - Update data
   * @param {number} data.amount - Amount to add (positive) or subtract (negative) in cents
   * @param {string} data.transactionId - Transaction identifier for audit trail
   * @param {string} data.note - Description of the change
   * @param {string} data.source - Source module (e.g., 'waterBills', 'hoaDues', 'admin')
   * @returns {Promise<Object>} Update result
   */
  static async updateCreditBalance(clientId, unitId, data) {
    try {
      const response = await axios.post(`/credit/${clientId}/${unitId}`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating credit balance via CreditAPI:', error);
      throw error;
    }
  }
  
  /**
   * Get credit history for a unit
   * @param {string} clientId - Client identifier
   * @param {string} unitId - Unit identifier
   * @param {number} limit - Maximum number of history entries to return (default 50)
   * @returns {Promise<Object>} Credit history data
   */
  static async getCreditHistory(clientId, unitId, limit = 50) {
    try {
      const response = await axios.get(`/credit/${clientId}/${unitId}/history?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Error getting credit history via CreditAPI:', error);
      throw error;
    }
  }
}
