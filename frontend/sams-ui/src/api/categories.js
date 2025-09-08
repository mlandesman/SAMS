/**
 * Categories API Service
 * 
 * Handles communication with the backend for category operations
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
 * Get all categories for a client
 * @param {string} clientId - The client ID
 * @returns {Promise<Object>} Response with categories data
 */
export async function getCategories(clientId) {
  try {
    console.log(`📋 Fetching categories for client: ${clientId}`);
    
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/categories`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Fetched ${result.count} categories`);
      return result;
    } else {
      console.error('❌ Failed to fetch categories:', result.error);
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('❌ Error fetching categories:', error);
    throw error;
  }
}

/**
 * Create a new category
 * @param {string} clientId - The client ID
 * @param {Object} categoryData - The category data
 * @returns {Promise<Object>} Response with created category data
 */
export async function createCategory(clientId, categoryData) {
  try {
    console.log(`📋 Creating category for client: ${clientId}`, categoryData);
    
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/categories`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(categoryData),
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Category created successfully`);
      return result;
    } else {
      console.error('❌ Failed to create category:', result.error);
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('❌ Error creating category:', error);
    throw error;
  }
}

/**
 * Update an existing category
 * @param {string} clientId - The client ID
 * @param {string} categoryId - The category ID
 * @param {Object} categoryData - The updated category data
 * @returns {Promise<Object>} Response with updated category data
 */
export async function updateCategory(clientId, categoryId, categoryData) {
  try {
    console.log(`📋 Updating category ${categoryId} for client: ${clientId}`, categoryData);
    
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/categories/${categoryId}`, {
      method: 'PUT',
      headers,
      credentials: 'include',
      body: JSON.stringify(categoryData),
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Category updated successfully`);
      return result;
    } else {
      console.error('❌ Failed to update category:', result.error);
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('❌ Error updating category:', error);
    throw error;
  }
}

/**
 * Delete a category
 * @param {string} clientId - The client ID
 * @param {string} categoryId - The category ID
 * @returns {Promise<Object>} Response with deletion confirmation
 */
export async function deleteCategory(clientId, categoryId) {
  try {
    console.log(`📋 Deleting category ${categoryId} for client: ${clientId}`);
    
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/categories/${categoryId}`, {
      method: 'DELETE',
      headers,
      credentials: 'include',
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Category deleted successfully`);
      return result;
    } else {
      console.error('❌ Failed to delete category:', result.error);
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('❌ Error deleting category:', error);
    throw error;
  }
}