/**
 * Statement HTML Service
 * Generates professional HTML statements matching prior administrator's design
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { getStatementData } from './statementDataService.js';
import { DateTime } from 'luxon';
import { getNow } from '../../shared/services/DateService.js';
import { joinOwnerNames } from '../utils/unitContactUtils.js';

/**
 * Format currency (pesos)
 * @param {number} amount - Amount in pesos
 * @param {boolean} showSign - Whether to show + for positive
 * @returns {string} Formatted currency
 */
function formatCurrency(amount, showSign = false) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '$0.00';
  }
  
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  if (amount < 0) {
    return `-$${formatted}`;
  } else if (showSign && amount > 0) {
    return `+$${formatted}`;
  }
  return `$${formatted}`;
}

/**
 * Format date as dd MMM yyyy (e.g., "22 Jan 2026") using America/Cancun timezone
 * CRITICAL: Uses Luxon to avoid timezone conversion issues
 */
function formatDate(dateValue) {
  if (!dateValue) return '';
  
  let dt;
  
  // Handle different input types
  if (typeof dateValue === 'string') {
    // Parse ISO string in Cancun timezone
    dt = DateTime.fromISO(dateValue, { zone: 'America/Cancun' });
    if (!dt.isValid) {
      // Try SQL format (YYYY-MM-DD)
      dt = DateTime.fromSQL(dateValue, { zone: 'America/Cancun' });
    }
  } else if (dateValue instanceof Date) {
    // Convert JS Date to Cancun timezone
    dt = DateTime.fromJSDate(dateValue).setZone('America/Cancun');
  } else if (dateValue && typeof dateValue.toDate === 'function') {
    // Firestore Timestamp
    dt = DateTime.fromJSDate(dateValue.toDate()).setZone('America/Cancun');
  } else {
    return '';
  }
  
  if (!dt.isValid) return '';
  
  // Format as dd MMM yyyy (e.g., "22 Jan 2026")
  return dt.toFormat('dd MMM yyyy');
}

/**
 * Format centavos to pesos
 * @param {number} centavos - Amount in centavos
 * @returns {number} Amount in pesos
 */
function centavosToPesos(centavos) {
  if (!centavos && centavos !== 0) return 0;
  return centavos / 100;
}

/**
 * Format date range for project period
 * @param {string|Date} startDate - Start date
 * @param {string|Date} endDate - End date
 * @returns {string} Formatted date range (e.g., "Jan 2024 - Dec 2024")
 */
