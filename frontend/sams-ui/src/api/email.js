/**
 * Email API Service
 * Frontend service for email configuration and receipt sending
 * FIXED: Now uses SecureApiClient for proper authentication
 */

import { getCurrentUser } from '../firebaseClient';
import { config } from '../config';

const API_BASE_URL = config.api.baseUrl;

/**
 * Get authentication headers with Firebase ID token
 * @returns {Promise<Object>} Headers object with Authorization bearer token
 */
async function getAuthHeaders() {
  const currentUser = getCurrentUser();
  
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  // Get Firebase ID token from auth instance
  const { getAuthInstance } = await import('../firebaseClient');
  const auth = getAuthInstance();
  const token = await auth.currentUser?.getIdToken();
  
  if (!token) {
    throw new Error('Failed to get authentication token');
  }
  
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

/**
 * Get email configuration for a client
 * @param {string} clientId - The client ID
 * @param {string} configType - Type of config (default: 'receiptEmail')
 * @returns {Promise<Object>} Response with email configuration
 */

/**
 * Send statement email for a single unit
 * @param {string} clientId - Client ID
 * @param {string} unitId - Unit ID
 * @param {number} fiscalYear - Fiscal year
 * @param {string} language - Optional language override (send in display language instead of user preference)
 * @param {Object} emailContent - Optional pre-calculated email data (from statementData.emailContent) to skip recalculation
 * @param {string} statementHtml - Optional pre-generated HTML (from statementData.html) to skip PDF generation recalculation
 * @param {Object} statementMeta - Optional statement metadata (from statementData.meta) for PDF footer
 * @returns {Promise<Object>} Result with success status and recipient info
 */
export async function sendStatementEmail(clientId, unitId, fiscalYear, language = null, emailContent = null, statementHtml = null, statementMeta = null, statementHtmlEn = null, statementHtmlEs = null, statementMetaEn = null, statementMetaEs = null) {
  // Debug: Log all parameters received
  console.log('📥 email.js received parameters:', {
    statementHtmlEnType: typeof statementHtmlEn,
    statementHtmlEnLength: statementHtmlEn?.length,
    statementHtmlEnTruthy: !!statementHtmlEn,
    statementHtmlEsType: typeof statementHtmlEs,
    statementHtmlEsLength: statementHtmlEs?.length,
    statementHtmlEsTruthy: !!statementHtmlEs,
    statementHtmlEsValue: statementHtmlEs ? String(statementHtmlEs).substring(0, 100) : 'null/undefined'
  });
  
  const headers = await getAuthHeaders();
  
  const body = { unitId, fiscalYear };
  if (language) {
    body.language = language;  // Override: send in current display language
  }
  if (emailContent) {
    body.emailContent = emailContent;  // Pre-calculated data to skip recalculation
  }
  if (statementHtml) {
    body.statementHtml = statementHtml;  // Pre-generated HTML (primary language) to skip PDF generation recalculation
  }
  if (statementMeta) {
    body.statementMeta = statementMeta;  // Statement metadata for PDF footer
  }
  // Both language HTMLs (when generateBothLanguages=true was used)
  if (statementHtmlEn) {
    body.statementHtmlEn = statementHtmlEn;  // Pre-generated English HTML
    console.log(`📤 Frontend sending htmlEn: ${statementHtmlEn.length} chars`);
  }
  if (statementHtmlEs) {
    body.statementHtmlEs = statementHtmlEs;  // Pre-generated Spanish HTML
    console.log(`📤 Frontend sending htmlEs: ${statementHtmlEs.length} chars`);
  } else {
    console.warn(`⚠️ Frontend: statementHtmlEs is falsy (${typeof statementHtmlEs}), not sending`);
  }
  if (statementMetaEn) {
    body.statementMetaEn = statementMetaEn;  // English metadata
  }
  if (statementMetaEs) {
    body.statementMetaEs = statementMetaEs;  // Spanish metadata
  }
  
  // Debug: Check body size before sending
  const bodyString = JSON.stringify(body);
  console.log(`📤 Frontend request body size: ${bodyString.length} chars, htmlEs in body: ${body.statementHtmlEs?.length || 0} chars`);
  
  const response = await fetch(`${API_BASE_URL}/clients/${clientId}/email/send-statement`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify(body)
  });
  
  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(result.error || 'Failed to send statement email');
  }
  
  return result;
}


export async function getEmailConfig(clientId, configType = 'receiptEmail') {
  try {
    console.log(`📋 Fetching email config for client: ${clientId}, type: ${configType}`);
    
    // Get authentication headers with Firebase token
    const authHeaders = await getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/email/config/${configType}`, {
      method: 'GET',
      headers: authHeaders,
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
    
    // Handle authentication errors specifically
    if (error.message.includes('not authenticated') || error.message.includes('authentication token')) {
      return {
        success: false,
        error: 'Authentication failed. Please log in again.',
        code: 'AUTH_ERROR'
      };
    }
    
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
export async function sendReceiptEmail(clientId, receiptData, receiptImageBase64, clientData = null) {
  try {
    console.log(`📧 Sending receipt email for client: ${clientId}, unit: ${receiptData.unitNumber}`);
    
    // Get authentication headers with Firebase token
    const authHeaders = await getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/email/send-receipt`, {
      method: 'POST',
      headers: authHeaders,
      credentials: 'include',
      body: JSON.stringify({
        receiptData,
        receiptImageBase64,
        clientData
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
    
    // Handle authentication errors specifically
    if (error.message.includes('not authenticated') || error.message.includes('authentication token')) {
      return {
        success: false,
        error: 'Authentication failed. Please log in again.',
        code: 'AUTH_ERROR'
      };
    }
    
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
    
    // Get authentication headers with Firebase token
    const authHeaders = await getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/email/test`, {
      method: 'POST',
      headers: authHeaders,
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
    
    // Handle authentication errors specifically
    if (error.message.includes('not authenticated') || error.message.includes('authentication token')) {
      return {
        success: false,
        error: 'Authentication failed. Please log in again.',
        code: 'AUTH_ERROR'
      };
    }
    
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
    
    // Get authentication headers with Firebase token
    const authHeaders = await getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/email/initialize`, {
      method: 'POST',
      headers: authHeaders,
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
    
    // Handle authentication errors specifically
    if (error.message.includes('not authenticated') || error.message.includes('authentication token')) {
      return {
        success: false,
        error: 'Authentication failed. Please log in again.',
        code: 'AUTH_ERROR'
      };
    }
    
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
