/**
 * Enhanced Data Augmentation Utilities for MTC Migration
 * 
 * Based on Phase 0 analysis and CLIENT_DATA_IMPORT.md specifications
 * Implements corrected mapping strategies for all MTC data types
 * 
 * Task ID: MTC-MIGRATION-001
 * Date: June 27, 2025
 */

import { getMTCImportMapping } from './accountMapping.js';
import { getNow } from '../services/DateService.js';

/**
 * Link Users to Units using full name matching
 * Solves the LastName → Full Name mapping challenge
 */
export function linkUsersToUnits(usersData, unitsData) {
  console.log('🔗 Linking users to units using name matching...');
  
  const userUnitMap = {};
  const unmatchedUsers = [];
  const unmatchedUnits = [];
  
  // CORRECTED: Units.json is an ARRAY, not an object
  // Create lookup map from units array (full name → unit info)
  const unitsByFullName = {};
  unitsData.forEach(unitInfo => {
    if (unitInfo.Owner && unitInfo.UnitID) {
      unitsByFullName[unitInfo.Owner.toLowerCase()] = {
        ...unitInfo,
        unitId: unitInfo.UnitID  // Use UnitID as the document ID
      };
    }
  });
  
  // Process each user
  usersData.forEach(user => {
    if (!user.LastName || !user.Email) {
      console.warn('⚠️ Skipping user with missing data:', user);
      return;
    }
    
    // Try to find matching unit by various name strategies
    let matchedUnit = null;
    const lastName = user.LastName.toLowerCase();
    
    // Strategy 1: Find unit where full name ends with user's last name
    for (const [fullName, unitInfo] of Object.entries(unitsByFullName)) {
      if (fullName.endsWith(lastName)) {
        matchedUnit = unitInfo;
        break;
      }
    }
    
    // Strategy 2: If no match, try partial matching
    if (!matchedUnit) {
      for (const [fullName, unitInfo] of Object.entries(unitsByFullName)) {
        if (fullName.includes(lastName)) {
          matchedUnit = unitInfo;
          console.log(`📝 Partial match: "${user.LastName}" → "${fullName}"`);
          break;
        }
      }
    }
    
    if (matchedUnit) {
      userUnitMap[user.Email] = {
        userData: user,
        unitData: matchedUnit,
        fullName: matchedUnit.Owner,
        lastName: user.LastName,
        unitId: matchedUnit.unitId,  // Now contains actual UnitID like "1A", "PH4D"
        email: user.Email
      };
    } else {
      unmatchedUsers.push(user);
      console.warn(`❌ No unit match found for user: ${user.LastName} (${user.Email})`);
    }
  });
  
  // Find units without matching users
  unitsData.forEach(unitInfo => {
    const hasMatchingUser = Object.values(userUnitMap).some(
      mapping => mapping.unitId === unitInfo.UnitID
    );
    if (!hasMatchingUser) {
      unmatchedUnits.push({ unitId: unitInfo.UnitID, ...unitInfo });
    }
  });
  
  console.log(`✅ Successfully linked ${Object.keys(userUnitMap).length} users to units`);
  console.log(`⚠️ Unmatched users: ${unmatchedUsers.length}`);
  console.log(`⚠️ Unmatched units: ${unmatchedUnits.length}`);
  
  return {
    userUnitMap,
    unmatchedUsers,
    unmatchedUnits,
    stats: {
      totalUsers: usersData.length,
      totalUnits: unitsData.length,  // Array length, not Object.keys()
      matched: Object.keys(userUnitMap).length,
      unmatchedUsers: unmatchedUsers.length,
      unmatchedUnits: unmatchedUnits.length
    }
  };
}

/**
 * Augment MTC user data for SAMS user creation
 */
export function augmentUser(userUnitMapping, clientId = 'MTC') {
  const { userData, unitData, fullName, unitId, email } = userUnitMapping;
  
  return {
    // Required fields for SAMS
    email: email,
    name: fullName, // Use full name from Units.json, not just LastName
    role: 'unitOwner', // Default role for all users
    clientId: clientId,
    unitId: unitId,
    
    // Optional fields with defaults
    globalRole: 'user',
    clientAccess: {
      [clientId]: {
        role: 'unitOwner',
        unitId: unitId,
        permissions: [],
        addedDate: getNow().toISOString(),
        addedBy: 'system-migration'
      }
    },
    preferredClient: clientId,
    isActive: true,
    accountState: 'pending_password_change',
    mustChangePassword: true,
    creationMethod: 'migration',
    
    // Migration metadata
    migrationData: {
      originalLastName: userData.LastName,
      originalUnit: userData.Unit,
      originalPassword: userData.Password, // Handle securely
      sourceEmail: userData.Email,
      unitOwner: unitData.Owner,
      migratedAt: getNow().toISOString()
    }
  };
}