function formatDateRange(startDate, endDate) {
  if (!startDate || !endDate) return '';
  
  const start = typeof startDate === 'string' 
    ? DateTime.fromISO(startDate, { zone: 'America/Cancun' })
    : DateTime.fromJSDate(startDate).setZone('America/Cancun');
  const end = typeof endDate === 'string'
    ? DateTime.fromISO(endDate, { zone: 'America/Cancun' })
    : DateTime.fromJSDate(endDate).setZone('America/Cancun');
  
  if (!start.isValid || !end.isValid) return '';
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[start.month - 1]} ${start.year} - ${monthNames[end.month - 1]} ${end.year}`;
}

/**
 * Capitalize and format project status
 * @param {string} status - Project status
 * @returns {string} Formatted status
 */
function capitalizeStatus(status) {
  if (!status) return '';
  const statusMap = {
    'completed': 'Complete',
    'in-progress': 'Started', 
    'planned': 'Pending'
  };
  return statusMap[status.toLowerCase()] || status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Translate description text for Spanish
 */
function translateDescription(description, language) {
  if (language !== 'spanish' || !description) {
    return description;
  }
  
  let translated = description;
  
  // Common patterns to translate (order matters - do longer phrases first)
  const translations = {
    // HOA/Dues terms (longer phrases first)
    'HOA Dues': 'Cuotas de Mantenimiento',
    'HOA Penalty': 'Penalización de Mantenimiento',
    'HOA': 'Mantenimiento',
    'Maintenance': 'Mantenimiento',
    'Dues': 'Cuotas',
    
    // Water terms (longer phrases first)
    'Water Bill': 'Factura de Agua',
    'Water Penalty': 'Penalización de Agua',
    'Water Consumption': 'Consumo de Agua',
    'Water': 'Agua',
    
    // Payment terms
    'Payment -': 'Pago -',
    'Payment': 'Pago',
    
    // Quarter terms
    'Q0': 'T0',
    'Q1': 'T1',
    'Q2': 'T2',
    'Q3': 'T3',
    'Q4': 'T4',
    
    // Other common terms
    'Penalty': 'Penalización',
    'Opening Balance': 'Balance Inicial',
    'Adjustment': 'Ajuste',
    'Credit': 'Crédito',
    'Charge': 'Cargo'
  };
  
  // Replace each pattern (order matters - do longer phrases first)
  for (const [english, spanish] of Object.entries(translations)) {
    const regex = new RegExp(english, 'gi');
    translated = translated.replace(regex, spanish);
  }
  
  return translated;
}

/**
 * Get translation strings for language
 */
function getTranslations(language) {
  const translations = {
    english: {
      title: 'STATEMENT OF ACCOUNT',
      statementFor: 'STATEMENT FOR',
      unit: 'Unit',
      bankingInfo: 'PAYMENT INFORMATION',
      bank: 'Bank',
      account: 'Account',
      clabe: 'CLABE',
      beneficiary: 'Beneficiary',
      reference: 'Reference',
      address: 'Address',
      period: 'Period',
      date: 'Date',
      nextPaymentDue: 'Next Payment',
      accountActivity: 'ACCOUNT ACTIVITY',
      openingBalance: 'Opening Balance',
      tableHeaders: {
        date: 'DATE',
        description: 'DESCRIPTION',
        charge: 'CHARGE',
        payment: 'PAYMENT',
        balance: 'BALANCE DUE'
      },
      allocationSummary: 'ALLOCATION SUMMARY',
      category: 'Category',
      charges: 'Charges',
      penalties: 'Penalties',
      totalPaid: 'Total Paid',
      totals: 'TOTALS',
      specialAssessments: 'SPECIAL ASSESSMENTS / PROJECTS',
      yourAssessment: 'Your Assessment',
      projectPeriod: 'Period',
      projectStatus: 'Status',
      projectBudget: 'Budget',
      totalSpecialAssessments: 'TOTAL SPECIAL ASSESSMENTS PAID',
      balanceDue: 'BALANCE DUE',
      creditBalance: 'CREDIT BALANCE',
      accountCredit: 'ACCOUNT CREDIT',
      lessCredit: 'Less: Credit on Account',
      creditBalanceActivity: 'CREDIT BALANCE ACTIVITY',
      creditDate: 'DATE',
      creditType: 'TYPE',
      creditAmount: 'AMOUNT',
      creditNotes: 'NOTES',
      creditDeposit: 'Deposit',
      creditDeposits: 'Deposits',
      creditApplied: 'Applied to Dues',
      creditAppliedPlural: 'Applied',
      netAmountDue: 'NET AMOUNT DUE',
      paidInFull: 'NO PAYMENT NEEDED',
      statementId: 'Statement ID',
      generatedOn: 'Generated',
      pageOf: 'Page',
      questionsContact: 'For questions, please contact {name} at {email} or WhatsApp {phone}',
      confidentialNotice: 'This statement is confidential and intended only for the addressee.',
      paymentTerms: {
        cash: 'We inform you that for security reasons we do not receive cash, so please make your payment in the condominium\'s bank account and send us your receipt.',
        waterDue: '***the water consumption must be paid within the first 10 days of the corresponding month, after the ten days there will be 5% interest per month.**',
        hoaDue: '***Maintenance fees must be paid within the first month of the corresponding quarter, after the month there will be 5% interest per month as approved by the Condominium Owners\' Meeting. **',
        application: 'Payments are applied first to the penalties and then to the oldest installments as indicated in articles 2281 and 2282 of the Civil Code of the State of Quintana Roo.'
      }
    },
    spanish: {
      title: 'ESTADO DE CUENTA',
      statementFor: 'ESTADO DE CUENTA PARA',
      unit: 'Depto',
      bankingInfo: 'INFORMACIÓN DE PAGO',
      bank: 'Banco',
      account: 'Cuenta',
      clabe: 'CLABE',
      beneficiary: 'Beneficiario',
      reference: 'Referencia',
      address: 'Dirección',
      period: 'Período',
      date: 'Fecha',
      nextPaymentDue: 'Próximo Pago',
      accountActivity: 'ACTIVIDAD DE LA CUENTA',
      openingBalance: 'Balance Inicial',
      tableHeaders: {
        date: 'FECHA',
        description: 'DESCRIPCION',
        charge: 'CARGO',
        payment: 'PAGO',
        balance: 'SALDO PENDIENTE'
      },
      allocationSummary: 'RESUMEN DE ASIGNACIÓN',
      category: 'Categoría',
      charges: 'Cargos',
      penalties: 'Penalizaciones',
      totalPaid: 'Total Pagado',
      totals: 'TOTALES',
      specialAssessments: 'CUOTAS ESPECIALES / PROYECTOS',
      yourAssessment: 'Su Cuota',
      projectPeriod: 'Período',
      projectStatus: 'Estado',
      projectBudget: 'Presupuesto',
      totalSpecialAssessments: 'TOTAL CUOTAS ESPECIALES PAGADAS',
      balanceDue: 'SALDO PENDIENTE',
      creditBalance: 'SALDO A FAVOR',
      accountCredit: 'CRÉDITO EN CUENTA',
      lessCredit: 'Menos: Crédito en Cuenta',
      creditBalanceActivity: 'ACTIVIDAD DE SALDO A FAVOR',
      creditDate: 'FECHA',
      creditType: 'TIPO',
      creditAmount: 'MONTO',
      creditNotes: 'NOTAS',
      creditDeposit: 'Depósito',
      creditDeposits: 'Depósitos',
      creditApplied: 'Aplicado a Cuotas',
      creditAppliedPlural: 'Aplicado',
      netAmountDue: 'IMPORTE NETO ADEUDADO',
      paidInFull: 'NO SE REQUIERE PAGO',
      statementId: 'ID del Estado de Cuenta',
      generatedOn: 'Generado',
      pageOf: 'Página',
      questionsContact: 'Para preguntas, favor de contactar {name} al {email} o WhatsApp {phone}',
      confidentialNotice: 'Este estado de cuenta es confidencial y destinado únicamente al destinatario.',
      paymentTerms: {
        cash: 'Les informamos que por razones de seguridad no recibimos efectivo, favor de realizar su pago en la cuenta bancaria del condominio y enviarnos su recibo.',
        waterDue: '***el consumo de agua debe pagarse dentro de los primeros 10 días del mes correspondiente, después de los diez días habrá un interés del 5% mensual.**',
        hoaDue: '***Las cuotas de mantenimiento deben pagarse dentro del primer mes del trimestre correspondiente, después del mes habrá un interés del 5% mensual según lo aprobado por la Asamblea de Propietarios. **',
        application: 'Los pagos se aplican primero a las penalizaciones y luego a las cuotas más antiguas según lo indicado en los artículos 2281 y 2282 del Código Civil del Estado de Quintana Roo.'
      }
    }
  };
  
  return translations[language] || translations.english;
}

/**
 * Collapse same-day entries of the same type
 * @param {Array} entries - Array of credit activity entries
 * @returns {Array} Collapsed entries
 */
/**
 * Helper to get quarter from a date
 */
function getQuarterFromDate(date) {
  let dt;
  if (date instanceof Date) {
    dt = DateTime.fromJSDate(date).setZone('America/Cancun');
  } else if (typeof date === 'string') {
    dt = DateTime.fromISO(date, { zone: 'America/Cancun' });
    if (!dt.isValid) {
      dt = DateTime.fromSQL(date, { zone: 'America/Cancun' });
    }
  }
  if (!dt || !dt.isValid) return null;
  
  const month = dt.month;
  const year = dt.year;
  const quarter = Math.ceil(month / 3);
  return { quarter, year, month, dt };
}

/**
 * Extract category from notes (HOA, Water, etc.)
 */
function getCategoryFromNotes(notes) {
  if (!notes) return 'other';
  const lowerNotes = notes.toLowerCase();
  if (lowerNotes.includes('hoa') || lowerNotes.includes('dues') || lowerNotes.includes('maintenance')) {
    return 'hoa';
  }
  if (lowerNotes.includes('water')) {
    return 'water';
  }
  if (lowerNotes.includes('penalty') || lowerNotes.includes('interest')) {
    return 'penalty';
  }
  return 'other';
}

/**
 * Collapse credit entries for display by grouping quarterly entries of the same type/category
 * This keeps the report concise while preserving granular data for CSV export
 */
function collapseCreditEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }
  
  const grouped = {};
  
  entries.forEach(entry => {
    const quarterInfo = getQuarterFromDate(entry.date);
    if (!quarterInfo) {
      // Can't parse date - keep as standalone
      const key = `standalone_${Date.now()}_${Math.random()}`;
      grouped[key] = { ...entry, count: 1, originalEntries: [entry] };
      return;
    }
    
    // Infer type from amount if type is missing
    const amount = entry.amount || 0;
    const entryType = entry.type && entry.type !== 'undefined' 
      ? entry.type 
      : (amount >= 0 ? 'credit_added' : 'credit_used');
    
    // Get category from notes
    const category = getCategoryFromNotes(entry.notes);
    
    // For starting_balance, don't group - keep as standalone
    if (entryType === 'starting_balance') {
      const key = `starting_${quarterInfo.year}_${quarterInfo.month}`;
      grouped[key] = { ...entry, count: 1, originalEntries: [entry] };
      return;
    }
    
    // Group by: year + quarter + type + category
    const groupKey = `${quarterInfo.year}_Q${quarterInfo.quarter}_${entryType}_${category}`;
    
    if (!grouped[groupKey]) {
      grouped[groupKey] = {
        ...entry,
        count: 1,
        originalEntries: [entry],
        quarterInfo,
        category,
        entryType
      };
    } else {
      // Combine amounts
      grouped[groupKey].amount += entry.amount;
      grouped[groupKey].count++;
      grouped[groupKey].originalEntries.push(entry);
      // Update date range - use earliest date
      const existingQuarter = grouped[groupKey].quarterInfo;
      if (quarterInfo.dt < existingQuarter.dt) {
        grouped[groupKey].date = entry.date;
        grouped[groupKey].quarterInfo = quarterInfo;
      }
    }
  });
  
  // Convert grouped object to array and format notes for combined entries
  const result = Object.values(grouped).map(groupedEntry => {
    if (groupedEntry.count > 1) {
      // Multiple entries - create summary note
      const months = groupedEntry.originalEntries.map(e => {
        const q = getQuarterFromDate(e.date);
        return q ? q.dt.toFormat('MMM') : '';
      }).filter(Boolean);
      
      const uniqueMonths = [...new Set(months)];
      const monthRange = uniqueMonths.length > 2 
        ? `${uniqueMonths[0]}-${uniqueMonths[uniqueMonths.length - 1]}`
        : uniqueMonths.join(', ');
      
      const categoryLabel = {
        'hoa': 'HOA Dues',
        'water': 'Water Bills',
        'penalty': 'Penalties',
        'other': 'Items'
      }[groupedEntry.category] || 'Items';
      
      const actionLabel = groupedEntry.entryType === 'credit_used' ? 'Used for' : 'Added from';
      const year = groupedEntry.quarterInfo?.year || '';
      
      groupedEntry.notes = `${actionLabel} ${categoryLabel} (${monthRange} ${year}) - ${groupedEntry.count} entries`;
    }
    return groupedEntry;
  });
  
  // Sort by date
  result.sort((a, b) => {
    const dateA = a.quarterInfo?.dt || DateTime.fromISO('1970-01-01');
    const dateB = b.quarterInfo?.dt || DateTime.fromISO('1970-01-01');
    return dateA < dateB ? -1 : dateA > dateB ? 1 : 0;
  });
  
  return result;
}

/**
 * Get type label for credit entry (bilingual)
 * @param {string} type - Entry type ('credit_added' or 'credit_used')
 * @param {number} count - Number of entries (for pluralization)
 * @param {string} language - Language ('english' or 'spanish')
 * @param {number} amount - Entry amount (to infer type if missing)
 * @returns {string} Formatted type label
 */
function getCreditTypeLabel(type, count, language, amount = 0) {
  const t = getTranslations(language);
  const isPlural = count > 1;
  
  // Infer type from amount if type is missing or undefined
  const inferredType = type && type !== 'undefined' ? type : (amount >= 0 ? 'credit_added' : 'credit_used');
  
  if (inferredType === 'credit_added') {
    return isPlural ? `${t.creditDeposits} (${count})` : t.creditDeposit;
  } else if (inferredType === 'credit_used') {
    return isPlural ? `${t.creditAppliedPlural} (${count})` : t.creditApplied;
  }
  return inferredType || 'Unknown';
}

/**
 * Generate propane gauge SVG
 * @param {number} level - Tank level percentage (0-100)
 * @param {Object} thresholds - Threshold config { critical: 10, low: 30 }
 * @param {string} language - Language ('english' or 'spanish')
 * @returns {string} SVG markup
 */
function generatePropaneGaugeSvg(level, thresholds, language) {
  const t = language === 'spanish' ? 'NIVEL DE GAS' : 'PROPANE LEVEL';
  
  // Clamp level to 0-100
  const clampedLevel = Math.max(0, Math.min(100, level));
  
  // Scale up to match water bars graph size (385x190)
  const svgWidth = 385;
  const svgHeight = 190;
  const centerX = svgWidth / 2;
  const centerY = svgHeight * 0.72; // Position gauge slightly higher
  const radius = 132;
  const needleLength = 110;
  
  // Calculate needle position
  // 0% = 180° (left), 100% = 0° (right)
  const angle = 180 - (clampedLevel * 1.8);
  const radians = angle * (Math.PI / 180);
  const x2 = centerX + needleLength * Math.cos(radians);
  const y2 = centerY - needleLength * Math.sin(radians);
  
  // Arc paths scaled up
  const arcStartX = centerX - radius;
  const arcEndX = centerX + radius;
  const arcY = centerY;
  const arcControlY = centerY - radius * 0.7;
  
  // Red zone: 0-10% (180° to 162°)
  const redEndAngle = 162;
  const redEndRad = redEndAngle * (Math.PI / 180);
  const redEndX = centerX + radius * Math.cos(redEndRad);
  const redEndY = centerY - radius * Math.sin(redEndRad);
  
  // Amber zone: 10-30% (162° to 126°)
  const amberEndAngle = 126;
  const amberEndRad = amberEndAngle * (Math.PI / 180);
  const amberEndX = centerX + radius * Math.cos(amberEndRad);
  const amberEndY = centerY - radius * Math.sin(amberEndRad);
  
  return `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
      <!-- Red zone: 0-10% -->
      <path d="M ${arcStartX} ${arcY} A ${radius} ${radius} 0 0 1 ${redEndX} ${redEndY}" 
            fill="none" stroke="#dc3545" stroke-width="12" stroke-linecap="round"/>
      <!-- Amber zone: 10-30% -->
      <path d="M ${redEndX} ${redEndY} A ${radius} ${radius} 0 0 1 ${amberEndX} ${amberEndY}" 
            fill="none" stroke="#ffc107" stroke-width="12"/>
      <!-- Green zone: 30-100% -->
      <path d="M ${amberEndX} ${amberEndY} A ${radius} ${radius} 0 0 1 ${arcEndX} ${arcY}" 
            fill="none" stroke="#28a745" stroke-width="12" stroke-linecap="round"/>
      
      <!-- Needle -->
      <line x1="${centerX}" y1="${centerY}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#333" stroke-width="3"/>
      <circle cx="${centerX}" cy="${centerY}" r="6" fill="#333"/>
      
      <!-- Level label -->
      <text x="${centerX}" y="${svgHeight - 20}" text-anchor="middle" font-size="20" font-weight="bold" fill="#333">${Math.round(clampedLevel)}%</text>
      
      <!-- Title positioned below percentage -->
      <text x="${centerX}" y="${svgHeight - 5}" text-anchor="middle" font-size="10" font-weight="bold" fill="#666">${t}</text>
    </svg>
  `;
}

/**
 * Format period label for water consumption chart
 * @param {number} year - Fiscal year
 * @param {number} month - Fiscal month (0-11) - this is the month the consumption represents
 * @param {number} fiscalYearStartMonth - Fiscal year start month (1-12, default 7 for AVII)
 * @returns {string} Formatted label (e.g., "Jul" for fiscal month 0 if start is July)
 */
function formatPeriodLabel(year, month, fiscalYearStartMonth = 7) {
  // Convert fiscal month (0-11) to calendar month (0-11)
  // Fiscal month 0 = fiscal year start month
  // For AVII: fiscal month 0 = July (calendar month 6), fiscal month 1 = August (calendar month 7)
  // For MTC: fiscal month 0 = January (calendar month 0), fiscal month 1 = February (calendar month 1)
  const calendarMonth = ((fiscalYearStartMonth - 1) + month) % 12;
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Just return the month name, no year
  return monthNames[calendarMonth];
}

/**
 * Generate water consumption bar chart SVG
 * @param {Array} periods - Array of { year, month, consumption } objects
 * @param {string} language - Language ('english' or 'spanish')
 * @returns {string} SVG markup
 */
function generateWaterBarsSvg(periods, language) {
  const title = language === 'spanish' ? 'CONSUMO DE AGUA' : 'WATER CONSUMPTION';
  const latestLabel = language === 'spanish' ? 'Último' : 'Latest';
  
  if (!periods || periods.length === 0) {
    return '';
  }
  
  const maxConsumption = Math.max(...periods.map(p => p.consumption || 0));
  if (maxConsumption === 0) {
    return '';
  }
  
  // Increased dimensions for better space utilization (~10% larger, ~385x193)
  const svgWidth = 385;
  const svgHeight = 190;
  const maxHeight = 110;
  const barWidth = 38;
  const barSpacing = 9;
  const startX = 50; // Moved right to make room for Y-axis
  const baselineY = 140;
  const titleY = 20;
  const labelY = 162;
  const footerY = 182;
  const yAxisX = 45; // X position for Y-axis
  const chartRightX = svgWidth - 35; // Right edge of chart area
  
  // Get fiscal year start month from first period (passed from data service)
  const fiscalYearStartMonth = periods[0]?.fiscalYearStartMonth || 7;
  
  const bars = periods.map((p, i) => {
    const height = Math.round((p.consumption / maxConsumption) * maxHeight) || 2;
    const x = startX + i * (barWidth + barSpacing);
    const y = baselineY - height;
    const label = formatPeriodLabel(p.year, p.month, fiscalYearStartMonth);
    
    return { x, y, height, label, consumption: p.consumption };
  });
  
  const barsHtml = bars.map(b => 
    `<rect x="${b.x}" y="${b.y}" width="${barWidth}" height="${b.height}" fill="url(#sandyland-gradient)" rx="3"/>`
  ).join('\n      ');
  
  const labelsHtml = bars.map(b =>
    `<text x="${b.x + barWidth/2}" y="${labelY}" text-anchor="middle" font-size="10" fill="#666">${b.label}</text>`
  ).join('\n      ');
  
  const latest = periods[periods.length - 1];
  
  return `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sandyland-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0863BF"/>
          <stop offset="72%" stop-color="#83C4F2"/>
          <stop offset="100%" stop-color="#F7E4C2"/>
        </linearGradient>
      </defs>
      
      <text x="${svgWidth/2}" y="${titleY}" text-anchor="middle" font-size="12" font-weight="bold" fill="#333">${title}</text>
      
      <!-- Y-axis -->
      <line x1="${yAxisX}" y1="30" x2="${yAxisX}" y2="${baselineY}" stroke="#666" stroke-width="1.5"/>
      <!-- Y-axis labels (m³ values) -->
      ${(() => {
        // Round max consumption up to a nice number for axis
        const maxLabel = Math.ceil(maxConsumption / 5) * 5; // Round up to nearest 5
        const step = maxLabel / 4; // 4 tick marks (0, 25%, 50%, 75%, 100%)
        const ticks = [];
        for (let i = 0; i <= 4; i++) {
          const value = maxLabel - (i * step);
          const y = 30 + (i * (baselineY - 30) / 4);
          // Show value in m³ (only show units on top label to save space)
          const label = i === 0 ? `${Math.round(value)} m³` : `${Math.round(value)}`;
          ticks.push(`<text x="${yAxisX - 5}" y="${y + 4}" text-anchor="end" font-size="8" fill="#666">${label}</text>`);
          if (i > 0 && i < 4) {
            ticks.push(`<line x1="${yAxisX - 3}" y1="${y}" x2="${yAxisX}" y2="${y}" stroke="#ccc" stroke-width="0.5"/>`);
          }
        }
        return ticks.join('\n      ');
      })()}
      
      <!-- X-axis baseline -->
      <line x1="${yAxisX}" y1="${baselineY}" x2="${chartRightX}" y2="${baselineY}" stroke="#666" stroke-width="2"/>
      
      ${barsHtml}
      ${labelsHtml}
      
      <text x="${svgWidth/2}" y="${footerY}" text-anchor="middle" font-size="11" fill="#333">
        ${latestLabel}: ${latest.consumption} m³
      </text>
    </svg>
  `;
}

/**
 * Format period label with year for email tables
 * @param {number} year - Fiscal year
 * @param {number} month - Fiscal month (0-11)
 * @param {number} fiscalYearStartMonth - Fiscal year start month (1-12, default 7 for AVII)
 * @param {string} language - 'english' or 'spanish'
 * @returns {string} Formatted label (e.g., "Jul 2025" or "Jul 2025" in Spanish)
 */
function formatPeriodLabelWithYear(year, month, fiscalYearStartMonth = 7, language = 'english') {
  // Convert fiscal month (0-11) to calendar month (0-11)
  const calendarMonth = ((fiscalYearStartMonth - 1) + month) % 12;
  
  const isSpanish = language === 'spanish' || language === 'es';
  const monthNames = isSpanish 
    ? ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 
       'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Handle year rollover: if calendar month is before fiscal start, it's the next year
  let displayYear = year;
  if (calendarMonth < (fiscalYearStartMonth - 1)) {
    displayYear = year + 1;
  }
  
  return `${monthNames[calendarMonth]} ${displayYear}`;
}

/**
 * Generate water consumption table for email (email-compatible, no SVG)
 * @param {Array} periods - Array of { year, month, consumption, fiscalYearStartMonth } objects
 * @param {string} language - 'english' or 'spanish'
 * @returns {string} HTML table markup
 */
function generateWaterTableHtml(periods, language) {
  const isSpanish = language === 'spanish' || language === 'es';
  const title = isSpanish ? 'CONSUMO DE AGUA' : 'WATER CONSUMPTION';
  const monthHeader = isSpanish ? 'Mes' : 'Month';
  const usageHeader = isSpanish ? 'Uso' : 'Usage';
  
  if (!periods || periods.length === 0) {
    return '';
  }
  
  // Take last 6 periods
  const recentPeriods = periods.slice(-6);
  
  // Pad to 6 if we have fewer
  while (recentPeriods.length < 6) {
    recentPeriods.unshift({ year: 0, month: 0, consumption: 0 });
  }
  
  // Split into left (0-2) and right (3-5)
  const leftPeriods = recentPeriods.slice(0, 3);
  const rightPeriods = recentPeriods.slice(3, 6);
  
  // Fiscal year start month for label formatting
  const fiscalYearStartMonth = periods[0]?.fiscalYearStartMonth || 7;
  
  // Build table rows
  const rows = [];
  for (let i = 0; i < 3; i++) {
    const left = leftPeriods[i];
    const right = rightPeriods[i];
    const isLatest = (i === 2);
    
    const leftLabel = left.year > 0 ? formatPeriodLabelWithYear(left.year, left.month, fiscalYearStartMonth, language) : '--';
    const rightLabel = right.year > 0 ? formatPeriodLabelWithYear(right.year, right.month, fiscalYearStartMonth, language) : '--';
    const leftValue = left.consumption > 0 ? `${left.consumption} m³` : '--';
    const rightValue = right.consumption > 0 ? `${right.consumption} m³` : '--';
    
    rows.push(`
      <tr>
        <td style="padding: 5px 10px; border: 1px solid #ddd;">${leftLabel}</td>
        <td style="padding: 5px 10px; border: 1px solid #ddd; text-align: right;">${leftValue}</td>
        <td style="padding: 5px 10px; border: 1px solid #ddd;${isLatest ? ' font-weight: bold;' : ''}">${rightLabel}</td>
        <td style="padding: 5px 10px; border: 1px solid #ddd; text-align: right;${isLatest ? ' font-weight: bold;' : ''}">${rightValue}</td>
      </tr>
    `);
  }
  
  return `
    <table style="border-collapse: collapse; font-size: 10pt; margin-top: 10px;">
      <caption style="background-color: #4472C4; color: #fff; padding: 5px 10px; font-size: 10pt; font-weight: bold; text-align: center; caption-side: top;">${title}</caption>
      <thead>
        <tr style="background-color: #f0f0f0;">
          <th style="padding: 5px 10px; border: 1px solid #ddd; text-align: left;">${monthHeader}</th>
          <th style="padding: 5px 10px; border: 1px solid #ddd; text-align: right;">${usageHeader}</th>
          <th style="padding: 5px 10px; border: 1px solid #ddd; text-align: left;">${monthHeader}</th>
          <th style="padding: 5px 10px; border: 1px solid #ddd; text-align: right;">${usageHeader}</th>
        </tr>
      </thead>
      <tbody>
        ${rows.join('')}
      </tbody>
    </table>
  `;
}

/**
 * Generate propane status table for email (email-compatible, no SVG)
 * @param {number} level - Tank level percentage (0-100)
 * @param {Object} thresholds - { critical: number, low: number }
 * @param {string} language - 'english' or 'spanish'
 * @returns {string} HTML table markup
 */
function generatePropaneTableHtml(level, thresholds, language) {
  const isSpanish = language === 'spanish' || language === 'es';
  const title = isSpanish ? 'NIVEL DEL TANQUE DE GAS' : 'PROPANE TANK LEVEL';
  const levelLabel = isSpanish ? 'Nivel Actual' : 'Current Level';
  const statusLabel = isSpanish ? 'Estado' : 'Status';
  
  // Determine status color and text
  let statusColor, statusText;
  if (level <= (thresholds?.critical || 10)) {
    statusColor = '#dc3545';
    statusText = isSpanish ? 'CRÍTICO' : 'CRITICAL';
  } else if (level <= (thresholds?.low || 30)) {
    statusColor = '#ffc107';
    statusText = isSpanish ? 'BAJO' : 'LOW';
  } else {
    statusColor = '#28a745';
    statusText = isSpanish ? 'BUENO' : 'GOOD';
  }
  
  return `
    <table style="border-collapse: collapse; font-size: 10pt; margin-top: 10px;">
      <caption style="background-color: #4472C4; color: #fff; padding: 5px 10px; font-size: 10pt; font-weight: bold; text-align: center; caption-side: top;">${title}</caption>
      <tbody>
        <tr>
          <td style="padding: 8px 15px; border: 1px solid #ddd; font-weight: bold;">${levelLabel}</td>
          <td style="padding: 8px 15px; border: 1px solid #ddd; text-align: center; font-size: 14pt; font-weight: bold;">${level}%</td>
        </tr>
        <tr>
          <td style="padding: 8px 15px; border: 1px solid #ddd; font-weight: bold;">${statusLabel}</td>
          <td style="padding: 8px 15px; border: 1px solid #ddd; text-align: center; font-weight: bold; color: ${statusColor};">${statusText}</td>
        </tr>
      </tbody>
    </table>
  `;
}

/**
 * Generate Statement data for a unit, including HTML, metadata and line items.
 * This is the primary entrypoint for building Statement of Account outputs.
 *
 * @param {Object} api - Axios API instance
 * @param {string} clientId - Client ID
 * @param {string} unitId - Unit ID
 * @param {Object} options - { fiscalYear, language }
 * @returns {{
 *   html: string,
 *   meta: { statementId: string, generatedAt: string, language: string },
 *   summary: Object,
 *   lineItems: Array
 * }}
 */
export async function generateStatementData(api, clientId, unitId, options = {}) {
  // Get statement data (language-agnostic - same data for both languages)
  const data = await getStatementData(api, clientId, unitId, options.fiscalYear);
  // Read responsive CSS file
  const cssPath = path.join(__dirname, '../templates/reports/reportCommon.css');
  const reportCommonCss = fs.readFileSync(cssPath, 'utf8');

  
  // Determine language and output format
  const language = options.language || 'english';
  const outputFormat = options.outputFormat || 'default';
  const generateBothLanguages = options.generateBothLanguages === true;
  
  // If generating both languages, build both HTMLs from the same data (data fetched once)
  if (generateBothLanguages) {
    return await generateBothLanguageStatements(data, reportCommonCss, options, clientId, unitId);
  }
  
  // Single language generation (uses same extracted HTML building function)
  const t = getTranslations(language);
  
  // Filter out future items for display
  const currentItems = data.lineItems.filter(item => item.isFuture !== true);
  
  // Get the actual closing balance from the last displayed transaction
  const actualClosingBalance = currentItems.length > 0 
    ? currentItems[currentItems.length - 1].balance 
    : data.summary.openingBalance;
  
  // Get account credit balance (separately tracked credits)
  const accountCreditBalance = data.creditInfo?.currentBalance || 0;
  
  // Calculate expiration date (30 days from statement date) using Luxon
  const statementDate = DateTime.fromISO(data.statementInfo.statementDate, { zone: 'America/Cancun' });
  const expirationDate = statementDate.plus({ days: 30 });
  
  // ============================================
  // NEXT PAYMENT DATE - Using pre-calculated value from UPC (Issue #144b)
  // ============================================
  // Rule 1: If balance > 0 TODAY → "NOW"
  // Rule 2: If balance <= 0 → use pre-calculated nextPaymentDueDate from UPC billsPaid
  // Rule 3: If no date available → "N/A"
  
  const closingBalance = data.summary?.closingBalance || 0;
  let nextPaymentDue = 'N/A';
  
  if (closingBalance > 0) {
    // Rule 1: Balance due > 0 TODAY → payment needed NOW
    nextPaymentDue = 'NOW';
  } else if (data.nextPaymentDueDate) {
    // Rule 2: Use pre-calculated date from UPC (first unpaid bill or next billing cycle)
    nextPaymentDue = formatDate(data.nextPaymentDueDate);
  }
  // Rule 3: If no nextPaymentDueDate, stays 'N/A'
  
  // Generate statement ID (clientId-unitId-fiscalYear-statementDate)
  const statementId = `${clientId}-${unitId}-${data.statementInfo.fiscalYear}-${data.statementInfo.statementDate.replace(/-/g, '')}`;
  
  // Get contact info from client governance
  const contactEmail = data.clientInfo.governance?.managementCompany?.email || 'admin@sandyland.com.mx';
  const contactPhone = data.clientInfo.governance?.managementCompany?.phone || '+52 984 206 4791';
  
  // Get current timestamp in Cancun timezone
  const generatedNow = getNow();
  const generatedTimestamp = DateTime.fromJSDate(generatedNow).setZone('America/Cancun');
  
  // Build HTML using extracted function (same as dual-language path)
  const html = buildHtmlContent(data, reportCommonCss, language, t, clientId, unitId, currentItems, actualClosingBalance, accountCreditBalance, expirationDate, nextPaymentDue, statementId, contactEmail, contactPhone, generatedTimestamp, outputFormat);
  
  // HTML is now built using buildHtmlContent() function (extracted and reusable)
  // The old ~1000 lines of inline HTML template have been removed - see buildHtmlContent() function below
  
  // Prepare email content metadata (all data needed for email generation)
  // This allows email endpoint to skip recalculation when data is already available
  const emailContent = {
    // Financial data
    balanceDue: actualClosingBalance,
    creditBalance: accountCreditBalance,
    netAmount: actualClosingBalance - accountCreditBalance,
    // Unit info
    unitNumber: unitId,
    ownerNames: data.unitInfo.owners.map(o => o.name).filter(Boolean).join(', ') || 'Owner',
    fiscalYear: data.statementInfo.fiscalYear,
    statementDate: data.statementInfo.statementDate,
    // Bank payment info
    bankName: data.clientInfo.bankAccountInfo?.bankName || '',
    bankAccount: data.clientInfo.bankAccountInfo?.accountNumber || data.clientInfo.bankAccountInfo?.account || '',
    bankClabe: data.clientInfo.bankAccountInfo?.clabe || '',
    beneficiary: data.clientInfo.bankAccountInfo?.beneficiary || data.clientInfo.bankAccountInfo?.accountName || '',
    reference: data.clientInfo.bankAccountInfo?.reference || '',
    // Client branding
    clientName: data.clientInfo.name,
    logoUrl: data.clientInfo.logoUrl || '',
    brandColor: data.clientInfo.branding?.primaryColor || data.clientInfo.branding?.brandColors?.primary || '#1a365d',
    contactEmail: contactEmail
  };

  return {
    html,
    meta: {
      statementId,
      generatedAt: generatedTimestamp.toFormat('dd MMM yyyy HH:mm'),
      language
    },
    summary: data.summary,
    // Expose the cleaned-up line items used for the statement table.
    // We return the same shape as statementData.lineItems but restricted
    // to the rows actually displayed (non-future items). This will be
    // useful for future exports and row-level drill-down without needing
    // to re-run the aggregation pipeline.
    lineItems: currentItems,
    // Email content metadata - all data needed for email generation
    // Allows email endpoint to skip recalculation when this data is available
    emailContent: emailContent
  };
}

/**
 * Generate both English and Spanish HTML statements from the same data
 * This avoids recalculation when both languages are needed (e.g., for email PDFs)
 * Returns only htmlEn/htmlEs (not redundant primary html) to save ~1/3 data transfer
 * @param {Object} data - Statement data from getStatementData (language-agnostic)
 * @param {string} reportCommonCss - CSS content
 * @param {Object} options - Options including fiscalYear
 * @returns {Promise<Object>} Object with htmlEn, htmlEs, metaEn, metaEs, summary, lineItems, emailContent
 */
async function generateBothLanguageStatements(data, reportCommonCss, options = {}, clientId, unitId) {
  // Generate English version
  const tEn = getTranslations('english');
  let resultEn;
  try {
    resultEn = await buildStatementHtml(data, reportCommonCss, 'english', options, tEn, clientId, unitId);
    console.log(`✅ English HTML generated: ${resultEn.html?.length || 0} chars`);
  } catch (error) {
    console.error(`❌ Error generating English HTML:`, error);
    throw error;
  }
  
  // Generate Spanish version
  const tEs = getTranslations('spanish');
  let resultEs;
  try {
    resultEs = await buildStatementHtml(data, reportCommonCss, 'spanish', options, tEs, clientId, unitId);
    console.log(`✅ Spanish HTML generated: ${resultEs.html?.length || 0} chars`);
    if (!resultEs.html || resultEs.html.length === 0) {
      console.error(`❌ Spanish HTML is empty! resultEs keys:`, Object.keys(resultEs || {}));
    }
  } catch (error) {
    console.error(`❌ Error generating Spanish HTML:`, error);
    throw error;
  }
  
  // Return both languages - frontend decides which to display
  // This saves ~1/3 of data transfer by not sending redundant primary html
  return {
    htmlEn: resultEn.html,     // English HTML
    htmlEs: resultEs.html,     // Spanish HTML
    metaEn: resultEn.meta,      // English meta
    metaEs: resultEs.meta,      // Spanish meta
    summary: data.summary,
    lineItems: resultEn.lineItems,  // Same for both languages
    emailContent: resultEn.emailContent  // Same for both languages
  };
}

/**
 * Build statement HTML for a specific language
 * Extracted from generateStatementData to allow reuse for both languages
 * Uses the same data object, only language/translations differ
 */
async function buildStatementHtml(data, reportCommonCss, language, options, t, clientId, unitId) {
  const outputFormat = options.outputFormat || 'default';
  
  // Filter out future items for display
  const currentItems = data.lineItems.filter(item => item.isFuture !== true);
  
  // Get the actual closing balance from the last displayed transaction
  const actualClosingBalance = currentItems.length > 0 
    ? currentItems[currentItems.length - 1].balance 
    : data.summary.openingBalance;
  
  // Get account credit balance (separately tracked credits)
  const accountCreditBalance = data.creditInfo?.currentBalance || 0;
  
  // Calculate expiration date (30 days from statement date) using Luxon
  const statementDate = DateTime.fromISO(data.statementInfo.statementDate, { zone: 'America/Cancun' });
  const expirationDate = statementDate.plus({ days: 30 });
  
  // ============================================
  // NEXT PAYMENT DATE - Using pre-calculated value from UPC (Issue #144b)
  // ============================================
  // Rule 1: If balance > 0 TODAY → "NOW"
  // Rule 2: If balance <= 0 → use pre-calculated nextPaymentDueDate from UPC billsPaid
  // Rule 3: If no date available → "N/A"
  
  const closingBalance = data.summary?.closingBalance || 0;
  let nextPaymentDue = 'N/A';
  
  if (closingBalance > 0) {
    // Rule 1: Balance due > 0 TODAY → payment needed NOW
    nextPaymentDue = 'NOW';
  } else if (data.nextPaymentDueDate) {
    // Rule 2: Use pre-calculated date from UPC (first unpaid bill or next billing cycle)
    nextPaymentDue = formatDate(data.nextPaymentDueDate);
  }
  // Rule 3: If no nextPaymentDueDate, stays 'N/A'
  
  // Generate statement ID and timestamp
  const statementId = `${clientId}-${unitId}-${data.statementInfo.fiscalYear}-${data.statementInfo.statementDate.replace(/-/g, '')}`;
  const generatedNow = getNow();
  const generatedTimestamp = DateTime.fromJSDate(generatedNow).setZone('America/Cancun');
  
  // Get contact info from client governance
  const contactEmail = data.clientInfo.governance?.managementCompany?.email || 'admin@sandyland.com.mx';
  const contactPhone = data.clientInfo.governance?.managementCompany?.phone || '+52 984 206 4791';
  
  // Build HTML (extracted template building logic)
  const html = buildHtmlContent(data, reportCommonCss, language, t, clientId, unitId, currentItems, actualClosingBalance, accountCreditBalance, expirationDate, nextPaymentDue, statementId, contactEmail, contactPhone, generatedTimestamp, outputFormat);
  
  // Prepare email content metadata (same for both languages - data is language-agnostic)
  const emailContent = {
    // Financial data
    balanceDue: actualClosingBalance,
    creditBalance: accountCreditBalance,
    netAmount: actualClosingBalance - accountCreditBalance,
    // Unit info
    unitNumber: unitId,
    ownerNames: data.unitInfo.owners.map(o => o.name).filter(Boolean).join(', ') || 'Owner',
    fiscalYear: data.statementInfo.fiscalYear,
    statementDate: data.statementInfo.statementDate,
    // Bank payment info
    bankName: data.clientInfo.bankAccountInfo?.bankName || '',
    bankAccount: data.clientInfo.bankAccountInfo?.accountNumber || data.clientInfo.bankAccountInfo?.account || '',
    bankClabe: data.clientInfo.bankAccountInfo?.clabe || '',
    beneficiary: data.clientInfo.bankAccountInfo?.beneficiary || data.clientInfo.bankAccountInfo?.accountName || '',
    reference: data.clientInfo.bankAccountInfo?.reference || '',
    // Client branding
    clientName: data.clientInfo.name,
    logoUrl: data.clientInfo.logoUrl || '',
    brandColor: data.clientInfo.branding?.primaryColor || data.clientInfo.branding?.brandColors?.primary || '#1a365d',
    contactEmail: contactEmail
  };
  
  return {
    html,
    meta: {
      statementId,
      generatedAt: generatedTimestamp.toFormat('dd MMM yyyy HH:mm'),
      language
    },
    lineItems: currentItems,
    emailContent
  };
}

/**
 * Build the actual HTML content (extracted from original function)
 * This is the complete HTML template - same data, different language/translations
 */
function buildHtmlContent(data, reportCommonCss, language, t, clientId, unitId, currentItems, actualClosingBalance, accountCreditBalance, expirationDate, nextPaymentDue, statementId, contactEmail, contactPhone, generatedTimestamp, outputFormat) {
  const statementDate = DateTime.fromISO(data.statementInfo.statementDate, { zone: 'America/Cancun' });
  
  // This is the complete HTML template extracted from the original generateStatementData function
  // It uses the same data object but different translations (t) based on language
  return `<!DOCTYPE html>
