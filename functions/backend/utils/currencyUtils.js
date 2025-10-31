/**
 * Currency Utilities for Backend
 * Provides consistent currency formatting and conversion across the backend
 */

/**
 * Format centavos to currency string
 * @param {number} centavos - Amount in centavos
 * @param {string} currency - Currency code (default: 'MXN')
 * @param {boolean} showCents - Whether to show decimal places (default: true)
 * @returns {string} Formatted currency string
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
 * @param {number} centavos - Amount in centavos
 * @returns {number} Amount in pesos
 */
export function centavosToPesos(centavos) {
  return centavos / 100;
}

/**
 * Convert pesos to centavos
 * @param {number} pesos - Amount in pesos
 * @returns {number} Amount in centavos
 */
export function pesosToCentavos(pesos) {
  return Math.round(pesos * 100);
}

