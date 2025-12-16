/**
 * Credit Balance Service
 * 
 * Extracted from Water Bills (Phase 3B - Priority 0B)
 * Provides credit balance management logic reusable across all billing modules
 * 
 * Handles:
 * - Credit usage calculation (when to use credits vs create overpayment)
 * - Credit balance updates
 * - Credit history tracking
 * - Overpayment processing
 * 
 * All financial amounts handled in PESOS (not centavos) for consistency with Credit API
 */

import { getNow } from './DateService.js';
import { CreditAPI } from '../../backend/api/creditAPI.js';
import { databaseFieldMappings } from '../utils/databaseFieldMappings.js';

const { dollarsToCents, centsToDollars } = databaseFieldMappings;

/**
 * Calculate credit usage and new overpayment
 * 
 * Determines:
 * - How much existing credit to apply
 * - Whether payment creates overpayment
 * - New credit balance after transaction
 * 
 * Logic:
 * 1. If payment >= bills → No credit needed, excess becomes overpayment
 * 2. If payment < bills → Use credit to make up difference
 * 
 * @param {object} params - Calculation parameters
 * @param {number} params.paymentAmount - Payment amount in PESOS
 * @param {number} params.currentCreditBalance - Current credit balance in PESOS
 * @param {number} params.totalBillsDue - Total bills due in PESOS
 * 
 * @returns {object} Credit calculation result (all amounts in PESOS)
 * @returns {number} result.creditUsed - Credit applied to bills
 * @returns {number} result.newOverpayment - New credit created from excess payment
 * @returns {number} result.finalCreditBalance - Final credit balance after transaction
 * @returns {string} result.changeType - Type of change ('credit_used' | 'overpayment' | 'no_change')
 */
export function calculateCreditUsage(params) {
  const { paymentAmount, currentCreditBalance, totalBillsDue } = params;
  
  console.log(`💰 Calculating credit usage: Payment $${paymentAmount}, Credit $${currentCreditBalance}, Bills $${totalBillsDue}`);
  
  let creditUsed = 0;
  let newOverpayment = 0;
  let changeType = 'no_change';
  
  if (paymentAmount >= totalBillsDue) {
    // Payment covers all bills - no credit needed
    creditUsed = 0;
    // Excess payment goes to credit balance
    const excessPayment = paymentAmount - totalBillsDue;
    newOverpayment = Math.round(excessPayment * 100) / 100; // Round to 2 decimals
    changeType = 'overpayment';
    
    console.log(`   ✅ Payment covers bills. Excess $${newOverpayment} becomes overpayment`);
  } else {
    // Payment doesn't cover bills - use credit to make up difference
    const shortfall = totalBillsDue - paymentAmount;
    const creditNeeded = Math.min(shortfall, currentCreditBalance);
    creditUsed = Math.round(creditNeeded * 100) / 100; // Round to 2 decimals
    newOverpayment = 0;
    changeType = creditUsed > 0 ? 'credit_used' : 'no_change';
    
    console.log(`   📊 Shortfall $${shortfall}. Using $${creditUsed} credit`);
  }
  
  const finalCreditBalance = Math.round((currentCreditBalance - creditUsed + newOverpayment) * 100) / 100;
  
  console.log(`   💰 Final credit balance: $${finalCreditBalance} (was $${currentCreditBalance})`);
  
  return {
    creditUsed,
    newOverpayment,
    finalCreditBalance,
    changeType
  };
}

/**
 * Get credit balance for a unit using Credit API
 * 
 * @param {string} clientId - Client ID
 * @param {string} unitId - Unit ID
 * @returns {object} Credit data
 * @returns {number} creditData.creditBalance - Current balance in PESOS
 * @returns {Array} creditData.creditBalanceHistory - History array
 */
export async function getCreditBalance(clientId, unitId) {
  try {
    const creditData = await CreditAPI.getCreditBalance(clientId, unitId);
    
    return {
      creditBalance: creditData.creditBalance || 0, // Already in pesos from CreditAPI
      creditBalanceHistory: creditData.creditBalanceHistory || creditData.history || []
    };
    
  } catch (error) {
    console.error(`Error getting credit balance for ${clientId}/${unitId}:`, error);
    // Return zero balance if credit endpoint unavailable (graceful degradation)
    return { creditBalance: 0, creditBalanceHistory: [] };
  }
}

/**
 * Update credit balance using Credit API
 * 
 * @param {string} clientId - Client ID
 * @param {string} unitId - Unit ID
 * @param {object} updateData - Update parameters
 * @param {number} updateData.newBalance - New balance in PESOS
 * @param {number} updateData.changeAmount - Amount changed (positive or negative) in PESOS
 * @param {string} updateData.changeType - Type of change ('overpayment' | 'credit_used')
 * @param {string} updateData.description - Human-readable description
 * @param {string} updateData.transactionId - Link to transaction
 * @param {string} updateData.moduleType - Module type ('water' | 'hoa' | 'propane') - REQUIRED
 * 
 * @returns {object} Update result
 * @returns {boolean} result.success - True if successful
 * @returns {number} result.newBalance - New balance in PESOS
 * @returns {number} result.changeAmount - Amount changed in PESOS
 */
