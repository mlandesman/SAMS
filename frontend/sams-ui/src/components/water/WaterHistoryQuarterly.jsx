import React, { useState, useEffect } from 'react';
import waterAPI from '../../api/waterAPI';
import './WaterHistoryQuarterly.css';

const WaterHistoryQuarterly = ({ clientId, year }) => {
  const [quarterlyBills, setQuarterlyBills] = useState([]);
  const [expandedQuarters, setExpandedQuarters] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchQuarterlyBills();
  }, [clientId, year]);

  const fetchQuarterlyBills = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log(`🔍 [WaterHistoryQuarterly] Fetching quarterly bills for ${clientId}, year ${year}`);
      const response = await waterAPI.getQuarterlyBills(clientId, year);
      console.log(`📊 [WaterHistoryQuarterly] API response:`, response);
      const bills = response.data || [];
      console.log(`📊 [WaterHistoryQuarterly] Found ${bills.length} quarterly bills`);
      bills.forEach(bill => {
        console.log(`  - ${bill._billId || 'unknown'}: Q${bill.fiscalQuarter}, ${Object.keys(bill.bills?.units || {}).length} units`);
      });
      setQuarterlyBills(bills);
    } catch (err) {
      console.error('❌ [WaterHistoryQuarterly] Error fetching quarterly bills:', err);
      setError(err.message || 'Failed to load quarterly bills');
    } finally {
      setLoading(false);
    }
  };

  const toggleQuarter = (quarterNum) => {
    setExpandedQuarters(prev => ({
      ...prev,
      [quarterNum]: !prev[quarterNum]
    }));
  };

  // Backend already converts centavos to pesos, so amounts are already in pesos
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '$0.00';
    return `$${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getStatusClass = (status) => {
    switch(status) {
      case 'paid': return 'status-paid';
      case 'unpaid': return 'status-unpaid';
      case 'partial': return 'status-partial';
      default: return 'status-unknown';
    }
  };

  const getStatusLabel = (status) => {
    switch(status) {
      case 'paid': return 'Paid';
      case 'unpaid': return 'Unpaid';
      case 'partial': return 'Partially Paid';
      default: return 'Unknown';
    }
  };

  // Month names for fiscal year (Jul-Jun)
  const monthNames = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  
  // Quarter definitions
  const quarters = [
    { num: 1, months: [0, 1, 2], labels: ['Jul', 'Aug', 'Sep'] },
    { num: 2, months: [3, 4, 5], labels: ['Oct', 'Nov', 'Dec'] },
    { num: 3, months: [6, 7, 8], labels: ['Jan', 'Feb', 'Mar'] },
    { num: 4, months: [9, 10, 11], labels: ['Apr', 'May', 'Jun'] }
  ];

  if (loading) {
    return (
      <div className="water-history-quarterly-loading">
        <div className="loading-spinner"></div>
        <p>Loading quarterly bills...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="water-history-quarterly-error">
        <p>Error: {error}</p>
        <button onClick={fetchQuarterlyBills} className="btn-retry">Retry</button>
      </div>
    );
  }

  return (
    <div className="water-history-quarterly">
      {quarters.map(quarter => {
        const bill = quarterlyBills.find(b => b.fiscalQuarter === quarter.num);
        const isExpanded = expandedQuarters[quarter.num];

        if (!bill) {
          return (
            <div key={quarter.num} className="quarter-row not-generated">
              <div className="quarter-header">
                <span className="quarter-icon">▷</span>
                <span className="quarter-label">Q{quarter.num} ({quarter.labels.join('-')})</span>
                <span className="quarter-status">Not Generated</span>
              </div>
            </div>
          );
        }

        const totalBilled = bill.summary?.totalBilled || 0;
        const totalPaid = bill.summary?.totalPaid || 0;
        const totalUnpaid = bill.summary?.totalUnpaid || 0;
        const percentPaid = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 0;
        
        // Determine overall status
        let overallStatus = 'unpaid';
        if (totalPaid >= totalBilled) {
          overallStatus = 'paid';
        } else if (totalPaid > 0) {
          overallStatus = 'partial';
        }

        // Get unit IDs sorted
        const unitIds = bill.bills?.units ? Object.keys(bill.bills.units).sort() : [];

        return (
          <div key={quarter.num} className="quarter-row">
            <div 
              className="quarter-header clickable"
              onClick={() => toggleQuarter(quarter.num)}
            >
              <span className="quarter-icon">
                {isExpanded ? '▼' : '▶'}
              </span>
              <span className="quarter-label">
                Q{quarter.num} ({bill.readingsIncluded?.map(r => r.label.split(' ')[0]).join('-') || quarter.labels.join('-')})
              </span>
              <span className="quarter-due">Due: {bill.dueDate}</span>
              <span className="quarter-total">Total: {formatCurrency(totalBilled)}</span>
              <span className="quarter-paid">Paid: {formatCurrency(totalPaid)}</span>
              <span className="quarter-due-amount">Due: {formatCurrency(totalUnpaid)}</span>
              <span className={`quarter-status-badge ${getStatusClass(overallStatus)}`}>
                {getStatusLabel(overallStatus)}
              </span>
            </div>

            {isExpanded && (
              <div className="quarter-details">
                <div className="quarter-summary">
                  <div className="summary-item">
                    <span className="summary-label">Total Units:</span>
                    <span className="summary-value">{bill.summary?.totalUnits || 0}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Total Billed:</span>
                    <span className="summary-value">{formatCurrency(totalBilled)}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Total Paid:</span>
                    <span className="summary-value paid">{formatCurrency(totalPaid)}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Total Due:</span>
                    <span className="summary-value unpaid">{formatCurrency(totalUnpaid)}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Payment Progress:</span>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${percentPaid}%` }}
                      ></div>
                      <span className="progress-text">{percentPaid}%</span>
                    </div>
                  </div>
                </div>

                {unitIds.length > 0 && (
                  <table className="monthly-breakdown-table">
                    <thead>
                      <tr>
                        <th className="unit-col">Unit</th>
                        {bill.readingsIncluded?.map(r => (
                          <th key={r.month} className="month-col">
                            {r.label.split(' ')[0]}
                          </th>
                        ))}
                        <th className="total-col">Total</th>
                        <th className="status-col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unitIds.map(unitId => {
                        const unitData = bill.bills.units[unitId];
                        if (!unitData) return null;

                        // Calculate monthly totals
                        const monthlyTotals = {};
                        unitData.monthlyBreakdown?.forEach(month => {
                          monthlyTotals[month.month] = (monthlyTotals[month.month] || 0) + (month.waterCharge || 0);
                        });

                        return (
                          <tr key={unitId}>
                            <td className="unit-cell">{unitId}</td>
                            {bill.readingsIncluded?.map(r => {
                              const monthData = unitData.monthlyBreakdown?.find(m => m.month === r.month);
                              // monthlyBreakdown amounts are still in centavos (backend doesn't convert them)
                              const amountInCentavos = monthData ? (monthData.waterCharge || 0) : 0;
                              const amountInPesos = amountInCentavos / 100;
                              return (
                                <td key={r.month} className="month-cell">
                                  {formatCurrency(amountInPesos)}
                                </td>
                              );
                            })}
                            <td className="total-cell">
                              {formatCurrency(unitData.totalAmount || 0)}
                            </td>
                            <td className={`status-cell ${getStatusClass(unitData.status)}`}>
                              {getStatusLabel(unitData.status)}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Totals row */}
                      <tr className="totals-row">
                        <td className="unit-cell totals-label">TOTAL</td>
                        {bill.readingsIncluded?.map(r => {
                          // monthlyBreakdown amounts are in centavos, convert to pesos
                          const monthTotalCentavos = unitIds.reduce((sum, unitId) => {
                            const unitData = bill.bills.units[unitId];
                            const monthData = unitData?.monthlyBreakdown?.find(m => m.month === r.month);
                            return sum + (monthData?.waterCharge || 0);
                          }, 0);
                          const monthTotalPesos = monthTotalCentavos / 100;
                          return (
                            <td key={r.month} className="month-cell totals-value">
                              {formatCurrency(monthTotalPesos)}
                            </td>
                          );
                        })}
                        <td className="total-cell totals-value">
                          {formatCurrency(totalBilled)}
                        </td>
                        <td className="status-cell"></td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default WaterHistoryQuarterly;

