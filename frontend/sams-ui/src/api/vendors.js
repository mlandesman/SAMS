/**
 * Vendors API Service
 * 
 * Handles communication with the backend for vendor operations
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
 * Get all vendors for a client
 * @param {string} clientId - The client ID
 * @returns {Promise<Object>} Response with vendors data
 */
export async function getVendors(clientId) {
  try {
    console.log(`📋 Fetching vendors for client: ${clientId}`);
    
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/vendors?t=${Date.now()}`, {
      method: 'GET',
      headers,
      credentials: 'include',
      cache: 'no-store',
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Fetched ${result.count} vendors`);
      return result;
    } else {
      console.error('❌ Failed to fetch vendors:', result.error);
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('❌ Error fetching vendors:', error);
    throw error;
  }
}

/**
 * Create a new vendor
 * @param {string} clientId - The client ID
 * @param {Object} vendorData - The vendor data to create
 * @returns {Promise<Object>} Response with created vendor data
 */
export async function createVendor(clientId, vendorData) {
  try {
    console.log(`➕ Creating vendor for client: ${clientId}`, vendorData);
    
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/vendors`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(vendorData)
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Vendor created successfully:', result.data);
      return result;
    } else {
      console.error('❌ Failed to create vendor:', result.error);
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('❌ Error creating vendor:', error);
    throw error;
  }
}

/**
 * Update an existing vendor
 * @param {string} clientId - The client ID
 * @param {string} vendorId - The vendor ID to update
 * @param {Object} updateData - The updated vendor data
 * @returns {Promise<Object>} Response with updated vendor data
 */
export async function updateVendor(clientId, vendorId, updateData) {
  try {
    console.log(`✏️ Updating vendor ${vendorId} for client: ${clientId}`, updateData);
    
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/vendors/${vendorId}`, {
      method: 'PUT',
      headers,
      credentials: 'include',
      body: JSON.stringify(updateData)
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Vendor updated successfully:', result.data);
      return result;
    } else {
      console.error('❌ Failed to update vendor:', result.error);
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('❌ Error updating vendor:', error);
    throw error;
  }
}

/**
 * Delete a vendor
 * @param {string} clientId - The client ID
 * @param {string} vendorId - The vendor ID to delete
 * @returns {Promise<Object>} Response confirming deletion
 */
export async function deleteVendor(clientId, vendorId) {
  try {
    console.log(`🗑️ Deleting vendor ${vendorId} for client: ${clientId}`);
    
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/vendors/${vendorId}`, {
      method: 'DELETE',
      headers,
      credentials: 'include',
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Vendor deleted successfully');
      return result;
    } else {
      console.error('❌ Failed to delete vendor:', result.error);
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('❌ Error deleting vendor:', error);
    throw error;
  }
}
