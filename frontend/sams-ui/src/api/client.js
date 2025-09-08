// src/api/client.js
// Unified client API that combines all necessary functions for the UnifiedExpenseEntry component

import { getCategories } from './categories';
import { getVendors } from './vendors';
import { getPaymentMethods } from './paymentMethods';
import { createTransaction } from './transaction';
import { uploadDocumentsForTransaction, linkDocumentsToTransaction } from './documents';
import { getUnits } from './units';
import { config } from '../config';

// Function to get accounts for a client
export async function getAccounts(clientId) {
  try {
    // Get authentication token
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

    const response = await fetch(`${config.api.baseUrl}/clients/${clientId}/accounts`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting accounts:', error);
    throw error; // Re-throw to handle properly in components
  }
}

// Function to get a client by ID
export async function getClient(clientId) {
  try {
    // Get authentication token
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

    const response = await fetch(`${config.api.baseUrl}/clients/${clientId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting client:', error);
    throw error; // Re-throw to handle in the component
  }
}

// Unified clientAPI object that matches the PWA structure
export const clientAPI = {
  getCategories,
  getVendors,
  getAccounts,
  getPaymentMethods,
  getUnits,
  createTransaction,
  uploadDocumentsForTransaction,
  linkDocumentsToTransaction,
  getClient
};