/**
 * Water Bills Email Template Variables
 * Built from real AVII Firebase data structure - GAAP Compliant
 * 
 * Phase 1: Firebase Data Integration
 * Uses SAMS timezone and currency utilities for accurate data handling
 * 
 * CRITICAL: Uses existing SAMS utilities to prevent timezone/currency errors:
 * - timezone.js: America/Cancun timezone handling
 * - databaseFieldMappings.js: Centavos to pesos conversion
 * - fiscalYearUtils.js: Fiscal year period calculations
 */

// Import Firebase for previous month data fetching
import { getDb } from '../../firebase.js';
import { getNow } from '../../services/DateService.js';

// Backend-compatible utility functions (replicate frontend functionality)
// Using simplified versions to avoid frontend/backend cross-imports

/**
 * Get Mexico timezone date from input - backend version
 * @param {string|Date} dateInput - Date input
 * @returns {Date} Date object
 */
function getMexicoDateTime(dateInput) {
  if (!dateInput) {
    return getNow();
  }
  
  if (typeof dateInput === 'string') {
    return new Date(dateInput + 'T12:00:00');
  }
  
  if (dateInput instanceof Date) {
    return dateInput;
  }
  
  return new Date(dateInput);
}

/**
 * Format currency from centavos to pesos - backend version
 * @param {number} centavos - Amount in centavos
 * @param {string} currency - Currency code
 * @param {boolean} showCents - Whether to show cents
 * @returns {string} Formatted currency string
 */
