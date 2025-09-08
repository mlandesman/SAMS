/**
 * HOA Dues utility functions for payment calculations and handling.
 */

/**
 * Calculates the remaining credit and as many full months of payments that can be made.
 * 
 * @param {number} amtPaid - The amount paid in dollars.
 * @param {number} amtMonthly - The monthly due amount in dollars.
 * @param {number} amtCredit - The current credit in dollars.
 * @return {Object} An object containing:
 *   - remainingCredit: the updated credit balance after this transaction
 *   - amtOverpayment: how much of the payment was in excess or negative if credit was used
 *   - monthlyPayments: array of monthly payment amounts in sequential order
 */
import debug from './debug';

export function calculatePayments(amtPaid, amtMonthly, amtCredit) {
  // Coerce the inputs to numbers to ensure they are numeric
  amtPaid = Number(amtPaid);
  amtMonthly = Number(amtMonthly);
  amtCredit = Number(amtCredit);

  debug.group('calculatePayments', () => {
    debug.log(`Amount Paid: ${amtPaid}, Monthly Due: ${amtMonthly}, Current Credit: ${amtCredit}`);
  });

  // Special case: if monthly due is 0, entire payment goes to credit
  if (amtMonthly === 0) {
    debug.log("Monthly due is 0, entire payment goes to credit");
    return {
      remainingCredit: amtCredit + amtPaid,
      amtOverpayment: amtPaid,
      monthlyPayments: []
    };
  }

  // Calculate the total funds available (amtPaid + amtCredit)
  let totalFunds = amtPaid + amtCredit;

  // Calculate how many full months can be paid
  let monthsPaid = Math.floor(totalFunds / amtMonthly);
  let totalForMonths = monthsPaid * amtMonthly;

  // Calculate remaining funds after paying full months
  let remainingFunds = totalFunds - totalForMonths;

  // Determine the overpayment or credit usage
  let amtOverpayment;
  let remainingCredit;

  if (remainingFunds >= amtCredit) {
    // Overpayment scenario: The payment has extra beyond what was needed to cover full months
    amtOverpayment = remainingFunds - amtCredit;
    remainingCredit = amtCredit + amtOverpayment;
  } else {
    // Credit usage scenario: Some credit was used to cover full months
    amtOverpayment = amtPaid - totalForMonths; // Will be negative - amount taken from credit
    remainingCredit = amtCredit + amtOverpayment; // Deduct used credit
  }

  debug.log("Remaining credit: " + remainingCredit);
  debug.log("Overpayment or credit usage: " + amtOverpayment);
  debug.log("Number of months that can be paid: " + monthsPaid);

  // Prepare the monthly payments array
  let monthlyPayments = Array(monthsPaid).fill(amtMonthly);

  return {
    remainingCredit,
    amtOverpayment,
    monthlyPayments
  };
}

/**
 * Formats a number as currency in MXN format
 * 
 * @param {number} amount - The amount to format
 * @return {string} The formatted amount string
 */
export function formatAsMXN(amount) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  }).format(amount);
}

/**
 * Gets the month name for a given month index
 * 
 * @param {number} monthIndex - Month index (1-12)
 * @param {boolean} [short=false] - Whether to use short month names (3 letters)
 * @return {string} The month name
 */
export function getMonthName(monthIndex, short = false) {
  const date = new Date();
  date.setMonth(monthIndex - 1); // monthIndex is 1-based, setMonth is 0-based
  
  return date.toLocaleString('default', { 
    month: short ? 'short' : 'long'
  });
}

/**
 * Generates a description of the months being paid
 * 
 * @param {number} startMonth - Starting month index (1-12)
 * @param {number} count - Number of months to include
 * @param {number} year - The year for these months
 * @return {string} Formatted description like "Jan, Feb, Mar 2023"
 */
export function generateMonthsDescription(startMonth, count, year) {
  if (count <= 0) return '';
  
  let months = [];
  for (let i = 0; i < count; i++) {
    // Handle wrapping to the next year if needed
    const actualMonth = ((startMonth + i - 1) % 12) + 1;
    const actualYear = year + Math.floor((startMonth + i - 1) / 12);
    
    months.push({
      name: getMonthName(actualMonth, true),
      year: actualYear
    });
  }
  
  // Group by year
  const byYear = months.reduce((acc, month) => {
    if (!acc[month.year]) acc[month.year] = [];
    acc[month.year].push(month.name);
    return acc;
  }, {});
  
  // Generate the description
  return Object.entries(byYear)
    .map(([year, monthNames]) => `${monthNames.join(', ')} ${year}`)
    .join('; ');
}

/**
 * Generate a sequence number for transactions
 * 
 * @return {string} A sequence number in the format YYMMDD-HHMM
 */
export function generateSequenceNumber() {
  const now = new Date();
  const year = now.getFullYear().toString().substring(2); // YY
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // MM
  const day = now.getDate().toString().padStart(2, '0'); // DD
  const hour = now.getHours().toString().padStart(2, '0'); // HH
  const minute = now.getMinutes().toString().padStart(2, '0'); // MM
  
  return `${year}${month}${day}-${hour}${minute}`;
}
