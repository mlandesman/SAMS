import axios from 'axios';
import { tokenManager } from './tokenManager.js';
import { testConfig } from './config.js';

/**
 * Create a configured axios instance for testing
 * @param {string} userId - User ID for authentication (optional, uses default test UID)
 * @returns {Promise<Object>} - Configured axios instance with auth headers
 */
async function createApiClient(userId = null) {
  // Get the final user ID (use default if none provided)
  const finalUserId = userId || tokenManager.getDefaultTestUid();
  
  // Get token for the specified user (or default test user)
  const token = await tokenManager.getToken(finalUserId);

  // Create axios instance with base configuration
  const client = axios.create({
    baseURL: testConfig.API_BASE_URL,
    timeout: testConfig.DEFAULT_TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  // Add request interceptor for debugging and token refresh
  client.interceptors.request.use(
    (config) => {
      if (testConfig.DEBUG_REQUESTS) {
        console.log(`🔵 API Request: ${config.method?.toUpperCase()} ${config.url}`);
        if (config.data) {
          console.log('   Data:', JSON.stringify(config.data, null, 2));
        }
      }
      return config;
    },
    (error) => {
      console.error('❌ Request Error:', error);
      return Promise.reject(error);
    }
  );

  // Add response interceptor for debugging and error handling
  client.interceptors.response.use(
    (response) => {
      if (testConfig.DEBUG_REQUESTS) {
        console.log(`🟢 API Response: ${response.status} ${response.config.url}`);
        console.log('   Data:', JSON.stringify(response.data, null, 2));
      }
      return response;
    },
    async (error) => {
      if (testConfig.DEBUG_REQUESTS) {
        console.log(`🔴 API Error: ${error.response?.status || 'Network Error'} ${error.config?.url}`);
        if (error.response?.data) {
          console.log('   Error Data:', JSON.stringify(error.response.data, null, 2));
        }
      }

      // Handle 401 errors by attempting token refresh
      if (error.response?.status === 401) {
        console.log('🔄 Token might be expired, attempting refresh...');
        try {
          // Clear token cache and get a fresh token
          tokenManager.clearCache();
          const newToken = await tokenManager.getToken(finalUserId);
          
          // Retry the request with the new token
          error.config.headers.Authorization = `Bearer ${newToken}`;
          return client.request(error.config);
        } catch (refreshError) {
          console.error('❌ Token refresh failed:', refreshError);
          throw error; // Return original error if refresh fails
        }
      }

      return Promise.reject(error);
    }
  );

  // Add helper methods to the client
  client.userId = finalUserId;
  client.token = token;
  
  // Helper method to check if backend is running
  client.healthCheck = async () => {
    try {
      const response = await client.get('/system/health');
      return { healthy: true, status: response.status };
    } catch (error) {
      return { 
        healthy: false, 
        error: error.message,
        suggestion: 'Make sure the backend is running on ' + testConfig.API_BASE_URL
      };
    }
  };

  // Helper method to switch users (creates new client with different user)
  client.switchUser = async (newUserId) => {
    return await createApiClient(newUserId);
  };

  return client;
}

/**
 * Create multiple API clients for different users (useful for multi-user tests)
 * @param {Array<string>} userIds - Array of user IDs
 * @returns {Promise<Object>} - Object with user IDs as keys and API clients as values
 */
async function createMultipleApiClients(userIds) {
  const clients = {};
  
  for (const userId of userIds) {
    clients[userId] = await createApiClient(userId);
  }
  
  return clients;
}

/**
 * Quick helper to get a default API client for basic testing
 * @returns {Promise<Object>} - Default API client for test user
 */
async function getDefaultApiClient() {
  return await createApiClient();
}

export {
  createApiClient,
  createMultipleApiClients,
  getDefaultApiClient
};