function formatCurrency(centavos, currency = 'MXN', showCents = true) {
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
 * Calculate previous billing period from current period
 * @param {string} currentPeriod - Current billing period (e.g., "2026-01")
 * @returns {string|null} Previous billing period (e.g., "2026-00") or null if invalid
 */
function getPreviousPeriod(currentPeriod) {
  if (!currentPeriod || typeof currentPeriod !== 'string') {
    return null;
  }
  
  const parts = currentPeriod.split('-');
  if (parts.length !== 2) {
    return null;
  }
  
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  
  if (isNaN(year) || isNaN(month)) {
    return null;
  }
  
  if (month === 0) {
    // January, go to December of previous year
    return `${year - 1}-11`;
  } else {
    // Go to previous month
    return `${year}-${String(month - 1).padStart(2, '0')}`;
  }
}

/**
 * Build template variables from real Firebase water bills data
 * CRITICAL: NO FALLBACK VALUES for financial data - GAAP compliance required
 * @param {Object} billDocument - Complete bill document from Firebase (clients/AVII/projects/waterBills/bills/2026-00)
 * @param {Object} readingsDocument - Readings document from Firebase (clients/AVII/projects/waterBills/readings/2026-00) 
 * @param {Object} clientConfig - Client configuration from Firebase
 * @param {Object} waterBillConfig - Water bill configuration (clients/AVII/config/waterBills)
 * @param {string} unitNumber - Unit number for this bill
 * @param {string} userLanguage - User's preferred language ('en' or 'es')
 * @param {string} currentPeriodId - Current period ID (e.g., "2026-01") - used for previous month lookup
 * @returns {Object} Template variables for email processing
 * @throws {Error} If required financial data is missing
 */
async function buildWaterBillTemplateVariables(billDocument, readingsDocument, clientConfig, waterBillConfig, unitNumber, userLanguage = 'en', currentPeriodId = null) {
  // Validate required parameters exist
  validateRequiredData(billDocument, readingsDocument, clientConfig, waterBillConfig, unitNumber);

  // Get unit data from bill document
  const unitData = billDocument.bills?.units?.[unitNumber];
  if (!unitData) {
    throw new Error(`Unit ${unitNumber} not found in bill document`);
  }

  // Use configSnapshot from bill document (frozen at bill generation time)
  const configSnapshot = billDocument.configSnapshot;
  if (!configSnapshot) {
    throw new Error('Bill document missing required configSnapshot');
  }

  // Currency formatting using backend utility - MUST USE THIS
  const formatCurrencyLocal = (centavos) => {
    if (typeof centavos !== 'number') {
      throw new Error(`Invalid currency amount: ${centavos}. Must be numeric value in centavos.`);
    }
    return formatCurrency(centavos, configSnapshot.currency, true);
  };

  // Date formatting using backend timezone utility - MUST USE THIS
  const formatDate = (dateStr, locale = 'en-US') => {
    if (!dateStr) {
      throw new Error('Date is required but was not provided');
    }
    // Use backend timezone utility to handle America/Cancun timezone properly
    const date = getMexicoDateTime(dateStr);
    if (!date || isNaN(date.getTime())) {
      throw new Error(`Invalid date provided: ${dateStr}`);
    }
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      timeZone: 'America/Cancun' // Ensure proper timezone display
    });
  };

  // Extract and validate unit data - no defaults for financial data
  const {
    priorReading,
    currentReading,
    consumption,
    carWashCount = 0, // Service counts can default to 0
    boatWashCount = 0,
    waterCharge,
    carWashCharge = 0,
    boatWashCharge = 0,
    currentCharge,
    penaltyAmount = 0, // Penalties can default to 0 if none applied
    totalAmount,
    status,
    billNotes
  } = unitData;

  // Validate critical financial data exists
  if (typeof priorReading !== 'number' || typeof currentReading !== 'number') {
    throw new Error(`Unit ${unitNumber}: Missing or invalid meter readings`);
  }
  if (typeof consumption !== 'number' || typeof waterCharge !== 'number') {
    throw new Error(`Unit ${unitNumber}: Missing or invalid water consumption data`);
  }
  if (typeof currentCharge !== 'number' || typeof totalAmount !== 'number') {
    throw new Error(`Unit ${unitNumber}: Missing or invalid billing amounts`);
  }
  if (!status) {
    throw new Error(`Unit ${unitNumber}: Payment status is required`);
  }

  // Validate client configuration exists
  if (!clientConfig.basicInfo?.displayName) {
    throw new Error('Client display name is required');
  }
  if (!clientConfig.contactInfo) {
    throw new Error('Client contact information is required');
  }

  // Get reading date from readings document timestamp - CRITICAL for timezone accuracy
  const readingDate = readingsDocument.timestamp;
  if (!readingDate) {
    throw new Error('Reading date is required from readings document');
  }

  // Get previous month consumption for comparison by fetching previous period data
  let lastMonthConsumption = null;
  let usageChange = null;
  
  try {
    // Calculate previous period from current period ID
    // currentPeriodId should be passed as "2026-01" format where 00=Jan, 01=Feb, etc.
    const previousPeriod = currentPeriodId ? getPreviousPeriod(currentPeriodId) : null;
    
    if (previousPeriod) {
      // Fetch previous month's readings document from Firebase
      const db = await getDb();
      const previousReadingsRef = db.doc(`clients/AVII/projects/waterBills/readings/${previousPeriod}`);
      const previousReadingsDoc = await previousReadingsRef.get();
      
      if (previousReadingsDoc.exists) {
        const previousData = previousReadingsDoc.data();
        const previousUnitReading = previousData.units?.[unitNumber];
        
        if (previousUnitReading && typeof previousUnitReading.reading === 'number') {
          // Calculate previous month consumption from the readings
          const currentReading = previousUnitReading.reading;
          const priorReading = previousUnitReading.priorReading || 0;
          lastMonthConsumption = currentReading - priorReading;
          usageChange = consumption - lastMonthConsumption;
        }
      }
    }
  } catch (error) {
    console.warn(`Could not fetch previous month data for comparison: ${error.message}`);
    // Continue without comparison data
  }
  
  // Template variables - STRICT validation, no fallbacks for financial data
  return {
    // Client Information - validated required fields
    ClientName: clientConfig.basicInfo.displayName,
    ClientLogoUrl: clientConfig.branding?.logoUrl || "", // Branding can have empty fallback
    ClientCurrency: configSnapshot.currency,
    CurrencySymbol: configSnapshot.currencySymbol,
    ClientAddress: buildClientAddress(clientConfig.contactInfo.address),
    ClientPhone: clientConfig.contactInfo.phone || "",
    ClientEmail: clientConfig.contactInfo.primaryEmail || "",

    // Bill Header Information - NO FALLBACKS, use actual Firebase data
    UnitNumber: unitNumber,
    BillingPeriod: billDocument.billingPeriod, // Real data: "July 2025"
    DueDate: formatDate(billDocument.dueDate, userLanguage === 'es' ? 'es-MX' : 'en-US'),
    BillDate: formatDate(billDocument.billDate, userLanguage === 'es' ? 'es-MX' : 'en-US'),

    // Water Consumption - Real meter readings from Firebase
    WaterConsumption: consumption,
    PriorReading: priorReading,
    CurrentReading: currentReading,
    ReadingDate: formatDate(readingDate, userLanguage === 'es' ? 'es-MX' : 'en-US'),
    WaterCharge: formatCurrencyLocal(waterCharge),

    // Service Charges - Can default to 0 for counts
    CarWashCount: carWashCount,
    CarWashCharge: formatCurrencyLocal(carWashCharge),
    BoatWashCount: boatWashCount,
    BoatWashCharge: formatCurrencyLocal(boatWashCharge),

    // Financial Totals - NO FALLBACKS for amounts, use backend currency utility
    CurrentMonthTotal: formatCurrencyLocal(currentCharge),
    PenaltyAmount: formatCurrencyLocal(penaltyAmount),
    TotalAmountDue: formatCurrencyLocal(totalAmount),

    // Conditional Display Logic
    ShowCarWash: carWashCount > 0,
    ShowBoatWash: boatWashCount > 0,
    ShowPenalties: penaltyAmount > 0,
    ShowPaidStatus: status === 'paid',
    IsHighUsage: consumption > 30,

    // Payment Status - Required field
    PaymentStatus: status,
    StatusMessage: getStatusMessage(status, userLanguage),

    // Additional Context
    BillNotes: billNotes || "",
    PenaltyDays: waterBillConfig.penaltyDays,
    PenaltyRate: `${(configSnapshot.penaltyRate * 100).toFixed(1)}%`,

    // Rate Information - Required from configSnapshot (frozen at bill generation)
    RatePerM3: formatCurrencyLocal(configSnapshot.ratePerM3),
    CarWashRate: formatCurrencyLocal(waterBillConfig.rateCarWash),
    BoatWashRate: formatCurrencyLocal(waterBillConfig.rateBoatWash),

    // Branding Colors - Safe to have fallbacks for visual elements
    PrimaryColor: clientConfig.branding?.brandColors?.primary || "#2563eb",
    AccentColor: clientConfig.branding?.brandColors?.accent || "#10b981",
    DangerColor: clientConfig.branding?.brandColors?.danger || "#ef4444",
    SuccessColor: clientConfig.branding?.brandColors?.success || "#22c55e",

    // NEW: Consumption Comparison Features
    LastMonthUsage: lastMonthConsumption || 0,
    UsageChange: usageChange ? Math.abs(usageChange) : 0,
    UsageChangeDisplay: buildUsageChangeDisplay(usageChange, userLanguage),
    ComparisonChangeClass: getComparisonChangeClass(usageChange),
    ShowComparison: lastMonthConsumption !== null,

    // NEW: Enhanced High Usage Warning
    HighUsageWarning: buildHighUsageWarning(consumption, lastMonthConsumption, userLanguage),

    // NEW: Action Button URLs (placeholder URLs for SAMS integration)
    BankInfoUrl: `https://sams.sandyland.com.mx/bank-info/${unitNumber}`,
    AccountStatementUrl: `https://sams.sandyland.com.mx/account-statement/${unitNumber}`,

    // NEW: Dynamic Content Sections
    BillNotesSection: buildBillNotesSection(billNotes, userLanguage),
    ClientContactInfo: buildClientContactInfo(clientConfig.contactInfo, userLanguage)
  };
}

