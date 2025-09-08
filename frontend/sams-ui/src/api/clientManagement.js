/**
 * Client Management API Client
 * SuperAdmin-only API calls for client CRUD operations
 * 
 * Phase 12: Client Management CRUD Prerequisites
 * Implementation Date: June 26, 2025
 */

import { getIdToken } from 'firebase/auth';
import { auth } from '../firebaseClient';
import { config } from '../config';

const API_BASE_URL = `${config.api.baseUrl}/client-management`;

/**
 * Get authorization headers with Firebase ID token
 */
const getAuthHeaders = async () => {
  try {
    const token = await getIdToken(auth.currentUser);
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  } catch (error) {
    console.error('Failed to get auth token:', error);
    throw new Error('Authentication failed');
  }
};

/**
 * Handle API response and errors
 */
const handleResponse = async (response) => {
  const contentType = response.headers.get('content-type');
  
  if (contentType && contentType.includes('application/json')) {
    const data = await response.json();
    
    if (!response.ok) {
      // Handle specific error cases
      if (response.status === 403) {
        throw new Error('Access denied. SuperAdmin privileges required.');
      } else if (response.status === 501) {
        // Feature not implemented (like delete)
        return data; // Return the response as-is for caller to handle
      } else {
        throw new Error(data.message || data.error || `HTTP ${response.status}`);
      }
    }
    
    return data;
  } else {
    throw new Error(`Unexpected response format: ${response.status}`);
  }
};

/**
 * Get all clients (SuperAdmin only)
 * @returns {Promise<Object>} Response with clients list
 */
export const getClientsApi = async () => {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch(API_BASE_URL, {
      method: 'GET',
      headers
    });
    
    return await handleResponse(response);
  } catch (error) {
    console.error('Failed to fetch clients:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to fetch clients' 
    };
  }
};

/**
 * Get specific client by ID (SuperAdmin only)
 * @param {string} clientId - Client ID
 * @returns {Promise<Object>} Response with client data
 */
export const getClientApi = async (clientId) => {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}/${clientId}`, {
      method: 'GET',
      headers
    });
    
    return await handleResponse(response);
  } catch (error) {
    console.error(`Failed to fetch client ${clientId}:`, error);
    return { 
      success: false, 
      error: error.message || 'Failed to fetch client' 
    };
  }
};

/**
 * Create new client (SuperAdmin only)
 * @param {Object} clientData - Client data to create
 * @returns {Promise<Object>} Response with created client
 */
export const createClientApi = async (clientData) => {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(clientData)
    });
    
    return await handleResponse(response);
  } catch (error) {
    console.error('Failed to create client:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to create client' 
    };
  }
};

/**
 * Update existing client (SuperAdmin only)
 * @param {string} clientId - Client ID
 * @param {Object} updates - Updates to apply
 * @returns {Promise<Object>} Response with updated client
 */
export const updateClientApi = async (clientId, updates) => {
  try {
    console.log(`🔍 [CLIENT-API] Updating client ${clientId} with data:`, {
      hasBasicInfo: !!updates.basicInfo,
      fullName: updates.basicInfo?.fullName,
      clientType: updates.basicInfo?.clientType,
      status: updates.basicInfo?.status,
      hasBranding: !!updates.branding,
      hasConfiguration: !!updates.configuration,
      timezone: updates.configuration?.timezone,
      currency: updates.configuration?.currency,
      language: updates.configuration?.language,
      updateSize: JSON.stringify(updates).length
    });
    
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}/${clientId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates)
    });
    
    // Enhanced error handling for validation failures
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`❌ [CLIENT-API] Update failed (${response.status}):`, {
        clientId,
        status: response.status,
        statusText: response.statusText,
        errorData,
        requestData: updates
      });
      
      if (response.status === 400 && errorData.errors) {
        throw new Error(`Validation failed: ${errorData.errors.join(', ')}`);
      }
      
      throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
    }
    
    return await handleResponse(response);
  } catch (error) {
    console.error(`❌ [CLIENT-API] Failed to update client ${clientId}:`, error);
    return { 
      success: false, 
      error: error.message || 'Failed to update client' 
    };
  }
};

/**
 * Delete client (SuperAdmin only) - Returns "Feature Coming Soon"
 * @param {string} clientId - Client ID
 * @returns {Promise<Object>} Response indicating feature status
 */
export const deleteClientApi = async (clientId) => {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}/${clientId}`, {
      method: 'DELETE',
      headers
    });
    
    // This will return a 501 response for "Feature Coming Soon"
    return await handleResponse(response);
  } catch (error) {
    console.error(`Failed to delete client ${clientId}:`, error);
    return { 
      success: false, 
      error: error.message || 'Failed to delete client' 
    };
  }
};

/**
 * Upload client logo or icon (SuperAdmin only)
 * @param {string} clientId - Client ID
 * @param {File} imageFile - Image file to upload
 * @param {string} type - Type of image ('logo' or 'icon')
 * @returns {Promise<Object>} Response with upload result
 */
export const uploadClientLogoApi = async (clientId, imageFile, type = 'logo') => {
  try {
    const token = await getIdToken(auth.currentUser);
    
    const formData = new FormData();
    formData.append(type, imageFile);
    
    const endpoint = type === 'icon' ? 'icon' : 'logo';
    const response = await fetch(`${API_BASE_URL}/${clientId}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
        // Don't set Content-Type for FormData - browser will set it with boundary
      },
      body: formData
    });
    
    return await handleResponse(response);
  } catch (error) {
    console.error(`Failed to upload ${type} for client ${clientId}:`, error);
    return { 
      success: false, 
      error: error.message || `Failed to upload ${type}` 
    };
  }
};

/**
 * Remove client logo or icon (SuperAdmin only)
 * @param {string} clientId - Client ID
 * @param {string} type - Type of image ('logo' or 'icon')
 * @returns {Promise<Object>} Response with removal result
 */
export const removeClientLogoApi = async (clientId, type = 'logo') => {
  try {
    const headers = await getAuthHeaders();
    
    const endpoint = type === 'icon' ? 'icon' : 'logo';
    const response = await fetch(`${API_BASE_URL}/${clientId}/${endpoint}`, {
      method: 'DELETE',
      headers
    });
    
    return await handleResponse(response);
  } catch (error) {
    console.error(`Failed to remove ${type} for client ${clientId}:`, error);
    return { 
      success: false, 
      error: error.message || `Failed to remove ${type}` 
    };
  }
};

/**
 * Validate file for logo upload
 * @param {File} file - File to validate
 * @returns {Object} Validation result
 */
export const validateLogoFile = (file) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const maxFileSize = 5 * 1024 * 1024; // 5MB
  
  const errors = [];
  
  if (!file) {
    errors.push('No file selected');
    return { isValid: false, errors };
  }
  
  if (!allowedTypes.includes(file.type)) {
    errors.push('Invalid file type. Please select a JPEG, PNG, GIF, or WebP image.');
  }
  
  if (file.size > maxFileSize) {
    errors.push('File size too large. Maximum size is 5MB.');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};