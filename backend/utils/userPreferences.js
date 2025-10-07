/**
 * User Preferences Schema and Utilities
 * Handles user-specific settings including timezone preferences
 */

import { getNow } from '../services/DateService.js';

const DEFAULT_PREFERENCES = {
  timezone: 'America/Cancun',      // Default to Mexico/Cancun timezone
  locale: 'en-US',                 // Default locale
  dateFormat: 'MM/dd/yyyy',        // US date format
  timeFormat: 'h:mm a',            // 12-hour format with AM/PM
  weekStartDay: 0,                 // 0 = Sunday, 1 = Monday
  fiscalYearStartMonth: 7,         // July (for AVII client)
  currency: 'MXN',                 // Mexican Peso
  currencyDisplay: 'symbol',       // Show $ symbol
  language: 'en'                   // English
};

/**
 * Get user preferences with defaults
 * @param {Object} userDoc - User document from Firestore
 * @returns {Object} Complete preferences object
 */
function getUserPreferences(userDoc) {
  const userData = userDoc.data ? userDoc.data() : userDoc;
  const preferences = userData.preferences || {};
  
  return {
    ...DEFAULT_PREFERENCES,
    ...preferences
  };
}

/**
 * Update user preferences
 * @param {Object} db - Firestore database instance
 * @param {string} userId - User ID
 * @param {Object} newPreferences - Preferences to update
 * @returns {Promise} Update promise
 */
async function updateUserPreferences(db, userId, newPreferences) {
  // Validate timezone if provided
  if (newPreferences.timezone) {
    const validTimezones = [
      'America/Cancun',
      'America/Mexico_City',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'America/Phoenix',
      'Europe/London',
      'Europe/Paris',
      'Asia/Tokyo',
      'Australia/Sydney'
    ];
    
    if (!validTimezones.includes(newPreferences.timezone)) {
      throw new Error(`Invalid timezone: ${newPreferences.timezone}`);
    }
  }
  
  // Validate locale if provided
  if (newPreferences.locale) {
    const validLocales = ['en-US', 'es-MX', 'en-GB', 'fr-FR'];
    if (!validLocales.includes(newPreferences.locale)) {
      throw new Error(`Invalid locale: ${newPreferences.locale}`);
    }
  }
  
  // Validate date format if provided
  if (newPreferences.dateFormat) {
    const validDateFormats = [
      'MM/dd/yyyy',  // US format
      'dd/MM/yyyy',  // European/Mexican format
      'yyyy-MM-dd',  // ISO format
      'MMM dd, yyyy' // Long format
    ];
    if (!validDateFormats.includes(newPreferences.dateFormat)) {
      throw new Error(`Invalid date format: ${newPreferences.dateFormat}`);
    }
  }
  
  // Update user document with new preferences
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();
  
  if (!userDoc.exists) {
    throw new Error(`User not found: ${userId}`);
  }
  
  const currentPreferences = getUserPreferences(userDoc);
  const updatedPreferences = {
    ...currentPreferences,
    ...newPreferences,
    updatedAt: getNow()
  };
  
  await userRef.update({
    preferences: updatedPreferences
  });
  
  return updatedPreferences;
}

/**
 * Get timezone offset in hours
 * @param {string} timezone - Timezone name
 * @returns {number} Offset in hours
 */
function getTimezoneOffset(timezone) {
  const offsets = {
    'America/Cancun': -5,
    'America/Mexico_City': -6,
    'America/New_York': -5,  // Changes with DST
    'America/Chicago': -6,    // Changes with DST
    'America/Denver': -7,     // Changes with DST
    'America/Los_Angeles': -8, // Changes with DST
    'America/Phoenix': -7,     // No DST
    'Europe/London': 0,       // Changes with DST
    'Europe/Paris': 1,        // Changes with DST
    'Asia/Tokyo': 9,          // No DST
    'Australia/Sydney': 10    // Changes with DST
  };
  
  return offsets[timezone] || 0;
}

export {
  DEFAULT_PREFERENCES,
  getUserPreferences,
  updateUserPreferences,
  getTimezoneOffset
};