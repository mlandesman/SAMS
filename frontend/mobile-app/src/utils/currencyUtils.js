/**
 * Currency Utilities for Mobile PWA
 *
 * Canonical conversion functions between centavos (backend storage)
 * and pesos (frontend display). Matches the desktop and backend pattern
 * established in Sprint CX (#181).
 *
 * Import paths:
 *   Mobile:  import { centavosToPesos } from '@/utils/currencyUtils.js'
 *   Desktop: import { centavosToPesos } from '../utils/currencyUtils'
 *   Backend: import { centavosToPesos } from '../../shared/utils/currencyUtils.js'
 */

export function centavosToPesos(centavos) {
  if (typeof centavos !== 'number' || isNaN(centavos)) return 0;
  return centavos / 100;
}

export function pesosToCentavos(pesos) {
  if (typeof pesos !== 'number' || isNaN(pesos)) return 0;
  return Math.round(pesos * 100);
}

export function roundCentavos(centavos) {
  return Math.round(centavos);
}

export function roundPesos(pesos) {
  if (pesos == null || (typeof pesos === 'number' && isNaN(pesos))) return 0;
  return Math.round(pesos * 100) / 100;
}

export function formatCurrency(centavos, currency = 'USD') {
  const pesos = centavosToPesos(centavos);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pesos);
}
