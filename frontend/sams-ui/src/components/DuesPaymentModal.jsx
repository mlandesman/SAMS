import React, { useState, useEffect } from 'react';
import { useHOADues } from '../context/HOADuesContext';
import { useClient } from '../context/ClientContext';
import { recordDuesPayment, updateCreditBalance } from '../api/hoaDuesService';
import { 
  calculatePayments, 
  formatAsMXN, 
  getMonthName, 
  generateMonthsDescription, 
  generateSequenceNumber 
} from '../utils/hoaDuesUtils';
import './DuesPaymentModal.css';

function DuesPaymentModal({ isOpen, onClose, unitId, monthIndex }) {
  const { 
    units, 
    duesData, 
    refreshData,
    selectedYear
  } = useHOADues();
  
  const { selectedClient } = useClient();
  
  const [selectedUnitId, setSelectedUnitId] = useState(unitId || '');
  const [unit, setUnit] = useState(null);
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [checkNumber, setCheckNumber] = useState('');
  const [calculationResult, setCalculationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Convert string amount to number
  const amountNumber = parseFloat(amount) || 0;
  
  // Update selectedUnitId when unitId prop changes
  useEffect(() => {
    setSelectedUnitId(unitId || '');
  }, [unitId]);
  
  // Update unit when selectedUnitId changes
  useEffect(() => {
    if (units && selectedUnitId) {
      const foundUnit = units.find(u => u.id === selectedUnitId);
      setUnit(foundUnit);
    } else {
      setUnit(null);
    }
  }, [units, selectedUnitId]);
  
  // Handle unit dropdown change
  const handleUnitChange = (e) => {
    setSelectedUnitId(e.target.value);
    // Reset calculation result when changing unit
    setCalculationResult(null);
  };
  
  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      setPaymentMethod('bank_transfer');
      setCheckNumber('');
      setCalculationResult(null);
      setError(null);
    }
  }, [isOpen]);
  
  // Calculate the first unpaid month
  const getFirstUnpaidMonth = () => {
    if (!selectedUnitId || !duesData[selectedUnitId]?.payments) {
      return monthIndex || 1;
    }
    
    if (monthIndex) {
      return monthIndex; // Use specified month if provided
    }

    const payments = duesData[selectedUnitId].payments || [];
    const monthlyAmount = duesData[selectedUnitId]?.scheduledAmount || unit?.duesAmount || 0;
    
    // Sort payments by month to ensure we check them in order
    const sortedPayments = [...payments].sort((a, b) => a.month - b.month);
    
    // Find the first month that's not fully paid
    for (let i = 0; i < sortedPayments.length; i++) {
      const payment = sortedPayments[i];
      // Check if payment is missing or less than the full monthly amount
      if (!payment.paid || Number(payment.paid) < monthlyAmount) {
        console.log(`Found first unpaid month: ${payment.month}`);
        return payment.month;
      }
    }
    
    // If we've reached here, all current months are paid, 
    // so we need to determine the next month to pay
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // Convert from 0-based to 1-based
    const currentYear = currentDate.getFullYear();
    
    if (currentYear > selectedYear) {
      return 1; // If we're viewing a past year, default to January
    } else if (currentYear === selectedYear) {
      return currentMonth; // If we're viewing current year, default to current month
    } else {
      return 1; // If we're viewing a future year, default to January
    }
  };
  
  // Generate credit usage or overpayment message
  const getCreditMessage = () => {
    if (!calculationResult) return '';
    
    const { amtOverpayment, remainingCredit } = calculationResult;
    
    if (amtOverpayment < 0) {
      return `Used ${formatAsMXN(Math.abs(amtOverpayment))} from credit balance`;
    } else if (amtOverpayment > 0) {
      return `Added ${formatAsMXN(amtOverpayment)} to credit balance`;
    } else {
      return 'No credit was used or added';
    }
  };

  // Debugging function to test our month calculation
  const testMonthCalculation = () => {
    if (!selectedUnitId || !duesData[selectedUnitId]) return;
    
    const payments = duesData[selectedUnitId].payments || [];
    const monthlyAmount = duesData[selectedUnitId]?.scheduledAmount || unit?.duesAmount || 0;
    
    console.log('---- DEBUG: Payment Status by Month ----');
    for (let i = 1; i <= 12; i++) {
      const payment = payments.find(p => p.month === i);
      const status = !payment ? 'No payment record' : 
                    !payment.paid ? 'Unpaid' :
                    Number(payment.paid) < monthlyAmount ? 'Partial payment' : 'Fully paid';
      
      console.log(`Month ${i}: ${status} - ${payment ? `Amount: ${payment.paid}` : 'No data'}`);
    }
    
    const firstUnpaidMonth = getFirstUnpaidMonth();
    console.log(`First unpaid month calculated as: ${firstUnpaidMonth}`);
  };

  // Calculate payment distribution
  const calculateDistribution = () => {
    if (!unit || !amountNumber) {
      setCalculationResult(null);
      return;
    }
    
    // Handle case where duesData might not exist for this unit yet
    const unitDuesData = duesData[selectedUnitId] || {
      creditBalance: 0,
      scheduledAmount: unit.duesAmount || 0,
      payments: Array(12).fill().map((_, i) => ({
        month: i + 1,
        paid: 0,
        date: null
      }))
    };
    
    const currentCredit = unitDuesData.creditBalance || 0;
    const monthlyAmount = unitDuesData.scheduledAmount || unit.duesAmount || 0;
    const firstUnpaidMonth = getFirstUnpaidMonth();
    
    // Debug log to verify calculation
    console.log('---- Payment Distribution Calculation ----');
    console.log(`Unit: ${selectedUnitId}, Monthly Amount: ${monthlyAmount}, Payment: ${amountNumber}`);
    console.log(`Credit Balance: ${currentCredit}, First Unpaid Month: ${firstUnpaidMonth}`);
    
    // Run the test calculation
    testMonthCalculation();
    
    // Use the HOA dues calculation logic
    const result = calculatePayments(amountNumber, monthlyAmount, currentCredit);
    
    console.log('Calculation result:', result);
    
    // Figure out which months will actually be paid
    // This simulates the payment distribution logic
    const monthsThatWillBePaid = [];
    let currentMonthIndex = firstUnpaidMonth;
    let paymentsRemaining = result.monthlyPayments.length;
    
    // Find months that need payment (not fully paid)
    while (paymentsRemaining > 0) {
      // Calculate actual month (1-12) considering wrapping to next year
      const actualMonth = ((currentMonthIndex - 1) % 12) + 1;
      
      // Find existing payment for this month
      const existingPayment = duesData[selectedUnitId]?.payments?.find(p => p.month === actualMonth);
      const existingPaidAmount = Number(existingPayment?.paid || 0);
      
      // If this month isn't fully paid, add it to our list
      if (existingPaidAmount < monthlyAmount) {
        monthsThatWillBePaid.push(actualMonth);
        paymentsRemaining--;
      }
      
      // Move to next month
      currentMonthIndex++;
    }
    
    // Sort the months in ascending order
    monthsThatWillBePaid.sort((a, b) => a - b);
    
    console.log("Months that will be paid:", monthsThatWillBePaid);
    
    // Calculate the description based on the actual months that will be paid
    const fiscalYearStartMonth = selectedClient?.configuration?.fiscalYearStartMonth || 1;
    const monthsDescription = monthsThatWillBePaid.length > 0 
      ? generateMonthsDescription(monthsThatWillBePaid[0], monthsThatWillBePaid.length, selectedYear, fiscalYearStartMonth)
      : '';
    
    // Add additional info for display
    setCalculationResult({
      ...result,
      startMonth: firstUnpaidMonth,
      monthlyAmount,
      totalPaid: result.monthlyPayments.reduce((sum, val) => sum + val, 0),
      monthsDescription: monthsDescription,
      actualMonthsToPayIndexes: monthsThatWillBePaid
    });
    
    console.log('Final calculation result with months:', {
      startMonth: firstUnpaidMonth,
      monthCount: result.monthlyPayments.length,
      description: generateMonthsDescription(
        firstUnpaidMonth,
        result.monthlyPayments.length,
        selectedYear,
        fiscalYearStartMonth
      )
    });
  };

  // Run calculation when amount changes
  useEffect(() => {
    calculateDistribution();
  }, [amountNumber, unit, duesData, selectedUnitId, monthIndex, selectedYear]);
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedUnitId) {
      setError('Please select a unit');
      return;
    }
    
    if (!amountNumber || amountNumber <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }
    
    if (paymentMethod === 'check' && !checkNumber) {
      setError('Please enter a check number');
      return;
    }
    
    if (!calculationResult) {
      setError('Failed to calculate payment distribution');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Create payment record with details
      const paymentDetails = {
        date: new Date(paymentDate),
        method: paymentMethod,
        checkNumber: paymentMethod === 'check' ? checkNumber : null,
        notes: notes,
        transactionId: generateSequenceNumber()
      };
      
      // Handle case where no full months can be paid (add directly to credit)
      if (calculationResult.monthlyPayments.length === 0) {
        // Just add the payment amount to the credit balance
        const currentCredit = duesData[selectedUnitId]?.creditBalance || 0;
        await updateCreditBalance(selectedClient.id, selectedUnitId, selectedYear, currentCredit + amountNumber);
        
        // Refresh data and close the modal
        await refreshData();
        onClose();
        return;
      }
      
      // Find months that need payment, starting from the first unpaid month
      console.log("Finding months that need payment...");
      const monthlyAmount = calculationResult.monthlyAmount;
      const monthsNeeded = calculationResult.monthlyPayments.length;
      let monthsToUpdate = [];
      let currentMonthIndex = calculationResult.startMonth;
      let paymentsRemaining = monthsNeeded;
      
      console.log(`Starting with month ${currentMonthIndex}, need to allocate ${paymentsRemaining} payments`);
      
      while (paymentsRemaining > 0) {
        // Calculate actual month (1-12) considering wrapping to next year
        const actualMonth = ((currentMonthIndex - 1) % 12) + 1;
        
        // Find existing payment for this month or create placeholder
        const existingPayment = duesData[selectedUnitId]?.payments?.find(p => p.month === actualMonth) || {
          month: actualMonth,
          paid: 0
        };
        
        const existingPaidAmount = Number(existingPayment.paid || 0);
        
        console.log(`Checking month ${actualMonth}: Existing paid=${existingPaidAmount}, Monthly amount=${monthlyAmount}`);
        
        // If this month isn't fully paid, add it to our update list
        if (existingPaidAmount < monthlyAmount) {
          console.log(`Month ${actualMonth} needs payment (${existingPaidAmount} < ${monthlyAmount})`);
          monthsToUpdate.push({
            month: actualMonth,
            existingAmount: existingPaidAmount,
            newAmount: monthlyAmount  // Always pay the full monthly amount
          });
          
          paymentsRemaining--;
        } else {
          console.log(`Month ${actualMonth} already fully paid, skipping`);
        }
        
        // Move to next month
        currentMonthIndex++;
      }
      
      // Create a common payment note
      let paymentNote = `${calculationResult.monthsDescription}`;
      
      // Add credit usage information if applicable
      if (calculationResult.amtOverpayment < 0) {
        paymentNote += ` using ${formatAsMXN(Math.abs(calculationResult.amtOverpayment))} from credit balance`;
      } else if (calculationResult.amtOverpayment > 0) {
        paymentNote += ` + ${formatAsMXN(calculationResult.amtOverpayment)} credit`;
      }
      
      // Add user notes if provided
      if (notes) {
        paymentNote += ` - ${notes}`;
      }
      
      console.log(`Will update ${monthsToUpdate.length} months:`, monthsToUpdate);
      
      // Update each month in our update list
      for (const monthData of monthsToUpdate) {
        const paymentDataForAPI = {
          amount: monthData.newAmount,
          date: new Date(paymentDate),
          notes: paymentNote,
          paymentDetails: paymentDetails,
          monthIndex: monthData.month
        };
        
        await recordDuesPayment(
          selectedClient.id,
          selectedUnitId,
          selectedYear,
          paymentDataForAPI,
          calculationResult.monthlyPayments
        );
        
        console.log(`Updated month ${monthData.month} payment to ${monthData.newAmount}`);
      }
      
      // Update credit balance if there's a remaining credit
      if (calculationResult.remainingCredit > 0) {
        await updateCreditBalance(selectedClient.id, selectedUnitId, selectedYear, calculationResult.remainingCredit);
      }
      
      // Refresh data
      await refreshData();
      
      // Close the modal
      onClose();
    } catch (error) {
      console.error('Error saving payment:', error);
      setError('Failed to save payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Sort units by unit ID (safe property access)
  const sortedUnits = units ? [...units].sort((a, b) => {
    const aId = a.id || a.unitId || '';
    const bId = b.id || b.unitId || '';
    return aId.localeCompare(bId);
  }) : [];

  // Get last name from owner name
  const getLastName = (ownerName) => {
    if (!ownerName) return '';
    const nameParts = ownerName.trim().split(' ');
    return nameParts[nameParts.length - 1];
  };

  // Format unit option text like "PH4D (Landesman)"
  const formatUnitOption = (unit) => {
    // Use same pattern as unitUtils - try owners array first, fall back to owner
    const ownerName = (Array.isArray(unit.owners) && unit.owners.length > 0) 
      ? unit.owners[0] 
      : unit.owner || '';
    const lastName = getLastName(ownerName);
    const unitId = unit.unitId || unit.id;
    return `${unitId} (${lastName})`;
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="modal-backdrop">
      <div className="dues-payment-modal">
        <div className="modal-header">
          <h2>Add Payment</h2>
          <button type="button" className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            {/* Unit selector dropdown */}
            <div className="form-group">
              <label htmlFor="unit-selector">Unit:</label>
              <select 
                id="unit-selector" 
                value={selectedUnitId} 
                onChange={handleUnitChange}
                className="unit-selector-dropdown"
              >
                <option value="">-- Select a Unit --</option>
                {sortedUnits.map(unit => {
                  const unitId = unit.unitId || unit.id;
                  return (
                    <option key={unitId} value={unitId}>
                      {formatUnitOption(unit)}
                    </option>
                  );
                })}
              </select>
            </div>
            
            {unit && (
              <>
                <div className="form-group">
                  <label>Monthly Dues:</label>
                  <div className="form-value">{formatAsMXN(unit.duesAmount)}</div>
                </div>
                
                {duesData[selectedUnitId]?.creditBalance > 0 && (
                  <div className="form-group">
                    <label>Credit Balance:</label>
                    <div className="form-value credit-balance">{formatAsMXN(duesData[selectedUnitId]?.creditBalance || 0)}</div>
                  </div>
                )}
                
                <div className="form-group">
                  <label htmlFor="paymentAmount">Payment Amount:</label>
                  <div className="input-group">
                    <span className="currency-symbol">$</span>
                    <input
                      id="paymentAmount"
                      type="number"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      step="0.01"
                      min="0"
                      required
                      autoFocus
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        console.clear();
                        testMonthCalculation();
                        console.log("Recalculating distribution...");
                        calculateDistribution();
                      }}
                      className="test-button"
                      title="Test calculation (check console)"
                    >
                      Test
                    </button>
                  </div>
                </div>
                
                <div className="form-group">
                  <label htmlFor="paymentDate">Payment Date:</label>
                  <input
                    id="paymentDate"
                    type="date"
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="paymentMethod">Payment Method:</label>
                  <select
                    id="paymentMethod"
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                    required
                  >
                    <option value="check">Check</option>
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                
                {paymentMethod === 'check' && (
                  <div className="form-group">
                    <label htmlFor="checkNumber">Check Number:</label>
                    <input
                      id="checkNumber"
                      type="text"
                      value={checkNumber}
                      onChange={e => setCheckNumber(e.target.value)}
                      required
                    />
                  </div>
                )}
                
                <div className="form-group">
                  <label htmlFor="notes">Notes:</label>
                  <textarea
                    id="notes"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
                
                <div className="payment-distribution">
                  <h3>Payment Distribution</h3>
                  
                  {calculationResult ? (
                    <>
                      <div className="distribution-summary">
                        <p><strong>Monthly Due Amount:</strong> {formatAsMXN(calculationResult.monthlyAmount)}</p>
                        <p><strong>Payment Amount:</strong> {formatAsMXN(amountNumber)}</p>
                        <p><strong>Current Credit Balance:</strong> {formatAsMXN(duesData[selectedUnitId]?.creditBalance || 0)}</p>
                        {calculationResult.monthlyPayments.length > 0 ? (
                          <p><strong>Months Covered:</strong> {calculationResult.monthsDescription || 'None'}</p>
                        ) : (
                          <p><strong>Months Covered:</strong> <span style={{color: '#d9534f'}}>No full months can be paid with this amount</span></p>
                        )}
                        <p><strong>Total Months:</strong> {calculationResult.monthlyPayments.length}</p>
                      </div>
                      
                      {calculationResult.monthlyPayments.length > 0 && (
                        <div className="distribution-table">
                          <table>
                            <thead>
                              <tr>
                                <th>Month</th>
                                <th>Amount Applied</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(calculationResult.actualMonthsToPayIndexes || []).map((monthIndex, i) => {
                                return (
                                  <tr key={`month-${monthIndex}`}>
                                    <td>{getMonthName(monthIndex)} {selectedYear}</td>
                                    <td>{formatAsMXN(calculationResult.monthlyPayments[i])}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr>
                                <td><strong>Total Applied</strong></td>
                                <td><strong>{formatAsMXN(calculationResult.totalPaid)}</strong></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                      
                      <div className="leftover-amount">
                        <p><strong>Credit Activity:</strong> {getCreditMessage()}</p>
                        <p><strong>Credit Balance After Payment:</strong> {formatAsMXN(calculationResult.remainingCredit)}</p>
                        {calculationResult.remainingCredit > 0 && (
                          <p className="credit-explanation">
                            This credit will be automatically applied to future payments.
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <p>Enter an amount to see the distribution</p>
                  )}
                </div>
              </>
            )}
            
            {error && <div className="error-message">{error}</div>}
            
            <div className="modal-footer">
              <button
                type="button"
                className="cancel-button"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="submit-button"
                disabled={loading || !selectedUnitId}
              >
                {loading ? 'Saving...' : 'Save Payment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default DuesPaymentModal;
