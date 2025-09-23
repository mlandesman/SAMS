import { getAuthInstance } from '../firebaseClient';
import { handleApiResponse } from './apiUtils';
import { config } from '../config/index.js';

const API_BASE_URL = config.api.baseUrl;

/**
 * Get the authorization header with Firebase ID token
 */
const getAuthHeaders = async () => {
  const auth = getAuthInstance();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No authenticated user');
  }
  
  const token = await user.getIdToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

/**
 * User API functions for SAMS user profile and role management
 */
export const userAPI = {
  /**
   * Get user profile with property access and roles
   * @returns {Promise<Object>} User profile data including propertyAccess and globalRole
   */
  async getProfile() {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/auth/user/profile`, { 
        method: 'GET',
        headers 
      });
      return await handleApiResponse(response);
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      throw new Error(`Failed to load user profile: ${error.message}`);
    }
  },

  /**
   * Update user profile
   * @param {Object} profileData - Updated profile data
   * @returns {Promise<Object>} Updated profile response
   */
  async updateProfile(profileData) {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/auth/user/profile`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(profileData)
      });
      return await handleApiResponse(response);
    } catch (error) {
      console.error('Failed to update user profile:', error);
      throw new Error(`Failed to update user profile: ${error.message}`);
    }
  },

  /**
   * Get user's accessible clients
   * @returns {Promise<Array>} List of clients user can access
   */
  async getAccessibleClients() {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/auth/user/clients`, { 
        method: 'GET',
        headers 
      });
      return await handleApiResponse(response);
    } catch (error) {
      console.error('Failed to fetch accessible clients:', error);
      throw new Error(`Failed to load accessible clients: ${error.message}`);
    }
  }
};