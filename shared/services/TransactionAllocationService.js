/**
 * Transaction Allocation Service
 * 
 * Extracted from Water Bills (Phase 3B - Priority 0B)
 * Provides transaction allocation generation reusable across all billing modules
 * 
 * Creates standardized allocation entries that link payments to specific bills and charges.
 * Supports split transactions with separate entries for:
 * - Base charges
 * - Penalties
 * - Credit usage
 * - Overpayments
 * 
 * Used by Transaction Controller to create proper audit trail for all payments.
 */

import { getNow } from './DateService.js';
import { databaseFieldMappings } from '../utils/databaseFieldMappings.js';

const { dollarsToCents, centsToDollars } = databaseFieldMappings;

/**
 * Generate unique allocation ID
 * Format: alloc_001, alloc_002, etc.
 * @param {number} index - Allocation index (1-based)
 * @returns {string} Unique allocation ID
 */
export function generateAllocationId(index = 1) {
  return `alloc_${String(index).padStart(3, '0')}`;
}

/**
 * Create module allocations from bill payments
 * 
 * Creates standardized allocation entries that link payments to specific bills and charges.
 * Module-agnostic: works for Water Bills, HOA Dues, Propane, etc.
 * 
 * @param {object} params - Allocation parameters
 * @param {Array} params.billPayments - Array of bill payment objects from calculatePaymentDistribution
 * @param {string} params.unitId - Unit identifier
 * @param {string} params.moduleType - Module type ('water', 'hoa', 'propane')
 * @param {object} params.paymentData - Payment data containing credit info
 * @param {number} params.paymentData.creditUsed - Credit used (in pesos)
 * @param {number} params.paymentData.overpayment - Overpayment amount (in pesos)
 * @param {number} params.paymentData.newCreditBalance - New credit balance (in pesos)
 * 
 * @returns {Array} Array of allocation objects
 */
export function createModuleAllocations(params) {
  const { billPayments, unitId, moduleType = 'water', paymentData = {} } = params;
  
  const allocations = [];
  let allocationIndex = 0;
  
  console.log(`🔍 Creating allocations for ${billPayments.length} bill payments (${moduleType} module):`, billPayments);
  
  // Module-specific configuration
  const moduleConfig = getModuleConfig(moduleType);
  
  // Add allocations for each bill payment (base charges and penalties)
  if (billPayments && billPayments.length > 0) {
    billPayments.forEach((billPayment) => {
      // Add base charge allocation
      if (billPayment.baseChargePaid > 0) {
        allocations.push({
          id: generateAllocationId(++allocationIndex),
          type: `${moduleType}_bill`,
          targetId: `bill_${billPayment.billId}`,
          targetName: `${billPayment.billPeriod} - Unit ${unitId}`,
          amount: billPayment.baseChargePaid, // Keep in pesos - transactionController will convert to cents
          percentage: null,
          categoryName: moduleConfig.baseChargeCategoryName,
          categoryId: moduleConfig.baseChargeCategoryId,
          data: {
            unitId: unitId,
            billId: billPayment.billId,
            billPeriod: billPayment.billPeriod,
            billType: "base_charge"
          },
          metadata: {
            processingStrategy: moduleConfig.processingStrategy,
            cleanupRequired: true,
            auditRequired: true,
            createdAt: getNow().toISOString()
          }
        });
      }
      
      // Add penalty allocation (only if penalties exist)
      if (billPayment.penaltyPaid > 0) {
        allocations.push({
          id: generateAllocationId(++allocationIndex),
          type: `${moduleType}_penalty`,
          targetId: `penalty_${billPayment.billId}`,
          targetName: `${billPayment.billPeriod} Penalties - Unit ${unitId}`,
          amount: billPayment.penaltyPaid, // Keep in pesos - transactionController will convert to cents
          percentage: null,
          categoryName: moduleConfig.penaltyCategoryName,
          categoryId: moduleConfig.penaltyCategoryId,
          data: {
            unitId: unitId,
            billId: billPayment.billId,
            billPeriod: billPayment.billPeriod,
            billType: "penalty"
          },
          metadata: {
            processingStrategy: moduleConfig.processingStrategy,
            cleanupRequired: true,
            auditRequired: true,
            createdAt: getNow().toISOString()
          }
        });
      }
    });
  }
  
  // Add Credit Balance allocation for overpayments (positive) or usage (negative)
  if (paymentData && paymentData.overpayment && paymentData.overpayment > 0) {
    // Overpayment: Credit balance is ADDED (positive allocation)
    allocations.push({
      id: generateAllocationId(++allocationIndex),
      type: `${moduleType}_credit`,
      targetId: `credit_${unitId}_${moduleType}`,
      targetName: `Account Credit - Unit ${unitId}`,
      amount: paymentData.overpayment, // Keep in pesos - transactionController will convert to cents
      percentage: null,
      categoryName: "Account Credit",
      categoryId: "account-credit",
      data: {
        unitId: unitId,
        creditType: `${moduleType}_overpayment`
      },
      metadata: {
        processingStrategy: "account_credit",
        cleanupRequired: true,
        auditRequired: true,
        createdAt: getNow().toISOString()
      }
    });
  } else if (paymentData && paymentData.creditUsed && paymentData.creditUsed > 0) {
    // Credit was used to help pay bills (negative allocation)
    allocations.push({
      id: generateAllocationId(++allocationIndex),
      type: `${moduleType}_credit`,
      targetId: `credit_${unitId}_${moduleType}`,
      targetName: `Account Credit - Unit ${unitId}`,
      amount: -paymentData.creditUsed, // Keep in pesos (negative for credit usage) - transactionController will convert to cents
      percentage: null,
      categoryName: "Account Credit",
      categoryId: "account-credit",
      data: {
        unitId: unitId,
        creditType: `${moduleType}_credit_used`
      },
      metadata: {
        processingStrategy: "account_credit",
        cleanupRequired: true,
        auditRequired: true,
        createdAt: getNow().toISOString()
      }
    });
  }
  
  return allocations;
}

