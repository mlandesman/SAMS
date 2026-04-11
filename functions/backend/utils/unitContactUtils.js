/**
 * Unit Contact Structure Utilities
 * 
 * Provides normalization functions for unit owners and managers
 * Handles backward compatibility between old format (["name"]) and new format ([{name, email}])
 * 
 * Task ID: UNIT-CONTACT-CODE-UPDATE-20251216
 * Date: December 16, 2025
 */

import { logDebug, logInfo, logWarn, logError } from '../../shared/logger.js';
import { getDisplayNameFromUser as getDisplayNameFromUserShared } from '../../../shared/userIdentityDisplay.js';

/** Re-export canonical identity label (shared with frontend). */
export function getDisplayNameFromUser(userData) {
  return getDisplayNameFromUserShared(userData);
}

/** Exported for reuse (e.g. WhatsApp webhook phone matching). */
export function getPhoneFromUser(userData = {}) {
  const profile = userData.profile || {};
  return typeof profile.phone === 'string' ? profile.phone.trim() : '';
}

function getEmailFromUser(userData = {}) {
  return typeof userData.email === 'string' ? userData.email.trim() : '';
}

/** Firebase UID for a linked contact (`userId` canonical; `uid` accepted for legacy rows). */
export function getContactLinkedUserId(contact) {
  if (!contact || typeof contact !== 'object') return '';
  if (typeof contact.userId === 'string' && contact.userId.trim()) return contact.userId.trim();
  if (typeof contact.uid === 'string' && contact.uid.trim()) return contact.uid.trim();
  return '';
}

function getUniqueUserIds(contacts) {
  if (!Array.isArray(contacts)) return [];

  return [...new Set(
    contacts
      .map(contact => getContactLinkedUserId(contact))
      .filter(Boolean)
  )];
}

async function buildUserCache(userIds, db, existingCache = new Map()) {
  const missingUserIds = userIds.filter(userId => !existingCache.has(userId));

  if (missingUserIds.length === 0) {
    return existingCache;
  }

  const userRefs = missingUserIds.map(userId => db.collection('users').doc(userId));
  const userDocs = await db.getAll(...userRefs);

  userDocs.forEach((userDoc, index) => {
    const userId = missingUserIds[index];
    existingCache.set(userId, userDoc.exists ? userDoc.data() : null);
  });

  return existingCache;
}

function resolveContactWithCache(contact, userCache) {
  // Normalize legacy string format to {name, email, phone} for consistent API response
  if (typeof contact === 'string') {
    const name = contact.trim();
    return name ? { name, email: '', phone: '' } : null;
  }
  if (!contact || typeof contact !== 'object') {
    return contact;
  }

  const linkedId = getContactLinkedUserId(contact);
  if (linkedId) {
    const userId = linkedId;
    const userData = userCache.get(userId);

    if (!userData) {
      // Keep unresolved UID entries backward-compatible for response shape.
      return { userId, name: '', email: '', phone: '' };
    }

    return {
      userId,
      name: getDisplayNameFromUser(userData),
      email: getEmailFromUser(userData),
      phone: getPhoneFromUser(userData),
    };
  }

  // Legacy format entry should pass through unchanged.
  return contact;
}

/**
 * Normalize a single contact object for Firestore storage.
 * Keeps UID references when present and preserves legacy {name,email}.
 *
 * @param {string|Object|null|undefined} entry
 * @returns {{userId: string}|{name: string, email: string}|null}
 */
export function normalizeContactForStorage(entry) {
  if (typeof entry === 'string') {
    const trimmedName = entry.trim();
    if (!trimmedName) return null;
    return { name: trimmedName, email: '' };
  }

  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const linked = getContactLinkedUserId(entry);
  if (linked) {
    return { userId: linked };
  }

  const name = typeof entry.name === 'string' ? entry.name.trim() : '';
  const email = typeof entry.email === 'string' ? entry.email.trim() : '';
  if (!name && !email) {
    return null;
  }

  return { name, email };
}

/**
 * Normalize contact array for Firestore storage.
 *
 * @param {Array<any>|undefined} contacts
 * @returns {Array<Object>}
 */
export function normalizeContactsForStorage(contacts) {
  if (!Array.isArray(contacts)) return [];
  return contacts.map(normalizeContactForStorage).filter(Boolean);
}

/**
 * Normalize owners array to new structure [{name, email}]
 * Assumes new format only - converts string format if found (should not happen after migration)
 * 
 * @param {Array<Object>|undefined} owners - Owners array in [{name, email}] format
 * @returns {Array<{name: string, email: string}>} Normalized owners array
 */
export function normalizeOwners(owners) {
  if (!Array.isArray(owners)) return [];
  
  return owners.map(owner => {
    // Handle legacy string format (should be migrated, but handle gracefully)
    if (typeof owner === 'string') {
      logWarn('⚠️  Found legacy string format owner - should be migrated:', owner);
      return { name: owner.trim(), email: '' };
    }
    const linked = getContactLinkedUserId(owner);
    if (linked) {
      return {
        userId: linked,
        name: (owner.name || '').trim(),
        email: (owner.email || '').trim(),
        phone: (owner.phone || '').trim()
      };
    }
    // Legacy/new format: {name, email}
    return {
      name: (owner.name || '').trim(),
      email: (owner.email || '').trim()
    };
  }).filter(owner => owner.name || getContactLinkedUserId(owner)); // Keep UID entries even without names
}

/**
 * Normalize managers array to new structure [{name, email}]
 * Assumes new format only - converts string format if found (should not happen after migration)
 * 
 * @param {Array<Object>|undefined} managers - Managers array in [{name, email}] format
 * @returns {Array<{name: string, email: string}>} Normalized managers array
 */