<html lang="${language === 'spanish' ? 'es' : 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="format-detection" content="telephone=no">
  <title>${t.title} - ${data.clientInfo.name} - ${t.unit} ${unitId}</title>
  <style>
    /* Reset and base styles */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      color: #000;
      background: #fff;
      padding: 0.5in 0.6in 0.4in 0.6in;
    }
    
    /* Page layout */
    .statement-page {
      max-width: 8.5in;
      margin: 0 auto;
      padding-bottom: 0;
    }

    .content-bottom-spacer {
      height: 0;
      clear: both;
      display: none;
    }
    
    /* Header section */
    .statement-header {
      margin-bottom: 20px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 340px);
      column-gap: 20px;
      align-items: start;
      grid-auto-rows: min-content;
    }
    
    .header-left,
    .header-right {
      width: 100%;
    }
    
    .header-left {
      text-align: left;
    }
    
    .statement-title {
      font-size: 18pt;
      font-weight: bold;
      margin-bottom: 12px;
      text-transform: uppercase;
      grid-column: 1 / span 2;
    }
    
    .client-info {
      font-size: 10pt;
      line-height: 1.5;
      margin-top: -2px;
    }
    
    .client-info .owner-name {
      font-size: 12pt;
      font-weight: bold;
      margin-bottom: 8px;
    }
    
    .client-info-table {
      border-collapse: collapse;
      width: 100%;
      margin-top: 55px;
    }
    
    .client-info-table td {
      padding: 2px 0;
      vertical-align: top;
    }
    
    .client-info-table td:first-child {
      font-weight: bold;
      width: 105px;
      padding-right: 4px;
    }
    
    .header-right {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      padding-right: 0;
      justify-self: start;
      box-sizing: border-box;
      max-width: 340px;
      width: 100%;
      margin-top: 5px;
    }
    
    .logo-top {
      margin: -4px 0 6px auto;
      padding: 0;
      align-self: flex-end;
    }
    
    .logo-top img {
      max-width: 200px;
      max-height: 95px;
      height: auto;
      display: block;
      padding-top: 2px;
    }
    
    .logo-right {
      text-align: right;
    }
    
    .banking-info {
      border: 1px solid #000;
      padding: 8px 10px;
      background: #f5f5f5;
      text-align: left;
      margin-top: 6px;
      width: 100%;
      box-sizing: border-box;
    }
    
    .banking-info h3 {
      font-size: 9pt;
      font-weight: bold;
      margin-bottom: 3px;
      text-align: center;
    }
    
    .banking-info table {
      width: 100%;
      font-size: 8pt;
      line-height: 1.25;
      border-collapse: collapse;
    }
    
    .banking-info td {
      padding: 2px 4px;
      vertical-align: top;
    }
    
    .banking-info td:first-child {
      font-weight: bold;
      width: 32%;
      white-space: nowrap;
    }
    
    /* Transaction tables */
    .section-header {
      background-color: #4472C4;
      color: #fff;
      padding: 5px 10px;
    }
    
    .projects-section .section-header {
      margin: -10px -10px 10px -10px;
      border-radius: 2px 2px 0 0;
      padding: 8px 12px;
      font-size: 10pt;
      font-weight: bold;
      text-align: center;
      margin: 15px 0 5px 0;
    }
    
    .transaction-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 2px;
      font-size: 9pt;
    }
    
    .transaction-table thead {
      background-color: #4472C4;
      color: #fff;
    }
    
    .transaction-table th {
      padding: 5px 4px;
      text-align: center;
      font-size: 8pt;
      font-weight: bold;
      border: 1px solid #fff;
    }
    
    .transaction-table td {
      padding: 4px;
      border: 1px solid #ddd;
      font-size: 9pt;
    }
    
    .transaction-table tbody tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    
    /* Column alignments (5 columns - single table format) */
    .col-date { text-align: center; width: 12%; }
    .col-description { text-align: left; width: 50%; }
    .col-charge { text-align: right; width: 13%; }
    .col-payment { text-align: right; width: 13%; }
    .col-balance { text-align: right; width: 12%; font-weight: bold; }
    
    /* Payment amounts in red (only in table body, not header) */
    .transaction-table tbody .payment-red {
      color: #C00000;
      font-weight: bold;
    }
    
    /* Payment amounts in red */
    .payment-red {
      color: #C00000;
      font-weight: bold;
    }
    
    /* Balance due box (appears right after transaction table) */
    .balance-due-box {
      margin: 0;
      text-align: right;
    }
    
    .balance-due-box table {
      float: right;
      border: 2px solid #000;
      background-color: #fff;
    }
    
    .balance-due-box td {
      padding: 3px 15px;
      font-weight: bold;
      font-size: 11pt;
    }
    
    .balance-due-box td:first-child {
      text-align: right;
      padding-right: 20px;
    }
    
    .balance-due-box td:last-child {
      text-align: right;
      min-width: 120px;
    }
    
    .balance-due-box .account-credit-row {
      background-color: #e8f5e9;
      border-top: 1px solid #4CAF50;
    }
    
    .balance-due-box .account-credit-row td {
      color: #2E7D32;
    }
    
    /* Allocation summary table */
    .allocation-graph-row {
      display: flex;
      gap: 20px;
      margin: 20px 0;
      align-items: flex-start;
    }
    
    .allocation-summary {
      flex: 1;
      margin: 0;
      clear: none;
    }
    
    .allocation-summary h3 {
      background-color: #4472C4;
      color: #fff;
      padding: 5px 10px;
      font-size: 10pt;
      font-weight: bold;
      text-align: center;
      margin: 0 0 0 0;
      display: table-caption;
      width: auto;
    }
    
    .mini-graph-container {
      flex: 0 0 auto;
      padding: 0;
      background: transparent;
      border: none;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-width: 385px;
      max-width: 410px;
      margin-top: -5px;
    }
    
    .allocation-table {
      width: auto;
      max-width: 600px;
      border-collapse: collapse;
      font-size: 9pt;
      margin-bottom: 15px;
    }
    
    .allocation-table th {
      background-color: #f5f5f5;
      padding: 5px 8px;
      border: 1px solid #ddd;
      font-weight: bold;
      text-align: left;
    }
    
    .allocation-table td {
      padding: 5px 8px;
      border: 1px solid #ddd;
    }
    
    .allocation-table .col-category { min-width: 150px; text-align: left; }
    .allocation-table .col-charges { text-align: right; min-width: 100px; }
    .allocation-table .col-penalties { text-align: right; min-width: 100px; }
    .allocation-table .col-total-paid { text-align: right; min-width: 100px; }
    
    .allocation-table .totals-row {
      background-color: #e8f0fe;
      font-weight: bold;
    }
    
    /* Total balance */
    .total-balance {
      margin: 20px 0;
      text-align: right;
    }
    
    .total-balance table {
      float: right;
      border: 2px solid #000;
    }
    
    .total-balance td {
      padding: 10px 15px;
      font-weight: bold;
      font-size: 12pt;
    }
    
    .total-balance td:first-child {
      text-align: right;
    }
    
    .total-balance td:last-child {
      text-align: right;
      min-width: 120px;
    }
    
    /* Footer */
    .payment-terms {
      margin-top: 0;
      font-size: 8pt;
      line-height: 1.5;
      clear: both;
      border-top: 1px solid #ddd;
      padding-top: 5px;
    }
    
    .payment-terms p {
      margin-bottom: 8px;
    }
    
    .statement-footer {
      margin-top: 0;
      padding-top: 2px;
      padding-bottom: 2px;
      border-top: 2px solid #000;
      font-size: 8pt;
      color: #333;
      clear: both;
    }
    
    .statement-footer .footer-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
      gap: 15px;
      line-height: 1.2;
    }
    
    .statement-footer .footer-row > div {
      flex: 1;
      white-space: nowrap;
      overflow: visible;
    }
    
    .statement-footer .footer-row > div:first-child {
      text-align: left;
      flex: 1.5;
    }
    
    .statement-footer .footer-row > div:nth-child(2) {
      text-align: center;
      flex: 0.8;
    }
    
    .statement-footer .footer-row > div:last-child {
      text-align: right;
      flex: 1.2;
    }
    
    .statement-footer .footer-center {
      text-align: center;
      margin-top: 5px;
      font-size: 7pt;
      font-style: italic;
      line-height: 1.3;
    }
    
    /* PDFShift footers come from pdfService footer.html */
    
    /* Print styles */
    @media print {
      body {
        padding: 0;
        margin: 0;
      }
      
      .statement-page {
        max-width: none;
        padding: 0;
        margin: 0;
        padding-bottom: 0.1in;
      }
      
      /* Hide legacy footer row (replaced by PDFShift footer) */
      .statement-footer .footer-row {
        display: none !important;
      }
      
      .statement-footer {
        margin-top: 5px;
      }
      .statement-header,
      .banking-info,
      .client-info-table {
      }
      
      .balance-due-box {
      }
      
      .allocation-graph-row {
        page-break-inside: avoid;
      }
      
      .allocation-summary {
      }
      
      .mini-graph-container {
        background: transparent;
        border: none;
      }
      
      .transaction-table {
      }
      
      .transaction-table thead {
        display: table-header-group;
      }
      
      .transaction-table tr {
      }
      
      .transaction-table tbody tr {
      }
      
      .allocation-table,
      .allocation-table tbody {
        page-break-inside: avoid;
      }
      
      .payment-terms {
        page-break-inside: avoid;
      }
      
      .projects-section {
        page-break-inside: avoid;
      }
      
      .credit-activity-section {
        page-break-inside: avoid;
      }
    }
    
    /* Projects Section */
    .projects-section {
      margin: 20px 0;
      clear: both;
      border: 2px solid #4472C4;
      border-radius: 4px;
      padding: 10px;
      background-color: #fafafa;
    }
    
    /* Credit Balance Activity Section */
    .credit-activity-section {
      margin: 20px 0;
      clear: both;
      border: 2px solid #F7E4C2;
      border-radius: 4px;
      padding: 10px;
      background-color: #fefbf7;
    }
    
    .project-table {
      border: 1px solid #ddd;
      margin-bottom: 15px;
    }
    
    .project-header {
      background-color: #4472C4;
      color: #fff;
      padding: 8px 12px;
    }
    
    .project-name {
      font-size: 11pt;
      font-weight: bold;
      margin-bottom: 3px;
    }
    
    .project-meta {
      font-size: 8pt;
    }
    
    .project-assessment {
      background-color: #e8f0fe;
      padding: 6px 12px;
      font-weight: bold;
      font-size: 10pt;
      border-bottom: 1px solid #ddd;
    }
    
    .project-collections {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
    }
    
    .project-collections th {
      background-color: #f5f5f5;
      padding: 4px 8px;
      border: 1px solid #ddd;
      text-align: left;
      font-size: 8pt;
    }
    
    .project-collections td {
      padding: 4px 8px;
      border: 1px solid #ddd;
    }
    
    .project-collections .col-date { width: 15%; text-align: center; }
    .project-collections .col-amount { width: 15%; text-align: right; }
    .project-collections .col-notes { width: 70%; }
    
    .project-summary {
      background-color: #f9f9f9;
      padding: 6px 12px;
      display: flex;
      justify-content: flex-end;
      gap: 30px;
      font-weight: bold;
      font-size: 9pt;
      border-top: 1px solid #ddd;
    }
    
    .projects-total {
      background-color: #4472C4;
      color: #fff;
      padding: 8px 12px;
      font-weight: bold;
      font-size: 10pt;
      text-align: center;
      margin-top: 10px;
      border-radius: 0 0 2px 2px;
    }
    
    .credit-activity-section .section-header {
      background-color: #F7E4C2;
      color: #333;
      padding: 8px 12px;
      font-weight: bold;
      font-size: 10pt;
      margin: -10px -10px 10px -10px;
      border-radius: 2px 2px 0 0;
      text-align: center;
    }
    
    /* Credit Activity Table */
    .credit-activity-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 9pt;
      background-color: #fff;
    }
    
    .credit-activity-table thead {
      background-color: #F7E4C2;
      color: #333;
    }
    
    .credit-activity-table th {
      padding: 8px 12px;
      text-align: left;
      font-weight: bold;
      font-size: 9pt;
    }
    
    .credit-activity-table td {
      padding: 6px 12px;
      border-bottom: 1px solid #ddd;
    }
    
    .credit-activity-table tbody tr:last-child td {
      border-bottom: none;
    }
    
    .credit-activity-table .col-date {
      width: 12%;
    }
    
    .credit-activity-table .col-type {
      width: 20%;
    }
    
    .credit-activity-table .col-amount {
      width: 15%;
      text-align: right;
    }
    
    .credit-activity-table .col-notes {
      width: 53%;
    }
    
    .credit-activity-table .amount-deposit {
      color: #2E7D32;
      font-weight: 500;
    }
    
    .credit-activity-table .amount-applied {
      color: #C62828;
      font-weight: 500;
    }
    
    /* Additional PDF-specific optimizations */
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    /* =====================================================
       Responsive Report Common CSS (from reportCommon.css)
       ===================================================== */
    ${reportCommonCss}
  </style>