/**
 * Get module-specific configuration for allocations
 * @param {string} moduleType - Module type ('water', 'hoa', 'propane')
 * @returns {object} Module configuration
 */
function getModuleConfig(moduleType) {
  const configs = {
    water: {
      baseChargeCategoryName: "Water Consumption",
      baseChargeCategoryId: "water-consumption",
      penaltyCategoryName: "Water Penalties",
      penaltyCategoryId: "water-penalties",
      processingStrategy: "water_bills"
    },
    hoa: {
      baseChargeCategoryName: "HOA Dues",
      baseChargeCategoryId: "hoa-dues",
      penaltyCategoryName: "HOA Penalties",
      penaltyCategoryId: "hoa-penalties",
      processingStrategy: "hoa_dues"
    },
    propane: {
      baseChargeCategoryName: "Propane Charges",
      baseChargeCategoryId: "propane-charges",
      penaltyCategoryName: "Propane Penalties",
      penaltyCategoryId: "propane-penalties",
      processingStrategy: "propane_bills"
    }
  };
  
  return configs[moduleType] || configs.water; // Default to water if unknown
}

/**
 * Create allocation summary for transaction
 * 
 * Generates a summary of allocations for transaction validation and display.
 * Used by Transaction Controller to verify allocation integrity.
 * 
 * @param {object} params - Summary parameters
 * @param {Array} params.billPayments - Array of bill payment objects
 * @param {number} params.totalAmountCents - Total transaction amount in cents
 * @param {string} params.moduleType - Module type ('water', 'hoa', 'propane')
 * 
 * @returns {object} Allocation summary
 * @returns {number} summary.totalAllocated - Total amount allocated in cents
 * @returns {number} summary.allocationCount - Number of allocations
 * @returns {string} summary.allocationType - Primary allocation type
 * @returns {boolean} summary.hasMultipleTypes - True if multiple types (bills + penalties)
 * @returns {object} summary.integrityCheck - Validation data
 */
export function createAllocationSummary(params) {
  const { billPayments, totalAmountCents, moduleType = 'water' } = params;
  
  if (!billPayments || billPayments.length === 0) {
    return {
      totalAllocated: 0,
      allocationCount: 0,
      allocationType: null,
      hasMultipleTypes: false
    };
  }
  
  // Calculate total allocated (bills + penalties) in cents for comparison
  const totalAllocated = billPayments.reduce((sum, payment) => {
    return sum + dollarsToCents(payment.baseChargePaid) + dollarsToCents(payment.penaltyPaid);
  }, 0);
  
  // Check if we have multiple types (bills + penalties)
  const hasPenalties = billPayments.some(p => p.penaltyPaid > 0);
  
  return {
    totalAllocated: totalAllocated,
    allocationCount: billPayments.length * (hasPenalties ? 2 : 1), // Count base + penalty as separate
    allocationType: `${moduleType}_bill`,
    hasMultipleTypes: hasPenalties, // True if both bills and penalties exist
    // Verify allocation integrity
    integrityCheck: {
      expectedTotal: totalAmountCents,
      actualTotal: totalAllocated,
      isValid: Math.abs(totalAmountCents - totalAllocated) < 100 // Allow 1 peso tolerance
    }
  };
}

/**
 * Validate allocations before transaction creation
 * 
 * Ensures allocations meet requirements:
 * - All required fields present
 * - Valid amounts (no NaN, Infinity)
 * - Total allocations match transaction amount (within tolerance)
 * 
 * @param {Array} allocations - Array of allocation objects
 * @param {number} transactionAmountCents - Transaction amount in cents
 * @returns {object} Validation result
 * @returns {boolean} result.isValid - True if valid
 * @returns {Array} result.errors - Array of error messages (if any)
 */
export function validateAllocations(allocations, transactionAmountCents) {
  const errors = [];
  
  if (!allocations || !Array.isArray(allocations)) {
    errors.push('Allocations must be an array');
    return { isValid: false, errors };
  }
  
  if (allocations.length === 0) {
    errors.push('At least one allocation required');
    return { isValid: false, errors };
  }
  
  // Validate each allocation
  allocations.forEach((alloc, idx) => {
    if (!alloc.id) errors.push(`Allocation ${idx}: Missing id`);
    if (!alloc.type) errors.push(`Allocation ${idx}: Missing type`);
    if (!alloc.targetId) errors.push(`Allocation ${idx}: Missing targetId`);
    if (typeof alloc.amount !== 'number') errors.push(`Allocation ${idx}: Invalid amount type`);
    if (isNaN(alloc.amount) || !isFinite(alloc.amount)) errors.push(`Allocation ${idx}: Invalid amount value`);
    if (!alloc.categoryName) errors.push(`Allocation ${idx}: Missing categoryName`);
  });
  
  // Validate total allocations (allow negative allocations for credit usage)
  const totalAllocated = allocations.reduce((sum, alloc) => sum + dollarsToCents(alloc.amount), 0);
  const tolerance = 100; // 1 peso tolerance
  
  if (Math.abs(totalAllocated - transactionAmountCents) > tolerance) {
    errors.push(`Total allocations (${totalAllocated} cents) do not match transaction amount (${transactionAmountCents} cents)`);
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
  getModuleConfig
};