/**
 * Validate required data exists before template processing
 * @param {Object} billDocument - Bill document from Firebase
 * @param {Object} readingsDocument - Readings document from Firebase
 * @param {Object} clientConfig - Client configuration
 * @param {Object} waterBillConfig - Water bill configuration
 * @param {string} unitNumber - Unit number
 * @throws {Error} If any required data is missing
 */
function validateRequiredData(billDocument, readingsDocument, clientConfig, waterBillConfig, unitNumber) {
  if (!billDocument) {
    throw new Error('Bill document is required');
  }
  if (!readingsDocument) {
    throw new Error('Readings document is required');
  }
  if (!clientConfig) {
    throw new Error('Client configuration is required');
  }
  if (!waterBillConfig) {
    throw new Error('Water bill configuration is required');
  }
  if (!unitNumber) {
    throw new Error('Unit number is required');
  }

  // Validate bill document has required fields - NO FALLBACKS
  const requiredBillFields = ['billingPeriod', 'dueDate', 'billDate', 'configSnapshot'];
  for (const field of requiredBillFields) {
    if (billDocument[field] === undefined || billDocument[field] === null) {
      throw new Error(`Bill document missing required field: ${field}`);
    }
  }

  // Validate configSnapshot has critical financial data
  const configSnapshot = billDocument.configSnapshot;
  const requiredConfigFields = ['currency', 'currencySymbol', 'ratePerM3', 'penaltyRate'];
  for (const field of requiredConfigFields) {
    if (configSnapshot[field] === undefined || configSnapshot[field] === null) {
      throw new Error(`Bill configSnapshot missing required field: ${field}`);
    }
  }

  // Validate readings document has timestamp
  if (!readingsDocument.timestamp) {
    throw new Error('Readings document missing required timestamp');
  }

  // Validate client has required basic info
  if (!clientConfig.basicInfo?.displayName) {
    throw new Error('Client configuration missing required field: basicInfo.displayName');
  }
}

