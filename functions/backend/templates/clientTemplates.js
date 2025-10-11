/**
 * Client Template System
 * Provides validated client structure templates for new client creation
 * Based on MTC structure analysis and future client requirements
 * 
 * Phase 12: Client Management CRUD Prerequisites
 * Implementation Date: June 26, 2025
 */

import admin from 'firebase-admin';

/**
 * Base client template with all required and optional fields
 * This template is based on analysis of the MTC client structure
 */
export const CLIENT_TEMPLATE = {
  // Basic Information - REQUIRED
  basicInfo: {
    clientId: '', // User-provided short code - REQUIRED
    fullName: '', // Required - Full legal name of the client
    displayName: '', // Optional - Shorter display name
    clientType: 'HOA_Management', // Default type - could be expanded later
    status: 'active', // active, inactive, suspended
    description: '' // Optional - Brief description of the client
  },

  // Branding Configuration - OPTIONAL
  branding: {
    logoUrl: null, // Firebase Storage URL for uploaded logo
    iconUrl: null, // Optional separate icon
    brandColors: {
      primary: '#2563eb', // Default blue
      secondary: '#64748b', // Default gray
      accent: '#10b981' // Default green
    },
    customCss: null // Future: Custom CSS overrides
  },

  // System Configuration - REQUIRED
  configuration: {
    timezone: 'America/Mexico_City', // Default timezone
    currency: 'MXN', // Default currency
    language: 'es-MX', // Default language
    dateFormat: 'DD/MM/YYYY', // Default date format
    fiscalYearStart: '01-01' // MM-DD format
  },

  // Contact Information - OPTIONAL
  contactInfo: {
    primaryEmail: '',
    phone: '',
    address: {
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'MX'
    },
    website: ''
  },

  // System Metadata - AUTO-GENERATED
  metadata: {
    createdAt: null, // Set during creation
    createdBy: null, // User ID of creator
    lastModified: null, // Updated on changes
    lastModifiedBy: null, // User ID of last modifier
    version: 1, // For future versioning
    migrationStatus: null // For data import tracking
  },

  // Legacy MTC Fields - For compatibility
  legacy: {
    accounts: [], // Initialize empty accounts array (MTC compatibility)
    oldClientId: null, // For tracking pre-migration client IDs
    importDate: null, // When this client was imported (if applicable)
    importSource: null // Source system (e.g., 'MTC_MIGRATION')
  }
};

/**
 * Validation rules for client template fields
 */
export const VALIDATION_RULES = {
  basicInfo: {
    id: {
      required: false, // Generated during creation
      pattern: /^[a-zA-Z0-9_-]+$/, // URL-safe characters only
      minLength: 3,
      maxLength: 50
    },
    fullName: {
      required: true,
      minLength: 2,
      maxLength: 100
    },
    displayName: {
      required: false,
      maxLength: 50
    },
    clientType: {
      required: true,
      allowedValues: ['HOA_Management', 'Property_Management', 'Commercial', 'Residential']
    },
    status: {
      required: true,
      allowedValues: ['active', 'inactive', 'suspended']
    }
  },
  branding: {
    logoUrl: {
      required: false,
      pattern: /^https:\/\/firebasestorage\.googleapis\.com\/.+/
    },
    brandColors: {
      primary: {
        pattern: /^#[0-9a-fA-F]{6}$/
      },
      secondary: {
        pattern: /^#[0-9a-fA-F]{6}$/
      },
      accent: {
        pattern: /^#[0-9a-fA-F]{6}$/
      }
    }
  },
  configuration: {
    timezone: {
      required: true,
      // Common timezones - could be expanded
      allowedValues: [
        'America/Mexico_City', 'America/Cancun', 'America/New_York', 'America/Los_Angeles',
        'America/Chicago', 'UTC', 'Europe/London', 'Europe/Madrid'
      ]
    },
    currency: {
      required: true,
      allowedValues: ['MXN', 'USD', 'EUR', 'CAD']
    },
    language: {
      required: true,
      allowedValues: ['es-MX', 'en-US', 'en-CA', 'fr-CA']
    }
  }
};

/**
 * Image upload configuration
 */
export const LOGO_UPLOAD_CONFIG = {
  allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  maxFileSize: 5 * 1024 * 1024, // 5MB
  maxDimensions: {
    width: 2000,
    height: 2000
  },
  storageFolder: {
    logos: 'logos',
    icons: 'icons'
  },
  thumbnailSizes: [
    { name: 'small', width: 100, height: 100 },
    { name: 'medium', width: 300, height: 300 }
  ]
};

/**
 * Create a new client object from template
 * @param {Object} clientData - Data provided for new client
 * @param {string} creatorUserId - ID of user creating the client
 * @returns {Object} - Validated client object ready for Firestore
 */
