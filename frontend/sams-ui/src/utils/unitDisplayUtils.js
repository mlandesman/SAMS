/**
 * Utility functions for displaying unit names intelligently
 */

/**
 * Format unit display name based on unitName and unitId
 * 
 * Rules:
 * 1. If no unitName, return unitId
 * 2. If unitName starts with unitId, return just unitName (avoids "105/205 (105)")
 * 3. Otherwise return "unitName (unitId)" for clarity
 * 
 * @param {Object} unit - Unit object with unitId and optional unitName
 * @returns {string} Formatted display name
 */
export function formatUnitDisplay(unit) {
  if (!unit) return '';
  
  const { unitId, unitName } = unit;
  
  // No custom name, just use ID
  if (!unitName || unitName === unitId) {
    return unitId;
  }
  
  // Check if unitName starts with unitId
  // This handles cases like unitId="105", unitName="105/205"
  if (unitName.startsWith(unitId)) {
    return unitName;
  }
  
  // For completely different names, show both
  // e.g., unitId="PH4D", unitName="Michael's Condo" => "Michael's Condo (PH4D)"
  return `${unitName} (${unitId})`;
}

/**
 * Get unit display name from either a unit object or separate id/name
 * 
 * @param {string|Object} unitIdOrObject - Unit ID string or unit object
 * @param {string} [unitName] - Optional unit name if first param is ID
 * @returns {string} Formatted display name
 */
export function getUnitDisplayName(unitIdOrObject, unitName) {
  // Handle object input
  if (typeof unitIdOrObject === 'object' && unitIdOrObject !== null) {
    return formatUnitDisplay(unitIdOrObject);
  }
  
  // Handle separate parameters
  return formatUnitDisplay({
    unitId: unitIdOrObject,
    unitName: unitName
  });
}

/**
 * Examples:
 * 
 * formatUnitDisplay({ unitId: "105", unitName: "105/205" }) => "105/205"
 * formatUnitDisplay({ unitId: "106", unitName: "106/206" }) => "106/206"
 * formatUnitDisplay({ unitId: "PH4D", unitName: "Michael's Condo" }) => "Michael's Condo (PH4D)"
 * formatUnitDisplay({ unitId: "101", unitName: "101" }) => "101"
 * formatUnitDisplay({ unitId: "102", unitName: null }) => "102"
 */