/**
 * Build client address string from address object
 * @param {Object} address - Address object
 * @returns {string} Formatted address string
 */
function buildClientAddress(address) {
  if (!address) {
    throw new Error('Client address is required');
  }
  
  const parts = [
    address.street,
    address.city,
    address.state,
    address.postalCode
  ].filter(part => part && part.trim());
  
  if (parts.length === 0) {
    throw new Error('Client address must contain at least one address component');
  }
  
  return parts.join(', ');
}

/**
 * Get localized status message
 * @param {string} status - Payment status from Firebase
 * @param {string} language - User language preference
 * @returns {string} Localized status message
 */
function getStatusMessage(status, language) {
  const messages = {
    paid: {
      en: "✅ PAID - Thank you for your payment",
      es: "✅ PAGADO - Gracias por su pago"
    },
    unpaid: {
      en: "⏰ PAYMENT DUE - Please pay by the due date to avoid penalties",
      es: "⏰ PAGO PENDIENTE - Por favor pague antes de la fecha límite para evitar recargos"
    },
    overdue: {
      en: "⚠️ OVERDUE - Late penalties have been applied",
      es: "⚠️ VENCIDO - Se han aplicado recargos por pago tardío"
    }
  };

  return messages[status]?.[language] || messages.unpaid[language];
}

/**
 * Build usage change display string
 * @param {number|null} usageChange - Change in consumption from last month
 * @param {string} language - User language preference
 * @returns {string} Formatted usage change display
 */
function buildUsageChangeDisplay(usageChange, language) {
  if (usageChange === null || usageChange === 0) {
    return language === 'es' ? 'Sin cambio' : 'No change';
  }
  
  const absChange = Math.abs(usageChange);
  const arrow = usageChange > 0 ? '↗️' : '↘️';
  const sign = usageChange > 0 ? '+' : '';
  
  return `${sign}${absChange} m³ ${arrow}`;
}

/**
 * Get CSS class for consumption comparison change
 * @param {number|null} usageChange - Change in consumption from last month
 * @returns {string} CSS class name
 */
function getComparisonChangeClass(usageChange) {
  if (usageChange === null || usageChange === 0) {
    return 'comparison-same';
  }
  return usageChange > 0 ? 'comparison-increase' : 'comparison-decrease';
}

/**
 * Build high usage warning HTML section
 * @param {number} consumption - Current month consumption
 * @param {number|null} lastMonthConsumption - Previous month consumption
 * @param {string} language - User language preference
 * @returns {string} HTML for high usage warning or empty string
 */