/**
 * Augment transaction data with proper ID resolution (generic, data-driven)
 * NOTE: This function now requires vendorId, categoryId, accountId, and accountMap to be resolved
 * by the calling code since it doesn't have access to the database
 */
export function augmentTransaction(transactionData, vendorId = null, categoryId = null, accountId = null, vendorName = null, accountMap = null, clientId = 'MTC') {
  // Get account mapping - use provided accountMap (dynamic) or fall back to hardcoded
  const accountName = transactionData.Account;
  let mapping = null;
  
  if (accountMap && accountMap[accountName]) {
    // Use dynamic account mapping from client data
    mapping = accountMap[accountName];
    console.log(`✅ Mapped account "${accountName}" → id: ${mapping.id}, type: ${mapping.type}`);
  } else {
    // Fall back to hardcoded mapping (for backwards compatibility)
    const hardcodedMapping = getMTCImportMapping();
    mapping = hardcodedMapping[accountName];
    if (!mapping) {
      console.warn(`⚠️ No account mapping for: ${accountName}`);
    }
  }
  
  // Determine transaction type based on amount
  const amount = parseFloat(transactionData.Amount);
  const type = amount >= 0 ? 'income' : 'expense';
  
  const augmentedData = {
    // Required fields
    amount: amount,
    type: type, // 'income' for positive amounts, 'expense' for negative
    
    // Account mapping (critical for balance calculations)
    // Handle both dynamic mapping (id, name, type) and hardcoded mapping (accountId, account, accountType)
    accountName: mapping?.name || mapping?.account || accountName,
  };
  
  // Only add accountId if it exists (avoid null values)
  // Handle both dynamic mapping (.id) and hardcoded mapping (.accountId)
  if (accountId || mapping?.id || mapping?.accountId) {
    augmentedData.accountId = accountId || mapping?.id || mapping?.accountId;
  }
  
  // Only add accountType if it exists (avoid null values)
  if (mapping?.type || mapping?.accountType) {
    augmentedData.accountType = mapping?.type || mapping?.accountType;
  }
  
  // Only add vendorId if it exists (avoid null values)
  if (vendorId) {
    augmentedData.vendorId = vendorId;
  }
  augmentedData.vendorName = vendorName || transactionData.Vendor || '';
  
  // Only add categoryId if it exists (avoid null values)
  if (categoryId) {
    augmentedData.categoryId = categoryId;
  }
  augmentedData.categoryName = transactionData.Category || '';
  
  // Optional fields with fallbacks
  augmentedData.date = transactionData.Date || getNow().toISOString();
  augmentedData.notes = transactionData.Notes || '';
  augmentedData.description = vendorName || transactionData.Vendor || ''; // Use mapped vendor as description
  
  // Add unitId as top-level field (UI expects this)
  if (transactionData.Unit) {
    augmentedData.unitId = transactionData.Unit;
  }
  
  // Import tracking
  if (transactionData[''] && typeof transactionData[''] === 'string' && transactionData[''].trim() !== '') {
    augmentedData.googleId = transactionData['']; // First field is google ID
  }
  
  // Metadata
  augmentedData.clientId = clientId;
  
  // Migration metadata
  augmentedData.migrationData = {
    originalAccount: accountName,
    originalAmount: transactionData.Amount,
    originalDate: transactionData.Date,
    unit: transactionData.Unit || null,
    migratedAt: getNow().toISOString()
  };
  
  return augmentedData;
}

/**
 * Augment MTC unit data combining Units.json + UnitSizes.json
 * CORRECTED: unitId now comes from UnitID field ("1A", "PH4D", etc.)
 */
export function augmentUnit(unitData, sizeData = null) {
  const unitId = unitData.UnitID;  // Use UnitID field as document ID
  
  return {
    // Core unit identification
    unitId: unitId, // Document ID: "1A", "1B", "PH4D", etc.
    unitName: `Unit ${unitId}`,
    
    // Required owner information
    owner: unitData.Owner,
    email: unitData.eMail || unitData.Email, // Handle both field names
    
    // Financial information
    monthlyDues: unitData.Dues,
    percentOwned: unitData['% Owner'],
    
    // Physical information from UnitSizes.json (mapped by Condo field)
    squareFeet: sizeData?.['ft² '] || null,
    squareMeters: sizeData?.['m² '] || null,
    percentOfBuilding: sizeData?.['%'] || unitData['% Owner'], // Fallback
    
    // Arrays for user management
    owners: unitData.Owner ? [unitData.Owner] : [],
    emails: unitData.eMail ? [unitData.eMail] : [],
    managers: [], // Empty by default
    
    // Metadata
    createdAt: getNow(),
    
    // Migration metadata
    migrationData: {
      originalData: unitData,
      sizeData: sizeData,
      migratedAt: getNow().toISOString()
    }
  };
}