export async function updateCreditBalance(clientId, unitId, updateData) {
  try {
    const { newBalance, changeAmount, changeType, description, transactionId, moduleType } = updateData;
    
    if (!moduleType) {
      throw new Error('moduleType is required for credit balance updates');
    }
    
    console.log(`💰 Updating credit balance: Unit ${unitId}, New balance: $${newBalance}, Module: ${moduleType}`);
    
    // Calculate amount change in cents for CreditAPI
    const amountChangeInCents = dollarsToCents(changeAmount);
    
    // Map module type to source name for Credit API
    const sourceMap = {
      'water': 'waterBills',
      'hoa': 'hoaDues',
      'propane': 'propaneTanks'
    };
    
    const source = sourceMap[moduleType] || moduleType;
    
    // Use the CreditAPI
    const result = await CreditAPI.updateCreditBalance(clientId, unitId, {
      amount: amountChangeInCents,
      transactionId: transactionId,
      note: description || `${moduleType} payment - ${changeType}`,
      source: source
    });
    
    console.log(`✅ Credit balance updated: $${newBalance}`);
    
    return {
      success: true,
      newBalance: newBalance,
      changeAmount: changeAmount
    };
    
  } catch (error) {
    console.error('Error updating credit balance:', error);
    throw new Error('Failed to update credit balance');
  }
}

/**
 * Generate credit balance change description
 * 
 * Creates human-readable description for credit balance history.
 * Used in transaction notes and credit history entries.
 * 
 * @param {Array} billPayments - Array of bill payment objects
 * @param {number} totalBaseCharges - Total base charges paid (in pesos)
 * @param {number} totalPenalties - Total penalties paid (in pesos)
 * @param {string} moduleType - Module type ('water' | 'hoa' | 'propane')
 * 
 * @returns {string} Description text
 */
export function generateCreditDescription(billPayments, totalBaseCharges, totalPenalties, moduleType = 'water') {
  if (!billPayments || billPayments.length === 0) {
    return `${moduleType} bill overpayment - no bills due`;
  }
  
  const billPeriods = billPayments.map(p => p.billPeriod).join(', ');
  const moduleName = moduleType.charAt(0).toUpperCase() + moduleType.slice(1); // Capitalize
  
  return `${moduleName} bills paid: ${billPeriods} (Base: $${totalBaseCharges.toFixed(2)}, Penalties: $${totalPenalties.toFixed(2)})`;
}

/**
 * Create credit balance history entry
 * 
 * Generates standardized history entry for credit balance tracking.
 * Note: This returns the entry object; actual saving is done by CreditAPI.
 * 
 * @param {object} params - History entry parameters
 * @param {string} params.type - 'addition' | 'usage' | 'adjustment'
 * @param {number} params.amount - Amount in PESOS (positive or negative)
 * @param {number} params.balanceAfter - Balance after this entry in PESOS
 * @param {string} params.transactionId - Link to transaction
 * @param {string} params.notes - Human-readable description
 * @param {string} params.moduleType - Module type ('water' | 'hoa')
 * 
 * @returns {object} History entry object
 */
export function createCreditHistoryEntry(params) {
  const { type, amount, balanceAfter, transactionId, notes, moduleType = 'water' } = params;
  
  return {
    date: getNow().toISOString(),
    type: type,
    amount: amount, // In pesos
    balanceAfter: balanceAfter, // In pesos
    transactionId: transactionId,
    notes: notes,
    module: moduleType,
    timestamp: Date.now()
  };
}

/**
 * Validate credit balance operations
 * 
 * Ensures credit operations are valid before processing:
 * - No negative balances (unless explicitly allowed)
 * - Valid amounts (no NaN, Infinity)
 * - Required fields present
 * 
 * @param {object} params - Validation parameters
 * @param {number} params.currentBalance - Current balance in PESOS
 * @param {number} params.changeAmount - Amount to change (positive or negative) in PESOS
 * @param {string} params.operationType - 'usage' | 'addition' | 'adjustment'
 * @param {boolean} params.allowNegative - Allow negative balance (default: false)
 * 
 * @returns {object} Validation result
 * @returns {boolean} result.isValid - True if valid
 * @returns {Array} result.errors - Array of error messages (if any)
 */
export function validateCreditOperation(params) {
  const { currentBalance, changeAmount, operationType, allowNegative = false } = params;
  const errors = [];
  
  // Validate amounts
  if (typeof currentBalance !== 'number' || isNaN(currentBalance) || !isFinite(currentBalance)) {
    errors.push('Invalid current balance');
  }
  
  if (typeof changeAmount !== 'number' || isNaN(changeAmount) || !isFinite(changeAmount)) {
    errors.push('Invalid change amount');
  }
  
  // Validate operation type
  const validTypes = ['usage', 'addition', 'adjustment'];
  if (!validTypes.includes(operationType)) {
    errors.push(`Invalid operation type: ${operationType}`);
  }
  
  // Validate resulting balance
  if (errors.length === 0) {
    const newBalance = currentBalance + changeAmount;
    
    if (newBalance < 0 && !allowNegative) {
      errors.push(`Operation would result in negative balance: $${newBalance.toFixed(2)}`);
    }
    
    // Usage operations should have negative changeAmount
    if (operationType === 'usage' && changeAmount > 0) {
      errors.push('Usage operations should have negative change amount');
    }
    
    // Addition operations should have positive changeAmount
    if (operationType === 'addition' && changeAmount < 0) {
      errors.push('Addition operations should have positive change amount');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Export helper functions for testing
 */
export const __testing = {
  // Export internal functions if needed for testing
};

