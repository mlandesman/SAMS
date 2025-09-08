import React from 'react';
import WaterHistoryTable from './WaterHistoryTable';

/**
 * Wrapper component that transforms simple water data structure to the format
 * expected by WaterHistoryTable (which expects arrays of readings/bills)
 */
function WaterHistoryTableWrapper({ waterData, selectedYear }) {
  console.log('🔄 [WaterHistoryTableWrapper] Transforming data for WaterHistoryTable');
  
  // Transform the simple data structure to what WaterHistoryTable expects
  const transformedData = {};
  
  if (waterData) {
    Object.entries(waterData).forEach(([unitId, unitData]) => {
      // Create a fake readings array with monthly data
      // For now, just show the current month's data
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = selectedYear || new Date().getFullYear();
      
      transformedData[unitId] = {
        unitId: unitData.unitId,
        readings: [
          {
            reading: unitData.reading,
            date: { _seconds: new Date(currentYear, currentMonth - 1, 28).getTime() / 1000 },
            notes: 'Current reading'
          }
        ],
        bills: unitData.amount ? [
          {
            billingMonth: `${currentYear}-${String(currentMonth).padStart(2, '0')}`,
            amount: unitData.amount,
            paid: unitData.paid,
            consumption: unitData.consumption
          }
        ] : [],
        summary: {
          totalPaid: unitData.paid ? unitData.amount : 0,
          totalBilled: unitData.amount || 0
        }
      };
      
      // Add prior reading if available
      if (unitData.priorReading) {
        transformedData[unitId].readings.unshift({
          reading: unitData.priorReading,
          date: { _seconds: new Date(currentYear, currentMonth - 2, 28).getTime() / 1000 },
          notes: 'Prior reading'
        });
      }
    });
  }
  
  console.log('✅ [WaterHistoryTableWrapper] Transformed data:', {
    unitCount: Object.keys(transformedData).length,
    sampleUnit: transformedData['101']
  });
  
  return <WaterHistoryTable waterData={transformedData} selectedYear={selectedYear} />;
}

export default WaterHistoryTableWrapper;