/**
 * Process Categories data
 */
export function augmentCategory(categoryData, clientId = 'MTC') {
  return {
    name: categoryData.Categories,
    description: categoryData.Categories, // Use same as description
    type: 'expense', // Default type
    clientId: clientId,
    createdAt: getNow(),
    migrationData: {
      originalData: categoryData,
      migratedAt: getNow().toISOString()
    }
  };
}

/**
 * Process Vendors data
 */
export function augmentVendor(vendorData, clientId = 'MTC') {
  return {
    name: vendorData.Vendors,
    description: vendorData.Vendors,
    clientId: clientId,
    createdAt: getNow(),
    migrationData: {
      originalData: vendorData,
      migratedAt: getNow().toISOString()
    }
  };
}

/**
 * Process HOA Dues data with transaction linking
 * NOTE: year parameter should be passed from importService which calculates fiscal year correctly
 */
export function augmentHOADues(unitId, duesData, transactionLookup, year = null) {
  const payments = [];
  
  if (duesData.payments && Array.isArray(duesData.payments)) {
    duesData.payments.forEach(payment => {
      // Extract sequence number from notes
      const seqMatch = payment.notes?.match(/Seq: (\d+)/);
      const sequenceNumber = seqMatch ? seqMatch[1] : null;
      
      // Find matching transaction by googleId
      let transactionId = null;
      if (sequenceNumber && transactionLookup[sequenceNumber]) {
        transactionId = transactionLookup[sequenceNumber];
      }
      
      payments.push({
        month: payment.month,
        paid: payment.paid,
        notes: payment.notes,
        transactionId: transactionId,
        sequenceNumber: sequenceNumber,
        migratedAt: getNow().toISOString()
      });
    });
  }
  
  return {
    unitId: unitId,
    year: year, // Use passed fiscal year
    scheduledAmount: duesData.scheduledAmount || 0,
    creditBalance: duesData.creditBalance || 0,
    totalPaid: duesData.totalPaid || 0,
    outstanding: duesData.outstanding || 0,
    payments: payments,
    migrationData: {
      originalData: duesData,
      migratedAt: getNow().toISOString()
    }
  };
}

/**
 * Validation functions
 */
export function validateAugmentedUser(userData) {
  const errors = [];
  
  if (!userData.email) errors.push('Missing email');
  if (!userData.name) errors.push('Missing name');
  if (!userData.role) errors.push('Missing role');
  if (!userData.clientId) errors.push('Missing clientId');
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateAugmentedTransaction(txnData) {
  const errors = [];
  
  if (typeof txnData.amount !== 'number' || isNaN(txnData.amount)) {
    errors.push('Invalid or missing amount');
  }
  if (!txnData.accountId) {
    errors.push('Missing accountId (critical for balance calculations)');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateAugmentedUnit(unitData) {
  const errors = [];
  
  if (!unitData.unitId) errors.push('Missing unitId');
  if (!unitData.owner) errors.push('Missing owner');
  if (!unitData.email) errors.push('Missing email');
  if (typeof unitData.monthlyDues !== 'number') errors.push('Invalid monthlyDues');
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Import order validation
 */
export function validateImportOrder(dataTypes) {
  const requiredOrder = [
    'categories',
    'vendors', 
    'units',
    'users',
    'transactions',
    'hoaDues'
  ];
  
  const errors = [];
  for (let i = 0; i < dataTypes.length - 1; i++) {
    const currentIndex = requiredOrder.indexOf(dataTypes[i]);
    const nextIndex = requiredOrder.indexOf(dataTypes[i + 1]);
    
    if (currentIndex > nextIndex) {
      errors.push(`Import order violation: ${dataTypes[i]} should come before ${dataTypes[i + 1]}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    recommendedOrder: requiredOrder
  };
}

/**
 * Generate import summary report
 */
export function generateImportSummary(results) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 MTC DATA AUGMENTATION SUMMARY');
  console.log('='.repeat(60));
  
  Object.entries(results).forEach(([type, result]) => {
    if (result.stats) {
      console.log(`\n${type.toUpperCase()}:`);
      console.log(`  Total processed: ${result.stats.total || 0}`);
      console.log(`  Successfully augmented: ${result.stats.success || 0}`);
      console.log(`  Validation errors: ${result.stats.errors || 0}`);
      console.log(`  Warnings: ${result.stats.warnings || 0}`);
    }
  });
  
  console.log('\n' + '='.repeat(60));
}