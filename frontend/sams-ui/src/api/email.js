/**
 * Email API Service
 * Frontend service for email configuration and receipt sending
 */

import { config } from '../config';
const API_BASE_URL = config.api.baseUrl;

/**
 * Get email configuration for a client
 * @param {string} clientId - The client ID
 * @param {string} configType - Type of config (default: 'receiptEmail')
 * @returns {Promise<Object>} Response with email configuration
 */
export async function getEmailConfig(clientId, configType = 'receiptEmail') {
  try {
    console.log(`📋 Fetching email config for client: ${clientId}, type: ${configType}`);
    
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/email/config/${configType}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Email config fetched successfully`);
      return result;
    } else {
      console.warn(`⚠️ Email config not found: ${result.error}`);
      return result;
    }
  } catch (error) {
    console.error('❌ Error fetching email config:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send receipt email
 * @param {string} clientId - The client ID
 * @param {Object} receiptData - Receipt data object
 * @param {string} receiptImageBase64 - Base64 encoded receipt image
 * @returns {Promise<Object>} Response with send result
 */
export async function sendReceiptEmail(clientId, receiptData, receiptImageBase64) {
  try {
    console.log(`📧 Sending receipt email for client: ${clientId}, unit: ${receiptData.unitNumber}`);
    
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/email/send-receipt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        receiptData,
        receiptImageBase64
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Receipt email sent successfully to:`, result.recipients);
      return result;
    } else {
      console.error(`❌ Failed to send receipt email: ${result.error}`);
      return result;
    }
  } catch (error) {
    console.error('❌ Error sending receipt email:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test email configuration
 * @param {string} clientId - The client ID
 * @param {string} testEmail - Email address to send test to
 * @returns {Promise<Object>} Response with test result
 */
export async function testEmailConfig(clientId, testEmail) {
  try {
    console.log(`🧪 Testing email config for client: ${clientId}`);
    
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/email/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        testEmail
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Test email sent successfully`);
      return result;
    } else {
      console.error(`❌ Test email failed: ${result.error}`);
      return result;
    }
  } catch (error) {
    console.error('❌ Error testing email config:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Initialize default email configuration for a client
 * @param {string} clientId - The client ID
 * @returns {Promise<Object>} Response with initialization result
 */
export async function initializeEmailConfig(clientId) {
  try {
    console.log(`🔧 Initializing email config for client: ${clientId}`);
    
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/email/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include'
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Email config initialized successfully`);
      return result;
    } else {
      console.error(`❌ Email config initialization failed: ${result.error}`);
      return result;
    }
  } catch (error) {
    console.error('❌ Error initializing email config:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Convert canvas to base64 image data
 * @param {HTMLCanvasElement} canvas - Canvas element to convert
 * @returns {string} Base64 encoded image data
 */
export function canvasToBase64(canvas) {
  return canvas.toDataURL('image/png');
}

/**
 * Convert blob to base64
 * @param {Blob} blob - Blob to convert
 * @returns {Promise<string>} Base64 encoded data
 */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
