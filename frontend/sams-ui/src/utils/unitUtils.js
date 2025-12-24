/**
 * Utility functions for working with unit data
 */

/**
 * Formats a unit ID with the owner's last name in parentheses
 * 
 * @param {Object} unit - The unit object with id and owner/owners properties
 * @return {string} Formatted string like "UnitID (LastName)"
 */
export function formatUnitIdWithOwner(unit) {
  if (!unit) return '';
  
  const unitId = unit.unitId || '';
  
  // Check for owner information in different possible properties
  let ownerName = '';
  
  // First try the owners array (primary data structure) - handle both old format ["name"] and new format [{name, email}]
  if (Array.isArray(unit.owners) && unit.owners.length > 0) {
    const firstOwner = unit.owners[0];
    if (typeof firstOwner === 'string') {
      ownerName = firstOwner;
    } else if (firstOwner && typeof firstOwner === 'object') {
      ownerName = firstOwner.name || '';
    }
  } 
  // Fall back to owner property if owners array isn't available
  else if (unit.owner) {
    ownerName = typeof unit.owner === 'string' ? unit.owner : (unit.owner.name || '');
  }
  
  // Extract last name from the owner's full name
  let lastName = '';
  
  if (ownerName) {
    // First try to match a name with spaces (e.g., "First Last")
    const lastNameMatch = ownerName.match(/\s(\S+)$/);
    if (lastNameMatch) {
      lastName = lastNameMatch[1];
    } else {
      // If no space found, use the whole name
      lastName = ownerName;
    }
  }
  
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
  
  // Check for owner information in different possible properties
  let ownerName = '';
  let email = '';
  
  // First try the owners array (handle both old format ["name"] and new format [{name, email}])
  if (Array.isArray(unit.owners) && unit.owners.length > 0) {
    const firstOwner = unit.owners[0];
    if (typeof firstOwner === 'string') {
      ownerName = firstOwner;
    } else if (firstOwner && typeof firstOwner === 'object') {
      ownerName = firstOwner.name || '';
      email = firstOwner.email || '';
    }
  } 
  // Fall back to owner property if owners array isn't available
  else if (unit.owner) {
    ownerName = typeof unit.owner === 'string' ? unit.owner : (unit.owner.name || '');
  }
  
  // Extract first and last name (handle case where ownerName might be empty or not a string)
  if (!ownerName || typeof ownerName !== 'string') {
    ownerName = '';
  }
  const nameParts = ownerName.trim().split(/\s+/);
  let firstName = '';
  let lastName = '';
  
  if (nameParts.length >= 1) {
    firstName = nameParts[0];
    // Last name is the last part of the name
    if (nameParts.length > 1) {
      lastName = nameParts[nameParts.length - 1];
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
