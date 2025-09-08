// src/utils/hoaDuesImporter.js
// Using import.meta.glob to dynamically import JSON data
import hoaDuesDataJSON from '/src/assets/HOA_Dues_Export.json';
import unitsDataJSON from '/src/assets/Units.json';

/**
 * Import and convert HOA dues data from the external JSON file
 * @returns {Object} Object containing { units, duesData }
 */
export function importHOADuesData() {
  try {
    // Convert units data to the format we need
    const units = unitsData.map(unit => {
      // For multi-word last names like "Garcia Reyes", we want to keep the full last name
      const nameParts = unit.Owner.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      
      return {
        id: unit.UnitID,
        owner: lastName || firstName, // Use last name or full name if no space
        duesAmount: unit.Dues
      };
    });

    // The dues data is already structured correctly, with unit ID as key
    // We'll create a copy and omit the totalPaid and outstanding fields as requested
    const duesData = {};
    
    // Copy duesData but exclude totalPaid and outstanding fields
    Object.keys(hoaDuesData).forEach(unitId => {
      const { totalPaid, outstanding, ...unitData } = hoaDuesData[unitId];
      duesData[unitId] = unitData;
    });
    
    // Make sure each unit has all 12 months in the payments array
    Object.keys(duesData).forEach(unitId => {
      const unit = duesData[unitId];
      
      // Initialize empty payments array if needed
      if (!unit.payments) {
        unit.payments = [];
      }
      
      // Ensure we have entries for all 12 months
      const existingMonths = unit.payments.map(payment => payment.month);
      
      for (let month = 1; month <= 12; month++) {
        if (!existingMonths.includes(month)) {
          unit.payments.push({
            month,
            paid: 0,
            notes: ''
          });
        }
      }
      
      // Sort payments by month
      unit.payments.sort((a, b) => a.month - b.month);
    });
    
    return { units, duesData };
  } catch (error) {
    console.error('Error importing HOA dues data:', error);
    return { units: [], duesData: {} };
  }
}
