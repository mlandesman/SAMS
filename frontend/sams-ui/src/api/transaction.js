/**
 * API functions for transactions - SECURE IMPLEMENTATION
 * Uses backend API with client access validation
 */

import { getCurrentUser, isAuthenticated, getAuthInstance } from '../firebaseClient';
import { config } from '../config';
// getMexicoDateTime import removed - no longer needed as backend handles timezone conversion

/**
 * Create a new transaction via secure backend API
 * @param {string} clientId - The client ID
 * @param {object} data - The transaction data
 * @returns {Promise<string>} - The transaction ID
 */
export async function createTransaction(clientId, data) {
  try {
    console.log(`🔍 Creating transaction for client ID: "${clientId}" via secure API`);
    
    if (!clientId) {
      throw new Error('Client ID is required but was not provided');
    }
    
    // Check if user is authenticated
    if (!isAuthenticated()) {
      throw new Error('User is not authenticated. Please log in first.');
    }
    
    const auth = getAuthInstance();
    const token = await auth.currentUser?.getIdToken();
    
    if (!token) {
      throw new Error('Unable to get authentication token');
    }

    // Send date string directly - backend handles timezone conversion
    const transactionData = {
      ...data,
      date: data.date // Send date as string, let backend handle timezone conversion
    };

    // Call secure backend API
    const API_BASE_URL = config.api.baseUrl;
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/transactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(transactionData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Enhanced error handling for validation failures
      if (response.status === 400) {
        // Check multiple possible validation error formats
        let validationErrors = null;
        
        // Try different error formats the backend might send
        if (errorData.validationErrors) {
          validationErrors = errorData.validationErrors;
        } else if (errorData.errors) {
          validationErrors = errorData.errors;
        } else if (errorData.error && typeof errorData.error === 'string') {
          // Try to extract errors from string format like "validation failed: [...]"
          const match = errorData.error.match(/\[(.*?)\]/);
          if (match) {
            try {
              validationErrors = JSON.parse(`[${match[1]}]`);
            } catch (e) {
              // If JSON parsing fails, treat as single error
              validationErrors = [errorData.error];
            }
          } else {
            validationErrors = [errorData.error];
          }
        }
        
        if (validationErrors) {
          const validationError = new Error('Transaction validation failed');
          validationError.isValidationError = true;
          validationError.validationErrors = validationErrors;
          validationError.rawErrorData = errorData;
          throw validationError;
        }
      }
      
      // Handle other structured errors
      if (errorData.error) {
        const structuredError = new Error(errorData.error);
        structuredError.rawErrorData = errorData;
        throw structuredError;
      }
      
      // Fallback for unexpected errors
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`✅ Created transaction with ID: ${result.id}`);
    return result.id;
  } catch (error) {
    console.error('❌ Error creating transaction:', error);
    // Don't show generic alert - let components handle error display
    throw error;
  }
}

/**
 * Update a transaction via secure backend API
 * @param {string} clientId - The client ID
 * @param {string} transactionId - The transaction ID
 * @param {object} data - The updated transaction data
 * @returns {Promise<boolean>} - Whether the update was successful
 */
export async function updateTransaction(clientId, transactionId, data) {
  try {
    console.log(`🔍 Updating transaction ${transactionId} for client ID: "${clientId}" via secure API`);
    
    if (!clientId) {
      throw new Error('Client ID is required but was not provided');
    }
    
    if (!transactionId) {
      throw new Error('Transaction ID is required but was not provided');
    }
    
    // Check if user is authenticated
    if (!isAuthenticated()) {
      throw new Error('User is not authenticated. Please log in first.');
    }
    
    const auth = getAuthInstance();
    const token = await auth.currentUser?.getIdToken();
    
    if (!token) {
      throw new Error('Unable to get authentication token');
    }

    // Send date string directly - backend handles timezone conversion
    const transactionData = data.date ? {
      ...data,
      date: data.date // Send date as string, let backend handle timezone conversion
    } : data;

    // Call secure backend API
    const API_BASE_URL = config.api.baseUrl;
    const url = `${API_BASE_URL}/clients/${clientId}/transactions/${transactionId}`;
    
    console.log('🔄 [transaction.js] PUT request to update transaction:', {
      url,
      transactionId,
      method: 'PUT',
      type: transactionData.type,
      amount: transactionData.amount,
      documentsCount: transactionData.documents?.length || 0
    });
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(transactionData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Enhanced error handling for validation failures
      if (response.status === 400 && errorData.validationErrors) {
        // Format validation errors as a structured error
        const validationError = new Error('Transaction validation failed');
        validationError.isValidationError = true;
        validationError.validationErrors = errorData.validationErrors;
        validationError.rawErrorData = errorData;
        throw validationError;
      }
      
      // Handle other structured errors
      if (errorData.error) {
        const structuredError = new Error(errorData.error);
        structuredError.rawErrorData = errorData;
        throw structuredError;
      }
      
      // Fallback for unexpected errors
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`✅ Updated transaction with ID: ${transactionId}`);
    return true;
  } catch (error) {
    console.error('❌ Error updating transaction:', error);
    // Don't show generic alert - let components handle error display
    throw error;
  }
}