export function normalizeManagers(managers) {
  if (!Array.isArray(managers)) return [];
  
  return managers.map(manager => {
    // Handle legacy string format (should be migrated, but handle gracefully)
    if (typeof manager === 'string') {
      logWarn('⚠️  Found legacy string format manager - should be migrated:', manager);
      return { name: manager.trim(), email: '' };
    }
    const linked = getContactLinkedUserId(manager);
    if (linked) {
      return {
        userId: linked,
        name: (manager.name || '').trim(),
        email: (manager.email || '').trim(),
        phone: (manager.phone || '').trim()
      };
    }
    // Legacy/new format: {name, email}
    return {
      name: (manager.name || '').trim(),
      email: (manager.email || '').trim()
    };
  }).filter(manager => manager.name || getContactLinkedUserId(manager)); // Keep UID entries even without names
}

/**
 * Pre-build user cache for multiple units in one batched fetch (avoids N+1).
 * @param {Array<{owners?: Array, managers?: Array}>} units
 * @param {FirebaseFirestore.Firestore} db
 * @returns {Promise<Map<string, object|null>>}
 */
export async function buildUserCacheForUnits(units, db) {
  const allIds = new Set();
  for (const unit of units) {
    getUniqueUserIds(unit.owners || []).forEach(id => allIds.add(id));
    getUniqueUserIds(unit.managers || []).forEach(id => allIds.add(id));
  }
  return buildUserCache([...allIds], db, new Map());
}

/**
 * Resolve owners to enriched owner objects for API responses.
 * Supports mixed arrays of {userId} and legacy {name, email}.
 *
 * @param {Array<Object>|undefined} owners
 * @param {FirebaseFirestore.Firestore} db
 * @returns {Promise<Array<Object>>}
 */
export async function resolveOwners(owners, db, existingCache = null) {
  if (!Array.isArray(owners) || owners.length === 0) {
    return [];
  }

  if (!db) {
    logWarn('resolveOwners called without db; returning normalized owners');
    return normalizeOwners(owners);
  }

  const userIds = getUniqueUserIds(owners);
  const userCache = await buildUserCache(userIds, db, existingCache || new Map());

  return owners.map(owner => resolveContactWithCache(owner, userCache)).filter(Boolean);
}

/**
 * Resolve managers to enriched manager objects for API responses.
 * Supports mixed arrays of {userId} and legacy {name, email}.
 *
 * @param {Array<Object>|undefined} managers
 * @param {FirebaseFirestore.Firestore} db
 * @returns {Promise<Array<Object>>}
 */
export async function resolveManagers(managers, db, existingCache = null) {
  if (!Array.isArray(managers) || managers.length === 0) {
    return [];
  }

  if (!db) {
    logWarn('resolveManagers called without db; returning normalized managers');
    return normalizeManagers(managers);
  }

  const userIds = getUniqueUserIds(managers);
  const userCache = await buildUserCache(userIds, db, existingCache || new Map());

  return managers.map(manager => resolveContactWithCache(manager, userCache)).filter(Boolean);
}

/**
 * Extract owner names as array of strings (for backward compatibility)
 * 
 * @param {Array<string|Object>|undefined} owners - Owners array (old or new format)
 * @returns {Array<string>} Array of owner names
 */
export function getOwnerNames(owners) {
  return normalizeOwners(owners).map(owner => owner.name).filter(Boolean);
}

/**
 * Extract manager names as array of strings (for backward compatibility)
 * 
 * @param {Array<string|Object>|undefined} managers - Managers array (old or new format)
 * @returns {Array<string>} Array of manager names
 */
export function getManagerNames(managers) {
  return normalizeManagers(managers).map(manager => manager.name).filter(Boolean);
}

/**
 * Get first owner name (for backward compatibility)
 * 
 * @param {Array<string|Object>|undefined} owners - Owners array (old or new format)
 * @returns {string} First owner name or empty string
 */
export function getFirstOwnerName(owners) {
  const normalized = normalizeOwners(owners);
  return normalized.length > 0 ? normalized[0].name : '';
}

/**
 * Get first owner object (with name and email)
 * 
 * @param {Array<string|Object>|undefined} owners - Owners array (old or new format)
 * @returns {{name: string, email: string}|null} First owner object or null
 */
export function getFirstOwner(owners) {
  const normalized = normalizeOwners(owners);
  return normalized.length > 0 ? normalized[0] : null;
}

/**
 * Extract owner last name from first owner (for display purposes)
 * 
 * @param {Array<string|Object>|undefined} owners - Owners array (old or new format)
 * @returns {string} Last name or empty string
 */
export function getFirstOwnerLastName(owners) {
  const firstOwner = getFirstOwner(owners);
  if (!firstOwner || !firstOwner.name) return '';
  
  const nameParts = firstOwner.name.trim().split(/\s+/);
  if (nameParts.length > 1) {
    return nameParts[nameParts.length - 1];
  }
  return nameParts[0] || '';
}

/**
 * Join owner names with comma (for display)
 * 
 * @param {Array<string|Object>|undefined} owners - Owners array (old or new format)
 * @param {string} separator - Separator string (default: ', ')
 * @returns {string} Comma-separated owner names
 */
export function joinOwnerNames(owners, separator = ', ') {
  return getOwnerNames(owners).join(separator);
}

/**
 * Join manager names with comma (for display)
 * 
 * @param {Array<string|Object>|undefined} managers - Managers array (old or new format)
 * @param {string} separator - Separator string (default: ', ')
 * @returns {string} Comma-separated manager names
 */
export function joinManagerNames(managers, separator = ', ') {
  return getManagerNames(managers).join(separator);
}
