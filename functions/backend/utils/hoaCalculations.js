/**
 * HOA Dues Calculations Utility
 * Centralized calculations for HOA dues payment processing
 */

import databaseFieldMappings from './databaseFieldMappings.js';
import { getFiscalYear, getCurrentFiscalMonth } from './fiscalYearUtils.js';
import { getNow } from '../services/DateService.js';

const { centsToDollars, dollarsToCents } = databaseFieldMappings;

/**
 * Calculate the current dues status for a unit
 * @param {Object} hoaDuesDoc - The HOA dues document from database
 * @param {Object} clientConfig - Client configuration containing fiscalYearStartMonth
 * @returns {Object} Status information including balance, paid months, etc.
 */
function calculateDuesStatus(hoaDuesDoc, clientConfig = null) {
  if (!hoaDuesDoc || !hoaDuesDoc.payments) {
    return {
      paidMonths: 0,
      totalPaid: 0,
      balance: 0,
      creditBalance: 0,
      status: 'no_data'
    };
  }

  const currentDate = getNow();
  const fiscalYearStartMonth = clientConfig?.configuration?.fiscalYearStartMonth || 1;
  
  // Get current fiscal year and month
  const currentFiscalYear = getFiscalYear(currentDate, fiscalYearStartMonth);
  const currentFiscalMonth = getCurrentFiscalMonth(clientConfig, currentDate);
  
  // Count paid months up to current fiscal month
  let paidMonths = 0;
  for (let fiscalMonth = 1; fiscalMonth <= currentFiscalMonth; fiscalMonth++) {
    let calendarMonthIndex;
    if (fiscalYearStartMonth === 1) {
      calendarMonthIndex = fiscalMonth - 1;
    } else {
      calendarMonthIndex = (fiscalYearStartMonth - 1 + fiscalMonth - 1) % 12;
    }
    
    if (calendarMonthIndex < hoaDuesDoc.payments.length) {
      const payment = hoaDuesDoc.payments[calendarMonthIndex];
      if (payment && payment.paid) {
        paidMonths++;
      }
    }
  }
  
  // Calculate amounts based on fiscal months elapsed
  const monthlyDue = hoaDuesDoc.scheduledAmount || 250; // Use scheduledAmount from doc or default
  const dueToDate = dollarsToCents(monthlyDue * currentFiscalMonth);
  const balance = dueToDate - (hoaDuesDoc.totalPaid || 0);
  
  // Add logging for debugging
  console.log(`[HOA Calc] Client: ${clientConfig?.id}, FY Start: ${fiscalYearStartMonth}, Current FY Month: ${currentFiscalMonth}`);
  
  return {
    paidMonths,
    totalPaid: centsToDollars(hoaDuesDoc.totalPaid || 0),
    balance: centsToDollars(balance),
    creditBalance: centsToDollars(hoaDuesDoc.creditBalance || 0),
    status: balance <= 0 ? 'current' : 'behind',
    monthsDue: currentFiscalMonth, // Fiscal months elapsed
    monthlyAmount: monthlyDue,
    fiscalMonth: currentFiscalMonth,
    fiscalYear: currentFiscalYear
  };
}

/**
 * Calculate how to distribute a payment across months
 * @param {Object} hoaDuesDoc - Current HOA dues document
 * @param {number} paymentAmount - Payment amount in dollars
 * @param {Array} distribution - Optional specific distribution from frontend
 * @returns {Object} Distribution plan with months to update and any credit
 */
function calculatePaymentDistribution(hoaDuesDoc, paymentAmount, distribution = null) {
  const monthlyDue = 250; // Should come from config
  const paymentInCents = dollarsToCents(paymentAmount);
  
  // If specific distribution provided, validate and use it
  if (distribution && Array.isArray(distribution) && distribution.length > 0) {
    return {
      monthsToUpdate: distribution,
      totalApplied: paymentInCents,
      creditToAdd: 0
    };
  }
  
  // Otherwise, auto-distribute starting from first unpaid month
  const monthsToUpdate = [];
  let remainingAmount = paymentInCents;
  
  // Find unpaid months
  for (let i = 0; i < 12; i++) {
    if (!hoaDuesDoc.payments[i].paid && remainingAmount > 0) {
      const monthDue = dollarsToCents(monthlyDue);
      const amountToApply = Math.min(remainingAmount, monthDue);
      
      monthsToUpdate.push({
        month: i + 1, // 1-based month for API
        amount: centsToDollars(amountToApply),
        paid: amountToApply >= monthDue
      });
      
      remainingAmount -= amountToApply;
    }
  }
  
  return {
    monthsToUpdate,
    totalApplied: paymentInCents - remainingAmount,
    creditToAdd: remainingAmount // Any leftover becomes credit
  };
}

