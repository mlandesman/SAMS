import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import waterAPI from '../../api/waterAPI';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import '../../views/HOADuesView.css'; // Use HOA Dues styles

const WaterHistoryGrid = ({ clientId, onBillSelection, selectedBill }) => {
  const [yearData, setYearData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedYear, setSelectedYear] = useState(2026);
  const navigate = useNavigate();

  useEffect(() => {
    if (clientId) {
      fetchYearData();
    }
  }, [clientId, selectedYear]);

  const fetchYearData = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await waterAPI.getAggregatedData(clientId, selectedYear);
      console.log('📊 Loading water history data for', clientId, selectedYear);
      setYearData(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching water history:', error);
      setError('Failed to load water history');
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (!num && num !== 0) return '';
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatCurrency = (amount) => {
    if (typeof amount !== 'number' || amount === 0) return '';
    return amount.toFixed(0);
  };

  if (loading) {
    return <div className="loading-container">Loading water history...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (!yearData || !yearData.months) {
    return <div className="no-data-message">No water history data available</div>;
  }

  // Get all unique unit IDs - handle both array of strings and array of objects
  let unitIds = [];
  if (yearData.units) {
    if (typeof yearData.units[0] === 'string') {
      unitIds = yearData.units;
    } else if (typeof yearData.units[0] === 'object') {
      unitIds = yearData.units.map(u => u.unitId || u.id || u);
    }
  } else if (yearData.months && yearData.months.length > 0 && yearData.months[0].units) {
    // Fallback: extract unit IDs from first month's data
    unitIds = Object.keys(yearData.months[0].units).sort();
  }

  // Calculate totals
  const calculateColumnTotals = () => {
    const totals = {};
    unitIds.forEach(unitId => {
      totals[unitId] = { consumption: 0, amount: 0 };
    });
    
    // Add totals for special meters
    totals.commonArea = { consumption: 0, amount: 0 };
    totals.buildingMeter = { consumption: 0, amount: 0 };
    
    yearData.months.forEach((month, monthIdx) => {
      if (month.units) {
        Object.entries(month.units).forEach(([unitId, unit]) => {
          if (totals[unitId]) {
            // Only include positive consumption (ignore negative values from September)
            const consumption = Math.max(0, unit.consumption || 0);
            const amount = Math.max(0, unit.billAmount || 0);
            totals[unitId].consumption += consumption;
            totals[unitId].amount += amount;
          }
        });
      }
      
      // Add Common Area totals from backend data
      if (month.commonArea) {
        const consumption = Math.max(0, month.commonArea.consumption || 0);
        totals.commonArea.consumption += consumption;
        totals.commonArea.amount += consumption * 50; // $50 per m³
      }
      
      // Add Building Meter totals from backend data
      if (month.buildingMeter) {
        const consumption = Math.max(0, month.buildingMeter.consumption || 0);
        totals.buildingMeter.consumption += consumption;
        totals.buildingMeter.amount += consumption * 50; // $50 per m³
      }
    });
    
    return totals;
  };

  const columnTotals = calculateColumnTotals();

  return (
    <div className="hoa-dues-view">
      <div className="hoa-dues-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px' }}>
          <h3 style={{ margin: 0, color: '#333' }}>Water Meter History</h3>
          <div className="year-navigation">
            <button 
              className="year-nav-button"
              onClick={() => setSelectedYear(selectedYear - 1)}
            >
              <FontAwesomeIcon icon={faChevronLeft} />
            </button>
            <div className="year-display">
              <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#1ebbd7' }}>
                {selectedYear}
              </span>
            </div>
            <button 
              className="year-nav-button"
              onClick={() => setSelectedYear(selectedYear + 1)}
            >
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
          </div>
        </div>
        <div className="hoa-dues-table-container">
          <table className="hoa-dues-table">
            <thead>
              <tr className="unit-header-row">
                <th className="month-header">Month</th>
                {unitIds.map(unitId => {
                  return (
                    <th key={unitId} className="unit-header">
                      <div className="unit-id-cell">{unitId}</div>
                    </th>
                  );
                })}
                {/* Column separator header */}
                <th style={{ width: '3px', backgroundColor: '#dee2e6', padding: 0, borderLeft: '2px solid #999', borderRight: '1px solid #999' }}></th>
                {/* Common Area header */}
                <th className="unit-header" style={{ backgroundColor: '#fff3cd' }}>
                  <div className="unit-id-cell" style={{ color: '#856404', fontWeight: 'bold' }}>CA</div>
                </th>
                {/* Total header */}
                <th className="unit-header" style={{ backgroundColor: '#d4edda' }}>
                  <div className="unit-id-cell" style={{ color: '#155724', fontWeight: 'bold' }}>TOTAL</div>
                </th>
                {/* Building Meter header */}
                <th className="unit-header" style={{ backgroundColor: '#cfe2ff' }}>
                  <div className="unit-id-cell" style={{ color: '#004085', fontWeight: 'bold' }}>BM</div>
                </th>
              </tr>
              <tr className="owner-header-row">
                <th></th>
                {unitIds.map(unitId => {
                  const unitData = yearData.months?.[0]?.units?.[unitId];
                  const ownerName = unitData?.ownerLastName || unitData?.ownerName || '';
                  return (
                    <th key={unitId} className="owner-header">
                      <div className="owner-lastname-cell">{ownerName}</div>
                    </th>
                  );
                })}
                {/* Column separator for owner row */}
                <th style={{ backgroundColor: '#dee2e6', padding: 0, borderLeft: '2px solid #999', borderRight: '1px solid #999' }}></th>
                {/* Common Area owner */}
                <th className="owner-header" style={{ backgroundColor: '#fff8e1' }}>
                  <div className="owner-lastname-cell" style={{ fontStyle: 'italic', color: '#856404' }}>Common</div>
                </th>
                {/* Total owner */}
                <th className="owner-header" style={{ backgroundColor: '#e7f3e7' }}>
                  <div className="owner-lastname-cell" style={{ fontStyle: 'italic', color: '#155724' }}>Units+CA</div>
                </th>
                {/* Building Meter owner */}
                <th className="owner-header" style={{ backgroundColor: '#e7f0ff' }}>
                  <div className="owner-lastname-cell" style={{ fontStyle: 'italic', color: '#004085' }}>Building</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {yearData.months.map((month, idx) => {
                const isCurrentMonth = false; // You can add logic to determine current month
                const isFutureMonth = false; // You can add logic to determine future months
                // Add idx to month object for use in calculations
                const monthWithIdx = { ...month, idx };
                
                return (
                  <tr key={idx} className="month-row">
                    <td className={`row-label ${isCurrentMonth ? 'current-month' : ''} ${isFutureMonth ? 'future-month' : ''}`}>
                      {month.monthName.toUpperCase().substring(0, 3)}
                    </td>
                    {unitIds.map(unitId => {
                      const unitData = month.units?.[unitId];
                      const consumption = unitData?.consumption;
                      const amount = unitData?.billAmount;
                      
                      // Handle amount cell click for transaction navigation
                      const handleAmountClick = () => {
                        if (unitData?.transactionId) {
                          console.log(`💳 Navigating to transaction ID: ${unitData.transactionId}`);
                          navigate(`/transactions?id=${unitData.transactionId}`);
                          
                          // Update sidebar activity
                          try {
                            const event = new CustomEvent('activityChange', { 
                              detail: { activity: 'transactions' } 
                            });
                            window.dispatchEvent(event);
                          } catch (error) {
                            console.error('Error dispatching activity change event:', error);
                          }
                        }
                        
                        // Also trigger bill selection for Action Bar
                        if (onBillSelection && unitData) {
                          const billData = {
                            unitId,
                            period: month.monthName + ' ' + month.calendarYear,
                            consumption: consumption || 0,
                            amount: amount || 0,
                            transactionId: unitData.transactionId || null,
                            billNotes: unitData.billNotes
                          };
                          onBillSelection(billData);
                        }
                      };
                      
                      // Enhanced tooltip with full bill notes and transaction info
                      const tooltipText = unitData?.transactionId ? 
                        `${unitData?.billNotes || `Unit ${unitId} - ${consumption} m³ consumption`} (Click to view transaction)` :
                        unitData?.billNotes || (consumption > 0 ? `Unit ${unitId} - ${consumption} m³ consumption` : '');
                      
                      return (
                        <td 
                          key={unitId} 
                          className="payment-cell"
                          title={tooltipText}
                        >
                          {consumption > 0 ? (
                            unitData?.transactionId ? (
                              <button 
                                className="link-button amount-link"
                                onClick={handleAmountClick}
                                title={tooltipText}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'right', width: '100%' }}
                              >
                                <div style={{ fontSize: '20px', color: '#333' }}>
                                  {formatNumber(consumption)}
                                </div>
                                <div style={{ fontSize: '18px', color: '#0527ae', fontWeight: 'bold' }}>
                                  ${formatCurrency(amount)}
                                </div>
                              </button>
                            ) : (
                              <>
                                <div style={{ fontSize: '20px', color: '#333' }}>
                                  {formatNumber(consumption)}
                                </div>
                                <div style={{ fontSize: '18px', color: '#0527ae', fontWeight: 'bold' }}>
                                  ${formatCurrency(amount)}
                                </div>
                              </>
                            )
                          ) : (
                            '-'
                          )}
                        </td>
                      );
                    })}
                    
                    {/* Column separator - vertical line between units and special meters */}
                    <td style={{ width: '3px', backgroundColor: '#dee2e6', padding: 0, borderLeft: '2px solid #999', borderRight: '1px solid #999' }}></td>
                    
                    {/* Common Area cell */}
                    <td className="payment-cell" style={{ backgroundColor: '#fff8e1' }}>
                      {(() => {
                        // Get common area consumption from the backend-provided data
                        const consumption = month.commonArea?.consumption || 0;
                        return consumption > 0 ? (
                          <>
                            <div style={{ fontSize: '20px', color: '#856404' }}>
                              {formatNumber(consumption)}
                            </div>
                            <div style={{ fontSize: '18px', color: '#856404', fontWeight: 'bold' }}>
                              ${formatCurrency(consumption * 50)} {/* $50 per m³ */}
                            </div>
                          </>
                        ) : '-';
                      })()}
                    </td>
                    
                    {/* Total cell (Units + Common Area) */}
                    <td className="payment-cell" style={{ backgroundColor: '#e7f3e7' }}>
                      {(() => {
                        // Calculate total consumption for all units + common area
                        let totalConsumption = 0;
                        let totalAmount = 0;
                        Object.values(month.units || {}).forEach(unit => {
                          totalConsumption += unit.consumption || 0;
                          totalAmount += unit.billAmount || 0;
                        });
                        // Add common area consumption
                        const commonConsumption = month.commonArea?.consumption || 0;
                        totalConsumption += commonConsumption;
                        totalAmount += commonConsumption * 50; // $50 per m³
                        
                        return totalConsumption > 0 ? (
                          <>
                            <div style={{ fontSize: '20px', color: '#155724', fontWeight: 'bold' }}>
                              {formatNumber(totalConsumption)}
                            </div>
                            <div style={{ fontSize: '18px', color: '#155724', fontWeight: 'bold' }}>
                              ${formatCurrency(totalAmount)}
                            </div>
                          </>
                        ) : '-';
                      })()}
                    </td>
                    
                    {/* Building Meter cell */}
                    <td className="payment-cell" style={{ backgroundColor: '#e7f0ff' }}>
                      {(() => {
                        // Get building meter consumption from the backend-provided data
                        const consumption = month.buildingMeter?.consumption || 0;
                        return consumption > 0 ? (
                          <>
                            <div style={{ fontSize: '20px', color: '#004085' }}>
                              {formatNumber(consumption)}
                            </div>
                            <div style={{ fontSize: '18px', color: '#004085', fontWeight: 'bold' }}>
                              ${formatCurrency(consumption * 50)} {/* $50 per m³ */}
                            </div>
                          </>
                        ) : '-';
                      })()}
                    </td>
                  </tr>
                );
              })}
              
              {/* TOTAL Row */}
              <tr className="totals-row">
                <td className="row-label total-header">TOTAL</td>
                {unitIds.map(unitId => {
                  const unitTotals = columnTotals[unitId];
                  return (
                    <td key={unitId} className="total-cell">
                      {unitTotals && unitTotals.consumption > 0 ? (
                        <>
                          <div style={{ fontSize: '20px', color: '#333', fontWeight: 'bold' }}>
                            {formatNumber(unitTotals.consumption)} m³
                          </div>
                          <div style={{ fontSize: '18px', color: '#0527ae', fontWeight: 'bold' }}>
                            ${formatCurrency(unitTotals.amount)}
                          </div>
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                  );
                })}
                
                {/* Column separator */}
                <td style={{ backgroundColor: '#dee2e6', padding: 0, borderLeft: '2px solid #999', borderRight: '1px solid #999' }}></td>
                
                {/* Common Area total */}
                <td className="total-cell" style={{ backgroundColor: '#fff8e1' }}>
                  {columnTotals.commonArea?.consumption > 0 ? (
                    <>
                      <div style={{ fontSize: '20px', color: '#856404', fontWeight: 'bold' }}>
                        {formatNumber(columnTotals.commonArea.consumption)} m³
                      </div>
                      <div style={{ fontSize: '18px', color: '#856404', fontWeight: 'bold' }}>
                        ${formatCurrency(columnTotals.commonArea.amount)}
                      </div>
                    </>
                  ) : (
                    '-'
                  )}
                </td>
                
                {/* Grand Total (Units + Common Area) */}
                <td className="total-cell" style={{ backgroundColor: '#d4edda' }}>
                  {(() => {
                    let grandTotalConsumption = 0;
                    let grandTotalAmount = 0;
                    
                    // Sum only unit totals (exclude buildingMeter)
                    unitIds.forEach(unitId => {
                      const unitTotal = columnTotals[unitId];
                      if (unitTotal) {
                        grandTotalConsumption += unitTotal.consumption || 0;
                        grandTotalAmount += unitTotal.amount || 0;
                      }
                    });
                    
                    // Add Common Area totals
                    if (columnTotals.commonArea) {
                      grandTotalConsumption += columnTotals.commonArea.consumption || 0;
                      grandTotalAmount += columnTotals.commonArea.amount || 0;
                    }
                    
                    return grandTotalConsumption > 0 ? (
                      <>
                        <div style={{ fontSize: '20px', color: '#155724', fontWeight: 'bold' }}>
                          {formatNumber(grandTotalConsumption)} m³
                        </div>
                        <div style={{ fontSize: '18px', color: '#155724', fontWeight: 'bold' }}>
                          ${formatCurrency(grandTotalAmount)}
                        </div>
                      </>
                    ) : '-';
                  })()}
                </td>
                
                {/* Building Meter total */}
                <td className="total-cell" style={{ backgroundColor: '#cfe2ff' }}>
                  {columnTotals.buildingMeter?.consumption > 0 ? (
                    <>
                      <div style={{ fontSize: '20px', color: '#004085', fontWeight: 'bold' }}>
                        {formatNumber(columnTotals.buildingMeter.consumption)} m³
                      </div>
                      <div style={{ fontSize: '18px', color: '#004085', fontWeight: 'bold' }}>
                        ${formatCurrency(columnTotals.buildingMeter.amount)}
                      </div>
                    </>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Annual Summary */}
        {yearData.summary && (
          <div className="summary-section">
            <h4>Annual Summary</h4>
            <div className="summary-row">
              <div className="summary-item">
                <span className="summary-label">Total Consumption:</span>
                <span className="summary-value">{formatNumber(yearData.summary.totalConsumption)} m³</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Total Billed:</span>
                <span className="summary-value">${formatCurrency(yearData.summary.totalBilled)}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Total Collected:</span>
                <span className="summary-value" style={{ color: '#28a745' }}>
                  ${formatCurrency(yearData.summary.totalPaid)}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Outstanding:</span>
                <span className="summary-value" style={{ color: '#dc3545' }}>
                  ${formatCurrency(yearData.summary.totalUnpaid)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WaterHistoryGrid;