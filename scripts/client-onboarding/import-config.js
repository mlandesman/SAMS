/**
 * Import Configuration with DateService Support
 * 
 * Centralized configuration for all enhanced import scripts
 * Provides DateService instance and common utilities
 * 
 * Created: September 29, 2025
 * Purpose: Prevent timezone-related date sliding in imports
 */

import { DateService } from '../../backend/services/DateService.js';
import admin from 'firebase-admin';
import { getDb as initializeApp } from '../../backend/firebase.js';

// Create DateService instance with Mexico/Cancun timezone
export const dateService = new DateService({ timezone: 'America/Cancun' });

// Common date formats used in import data
export const DATE_FORMATS = {
  transaction: 'M/d/yyyy',           // e.g., "1/15/2025"
  yearEnd: 'yyyy-MM-dd',             // e.g., "2025-01-15"
  hoaPayment: 'EEE MMM dd yyyy HH:mm:ss', // e.g., "Sat Dec 28 2024 13:56:50"
  display: 'MM/dd/yyyy',             // Standard display format
  isoDate: 'yyyy-MM-dd',             // ISO date format
  firestore: 'yyyy-MM-dd HH:mm:ss'   // Firestore timestamp format
};

/**
 * Get import configuration for a specific client
 * @param {string} clientId - Client identifier (e.g., 'MTC', 'AVII')
 * @param {string} dataPath - Optional custom data path
 * @returns {Object} Import configuration
 */
export function getImportConfig(clientId, dataPath) {
  const defaultDataPath = `/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/${clientId}data`;
  
  return {
    clientId,
    dataPath: dataPath || defaultDataPath,
    dateService,
    dateFormats: DATE_FORMATS,
    environment: process.env.FIRESTORE_ENV || 'dev',
    timezone: 'America/Cancun'
  };
}

/**
 * Initialize import process with proper Firebase setup
 * @param {string} clientId - Client identifier
 * @returns {Promise<Object>} Firebase db instance and config
 */
export async function initializeImport(clientId) {
  try {
    // Initialize Firebase with proper environment
    const db = await initializeApp();
    
    // Log initialization details
    console.log(`\n🔥 Import initialized for ${clientId}`);
    console.log(`📁 Environment: ${process.env.FIRESTORE_ENV || 'dev'}`);
    console.log(`🕐 Timezone: America/Cancun`);
    console.log(`📅 Current time: ${dateService.formatForFrontend(new Date()).displayFull}`);
    
    return {
      db,
      dateService,
      clientId,
      environment: process.env.FIRESTORE_ENV || 'dev'
    };
  } catch (error) {
    console.error('❌ Failed to initialize import:', error);
    throw error;
  }
}

/**
 * Parse date string using appropriate format
 * @param {string} dateString - Date string to parse
 * @param {string} format - Format key from DATE_FORMATS or custom format
 * @returns {FirestoreTimestamp} Firestore timestamp
 */
export function parseDate(dateString, format = 'transaction') {
  if (!dateString) {
    return null;
  }
  
  // Use predefined format or custom format
  const dateFormat = DATE_FORMATS[format] || format;
  
  try {
    return dateService.parseFromFrontend(dateString, dateFormat);
  } catch (error) {
    console.error(`❌ Failed to parse date "${dateString}" with format "${dateFormat}":`, error.message);
    return null;
  }
}

/**
 * Format date for display
 * @param {any} date - Date to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted date string
 */
export function formatDate(date, options = {}) {
  if (!date) {
    return 'N/A';
  }
  
  const formatted = dateService.formatForFrontend(date, options);
  return options.full ? formatted.displayFull : formatted.display;
}

/**
 * Get current timestamp in Cancun timezone
 * @returns {FirestoreTimestamp} Current timestamp
 */
export function getCurrentTimestamp() {
  return admin.firestore.Timestamp.fromDate(dateService.getNow());
}

/**
 * Create migration metadata with proper timestamps
 * @param {Object} additionalData - Additional metadata
 * @returns {Object} Migration metadata
 */
export function createMigrationMetadata(additionalData = {}) {
  return {
    importDate: getCurrentTimestamp(),
    importScript: 'enhanced-import',
    timezone: 'America/Cancun',
    environment: process.env.FIRESTORE_ENV || 'dev',
    ...additionalData
  };
}

/**
 * Validate date is within reasonable range
 * @param {any} date - Date to validate
 * @param {number} yearRange - Number of years to consider valid (default: 10)
 * @returns {boolean} True if date is valid
 */
export function isValidDate(date, yearRange = 10) {
  if (!date) {
    return false;
  }
  
  try {
    const formatted = dateService.formatForFrontend(date);
    const year = formatted.year;
    const currentYear = new Date().getFullYear();
    
    // Check if year is within reasonable range
    return year >= (currentYear - yearRange) && year <= (currentYear + yearRange);
  } catch (error) {
    return false;
  }
}

/**
 * Log import progress with timestamp
 * @param {string} message - Message to log
 * @param {string} level - Log level (info, warn, error)
 */
export function logProgress(message, level = 'info') {
  const timestamp = dateService.formatForFrontend(new Date()).displayFull;
  const prefix = {
    info: '📊',
    warn: '⚠️',
    error: '❌',
    success: '✅'
  }[level] || '📊';
  
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

// Export all utilities
export default {
  dateService,
  DATE_FORMATS,
  getImportConfig,
  initializeImport,
  parseDate,
  formatDate,
  getCurrentTimestamp,
  createMigrationMetadata,
  isValidDate,
  logProgress
};