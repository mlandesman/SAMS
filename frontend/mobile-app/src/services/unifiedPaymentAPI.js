/**
 * Unified Payment API — Mobile port from desktop
 * API calls for unified payment system (HOA + Water + Penalties)
 * Sprint MOBILE-ADMIN-UX (ADM-4)
 */

import { config } from '../config/index.js';
import { auth } from './firebase.js';
import { pesosToCentavos, centavosToPesos } from '@shared/utils/currencyUtils.js';

/**
 * Convert preview response from centavos to pesos
 * Backend returns amounts in pesos; this normalizes the structure for mobile
 */
function convertPreviewFromCentavos(data) {
  const allBills = [];

  const hoaBills = (data.hoa?.monthsAffected || []).map((month) => ({
    billType: 'hoa',
    billPeriod: month.billPeriod,
    baseChargeDue: month.baseDue || 0,
    penaltyDue: month.penaltyDue || 0,
    totalDue: month.totalDue || 0,
    remainingDue: month.remainingDue ?? null,
    originalTotalDue: month.originalTotalDue ?? null,
    isPartial: month.isPartial || false,
    baseChargePayment: month.basePaid || 0,
    penaltyPayment: month.penaltyPaid || 0,
    totalPayment: month.totalPaid || 0,
    status: month.status || 'unpaid',
    priority: month.priority || 999,
    monthData: {
      month: month.month,
      monthIndex: month.monthIndex,
      isQuarterly: month.isQuarterly,
      quarterIndex: month.quarterIndex,
      monthsInQuarter: month.monthsInQuarter,
    },
  }));

  const waterBills = (data.water?.billsAffected || []).map((bill) => ({
    billType: 'water',
    billPeriod: bill.billPeriod,
    baseChargeDue: bill.baseDue || 0,
    penaltyDue: bill.penaltyDue || 0,
    totalDue: bill.totalDue || 0,
    remainingDue: bill.remainingDue ?? null,
    originalTotalDue: bill.originalTotalDue ?? null,
    isPartial: bill.isPartial || false,
    baseChargePayment: bill.basePaid || 0,
    penaltyPayment: bill.penaltyPaid || 0,
    totalPayment: bill.totalPaid || 0,
    status: bill.status || 'unpaid',
    priority: bill.priority || 999,
  }));

  const projectBills = (data.project?.billsAffected || []).map((bill) => ({
    billType: 'project',
    billPeriod: bill.billPeriod,
    baseChargeDue: bill.baseDue || 0,
    penaltyDue: 0,
    totalDue: bill.totalDue || 0,
    remainingDue: bill.remainingDue ?? null,
    originalTotalDue: bill.originalTotalDue ?? null,
    isPartial: bill.isPartial || false,
    baseChargePayment: bill.basePaid || 0,
    penaltyPayment: 0,
    totalPayment: bill.totalPaid || 0,
    status: bill.status || 'unpaid',
    priority: bill.priority || 999,
    monthData: { projectName: bill.projectName, milestone: bill.milestone },
  }));

  allBills.push(...hoaBills, ...waterBills, ...projectBills);
  allBills.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
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
    billPayments: allBills,
  };
}

const unifiedPaymentAPI = {
  async previewUnifiedPayment(clientId, unitId, paymentData) {
    const user = auth.currentUser;
    const token = await user?.getIdToken();
    if (!token) throw new Error('Not authenticated');

    const amountInCentavos =
      paymentData.amount === null || paymentData.amount === undefined
        ? null
        : pesosToCentavos(paymentData.amount);

    const requestBody = {
      clientId,
      unitId,
      amount: amountInCentavos,
      paymentDate: paymentData.paymentDate,
      preview: true,
      waivedPenalties: paymentData.waivedPenalties || [],
      excludedBills: paymentData.excludedBills || [],
    };

    const response = await fetch(`${config.api.baseUrl}/payments/unified/preview`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Preview failed: ${response.statusText}`);
    }

    const data = await response.json();
    const previewData = data.preview || data;
    return convertPreviewFromCentavos(previewData);
  },

  async recordUnifiedPayment(clientId, unitId, paymentData, preview) {
    const user = auth.currentUser;
    const token = await user?.getIdToken();
    if (!token) throw new Error('Not authenticated');

    const requestBody = {
      clientId,
      unitId,
      amount: pesosToCentavos(paymentData.amount),
      paymentDate: paymentData.paymentDate,
      paymentMethod: paymentData.paymentMethod,
      paymentMethodId: paymentData.paymentMethodId,
      accountId: paymentData.accountId,
      accountType: paymentData.accountType,
      reference: paymentData.reference || null,
      notes: paymentData.notes || null,
      waivedPenalties: paymentData.waivedPenalties || [],
      excludedBills: paymentData.excludedBills || [],
      documents: paymentData.documents || [],
      preview,
    };

    const response = await fetch(`${config.api.baseUrl}/payments/unified/record`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Payment recording failed: ${response.statusText}`);
    }

    return response.json();
  },
};

export default unifiedPaymentAPI;
