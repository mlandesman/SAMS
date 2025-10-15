import React, { useState, useEffect } from 'react';
import { useClient } from '../../context/ClientContext';
import { getPaymentMethods } from '../../api/paymentMethods';
import { getAuthInstance } from '../../firebaseClient';
import waterAPI from '../../api/waterAPI';
import { formatAsMXN } from '../../utils/hoaDuesUtils';
import { convertPeriodToReadableDate } from '../../utils/fiscalYearUtils';
import './WaterPaymentModal.css';

function WaterPaymentModal({ isOpen, onClose, unitId, onSuccess }) {
  const { selectedClient } = useClient();
  
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
  const [paymentDistribution, setPaymentDistribution] = useState(null);
  const [clientPaymentMethods, setClientPaymentMethods] = useState([]);
  const [clientAccounts, setClientAccounts] = useState([]);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState(null);
  
  // Load unpaid bills and credit balance when modal opens
  useEffect(() => {
    if (isOpen && unitId && selectedClient) {
      loadUnpaidBillsData();
      loadPaymentMethods();
      loadClientAccounts();
    }
  }, [isOpen, unitId, selectedClient]);
  
  // Calculate payment distribution when amount changes (FOLLOWS HOA LOGIC)
  useEffect(() => {
    if (amount && unpaidBills.length >= 0) { // Allow calculation even with 0 bills
      calculatePaymentDistribution();
    }
  }, [amount, unpaidBills, currentCreditBalance]);
  
  const loadUnpaidBillsData = async () => {
    setLoadingData(true);
    try {
      const response = await waterAPI.getUnpaidBillsSummary(selectedClient.id, unitId);
      
      // DEBUG: Log raw response to see what we're getting
      console.log('🔍 [DEBUG] Raw API response:', JSON.stringify(response, null, 2));
      console.log('🔍 [DEBUG] response.data:', JSON.stringify(response.data, null, 2));
      console.log('🔍 [DEBUG] response.data.currentCreditBalance:', response.data?.currentCreditBalance);
      
      setUnpaidBills(response.data.unpaidBills || []);
      setCreditBalance(response.data.currentCreditBalance || 0);
      
      // Auto-set payment amount to total due for faster testing
      const totalDue = (response.data.unpaidBills || []).reduce((sum, bill) => sum + bill.unpaidAmount, 0);
      if (totalDue > 0) {
        setAmount(totalDue.toString());
      }
      
      console.log(`💧 Loaded ${response.data.unpaidBills?.length || 0} unpaid bills, credit balance: $${response.data.currentCreditBalance || 0}, auto-set amount: $${totalDue}`);
      
    } catch (error) {
      console.error('Error loading unpaid bills:', error);
      setError('Failed to load bill information');
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
  
  const calculatePaymentDistribution = () => {
    const paymentAmount = parseFloat(amount) || 0;
    
    // IDENTICAL TO HOA LOGIC: Payment + Credit = Total Available Funds
    const totalAvailableFunds = paymentAmount + currentCreditBalance;
    
    console.log(`💰 Payment distribution: $${paymentAmount} + $${currentCreditBalance} credit = $${totalAvailableFunds} total`);
    
    let remainingFunds = totalAvailableFunds;
    const distribution = [];
    let totalBaseToApply = 0;
    let totalPenaltiesToApply = 0;
    
    // Apply funds to bills (oldest first)
    for (const bill of unpaidBills) {
      if (remainingFunds <= 0) break;
      
      const unpaidAmount = bill.unpaidAmount;
      // Use currentCharge only (baseAmount field will be removed)
      const baseUnpaid = (bill.currentCharge || 0) - (bill.basePaid || 0);
      const penaltyUnpaid = bill.penaltyAmount - (bill.penaltyPaid || 0);
      
      if (remainingFunds >= unpaidAmount) {
        // Pay bill in full
        distribution.push({
          period: bill.period,
          amountApplied: unpaidAmount,
          baseChargePaid: baseUnpaid,
          penaltyPaid: penaltyUnpaid,
          status: 'Will be paid in full'
        });
        
        totalBaseToApply += baseUnpaid;
        totalPenaltiesToApply += penaltyUnpaid;
        remainingFunds -= unpaidAmount;
        
      } else if (remainingFunds > 0) {
        // Partial payment - base charges first
        let toApply = remainingFunds;
        let basePortionPaid = Math.min(toApply, baseUnpaid);
        let penaltyPortionPaid = Math.max(0, toApply - basePortionPaid);
        
        distribution.push({
          period: bill.period,
          amountApplied: remainingFunds,
          baseChargePaid: basePortionPaid,
          penaltyPaid: penaltyPortionPaid,
          status: 'Partial payment'
        });
        
        totalBaseToApply += basePortionPaid;
        totalPenaltiesToApply += penaltyPortionPaid;
        remainingFunds = 0;
      }
    }
    
    // Calculate credit changes (IDENTICAL TO HOA LOGIC)
    const newCreditBalance = remainingFunds;
    const totalUsedForBills = totalAvailableFunds - remainingFunds;
    
    let creditUsed = 0;
    let overpayment = 0;
    
    if (newCreditBalance >= currentCreditBalance) {
      // Overpayment scenario
      overpayment = newCreditBalance - currentCreditBalance;
    } else {
      // Credit was used
      creditUsed = currentCreditBalance - newCreditBalance;
    }
    
    setPaymentDistribution({
      totalAvailableFunds,
      billsToUpdate: distribution,
      totalBaseCharges: totalBaseToApply,
      totalPenalties: totalPenaltiesToApply,
      totalAppliedToBills: totalUsedForBills,
      newCreditBalance,
      creditUsed,
      overpayment
    });
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
        accountType: selectedAccount.type
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
                        <th>Penalties Due</th>
                        <th>Total Due</th>
                        <th>Months Overdue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unpaidBills.map(bill => (
                        <tr key={bill.period}>
                          <td>{convertPeriodToReadableDate(bill.period)}</td>
                          <td>{formatAsMXN((bill.currentCharge || 0) - (bill.basePaid || 0))}</td>
                          <td>{formatAsMXN(bill.penaltyAmount - (bill.penaltyPaid || 0))}</td>
                          <td><strong>{formatAsMXN(bill.unpaidAmount)}</strong></td>
                          <td>{bill.monthsOverdue > 0 ? `${bill.monthsOverdue} months` : 'Current'}</td>
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
                      required
                      disabled={loading}
                      autoFocus
                    />
                  </div>
                </div>
                
                {/* Show Available Funds Calculation */}
                {amount && (
                  <div className="funds-calculation">
                    <p><strong>Payment Amount:</strong> {formatAsMXN(parseFloat(amount) || 0)}</p>
                    <p><strong>Plus Credit Balance:</strong> {formatAsMXN(currentCreditBalance)}</p>
                    <p><strong>Total Available Funds:</strong> <span className="total-funds">{formatAsMXN((parseFloat(amount) || 0) + currentCreditBalance)}</span></p>
                  </div>
                )}
                
                {/* Payment Distribution Display */}
                {paymentDistribution && (
                  <div className="payment-distribution">
                    <h3>Payment Distribution</h3>
                    
                    {paymentDistribution.billsToUpdate.length > 0 ? (
                      <>
                        <table className="distribution-table">
                          <thead>
                            <tr>
                              <th>Bill Period</th>
                              <th>Base Charges</th>
                              <th>Penalties</th>
                              <th>Total Applied</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paymentDistribution.billsToUpdate.map((bill, index) => (
                              <tr key={index}>
                                <td>{convertPeriodToReadableDate(bill.period)}</td>
                                <td>{formatAsMXN(bill.baseChargePaid)}</td>
                                <td>{formatAsMXN(bill.penaltyPaid)}</td>
                                <td><strong>{formatAsMXN(bill.amountApplied)}</strong></td>
                                <td><span className={`status-${bill.status.includes('full') ? 'paid' : 'partial'}`}>
                                  {bill.status}
                                </span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        
                        <div className="distribution-summary">
                          <p><strong>Total Base Charges Paid:</strong> {formatAsMXN(paymentDistribution.totalBaseCharges)}</p>
                          <p><strong>Total Penalties Paid:</strong> {formatAsMXN(paymentDistribution.totalPenalties)}</p>
                          <p><strong>Total Applied to Bills:</strong> {formatAsMXN(paymentDistribution.totalAppliedToBills)}</p>
                        </div>
                      </>
                    ) : (
                      <p className="no-bills-payment">✨ No bills to pay - entire amount will go to credit balance.</p>
                    )}
                    
                    {/* Credit Balance Changes */}
                    <div className="credit-changes">
                      <p><strong>Credit Balance After Payment:</strong> 
                        <span className={`new-balance ${paymentDistribution.newCreditBalance >= 0 ? 'positive' : 'negative'}`}>
                          {formatAsMXN(paymentDistribution.newCreditBalance)}
                        </span>
                      </p>
                      
                      {paymentDistribution.creditUsed > 0 && (
                        <p className="credit-used">
                          💸 Used {formatAsMXN(paymentDistribution.creditUsed)} from existing credit to help pay bills
                        </p>
                      )}
                      
                      {paymentDistribution.overpayment > 0 && (
                        <p className="credit-added">
                          💰 Added {formatAsMXN(paymentDistribution.overpayment)} to credit balance
                        </p>
                      )}
                    </div>
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