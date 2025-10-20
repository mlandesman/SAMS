import React, { useState, useEffect, useRef } from 'react';
import { useClient } from '../../context/ClientContext';
import { useWaterBills } from '../../context/WaterBillsContext';
import { getPaymentMethods } from '../../api/paymentMethods';
import { getAuthInstance } from '../../firebaseClient';
import waterAPI from '../../api/waterAPI';
import { formatAsMXN } from '../../utils/hoaDuesUtils';
import './WaterPaymentModal.css';

function WaterPaymentModal({ isOpen, onClose, unitId, selectedMonth, onSuccess }) {
  const { selectedClient } = useClient();
  const { waterData } = useWaterBills();
  
  // Form state
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Data state  
  const [unpaidBills, setUnpaidBills] = useState([]);
  const [currentCreditBalance, setCreditBalance] = useState(0);
  const [clientPaymentMethods, setClientPaymentMethods] = useState([]);
  const [clientAccounts, setClientAccounts] = useState([]);
  
  // Payment calculation state
  const [creditUsed, setCreditUsed] = useState(0);
  const [creditRemaining, setCreditRemaining] = useState(0);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState(null);
  
  // Load unpaid bills and credit balance when modal opens
  useEffect(() => {
    if (isOpen && unitId && selectedClient && waterData && Object.keys(waterData).length > 0 && selectedMonth !== undefined) {
      loadUnpaidBillsData();
      loadPaymentMethods();
      loadClientAccounts();
    }
  }, [isOpen, unitId, selectedClient, waterData, selectedMonth]);
  
  // Payment distribution calculation (only on blur)
  
  const loadUnpaidBillsData = async () => {
    setLoadingData(true);
    try {
      // Get total due from aggregatedData for the SELECTED month (same as table)
      let totalDue = 0;
      if (waterData.months && Array.isArray(waterData.months) && selectedMonth !== undefined) {
        // Use the SAME month that the table is displaying
        const monthData = waterData.months[selectedMonth];
        
        if (monthData && monthData.units && monthData.units[unitId]) {
          const unitData = monthData.units[unitId];
          totalDue = unitData.displayTotalDue || 0;
          console.log(`🔍 [WaterPaymentModal] Using selected month ${selectedMonth} (${monthData.monthName} ${monthData.calendarYear}), displayTotalDue: $${totalDue}`);
        } else {
          console.warn(`⚠️ [WaterPaymentModal] No unit data found for unit ${unitId} in month ${selectedMonth}`);
        }
      }
      
      console.log(`🔍 [WaterPaymentModal] Loading unpaid bills via preview API with total due: $${totalDue}`);
      
      // Get the due date from the selected month for backdated payment calculation
      const selectedMonthData = waterData.months[selectedMonth];
      const payOnDate = selectedMonthData?.dueDate;
      
      console.log(`🔍 [WaterPaymentModal] Using payment date: ${payOnDate} (due date for selected month)`);
      
      // Call preview API with total due amount and payment date
      const response = await waterAPI.previewPayment(selectedClient.id, { 
        unitId, 
        amount: totalDue,
        payOnDate: payOnDate,
        selectedMonth: selectedMonth
      });
      
      if (response.success && response.data) {
        const previewData = response.data;
        
        // DEBUG: Log the full preview API response
        console.log(`🔍 [DEBUG] Preview API Response:`, {
          currentCreditBalance: previewData.currentCreditBalance,
          newCreditBalance: previewData.newCreditBalance,
          creditUsed: previewData.creditUsed,
          overpayment: previewData.overpayment,
          totalAvailableFunds: previewData.totalAvailableFunds,
          billPayments: previewData.billPayments,
          fullResponse: previewData
        });
        
        // Build unpaid bills table from preview data
        // Filter to only show bills up to and including the selected month
        const selectedMonthData = waterData.months[selectedMonth];
        const selectedFiscalYear = selectedMonthData?.fiscalYear;
        const selectedMonthNum = selectedMonthData?.month;
        
        console.log(`🔍 [WaterPaymentModal] Filtering bills to show only up to fiscal year ${selectedFiscalYear}, month ${selectedMonthNum}`);
        
        const filteredBillPayments = previewData.billPayments.filter(billPayment => {
          // Parse the bill period (e.g., "2026-00", "2026-01", etc.)
          const [billFiscalYear, billMonth] = billPayment.billPeriod.split('-');
          const billFiscalYearNum = parseInt(billFiscalYear);
          const billMonthNum = parseInt(billMonth);
          
          // Include bill if it's in the same fiscal year and month <= selected month
          // OR if it's in a previous fiscal year
          const isIncluded = (billFiscalYearNum < selectedFiscalYear) || 
                           (billFiscalYearNum === selectedFiscalYear && billMonthNum <= selectedMonthNum);
          
          console.log(`🔍 Bill ${billPayment.billPeriod}: fiscal year ${billFiscalYearNum}, month ${billMonthNum} vs selected ${selectedFiscalYear}, ${selectedMonthNum} -> ${isIncluded ? 'INCLUDED' : 'EXCLUDED'}`);
          
          return isIncluded;
        });
        
        const unpaidBills = filteredBillPayments.map(billPayment => ({
          unitId: unitId,
          period: billPayment.billPeriod,
          baseChargeDue: billPayment.baseChargePaid, // Amount that would be paid
          penaltiesDue: billPayment.penaltyPaid,      // Amount that would be paid
          unpaidAmount: billPayment.amountPaid,       // Total amount that would be paid
          status: billPayment.newStatus === 'paid' ? 'Will be paid in full' : 'Partial payment',
          statusClass: billPayment.newStatus === 'paid' ? 'status-paid' : 
                      billPayment.newStatus === 'partial' ? 'status-partial' : 'status-unpaid'
        }));
        
        // Get credit balance from preview data
        const creditBalance = previewData.currentCreditBalance || 0;
        
        setUnpaidBills(unpaidBills);
        setCreditBalance(creditBalance);
        setAmount(totalDue.toString());
        
        // Initialize credit usage data for full payment scenario
        setCreditUsed(0); // No credit used for full payment
        setCreditRemaining(creditBalance); // All credit remains
        
        console.log(`💧 [WaterPaymentModal] Loaded ${unpaidBills.length} unpaid bills via preview API, total due: $${totalDue}`);
      } else {
        console.error('Failed to get preview data:', response);
        setError('Failed to load unpaid bills data');
      }
      
    } catch (error) {
      console.error('Error loading unpaid bills data:', error);
      setError('Failed to load unpaid bills data');
    } finally {
      setLoadingData(false);
    }
  };
  
  const loadPaymentMethods = async () => {
    try {
      const auth = getAuthInstance();
      const token = await auth.currentUser?.getIdToken();
      const response = await getPaymentMethods(selectedClient.id, token);
      
      const activeMethods = response.data
        .filter(method => method.status === 'active')
        .sort((a, b) => a.name.localeCompare(b.name));
      
      setClientPaymentMethods(activeMethods);
      // Default to eTransfer for faster testing
      const eTransferMethod = activeMethods.find(method => method.name === 'eTransfer');
      if (eTransferMethod) {
        setPaymentMethodId(eTransferMethod.id);
        setPaymentMethod(eTransferMethod.name);
      } else if (activeMethods.length > 0) {
        setPaymentMethodId(activeMethods[0].id);
        setPaymentMethod(activeMethods[0].name);
      }
    } catch (error) {
      console.error('Error loading payment methods:', error);
    }
  };
  
  const loadClientAccounts = () => {
    if (selectedClient?.accounts) {
      const validAccounts = selectedClient.accounts
        .filter(acc => acc.id && acc.name && acc.type)
        .sort((a, b) => a.name.localeCompare(b.name));
      
      setClientAccounts(validAccounts);
      // Default to Scotiabank account for faster testing
      const scotiabankAccount = validAccounts.find(acc => 
        acc.name.toLowerCase().includes('scotiabank') || acc.name.toLowerCase().includes('scotia')
      );
      if (scotiabankAccount) {
        setSelectedAccount(scotiabankAccount);
      } else if (validAccounts.length > 0) {
        setSelectedAccount(validAccounts[0]);
      }
    }
  };
  
  // Payment distribution calculation (only on blur)
  const isCalculating = useRef(false);
  
  const calculatePaymentDistribution = async () => {
    // Prevent duplicate calls
    if (isCalculating.current) {
      console.log('🔍 Debug: Calculation already in progress, skipping...');
      return;
    }
    
    const paymentAmount = parseFloat(amount) || 0;
    
    if (paymentAmount <= 0) {
      return;
    }
    
    isCalculating.current = true;
    
    try {
      console.log(`💰 Fetching payment distribution from backend: $${paymentAmount}`);
      
      // Get the due date from the selected month for backdated payment calculation
      const selectedMonthData = waterData.months[selectedMonth];
      const payOnDate = selectedMonthData?.dueDate;
      
      console.log(`🔍 [WaterPaymentModal] Using payment date: ${payOnDate} (due date for selected month)`);
      
      // Call backend preview API (single source of truth)
      const response = await waterAPI.previewPayment(selectedClient.id, {
        unitId,
        amount: paymentAmount,
        payOnDate: payOnDate,
        selectedMonth: selectedMonth
      });
      
      if (response.success && response.data) {
        const dist = response.data;
        
        // DEBUG: Log the full preview API response during calculation
        console.log(`🔍 [DEBUG] Payment Distribution Response:`, {
          paymentAmount: paymentAmount,
          currentCreditBalance: dist.currentCreditBalance,
          newCreditBalance: dist.newCreditBalance,
          creditUsed: dist.creditUsed,
          overpayment: dist.overpayment,
          totalAvailableFunds: dist.totalAvailableFunds,
          billPayments: dist.billPayments,
          fullResponse: dist
        });
        
        // Update the status column in existing unpaid bills based on preview results
        setUnpaidBills(prevBills => 
          prevBills.map(bill => {
            // Find matching bill payment from preview
            const billPayment = dist.billPayments.find(bp => bp.billPeriod === bill.period);
            
            if (billPayment) {
              // Determine status based on payment amount
              let status = 'UNPAID';
              if (billPayment.amountPaid > 0) {
                if (billPayment.newStatus === 'paid') {
                  status = 'Will be paid in full';
                } else {
                  status = 'Partial payment';
                }
              }
              
              return {
                ...bill,
                status: status,
                statusClass: billPayment.newStatus === 'paid' ? 'status-paid' : 
                            billPayment.newStatus === 'partial' ? 'status-partial' : 'status-unpaid'
              };
            }
            
            // This should never happen now since backend returns all bills
            return bill;
          })
        );
        
        // Don't update credit balance during payment calculation - only update status
        // Credit balance should remain at the initial value throughout the modal session
        
        // Store credit usage data for display
        setCreditUsed(dist.creditUsed || 0);
        setCreditRemaining(dist.newCreditBalance || 0);
        
        console.log(`✅ Status updated for ${dist.billPayments.length} bills, Credit used: $${dist.creditUsed}, Overpayment: $${dist.overpayment}`);
      }
    } catch (error) {
      console.error('Error calculating payment distribution:', error);
      setError('Failed to calculate payment distribution. Please try again.');
    } finally {
      isCalculating.current = false;
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }
    
    if (!selectedAccount) {
      setError('Please select an account');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await waterAPI.recordPayment(selectedClient.id, {
        unitId,
        amount: parseFloat(amount),
        paymentDate,
        paymentMethod,
        paymentMethodId,
        reference,
        notes,
        accountId: selectedAccount.id,
        accountType: selectedAccount.type,
        selectedMonth: selectedMonth  // FIX #3: Pass selectedMonth to match preview behavior
      });
      
      console.log('💳 Full payment API response:', response.data);
      
      if (response.data.success) {
        const result = response.data.data;
        console.log('✅ Water payment recorded successfully:', response.data);
        
        // CRITICAL: Capture transaction ID from payment response (following HOA Dues pattern)
        // Check multiple possible locations for transaction ID in the API response
        const transactionId = response.data.transactionId || result?.transactionId;
        
        if (transactionId) {
          console.log(`💳 Transaction ID captured: ${transactionId}`);
          // The backend waterPaymentsService already stores transactionId in bill records
          // This creates the bidirectional linking between payments and transactions
        } else {
          console.warn('⚠️ No transaction ID returned from payment - linking may be incomplete');
          console.log('Full response for debugging:', response.data);
        }
        
        onSuccess();
        onClose();
      }
      
    } catch (error) {
      console.error('Error recording payment:', error);
      console.error('Full error object:', error);
      setError(error.response?.data?.error || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="modal-backdrop">
      <div className="water-payment-modal">
        <div className="modal-header">
          <h2>Water Bill Payment - Unit {unitId}</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          {loadingData ? (
            <div className="loading">Loading bill information...</div>
          ) : (
            <>
              {/* Total Due and Credit Balance Display */}
              <div className="credit-balance-info">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {/* Cross-bill summation: each bill.unpaidAmount is pre-calculated by backend (WB1) */}
                  <h3 style={{ color: '#dc3545' }}>
                    Total Due: {formatAsMXN(unpaidBills.reduce((sum, bill) => sum + bill.unpaidAmount, 0))}
                  </h3>
                  <h3>Credit Balance: {formatAsMXN(currentCreditBalance)}</h3>
                </div>
                {currentCreditBalance < 0 && (
                  <p className="credit-negative">⚠️ Negative balance will be repaired first</p>
                )}
              </div>
              
              {/* Unpaid Bills Summary */}
              <div className="unpaid-bills-summary">
                <h3>Unpaid Bills ({unpaidBills.length})</h3>
                {unpaidBills.length === 0 ? (
                  <p className="no-bills">No unpaid bills. Payment will go to credit balance.</p>
                ) : (
                  <table className="bills-table">
                    <thead>
                      <tr>
                        <th>Period</th>
                        <th>Base Charge Due</th>
                        <th>Penalties</th>
                        <th>Total Due</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unpaidBills.map(bill => (
                        <tr key={bill.period}>
                          <td>{bill.period}</td>
                          <td>{formatAsMXN(bill.baseChargeDue)}</td>
                          <td>{formatAsMXN(bill.penaltiesDue)}</td>
                          <td><strong>{formatAsMXN(bill.unpaidAmount)}</strong></td>
                          <td className={bill.statusClass}>{bill.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              
              <form onSubmit={handleSubmit}>
                {/* Payment Amount */}
                <div className="form-group">
                  <label>Payment Amount:</label>
                  <div className="input-group">
                    <span className="currency-symbol">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      onBlur={() => {
                        // Trigger calculation immediately when field loses focus
                        if (amount && unpaidBills.length >= 0) {
                          calculatePaymentDistribution();
                        }
                      }}
                      required
                      disabled={loading}
                      autoFocus
                    />
                  </div>
                </div>
                
                {/* Show Available Funds Calculation */}
                {amount && (
                  <div className="funds-calculation">
                    <p><strong>Total Available Funds:</strong> <span className="total-funds">{formatAsMXN((parseFloat(amount) || 0) + currentCreditBalance)}</span></p>
                    <p><strong>Credit Balance Used:</strong> {formatAsMXN(creditUsed)}</p>
                    <p><strong>Credit Balance Remaining:</strong> {formatAsMXN(creditRemaining)}</p>
                  </div>
                )}
                
                {/* Payment Method and Account Selection */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Payment Method:</label>
                    <select
                      value={paymentMethodId}
                      onChange={(e) => {
                        const methodId = e.target.value;
                        const method = clientPaymentMethods.find(m => m.id === methodId);
                        setPaymentMethodId(methodId);
                        setPaymentMethod(method ? method.name : '');
                      }}
                      required
                      disabled={loading}
                    >
                      <option value="">-- Select Method --</option>
                      {clientPaymentMethods.map(method => (
                        <option key={method.id} value={method.id}>
                          {method.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Account to Credit:</label>
                    <select
                      value={selectedAccount?.id || ''}
                      onChange={(e) => {
                        const account = clientAccounts.find(acc => acc.id === e.target.value);
                        setSelectedAccount(account);
                      }}
                      required
                      disabled={loading}
                    >
                      <option value="">-- Select Account --</option>
                      {clientAccounts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {/* Payment Date */}
                <div className="form-group">
                  <label>Payment Date:</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                
                {/* Reference and Notes */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Reference:</label>
                    <input
                      type="text"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      disabled={loading}
                      placeholder="Check #, transfer ref, etc."
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Notes:</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      disabled={loading}
                      placeholder="Additional payment details..."
                    />
                  </div>
                </div>
                
                {error && <div className="error-message">{error}</div>}
                
                <div className="modal-footer">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="btn-cancel"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !amount || !selectedAccount || !paymentMethod}
                    className="btn-primary"
                  >
                    {loading ? 'Recording Payment...' : 'Record Payment'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default WaterPaymentModal;