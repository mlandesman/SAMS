/**
 * Unit Contact Structure Utilities (Frontend)
 *
 * Provides normalization functions for unit owners and managers
 * Handles backward compatibility between old format (["name"]) and new format ([{name, email}])
 *
 * Task ID: UNIT-CONTACT-CODE-UPDATE-20251216
 * Date: December 16, 2025
 */

import { getDisplayNameFromUser as getDisplayNameFromUserCanonical } from '../../../../shared/userIdentityDisplay.js';

/** Canonical user label — same algorithm as backend `unitContactUtils` / `listUnits` resolution. */
export function getDisplayNameFromUser(userData) {
  return getDisplayNameFromUserCanonical(userData);
}

/** Firebase UID for a linked contact (`userId` canonical; `uid` accepted for legacy rows). */
export function getContactLinkedUserId(contact) {
  if (!contact || typeof contact !== 'object') return '';
  if (typeof contact.userId === 'string' && contact.userId.trim()) return contact.userId.trim();
  if (typeof contact.uid === 'string' && contact.uid.trim()) return contact.uid.trim();
  return '';
}

/** Label for a resolved unit owner/manager object from the API (name, email, optional userId). */
export function resolvedContactLabel(contact = {}) {
  if (!contact || typeof contact !== 'object') return '';
  const name = (contact.name || '').trim();
  if (name) return name;
  const email = (contact.email || '').trim();
  if (email) return email;
  const uid = getContactLinkedUserId(contact);
  if (uid) return `User ${uid.slice(0, 8)}…`;
  return '';
}

export function normalizeOwners(owners) {
  if (!Array.isArray(owners)) return [];
  return owners.map(owner => {
    if (typeof owner === 'string') {
      console.warn('⚠️  Found legacy string format owner - should be migrated:', owner);
      return { name: owner.trim(), email: '' };
    }
    if (owner && typeof owner === 'object') {
      const uid = getContactLinkedUserId(owner);
      if (uid) {
        return {
          userId: uid,
          name: (owner.name || '').trim(),
          email: (owner.email || '').trim()
        };
      }
    }
    return { name: (owner.name || '').trim(), email: (owner.email || '').trim() };
  }).filter(owner => owner.name || getContactLinkedUserId(owner));
}

export function normalizeManagers(managers) {
  if (!Array.isArray(managers)) return [];
  return managers.map(manager => {
    if (typeof manager === 'string') {
      console.warn('⚠️  Found legacy string format manager - should be migrated:', manager);
      return { name: manager.trim(), email: '' };
    }
    if (manager && typeof manager === 'object') {
      const uid = getContactLinkedUserId(manager);
      if (uid) {
        return {
          userId: uid,
          name: (manager.name || '').trim(),
          email: (manager.email || '').trim()
        };
      }
    }
    return { name: (manager.name || '').trim(), email: (manager.email || '').trim() };
  }).filter(manager => manager.name || getContactLinkedUserId(manager));
}

export function getOwnerNames(owners) {
  return normalizeOwners(owners).map(resolvedContactLabel).filter(Boolean);
}

export function getManagerNames(managers) {
  return normalizeManagers(managers).map(resolvedContactLabel).filter(Boolean);
}

export function getFirstOwnerName(owners) {
  const normalized = normalizeOwners(owners);
  return normalized.length > 0 ? resolvedContactLabel(normalized[0]) : '';
}

export function getFirstOwnerLastName(owners) {
  const normalized = normalizeOwners(owners);
  if (normalized.length === 0) return '';
  const label = resolvedContactLabel(normalized[0]);
  if (!label) return '';
  const nameParts = label.trim().split(/\s+/);
  if (nameParts.length > 1) return nameParts[nameParts.length - 1];
  return nameParts[0] || '';
}
