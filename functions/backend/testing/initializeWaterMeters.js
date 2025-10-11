#!/usr/bin/env node

/**
 * Initialize water meters for AVII
 */

import { createApiClient } from './apiClient.js';

async function initializeMeters() {
  console.log('🚰 Initializing water meters for AVII\n');
  
  try {
    const api = await createApiClient();
    console.log('✅ Authentication successful\n');
    
    console.log('📤 Initializing meters...');
    
    try {
      const response = await api.post('/api/clients/AVII/projects/waterBills/meters/initialize');
      
      if (response.success) {
        console.log('✅ Meters initialized successfully!');
        console.log(`   ${response.message}`);
      } else {
        console.log('❌ Failed to initialize meters');
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

initializeMeters();