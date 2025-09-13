import React, { useState, useEffect } from 'react';
import waterAPI from '../../api/waterAPI';
import './WaterReadingEntry.css';

const WaterReadingEntry = ({ clientId, units, year, month, onSaveSuccess }) => {
  
  const [readings, setReadings] = useState({});
  const [priorReadings, setPriorReadings] = useState({});
  const [carWashCounts, setCarWashCounts] = useState({});
  const [boatWashCounts, setBoatWashCounts] = useState({});
  const [commonAreaReading, setCommonAreaReading] = useState('');
  const [priorCommonAreaReading, setPriorCommonAreaReading] = useState(0);
  const [buildingMeterReading, setBuildingMeterReading] = useState('');
  const [priorBuildingMeterReading, setPriorBuildingMeterReading] = useState(0);
  const [monthLocked, setMonthLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Month names for display
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Fiscal month names (AVII starts July)
  const fiscalMonthNames = [
    'July', 'August', 'September', 'October', 'November', 'December',
    'January', 'February', 'March', 'April', 'May', 'June'
  ];

  // Get calendar month/year from fiscal month/year
  const getCalendarDate = (fiscalYear, fiscalMonth) => {
    if (fiscalMonth < 6) {
      // July-December (months 0-5) are in previous calendar year
      return {
        calendarMonth: fiscalMonth + 6,
        calendarYear: fiscalYear - 1
      };
    } else {
      // January-June (months 6-11) are in same calendar year
      return {
        calendarMonth: fiscalMonth - 6,
        calendarYear: fiscalYear
      };
    }
  };

  useEffect(() => {
    if (clientId && year && month !== undefined) {
      loadPriorReadings();
    }
  }, [clientId, year, month]);

  const loadPriorReadings = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Get the aggregated data to see prior readings and month status
      const response = await waterAPI.getAggregatedData(clientId, year);
      console.log('🔍 Raw aggregated data response:', JSON.stringify(response.data, null, 2));
      
      const monthData = response.data.months?.find(m => m.month === month);
      console.log(`🔍 Looking for month ${month} data:`, monthData ? 'found' : 'not found');
      
      let priors = {};
      
      // Check if next month has data (meaning this month is locked)
      const nextMonth = month + 1;
      const nextMonthData = response.data.months?.find(m => m.month === nextMonth);
      if (nextMonthData) {
        const nextMonthHasData = Object.values(nextMonthData.units || {}).some(
          unit => unit.currentReading > 0
        );
        setMonthLocked(nextMonthHasData);
      }
      
      // Extract prior readings from the previous month's currentReading data in aggregated response
      const priorMonth = month - 1;
      
      // Handle fiscal year boundary (month -1 should be month 11 of previous fiscal year)
      if (priorMonth < 0) {
        // For now, use the fallback method since we'd need prior fiscal year data
        if (monthData) {
          Object.entries(monthData.units).forEach(([unitId, unitData]) => {
            priors[unitId] = unitData.priorReading || 0;
          });
          
          if (monthData.commonArea) {
            setPriorCommonAreaReading(monthData.commonArea.priorReading || 0);
          }
          if (monthData.buildingMeter) {
            setPriorBuildingMeterReading(monthData.buildingMeter.priorReading || 0);
          }
        }
      } else {
        // Look for the prior month's data in the aggregated response
        console.log(`🔍 Looking for prior month ${priorMonth} data for current month ${month}`);
        console.log('🔍 Available months in aggregated data:', response.data.months?.length, response.data.months?.map(m => m.month));
        const priorMonthData = response.data.months?.find(m => m.month === priorMonth);
        console.log('🔍 Prior month data from aggregated:', priorMonthData ? 'found' : 'not found', JSON.stringify(priorMonthData, null, 2));
        
        if (priorMonthData && priorMonthData.units) {
          // Extract current readings from prior month to use as this month's priors
          Object.entries(priorMonthData.units).forEach(([unitId, unitData]) => {
            if (unitData.currentReading) {
              if (typeof unitData.currentReading === 'object' && unitData.currentReading.reading !== undefined) {
                // New nested format: use the reading value
                priors[unitId] = unitData.currentReading.reading;
              } else if (typeof unitData.currentReading === 'number') {
                // Legacy flat format
                priors[unitId] = unitData.currentReading;
              }
            } else {
              // Fallback to priorReading if no currentReading
              priors[unitId] = unitData.priorReading || 0;
            }
          });
          
          // Handle Common Area
          if (priorMonthData.commonArea && priorMonthData.commonArea.currentReading !== undefined) {
            setPriorCommonAreaReading(priorMonthData.commonArea.currentReading);
          } else if (monthData && monthData.commonArea) {
            setPriorCommonAreaReading(monthData.commonArea.priorReading || 0);
          }
          
          // Handle Building Meter
          if (priorMonthData.buildingMeter && priorMonthData.buildingMeter.currentReading !== undefined) {
            setPriorBuildingMeterReading(priorMonthData.buildingMeter.currentReading);
          } else if (monthData && monthData.buildingMeter) {
            setPriorBuildingMeterReading(monthData.buildingMeter.priorReading || 0);
          }
          
          console.log('🔍 Updated priors from prior month currentReadings:', priors);
        } else if (monthData) {
          // Fallback to current month's priorReading values if available
          Object.entries(monthData.units).forEach(([unitId, unitData]) => {
            priors[unitId] = unitData.priorReading || 0;
          });
          
          if (monthData.commonArea) {
            setPriorCommonAreaReading(monthData.commonArea.priorReading || 0);
          }
          if (monthData.buildingMeter) {
            setPriorBuildingMeterReading(monthData.buildingMeter.priorReading || 0);
          }
        }
      }
      
      setPriorReadings(priors);
      
      // Now try to load saved readings for this specific month in the new nested format
      try {
        const savedReadingsResponse = await waterAPI.getReadings ? 
          await waterAPI.getReadings(clientId, year, month) :
          await waterAPI.getMonthReadings(clientId, year, month);
        
        if (savedReadingsResponse.data && savedReadingsResponse.data.readings) {
          const savedReadings = savedReadingsResponse.data.readings;
          console.log('🔍 Raw saved readings data:', JSON.stringify(savedReadings, null, 2));
          const readings = {};
          const carWashes = {};
          const boatWashes = {};
          
          // Parse nested readings data
          Object.entries(savedReadings).forEach(([unitId, data]) => {
            if (unitId === 'commonArea') {
              // Handle common area (flat number for now)
              if (typeof data === 'number') {
                setCommonAreaReading(data.toString());
              }
            } else if (unitId === 'buildingMeter') {
              // Handle building meter (flat number for now)
              if (typeof data === 'number') {
                setBuildingMeterReading(data.toString());
              }
            } else {
              // Handle unit readings with nested data
              if (typeof data === 'object' && data !== null) {
                // New nested format: {reading: 1780, carWashCount: 2, boatWashCount: 1}
                if (data.reading !== undefined && data.reading !== null) {
                  readings[unitId] = data.reading.toString();
                }
                carWashes[unitId] = data.carWashCount || 0;
                boatWashes[unitId] = data.boatWashCount || 0;
              } else if (typeof data === 'number') {
                // Legacy flat format fallback
                readings[unitId] = data.toString();
                carWashes[unitId] = 0;
                boatWashes[unitId] = 0;
              }
            }
          });
          
          // Update state with loaded data
          setReadings(readings);
          setCarWashCounts(carWashes);
          setBoatWashCounts(boatWashes);
          
        }
      } catch (readingsError) {
        // If there's no saved readings for this month, that's normal
        console.log('No saved readings found for this month (normal for new months)');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading prior readings:', error);
      setError('Failed to load prior readings');
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (!num && num !== 0) return '';
    return new Intl.NumberFormat('en-US').format(num);
  };

  const calculateConsumption = (unitId) => {
    const current = parseInt(readings[unitId]) || 0;
    const prior = priorReadings[unitId] || 0;
    
    if (current > 0 && prior > 0 && current >= prior) {
      return current - prior;
    }
    return 0;
  };

  const updateReading = (unitId, value) => {
    // Only allow numbers
    const numValue = value.replace(/[^0-9]/g, '');
    setReadings(prev => ({
      ...prev,
      [unitId]: numValue
    }));
  };

  const updateCarWashCount = (unitId, value) => {
    const numValue = value.replace(/[^0-9]/g, '');
    const count = parseInt(numValue) || 0;
    setCarWashCounts(prev => ({
      ...prev,
      [unitId]: count
    }));
  };

  const updateBoatWashCount = (unitId, value) => {
    const numValue = value.replace(/[^0-9]/g, '');
    const count = parseInt(numValue) || 0;
    setBoatWashCounts(prev => ({
      ...prev,
      [unitId]: count
    }));
  };

  const saveReadings = async () => {
    try {
      setSaving(true);
      setError('');
      setMessage('');
      
      // Prepare readings object matching the database structure
      const readingsToSave = {};
      let hasReadings = false;
      
      // Add unit readings with wash counts
      units.forEach(unit => {
        const unitId = unit.unitId;
        const reading = readings[unitId] && parseInt(readings[unitId]) > 0 ? parseInt(readings[unitId]) : null;
        const carWashes = carWashCounts[unitId] || 0;
        const boatWashes = boatWashCounts[unitId] || 0;
        
        // Save if there's a reading OR wash counts
        if (reading || carWashes > 0 || boatWashes > 0) {
          readingsToSave[unitId] = {
            reading: reading,
            carWashCount: carWashes,
            boatWashCount: boatWashes
          };
          hasReadings = true;
        }
      });
      
      // Add Common Area reading (no wash counts)
      if (commonAreaReading && parseInt(commonAreaReading) > 0) {
        readingsToSave.commonArea = parseInt(commonAreaReading);
        hasReadings = true;
      }
      
      // Add Building Meter reading (no wash counts)
      if (buildingMeterReading && parseInt(buildingMeterReading) > 0) {
        readingsToSave.buildingMeter = parseInt(buildingMeterReading);
        hasReadings = true;
      }
      
      // Check if any readings were entered
      if (!hasReadings) {
        setError('Please enter at least one reading');
        setSaving(false);
        return;
      }
      
      
      // Save using the new endpoint
      await waterAPI.saveReadings(clientId, year, month, readingsToSave);
      
      const { calendarMonth, calendarYear } = getCalendarDate(year, month);
      setMessage(`Successfully saved readings for ${monthNames[calendarMonth]} ${calendarYear}`);
      
      // Call parent callback if provided
      if (onSaveSuccess) {
        onSaveSuccess();
      }
      
      // Reload to show updated data
      setTimeout(() => {
        loadPriorReadings();
      }, 1000);
      
    } catch (error) {
      console.error('Error saving readings:', error);
      setError(error.response?.data?.error || 'Failed to save readings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading-container">Loading meter readings...</div>;
  }

  const { calendarMonth, calendarYear } = getCalendarDate(year, month);

  return (
    <div className="water-reading-entry-container">
      <div className="entry-header">
        <h3>Enter Water Meter Readings</h3>
        <div className="period-display">
          Reading Period: <strong>{monthNames[calendarMonth]} {calendarYear}</strong>
          <span className="fiscal-note">(FY {year} Month {month + 1})</span>
        </div>
      </div>

      {saving && (
        <div className="saving-indicator">
          <i className="fas fa-spinner fa-spin"></i> Saving readings...
        </div>
      )}

      {message && (
        <div className="success-message">
          <i className="fas fa-check-circle"></i> {message}
        </div>
      )}

      {error && (
        <div className="error-message">
          <i className="fas fa-exclamation-triangle"></i> {error}
        </div>
      )}

      <div className="reading-table-container">
        <table className="hoa-table reading-entry-table">
          <colgroup>
            <col style={{ width: '8%' }} />
            <col style={{ width: '22%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '11%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Unit</th>
              <th>Owner</th>
              <th>Prior Reading</th>
              <th>Current Reading</th>
              <th>Consumption (m³)</th>
              <th>Car Washes</th>
              <th>Boat Washes</th>
            </tr>
          </thead>
          <tbody>
            {units && units.length > 0 ? (
              units.map(unit => {
                const unitId = unit.unitId || unit.id;
                const consumption = calculateConsumption(unitId);
                const hasHighConsumption = consumption > 100; // Flag if over 100 m³
                
                return (
                  <tr key={unitId} className={hasHighConsumption ? 'high-consumption' : ''}>
                    <td className="unit-id">{unitId}</td>
                    <td className="owner-name">
                      {unit.ownerLastName || unit.ownerName || 'No Name Available'}
                    </td>
                    <td className="prior-reading">
                      {formatNumber(priorReadings[unitId] || 0)}
                    </td>
                    <td className="current-reading">
                      {monthLocked ? (
                        <div style={{ textAlign: 'right', fontSize: '18px', color: '#6c757d', fontFamily: 'Courier New, monospace' }}>
                          {formatNumber(readings[unitId] || 0)}
                        </div>
                      ) : (
                        <input 
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={readings[unitId] || ''}
                          onChange={(e) => updateReading(unitId, e.target.value)}
                          className="reading-input"
                          placeholder="Enter reading"
                          disabled={saving}
                        />
                      )}
                    </td>
                    <td className={`consumption ${hasHighConsumption ? 'high' : ''}`}>
                      {consumption > 0 ? formatNumber(consumption) : '-'}
                      {hasHighConsumption && (
                        <span className="warning-icon" title="High consumption detected">
                          <i className="fas fa-exclamation-triangle"></i>
                        </span>
                      )}
                    </td>
                    <td className="wash-count">
                      {monthLocked ? (
                        <div style={{ textAlign: 'center' }}>
                          {carWashCounts[unitId] || 0}
                        </div>
                      ) : (
                        <input 
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={carWashCounts[unitId] || ''}
                          onChange={(e) => updateCarWashCount(unitId, e.target.value)}
                          className="wash-input"
                          placeholder="0"
                          disabled={saving}
                          style={{ width: '50px', textAlign: 'center' }}
                        />
                      )}
                    </td>
                    <td className="wash-count">
                      {monthLocked ? (
                        <div style={{ textAlign: 'center' }}>
                          {boatWashCounts[unitId] || 0}
                        </div>
                      ) : (
                        <input 
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={boatWashCounts[unitId] || ''}
                          onChange={(e) => updateBoatWashCount(unitId, e.target.value)}
                          className="wash-input"
                          placeholder="0"
                          disabled={saving}
                          style={{ width: '50px', textAlign: 'center' }}
                        />
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>
                  No units configured. Please check client configuration.
                </td>
              </tr>
            )}
            
            {/* Separator row */}
            <tr style={{ height: '10px', backgroundColor: '#f8f9fa' }}>
              <td colSpan="7" style={{ borderBottom: '2px solid #dee2e6' }}></td>
            </tr>
            
            {/* Common Area row */}
            <tr style={{ backgroundColor: '#e8f4f8' }}>
              <td className="unit-id" style={{ fontWeight: 'bold' }}>CA</td>
              <td className="owner-name" style={{ fontStyle: 'italic' }}>Common Area</td>
              <td className="prior-reading">
                {formatNumber(priorCommonAreaReading)}
              </td>
              <td className="current-reading">
                {monthLocked ? (
                  <div style={{ textAlign: 'right', fontSize: '18px', color: '#6c757d', fontFamily: 'Courier New, monospace' }}>
                    {formatNumber(commonAreaReading || 0)}
                  </div>
                ) : (
                  <input 
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={commonAreaReading || ''}
                    onChange={(e) => setCommonAreaReading(e.target.value.replace(/[^0-9]/g, ''))}
                    className="reading-input"
                    placeholder="Enter reading"
                    disabled={saving}
                  />
                )}
              </td>
              <td className="consumption">
                {(parseInt(commonAreaReading) || 0) > priorCommonAreaReading ? 
                  formatNumber((parseInt(commonAreaReading) || 0) - priorCommonAreaReading) : '-'}
              </td>
              <td className="wash-count" style={{ color: '#6c757d', fontStyle: 'italic', textAlign: 'center' }}>
                -
              </td>
              <td className="wash-count" style={{ color: '#6c757d', fontStyle: 'italic', textAlign: 'center' }}>
                -
              </td>
            </tr>
            
            {/* Building Meter row */}
            <tr style={{ backgroundColor: '#e8f4f8' }}>
              <td className="unit-id" style={{ fontWeight: 'bold' }}>BM</td>
              <td className="owner-name" style={{ fontStyle: 'italic' }}>Building Meter</td>
              <td className="prior-reading">
                {formatNumber(priorBuildingMeterReading)}
              </td>
              <td className="current-reading">
                {monthLocked ? (
                  <div style={{ textAlign: 'right', fontSize: '18px', color: '#6c757d', fontFamily: 'Courier New, monospace' }}>
                    {formatNumber(buildingMeterReading || 0)}
                  </div>
                ) : (
                  <input 
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={buildingMeterReading || ''}
                    onChange={(e) => setBuildingMeterReading(e.target.value.replace(/[^0-9]/g, ''))}
                    className="reading-input"
                    placeholder="Enter reading"
                    disabled={saving}
                  />
                )}
              </td>
              <td className="consumption">
                {(parseInt(buildingMeterReading) || 0) > priorBuildingMeterReading ? 
                  formatNumber((parseInt(buildingMeterReading) || 0) - priorBuildingMeterReading) : '-'}
              </td>
              <td className="wash-count" style={{ color: '#6c757d', fontStyle: 'italic', textAlign: 'center' }}>
                -
              </td>
              <td className="wash-count" style={{ color: '#6c757d', fontStyle: 'italic', textAlign: 'center' }}>
                -
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="entry-actions">
        {monthLocked ? (
          <div style={{ padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px', color: '#856404' }}>
            <i className="fas fa-lock"></i> This month is locked because readings have been entered for the following month.
          </div>
        ) : (
          <>
            <button 
              onClick={() => {
                setReadings({});
                setCarWashCounts({});
                setBoatWashCounts({});
                setCommonAreaReading('');
                setBuildingMeterReading('');
              }}
              disabled={saving}
              className="btn btn-secondary"
            >
              Clear All
            </button>
            <button 
              onClick={saveReadings}
              disabled={saving}
              className="btn btn-primary save-btn"
            >
              {saving ? 'Saving...' : 'Save Readings'}
            </button>
          </>
        )}
      </div>

      <div className="entry-tips">
        <h4>Tips:</h4>
        <ul>
          <li>Enter meter readings in cubic meters (m³)</li>
          <li>Consumption is automatically calculated</li>
          <li>Yellow highlight indicates high consumption (&gt;100 m³)</li>
          <li>You can save partial readings and complete them later</li>
        </ul>
      </div>
    </div>
  );
};

export default WaterReadingEntry;