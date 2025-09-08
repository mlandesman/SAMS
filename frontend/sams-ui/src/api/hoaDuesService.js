// HOA Dues API Service
import { handleApiResponse } from './apiUtils';
import { config } from '../config';
import { databaseFieldMappings } from '../utils/databaseFieldMappings';

/**
 * Record HOA Dues payment and create associated transaction
 * @param {string} clientId - The client ID
 * @param {string} unitId - The unit ID
 * @param {number} year - The year of the payment
 * @param {object} paymentData - Payment details
 * @param {Array} distribution - How the payment should be distributed
 * @returns {Promise<object>} The result of the payment recording
 */
export const recordDuesPayment = async (clientId, unitId, year, paymentData, distribution) => {
  try {
    // Ensure each parameter is properly formatted
    if (!clientId) throw new Error('Client ID is required');
    if (!unitId) throw new Error('Unit ID is required'); 
    if (!year) throw new Error('Year is required');
    if (!paymentData) throw new Error('Payment data is required');
    if (!paymentData.amount && paymentData.amount !== 0) throw new Error('Payment amount is required');
    if (!paymentData.date) throw new Error('Payment date is required');
    
    // Ensure distribution is at least an empty array
    const validDistribution = distribution || [];
    
    // Ensure date is properly formatted for transfer
    const preparedPaymentData = {
      ...paymentData,
      // Ensure date is properly serialized if it's a Date object
      date: paymentData.date instanceof Date 
        ? paymentData.date.toISOString() 
        : paymentData.date
    };
    
    console.log('Prepared payment data for API call:', preparedPaymentData);
    console.log('Full API payload:', {
      clientId,
      unitId,
      year,
      paymentData: preparedPaymentData,
      distributionLength: validDistribution.length,
      distributionSample: validDistribution.length > 0 ? validDistribution[0] : null
    });
    
    // Use the correct backend URL with port 5001 instead of relying on Vite's proxy
    const API_BASE_URL = config.api.baseUrl;
    
    // Get authentication headers
    const { getCurrentUser } = await import('../firebaseClient');
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    // Get Firebase ID token
    const { getAuthInstance } = await import('../firebaseClient');
    const auth = getAuthInstance();
    const token = await auth.currentUser?.getIdToken();
    
    if (!token) {
      throw new Error('Failed to get authentication token');
    }
    
    try {
      // Prepare the request body
      const requestBody = {
        paymentData: preparedPaymentData,
        distribution: validDistribution
      };
      
      console.log('Request body string for debugging:', 
        JSON.stringify(requestBody, (key, value) => {
          // Handle date serialization
          if (value instanceof Date) {
            return value.toISOString();
          }
          return value;
        })
      );
      
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/hoadues/payment/${unitId}/${year}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // Log response status before processing
      console.log(`API response status: ${response.status} ${response.statusText}`);
      
      const result = await handleApiResponse(response);
      console.log('API call successful, received result:', result);
      
      return result;
    } catch (fetchError) {
      // More specific error handling for network issues
      console.error('Network error when calling API:', fetchError);
      
      if (fetchError.message === 'Failed to fetch') {
        throw new Error(`Cannot connect to backend server at ${API_BASE_URL}. Please make sure the backend server is running.`);
      }
      
      throw fetchError;
    }
  } catch (error) {
    console.error('Error recording dues payment:', error);
    // Preserve the original error to maintain stack trace and details
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(`Failed to record dues payment: ${error}`);
    }
  }
};

/**
 * Update credit balance for a unit
 * @param {string} clientId - The client ID
 * @param {string} unitId - The unit ID
 * @param {number} year - The year
 * @param {number} creditBalance - The new credit balance
 * @returns {Promise<object>} The result of the update
 */
export const updateCreditBalance = async (clientId, unitId, year, creditBalance) => {
  try {
    // Use the same API base URL for consistency
    const API_BASE_URL = config.api.baseUrl;
    
    // Get authentication headers
    const { getCurrentUser } = await import('../firebaseClient');
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    // Get Firebase ID token
    const { getAuthInstance } = await import('../firebaseClient');
    const auth = getAuthInstance();
    const token = await auth.currentUser?.getIdToken();
    
    if (!token) {
      throw new Error('Failed to get authentication token');
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/hoadues/credit/${unitId}/${year}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          creditBalance
        }),
      });

      return handleApiResponse(response);
    } catch (fetchError) {
      // More specific error handling for network issues
      console.error('Network error when updating credit balance:', fetchError);
      
      if (fetchError.message === 'Failed to fetch') {
        throw new Error(`Cannot connect to backend server at ${API_BASE_URL}. Please make sure the backend server is running.`);
      }
      
      throw fetchError;
    }
  } catch (error) {
    console.error('Error updating credit balance:', error);
    throw new Error(`Failed to update credit balance: ${error.message}`);
  }
};

/**
 * Get transaction details from a transaction ID
 * @param {string} clientId - The client ID
 * @param {string} transactionId - The transaction ID
 * @returns {Promise<object>} The transaction details
 */
export const getTransactionById = async (clientId, transactionId) => {
  try {
    // Use the same API base URL for consistency
    const API_BASE_URL = config.api.baseUrl;
    
    // Get authentication headers
    const { getCurrentUser } = await import('../firebaseClient');
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    // Get Firebase ID token
    const { getAuthInstance } = await import('../firebaseClient');
    const auth = getAuthInstance();
    const token = await auth.currentUser?.getIdToken();
    
    if (!token) {
      throw new Error('Failed to get authentication token');
    }
    
    // IMPORTANT: We need to use the original clientId case (don't normalize to lowercase)
    // Server expects the exact case for client ID (e.g., "MTC" not "mtc")
    const url = `${API_BASE_URL}/clients/${clientId}/transactions/${transactionId}`;
    
    console.log(`Fetching transaction with ID ${transactionId} for client ${clientId}`);
    console.log(`API URL: ${url}`);
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      console.log(`API Response Status: ${response.status} ${response.statusText}`);
      
      // Special handling for 404 (transaction not found)
      if (response.status === 404) {
        console.warn(`Transaction with ID ${transactionId} not found`);
        return null; // Return null instead of throwing an error
      }
      
      return handleApiResponse(response);
    } catch (fetchError) {
      // More specific error handling for network issues
      console.error('Network error when fetching transaction:', fetchError);
      
      if (fetchError.message === 'Failed to fetch') {
        throw new Error(`Cannot connect to backend server at ${API_BASE_URL}. Please make sure the backend server is running.`);
      }
      
      throw fetchError;
    }
  } catch (error) {
    console.error('Error fetching transaction:', error);
    throw new Error(`Failed to fetch transaction: ${error.message}`);
  }
};
