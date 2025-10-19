// Water Bills API Service
import { handleApiResponse } from './apiUtils';
import { config } from '../config';

/**
 * Water Bills API
 * Handles all water billing related API calls
 */
class WaterAPI {
  constructor() {
    this.baseUrl = config.api.baseUrl;                // Unified baseURL configuration
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
      `${this.baseUrl}/water/clients/${clientId}/readings/${year}/${month}`,
      {
        method: 'POST',
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
   * Get readings for a specific month
   */
  async getMonthReadings(clientId, year, month) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.baseUrl}/water/clients/${clientId}/readings/${year}/${month}`,
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
      `${this.baseUrl}/water/clients/${clientId}/readings/${year}`,
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
      `${this.baseUrl}/water/clients/${clientId}/readings/${year}/${month}`,
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
      `${this.baseUrl}/water/clients/${clientId}/readings/${year}/${month}`,
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
      `${this.baseUrl}/water/clients/${clientId}/history/${year}`,
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
      `${this.baseUrl}/water/clients/${clientId}/meters`,
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
      `${this.baseUrl}/water/clients/${clientId}/meters/initialize`,
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
      `${this.baseUrl}/water/clients/${clientId}/config`,
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
      `${this.baseUrl}/water/clients/${clientId}/config`,
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
      `${this.baseUrl}/water/clients/${clientId}/dashboard`,
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
      `${this.baseUrl}/water/clients/${clientId}/bills/generate`,
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
    
    const url = new URL(`${this.baseUrl}/water/clients/${clientId}/bills/${year}/${month}`);
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
   * TASK 2: Uses new fast-read endpoint with timestamp-based cache validation
   * This endpoint returns everything: readings, bills, payments, status
   * Cache is validated by comparing timestamps, not TTL expiration
   */
  async getAggregatedData(clientId, year) {
    const cacheKey = `water_bills_${clientId}_${year}`;
    
    // STEP 1: Check sessionStorage cache
    let cachedData = null;
    let cachedTimestamp = null;
    
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        cachedData = parsed.data;
        cachedTimestamp = parsed.calculationTimestamp; // From aggregatedData metadata
        console.log('💧 WaterAPI found cached data from:', new Date(cachedTimestamp));
      }
    } catch (error) {
      console.error('💧 WaterAPI cache read error:', error);
    }
    
    // STEP 2: Lightweight timestamp check (not full data)
    const token = await this.getAuthToken();
    const timestampResponse = await fetch(
      `${this.baseUrl}/water/clients/${clientId}/lastUpdated?year=${year}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    const timestampResult = await handleApiResponse(timestampResponse);
    const serverTimestamp = timestampResult?.lastUpdated;
    
    console.log('💧 WaterAPI timestamp check:', {
      serverTimestamp,
      cachedTimestamp,
      isCacheFresh: cachedTimestamp && serverTimestamp && cachedTimestamp >= serverTimestamp
    });
    
    // STEP 3: Compare timestamps - use cache only if still fresh
    if (cachedData && cachedTimestamp && serverTimestamp) {
      if (cachedTimestamp >= serverTimestamp) {
        // Cache is fresh - use it (NO API call for full data!)
        console.log('✅ WaterAPI cache is fresh, using cached data (no full data fetch)');
        return { data: cachedData };
      } else {
        console.log('🔄 WaterAPI cache stale, fetching fresh data');
      }
    }
    
    // STEP 4: Cache miss or stale - fetch full data
    const response = await fetch(
      `${this.baseUrl}/water/clients/${clientId}/aggregatedData?year=${year}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    const result = await handleApiResponse(response);
    
    // STEP 5: Cache the fresh server result
    if (result?.data) {
      try {
        const cacheData = { 
          data: result.data, 
          calculationTimestamp: serverTimestamp,
          cachedAt: Date.now()
        };
        sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
        console.log('💧 WaterAPI saved fresh data to cache');
      } catch (error) {
        console.error('💧 WaterAPI cache write error:', error);
      }
    }
    
    return result;
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
      `${this.baseUrl}/water/clients/${clientId}/bills/generate`,
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
      `${this.baseUrl}/water/clients/${clientId}/readings/${year}/${month}`,
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
   * Preview payment distribution before recording
   */
  async previewPayment(clientId, paymentData) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.baseUrl}/water/clients/${clientId}/payments/preview`,
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
   * Record a water bill payment
   */
  async recordPayment(clientId, paymentData) {
    const token = await this.getAuthToken();
    
    const response = await fetch(
      `${this.baseUrl}/water/clients/${clientId}/payments/record`,
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
      `${this.baseUrl}/water/clients/${clientId}/bills/unpaid/${unitId}`,
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
    
    const url = new URL(`${this.baseUrl}/water/clients/${clientId}/payments/history/${unitId}`);
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
      `${this.baseUrl}/water/clients/${clientId}/readings/${year}/${month}`,
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
      `${this.baseUrl}/water/clients/${clientId}/cache/clear`,
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
   * Clear aggregatedData document and timestamp to force rebuild
   * @param {string} clientId - Client ID
   * @param {number} year - Fiscal year (optional)
   * @param {boolean} rebuild - If true, triggers immediate rebuild after clearing
   */
  async clearAggregatedData(clientId, year = null, rebuild = true) {
    const token = await this.getAuthToken();
    
    let url = `${this.baseUrl}/water/clients/${clientId}/aggregatedData/clear`;
    const params = [];
    if (year) params.push(`year=${year}`);
    if (rebuild) params.push(`rebuild=true`);
    if (params.length > 0) url += `?${params.join('&')}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    return handleApiResponse(response);
  }
}

export default new WaterAPI();