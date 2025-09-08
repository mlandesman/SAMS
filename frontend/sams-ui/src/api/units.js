/**
 * Units API Service
 * 
 * Handles communication with the backend for unit operations
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
 * Get all units for a client
 * @param {string} clientId - The client ID
 * @returns {Promise<Object>} Response with units data
 */
export async function getUnits(clientId) {
  try {
    console.log(`📋 [API] Fetching units for client: ${clientId}`);
    
    const headers = await getAuthHeaders();
    console.log('🔑 [API] Auth headers prepared:', { Authorization: headers.Authorization ? 'Bearer [token]' : 'missing' });
    
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/units`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    
    console.log(`📡 [API] Response status: ${response.status}`);
    
    const result = await response.json();
    console.log('📋 [API] Response body:', result);
    
    if (result.success) {
      console.log(`✅ [API] Fetched ${result.count} units successfully`);
      return result;
    } else {
      console.error('❌ [API] Failed to fetch units:', result.error);
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('❌ Error fetching units:', error);
    throw error;
  }
}

/**
 * Create a new unit
 * @param {string} clientId - The client ID
 * @param {Object} unitData - The unit data to create
 * @returns {Promise<Object>} Response with created unit data
 */
export async function createUnit(clientId, unitData) {
  try {
    console.log(`➕ Creating unit for client: ${clientId}`, unitData);
    
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/units`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(unitData),
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Created unit with ID: ${result.id}`);
      return result;
    } else {
      console.error('❌ Failed to create unit:', result.error);
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('❌ Error creating unit:', error);
    throw error;
  }
}

/**
 * Update an existing unit
 * @param {string} clientId - The client ID
 * @param {string} unitId - The unit ID to update
 * @param {Object} unitData - The updated unit data
 * @returns {Promise<Object>} Response with update confirmation
 */
export async function updateUnit(clientId, unitId, unitData) {
  try {
    console.log(`✏️ Updating unit ${unitId} for client: ${clientId}`, unitData);
    
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/units/${unitId}`, {
      method: 'PUT',
      headers,
      credentials: 'include',
      body: JSON.stringify(unitData),
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Updated unit: ${unitId}`);
      return result;
    } else {
      console.error('❌ Failed to update unit:', result.error);
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('❌ Error updating unit:', error);
    throw error;
  }
}

/**
 * Delete a unit
 * @param {string} clientId - The client ID
 * @param {string} unitId - The unit ID to delete
 * @returns {Promise<Object>} Response with deletion confirmation
 */
export async function deleteUnit(clientId, unitId) {
  try {
    console.log(`🗑️ Deleting unit ${unitId} for client: ${clientId}`);
    
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/units/${unitId}`, {
      method: 'DELETE',
      headers,
      credentials: 'include',
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Deleted unit: ${unitId}`);
      return result;
    } else {
      console.error('❌ Failed to delete unit:', result.error);
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('❌ Error deleting unit:', error);
    throw error;
  }
}
