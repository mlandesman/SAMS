import React from 'react';
import './WaterHistoryTable.css';

function SimpleWaterHistoryTable({ waterData, selectedYear }) {
  console.log('🎯 [SimpleWaterHistoryTable] Rendering with:', {
    waterDataKeys: waterData ? Object.keys(waterData) : null,
    selectedYear,
    hasWaterData: !!waterData,
    sampleUnit: waterData && Object.keys(waterData)[0] ? waterData[Object.keys(waterData)[0]] : null
  });

  // Get all units from waterData
  const units = Object.keys(waterData || {}).sort((a, b) => {
    const aNum = parseInt(a);
    const bNum = parseInt(b);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum;
    }
    return a.localeCompare(b);
  });

  console.log('📊 [SimpleWaterHistoryTable] Units found:', units);

  if (!waterData || units.length === 0) {
    return (
      <div className="water-history-table">
        <div className="empty-state">
          <p>No water data available for {selectedYear}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="water-history-table">
      <table className="history-table">
        <thead>
          <tr>
            <th>Unit</th>
            <th>Current Reading</th>
            <th>Prior Reading</th>
            <th>Consumption</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {units.map(unitId => {
            const unitData = waterData[unitId];
            return (
              <tr key={unitId}>
                <td>{unitId}</td>
                <td>{unitData.reading || 0}</td>
                <td>{unitData.priorReading || 0}</td>
                <td>{unitData.consumption || 0} gal</td>
                <td>${((unitData.amount || 0) / 100).toFixed(2)}</td>
                <td>
                  <span className={`status-badge ${unitData.paid ? 'paid' : 'unpaid'}`}>
                    {unitData.paid ? 'Paid' : 'Unpaid'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th>Total</th>
            <th></th>
            <th></th>
            <th>
              {units.reduce((sum, unitId) => sum + (waterData[unitId].consumption || 0), 0)} gal
            </th>
            <th>
              ${(units.reduce((sum, unitId) => sum + (waterData[unitId].amount || 0), 0) / 100).toFixed(2)}
            </th>
            <th>
              {units.filter(unitId => waterData[unitId].paid).length} / {units.length} Paid
            </th>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default SimpleWaterHistoryTable;