// Water Bills API Service
import { handleApiResponse } from './apiUtils';
import { config } from '../config';

/**
 * Water Bills API
 * Handles all water billing related API calls
 */
class WaterAPI {
  constructor() {
    this.baseUrl = config.api.baseUrl;                // Legacy endpoints (/api/clients/...)
    this.domainBaseUrl = config.api.domainBaseUrl;    // Clean domain endpoints (/water/...)
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
   * Submit water meter readings
   */
  async submitReadings(clientId, year, month, readings) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.baseUrl}/clients/${clientId}/projects/waterBills/readings`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ year, month, readings })
      }
    );
    
    return handleApiResponse(response);
  }

  /**
   * Get readings for a specific month
   */
  async getMonthReadings(clientId, year, month) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.baseUrl}/clients/${clientId}/projects/waterBills/readings/${year}/${month}`,
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
   * Get all readings for a year
   */
  async getYearReadings(clientId, year) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.baseUrl}/clients/${clientId}/projects/waterBills/readings/${year}`,
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
   * Update readings for a month
   */
  async updateReadings(clientId, year, month, readings) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.baseUrl}/clients/${clientId}/projects/waterBills/readings/${year}/${month}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ readings })
      }
    );
    
    return handleApiResponse(response);
  }

  /**
   * Delete readings for a month
   */
  async deleteReadings(clientId, year, month) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.baseUrl}/clients/${clientId}/projects/waterBills/readings/${year}/${month}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    return handleApiResponse(response);
  }

  /**
   * Get history for display
   */
  async getHistory(clientId, year) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.baseUrl}/clients/${clientId}/projects/waterBills/history/${year}`,
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
   * Get meters for a client
   */
  async getMeters(clientId) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.baseUrl}/clients/${clientId}/projects/waterBills/meters`,
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
   * Initialize meters from client configuration
   */
  async initializeMeters(clientId) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.baseUrl}/clients/${clientId}/projects/waterBills/meters/initialize`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    return handleApiResponse(response);
  }

  /**
   * Get water billing configuration
   */
  async getConfig(clientId) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.domainBaseUrl}/water/clients/${clientId}/config`,
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
   * Update water billing configuration
   */
  async updateConfig(clientId, config) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.baseUrl}/clients/${clientId}/config/waterBilling`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(config)
      }
    );
    
    return handleApiResponse(response);
  }

  /**
   * Get dashboard summary
   */
  async getDashboard(clientId) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.baseUrl}/clients/${clientId}/projects/waterBills/dashboard`,
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
   * Generate bills for a specific month
   */
  async generateBills(clientId, year, month) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.baseUrl}/clients/${clientId}/projects/waterBills/bills/generate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ year, month })
      }
    );
    
    return handleApiResponse(response);
  }

  /**
   * Get bills for a specific month
   */
  async getBills(clientId, year, month, unpaidOnly = false) {
    const token = await this.getAuthToken();
    
    const url = new URL(`${this.baseUrl}/clients/${clientId}/projects/waterBills/bills/${year}/${month}`);
    if (unpaidOnly) {
      url.searchParams.append('unpaidOnly', 'true');
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    return handleApiResponse(response);
  }

  /**
   * Get aggregated water data for a fiscal year
   * This endpoint returns everything: readings, bills, payments, status
   */
  async getAggregatedData(clientId, year) {
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
    
    return handleApiResponse(response);
  }

  /**
   * Generate bills for a specific month (new backend endpoint)
   */
  async generateBillsNew(clientId, year, month, options = {}) {
    const token = await this.getAuthToken();
    
    const requestBody = { year, month };
    
    // Add dueDate if provided in options
    if (options.dueDate) {
      requestBody.dueDate = options.dueDate;
    }
    
    const response = await fetch(
      `${this.domainBaseUrl}/water/clients/${clientId}/bills/generate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      }
    );
    
    return handleApiResponse(response);
  }

  /**
   * Save readings for a month (using domain endpoint - matches PWA implementation)
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
    
    return handleApiResponse(response);
  }

  /**
   * Record a water bill payment
   */
  async recordPayment(clientId, paymentData) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.domainBaseUrl}/water/clients/${clientId}/payments/record`,
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
   * Get unpaid bills summary for payment modal
   */
  async getUnpaidBillsSummary(clientId, unitId) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.domainBaseUrl}/water/clients/${clientId}/bills/unpaid/${unitId}`,
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
   * Get payment history for a unit
   */
  async getPaymentHistory(clientId, unitId, year = null) {
    const token = await this.getAuthToken();
    
    const url = new URL(`${this.domainBaseUrl}/water/clients/${clientId}/payments/history/${unitId}`);
    if (year) {
      url.searchParams.append('year', year.toString());
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    return handleApiResponse(response);
  }

  /**
   * Get readings for a specific month (new backend endpoint)
   */
  async getReadings(clientId, year, month) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.domainBaseUrl}/water/clients/${clientId}/readings/${year}/${month}`,
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
   * Clear water data cache for a client
   */
  async clearCache(clientId) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.domainBaseUrl}/water/clients/${clientId}/cache/clear`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    return handleApiResponse(response);
  }
}

export default new WaterAPI();