/**
 * Projects API Service
 * 
 * Handles communication with the backend for special assessment project operations.
 * These are actual project entities (like "column-repairs-2025"), not project types
 * (like waterBills or propaneTanks).
 */

import { getAuthInstance } from '../firebaseClient';
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
 * Get all projects for a client
 * @param {string} clientId - The client ID
 * @param {number|null} year - Optional year to filter by (based on startDate)
 * @returns {Promise<Object>} Response with projects data
 */
export async function getProjects(clientId, year = null) {
  try {
    console.log(`📋 Fetching projects for client: ${clientId}${year ? ` (year: ${year})` : ''}`);
    
    const headers = await getAuthHeaders();
    
    const url = year 
      ? `${API_BASE_URL}/clients/${clientId}/projects?year=${year}&t=${Date.now()}`
      : `${API_BASE_URL}/clients/${clientId}/projects?t=${Date.now()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
      credentials: 'include',
      cache: 'no-store',
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Fetched ${result.count} projects`);
      return result;
    } else {
      console.error('❌ Failed to fetch projects:', result.error);
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('❌ Error fetching projects:', error);
    throw error;
  }
}

/**
 * Get a single project by ID
 * @param {string} clientId - The client ID
 * @param {string} projectId - The project ID
 * @returns {Promise<Object>} Response with project data
 */
export async function getProject(clientId, projectId) {
  try {
    console.log(`📋 Fetching project ${projectId} for client: ${clientId}`);
    
    const headers = await getAuthHeaders();
    
    const response = await fetch(
      `${API_BASE_URL}/clients/${clientId}/projects/${projectId}?t=${Date.now()}`,
      {
        method: 'GET',
        headers,
        credentials: 'include',
        cache: 'no-store',
      }
    );
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Fetched project: ${result.data.name}`);
      return result;
    } else {
      console.error('❌ Failed to fetch project:', result.error);
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('❌ Error fetching project:', error);
    throw error;
  }
}

/**
 * Create a new project
 * @param {string} clientId - The client ID
 * @param {Object} projectData - The project data
 * @returns {Promise<Object>} Response with created project data
 */
export async function createProject(clientId, projectData) {
  try {
    console.log(`📝 Creating project for client: ${clientId}`);
    
    const headers = await getAuthHeaders();
    
    const response = await fetch(
      `${API_BASE_URL}/clients/${clientId}/projects`,
      {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(projectData)
      }
    );
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Created project: ${result.data.name}`);
      return result;
    } else {
      console.error('❌ Failed to create project:', result.error);
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('❌ Error creating project:', error);
    throw error;
  }
}

/**
 * Update an existing project
 * @param {string} clientId - The client ID
 * @param {string} projectId - The project ID
 * @param {Object} updates - The fields to update
 * @returns {Promise<Object>} Response with updated project data
 */
export async function updateProject(clientId, projectId, updates) {
  try {
    console.log(`📝 Updating project ${projectId} for client: ${clientId}`);
    
    const headers = await getAuthHeaders();
    
    const response = await fetch(
      `${API_BASE_URL}/clients/${clientId}/projects/${projectId}`,
      {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify(updates)
      }
    );
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Updated project: ${result.data.name}`);
      return result;
    } else {
      console.error('❌ Failed to update project:', result.error);
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('❌ Error updating project:', error);
    throw error;
  }
}

/**
 * Delete a project
 * @param {string} clientId - The client ID
 * @param {string} projectId - The project ID
 * @returns {Promise<Object>} Response confirming deletion
 */
export async function deleteProject(clientId, projectId) {
  try {
    console.log(`🗑️ Deleting project ${projectId} for client: ${clientId}`);
    
    const headers = await getAuthHeaders();
    
    const response = await fetch(
      `${API_BASE_URL}/clients/${clientId}/projects/${projectId}`,
      {
        method: 'DELETE',
        headers,
        credentials: 'include'
      }
    );
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Deleted project: ${projectId}`);
      return result;
    } else {
      console.error('❌ Failed to delete project:', result.error);
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('❌ Error deleting project:', error);
    throw error;
  }
}
