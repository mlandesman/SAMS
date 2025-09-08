import React, { useState, useEffect } from 'react';
import waterAPI from '../../api/waterAPI';
import './WaterReadingEntry.css';

const WaterReadingEntry = ({ clientId, units, year, month, onSaveSuccess }) => {
  const [readings, setReadings] = useState({});
  const [priorReadings, setPriorReadings] = useState({});
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
      
      // Get the aggregated data to see prior readings
      const response = await waterAPI.getAggregatedData(clientId, year);
      
      if (response.data && response.data.months[month]) {
        const monthData = response.data.months[month];
        const priors = {};
        const currentReadings = {};
        
        // Check if next month has data (meaning this month is locked)
        const nextMonth = month + 1;
        if (nextMonth < response.data.months.length && response.data.months[nextMonth]) {
          const nextMonthHasData = Object.values(response.data.months[nextMonth].units || {}).some(
            unit => unit.currentReading > 0
          );
          setMonthLocked(nextMonthHasData);
        }
        
        // Set up prior readings and current readings for each unit
        Object.entries(monthData.units).forEach(([unitId, unitData]) => {
          priors[unitId] = unitData.priorReading || 0;
          // If there's already a current reading, show it
          if (unitData.currentReading > 0) {
            currentReadings[unitId] = unitData.currentReading;
          }
        });
        
        // Load Common Area and Building Meter from backend structure
        if (monthData.commonArea) {
          // Common Area current reading
          if (monthData.commonArea.currentReading !== undefined) {
            setCommonAreaReading(monthData.commonArea.currentReading.toString());
          }
          // Common Area prior reading
          setPriorCommonAreaReading(monthData.commonArea.priorReading || 0);
        }
        
        // Building Meter
        if (monthData.buildingMeter) {
          // Building Meter current reading
          if (monthData.buildingMeter.currentReading !== undefined) {
            setBuildingMeterReading(monthData.buildingMeter.currentReading.toString());
          }
          // Building Meter prior reading
          setPriorBuildingMeterReading(monthData.buildingMeter.priorReading || 0);
        }
        
        setPriorReadings(priors);
        setReadings(currentReadings);
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

  const saveReadings = async () => {
    try {
      setSaving(true);
      setError('');
      setMessage('');
      
      // Prepare readings object matching the database structure
      const readingsToSave = {};
      let hasReadings = false;
      
      // Add unit readings
      units.forEach(unit => {
        const unitId = unit.unitId;
        if (readings[unitId] && parseInt(readings[unitId]) > 0) {
          readingsToSave[unitId] = parseInt(readings[unitId]);
          hasReadings = true;
        }
      });
      
      // Add Common Area reading
      if (commonAreaReading && parseInt(commonAreaReading) > 0) {
        readingsToSave.commonArea = parseInt(commonAreaReading);
        hasReadings = true;
      }
      
      // Add Building Meter reading
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
            <col style={{ width: '10%' }} />
            <col style={{ width: '25%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '25%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Unit</th>
              <th>Owner</th>
              <th>Prior Reading</th>
              <th>Current Reading</th>
              <th>Consumption (m³)</th>
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
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                  No units configured. Please check client configuration.
                </td>
              </tr>
            )}
            
            {/* Separator row */}
            <tr style={{ height: '10px', backgroundColor: '#f8f9fa' }}>
              <td colSpan="5" style={{ borderBottom: '2px solid #dee2e6' }}></td>
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