/**
 * Delete a transaction
 * @param {string} clientId - The client ID
 * @param {string} transactionId - The transaction ID
 * @returns {Promise<boolean>} - Whether the deletion was successful
 */
export async function deleteTransaction(clientId, transactionId) {
  try {
    console.log(`🚀 [FRONTEND] Attempting to delete transaction via backend API: client=${clientId}, transaction=${transactionId}`);
    
    // Check if user is authenticated
    if (!isAuthenticated()) {
      throw new Error('User is not authenticated. Please log in first.');
    }

    if (!clientId) {
      throw new Error('Client ID is required to delete a transaction');
    }

    if (!transactionId) {
      throw new Error('Transaction ID is required to delete a transaction');
    }

    // Get the auth token for backend API call
    const auth = getAuthInstance();
    const token = await auth.currentUser?.getIdToken();
    
    if (!token) {
      throw new Error('Unable to get authentication token');
    }

    // Call backend API instead of direct Firestore deletion
    const response = await fetch(`${config.api.baseUrl}/clients/${clientId}/transactions/${transactionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`✅ [FRONTEND] Backend deletion successful:`, result);

    return result;
  } catch (error) {
    console.error('❌ Error deleting transaction:', error);
    console.error('Error details:', error.code, error.message);
    
    // Generic user-friendly error message
    const errorMessage = 'Failed to delete transaction. Please ensure you have the necessary permissions and try again.';
    alert(errorMessage);
    
    throw error;
  }
}


/**
 * Fetch vendors for a client via secure backend API
 * @param {string} clientId - The client ID
 * @returns {Promise<Array>} - List of vendors
 */
export async function fetchVendors(clientId) {
  try {
    console.log(`🔍 Fetching vendors for client ID: "${clientId}" via secure API`);
    
    if (!clientId) {
      throw new Error('Client ID is required');
    }
    
    if (!isAuthenticated()) {
      throw new Error('User is not authenticated');
    }
    
    const auth = getAuthInstance();
    const token = await auth.currentUser?.getIdToken();
    
    if (!token) {
      throw new Error('Unable to get authentication token');
    }

    const API_BASE_URL = config.api.baseUrl;
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/vendors`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const vendors = await response.json();
    console.log(`✅ Fetched ${vendors.length} vendors for client ${clientId}`);
    return vendors;
  } catch (error) {
    console.error('❌ Error fetching vendors:', error);
    // Return some default vendors in case of error
    return [
      { id: 'cfe', name: 'CFE (Electric)' },
      { id: 'telmex', name: 'Telmex' },
      { id: 'local-market', name: 'Local Market' }
    ];
  }
}

/**
 * Fetch transactions for a client with optional date filter via secure backend API
 * @param {string} clientId - The client ID
 * @param {Object} filters - Optional filters {startDate, endDate}
 * @returns {Promise<Array>} - Array of transaction objects
 */
export async function fetchTransactions(clientId, filters = {}) {
  try {
    console.log(`🔍 Fetching transactions for client ID: "${clientId}" via secure API`);
    
    if (!clientId) {
      throw new Error('Client ID is required');
    }
    
    if (!isAuthenticated()) {
      throw new Error('User is not authenticated');
    }
    
    const auth = getAuthInstance();
    const token = await auth.currentUser?.getIdToken();
    
    if (!token) {
      throw new Error('Unable to get authentication token');
    }

    // Build query parameters
    const queryParams = new URLSearchParams();
    if (filters.startDate) {
      queryParams.append('startDate', filters.startDate.toISOString());
    }
    if (filters.endDate) {
      queryParams.append('endDate', filters.endDate.toISOString());
    }

    const API_BASE_URL = config.api.baseUrl;
    const url = `${API_BASE_URL}/clients/${clientId}/transactions${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const transactions = await response.json();
    console.log(`✅ Fetched ${transactions.length} transactions for client ${clientId}`);
    return transactions;
  } catch (error) {
    console.error('❌ Error fetching transactions:', error);
    throw error;
  }
}

/**
 * Get a single transaction by ID via secure backend API
 * @param {string} clientId - The client ID
 * @param {string} transactionId - The transaction ID
 * @returns {Promise<Object>} - The transaction object
 */
export async function getTransaction(clientId, transactionId) {
  try {
    console.log(`🔍 Getting transaction ${transactionId} for client ID: "${clientId}" via secure API`);
    
    if (!clientId) {
      throw new Error('Client ID is required');
    }
    
    if (!transactionId) {
      throw new Error('Transaction ID is required');
    }
    
    if (!isAuthenticated()) {
      throw new Error('User is not authenticated');
    }
    
    const auth = getAuthInstance();
    const token = await auth.currentUser?.getIdToken();
    
    if (!token) {
      throw new Error('Unable to get authentication token');
    }

    const API_BASE_URL = config.api.baseUrl;
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/transactions/${transactionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const transaction = await response.json();
    console.log(`✅ Retrieved transaction with ID: ${transactionId}`);
    return transaction;
  } catch (error) {
    console.error('❌ Error getting transaction:', error);
    throw error;
  }
}
