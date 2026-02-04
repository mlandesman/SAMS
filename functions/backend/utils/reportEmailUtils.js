/**
 * Report Email Utilities
 * 
 * Shared utilities for sending reports (Statements, Poll notifications, etc.)
 * Provides consistent handling of:
 * - Owner/recipient name extraction
 * - Language preference lookup
 * - Email address collection
 * - Dev mode email override
 * 
 * Created: February 2026
 */

import { getDb } from '../firebase.js';
import { normalizeOwners, normalizeManagers, joinOwnerNames } from './unitContactUtils.js';

/**
 * Check if running in production environment
 * Uses same detection pattern as emailService.js
 */
export function isProduction() {
  return process.env.NODE_ENV === 'production' || 
         process.env.FIRESTORE_ENV === 'prod' ||
         process.env.GCLOUD_PROJECT === 'sams-sandyland-prod';
}

/**
 * Get dev email override address
 * All emails in non-production are redirected here
 */
export function getDevEmailOverride() {
  return process.env.EMAIL_TEST_OVERRIDE || 'michael@landesman.com';
}

/**
 * Get email language preference for a unit
 * Checks owner[0]'s preferredLanguage from users collection
 * Falls back to client default language
 * 
 * @param {Object} unit - Unit document data (with owners array)
 * @param {string} clientId - Client ID
 * @returns {Promise<string>} 'english' or 'spanish'
 */
export async function getUnitEmailLanguage(unit, clientId) {
  const db = await getDb();
  const owners = normalizeOwners(unit.owners);
  
  if (!owners.length || !owners[0].email) {
    // Fallback to client default
    const clientDoc = await db.collection('clients').doc(clientId).get();
    return clientDoc.data()?.configuration?.defaultLanguage || 'english';
  }
  
  // Look up owner[0] in users collection
  const userSnapshot = await db.collection('users')
    .where('email', '==', owners[0].email)
    .limit(1)
    .get();
  
  if (userSnapshot.empty) {
    // Fallback to client default
    const clientDoc = await db.collection('clients').doc(clientId).get();
    return clientDoc.data()?.configuration?.defaultLanguage || 'english';
  }
  
  const userData = userSnapshot.docs[0].data();
  // Canonical location is profile.preferredLanguage
  // Fall back to top-level for backwards compatibility with older user docs
  const preferredLang = userData.profile?.preferredLanguage || userData.preferredLanguage;
  return preferredLang === 'spanish' || preferredLang === 'es' ? 'spanish' : 'english';
}

/**
 * Get unit recipient info for emails/reports
 * Returns owner names, primary email, cc emails, and language
 * 
 * @param {Object} unit - Unit document data
 * @param {string} clientId - Client ID
 * @returns {Promise<Object>} Recipient info object
 */
export async function getUnitRecipientInfo(unit, clientId) {
  const owners = normalizeOwners(unit.owners);
  const managers = normalizeManagers(unit.managers);
  
  // Primary owner name(s) for salutation
  const ownerNames = joinOwnerNames(unit.owners) || 'Owner';
  
  // Primary email addresses (To:)
  const toEmails = owners.filter(o => o.email).map(o => o.email);
  
  // CC addresses (managers)
  const ccEmails = managers.filter(m => m.email).map(m => m.email);
  
  // Get language preference
  const language = await getUnitEmailLanguage(unit, clientId);
  
  return {
    ownerNames,
    toEmails,
    ccEmails,
    language,
    primaryEmail: toEmails[0] || null,
    hasEmail: toEmails.length > 0
  };
}

/**
 * Apply dev mode email override
 * In non-production, redirects all emails to dev address
 * Logs original recipients for debugging
 * 
 * @param {string|string[]} originalEmails - Original email address(es)
 * @param {string} context - Context for logging (e.g., "unit PH4D poll notification")
 * @returns {Object} { email, wasOverridden, originalEmail }
 */
export function applyDevEmailOverride(originalEmails, context = '') {
  const IS_PRODUCTION = isProduction();
  const devEmail = getDevEmailOverride();
  
  const emails = Array.isArray(originalEmails) ? originalEmails : [originalEmails];
  const primaryEmail = emails[0];
  
  if (IS_PRODUCTION) {
    return {
      email: primaryEmail,
      emails: emails,
      wasOverridden: false,
      originalEmail: primaryEmail
    };
  }
  
  // Log redirect info
  if (context) {
    console.log(`📧 DEV: ${context}`);
  }
  emails.forEach((email, i) => {
    console.log(`   ${i + 1}. ${email} → ${devEmail}`);
  });
  
  return {
    email: devEmail,
    emails: [devEmail],
    wasOverridden: true,
    originalEmail: primaryEmail
  };
}

/**
 * Get client email branding info
 * 
 * @param {string} clientId - Client ID
 * @returns {Promise<Object>} Client branding info
 */
export async function getClientEmailBranding(clientId) {
  const db = await getDb();
  const clientDoc = await db.collection('clients').doc(clientId).get();
  
  if (!clientDoc.exists) {
    return {
      clientName: clientId,
      clientLogoUrl: null,
      brandColor: '#4a7c59',
      contactEmail: 'pm@sandyland.com.mx'
    };
  }
  
  const data = clientDoc.data();
  return {
    clientName: data.basicInfo?.fullName || data.basicInfo?.displayName || data.name || clientId,
    clientLogoUrl: data.branding?.logoUrl || null,
    brandColor: data.branding?.brandColors?.primary || '#4a7c59',
    contactEmail: data.contactInfo?.primaryEmail || 'pm@sandyland.com.mx'
  };
}
