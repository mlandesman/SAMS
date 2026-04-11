/**
 * Utility functions for working with unit data
 */

import { normalizeOwners, resolvedContactLabel } from './unitContactUtils.js';

/**
 * Formats a unit ID with the owner's last name in parentheses
 * 
 * @param {Object} unit - The unit object with id and owner/owners properties
 * @return {string} Formatted string like "UnitID (LastName)"
 */
export function formatUnitIdWithOwner(unit) {
  if (!unit) return '';
  
  const unitId = unit.unitId || '';
  const { lastName } = getOwnerInfo(unit);
  return `${unitId} (${lastName})`;
}

/**
 * Extracts owner information from a unit object
 * 
 * @param {Object} unit - The unit object
 * @return {Object} Object containing unitId, firstName, lastName, and email
 */
export function getOwnerInfo(unit) {
  if (!unit) return { unitId: '', firstName: '', lastName: '', email: '' };
  
  const unitId = unit.unitId || '';

  let email = '';

  const normalized = normalizeOwners(
    Array.isArray(unit.owners) && unit.owners.length > 0
      ? unit.owners
      : unit.owner
        ? [typeof unit.owner === 'string' ? unit.owner : unit.owner]
        : []
  );

  const primary = normalized[0];
  if (primary && typeof primary === 'object') {
    email = (primary.email || '').trim();
  }

  const ownerLabel = primary ? resolvedContactLabel(primary) : '';

  const nameParts = ownerLabel.trim().split(/\s+/).filter(Boolean);
  let firstName = '';
  let lastName = '';

  if (nameParts.length >= 1) {
    firstName = nameParts[0];
    if (nameParts.length > 1) {
      lastName = nameParts[nameParts.length - 1];
    } else {
      lastName = nameParts[0];
    }
  }

  return {
    unitId,
    firstName,
    lastName,
    email
  };
}

/**
 * Sorts units by unit ID
 * 
 * @param {Array} units - Array of unit objects
 * @return {Array} Sorted array of unit objects
 */
export function sortUnitsByUnitId(units) {
  if (!Array.isArray(units)) return [];
  
  return [...units].sort((a, b) => {
    return (a.unitId || '').localeCompare(b.unitId || '');
  });
}

/**
 * Formats a unit ID with the owner's name and monthly dues amount
 * 
 * @param {Object} unit - The unit object with id, owner/owners, and duesAmount properties
 * @return {string} Formatted string like "UnitID (LastName) - $1,000/month"
 */
export function formatUnitIdWithOwnerAndDues(unit) {
  if (!unit) return '';
  
  const baseFormat = formatUnitIdWithOwner(unit);
  
  // Add dues amount if available
  if (unit.duesAmount && unit.duesAmount > 0) {
    const formattedDues = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(unit.duesAmount);
    
    return `${baseFormat} - ${formattedDues}/month`;
  }
  
  return baseFormat;
}

/**
 * Creates a formatted options array for use in select dropdowns
 * 
 * @param {Array} units - Array of unit objects
 * @return {Array} Array of objects with value and label properties
 */
export function createUnitSelectOptions(units) {
  if (!Array.isArray(units)) return [];
  
  return sortUnitsByUnitId(units).map(unit => ({
    value: unit.unitId,
    label: formatUnitIdWithOwner(unit)
  }));
}
