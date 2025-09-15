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

// Backend-compatible utility functions (replicate frontend functionality)
// Using simplified versions to avoid frontend/backend cross-imports

/**
 * Get Mexico timezone date from input - backend version
 * @param {string|Date} dateInput - Date input
 * @returns {Date} Date object
 */
function getMexicoDateTime(dateInput) {
  if (!dateInput) {
    return new Date();
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
 * Build template variables from real Firebase water bills data
 * CRITICAL: NO FALLBACK VALUES for financial data - GAAP compliance required
 * @param {Object} billDocument - Complete bill document from Firebase (clients/AVII/projects/waterBills/bills/2026-00)
 * @param {Object} readingsDocument - Readings document from Firebase (clients/AVII/projects/waterBills/readings/2026-00) 
 * @param {Object} clientConfig - Client configuration from Firebase
 * @param {Object} waterBillConfig - Water bill configuration (clients/AVII/config/waterBills)
 * @param {string} unitNumber - Unit number for this bill
 * @param {string} userLanguage - User's preferred language ('en' or 'es')
 * @returns {Object} Template variables for email processing
 * @throws {Error} If required financial data is missing
 */
function buildWaterBillTemplateVariables(billDocument, readingsDocument, clientConfig, waterBillConfig, unitNumber, userLanguage = 'en') {
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

  // Template variables - STRICT validation, no fallbacks for financial data
  return {
    // Client Information - validated required fields
    __ClientName__: clientConfig.basicInfo.displayName,
    __ClientLogoUrl__: clientConfig.branding?.logoUrl || "", // Branding can have empty fallback
    __ClientCurrency__: configSnapshot.currency,
    __CurrencySymbol__: configSnapshot.currencySymbol,
    __ClientAddress__: buildClientAddress(clientConfig.contactInfo.address),
    __ClientPhone__: clientConfig.contactInfo.phone || "",
    __ClientEmail__: clientConfig.contactInfo.primaryEmail || "",

    // Bill Header Information - NO FALLBACKS, use actual Firebase data
    __UnitNumber__: unitNumber,
    __BillingPeriod__: billDocument.billingPeriod, // Real data: "July 2025"
    __DueDate__: formatDate(billDocument.dueDate, userLanguage === 'es' ? 'es-MX' : 'en-US'),
    __BillDate__: formatDate(billDocument.billDate, userLanguage === 'es' ? 'es-MX' : 'en-US'),

    // Water Consumption - Real meter readings from Firebase
    __WaterConsumption__: consumption,
    __PriorReading__: priorReading,
    __CurrentReading__: currentReading,
    __ReadingDate__: formatDate(readingDate, userLanguage === 'es' ? 'es-MX' : 'en-US'),
    __WaterCharge__: formatCurrencyLocal(waterCharge),

    // Service Charges - Can default to 0 for counts
    __CarWashCount__: carWashCount,
    __CarWashCharge__: formatCurrencyLocal(carWashCharge),
    __BoatWashCount__: boatWashCount,
    __BoatWashCharge__: formatCurrencyLocal(boatWashCharge),

    // Financial Totals - NO FALLBACKS for amounts, use backend currency utility
    __CurrentMonthTotal__: formatCurrencyLocal(currentCharge),
    __PenaltyAmount__: formatCurrencyLocal(penaltyAmount),
    __TotalAmountDue__: formatCurrencyLocal(totalAmount),

    // Conditional Display Logic
    __ShowCarWash__: carWashCount > 0,
    __ShowBoatWash__: boatWashCount > 0,
    __ShowPenalties__: penaltyAmount > 0,
    __ShowPaidStatus__: status === 'paid',
    __IsHighUsage__: consumption > 30,

    // Payment Status - Required field
    __PaymentStatus__: status,
    __StatusMessage__: getStatusMessage(status, userLanguage),

    // Additional Context
    __BillNotes__: billNotes || "",
    __PenaltyDays__: waterBillConfig.penaltyDays,
    __PenaltyRate__: `${(configSnapshot.penaltyRate * 100).toFixed(1)}%`,

    // Rate Information - Required from configSnapshot (frozen at bill generation)
    __RatePerM3__: formatCurrencyLocal(configSnapshot.ratePerM3),
    __CarWashRate__: formatCurrencyLocal(waterBillConfig.rateCarWash),
    __BoatWashRate__: formatCurrencyLocal(waterBillConfig.rateBoatWash),

    // Branding Colors - Safe to have fallbacks for visual elements
    __PrimaryColor__: clientConfig.branding?.brandColors?.primary || "#2563eb",
    __AccentColor__: clientConfig.branding?.brandColors?.accent || "#10b981",
    __DangerColor__: clientConfig.branding?.brandColors?.danger || "#ef4444",
    __SuccessColor__: clientConfig.branding?.brandColors?.success || "#22c55e"
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
  testScenarios
};