/**
 * Unified Payment API
 * API calls for unified payment system (HOA + Water + Penalties)
 */

import { config } from '../config';
import { getAuthInstance } from '../firebaseClient';
import { pesosToCentavos, centavosToPesos } from '../utils/currencyUtils';

/**
 * Convert preview response from centavos to pesos
 * Note: Backend returns amounts in PESOS already (not centavos)
 */
function convertPreviewFromCentavos(data) {
  // Backend already returns amounts in pesos, so we just pass through
  // Merge HOA and Water bills preserving their priority order from backend
  const allBills = [];
  
  // Combine HOA and Water bills with their priorities
  // Backend now returns separate fields: baseDue/totalDue (due amounts) and basePaid/totalPaid (paid amounts)
  const hoaBills = (data.hoa?.monthsAffected || []).map(month => ({
    billType: 'hoa',
    billPeriod: month.billPeriod,
    baseChargeDue: month.baseDue || 0,  // Due amount (always present)
    penaltyDue: month.penaltyDue || 0,   // Due amount (always present)
    totalDue: month.totalDue || 0,       // Due amount (always present)
    remainingDue: month.remainingDue ?? null,
    originalTotalDue: month.originalTotalDue ?? null,
    isPartial: month.isPartial || false,
    baseChargePayment: month.basePaid || 0,  // Paid amount (0 when no payment)
    penaltyPayment: month.penaltyPaid || 0,  // Paid amount (0 when no payment)
    totalPayment: month.totalPaid || 0,      // Paid amount (0 when no payment)
    status: month.status || 'unpaid',
    priority: month.priority || 999,
    monthData: { 
      month: month.month, 
      monthIndex: month.monthIndex,
      isQuarterly: month.isQuarterly,
      quarterIndex: month.quarterIndex,
      monthsInQuarter: month.monthsInQuarter
    }  // Pass through for display
  }));
  
  const waterBills = (data.water?.billsAffected || []).map(bill => ({
    billType: 'water',
    billPeriod: bill.billPeriod,
    baseChargeDue: bill.baseDue || 0,    // Due amount (always present)
    penaltyDue: bill.penaltyDue || 0,     // Due amount (always present)
    totalDue: bill.totalDue || 0,         // Due amount (always present)
    remainingDue: bill.remainingDue ?? null,
    originalTotalDue: bill.originalTotalDue ?? null,
    isPartial: bill.isPartial || false,
    baseChargePayment: bill.basePaid || 0,  // Paid amount (0 when no payment)
    penaltyPayment: bill.penaltyPaid || 0,  // Paid amount (0 when no payment)
    totalPayment: bill.totalPaid || 0,      // Paid amount (0 when no payment)
    status: bill.status || 'unpaid',
    priority: bill.priority || 999
  }));
  
  // Merge and sort by priority, then by billPeriod
  // This preserves the backend's payment order
  allBills.push(...hoaBills, ...waterBills);
  allBills.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.billPeriod.localeCompare(b.billPeriod);
  });
  
  return {
    ...data,
    currentCreditBalance: data.currentCreditBalance || 0,
    totalDue: (data.hoa?.totalPaid || 0) + (data.water?.totalPaid || 0),
    totalAvailableFunds: data.totalAvailableFunds || 0,
    creditUsed: data.credit?.used || 0,
    newCreditBalance: data.credit?.final || 0,
    overpayment: data.credit?.added || 0,
    billPayments: allBills
  };
}

