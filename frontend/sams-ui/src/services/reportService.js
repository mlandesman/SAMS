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
    const language = options.language || 'english';
    params.append('language', language);
    if (fiscalYear) {
      params.append('fiscalYear', String(fiscalYear));
    }
    if (options.excludeFutureBills) {
      params.append('excludeFutureBills', 'true');
    }
    // Request both languages when generating for email (optimization: avoid recalculation)
    if (options.generateBothLanguages) {
      params.append('generateBothLanguages', 'true');
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

    // Return the core statement object (html, meta, summary, lineItems, ...)
    // When generateBothLanguages=true, also includes htmlEn, htmlEs, metaEn, metaEs
    return json.data;
  }

  // NOTE: getStatementHtml is deprecated in favor of getStatementData,
  // which returns { html, meta, summary, lineItems } in a single call.

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

  /**
   * Export Statement PDF using pre-generated HTML
   * POST /reports/:clientId/statement/export?format=pdf
   *
   * This endpoint is optimized for interactive UI usage where the HTML
   * has already been generated for preview. It avoids re-fetching data
   * from Firestore and simply converts the provided HTML to PDF.
   *
   * @param {string} clientId
   * @param {object} params
   * @param {string} params.unitId
   * @param {number|null} params.fiscalYear
   * @param {string} params.language
   * @param {string} params.html - Complete HTML document
   * @param {object} [params.meta] - Optional footer metadata
   */
  async exportStatementPdfFromHtml(clientId, params) {
    const headers = await this.getAuthHeaders();

    const query = new URLSearchParams();
    query.append('format', 'pdf');

    const response = await fetch(
      `${this.baseUrl}/reports/${clientId}/statement/export?${query.toString()}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          unitId: params.unitId,
          fiscalYear: params.fiscalYear,
          language: params.language || 'english',
          html: params.html,
          meta: params.meta || {}
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => null);
      throw new Error(
        errorText || `Failed to export statement PDF (status ${response.status})`
      );
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    // Open in a new tab so the browser/OS handles print/save UX
    const newWindow = window.open(url, '_blank');
    if (!newWindow) {
      console.warn('Unable to open PDF window (popup blocked?)');
    }

    // Revoke URL after some time to avoid breaking the viewer immediately
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 60 * 1000);
  }

  /**
   * Export Statement CSV based on server-side statement data
   * POST /reports/:clientId/statement/export?format=csv
   *
   * The backend will recompute statement data and emit a clean CSV with
   * an opening balance row followed by transaction line items.
   *
   * @param {string} clientId
   * @param {object} params
   * @param {string} params.unitId
   * @param {number|null} params.fiscalYear
   * @param {string} params.language
   */
  async exportStatementCsv(clientId, params) {
    const headers = await this.getAuthHeaders();

    const query = new URLSearchParams();
    query.append('format', 'csv');

    const response = await fetch(
      `${this.baseUrl}/reports/${clientId}/statement/export?${query.toString()}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          unitId: params.unitId,
          fiscalYear: params.fiscalYear,
          language: params.language || 'english'
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => null);
      throw new Error(
        errorText || `Failed to export statement CSV (status ${response.status})`
      );
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const yearPart = params.fiscalYear || 'current';
    const unitPart = params.unitId || 'unit';
    a.download = `statement-${clientId}-${unitPart}-${yearPart}-transactions.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  /**
   * Get Budget vs Actual data (JSON) for a client
   * GET /api/clients/:clientId/reports/budget-actual/data
   *
   * @param {string} clientId
   * @param {number|null} fiscalYear - Optional fiscal year (e.g., 2025)
   * @param {string} language - 'english' or 'spanish'
   */
  async getBudgetActualData(clientId, fiscalYear = null, language = 'english') {
    const headers = await this.getAuthHeaders();

    const params = new URLSearchParams();
    params.append('language', language);
    if (fiscalYear) {
      params.append('fiscalYear', String(fiscalYear));
    }

    const response = await fetch(
      `${this.baseUrl}/reports/${clientId}/budget-actual/data?${params.toString()}`,
      {
        method: 'GET',
        headers
      }
    );

    const json = await response.json();
    if (!response.ok || json.success === false) {
      throw new Error(json.error || 'Failed to fetch budget vs actual data');
    }

    // Return the data object (income, expenses, specialAssessments, etc.)
    return json.data;
  }

  /**
   * Get Budget vs Actual HTML for a client
   * GET /api/clients/:clientId/reports/budget-actual/html
   *
   * @param {string} clientId
   * @param {number|null} fiscalYear - Optional fiscal year
   * @param {string} language - 'english' or 'spanish'
   */
  async getBudgetActualHtml(clientId, fiscalYear = null, language = 'english') {
    const headers = await this.getAuthHeaders();

    const params = new URLSearchParams();
    params.append('language', language);
    if (fiscalYear) {
      params.append('fiscalYear', String(fiscalYear));
    }

    const response = await fetch(
      `${this.baseUrl}/reports/${clientId}/budget-actual/html?${params.toString()}`,
      {
        method: 'GET',
        headers
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => null);
      throw new Error(
        errorText || `Failed to fetch budget vs actual HTML (status ${response.status})`
      );
    }

    const html = await response.text();
    return html;
  }

  /**
   * Export Budget vs Actual PDF using pre-generated HTML
   * POST /reports/:clientId/budget-actual/export?format=pdf
   *
   * @param {string} clientId
   * @param {object} params
   * @param {number|null} params.fiscalYear
   * @param {string} params.language
   * @param {string} params.html - Complete HTML document
   * @param {object} [params.meta] - Optional footer metadata
   */
  async exportBudgetActualPdfFromHtml(clientId, params) {
    const headers = await this.getAuthHeaders();

    const query = new URLSearchParams();
    query.append('format', 'pdf');

    const response = await fetch(
      `${this.baseUrl}/reports/${clientId}/budget-actual/export?${query.toString()}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fiscalYear: params.fiscalYear,
          language: params.language || 'english',
          html: params.html,
          meta: params.meta || {}
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => null);
      throw new Error(
        errorText || `Failed to export budget vs actual PDF (status ${response.status})`
      );
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    // Open in a new tab so the browser/OS handles print/save UX
    const newWindow = window.open(url, '_blank');
    if (!newWindow) {
      console.warn('Unable to open PDF window (popup blocked?)');
    }

    // Revoke URL after some time to avoid breaking the viewer immediately
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 60 * 1000);
  }

  /**
   * Export Budget vs Actual CSV based on server-side data
   * POST /reports/:clientId/budget-actual/export?format=csv
   *
   * @param {string} clientId
   * @param {object} params
   * @param {number|null} params.fiscalYear
   * @param {string} params.language
   */
  async exportBudgetActualCsv(clientId, params) {
    const headers = await this.getAuthHeaders();

    const query = new URLSearchParams();
    query.append('format', 'csv');

    const response = await fetch(
      `${this.baseUrl}/reports/${clientId}/budget-actual/export?${query.toString()}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fiscalYear: params.fiscalYear,
          language: params.language || 'english'
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => null);
      throw new Error(
        errorText || `Failed to export budget vs actual CSV (status ${response.status})`
      );
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const yearPart = params.fiscalYear || 'current';
    a.download = `budget-actual-${clientId}-${yearPart}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  /**
   * Get available budget years for a client
   * GET /api/clients/:clientId/reports/budget/years
   *
   * @param {string} clientId
   * @returns {Promise<number[]>} Array of years sorted descending
   */
  async getAvailableBudgetYears(clientId) {
    const headers = await this.getAuthHeaders();

    const response = await fetch(
      `${this.baseUrl}/reports/${clientId}/budget/years`,
      {
        method: 'GET',
        headers
      }
    );

    const json = await response.json();
    if (!response.ok || json.success === false) {
      throw new Error(json.error || 'Failed to fetch available budget years');
    }

    return json.years || [];
  }

  /**
   * Get Budget Report HTML for a client
   * GET /api/clients/:clientId/reports/budget/:year
   *
   * @param {string} clientId
   * @param {number|null} fiscalYear - Fiscal year (optional - uses highest available if not provided)
   * @param {string} language - 'english' or 'spanish'
   */
  async getBudgetReportHtml(clientId, fiscalYear = null, language = 'english') {
    const headers = await this.getAuthHeaders();

    const params = new URLSearchParams();
    params.append('language', language);

    const url = fiscalYear 
      ? `${this.baseUrl}/reports/${clientId}/budget/${fiscalYear}?${params.toString()}`
      : `${this.baseUrl}/reports/${clientId}/budget/0?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers
    });

    const json = await response.json();
    if (!response.ok || json.success === false) {
      throw new Error(json.error || 'Failed to fetch budget report HTML');
    }

    return json.html;
  }

  /**
   * Export Budget Report PDF using pre-generated HTML
   * POST /reports/:clientId/budget/:year/pdf
   *
   * @param {string} clientId
   * @param {object} params
   * @param {number|null} params.fiscalYear - Optional, uses highest available if not provided
   * @param {string} params.language
   * @param {string} params.html - Complete HTML document
   */
  async exportBudgetReportPdf(clientId, params) {
    const headers = await this.getAuthHeaders();

    // Use 0 as placeholder if fiscalYear not provided - backend will use highest available
    const yearParam = params.fiscalYear || 0;

    const response = await fetch(
      `${this.baseUrl}/reports/${clientId}/budget/${yearParam}/pdf`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fiscalYear: params.fiscalYear || null,
          language: params.language || 'english',
          html: params.html
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => null);
      throw new Error(
        errorText || `Failed to export budget report PDF (status ${response.status})`
      );
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    // Open in a new tab so the browser/OS handles print/save UX
    const newWindow = window.open(url, '_blank');
    if (!newWindow) {
      console.warn('Unable to open PDF window (popup blocked?)');
    }

    // Revoke URL after some time to avoid breaking the viewer immediately
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 60 * 1000);
  }

  /**
   * Export Transactions PDF from pre-generated HTML
   * POST /reports/:clientId/transactions/export?format=pdf
   *
   * @param {string} clientId
   * @param {object} params
   * @param {string} params.html - Complete HTML document
   * @param {object} [params.filterSummary] - Optional filter summary metadata
   * @param {string} [params.clientName] - Client name for filename
   */
  async exportTransactionsPdfFromHtml(clientId, params) {
    const headers = await this.getAuthHeaders();

    const query = new URLSearchParams();
    query.append('format', 'pdf');

    const response = await fetch(
      `${this.baseUrl}/reports/${clientId}/transactions/export?${query.toString()}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          html: params.html,
          filterSummary: params.filterSummary || {}
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => null);
      throw new Error(
        errorText || `Failed to export transactions PDF (status ${response.status})`
      );
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    // Generate meaningful filename
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const clientName = params.clientName || clientId;
    
    // Build filename from filter summary
    let filenameParts = ['Transaction Report', clientName];
    
    if (params.filterSummary) {
      const { dateRange, advancedFilters } = params.filterSummary;
      
      // Add date range to filename
      if (dateRange && dateRange !== 'all') {
        if (typeof dateRange === 'object' && dateRange.startDate && dateRange.endDate) {
          const start = new Date(dateRange.startDate).toISOString().split('T')[0];
          const end = new Date(dateRange.endDate).toISOString().split('T')[0];
          filenameParts.push(`${start}_to_${end}`);
        } else {
          filenameParts.push(String(dateRange));
        }
      }
      
      // Add unit filter to filename if present
      if (advancedFilters?.unit && advancedFilters.unit.length > 0) {
        const units = Array.isArray(advancedFilters.unit) 
          ? advancedFilters.unit.join('-') 
          : String(advancedFilters.unit);
        filenameParts.push(`Unit-${units}`);
      }
      
      // Add vendor filter if present
      if (advancedFilters?.vendor && advancedFilters.vendor.length > 0) {
        const vendors = Array.isArray(advancedFilters.vendor)
          ? advancedFilters.vendor.join('-')
          : String(advancedFilters.vendor);
        // Sanitize vendor names for filename (remove special chars)
        const sanitized = vendors.replace(/[^a-zA-Z0-9-]/g, '-').substring(0, 30);
        filenameParts.push(`Vendor-${sanitized}`);
      }
    }
    
    // Add date to filename
    filenameParts.push(dateStr);
    
    // Create filename (sanitize and join)
    const filename = filenameParts
      .filter(part => part && part.trim())
      .join('_')
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 200) + '.pdf';

    // Create download link with proper filename
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    
    // Trigger download with proper filename
    a.click();
    
    // Also open in new tab for viewing/printing
    const newWindow = window.open(url, '_blank');
    if (!newWindow) {
      console.warn('Unable to open PDF window (popup blocked?)');
    }

    // Cleanup
    document.body.removeChild(a);
    
    // Revoke URL after some time to avoid breaking the viewer immediately
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 60 * 1000);
  }
}

// Export singleton instance
const reportService = new ReportService();
export default reportService;

