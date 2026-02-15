/**
 * Currency Utilities for Frontend (Water Bills Module)
 * 
 * Handles conversion between centavos (backend storage) and pesos (frontend display)
 * This ensures consistent currency handling and eliminates floating point precision errors.
 * 
 * Pattern:
 * - Backend stores amounts as centavos (integers): 91430 = $914.30
 * - Frontend receives centavos from API
 * - Frontend converts to pesos ONLY for display
 * - Frontend converts back to centavos for submission
 * 
 * This matches the architecture that will be applied to HOA Dues module.
 */

/**
 * Convert centavos to pesos for display
 * @param {number} centavos - Amount in centavos (integer)
 * @returns {number} - Amount in pesos (decimal)
 * 
 * @example
 * centavosToPesos(91430) // Returns: 914.30
 * centavosToPesos(2457)  // Returns: 24.57
 * centavosToPesos(0)     // Returns: 0
 */
export function centavosToPesos(centavos) {
  if (typeof centavos !== 'number' || isNaN(centavos)) {
    console.warn(`currencyUtils.centavosToPesos: Invalid input "${centavos}", returning 0`);
    return 0;
  }
  return centavos / 100;
}

/**
 * Convert pesos to centavos for storage/submission
 * @param {number} pesos - Amount in pesos (decimal)
 * @returns {number} - Amount in centavos (integer)
 * 
 * @example
 * pesosToCentavos(914.30) // Returns: 91430
 * pesosToCentavos(24.57)  // Returns: 2457
 * pesosToCentavos(0)      // Returns: 0
 */
export function pesosToCentavos(pesos) {
  if (typeof pesos !== 'number' || isNaN(pesos)) {
    console.warn(`currencyUtils.pesosToCentavos: Invalid input "${pesos}", returning 0`);
    return 0;
  }
  return Math.round(pesos * 100);
}

/**
 * Format centavos as currency string for display
 * @param {number} centavos - Amount in centavos (integer)
 * @param {string} currency - Currency code (default: 'MXN')
 * @param {boolean} showCents - Whether to show decimal places (default: true)
 * @returns {string} - Formatted currency string
 * 
 * @example
 * formatCurrency(91430)           // Returns: "$914.30"
 * formatCurrency(2457)            // Returns: "$24.57"
 * formatCurrency(0)               // Returns: "$0.00"
 * formatCurrency(91430, 'MXN', false) // Returns: "$914"
 */
export function formatCurrency(centavos, currency = 'MXN', showCents = true) {
  const pesos = centavosToPesos(centavos);
  const fractionDigits = showCents ? 2 : 0;
  
  if (currency === 'MXN' || currency === 'MX') {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits
    }).format(pesos);
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(pesos);
}

/**
 * Format currency with custom precision
 * @param {number} centavos - Amount in centavos (integer)
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} - Formatted currency string
 * 
 * @example
 * formatCurrencyWithPrecision(91430, 2) // Returns: "$914.30"
 * formatCurrencyWithPrecision(91430, 0) // Returns: "$914"
 * formatCurrencyWithPrecision(91430, 3) // Returns: "$914.300"
 */
export function formatCurrencyWithPrecision(centavos, decimals = 2) {
  const pesos = centavosToPesos(centavos);
  return `$${pesos.toFixed(decimals)}`;
}

/**
 * Parse currency input from user (handles various formats)
 * @param {string|number} input - User input (e.g., "914.30", "$914.30", "914")
 * @returns {number} - Amount in centavos (integer)
 * 
 * @example
 * parseCurrencyInput("914.30")   // Returns: 91430
 * parseCurrencyInput("$914.30")  // Returns: 91430
 * parseCurrencyInput("1,234.56") // Returns: 123456
 * parseCurrencyInput(914.30)     // Returns: 91430
 */
