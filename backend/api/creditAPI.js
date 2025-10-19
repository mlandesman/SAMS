import creditService from '../services/creditService.js';

/**
 * Credit API Helper
 * Provides clean interface to credit balance operations for cross-module usage
 * Used by Water Bills, Special Billings, and other modules that need credit balance access
 * 
 * NOTE: This is an INTERNAL helper that directly calls creditService
 * For external HTTP calls, use the REST endpoints at /api/credit/...
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
      return await creditService.getCreditBalance(clientId, unitId);
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
      return await creditService.updateCreditBalance(clientId, unitId, data.amount, data.transactionId, data.note, data.source);
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
      return await creditService.getCreditHistory(clientId, unitId, limit);
    } catch (error) {
      console.error('Error getting credit history via CreditAPI:', error);
      throw error;
    }
  }
}
