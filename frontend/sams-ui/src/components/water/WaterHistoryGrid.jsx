import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWaterBills } from '../../context/WaterBillsContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faTint } from '@fortawesome/free-solid-svg-icons';
import { databaseFieldMappings } from '../../utils/databaseFieldMappings';
import {
  getFiscalMonthNames,
  getCurrentFiscalMonth,
  fiscalToCalendarMonth,
  getFiscalYear,
  isFiscalYear
} from '../../utils/fiscalYearUtils';
import '../../views/HOADuesView.css'; // Use HOA Dues styles

const WaterHistoryGrid = ({ clientId, onBillSelection, selectedBill }) => {
  const { waterData, loading: contextLoading, error: contextError } = useWaterBills();
  const [yearData, setYearData] = useState(null);
  const [selectedYear, setSelectedYear] = useState(2026);
  const navigate = useNavigate();
  
  // Get fiscal year configuration (AVII starts in July = month 7)
  const fiscalYearStartMonth = 7; // July

  useEffect(() => {
    if (waterData && Object.keys(waterData).length > 0) {
      console.log('📊 [WaterHistoryGrid] Using waterData from context (no API call)');
      setYearData(waterData);
    }
  }, [waterData]);

  const formatNumber = (num) => {
    if (!num && num !== 0) return '';
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatCurrency = (amount) => {
    if (typeof amount !== 'number' || amount === 0) return '';
    return amount.toFixed(0);
  };

  if (contextLoading) {
    return <div className="loading-container">Loading water history...</div>;
  }

  if (contextError) {
    return <div className="error-message">{contextError}</div>;
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
                <th className="month-header">
                  <div className="year-display-container">
                    {isFiscalYear(fiscalYearStartMonth) && (
                      <span className="fiscal-year-indicator">FY</span>
                    )}
                    <div className="year-display">
                      {selectedYear}
                    </div>
                  </div>
                </th>
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
              {getFiscalMonthNames(fiscalYearStartMonth, { short: true }).map((monthName, index) => {
                const fiscalMonth = index + 1; // Fiscal month 1-12
                const calendarMonth = fiscalToCalendarMonth(fiscalMonth, fiscalYearStartMonth);
                
                // Find month data from yearData if it exists
                const monthData = yearData.months?.find(m => m.month === index) || null;
                
                // Format month label with correct year
                let displayYear = selectedYear;
                // For fiscal years, if the calendar month is before the start month, it's in the fiscal year
                if (fiscalYearStartMonth > 1 && calendarMonth < fiscalYearStartMonth) {
                  displayYear = selectedYear; // For FY named by ending year
                } else if (fiscalYearStartMonth > 1) {
                  displayYear = selectedYear - 1; // For FY named by ending year
                }
                const monthLabel = `${monthName}-${displayYear}`;
                
                // Determine month styling based on selected year and current date
                const currentFiscalMonth = getCurrentFiscalMonth(new Date(), fiscalYearStartMonth);
                const currentFiscalYear = getFiscalYear(new Date(), fiscalYearStartMonth);
                
                let monthClass = 'future-month';
                // For current fiscal year, compare to current fiscal month
                if (selectedYear === currentFiscalYear) {
                  monthClass = fiscalMonth > currentFiscalMonth ? 'future-month' : 'current-month';
                } 
                // Past fiscal years should all show as current (past) months
                else if (selectedYear < currentFiscalYear) {
                  monthClass = 'current-month';
                }
                // Future fiscal years should all show as future months
                else {
                  monthClass = 'future-month';
                }
                
                return (
                  <tr key={`month-${fiscalMonth}`} className="month-row">
                    <td className={`row-label ${monthClass}`}>
                      {monthLabel}
                    </td>
                    {unitIds.map(unitId => {
                      const unitData = monthData?.units?.[unitId];
                      const consumption = unitData?.consumption;
                      const amount = unitData?.billAmount;
                      
                      // Check for washes using existing billNotes or washes array
                      const hasWashes = (unitData?.currentReading?.washes && Array.isArray(unitData.currentReading.washes) && unitData.currentReading.washes.length > 0) ||
                                       (unitData?.billNotes && unitData.billNotes.includes('wash'));
                      
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
                            period: monthLabel,
                            consumption: consumption || 0,
                            amount: amount || 0,
                            transactionId: unitData.transactionId || null,
                            billNotes: unitData.billNotes
                          };
                          onBillSelection(billData);
                        }
                      };
                      
                      // Enhanced tooltip using billNotes (which already include wash info) and transaction info
                      let tooltipText = unitData?.billNotes || (consumption > 0 ? `Unit ${unitId} - ${consumption} m³ consumption` : '');
                      if (unitData?.transactionId) {
                        tooltipText = `${tooltipText} (Click to view transaction)`;
                      }
                      
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
                                style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', width: '100%' }}
                              >
                                <span style={{ color: '#0527ae', fontSize: '16px' }}>
                                  ${formatCurrency(amount)}
                                </span>
                                <span style={{ color: '#333', fontSize: '14px' }}> ({formatNumber(consumption)})</span>
                                {hasWashes && (
                                  <FontAwesomeIcon 
                                    icon={faTint} 
                                    style={{ 
                                      fontSize: '10px', 
                                      color: '#17a2b8', 
                                      marginLeft: '4px',
                                      verticalAlign: 'super'
                                    }} 
                                  />
                                )}
                              </button>
                            ) : (
                              <>
                                <span style={{ color: '#0527ae', fontSize: '16px' }}>
                                  ${formatCurrency(amount)}
                                </span>
                                <span style={{ color: '#333', fontSize: '14px' }}> ({formatNumber(consumption)})</span>
                                {hasWashes && (
                                  <FontAwesomeIcon 
                                    icon={faTint} 
                                    style={{ 
                                      fontSize: '10px', 
                                      color: '#17a2b8', 
                                      marginLeft: '4px',
                                      verticalAlign: 'super'
                                    }} 
                                  />
                                )}
                              </>
                            )
                          ) : (
                            hasWashes ? (
                              <div style={{ fontSize: '14px', color: '#17a2b8', textAlign: 'center' }}>
                                <FontAwesomeIcon icon={faTint} />
                              </div>
                            ) : '-'
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
                        const consumption = monthData?.commonArea?.consumption || 0;
                        return consumption > 0 ? (
                          <span style={{ fontSize: '14px', color: '#856404' }}>
                            ${formatCurrency(consumption * 50)} ({formatNumber(consumption)})
                          </span>
                        ) : '-';
                      })()}
                    </td>
                    
                    {/* Total cell (Units + Common Area) */}
                    <td className="payment-cell" style={{ backgroundColor: '#e7f3e7' }}>
                      {(() => {
                        // Sum pre-calculated unit amounts from backend (WB1)
                        // This is appropriate cross-unit summation for display purposes
                        let totalConsumption = 0;
                        let totalAmount = 0;
                        Object.values(monthData?.units || {}).forEach(unit => {
                          totalConsumption += unit.consumption || 0;
                          totalAmount += unit.billAmount || 0;  // Backend pre-calculated
                        });
                        // Add common area consumption
                        const commonConsumption = monthData?.commonArea?.consumption || 0;
                        totalConsumption += commonConsumption;
                        totalAmount += commonConsumption * 50; // $50 per m³ (rate from config)
                        
                        return totalConsumption > 0 ? (
                          <span style={{ fontSize: '14px', color: '#155724', fontWeight: 'bold' }}>
                            ${formatCurrency(totalAmount)} ({formatNumber(totalConsumption)})
                          </span>
                        ) : '-';
                      })()}
                    </td>
                    
                    {/* Building Meter cell */}
                    <td className="payment-cell" style={{ backgroundColor: '#e7f0ff' }}>
                      {(() => {
                        // Get building meter consumption from the backend-provided data
                        const consumption = monthData?.buildingMeter?.consumption || 0;
                        return consumption > 0 ? (
                          <span style={{ fontSize: '14px', color: '#004085' }}>
                            ${formatCurrency(consumption * 50)} ({formatNumber(consumption)})
                          </span>
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