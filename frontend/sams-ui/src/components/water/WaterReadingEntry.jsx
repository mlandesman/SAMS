import React, { useState, useEffect } from 'react';
import { useWaterBills } from '../../context/WaterBillsContext';
import waterAPI from '../../api/waterAPI';
import WashModal from './WashModal';
import './WaterReadingEntry.css';

const WaterReadingEntry = ({ clientId, units, year, month, onSaveSuccess }) => {
  const { waterData, loading: contextLoading, refreshData } = useWaterBills();
  
  const [readings, setReadings] = useState({});
  const [priorReadings, setPriorReadings] = useState({});
  const [carWashCounts, setCarWashCounts] = useState({}); // Legacy: for backwards compatibility
  const [boatWashCounts, setBoatWashCounts] = useState({}); // Legacy: for backwards compatibility
  const [washes, setWashes] = useState({}); // New: washes array by unitId
  const [commonAreaReading, setCommonAreaReading] = useState('');
  const [priorCommonAreaReading, setPriorCommonAreaReading] = useState(0);
  const [buildingMeterReading, setBuildingMeterReading] = useState('');
  const [priorBuildingMeterReading, setPriorBuildingMeterReading] = useState(0);
  const [monthLocked, setMonthLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [readingPeriod, setReadingPeriod] = useState('');
  
  // Modal state
  const [washModalOpen, setWashModalOpen] = useState(false);
  const [currentEditingUnit, setCurrentEditingUnit] = useState(null);
  
  // Wash rates from aggregated data
  const [carWashRate, setCarWashRate] = useState(100);
  const [boatWashRate, setBoatWashRate] = useState(200);

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
    if (clientId && year && month !== undefined && waterData && Object.keys(waterData).length > 0) {
      loadPriorReadings();
    }
  }, [clientId, year, month, waterData]);

  const loadPriorReadings = async () => {
    try {
      setLoading(contextLoading); // Use context loading state
      setError('');
      
      // Use data from context instead of making API call
      console.log('🔍 [WaterReadingEntry] Using waterData from context (no API call):', Object.keys(waterData));
      
      // Extract wash rates from context data
      if (waterData.carWashRate !== undefined) {
        setCarWashRate(waterData.carWashRate);
      }
      if (waterData.boatWashRate !== undefined) {
        setBoatWashRate(waterData.boatWashRate);
      }
      
      const monthData = waterData.months?.find(m => m.month === month);
      console.log(`🔍 Month data for month ${month}:`, monthData);
      console.log(`🔍 Month data readingDate:`, monthData?.readingDate);
      console.log(`🔍 Looking for month ${month} data:`, monthData ? 'found' : 'not found');
      
      let priors = {};
      
      // Check if next month has data (meaning this month is locked)
      const nextMonth = month + 1;
      const nextMonthData = waterData.months?.find(m => m.month === nextMonth);
      if (nextMonthData) {
        const nextMonthHasData = Object.values(nextMonthData.units || {}).some(
          unit => unit.currentReading > 0
        );
        setMonthLocked(nextMonthHasData);
      }
      
      // Extract prior readings from the previous month's currentReading data in aggregated response
      const priorMonth = month - 1;
      
      // Calculate reading period from timestamps (after priorMonth is defined)
      const priorMonthData = waterData.months?.find(m => m.month === priorMonth);
      console.log(`🔍 Reading period calculation:`, { 
        priorMonth, 
        priorMonthData: priorMonthData ? 'found' : 'not found',
        priorReadingDate: priorMonthData?.readingDate,
        monthData: monthData ? 'found' : 'not found',
        currentReadingDate: monthData?.readingDate 
      });
      
      if (priorMonthData?.readingDate || monthData?.readingDate) {
        const startDate = priorMonthData?.readingDate 
          ? new Date(priorMonthData.readingDate.toDate ? priorMonthData.readingDate.toDate() : priorMonthData.readingDate)
          : null;
        const endDate = monthData?.readingDate
          ? new Date(monthData.readingDate.toDate ? monthData.readingDate.toDate() : monthData.readingDate)
          : new Date(); // Use today's date if no reading saved yet
        
        console.log(`🔍 Date objects:`, { startDate, endDate });
        
        if (startDate && endDate) {
          const formatDate = (date) => {
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const year = date.getFullYear();
            return `${month}/${day}/${year}`;
          };
          const periodString = `${formatDate(startDate)} - ${formatDate(endDate)}`;
          console.log(`🔍 Setting reading period to:`, periodString);
          setReadingPeriod(periodString);
        }
      } else {
        console.log(`🔍 No reading dates found, keeping fallback`);
      }
      
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
        // Look for the prior month's data in the context data
        console.log(`🔍 Looking for prior month ${priorMonth} data for current month ${month}`);
        console.log('🔍 Available months in context data:', waterData.months?.length, waterData.months?.map(m => m.month));
        const priorMonthData = waterData.months?.find(m => m.month === priorMonth);
        console.log('🔍 Prior month data from context:', priorMonthData ? 'found' : 'not found', JSON.stringify(priorMonthData, null, 2));
        
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
      
      // Extract ALL current data from aggregated data (single source of truth)
      const readings = {};
      const carWashes = {};
      const boatWashes = {};
      const washesArrays = {};
      
      if (monthData) {
        // Extract building-level readings
        if (monthData.buildingMeter && monthData.buildingMeter.currentReading !== null && monthData.buildingMeter.currentReading !== undefined) {
          setBuildingMeterReading(monthData.buildingMeter.currentReading.toString());
        }
        if (monthData.commonArea && monthData.commonArea.currentReading !== null && monthData.commonArea.currentReading !== undefined) {
          setCommonAreaReading(monthData.commonArea.currentReading.toString());
        }
        
        // Extract unit readings and washes from aggregated data
        if (monthData.units) {
          Object.entries(monthData.units).forEach(([unitId, unitData]) => {
            if (unitData.currentReading) {
              if (typeof unitData.currentReading === 'object' && unitData.currentReading.reading !== undefined) {
                // Extract reading value
                readings[unitId] = unitData.currentReading.reading.toString();
                
                // Extract washes if they exist
                if (unitData.currentReading.washes && Array.isArray(unitData.currentReading.washes)) {
                  washesArrays[unitId] = unitData.currentReading.washes;
                  // Update legacy counts for UI compatibility
                  carWashes[unitId] = unitData.currentReading.washes.filter(wash => wash.type === 'car').length;
                  boatWashes[unitId] = unitData.currentReading.washes.filter(wash => wash.type === 'boat').length;
                } else {
                  carWashes[unitId] = 0;
                  boatWashes[unitId] = 0;
                  washesArrays[unitId] = [];
                }
              }
            }
          });
        }
      }
      
      // Set all the state from aggregated data
      setReadings(readings);
      setCarWashCounts(carWashes);
      setBoatWashCounts(boatWashes);
      setWashes(washesArrays);
      
      console.log('🔍 Extracted from aggregated data:', { readings, washesArrays, carWashes, boatWashes });
      
      // Aggregated data is the single source of truth - no separate database calls needed
      
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

  const handleWashesClick = (unitId) => {
    setCurrentEditingUnit(unitId);
    setWashModalOpen(true);
  };

  const handleWashModalClose = () => {
    setWashModalOpen(false);
    setCurrentEditingUnit(null);
  };

  const handleWashModalSave = async (unitId, updatedWashes) => {
    try {
      // Update the washes state and sync legacy counts
      updateWashesForUnit(unitId, updatedWashes);
      
      // The save will happen when the user clicks "Save Readings"
      // For now, just update the local state
      setMessage(`Updated wash entries for unit ${unitId}. Don't forget to save your readings!`);
      
    } catch (error) {
      console.error('Error updating washes:', error);
      throw error;
    }
  };

  // Helper function to update washes array and sync legacy counts
  const updateWashesForUnit = (unitId, newWashes) => {
    setWashes(prev => ({
      ...prev,
      [unitId]: newWashes
    }));
    
    // Sync legacy counts for UI compatibility
    const carCount = newWashes.filter(wash => wash.type === 'car').length;
    const boatCount = newWashes.filter(wash => wash.type === 'boat').length;
    
    setCarWashCounts(prev => ({
      ...prev,
      [unitId]: carCount
    }));
    
    setBoatWashCounts(prev => ({
      ...prev,
      [unitId]: boatCount
    }));
  };

  const saveReadings = async () => {
    try {
      setSaving(true);
      setError('');
      setMessage('');
      
      // Prepare readings object matching PWA structure
      const apiPayload = {
        readings: {},
        buildingMeter: null,
        commonArea: null
      };
      let hasReadings = false;
      
      // Add unit readings with wash data (matching PWA format)
      units.forEach(unit => {
        const unitId = unit.unitId;
        const reading = readings[unitId] && parseInt(readings[unitId]) > 0 ? parseInt(readings[unitId]) : null;
        const unitWashes = washes[unitId] || [];
        
        // Save if there's a reading OR wash data
        if (reading || unitWashes.length > 0) {
          const cleanUnit = { reading: reading };
          
          // Only include washes array if there are actual washes (PWA pattern)
          if (unitWashes.length > 0) {
            cleanUnit.washes = unitWashes;
          }
          
          apiPayload.readings[unitId] = cleanUnit;
          hasReadings = true;
        }
      });
      
      // Add Common Area reading (at root level, PWA pattern)
      if (commonAreaReading && parseInt(commonAreaReading) > 0) {
        apiPayload.commonArea = parseInt(commonAreaReading);
        hasReadings = true;
      }
      
      // Add Building Meter reading (at root level, PWA pattern)
      if (buildingMeterReading && parseInt(buildingMeterReading) > 0) {
        apiPayload.buildingMeter = parseInt(buildingMeterReading);
        hasReadings = true;
      }
      
      // Check if any readings were entered
      if (!hasReadings) {
        setError('Please enter at least one reading');
        setSaving(false);
        return;
      }
      
      
      // Debug logging to see what we're sending
      console.log('🔍 Desktop save payload:', JSON.stringify(apiPayload, null, 2));
      console.log('🔍 Save parameters:', { clientId, year, month });
      
      // Save using the new endpoint (PWA format)
      await waterAPI.saveReadings(clientId, year, month, apiPayload);
      
      const { calendarMonth, calendarYear } = getCalendarDate(year, month);
      setMessage(`Successfully saved readings for ${monthNames[calendarMonth]} ${calendarYear}`);
      
      // Force refresh of context data to clear cache and reload fresh data
      console.log('🔄 [WaterReadingEntry] Refreshing context data after save...');
      if (refreshData) {
        await refreshData();
        console.log('✅ [WaterReadingEntry] Context data refreshed');
      }
      
      // Reload to show updated data from refreshed context
      setTimeout(() => {
        loadPriorReadings();
      }, 500);
      
      // Call parent callback if provided (for other refresh mechanisms)
      if (onSaveSuccess) {
        onSaveSuccess();
      }
      
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
          Reading Period: <strong>{readingPeriod || `${monthNames[calendarMonth]} ${calendarYear}`}</strong>
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
            <col style={{ width: '22%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Unit</th>
              <th>Owner</th>
              <th>Prior Reading</th>
              <th>Current Reading</th>
              <th>Consumption (m³)</th>
              <th>Washes</th>
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
                    <td className="wash-management">
                      {monthLocked ? (
                        <div style={{ textAlign: 'center' }}>
                          <span className="wash-summary">
                            Car: {carWashCounts[unitId] || 0}, Boat: {boatWashCounts[unitId] || 0}
                          </span>
                        </div>
                      ) : (
                        <button 
                          type="button"
                          className={`wash-button ${((carWashCounts[unitId] || 0) + (boatWashCounts[unitId] || 0)) > 0 ? 'has-washes' : 'no-washes'}`}
                          onClick={() => handleWashesClick(unitId)}
                          disabled={saving}
                          title={`Car: ${carWashCounts[unitId] || 0}, Boat: ${boatWashCounts[unitId] || 0}`}
                        >
                          Washes ({(carWashCounts[unitId] || 0) + (boatWashCounts[unitId] || 0)})
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>
                  No units configured. Please check client configuration.
                </td>
              </tr>
            )}
            
            {/* Separator row */}
            <tr style={{ height: '10px', backgroundColor: '#f8f9fa' }}>
              <td colSpan="6" style={{ borderBottom: '2px solid #dee2e6' }}></td>
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
              <td className="wash-management" style={{ color: '#6c757d', fontStyle: 'italic', textAlign: 'center' }}>
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
              <td className="wash-management" style={{ color: '#6c757d', fontStyle: 'italic', textAlign: 'center' }}>
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
                setWashes({});
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

      {/* Wash Modal */}
      <WashModal
        isOpen={washModalOpen}
        onClose={handleWashModalClose}
        onSave={handleWashModalSave}
        unitId={currentEditingUnit}
        unitLabel={currentEditingUnit}
        initialWashes={currentEditingUnit ? (washes[currentEditingUnit] || []) : []}
        loading={saving}
        carWashRate={carWashRate}
        boatWashRate={boatWashRate}
      />
    </div>
  );
};

export default WaterReadingEntry;