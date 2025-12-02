/**
 * Report Service
 * Frontend service for interacting with Reports API
 */

import { getAuthInstance } from '../firebaseClient';
import { config } from '../config/index.js';

class ReportService {
  constructor() {
    // Unified base URL (no /api suffix) - see config/index.js
    this.baseUrl = config.api.baseUrl;
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
   * Generate Statement of Account report (legacy API)
   * NOTE: Current statement implementation uses /api/clients/:clientId/reports/statement/*
   * endpoints instead of this legacy pattern. This method is retained for
   * backwards compatibility but is not used by the new Statement UI.
   *
   * @deprecated Prefer getStatementData/getStatementHtml/downloadStatementPdf
   */
  async generateStatement(clientId, params) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.baseUrl}/api/reports/statement/${clientId}/generate`,
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
        `${this.baseUrl}/api/reports/statement/${clientId}/email`,
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

  /**
   * Get Statement data (JSON) for a unit
   * GET /api/clients/:clientId/reports/statement/data
   *
   * @param {string} clientId
   * @param {string} unitId
   * @param {number|null} fiscalYear - Optional fiscal year (e.g., 2026)
   * @param {object} options - { excludeFutureBills?: boolean }
   */
  async getStatementData(clientId, unitId, fiscalYear = null, options = {}) {
    const headers = await this.getAuthHeaders();

    const params = new URLSearchParams();
    params.append('unitId', unitId);
    if (fiscalYear) {
      params.append('fiscalYear', String(fiscalYear));
    }
    if (options.excludeFutureBills) {
      params.append('excludeFutureBills', 'true');
    }

    const response = await fetch(
      `${this.baseUrl}/reports/${clientId}/statement/data?${params.toString()}`,
      {
        method: 'GET',
        headers
      }
    );

    const json = await response.json();
    if (!response.ok || json.success === false) {
      throw new Error(json.error || 'Failed to fetch statement data');
    }

    return json;
  }

  /**
   * Get Statement HTML preview for a unit
   * GET /api/clients/:clientId/reports/statement/html
   *
   * @param {string} clientId
   * @param {string} unitId
   * @param {string} language - 'english' or 'spanish'
   * @param {number|null} fiscalYear - Optional fiscal year
   * @param {object} options - { excludeFutureBills?: boolean }
   * @returns {Promise<string>} HTML string
   */
  async getStatementHtml(
    clientId,
    unitId,
    language = 'english',
    fiscalYear = null,
    options = {}
  ) {
    const headers = await this.getAuthHeaders();

    const params = new URLSearchParams();
    params.append('unitId', unitId);
    params.append('language', language);
    if (fiscalYear) {
      params.append('fiscalYear', String(fiscalYear));
    }
    if (options.excludeFutureBills) {
      params.append('excludeFutureBills', 'true');
    }

    const response = await fetch(
      `${this.baseUrl}/reports/${clientId}/statement/html?${params.toString()}`,
      {
        method: 'GET',
        headers
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => null);
      throw new Error(
        errorText || `Failed to generate statement HTML (status ${response.status})`
      );
    }

    return response.text();
  }

  /**
   * Download Statement PDF for a unit
   * GET /api/clients/:clientId/reports/statement/pdf
   *
   * @param {string} clientId
   * @param {string} unitId
   * @param {string} language - 'english' or 'spanish'
   * @param {number|null} fiscalYear - Optional fiscal year
   * @param {object} options - { excludeFutureBills?: boolean }
   */
  async downloadStatementPdf(
    clientId,
    unitId,
    language = 'english',
    fiscalYear = null,
    options = {}
  ) {
    const headers = await this.getAuthHeaders();

    const params = new URLSearchParams();
    params.append('unitId', unitId);
    params.append('language', language);
    if (fiscalYear) {
      params.append('fiscalYear', String(fiscalYear));
    }
    if (options.excludeFutureBills) {
      params.append('excludeFutureBills', 'true');
    }

    const response = await fetch(
      `${this.baseUrl}/reports/${clientId}/statement/pdf?${params.toString()}`,
      {
        method: 'GET',
        headers
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => null);
      throw new Error(
        errorText || `Failed to download statement PDF (status ${response.status})`
      );
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const yearPart = fiscalYear || 'current';
    a.download = `statement-${clientId}-${unitId}-${yearPart}-${language}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}

// Export singleton instance
const reportService = new ReportService();
export default reportService;

