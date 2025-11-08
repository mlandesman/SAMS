import React, { useState, useEffect, useRef } from 'react';
import { useClient } from '../../context/ClientContext';
import { getUnits } from '../../api/units';
import { getPaymentMethods } from '../../api/paymentMethods';
import { getAuthInstance } from '../../firebaseClient';
import unifiedPaymentAPI from '../../api/unifiedPaymentAPI';
import { formatAsMXN } from '../../utils/hoaDuesUtils';
import { getMexicoDateString } from '../../utils/timezone';
import { LoadingSpinner } from '../common';
import './UnifiedPaymentModal.css';

/**
 * UnifiedPaymentModal Component
 * 
 * Unified payment interface for HOA dues, water bills, and penalties
 * Integrates with backend's priority-based allocation system
 */
function UnifiedPaymentModal({ isOpen, onClose, unitId: initialUnitId, onSuccess }) {
  const { selectedClient } = useClient();
  
  // Form state
  const [selectedUnit, setSelectedUnit] = useState(initialUnitId || '');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(getMexicoDateString());
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [accountToCredit, setAccountToCredit] = useState(null);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  
  // Data state
  const [units, setUnits] = useState([]);
  const [unpaidBills, setUnpaidBills] = useState([]);
  const [totalDue, setTotalDue] = useState(0);
  const [currentCreditBalance, setCreditBalance] = useState(0);
  const [clientPaymentMethods, setClientPaymentMethods] = useState([]);
  const [clientAccounts, setClientAccounts] = useState([]);
  
  // Preview state
  const [preview, setPreview] = useState(null);
  const [creditUsed, setCreditUsed] = useState(0);
  const [creditRemaining, setCreditRemaining] = useState(0);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState(null);
  
  // Prevent duplicate calculations
  const isCalculating = useRef(false);
  
  // Load units when modal opens
  useEffect(() => {
    console.log('🔵 [UnifiedPaymentModal] useEffect triggered:', { 
      isOpen, 
      hasClient: !!selectedClient,
      clientId: selectedClient?.id 
    });
    
    if (isOpen && selectedClient) {
      console.log('🔵 [UnifiedPaymentModal] Modal is open, loading data...');
      loadUnitsData();
      loadPaymentMethods();
      loadClientAccounts();
    }
  }, [isOpen, selectedClient]);
  
  // Reset form when unit is selected
  useEffect(() => {
    if (isOpen && selectedUnit && selectedClient) {
      // Clear previous preview data
      setUnpaidBills([]);
      setPreview(null);
      setPaymentAmount('');
      setCreditBalance(0);
      setTotalDue(0);
      setCreditUsed(0);
      setCreditRemaining(0);
      setError(null);
      
      console.log('🔵 [UnifiedPaymentModal] Unit selected, ready for payment entry');
    }
  }, [isOpen, selectedUnit, selectedClient]);
  
  /**
   * Load units list from API
   */
  const loadUnitsData = async () => {
    console.log('🔵 [UnifiedPaymentModal] loadUnitsData called');
    console.log('🔵 [UnifiedPaymentModal] Fetching units for client:', selectedClient?.id);
    
    try {
      // Fetch units from API
      const response = await getUnits(selectedClient.id);
      
      if (response.success && (response.units || response.data)) {
        const unitsData = response.units || response.data;
        console.log('🔵 [UnifiedPaymentModal] Fetched units:', unitsData);
        
        const unitsList = unitsData.map(unit => {
          console.log(`🔵 [UnifiedPaymentModal] Processing unit:`, unit);
          return {
            unitId: unit.unitId || unit.id,
            // Use owners array if available, fallback to ownerNames, then Unknown Owner
            ownerNames: unit.owners || unit.ownerNames || ['Unknown Owner']
          };
        });
        
        console.log(`✅ [UnifiedPaymentModal] Loaded ${unitsList.length} units:`, unitsList);
        setUnits(unitsList);
      } else {
        console.error('❌ [UnifiedPaymentModal] Failed to fetch units:', response);
        setUnits([]);
      }
    } catch (error) {
      console.error('❌ [UnifiedPaymentModal] Error fetching units:', error);
      setUnits([]);
    }
  };
  
  /**
   * Load payment methods
   */
  const loadPaymentMethods = async () => {
    try {
      const auth = getAuthInstance();
      const token = await auth.currentUser?.getIdToken();
      const response = await getPaymentMethods(selectedClient.id, token);
      
      const activeMethods = response.data
        .filter(method => method.status === 'active')
        .sort((a, b) => a.name.localeCompare(b.name));
      
      setClientPaymentMethods(activeMethods);
      
      // Default to eTransfer
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
  
  /**
   * Load client accounts
   */
  const loadClientAccounts = () => {
    if (selectedClient?.accounts) {
      const validAccounts = selectedClient.accounts
        .filter(acc => acc.id && acc.name && acc.type)
        .sort((a, b) => a.name.localeCompare(b.name));
      
      setClientAccounts(validAccounts);
      
      // Default to Scotiabank account
      const scotiabankAccount = validAccounts.find(acc => 
        acc.name.toLowerCase().includes('scotiabank') || acc.name.toLowerCase().includes('scotia')
      );
      if (scotiabankAccount) {
        setAccountToCredit(scotiabankAccount);
      } else if (validAccounts.length > 0) {
        setAccountToCredit(validAccounts[0]);
      }
    }
  };
  
  // Removed loadPreviewForUnit - we don't pre-load anything
  // User enters the amount they received, then we show what it covers
  
  /**
   * Calculate payment distribution (triggered on amount/date blur)
   */
  const calculatePaymentDistribution = async (overrideAmount = null, overrideDate = null) => {
    // Prevent duplicate calls
    if (isCalculating.current) {
      console.log('🔍 Calculation already in progress, skipping...');
      return;
    }
    
    const amount = overrideAmount !== null ? overrideAmount : parseFloat(paymentAmount) || 0;
    const dateToUse = overrideDate || paymentDate;
    
    if (amount <= 0) {
      console.log('🔵 No amount entered yet, skipping preview');
      return;
    }
    
    if (amount < 0) {
      setError('Payment amount cannot be negative');
      return;
    }
    
    isCalculating.current = true;
    setCalculating(true);
    setError(null);
    
    try {
      console.log(`💰 Calculating payment distribution: $${amount} on ${dateToUse}`);
      
      const previewData = await unifiedPaymentAPI.previewUnifiedPayment(
        selectedClient.id,
        selectedUnit,
        {
          amount: amount,
          paymentDate: dateToUse
        }
      );
      
      console.log('📊 Payment Distribution Preview:', previewData);
      
      // Update bills with preview statuses
      setUnpaidBills(previewData.billPayments || []);
      setPreview(previewData);
      
      // Calculate and display total due from bills
      const calculatedTotalDue = (previewData.billPayments || []).reduce(
        (sum, bill) => sum + (bill.totalDue || 0), 
        0
      );
      setTotalDue(calculatedTotalDue);
      
      // Update credit calculations
      setCreditBalance(previewData.currentCreditBalance || 0);
      setCreditUsed(previewData.creditUsed || 0);
      setCreditRemaining(previewData.newCreditBalance || 0);
      
      console.log(`💰 Preview shows ${previewData.billPayments?.length || 0} bills affected by $${amount} payment`);
      
    } catch (error) {
      console.error('Error calculating payment distribution:', error);
      setError('Failed to calculate payment distribution. Please try again.');
    } finally {
      isCalculating.current = false;
      setCalculating(false);
    }
  };
  
  /**
   * Handle form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!selectedUnit) {
      setError('Please select a unit');
      return;
    }
    
    const amount = parseFloat(paymentAmount) || 0;
    if (amount < 0) {
      setError('Payment amount cannot be negative');
      return;
    }
    
    // Allow $0 only if credit balance covers at least the first bill
    if (amount === 0 && (currentCreditBalance <= 0 || unpaidBills.length === 0)) {
      setError('Payment amount must be greater than zero or credit balance must cover bills');
      return;
    }
    
    if (!accountToCredit) {
      setError('Please select an account to credit');
      return;
    }
    
    if (!paymentMethod) {
      setError('Please select a payment method');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await unifiedPaymentAPI.recordUnifiedPayment(
        selectedClient.id,
        selectedUnit,
        {
          amount: amount,
          paymentDate: paymentDate,
          paymentMethod: paymentMethod,
          paymentMethodId: paymentMethodId,
          accountId: accountToCredit.id,
          accountType: accountToCredit.type,
          reference: reference,
          notes: notes
        },
        preview
      );
      
      console.log('✅ Unified payment recorded successfully:', result);
      
      // Call success callback to refresh views
      if (onSuccess) {
        onSuccess();
      }
      
      // Close modal
      onClose();
      
    } catch (error) {
      console.error('Error recording unified payment:', error);
      setError(error.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Format bill period for display
   */
  const formatBillPeriod = (billPeriod, billType, monthData) => {
    const prefix = billType === 'hoa' ? 'HOA' : billType === 'water' ? 'Water' : 'Bill';
    
    console.log('formatBillPeriod called:', {
      billPeriod,
      billType,
      monthData,
      duesFrequency: selectedClient?.configuration?.feeStructure?.duesFrequency,
      fiscalYearStartMonth: selectedClient?.configuration?.fiscalYearStartMonth
    });
    
    // For quarterly HOA bills (backend sends isQuarterly flag)
    if (billType === 'hoa' && monthData?.isQuarterly) {
      const quarterNumber = (monthData.quarterIndex || 0) + 1;
      return `${prefix} Q${quarterNumber}`;
    }
    
    // For HOA bills with quarterly billing, check if this is part of a quarter (legacy check)
    if (billType === 'hoa' && selectedClient?.configuration?.feeStructure?.duesFrequency === 'quarterly' && monthData?.monthIndex !== undefined) {
      const fiscalYearStartMonth = selectedClient?.configuration?.fiscalYearStartMonth || 7; // Default July for AVII
      const fiscalMonthIndex = monthData.monthIndex; // 0-11
      const quarterNumber = Math.floor(fiscalMonthIndex / 3) + 1; // Q1-Q4
      
      // Get the three months in this quarter
      const quarterStartFiscalMonth = Math.floor(fiscalMonthIndex / 3) * 3;
      const quarterMonths = [];
      
      for (let i = 0; i < 3; i++) {
        const fiscalMonth = quarterStartFiscalMonth + i;
        const calendarMonth = ((fiscalMonth + fiscalYearStartMonth - 1) % 12) + 1; // 1-12
        const calendarMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        quarterMonths.push(calendarMonthNames[calendarMonth - 1]);
      }
      
      return `${prefix} Q${quarterNumber} (${quarterMonths.join('/')})`;
    }
    
    // For monthly HOA or water bills
    if (monthData?.monthIndex !== undefined && billType === 'hoa') {
      // Convert fiscal month to calendar month for HOA
      const fiscalYearStartMonth = selectedClient?.configuration?.fiscalYearStartMonth || 1; // Default Jan
      const fiscalMonthIndex = monthData.monthIndex; // 0-11
      const calendarMonth = ((fiscalMonthIndex + fiscalYearStartMonth - 1) % 12) + 1; // 1-12
      const calendarMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthName = calendarMonthNames[calendarMonth - 1];
      return `${prefix} ${monthName}`;
    } else if (monthData?.month) {
      // Direct calendar month from backend (water bills or legacy)
      const calendarMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthName = calendarMonthNames[monthData.month - 1] || monthData.month;
      return `${prefix} ${monthName}`;
    }
    
    // Fallback: parse from billPeriod
    // billPeriod format: "2026-00", "2026-01", etc. (fiscal month index)
    const [year, fiscalMonthIndex] = billPeriod.split('-');
    return `${prefix} ${billPeriod}`;
  };
  
  /**
   * Get status display info
   */
  const getStatusInfo = (bill) => {
    if (!bill) return { text: 'UNPAID', className: 'status-unpaid' };
    
    if (bill.totalPayment >= bill.totalDue) {
      return { text: 'Will be paid in full', className: 'status-paid' };
    } else if (bill.totalPayment > 0) {
      return { text: 'PARTIAL', className: 'status-partial' };
    } else {
      return { text: 'UNPAID', className: 'status-unpaid' };
    }
  };
  
  if (!isOpen) {
    console.log('🔵 [UnifiedPaymentModal] Modal not open, returning null');
    return null;
  }
  
  console.log('🔵 [UnifiedPaymentModal] Rendering modal, units:', units.length);
  
  return (
    <div className="modal-backdrop">
      <div className="unified-payment-modal">
        <div className="modal-header">
          <h2>Bill Payment System</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          {/* Unit Selector */}
          <div className="form-group">
            <label>Unit:</label>
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              disabled={loading || loadingData}
              required
            >
              <option value="">-- Select Unit --</option>
              {units.map(unit => (
                <option key={unit.unitId} value={unit.unitId}>
                  {unit.unitId} - {unit.ownerNames.join(', ')}
                </option>
              ))}
            </select>
          </div>
          
          {loadingData ? (
            <div className="loading-container">
              <LoadingSpinner variant="logo" message="Loading bill information..." size="medium" show={true} />
            </div>
          ) : (
            <>
              {/* Credit Balance Display - only show if we have a unit selected and credit exists */}
              {selectedUnit && currentCreditBalance !== 0 && (
                <div className="credit-balance-info">
                  <h3>Credit Balance: {formatAsMXN(currentCreditBalance)}</h3>
                </div>
              )}
              
              {/* Payment Date - always show if unit selected */}
              {selectedUnit && (
                <div className="form-group" style={{ marginTop: '10px', marginBottom: '10px' }}>
                  <label>Payment Date:</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    onBlur={(e) => {
                      const newDate = e.target.value;
                      if (paymentAmount && parseFloat(paymentAmount) >= 0 && newDate) {
                        calculatePaymentDistribution(null, newDate);
                      }
                    }}
                    required
                    disabled={loading}
                  />
                </div>
              )}
              
              {/* Bills Affected by This Payment */}
              {paymentAmount && unpaidBills.length > 0 && (
                <div className="unpaid-bills-summary">
                  <h3>Bills Affected by This Payment ({unpaidBills.length})</h3>
                  {calculating ? (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                      <LoadingSpinner variant="logo" size="small" show={true} />
                      <p>Calculating payment allocation...</p>
                    </div>
                  ) : (
                  <table className="bills-table">
                    <thead>
                      <tr>
                        <th>Bill</th>
                        <th>Base Charge Due</th>
                        <th>Penalties</th>
                        <th>Total Due</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unpaidBills.map((bill, index) => {
                        // Bills are already sorted by priority in the API layer
                          const statusInfo = getStatusInfo(bill);
                          return (
                            <tr key={index}>
                              <td>{formatBillPeriod(bill.billPeriod, bill.billType, bill.monthData)}</td>
                              <td>{formatAsMXN(bill.baseChargeDue)}</td>
                              <td>{formatAsMXN(bill.penaltyDue)}</td>
                              <td><strong>{formatAsMXN(bill.totalDue)}</strong></td>
                              <td className={statusInfo.className}>{statusInfo.text}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                  )}
                </div>
              )}
              
              <form onSubmit={handleSubmit}>
                {/* Payment Amount - always show */}
                <div className="form-group">
                  <label>Payment Amount:</label>
                  <div className="input-group">
                    <span className="currency-symbol">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      onBlur={() => {
                        const amount = parseFloat(paymentAmount);
                        if (selectedUnit && !isNaN(amount) && amount >= 0) {
                          calculatePaymentDistribution();
                        }
                      }}
                      required
                      disabled={loading || !selectedUnit}
                      placeholder={!selectedUnit ? "Select a unit first" : ""}
                    />
                  </div>
                </div>
                
                {/* Credit Calculation Display */}
                {paymentAmount && (
                  <div className="funds-calculation">
                    {calculating ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <LoadingSpinner variant="logo" size="small" show={true} />
                        <span>Calculating payment distribution...</span>
                      </div>
                    ) : (
                      <>
                        <p><strong>Total Available Funds:</strong> <span className="total-funds">{formatAsMXN((parseFloat(paymentAmount) || 0) + currentCreditBalance)}</span></p>
                        <p><strong>Credit Balance Used:</strong> {formatAsMXN(creditUsed)}</p>
                        <p><strong>Credit Balance Remaining:</strong> {formatAsMXN(creditRemaining)}</p>
                      </>
                    )}
                  </div>
                )}
                
                {/* Payment Method and Account - always show */}
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
                      disabled={loading || !selectedUnit}
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
                      value={accountToCredit?.id || ''}
                      onChange={(e) => {
                        const account = clientAccounts.find(acc => acc.id === e.target.value);
                        setAccountToCredit(account);
                      }}
                      required
                      disabled={loading || !selectedUnit}
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
                
                {/* Reference and Notes - always show */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Reference:</label>
                    <input
                      type="text"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      disabled={loading || !selectedUnit}
                      placeholder="Check #, transfer ref, etc."
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Notes:</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      disabled={loading || !selectedUnit}
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
                    disabled={loading || calculating || !selectedUnit || !accountToCredit || !paymentMethod}
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

export default UnifiedPaymentModal;

