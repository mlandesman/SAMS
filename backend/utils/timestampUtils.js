/**
 * timestampUtils.js
 * Utility functions for handling timestamps in the backend
 */

import { getNow } from '../services/DateService.js';

/**
 * Ensures a date field is a proper Date object for storage in Firestore
 * @param {Date|Object} dateValue - Date value to normalize
 * @returns {Date} - JavaScript Date object
 */
export function normalizeDate(dateValue) {
  if (!dateValue) return getNow();
  
  if (dateValue instanceof Date) {
    return dateValue;
  }
  
  // Handle Firebase Timestamp objects from client SDK
  if (dateValue && typeof dateValue.toDate === 'function') {
    return dateValue.toDate();
  }
  
  // Handle ISO string or other formats
  try {
    const date = new Date(dateValue);
    
    // If the date string doesn't include time, assume noon local time to avoid timezone shifts
    if (typeof dateValue === 'string' && !dateValue.includes('T')) {
      // Parse as YYYY-MM-DD and set to noon
      const [year, month, day] = dateValue.split('-').map(num => parseInt(num));
      if (year && month && day) {
        return new Date(year, month - 1, day, 12, 0, 0);
      }
    }
    
    return date;
  } catch (e) {
    console.error('Error converting to date:', e);
    return getNow();
  }
}

/**
 * Process an object and normalize all date fields for storage
 * @param {Object} data - Data object to process
 * @returns {Object} - Processed data with normalized dates
 */
export function normalizeDates(data) {
  if (!data || typeof data !== 'object') return data;
  
  const result = { ...data };
  
  // Known date fields that should be normalized
  const dateFields = ['date', 'createdAt', 'updatedAt', 'closingDate'];
  
  // Loop through all keys in the object
  Object.keys(result).forEach(key => {
    const value = result[key];
    
    // If this is a known date field, normalize it
    if (dateFields.includes(key)) {
      result[key] = normalizeDate(value);
    }
    // If value is an object with toDate function, it's likely a Timestamp
    else if (value && typeof value === 'object' && typeof value.toDate === 'function') {
      result[key] = normalizeDate(value);
    }
    // Handle nested objects recursively
    else if (value && typeof value === 'object' && !(value instanceof Date)) {
      result[key] = normalizeDates(value);
    }
  });
  
  return result;
}
