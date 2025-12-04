/**
 * Budget API Service
 * 
 * Handles communication with the backend for budget operations
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
 * Fetch all budgets for a fiscal year
 * @param {string} clientId - The client ID
 * @param {number} year - The fiscal year
 * @returns {Promise<Object>} Response with budgets data
 */
export async function fetchBudgetsByYear(clientId, year) {
  try {
    console.log(`💰 Fetching budgets for client: ${clientId}, year: ${year}`);
    
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}/budgets/clients/${clientId}/${year}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Fetched ${result.count} budgets`);
      return result;
    } else {
      console.error('❌ Failed to fetch budgets:', result.error);
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('❌ Error fetching budgets:', error);
    throw error;
  }
}

/**
 * Save (create or update) a budget entry
 * @param {string} clientId - The client ID
 * @param {string} categoryId - The category ID
 * @param {number} year - The fiscal year
 * @param {number} amount - The budget amount in centavos (integer)
 * @returns {Promise<Object>} Response with saved budget data
 */
export async function saveBudget(clientId, categoryId, year, amount) {
  try {
    console.log(`💰 Saving budget for client: ${clientId}, category: ${categoryId}, year: ${year}, amount: ${amount} centavos`);
    
    // Validate amount is integer (centavos)
    if (!Number.isInteger(amount) || amount < 0) {
      throw new Error('Amount must be a non-negative integer (centavos)');
    }
    
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}/budgets/clients/${clientId}/categories/${categoryId}/budget/${year}`, {
      method: 'PUT',
      headers,
      credentials: 'include',
      body: JSON.stringify({ amount }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Budget saved successfully`);
      return result;
    } else {
      console.error('❌ Failed to save budget:', result.error);
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('❌ Error saving budget:', error);
    throw error;
  }
}

/**
 * Delete a budget entry
 * @param {string} clientId - The client ID
 * @param {string} categoryId - The category ID
 * @param {number} year - The fiscal year
 * @returns {Promise<Object>} Response with deletion confirmation
 */
export async function deleteBudget(clientId, categoryId, year) {
  try {
    console.log(`💰 Deleting budget for client: ${clientId}, category: ${categoryId}, year: ${year}`);
    
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}/budgets/clients/${clientId}/categories/${categoryId}/budget/${year}`, {
      method: 'DELETE',
      headers,
      credentials: 'include',
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Budget deleted successfully`);
      return result;
    } else {
      console.error('❌ Failed to delete budget:', result.error);
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('❌ Error deleting budget:', error);
    throw error;
  }
}

