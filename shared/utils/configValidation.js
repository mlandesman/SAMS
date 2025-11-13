/**
 * Shared Configuration Validation Utilities
 * 
 * Extracts duplicated configuration loading and validation logic
 * Used across all billing modules (HOA Dues, Water Bills, etc.)
 * 
 * Phase 4 Task 4.7 Fix #3: Architectural Remediation
 */

/**
 * Validate required configuration fields exist
 * 
 * @param {Object} config - Configuration object
 * @param {Array<string>} requiredFields - Array of required field names
 * @param {string} context - Context for error message (e.g., "HOA Dues for MTC")
 * @throws {Error} If any required fields are missing
 */
export function validateRequiredFields(config, requiredFields, context) {
  if (!config) {
    throw new Error(`Configuration missing: ${context}`);
  }

  const missingFields = requiredFields.filter(
    field => config[field] === undefined || config[field] === null
  );

  if (missingFields.length > 0) {
    throw new Error(
      `Configuration incomplete for ${context}. Missing required fields: ${missingFields.join(', ')}`
    );
  }
}

/**
 * Validate penalty configuration
 * 
 * Accepts either `penaltyDays` or `gracePeriodDays` field names
 * 
 * @param {Object} config - Penalty configuration object
 * @param {string} context - Context for error message
 * @returns {Object} Validated penalty config (with gracePeriodDays)
 * @throws {Error} If configuration is incomplete
 */
export function validatePenaltyConfig(config, context) {
  // First check if config exists
  if (!config) {
    throw new Error(`Configuration missing for Penalty config for ${context}`);
  }
  
  // Accept either penaltyDays or gracePeriodDays
  // Check for undefined/null to allow 0 values (e.g., 0% penalty rate)
  if (config.penaltyRate === undefined || config.penaltyRate === null) {
    throw new Error(`Configuration incomplete for Penalty config for ${context}. Missing required field: penaltyRate`);
  }
  
  if ((config.penaltyDays === undefined || config.penaltyDays === null) && 
      (config.gracePeriodDays === undefined || config.gracePeriodDays === null)) {
    throw new Error(`Configuration incomplete for Penalty config for ${context}. Missing required field: penaltyDays or gracePeriodDays`);
  }

  return {
    penaltyRate: config.penaltyRate,
    gracePeriodDays: config.gracePeriodDays ?? config.penaltyDays,
    penaltyDays: config.penaltyDays ?? config.gracePeriodDays,
    compoundingEnabled: config.compoundingEnabled !== undefined ? config.compoundingEnabled : false
  };
}

/**
 * Validate HOA Dues configuration
 * 
 * Validates penalty-related fields that MUST be in hoaDues config
 * - fiscalYearStartMonth comes from client.configuration, NOT this config
 * - monthlyDues should be in unit dues as scheduledAmount, NOT in this config
 * 
 * @param {Object} config - HOA configuration object
 * @param {string} clientId - Client ID for error messages
 * @returns {Object} Validated HOA config
 * @throws {Error} If configuration is incomplete
 */
export function validateHOAConfig(config, clientId) {
  const requiredFields = [
    'penaltyRate',
    'penaltyDays',
    'dueDay'
  ];
  
  validateRequiredFields(config, requiredFields, `HOA Dues for client ${clientId}`);

  return {
    penaltyRate: config.penaltyRate,
    penaltyDays: config.penaltyDays,
    dueDay: config.dueDay,
    // Optional fields
    lateFee: config.lateFee,
    minimumPayment: config.minimumPayment
  };
}

/**
 * Validate Water Bills configuration
 * 
 * @param {Object} config - Water configuration object
 * @param {string} clientId - Client ID for error messages
 * @returns {Object} Validated Water config
 * @throws {Error} If configuration is incomplete
 */
export function validateWaterConfig(config, clientId) {
  const requiredFields = [
    'baseRate',
    'penaltyRate',
    'gracePeriodDays',
    'billingDay'
  ];
  
  validateRequiredFields(config, requiredFields, `Water Bills for client ${clientId}`);

  return {
    baseRate: config.baseRate,
    penaltyRate: config.penaltyRate,
    gracePeriodDays: config.gracePeriodDays,
    billingDay: config.billingDay,
    // Optional fields
    minimumCharge: config.minimumCharge,
    tierRates: config.tierRates
  };
}

