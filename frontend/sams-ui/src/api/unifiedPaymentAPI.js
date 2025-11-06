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
  const hoaBills = (data.hoa?.monthsAffected || []).map(month => ({
    billType: 'hoa',
    billPeriod: month.billPeriod,
    baseChargeDue: month.basePaid || 0,
    penaltyDue: month.penaltyPaid || 0,
    totalDue: month.totalPaid || 0,
    baseChargePayment: month.basePaid || 0,
    penaltyPayment: month.penaltyPaid || 0,
    totalPayment: month.totalPaid || 0,
    status: month.status || 'unpaid',
    priority: month.priority || 999,
    monthData: { month: month.month, monthIndex: month.monthIndex }  // Pass through for display
  }));
  
  const waterBills = (data.water?.billsAffected || []).map(bill => ({
    billType: 'water',
    billPeriod: bill.billPeriod,
    baseChargeDue: bill.basePaid || 0,
    penaltyDue: bill.penaltyPaid || 0,
    totalDue: bill.totalPaid || 0,
    baseChargePayment: bill.basePaid || 0,
    penaltyPayment: bill.penaltyPaid || 0,
    totalPayment: bill.totalPaid || 0,
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
      const requestBody = {
        clientId,
        unitId,
        amount: pesosToCentavos(paymentData.amount),
        paymentDate: paymentData.paymentDate,
        preview: true
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
      
      // Convert centavos back to pesos in response
      const converted = convertPreviewFromCentavos(previewData);
      console.log('💱 Unified Payment Preview Response (converted to pesos):', converted);
      
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

