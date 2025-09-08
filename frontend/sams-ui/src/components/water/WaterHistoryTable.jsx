import React, { useState, useEffect } from 'react';
import { useClient } from '../../context/ClientContext';
import { config } from '../../config';
import { getOwnerInfo } from '../../utils/unitUtils';
import './WaterHistoryTable.css';

function WaterHistoryTable({ waterData, selectedYear }) {
  const { selectedClient } = useClient();
  const [unitsData, setUnitsData] = useState([]);
  
  // DEBUG: Log what data we received
  console.log('🎯 [WaterHistoryTable] Component props:', {
    waterDataKeys: waterData ? Object.keys(waterData) : null,
    selectedYear,
    hasWaterData: !!waterData,
    firstUnitSample: waterData && Object.keys(waterData)[0] ? waterData[Object.keys(waterData)[0]] : null
  });
  
  // Get fiscal year configuration
  const fiscalYearStartMonth = selectedClient?.configuration?.fiscalYearStartMonth || 7; // July for AVII
  
  // Fetch units data when component mounts or client changes
  useEffect(() => {
    const fetchUnits = async () => {
      if (!selectedClient) return;
      
      try {
        // Get auth token for API call
        const { getAuthInstance } = await import('../../firebaseClient');
        const auth = getAuthInstance();
        const token = await auth.currentUser?.getIdToken();
        
        if (!token) {
          console.error('Failed to get authentication token');
          return;
        }
        
        // Use backend API to fetch units
        const API_BASE_URL = config.api.baseUrl;
        const response = await fetch(`${API_BASE_URL}/clients/${selectedClient.id}/units`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          console.error(`Failed to fetch units: ${response.status} ${response.statusText}`);
          return;
        }
        
        const unitsResponse = await response.json();
        console.log('Fetched units data for water history:', unitsResponse);
        
        // Extract the data array from the response wrapper
        const unitsArray = unitsResponse.data || unitsResponse;
        console.log('Units array extracted:', unitsArray);
        console.log('First unit data:', unitsArray[0]);
        console.log('First unit owner:', unitsArray[0]?.owner);
        setUnitsData(unitsArray);
      } catch (error) {
        console.error('Error fetching units:', error);
      }
    };
    
    fetchUnits();
  }, [selectedClient]);
  
  // Get unit owner name from units data - using same logic as HOA Dues
  const getOwnerName = (unitId) => {
    const unit = unitsData?.find(u => u.unitId === unitId);
    if (unit) {
      const { lastName } = getOwnerInfo(unit);
      return lastName;
    }
    return '';  // Return empty string if no owner found
  };
  
  // Generate BILLING months for the fiscal year
  // For cash-basis: Aug billing = July consumption (July 28 reading - June 28 reading)
  const getBillingMonthsForFiscalYear = (year) => {
    const months = [];
    
    // Start from fiscal year start month (July for AVII) 
    // These are BILLING months, consumption comes from prior month's reading
    for (let i = 0; i < 12; i++) {
      const billingMonthIndex = (fiscalYearStartMonth + i - 1) % 12;
      const billingYear = fiscalYearStartMonth + i > 12 ? year : year - 1;
      
      months.push({
        billingMonth: billingMonthIndex + 1, // 1-based month for billing
        billingYear: billingYear,
        displayName: new Date(billingYear, billingMonthIndex, 1).toLocaleDateString('en-US', { month: 'short' }),
        fullDisplayName: `${new Date(billingYear, billingMonthIndex, 1).toLocaleDateString('en-US', { month: 'short' })}-${String(billingYear).slice(-2)}`
      });
    }
    
    return months;
  };
  
  const months = getBillingMonthsForFiscalYear(selectedYear);
  
  // Get all units from waterData
  const units = Object.keys(waterData).sort((a, b) => {
    // Sort numerically if possible, otherwise alphabetically
    const aNum = parseInt(a);
    const bNum = parseInt(b);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum;
    }
    return a.localeCompare(b);
  });
  
  // Helper to get reading for a specific date range
  const getReadingForMonth = (unitData, month, year) => {
    if (!unitData?.readings) return null;
    
    // Find reading for this month/year
    const reading = unitData.readings.find(r => {
      if (!r.date) return false;
      
      // Handle Firestore timestamp format
      const readingDate = r.date._seconds 
        ? new Date(r.date._seconds * 1000)
        : new Date(r.date);
      
      return readingDate.getMonth() + 1 === month && 
             readingDate.getFullYear() === year;
    });
    
    return reading;
  };
  
  // Helper to get readings that belong to a billing month
  // Readings on day >= 28 belong to the next month's billing
  const getReadingsForBillingMonth = (unitData, billingMonth, billingYear) => {
    if (!unitData?.readings) return { current: null, previous: null };
    
    // DEBUG: Log what we're looking for
    if (unitData.unitId === '101') {
      console.log(`🔍 [DEBUG] Looking for billing month ${billingMonth}/${billingYear} readings for unit 101`);
      console.log(`📊 [DEBUG] Unit 101 has ${unitData.readings.length} total readings:`, 
        unitData.readings.map(r => ({
          reading: r.reading,
          date: r.date._seconds ? new Date(r.date._seconds * 1000) : new Date(r.date),
          notes: r.notes
        }))
      );
    }
    
    // Find all readings
    const sortedReadings = [...unitData.readings].sort((a, b) => {
      const dateA = a.date._seconds ? new Date(a.date._seconds * 1000) : new Date(a.date);
      const dateB = b.date._seconds ? new Date(b.date._seconds * 1000) : new Date(b.date);
      return dateA - dateB; // Ascending order (oldest first)
    });
    
    // Find the reading for this billing month (taken on day >= 28 of prior month)
    const billingReading = sortedReadings.find(r => {
      const readingDate = r.date._seconds ? new Date(r.date._seconds * 1000) : new Date(r.date);
      const readingDay = readingDate.getDate();
      const readingMonth = readingDate.getMonth() + 1;
      const readingYear = readingDate.getFullYear();
      
      if (unitData.unitId === '101') {
        console.log(`🔍 [DEBUG] Checking reading ${r.reading} dated ${readingDate.toDateString()}: day=${readingDay}, month=${readingMonth}, year=${readingYear}`);
      }
      
      // If reading day >= 28, it belongs to next month's billing
      if (readingDay >= 28) {
        const nextMonth = readingMonth === 12 ? 1 : readingMonth + 1;
        const nextYear = readingMonth === 12 ? readingYear + 1 : readingYear;
        
        if (unitData.unitId === '101') {
          console.log(`  → Reading day ${readingDay} >= 28, so belongs to ${nextMonth}/${nextYear} billing`);
          console.log(`  → Comparing: ${nextMonth}/${nextYear} vs ${billingMonth}/${billingYear}`);
        }
        
        return nextMonth === billingMonth && nextYear === billingYear;
      }
      return false;
    });
    
    // Find the previous reading
    let previousReading = null;
    if (billingReading) {
      const billingIndex = sortedReadings.indexOf(billingReading);
      if (billingIndex > 0) {
        previousReading = sortedReadings[billingIndex - 1];
      }
    }
    
    if (unitData.unitId === '101') {
      console.log(`✅ [DEBUG] Result for ${billingMonth}/${billingYear}:`, {
        current: billingReading ? { reading: billingReading.reading, date: billingReading.date } : null,
        previous: previousReading ? { reading: previousReading.reading, date: previousReading.date } : null
      });
    }
    
    return { current: billingReading, previous: previousReading };
  };
  
  // Helper to calculate consumption for a billing month
  const getConsumptionForBillingMonth = (unitData, billingMonth, billingYear) => {
    const { current, previous } = getReadingsForBillingMonth(unitData, billingMonth, billingYear);
    
    // DEBUG: Log the readings we're working with
    if (unitData.unitId === '101' && (billingMonth === 7 || billingMonth === 8)) {
      console.log(`🔍 [DEBUG] Unit 101 ${billingMonth}/${billingYear} billing:`, {
        billingMonth,
        billingYear,
        current: current ? {
          reading: current.reading,
          date: current.date,
          notes: current.notes
        } : null,
        previous: previous ? {
          reading: previous.reading,
          date: previous.date,
          notes: previous.notes
        } : null,
        allReadings: unitData.readings?.map(r => ({
          reading: r.reading,
          date: r.date,
          notes: r.notes
        })) || []
      });
    }
    
    if (current?.reading && previous?.reading) {
      const consumption = current.reading - previous.reading;
      if (unitData.unitId === '101' && (billingMonth === 7 || billingMonth === 8)) {
        console.log(`✅ [DEBUG] Unit 101 ${billingMonth}/${billingYear} consumption: ${consumption} gallons`);
      }
      return consumption;
    }
    
    return null;
  };
  
  // Helper to get bill for a specific billing month
  const getBillForBillingMonth = (unitData, billingMonth, billingYear) => {
    if (!unitData?.bills) return null;
    
    // Find bill for this billing month/year
    const bill = unitData.bills.find(b => {
      if (!b.billingMonth) return false;
      
      // billingMonth format: "2025-07"
      const [billYear, billMonth] = b.billingMonth.split('-').map(Number);
      return billMonth === billingMonth && billYear === billingYear;
    });
    
    return bill;
  };
  
  // Helper to get common area meter reading for a month
  const getCommonMeterReading = (month, year) => {
    // This will be populated from /clients/AVII/config/waterBills/{year}/{month}
    // For now, return null until backend is updated
    return null;
  };
  
  // Helper to get building meter reading for a month
  const getBuildingMeterReading = (month, year) => {
    // This will be populated from /clients/AVII/config/waterBills/{year}/{month}
    // For now, return null until backend is updated
    return null;
  };
  
  // Calculate totals for each billing month
  const calculateMonthlyTotals = (billingMonth, billingYear) => {
    let totalConsumption = 0;
    let totalBilled = 0;
    let unitCount = 0;
    
    units.forEach(unitId => {
      const unitData = waterData[unitId];
      const consumption = getConsumptionForBillingMonth(unitData, billingMonth, billingYear);
      const bill = getBillForBillingMonth(unitData, billingMonth, billingYear);
      
      if (consumption !== null && consumption > 0) {
        totalConsumption += consumption;
        unitCount++;
      }
      
      if (bill?.amount) {
        totalBilled += bill.amount;
      }
    });
    
    return {
      consumption: unitCount > 0 ? totalConsumption : null,
      billed: totalBilled > 0 ? totalBilled : null
    };
  };

  return (
    <div className="water-history-table">
      <table className="history-table">
        <thead>
          <tr>
            <th className="month-header"></th>
            {units.map(unitId => (
              <th key={unitId} className="unit-header">
                <div className="unit-number">{unitId}</div>
                <div className="unit-name">{getOwnerName(unitId)}</div>
              </th>
            ))}
            <th className="common-header">
              <div className="unit-number">Common</div>
              <div className="unit-name">Area</div>
            </th>
            <th className="total-header">
              <div className="unit-number">Total</div>
              <div className="unit-name"></div>
            </th>
            <th className="building-header">
              <div className="unit-number">Building</div>
              <div className="unit-name">Meter</div>
            </th>
          </tr>
        </thead>
        <tbody>
          {months.map((month, idx) => {
            const monthlyTotals = calculateMonthlyTotals(month.billingMonth, month.billingYear);
            const isEvenRow = idx % 2 === 0;
            
            return (
              <tr key={`${month.billingYear}-${month.billingMonth}`} className={isEvenRow ? 'even-row' : 'odd-row'}>
                <td className="month-cell">
                  <div className="month-label">{month.fullDisplayName}</div>
                </td>
                {units.map(unitId => {
                  const unitData = waterData[unitId];
                  const consumption = getConsumptionForBillingMonth(unitData, month.billingMonth, month.billingYear);
                  const bill = getBillForBillingMonth(unitData, month.billingMonth, month.billingYear);
                  
                  return (
                    <td key={`${unitId}-${month.billingYear}-${month.billingMonth}`} className="data-cell">
                      <div className="reading-value">
                        {consumption !== null && consumption > 0 ? Math.round(consumption).toLocaleString() : ''}
                      </div>
                      <div className="bill-value">
                        {bill?.amount ? `$${Math.round(bill.amount / 100)}` : ''}
                      </div>
                    </td>
                  );
                })}
                {/* Common Area Meter */}
                <td className="common-cell data-cell">
                  <div className="reading-value">
                    {(() => {
                      // For billing month, show consumption from prior month
                      const readingMonth = month.billingMonth === 1 ? 12 : month.billingMonth - 1;
                      const readingYear = month.billingMonth === 1 ? month.billingYear - 1 : month.billingYear;
                      const commonConsumption = getCommonMeterReading(readingMonth, readingYear);
                      return commonConsumption ? commonConsumption.toLocaleString() : '';
                    })()}
                  </div>
                  <div className="bill-value">
                    {/* Common area is not billed */}
                  </div>
                </td>
                {/* Total Collected */}
                <td className="total-cell">
                  <div className="reading-value total">
                    {monthlyTotals.consumption ? Math.round(monthlyTotals.consumption).toLocaleString() : ''}
                  </div>
                  <div className="bill-value total">
                    {monthlyTotals.billed ? `$${Math.round(monthlyTotals.billed / 100).toLocaleString()}` : ''}
                  </div>
                </td>
                {/* Building Meter */}
                <td className="building-cell data-cell">
                  <div className="reading-value">
                    {(() => {
                      // For billing month, show consumption from prior month
                      const readingMonth = month.billingMonth === 1 ? 12 : month.billingMonth - 1;
                      const readingYear = month.billingMonth === 1 ? month.billingYear - 1 : month.billingYear;
                      const buildingConsumption = getBuildingMeterReading(readingMonth, readingYear);
                      return buildingConsumption ? buildingConsumption.toLocaleString() : '';
                    })()}
                  </div>
                  <div className="bill-value">
                    {(() => {
                      // Calculate expected vs actual for leak detection
                      const readingMonth = month.billingMonth === 1 ? 12 : month.billingMonth - 1;
                      const readingYear = month.billingMonth === 1 ? month.billingYear - 1 : month.billingYear;
                      const buildingConsumption = getBuildingMeterReading(readingMonth, readingYear);
                      const commonConsumption = getCommonMeterReading(readingMonth, readingYear);
                      const unitsTotal = monthlyTotals.consumption;
                      
                      if (buildingConsumption && commonConsumption && unitsTotal) {
                        const expected = unitsTotal + commonConsumption;
                        const difference = buildingConsumption - expected;
                        if (Math.abs(difference) > 10) {
                          return <span className="leak-warning">{difference > 0 ? '+' : ''}{difference}</span>;
                        }
                      }
                      return '';
                    })()}
                  </div>
                </td>
              </tr>
            );
          })}
          {/* Total row */}
          <tr className="total-row">
            <td className="month-cell total-label-cell">
              <div className="month-label">Total Paid</div>
            </td>
            {units.map(unitId => {
              const unitData = waterData[unitId];
              const totalPaid = unitData?.summary?.totalPaid || 0;
              const totalBilled = unitData?.summary?.totalBilled || 0;
              
              return (
                <td key={`total-${unitId}`} className="data-cell total-cell">
                  <div className="bill-value total">
                    {totalPaid > 0 ? `$${Math.round(totalPaid / 100).toLocaleString()}` : '$0'}
                  </div>
                </td>
              );
            })}
            <td className="common-cell data-cell total-cell">
              {/* Common area totals - not billed */}
            </td>
            <td className="total-cell">
              <div className="bill-value total grand-total">
                {(() => {
                  const grandTotal = units.reduce((sum, unitId) => {
                    return sum + (waterData[unitId]?.summary?.totalPaid || 0);
                  }, 0);
                  return grandTotal > 0 ? `$${Math.round(grandTotal / 100).toLocaleString()}` : '$0';
                })()}
              </div>
            </td>
            <td className="building-cell data-cell total-cell">
              {/* Building meter totals */}
            </td>
          </tr>
        </tbody>
      </table>
      
      <div className="table-legend">
        <div className="legend-item">
          <span className="legend-label">Top value:</span> Monthly Consumption (gallons)
        </div>
        <div className="legend-item">
          <span className="legend-label">Bottom value:</span> Amount Billed
        </div>
        <div className="legend-item">
          <span className="legend-label">Billing Month:</span> Shows consumption from prior month's reading
        </div>
      </div>
    </div>
  );
}

export default WaterHistoryTable;