/**
 * Validate a payment before processing
 * @param {Object} paymentData - Payment data to validate
 * @returns {Object} Validation result with isValid and errors
 */
function validatePayment(paymentData) {
  const errors = [];
  
  if (!paymentData) {
    return { isValid: false, errors: ['No payment data provided'] };
  }
  
  if (!paymentData.amount || paymentData.amount <= 0) {
    errors.push('Invalid payment amount');
  }
  
  if (!paymentData.date) {
    errors.push('Payment date is required');
  } else {
    const date = new Date(paymentData.date);
    if (isNaN(date.getTime())) {
      errors.push('Invalid payment date');
    }
  }
  
  if (!paymentData.method) {
    errors.push('Payment method is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Calculate credit balance changes
 * @param {number} currentCredit - Current credit balance in cents
 * @param {number} changeAmount - Amount to add/subtract in cents
 * @param {string} reason - Reason for the change
 * @returns {Object} Updated credit info
 */
function calculateCreditChange(currentCredit, changeAmount, reason) {
  const newBalance = currentCredit + changeAmount;
  
  if (newBalance < 0) {
    throw new Error('Insufficient credit balance');
  }
  
  return {
    newBalance,
    historyEntry: {
      amount: changeAmount,
      date: getNow(),
      reason,
      balance: newBalance
    }
  };
}

/**
 * Get payment summary for a specific year
 * @param {Object} hoaDuesDoc - HOA dues document
 * @returns {Object} Summary with totals and payment details
 */
function getYearSummary(hoaDuesDoc) {
  if (!hoaDuesDoc || !hoaDuesDoc.payments) {
    return {
      year: hoaDuesDoc?.year || getNow().getFullYear(),
      totalDue: 0,
      totalPaid: 0,
      balance: 0,
      creditBalance: 0,
      paidMonths: [],
      unpaidMonths: []
    };
  }
  
  const paidMonths = [];
  const unpaidMonths = [];
  
  hoaDuesDoc.payments.forEach((payment, index) => {
    const monthNum = index + 1;
    if (payment && payment.paid) {
      paidMonths.push({
        month: monthNum,
        amount: centsToDollars(payment.amount || 0),
        date: payment.date,
        reference: payment.reference
      });
    } else {
      unpaidMonths.push(monthNum);
    }
  });
  
  return {
    year: hoaDuesDoc.year,
    totalDue: centsToDollars(hoaDuesDoc.totalDue || 0),
    totalPaid: centsToDollars(hoaDuesDoc.totalPaid || 0),
    balance: centsToDollars((hoaDuesDoc.totalDue || 0) - (hoaDuesDoc.totalPaid || 0)),
    creditBalance: centsToDollars(hoaDuesDoc.creditBalance || 0),
    paidMonths,
    unpaidMonths
  };
}

/**
 * Calculate year-to-date totals for HOA dues
 * @param {Object} hoaDuesDoc - The HOA dues document
 * @param {Object} clientConfig - Client configuration containing fiscalYearStartMonth
 * @returns {Object} YTD totals including paid amount and months paid
 */
function calculateYearToDateTotals(hoaDuesDoc, clientConfig = null) {
  const currentDate = getNow();
  const fiscalYearStartMonth = clientConfig?.configuration?.fiscalYearStartMonth || 1;
  const currentFiscalMonth = getCurrentFiscalMonth(clientConfig, currentDate);
  
  if (!hoaDuesDoc || !hoaDuesDoc.payments) {
    return {
      ytdPaid: 0,
      ytdMonthsPaid: 0,
      ytdMonthsTotal: currentFiscalMonth
    };
  }
  
  // Count paid months and total paid up to current fiscal month
  let ytdPaid = 0;
  let ytdMonthsPaid = 0;
  
  // For fiscal year calculations, we need to iterate through fiscal months
  for (let fiscalMonth = 1; fiscalMonth <= currentFiscalMonth; fiscalMonth++) {
    // Convert fiscal month to calendar month index (0-based)
    let calendarMonthIndex;
    
    if (fiscalYearStartMonth === 1) {
      // Calendar year: fiscal month = calendar month
      calendarMonthIndex = fiscalMonth - 1;
    } else {
      // Fiscal year: need to map fiscal month to calendar month
      // Fiscal month 1 = fiscalYearStartMonth (e.g., July = 7)
      // Calendar index for July = 6 (0-based)
      calendarMonthIndex = (fiscalYearStartMonth - 1 + fiscalMonth - 1) % 12;
    }
    
    if (calendarMonthIndex < hoaDuesDoc.payments.length) {
      const payment = hoaDuesDoc.payments[calendarMonthIndex];
      if (payment && payment.paid) {
        ytdMonthsPaid++;
        ytdPaid += payment.amount || 0;
      }
    }
  }
  
  console.log(`[HOA Calc] YTD Totals - FY Start: ${fiscalYearStartMonth}, Current FY Month: ${currentFiscalMonth}, YTD Paid: ${centsToDollars(ytdPaid)}`);
  
  return {
    ytdPaid: centsToDollars(ytdPaid),
    ytdMonthsPaid,
    ytdMonthsTotal: currentFiscalMonth
  };
}

/**
 * Calculate remaining dues for the fiscal year
 * @param {Object} hoaDuesDoc - The HOA dues document
 * @param {Object} clientConfig - Client configuration containing fiscalYearStartMonth
 * @returns {Object} Remaining dues information
 */
function calculateRemainingDues(hoaDuesDoc, clientConfig = null) {
  const currentDate = getNow();
  const fiscalYearStartMonth = clientConfig?.configuration?.fiscalYearStartMonth || 1;
  const currentFiscalMonth = getCurrentFiscalMonth(clientConfig, currentDate);
  
  const monthlyDue = hoaDuesDoc?.scheduledAmount || 250;
  const remainingMonths = 12 - currentFiscalMonth;
  const remainingDue = dollarsToCents(monthlyDue * remainingMonths);
  
  console.log(`[HOA Calc] Remaining Dues - FY Start: ${fiscalYearStartMonth}, Remaining Months: ${remainingMonths}, Amount: ${centsToDollars(remainingDue)}`);
  
  return {
    remainingMonths,
    remainingAmount: centsToDollars(remainingDue),
    monthlyAmount: monthlyDue
  };
}

/**
 * Get the next month due based on fiscal year
 * @param {Object} hoaDuesDoc - The HOA dues document
 * @param {Object} clientConfig - Client configuration containing fiscalYearStartMonth
 * @returns {Object} Next month due information
 */
function getNextMonthDue(hoaDuesDoc, clientConfig = null) {
  const currentDate = getNow();
  const fiscalYearStartMonth = clientConfig?.configuration?.fiscalYearStartMonth || 1;
  const currentFiscalMonth = getCurrentFiscalMonth(clientConfig, currentDate);
  
  if (!hoaDuesDoc || !hoaDuesDoc.payments) {
    return {
      nextMonth: currentFiscalMonth,
      nextMonthName: getFiscalMonthName(currentFiscalMonth, fiscalYearStartMonth),
      isDue: true
    };
  }
  
  // Find the first unpaid month by checking fiscal months in order
  for (let fiscalMonth = 1; fiscalMonth <= 12; fiscalMonth++) {
    // Convert fiscal month to calendar month index
    let calendarMonthIndex;
    if (fiscalYearStartMonth === 1) {
      calendarMonthIndex = fiscalMonth - 1;
    } else {
      calendarMonthIndex = (fiscalYearStartMonth - 1 + fiscalMonth - 1) % 12;
    }
    
    if (calendarMonthIndex < hoaDuesDoc.payments.length) {
      const payment = hoaDuesDoc.payments[calendarMonthIndex];
      if (!payment || !payment.paid) {
        return {
          nextMonth: fiscalMonth,
          nextMonthName: getFiscalMonthName(fiscalMonth, fiscalYearStartMonth),
          isDue: fiscalMonth <= currentFiscalMonth
        };
      }
    }
  }
  
  // All months paid
  return {
    nextMonth: null,
    nextMonthName: null,
    isDue: false
  };
}

/**
 * Get month name in fiscal year order (helper function)
 * @param {number} fiscalMonth - Fiscal month number (1-12)
 * @param {number} fiscalYearStartMonth - First month of fiscal year (1-12)
 * @returns {string} Month name
 */
function getFiscalMonthName(fiscalMonth, fiscalYearStartMonth) {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
  
  if (fiscalYearStartMonth === 1) {
    return monthNames[fiscalMonth - 1];
  }
  
  // Convert fiscal month to calendar month
  let calendarMonth = fiscalMonth + fiscalYearStartMonth - 1;
  if (calendarMonth > 12) {
    calendarMonth -= 12;
  }
  
  return monthNames[calendarMonth - 1];
}

export {
  calculateDuesStatus,
  calculatePaymentDistribution,
  validatePayment,
  getYearSummary,
  calculateYearToDateTotals,
  calculateRemainingDues,
  getNextMonthDue
};