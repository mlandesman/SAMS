// MINIMAL Water Readings Controller - Phase 1 ONLY
import waterReadingsService from '../services/waterReadingsService.js';

// Save readings
export const saveReadings = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { year, month, readings } = req.body;
    
    console.log(`Saving water readings: clientId=${clientId}, year=${year}, month=${month}`);
    
    const result = await waterReadingsService.saveReadings(
      clientId, year, month, readings
    );
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error saving readings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get month readings  
export const getMonthReadings = async (req, res) => {
  try {
    const { clientId, year, month } = req.params;
    
    const data = await waterReadingsService.getMonthReadings(
      clientId, parseInt(year), parseInt(month)
    );
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error getting readings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get year readings for history
export const getYearReadings = async (req, res) => {
  try {
    const { clientId, year } = req.params;
    
    const readings = await waterReadingsService.getYearReadings(
      clientId, parseInt(year)
    );
    
    // Create 12-month array for display
    // Now readings contain objects with {reading, consumption, prior}
    // Extract just the reading values for simple display
    const months = [];
    for (let i = 0; i < 12; i++) {
      const monthData = readings[i] || {};
      const simplifiedMonth = {};
      
      // Convert from {reading, consumption} to just the reading value
      for (const unitId in monthData) {
        // If it's an object with reading property, extract it
        if (typeof monthData[unitId] === 'object' && monthData[unitId].reading !== undefined) {
          simplifiedMonth[unitId] = monthData[unitId].reading;
        } else {
          // Fallback for any direct values
          simplifiedMonth[unitId] = monthData[unitId];
        }
      }
      
      months.push(simplifiedMonth);
    }
    
    res.json({ 
      success: true, 
      year: parseInt(year),
      months,
      // Also include the full data with consumption for future use
      detailedData: readings
    });
  } catch (error) {
    console.error('Error getting year readings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};