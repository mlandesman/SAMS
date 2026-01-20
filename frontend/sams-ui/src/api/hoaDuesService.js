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
      
      const response = await fetch(`${API_BASE_URL}/hoadues/${clientId}/payment/${unitId}/${year}`, {
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
 * @param {string} notes - User notes explaining the change
 * @param {string} [entryDate] - Optional date for the history entry (YYYY-MM-DD format)
 * @returns {Promise<object>} The result of the update
 */
export const updateCreditBalance = async (clientId, unitId, year, creditBalance, notes, entryDate) => {
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
      const requestBody = {
        creditBalance,
        notes,
        source: 'admin'
      };
      
      // Add entryDate if provided
      if (entryDate) {
        requestBody.entryDate = entryDate;
      }
      
      const response = await fetch(`${API_BASE_URL}/hoadues/${clientId}/credit/${unitId}/${year}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
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

/**
 * Delete a credit history entry by entry ID
 * @param {string} clientId - The client ID
 * @param {string} unitId - The unit ID
 * @param {string} entryId - The entry ID to delete
 * @returns {Promise<object>} Delete result
 */
export const deleteCreditHistoryEntry = async (clientId, unitId, entryId) => {
  try {
    const API_BASE_URL = config.api.baseUrl;
    
    const { getCurrentUser } = await import('../firebaseClient');
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const { getAuthInstance } = await import('../firebaseClient');
    const auth = getAuthInstance();
    const token = await auth.currentUser?.getIdToken();
    
    if (!token) {
      throw new Error('Failed to get authentication token');
    }
    
    const response = await fetch(`${API_BASE_URL}/credit/${clientId}/${unitId}/history/entry/${entryId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    return handleApiResponse(response);
  } catch (error) {
    console.error('Error deleting credit history entry:', error);
    throw new Error(`Failed to delete credit history entry: ${error.message}`);
  }
};

/**
 * Add a credit history entry directly (for Add/Remove operations)
 * This bypasses the balance calculation and directly adds the specified amount
 * @param {string} clientId - The client ID
 * @param {string} unitId - The unit ID
 * @param {number} amount - Amount in pesos (positive for add, negative for remove)
 * @param {string} date - Date for the entry (ISO string)
 * @param {string} notes - Notes explaining the entry
 * @param {string} [source='admin'] - Source of the entry
 * @returns {Promise<object>} Add result
 */
export const addCreditHistoryEntry = async (clientId, unitId, amount, date, notes, source = 'admin') => {
  try {
    const API_BASE_URL = config.api.baseUrl;
    
    const { getCurrentUser } = await import('../firebaseClient');
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const { getAuthInstance } = await import('../firebaseClient');
    const auth = getAuthInstance();
    const token = await auth.currentUser?.getIdToken();
    
    if (!token) {
      throw new Error('Failed to get authentication token');
    }
    
    // Convert amount from pesos to centavos
    const { pesosToCentavos } = await import('../utils/currencyUtils');
    const amountCentavos = pesosToCentavos(amount);
    
    const response = await fetch(`${API_BASE_URL}/credit/${clientId}/${unitId}/history`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: amountCentavos,
        date: date,
        transactionId: null, // Admin entries don't have transaction IDs
        note: notes,
        source: source
      })
    });

    return handleApiResponse(response);
  } catch (error) {
    console.error('Error adding credit history entry:', error);
    throw new Error(`Failed to add credit history entry: ${error.message}`);
  }
};

/**
 * Update a credit history entry (edit date, amount, notes, source)
 * @param {string} clientId - The client ID
 * @param {string} unitId - The unit ID
 * @param {string} entryId - The entry ID to update
 * @param {Object} updates - Fields to update
 * @param {string} [updates.date] - New date (ISO string YYYY-MM-DD)
 * @param {number} [updates.amount] - New amount in pesos
 * @param {string} [updates.notes] - New notes
 * @param {string} [updates.source] - New source
 * @returns {Promise<object>} Update result
 */
export const updateCreditHistoryEntry = async (clientId, unitId, entryId, updates) => {
  try {
    const API_BASE_URL = config.api.baseUrl;
    
    const { getCurrentUser } = await import('../firebaseClient');
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const { getAuthInstance } = await import('../firebaseClient');
    const auth = getAuthInstance();
    const token = await auth.currentUser?.getIdToken();
    
    if (!token) {
      throw new Error('Failed to get authentication token');
    }
    
    // Convert amount from pesos to centavos if provided
    const requestBody = { ...updates };
    if (updates.amount !== undefined) {
      const { pesosToCentavos } = await import('../utils/currencyUtils');
      requestBody.amount = pesosToCentavos(updates.amount);
    }
    
    const response = await fetch(`${API_BASE_URL}/credit/${clientId}/${unitId}/history/entry/${entryId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    return handleApiResponse(response);
  } catch (error) {
    console.error('Error updating credit history entry:', error);
    throw new Error(`Failed to update credit history entry: ${error.message}`);
  }
};
