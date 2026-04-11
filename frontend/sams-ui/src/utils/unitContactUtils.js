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

/** Label for a resolved unit owner/manager object from the API (name, email, optional userId). */
export function resolvedContactLabel(contact = {}) {
  const name = (contact.name || '').trim();
  if (name) return name;
  const email = (contact.email || '').trim();
  if (email) return email;
  return '';
}

export function normalizeOwners(owners) {
  if (!Array.isArray(owners)) return [];
  return owners.map(owner => {
    if (typeof owner === 'string') {
      console.warn('⚠️  Found legacy string format owner - should be migrated:', owner);
      return { name: owner.trim(), email: '' };
    }
    if (owner && typeof owner === 'object' && typeof owner.userId === 'string' && owner.userId.trim()) {
      return {
        userId: owner.userId.trim(),
        name: (owner.name || '').trim(),
        email: (owner.email || '').trim()
      };
    }
    return { name: (owner.name || '').trim(), email: (owner.email || '').trim() };
  }).filter(owner => owner.name || owner.userId);
}

export function normalizeManagers(managers) {
  if (!Array.isArray(managers)) return [];
  return managers.map(manager => {
    if (typeof manager === 'string') {
      console.warn('⚠️  Found legacy string format manager - should be migrated:', manager);
      return { name: manager.trim(), email: '' };
    }
    if (manager && typeof manager === 'object' && typeof manager.userId === 'string' && manager.userId.trim()) {
      return {
        userId: manager.userId.trim(),
        name: (manager.name || '').trim(),
        email: (manager.email || '').trim()
      };
    }
    return { name: (manager.name || '').trim(), email: (manager.email || '').trim() };
  }).filter(manager => manager.name || manager.userId);
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
