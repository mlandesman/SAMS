/**
 * timestampConverter.js
 * Utility functions to handle conversion between different Firebase timestamp formats
 */

import { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';

/**
 * Normalizes date fields in an object, converting any Firebase timestamps to JavaScript Date objects
 * @param {Object} data - Object containing data with Timestamp fields
 * @returns {Object} - Object with Timestamp fields converted to JavaScript Date objects
 */
export function normalizeDates(data) {
  if (!data || typeof data !== 'object') return data;
  
  const result = { ...data };
  
  Object.keys(result).forEach(key => {
    const value = result[key];
    
    // Convert Admin SDK Timestamps to JavaScript Date objects
    if (value && typeof value === 'object' && value.toDate && typeof value.toDate === 'function') {
      result[key] = value.toDate();
    }
    // Handle nested objects recursively
    else if (value && typeof value === 'object') {
      result[key] = normalizeDates(value);
    }
  });
  
  return result;
}

/**
 * Converts a JavaScript Date to the appropriate Timestamp type
 * @param {Date} date - JavaScript Date object
 * @returns {AdminTimestamp} - Firebase Admin SDK Timestamp
 */
export function dateToTimestamp(date) {
  if (!date) return null;
  
  try {
    // Ensure we have a proper Date object
    const jsDate = date instanceof Date ? date : new Date(date);
    
    // Create a Firebase Admin SDK Timestamp
    return AdminTimestamp.fromDate(jsDate);
  } catch (error) {
    console.error('Error converting date to timestamp:', error);
    return null;
  }
}

/**
 * Processes a data object and converts all Date fields to Firebase Timestamps
 * @param {Object} data - Object containing data with Date fields
 * @returns {Object} - Object with Date fields converted to Firebase Timestamps
 */
export function convertDatesToTimestamps(data) {
  if (!data || typeof data !== 'object') return data;

  const result = { ...data };
  
  Object.keys(result).forEach(key => {
    const value = result[key];
    
    // Convert Date objects to Timestamps
    if (value instanceof Date) {
      result[key] = dateToTimestamp(value);
    }
    // Handle nested objects recursively
    else if (value && typeof value === 'object' && !(value instanceof AdminTimestamp)) {
      result[key] = convertDatesToTimestamps(value);
    }
  });
  
  return result;
}