export function createClientFromTemplate(clientData, creatorUserId) {
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
  
  // Start with template
  const newClient = JSON.parse(JSON.stringify(CLIENT_TEMPLATE));
  
  // Apply provided data
  if (clientData.basicInfo) {
    Object.assign(newClient.basicInfo, clientData.basicInfo);
  }
  
  if (clientData.branding) {
    Object.assign(newClient.branding, clientData.branding);
  }
  
  if (clientData.configuration) {
    Object.assign(newClient.configuration, clientData.configuration);
  }
  
  if (clientData.contactInfo) {
    Object.assign(newClient.contactInfo, clientData.contactInfo);
  }
  
  // Set metadata with server timestamps
  newClient.metadata.createdAt = serverTimestamp;
  newClient.metadata.createdBy = creatorUserId;
  newClient.metadata.lastModified = serverTimestamp;
  newClient.metadata.lastModifiedBy = creatorUserId;
  
  // Validate client ID is provided
  if (!newClient.basicInfo.clientId) {
    throw new Error('Client ID is required and must be provided by user');
  }

  // Validate client ID format
  const clientIdValidation = validateClientIdFormat(newClient.basicInfo.clientId);
  if (!clientIdValidation.isValid) {
    throw new Error(`Invalid Client ID: ${clientIdValidation.error}`);
  }

  // Ensure id field matches clientId (for consistency)
  newClient.basicInfo.id = newClient.basicInfo.clientId;
  
  return newClient;
}

/**
 * Validate client ID format
 * @param {string} clientId - Client ID to validate
 * @returns {object} - Validation result with isValid flag and error message
 */
export function validateClientIdFormat(clientId) {
  if (!clientId) {
    return { isValid: false, error: 'Client ID is required' };
  }
  
  if (typeof clientId !== 'string') {
    return { isValid: false, error: 'Client ID must be a string' };
  }
  
  if (clientId.length < 2 || clientId.length > 10) {
    return { isValid: false, error: 'Client ID must be 2-10 characters long' };
  }
  
  if (!/^[A-Z0-9_\-]+$/.test(clientId)) {
    return { isValid: false, error: 'Client ID can only contain uppercase letters, numbers, underscores, and hyphens' };
  }
  
  return { isValid: true };
}

/**
 * Validate client data against template rules
 * @param {Object} clientData - Client data to validate
 * @returns {Object} - { isValid: boolean, errors: string[] }
 */
export function validateClientData(clientData) {
  const errors = [];
  
  // Validate basic info
  if (!clientData.basicInfo?.fullName?.trim()) {
    errors.push('Full name is required');
  }
  
  if (clientData.basicInfo?.fullName && clientData.basicInfo.fullName.length < 2) {
    errors.push('Full name must be at least 2 characters');
  }
  
  if (clientData.basicInfo?.fullName && clientData.basicInfo.fullName.length > 100) {
    errors.push('Full name must be less than 100 characters');
  }
  
  // Validate client type
  if (clientData.basicInfo?.clientType && 
      !VALIDATION_RULES.basicInfo.clientType.allowedValues.includes(clientData.basicInfo.clientType)) {
    errors.push('Invalid client type');
  }
  
  // Validate status
  if (clientData.basicInfo?.status && 
      !VALIDATION_RULES.basicInfo.status.allowedValues.includes(clientData.basicInfo.status)) {
    errors.push('Invalid status');
  }
  
  // Validate configuration
  if (clientData.configuration?.timezone && 
      !VALIDATION_RULES.configuration.timezone.allowedValues.includes(clientData.configuration.timezone)) {
    errors.push('Invalid timezone');
  }
  
  if (clientData.configuration?.currency && 
      !VALIDATION_RULES.configuration.currency.allowedValues.includes(clientData.configuration.currency)) {
    errors.push('Invalid currency');
  }
  
  if (clientData.configuration?.language && 
      !VALIDATION_RULES.configuration.language.allowedValues.includes(clientData.configuration.language)) {
    errors.push('Invalid language');
  }
  
  // Validate brand colors
  if (clientData.branding?.brandColors) {
    const colors = clientData.branding.brandColors;
    const colorPattern = VALIDATION_RULES.branding.brandColors.primary.pattern;
    
    if (colors.primary && !colorPattern.test(colors.primary)) {
      errors.push('Invalid primary color format (must be hex: #RRGGBB)');
    }
    if (colors.secondary && !colorPattern.test(colors.secondary)) {
      errors.push('Invalid secondary color format (must be hex: #RRGGBB)');
    }
    if (colors.accent && !colorPattern.test(colors.accent)) {
      errors.push('Invalid accent color format (must be hex: #RRGGBB)');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Update client metadata for modifications
 * @param {Object} existingClient - Current client data
 * @param {Object} updates - Updates to apply
 * @param {string} updaterUserId - ID of user making the update
 * @returns {Object} - Updated client object
 */
export function updateClientWithMetadata(existingClient, updates, updaterUserId) {
  const updatedClient = { ...existingClient };
  
  // Apply updates
  if (updates.basicInfo) {
    updatedClient.basicInfo = { ...updatedClient.basicInfo, ...updates.basicInfo };
  }
  
  if (updates.branding) {
    updatedClient.branding = { ...updatedClient.branding, ...updates.branding };
  }
  
  if (updates.configuration) {
    updatedClient.configuration = { ...updatedClient.configuration, ...updates.configuration };
  }
  
  if (updates.contactInfo) {
    updatedClient.contactInfo = { ...updatedClient.contactInfo, ...updates.contactInfo };
  }
  
  // Update metadata (ensure metadata object exists)
  if (!updatedClient.metadata) {
    updatedClient.metadata = {};
  }
  
  updatedClient.metadata.lastModified = admin.firestore.FieldValue.serverTimestamp();
  updatedClient.metadata.lastModifiedBy = updaterUserId;
  updatedClient.metadata.version = (updatedClient.metadata.version || 1) + 1;
  
  return updatedClient;
}