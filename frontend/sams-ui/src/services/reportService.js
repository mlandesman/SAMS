/**
 * Report Service
 * Frontend service for interacting with Reports API
 */

import { getAuthInstance } from '../firebaseClient';
import { config } from '../config/index.js';

class ReportService {
  constructor() {
    this.baseURL = config.api.baseURL || 'http://localhost:3001';
  }

  /**
   * Get authentication headers
   */
  async getAuthHeaders() {
    const auth = getAuthInstance();
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const token = await user.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Generate Statement of Account report
   * @param {string} clientId - Client ID
   * @param {object} params - Report parameters
   * @param {string} params.unitId - Unit ID
   * @param {string} params.userId - User ID (for language preference)
   * @param {object} params.dateRange - Date range { start: string, end: string }
   * @returns {Promise<object>} Report generation result
   */
  async generateStatement(clientId, params) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.baseURL}/api/reports/statement/${clientId}/generate`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            unitId: params.unitId,
            userId: params.userId,
            dateRange: params.dateRange,
            options: {
              includeWaterBills: params.options?.includeWaterBills !== false,
              includeHoaDues: params.options?.includeHoaDues !== false
            }
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate statement');
      }

      return await response.json();
    } catch (error) {
      console.error('Error generating statement:', error);
      throw error;
    }
  }

  /**
   * Send Statement of Account via email
   * @param {string} clientId - Client ID
   * @param {object} params - Email parameters
   * @param {string} params.reportId - Report ID
   * @param {string} params.recipientEmail - Recipient email address
   * @param {string} params.unitId - Unit ID
   * @param {string} params.userId - User ID
   * @returns {Promise<object>} Email sending result
   */
  async sendStatementEmail(clientId, params) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.baseURL}/api/reports/statement/${clientId}/email`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            reportId: params.reportId,
            recipientEmail: params.recipientEmail,
            unitId: params.unitId,
            userId: params.userId
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send email');
      }

      return await response.json();
    } catch (error) {
      console.error('Error sending statement email:', error);
      throw error;
    }
  }

  /**
   * Get report preview URL
   * @param {string} clientId - Client ID
   * @param {string} reportId - Report ID
   * @returns {string} Preview URL
   */
  getReportPreviewUrl(clientId, reportId) {
    // TODO: Implement when PDF storage is set up
    return `${this.baseURL}/api/reports/statement/${clientId}/preview/${reportId}`;
  }
}

// Export singleton instance
const reportService = new ReportService();
export default reportService;

