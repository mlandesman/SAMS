/**
 * Exchange Rates Service for SAMS
 * 
 * This service calls the backend API which handles external API calls.
 * This avoids CORS issues when calling external APIs directly from the browser.
 */

import { config } from '../config';

/**
 * Check if exchange rates need updating for today
 */
export const needsExchangeRateUpdate = async () => {
  try {
    const response = await fetch(`${config.api.baseUrl}/exchange-rates/check`);
    const result = await response.json();
    
    console.log(`📊 Exchange rates check for ${result.date}: exists = ${result.exists}`);
    
    if (!result.exists) {
      console.log('📊 No exchange rates found for today - will fetch');
      return true;
    }
    
    console.log('📊 Exchange rates are up to date');
    return false;
  } catch (error) {
    console.error('❌ Error checking exchange rates:', error);
    return true;
  }
};

/**
 * Fetch exchange rates via backend API
 */
export const fetchExchangeRates = async () => {
  try {
    console.log('🔄 Requesting exchange rate fetch from backend...');
    
    const response = await fetch(`${config.api.baseUrl}/exchange-rates/fetch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.skipped) {
      console.log(`⏩ ${result.reason}`);
      return result;
    }
    
    if (result.success) {
      console.log(`✅ Exchange rates updated successfully for ${result.date}`);
      console.log('📊 Updated rates:', result.rates);
      return result;
    }
    
    throw new Error('Unknown response from backend');
  } catch (error) {
    console.error('❌ Failed to fetch exchange rates:', error);
    throw error;
  }
};

/**
 * Fill missing exchange rates (gap filling)
 * This checks for missing weekdays and fetches them
 */
export const fillMissingExchangeRates = async () => {
  try {
    console.log('🔄 Checking for missing exchange rate gaps...');
    
    const response = await fetch(`${config.api.baseUrl}/exchange-rates/fill-missing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      if (result.processed > 0) {
        console.log(`✅ Filled ${result.processed} missing exchange rates (${result.failed} failed)`);
      } else {
        console.log('📊 No missing exchange rates found');
      }
      return result;
    }
    
    throw new Error('Unknown response from backend');
  } catch (error) {
    console.error('❌ Failed to fill missing exchange rates:', error);
    throw error;
  }
};
