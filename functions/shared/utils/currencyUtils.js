/**
 * Currency Utilities for SAMS
 * Provides consistent currency formatting and conversion across all modules
 * 
 * Architecture:
 * - STORAGE: All amounts stored as INTEGER CENTAVOS in Firestore
 * - PROCESSING: All math performed in INTEGER CENTAVOS
 * - API RESPONSE: Amounts converted to PESOS (floating point)
 * - FRONTEND: Display PESOS only (no calculations)
 * 
 * Reusability: 100% across Water Bills, HOA Dues, Reports, Propane Tanks
 * 
 * @module shared/utils/currencyUtils
 */

/**
 * Format centavos to currency string
 * Converts integer centavos to formatted currency display
 * 
 * @param {number} centavos - Amount in centavos (integer, e.g., 10050 for $100.50)
 * @param {string} [currency='MXN'] - Currency code (default: 'MXN' for Mexican Peso)
 * @param {boolean} [showCents=true] - Whether to show decimal places (default: true)
 * @returns {string} Formatted currency string (e.g., "$100.50" for MXN)
 * 
 * @example
 * formatCurrency(10050);              // "$100.50" (MXN default)
 * formatCurrency(10050, 'MXN', true); // "$100.50" (with cents)
 * formatCurrency(10050, 'MXN', false);// "$101" (no cents)
 * formatCurrency(10050, 'USD');       // "$100.50" (USD format)
 */
export function formatCurrency(centavos, currency = 'MXN', showCents = true) {
  const amount = centavos / 100; // Convert centavos to pesos
  const fractionDigits = showCents ? 2 : 0;
  
  if (currency === 'MXN' || currency === 'MX') {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits
    }).format(amount);
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(amount);
}

/**
 * Convert centavos to pesos
 * Used for API responses and frontend display
 * 
 * @param {number} centavos - Amount in centavos (integer, e.g., 10050)
 * @returns {number} Amount in pesos (float, e.g., 100.50)
 * 
 * @example
 * centavosToPesos(10050);  // 100.5
 * centavosToPesos(0);      // 0
 * centavosToPesos(100);    // 1
 */
export function centavosToPesos(centavos) {
  if (centavos == null || (typeof centavos === 'number' && isNaN(centavos))) return 0;
  return centavos / 100;
}

/**
 * Convert pesos to centavos
 * Used for converting user input to storage format
 * Rounds to nearest centavo to avoid floating point errors
 * 
 * @param {number} pesos - Amount in pesos (float, e.g., 100.50)
 * @returns {number} Amount in centavos (integer, e.g., 10050)
 * 
 * @example
 * pesosToCentavos(100.50);     // 10050
 * pesosToCentavos(100.499);    // 10050 (rounded)
 * pesosToCentavos(100.501);    // 10050 (rounded)
 * pesosToCentavos(0);          // 0
 */
export function pesosToCentavos(pesos) {
  return Math.round(pesos * 100);
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