function buildHighUsageWarning(consumption, lastMonthConsumption, language) {
  const isHighUsage = consumption > 30;
  const isSignificantIncrease = lastMonthConsumption && (consumption - lastMonthConsumption) > 10;
  
  if (!isHighUsage && !isSignificantIncrease) {
    return '';
  }
  
  const messages = {
    en: {
      title: '⚠️ High Water Usage Notice',
      highUsage: `Your consumption of ${consumption} m³ is significantly above average. Please check for possible leaks or consider water conservation measures.`,
      increase: `Your consumption increased by ${consumption - (lastMonthConsumption || 0)} m³ from last month. Please monitor your water usage.`
    },
    es: {
      title: '⚠️ Aviso de Consumo Alto',
      highUsage: `Su consumo de ${consumption} m³ está significativamente por encima del promedio. Por favor revise posibles fugas o considere medidas de conservación de agua.`,
      increase: `Su consumo aumentó ${consumption - (lastMonthConsumption || 0)} m³ con respecto al mes pasado. Por favor monitoree su uso de agua.`
    }
  };
  
  const lang = messages[language] || messages.en;
  const message = isHighUsage ? lang.highUsage : lang.increase;
  
  return `<div class="high-usage-warning">
    <div class="warning-title">${lang.title}</div>
    <div class="warning-text">${message}</div>
  </div>`;
}

/**
 * Build bill notes section HTML
 * @param {string} billNotes - Notes for the bill
 * @param {string} language - User language preference
 * @returns {string} HTML for bill notes section or empty string
 */
function buildBillNotesSection(billNotes, language) {
  if (!billNotes) {
    return '';
  }
  
  const label = language === 'es' ? 'Notas Adicionales' : 'Additional Notes';
  
  return `<div style="background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981;">
    <strong>${label}:</strong><br>
    ${billNotes}
  </div>`;
}

/**
 * Build client contact info HTML
 * @param {Object} contactInfo - Client contact information
 * @param {string} language - User language preference
 * @returns {string} HTML for contact information
 */
function buildClientContactInfo(contactInfo, language) {
  const parts = [];
  
  if (contactInfo.phone) {
    parts.push(`📞 ${contactInfo.phone}`);
  }
  
  if (contactInfo.primaryEmail) {
    parts.push(`✉️ ${contactInfo.primaryEmail}`);
  }
  
  return parts.join('<br>');
}

/**
 * Real test scenarios using actual Firebase data
 * Updated to use new function signature with proper document structure
 */
const testScenarios = [
  // Unit 101: Paid bill with car wash (real data from Firebase)
  {
    unitNumber: "101",
    description: "Paid bill with car wash service",
    expectedData: {
      consumption: 18,
      carWashCount: 1,
      waterCharge: 900, // centavos
      totalAmount: 110250, // 1102.50 in centavos
      status: 'paid'
    }
  },
  // Unit 103: Unpaid bill with multiple car washes (real data)
  {
    unitNumber: "103", 
    description: "Unpaid bill with 3 car wash services",
    expectedData: {
      consumption: 7,
      carWashCount: 3,
      waterCharge: 350, // centavos
      totalAmount: 71663, // 716.63 in centavos
      status: 'unpaid'
    }
  },
  // Unit 106: Unpaid bill with boat washes (real data)
  {
    unitNumber: "106",
    description: "Unpaid bill with 2 boat wash services", 
    expectedData: {
      consumption: 11,
      boatWashCount: 2,
      waterCharge: 550, // centavos
      totalAmount: 104738, // 1047.38 in centavos
      status: 'unpaid'
    }
  },
  // Unit 203: High usage unpaid bill (real data)
  {
    unitNumber: "203",
    description: "High usage unpaid bill (43m³ consumption)",
    expectedData: {
      consumption: 43,
      carWashCount: 0,
      waterCharge: 2150, // centavos
      totalAmount: 237038, // 2370.38 in centavos
      status: 'unpaid'
    }
  },
  // Unit 204: Minimal consumption (real data)
  {
    unitNumber: "204",
    description: "Minimal consumption unpaid bill (1m³)",
    expectedData: {
      consumption: 1,
      carWashCount: 0,
      waterCharge: 50, // centavos
      totalAmount: 5513, // 55.13 in centavos
      status: 'unpaid'
    }
  }
];

export {
  buildWaterBillTemplateVariables,
  validateRequiredData,
  buildClientAddress,
  getStatusMessage,
  buildUsageChangeDisplay,
  getComparisonChangeClass,
  buildHighUsageWarning,
  buildBillNotesSection,
  buildClientContactInfo,
  getPreviousPeriod,
  testScenarios
};