const unifiedPaymentAPI = {
  /**
   * Preview a unified payment to see allocation across bills
   * @param {string} clientId - Client ID
   * @param {string} unitId - Unit ID
   * @param {Object} paymentData - Payment preview data
   * @param {number} paymentData.amount - Payment amount in PESOS
   * @param {string} paymentData.paymentDate - Payment date (YYYY-MM-DD)
   * @param {Array} paymentData.waivedPenalties - Optional array of waived penalties
   * @param {Array} paymentData.excludedBills - Optional array of excluded bill periods
   * @returns {Promise<Object>} Preview data with bills and allocations
   */
  async previewUnifiedPayment(clientId, unitId, paymentData) {
    try {
      const auth = getAuthInstance();
      const token = await auth.currentUser?.getIdToken();
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      // Convert pesos to centavos for API
      // Handle null/undefined amount for "show all bills" preview
      const amountInCentavos = (paymentData.amount === null || paymentData.amount === undefined) 
        ? null 
        : pesosToCentavos(paymentData.amount);
      
      const requestBody = {
        clientId,
        unitId,
        amount: amountInCentavos,
        paymentDate: paymentData.paymentDate,
        preview: true,
        waivedPenalties: paymentData.waivedPenalties || [],
        excludedBills: paymentData.excludedBills || []
      };
      
      console.log('📤 Unified Payment Preview Request:', {
        url: `${config.api.baseUrl}/payments/unified/preview`,
        body: requestBody,
        amountPesos: paymentData.amount,
        amountCentavos: requestBody.amount
      });
      
      const response = await fetch(
        `${config.api.baseUrl}/payments/unified/preview`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Preview failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('📥 Unified Payment Preview Response (raw):', data);
      
      // Extract preview from response wrapper
      const previewData = data.preview || data;
      
      // Debug: Log HOA months before conversion
      console.log('🔍 HOA months before conversion:', previewData.hoa?.monthsAffected?.slice(0, 3));
      
      // Convert centavos back to pesos in response
      const converted = convertPreviewFromCentavos(previewData);
      console.log('💱 Unified Payment Preview Response (converted to pesos):', converted);
      
      // Debug: Log billPayments after conversion
      console.log('🔍 Bill payments after conversion:', converted.billPayments?.slice(0, 3));
      
      return converted;
    } catch (error) {
      console.error('❌ Unified payment preview error:', error);
      throw error;
    }
  },
  
  /**
   * Record a unified payment
   * @param {string} clientId - Client ID
   * @param {string} unitId - Unit ID
   * @param {Object} paymentData - Payment recording data
   * @param {number} paymentData.amount - Payment amount in PESOS
   * @param {string} paymentData.paymentDate - Payment date (YYYY-MM-DD)
   * @param {string} paymentData.paymentMethod - Payment method name
   * @param {string} paymentData.paymentMethodId - Payment method ID
   * @param {string} paymentData.accountId - Account ID to credit
   * @param {string} paymentData.accountType - Account type (bank/cash)
   * @param {string} [paymentData.reference] - Optional reference
   * @param {string} [paymentData.notes] - Optional notes
   * @param {Array} [paymentData.waivedPenalties] - Optional array of waived penalties
   * @param {Array} [paymentData.excludedBills] - Optional array of excluded bill periods
   * @param {string[]} [paymentData.documents] - Optional array of document IDs to link to transaction
   * @param {Object} preview - Preview object from previewUnifiedPayment
   * @returns {Promise<Object>} Payment result
   */
  async recordUnifiedPayment(clientId, unitId, paymentData, preview) {
    try {
      const auth = getAuthInstance();
      const token = await auth.currentUser?.getIdToken();
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      // Convert pesos to centavos for API
      const requestBody = {
        clientId,
        unitId,
        amount: pesosToCentavos(paymentData.amount),
        paymentDate: paymentData.paymentDate,
        paymentMethod: paymentData.paymentMethod,
        paymentMethodId: paymentData.paymentMethodId,
        accountId: paymentData.accountId,
        accountType: paymentData.accountType,
        reference: paymentData.reference || null,  // Use null instead of empty string
        notes: paymentData.notes || null,          // Use null instead of empty string
        waivedPenalties: paymentData.waivedPenalties || [],
        excludedBills: paymentData.excludedBills || [],
        documents: paymentData.documents || [], // Add documents array
        preview: preview  // Pass the actual preview object from the preview call
      };
      
      console.log('📤 Unified Payment Record Request:', {
        url: `${config.api.baseUrl}/payments/unified/record`,
        body: requestBody,
        amountPesos: paymentData.amount,
        amountCentavos: requestBody.amount
      });
      
      const response = await fetch(
        `${config.api.baseUrl}/payments/unified/record`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Payment recording failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ Unified Payment Record Response:', data);
      
      return data;
    } catch (error) {
      console.error('❌ Unified payment recording error:', error);
      throw error;
    }
  }
};

export default unifiedPaymentAPI;

