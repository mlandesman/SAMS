/**
 * Utility functions for converting numbers to words in Spanish (Mexican format)
 */

const units = [
  '', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'
];

const tens = [
  '', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'
];

const hundreds = [
  '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'
];

/**
 * Convert a number (0-999) to Spanish words
 * @param {number} num - Number to convert
 * @returns {string} Spanish words
 */
function convertHundreds(num) {
  if (num === 0) return '';
  if (num === 100) return 'cien';
  
  let result = '';
  
  // Hundreds
  if (num >= 100) {
    result += hundreds[Math.floor(num / 100)] + ' ';
    num %= 100;
  }
  
  // Tens and units
  if (num >= 20) {
    result += tens[Math.floor(num / 10)];
    if (num % 10 !== 0) {
      result += ' y ' + units[num % 10];
    }
  } else if (num > 0) {
    result += units[num];
  }
  
  return result.trim();
}

/**
 * Convert a number to Spanish words (Mexican peso format)
 * @param {number} amount - Amount to convert
 * @returns {string} Amount in Spanish words with peso format
 */
export function numberToSpanishWords(amount) {
  if (amount === 0) return 'Cero pesos 00/100 M.N.';
  
  const integerPart = Math.floor(Math.abs(amount));
  const decimalPart = Math.round((Math.abs(amount) - integerPart) * 100);
  
  let result = '';
  
  if (integerPart >= 1000000) {
    const millions = Math.floor(integerPart / 1000000);
    if (millions === 1) {
      result += 'Un millón ';
    } else {
      result += convertHundreds(millions) + ' millones ';
    }
    const remainder = integerPart % 1000000;
    if (remainder > 0) {
      result += convertThousands(remainder) + ' ';
    }
  } else {
    result += convertThousands(integerPart) + ' ';
  }
  
  // Add peso/pesos
  if (integerPart === 1) {
    result += 'peso ';
  } else {
    result += 'pesos ';
  }
  
  // Add decimal part
  result += String(decimalPart).padStart(2, '0') + '/100 M.N.';
  
  // Capitalize first letter
  return result.charAt(0).toUpperCase() + result.slice(1);
}

/**
 * Convert thousands (0-999999) to Spanish words
 * @param {number} num - Number to convert
 * @returns {string} Spanish words
 */
function convertThousands(num) {
  if (num === 0) return '';
  
  let result = '';
  
  if (num >= 1000) {
    const thousands = Math.floor(num / 1000);
    if (thousands === 1) {
      result += 'mil ';
    } else {
      result += convertHundreds(thousands) + ' mil ';
    }
    num %= 1000;
  }
  
  if (num > 0) {
    result += convertHundreds(num);
  }
  
  return result.trim();
}

/**
 * Format amount as Mexican Peso currency with MX$ prefix
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string with MX$ prefix
 */
export function formatMXCurrency(amount) {
  const formatted = new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
  
  return `MX$ ${formatted}`;
}