</head>
<body>
  <div class="report-container statement-page">
    <!-- Header -->
    <div class="report-header statement-header">
      <!-- Left side: Title and Client Info -->
      <div class="header-left">
        <div class="statement-title">${t.title}</div>
        
        <div class="client-info">
          <div class="owner-name">${t.unit} ${unitId} - ${joinOwnerNames(data.unitInfo.owners)}</div>
          
          <table class="client-info-table">
            <tr>
              <td>${t.address}:</td>
              <td>${(() => {
                const addr = data.clientInfo.address || '';
                const commaIndex = addr.indexOf(',');
                if (commaIndex > 0) {
                  const street = addr.substring(0, commaIndex);
                  const rest = addr.substring(commaIndex + 1).trim();
                  return street + '<br>' + rest;
                }
                return addr;
              })()}</td>
            </tr>
            <tr>
              <td colspan="2" style="height: 5px;"></td>
            </tr>
            <tr>
              <td>${t.period}:</td>
              <td>${data.statementInfo.periodCovered}</td>
            </tr>
            <tr>
              <td>${t.date}:</td>
              <td>${statementDate.toFormat('dd MMM yyyy')}</td>
            </tr>
            ${nextPaymentDue !== 'N/A' ? `
            <tr>
              <td>${t.nextPaymentDue}:</td>
              <td>${nextPaymentDue}</td>
            </tr>
            ` : ''}
          </table>
        </div>
      </div>
      
      <!-- Right side: Logo + Banking Info -->
      <div class="header-right">
        <div class="logo-top logo-right">
          ${data.clientInfo.logoUrl 
            ? `<img src="${data.clientInfo.logoUrl}" alt="${data.clientInfo.name}">`
            : `<div style="font-size: 12pt; font-weight: bold;">${data.clientInfo.name}</div>`
          }
        </div>
        
        <div class="banking-info">
          <h3>${t.bankingInfo}</h3>
          <table>
            <tr>
              <td>${t.bank}:</td>
              <td>${data.clientInfo.bankAccountInfo.bankName}</td>
            </tr>
            <tr>
              <td>${t.account}:</td>
              <td>${data.clientInfo.bankAccountInfo.accountNumber}</td>
            </tr>
            <tr>
              <td>${t.clabe}:</td>
              <td>${data.clientInfo.bankAccountInfo.clabe}</td>
            </tr>
            <tr>
              <td>${t.beneficiary}:</td>
              <td>${data.clientInfo.bankAccountInfo.accountName}</td>
            </tr>
            <tr>
              <td>${t.reference}:</td>
              <td>${data.clientInfo.bankAccountInfo.reference}</td>
            </tr>
          </table>
        </div>
      </div>
    </div>
    
    <!-- Section divider -->
    <div style="border-top: 2px solid #000; margin: 20px 0 15px 0;"></div>
    
    <!-- Account Activity Section -->
    <div class="section-header">${t.accountActivity}</div>
    <div class="report-table-container"><table class="report-table transaction-table">
      <thead>
        <tr>
          <th class="col-date">${t.tableHeaders.date}</th>
          <th class="col-description">${t.tableHeaders.description}</th>
          <th class="col-charge">${t.tableHeaders.charge}</th>
          <th class="col-payment">${t.tableHeaders.payment}</th>
          <th class="col-balance">${t.tableHeaders.balance}</th>
        </tr>
      </thead>
      <tbody>
        <!-- Opening Balance Row -->
        <tr style="background-color: #f9f9f9;">
          <td class="col-date"></td>
          <td class="col-description" style="font-style: italic;">${t.openingBalance}</td>
          <td class="col-charge amount"></td>
          <td class="col-payment amount"></td>
          <td class="col-balance amount">${formatCurrency(data.summary.openingBalance)}</td>
        </tr>
        
        <!-- All Transaction Rows -->
        ${currentItems.map(item => {
          const isAdjustment = item.isStandaloneCredit;
          const chargeValue = item.charge;
          const showCharge = !isAdjustment && item.charge > 0;
          const showPayment = item.payment !== 0;
          return `
        <tr class="${isAdjustment ? 'credit-adjustment-row' : 'clickable'}" data-transaction-id="${item.transactionId || ''}">
          <td class="col-date">${formatDate(item.date)}</td>
          <td class="col-description ${isAdjustment ? 'credit-adjustment-text' : ''}">${translateDescription(item.description, language)}</td>
          <td class="col-charge amount">${showCharge ? formatCurrency(chargeValue) : ''}</td>
          <td class="col-payment amount ${showPayment && item.payment > 0 ? 'payment-red' : ''}">${showPayment ? formatCurrency(item.payment) : ''}</td>
          <td class="col-balance amount">${formatCurrency(item.balance)}</td>
        </tr>`;
        }).join('')}
      </tbody>
    </table>
    </div>
    
    <!-- Balance Due (final Statement balance) -->
    <div class="balance-due-box">
      <table>
        ${actualClosingBalance > 0 ? `
        <tr>
          <td>${t.balanceDue}</td>
          <td>${formatCurrency(actualClosingBalance)}</td>
        </tr>
        ` : `
        <tr>
          <td colspan="2" style="text-align: center;">${t.paidInFull}</td>
        </tr>
        `}
      </table>
    </div>
    
    <!-- Spacer before Allocation Summary -->
    <div style="height: 20px; clear: both;"></div>
    
    <!-- Allocation Summary with Mini Graph -->
    <div class="allocation-graph-row">
      <div class="allocation-summary">
        <table class="allocation-table">
          <caption style="background-color: #4472C4; color: #fff; padding: 5px 10px; font-size: 10pt; font-weight: bold; text-align: center; caption-side: top;">${t.allocationSummary}</caption>
          <thead>
            <tr>
              <th class="col-category">${t.category}</th>
              <th class="col-charges">${t.charges}</th>
              <th class="col-penalties">${t.penalties}</th>
            </tr>
          </thead>
          <tbody>
            ${data.allocationSummary.categories.map(cat => `
            <tr>
              <td class="col-category">${cat.name}</td>
              <td class="col-charges">${cat.charges > 0 ? formatCurrency(cat.charges) : ''}</td>
              <td class="col-penalties">${cat.penalties > 0 ? formatCurrency(cat.penalties) : ''}</td>
            </tr>
            `).join('')}
            
            <tr class="totals-row">
              <td class="col-category">${t.totals}</td>
              <td class="col-charges">${formatCurrency(data.allocationSummary.totals.charges)}</td>
              <td class="col-penalties">${formatCurrency(data.allocationSummary.totals.penalties)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      ${data.utilityGraph ? `
      <div class="mini-graph-container">
        ${outputFormat === 'email'
          ? (data.utilityGraph.type === 'propane-gauge' 
              ? generatePropaneTableHtml(data.utilityGraph.level, data.utilityGraph.thresholds, language)
              : generateWaterTableHtml(data.utilityGraph.periods, language))
          : (data.utilityGraph.type === 'propane-gauge' 
              ? generatePropaneGaugeSvg(data.utilityGraph.level, data.utilityGraph.thresholds, language)
              : generateWaterBarsSvg(data.utilityGraph.periods, language))
        }
      </div>
      ` : ''}
    </div>
    
    ${data.projectsData?.hasProjects ? `
    <!-- Special Assessments / Projects Section -->
    <div class="projects-section">
      <div class="section-header">${t.specialAssessments}</div>
      
      ${data.projectsData.projects.map(project => `
        <div class="project-table">
          <div class="project-header">
            <div class="project-name">${project.name}</div>
            <div class="project-meta">
              ${t.projectPeriod}: ${formatDateRange(project.startDate, project.completionDate)} │ 
              ${t.projectStatus}: ${capitalizeStatus(project.status)} │ 
              ${t.projectBudget}: ${formatCurrency(centavosToPesos(project.totalBudget))}
            </div>
          </div>
          
          <div class="project-assessment">
            ${t.yourAssessment}: ${formatCurrency(centavosToPesos(project.assessment))}
          </div>
          
          <table class="project-collections">
            <thead>
              <tr>
                <th class="col-date">${t.tableHeaders.date}</th>
                <th class="col-amount">${t.tableHeaders.charge}</th>
                <th class="col-notes">${t.tableHeaders.description}</th>
              </tr>
            </thead>
            <tbody>
              ${project.collections.map(c => {
                let collectionDate = '';
                if (c.date && typeof c.date.toDate === 'function') {
                  collectionDate = formatDate(c.date.toDate());
                } else if (c.date instanceof Date) {
                  collectionDate = formatDate(c.date);
                } else if (typeof c.date === 'string') {
                  collectionDate = formatDate(c.date);
                }
                
                return `
                <tr class="clickable" data-transaction-id="${c.id || c.transactionId || ''}">
                  <td class="col-date">${collectionDate}</td>
                  <td class="col-amount">${formatCurrency(centavosToPesos(c.amount))}</td>
                  <td class="col-notes">${c.notes || ''}</td>
                </tr>
              `;
              }).join('')}
            </tbody>
          </table>
          
          <div class="project-summary">
            <span>PAID: ${formatCurrency(centavosToPesos(project.totalPaid))}</span>
            <span>BALANCE: ${formatCurrency(centavosToPesos(project.balance))} ${project.balance <= 0 ? '✅' : '⚠️'}</span>
          </div>
        </div>
      `).join('')}
      
      <div class="projects-total">
        ${t.totalSpecialAssessments} (${data.statementInfo.fiscalYear}): 
        ${formatCurrency(centavosToPesos(data.projectsData.totalPaid))}
      </div>
    </div>
` : ''}
    
    ${data.creditActivity?.hasEntries ? `
    <!-- Credit Balance Activity Section -->
    <div class="credit-activity-section">
      <div class="section-header">${t.creditBalanceActivity}</div>
      
      ${(() => {
        const collapsedEntries = collapseCreditEntries(data.creditActivity.entries);
        
        if (collapsedEntries.length === 0) {
          return '';
        }
        
        return `
        <table class="credit-activity-table">
          <thead>
            <tr>
              <th class="col-date">${t.creditDate}</th>
              <th class="col-type">${t.creditType}</th>
              <th class="col-amount">${t.creditAmount}</th>
              <th class="col-notes">${t.creditNotes}</th>
            </tr>
          </thead>
          <tbody>
            ${collapsedEntries.map(entry => {
              const entryDate = formatDate(entry.date);
              const amount = entry.amount || 0;
              const entryType = entry.type && entry.type !== 'undefined' 
                ? entry.type 
                : (amount >= 0 ? 'credit_added' : 'credit_used');
              const typeLabel = getCreditTypeLabel(entryType, entry.count || 1, language, amount);
              const isDeposit = entryType === 'credit_added';
              const amountClass = isDeposit ? 'amount-deposit' : 'amount-applied';
              const formattedAmount = isDeposit 
                ? formatCurrency(Math.abs(amount), true)
                : formatCurrency(amount);
              
              let notes = entry.notes || '';
              if (notes.length > 60) {
                notes = notes.substring(0, 57) + '...';
              }
              
              return `
              <tr>
                <td class="col-date">${entryDate}</td>
                <td class="col-type">${typeLabel}</td>
                <td class="col-amount ${amountClass}">${formattedAmount}</td>
                <td class="col-notes">${notes}</td>
              </tr>
            `;
            }).join('')}
          </tbody>
        </table>
        `;
      })()}
    </div>
` : ''}
    
    <!-- Footer - Payment Terms -->
    ${(() => {
      const langKey = language === 'spanish' || language === 'es' ? 'es' : 'en';
      const footerText = data.clientInfo.accountStatementsConfig?.statementFooter?.[langKey];
      
      if (!footerText || footerText.trim() === '') {
        return '<div class="payment-terms"></div>';
      }
      
      const lines = footerText.split(/\n/).filter(line => line.trim() !== '');
      const hasBullets = lines.some(line => {
        const trimmed = line.trim();
        return trimmed.startsWith('●') || trimmed.startsWith('◦');
      });
      
      if (hasBullets) {
        return `<div class="payment-terms">
          <ul style="list-style-type: disc; padding-left: 20px; margin: 0;">
            ${lines.map(line => {
              const trimmed = line.trim();
              let text = trimmed;
              if (trimmed.startsWith('●')) {
                text = trimmed.substring(1).trim();
              } else if (trimmed.startsWith('◦')) {
                text = trimmed.substring(1).trim();
              }
              return `<li style="margin-bottom: 4px;">${text}</li>`;
            }).join('\n            ')}
          </ul>
        </div>`;
      } else {
        const paragraphs = footerText.split(/\n\n+/).filter(p => p.trim() !== '');
        return `<div class="payment-terms">
          ${paragraphs.map(p => `<p>${p.trim()}</p>`).join('\n          ')}
        </div>`;
      }
    })()}
    
    <!-- Statement Footer -->
    <div class="content-bottom-spacer"></div>
    <div class="statement-footer">
      <div class="footer-row">
        <div>${t.statementId}: ${statementId}</div>
        <div>${t.pageOf} 1 of 1</div>
        <div>${t.generatedOn}: ${generatedTimestamp.toFormat('dd MMM yyyy HH:mm')}</div>
      </div>
      <div class="footer-center">
        ${t.questionsContact
          .replace('{name}', data.clientInfo.governance.managementCompany.name)
          .replace('{email}', contactEmail)
          .replace('{phone}', contactPhone)}
      </div>
      <div class="footer-center">
        ${t.confidentialNotice}
      </div>
    </div>
  </div>
</body>
</html>`;
}