export function parseCurrencyInput(input) {
  // Handle numeric input
  if (typeof input === 'number') {
    return pesosToCentavos(input);
  }
  
  // Handle string input
  if (!input || typeof input !== 'string') {
    console.warn(`currencyUtils.parseCurrencyInput: Invalid input "${input}", returning 0`);
    return 0;
  }
  
  // Remove currency symbols, commas, and whitespace
  const cleanInput = input.replace(/[$,\s]/g, '').trim();
  
  // Handle empty string
  if (cleanInput === '') {
    return 0;
  }
  
  const pesos = parseFloat(cleanInput);
  
  if (isNaN(pesos)) {
    console.warn(`currencyUtils.parseCurrencyInput: Could not parse "${input}", returning 0`);
    return 0;
  }
  
  return pesosToCentavos(pesos);
}

/**
 * Format centavos as pesos number (for calculations)
 * @param {number} centavos - Amount in centavos (integer)
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {number} - Amount in pesos with fixed decimals
 * 
 * @example
 * formatAsPesos(91430)    // Returns: 914.30
 * formatAsPesos(2457)     // Returns: 24.57
 */
export function formatAsPesos(centavos, decimals = 2) {
  const pesos = centavosToPesos(centavos);
  return parseFloat(pesos.toFixed(decimals));
}

/**
 * Validate currency amount (check for valid centavos value)
 * @param {number} centavos - Amount in centavos (integer)
 * @returns {boolean} - True if valid
 */
export function isValidCurrency(centavos) {
  if (typeof centavos !== 'number' || isNaN(centavos)) {
    return false;
  }
  
  // Must be an integer
  if (!Number.isInteger(centavos)) {
    return false;
  }
  
  // Must be non-negative
  if (centavos < 0) {
    return false;
  }
  
  return true;
}

/**
 * Sum multiple centavos amounts (ensures integer math)
 * @param {...number} amounts - Amounts in centavos to sum
 * @returns {number} - Sum in centavos (integer)
 * 
 * @example
 * sumCentavos(91430, 2457, 65000) // Returns: 158887
 */
export function sumCentavos(...amounts) {
  return amounts.reduce((sum, amount) => {
    if (typeof amount !== 'number' || isNaN(amount)) {
      console.warn(`currencyUtils.sumCentavos: Skipping invalid amount "${amount}"`);
      return sum;
    }
    return sum + Math.round(amount);
  }, 0);
}

/**
 * Calculate percentage of amount
 * @param {number} centavos - Amount in centavos (integer)
 * @param {number} percentage - Percentage (e.g., 5 for 5%)
 * @returns {number} - Result in centavos (integer)
 * 
 * @example
 * calculatePercentage(100000, 5) // Returns: 5000 (5% of $1000 = $50)
 */
export function calculatePercentage(centavos, percentage) {
  if (typeof centavos !== 'number' || typeof percentage !== 'number') {
    return 0;
  }
  return Math.round(centavos * (percentage / 100));
}

/**
 * Round a centavos value to the nearest integer
 * Use this when accumulating centavos calculations that may produce fractional results
 * (e.g., percentage calculations, penalty distributions)
 *
 * @param {number} centavos - Amount in centavos (may have fractional part from calculations)
 * @returns {number} Rounded centavos (integer)
 *
 * @example
 * roundCentavos(10050.4);  // 10050
 * roundCentavos(10050.5);  // 10051
 * roundCentavos(10050.9);  // 10051
 */
export function roundCentavos(centavos) {
  return Math.round(centavos);
}

/**
 * Round a pesos value to 2 decimal places
 * Use this ONLY for display rounding when centavosToPesos() precision is insufficient.
 * Prefer working in centavos integers to avoid this.
 *
 * @param {number} pesos - Amount in pesos (may have floating point artifacts)
 * @returns {number} Pesos rounded to 2 decimal places
 *
 * @example
 * roundPesos(100.505);   // 100.51
 * roundPesos(100.494);   // 100.49
 */
export function roundPesos(pesos) {
  if (pesos == null || (typeof pesos === 'number' && isNaN(pesos))) return 0;
  return Math.round(pesos * 100) / 100;
}

