/**
 * Payment Methods API Service
 * 
 * Handles communication with the backend for payment method operations
 */

import { getCurrentUser, getAuthInstance } from '../firebaseClient';
import { config } from '../config';
const API_BASE_URL = config.api.baseUrl;

/**
 * Get authentication headers with Firebase ID token
 */
async function getAuthHeaders() {
  const auth = getAuthInstance();
  const currentUser = auth.currentUser;
  
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  try {
    const token = await currentUser.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  } catch (error) {
    console.error('Failed to get auth token:', error);
    throw new Error('Authentication failed');
  }
}

/**
 * Get all payment methods for a client
 * @param {string} clientId - The client ID
 * @param {string} authToken - Firebase auth token (optional - will get from context if not provided)
 * @returns {Promise<Object>} Response with payment methods data
 */
export async function getPaymentMethods(clientId, authToken = null) {
  try {
    console.log(`💳 Fetching payment methods for client: ${clientId}`);
    
    // Get auth headers (will use provided token or get from current user)
    const headers = authToken 
      ? {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      : await getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/paymentMethods`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Fetched ${result.count} payment methods`);
      return result;
    } else {
      console.error('❌ Failed to fetch payment methods:', result.error);
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('❌ Error fetching payment methods:', error);
    throw error;
  }
}

/**
 * Create a new payment method
 * @param {string} clientId - The client ID
 * @param {Object} methodData - The payment method data
 * @returns {Promise<Object>} Response with created payment method data
 */
export async function createPaymentMethod(clientId, methodData) {
  try {
    console.log(`💳 Creating payment method for client: ${clientId}`, methodData);
    
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/paymentMethods`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(methodData),
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Payment method created successfully`);
      return result;
    } else {
      console.error('❌ Failed to create payment method:', result.error);
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('❌ Error creating payment method:', error);
    throw error;
  }
}

/**
 * Update an existing payment method
 * @param {string} clientId - The client ID
 * @param {string} methodId - The payment method ID
 * @param {Object} methodData - The updated payment method data
 * @returns {Promise<Object>} Response with updated payment method data
 */
export async function updatePaymentMethod(clientId, methodId, methodData) {
  try {
    console.log(`💳 Updating payment method ${methodId} for client: ${clientId}`, methodData);
    
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/paymentMethods/${methodId}`, {
      method: 'PUT',
      headers,
      credentials: 'include',
      body: JSON.stringify(methodData),
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Payment method updated successfully`);
      return result;
    } else {
      console.error('❌ Failed to update payment method:', result.error);
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('❌ Error updating payment method:', error);
    throw error;
  }
}

/**
 * Delete a payment method
 * @param {string} clientId - The client ID
 * @param {string} methodId - The payment method ID
 * @returns {Promise<Object>} Response with deletion confirmation
 */
export async function deletePaymentMethod(clientId, methodId) {
  try {
    console.log(`💳 Deleting payment method ${methodId} for client: ${clientId}`);
    
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/paymentMethods/${methodId}`, {
      method: 'DELETE',
      headers,
      credentials: 'include',
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Payment method deleted successfully`);
      return result;
    } else {
      console.error('❌ Failed to delete payment method:', result.error);
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('❌ Error deleting payment method:', error);
    throw error;
  }
}
