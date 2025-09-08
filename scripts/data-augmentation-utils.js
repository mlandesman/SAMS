/**
 * Enhanced Data Augmentation Utilities for MTC Migration
 * 
 * Based on Phase 0 analysis and CLIENT_DATA_IMPORT.md specifications
 * Implements corrected mapping strategies for all MTC data types
 * 
 * Task ID: MTC-MIGRATION-001
 * Date: June 27, 2025
 */

import { getMTCImportMapping } from '../backend/utils/accountMapping.js';

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
export function augmentMTCUser(userUnitMapping) {
  const { userData, unitData, fullName, unitId, email } = userUnitMapping;
  
  return {
    // Required fields for SAMS
    email: email,
    name: fullName, // Use full name from Units.json, not just LastName
    role: 'unitOwner', // Default role for all MTC users
    clientId: 'MTC',
    unitId: unitId,
    
    // Optional fields with defaults
    globalRole: 'user',
    clientAccess: {
      'MTC': {
        role: 'unitOwner',
        unitId: unitId,
        permissions: [],
        addedDate: new Date().toISOString(),
        addedBy: 'system-migration'
      }
    },
    preferredClient: 'MTC',
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
      migratedAt: new Date().toISOString()
    }
  };
}

/**
 * Augment MTC transaction data with proper account mapping
 */
export function augmentMTCTransaction(mtcTransaction) {
  const accountMapping = getMTCImportMapping();
  
  // Get account mapping
  const accountName = mtcTransaction.Account;
  const mapping = accountMapping[accountName];
  
  if (!mapping) {
    console.warn(`⚠️ No account mapping for: ${accountName}`);
  }
  
  return {
    // Required fields
    amount: parseFloat(mtcTransaction.Amount),
    
    // Account mapping (critical for balance calculations)
    accountId: mapping?.accountId || null,
    accountType: mapping?.accountType || null,
    account: mapping?.account || accountName,
    
    // Optional fields with fallbacks
    date: mtcTransaction.Date || new Date().toISOString(),
    vendor: mtcTransaction.Vendor || '',
    category: mtcTransaction.Category || '',
    notes: mtcTransaction.Notes || '',
    
    // Import tracking
    googleId: mtcTransaction[''] || null, // First field is google ID
    
    // Metadata
    clientId: 'MTC',
    
    // Migration metadata
    migrationData: {
      originalAccount: accountName,
      originalAmount: mtcTransaction.Amount,
      originalDate: mtcTransaction.Date,
      unit: mtcTransaction.Unit || null,
      migratedAt: new Date().toISOString()
    }
  };
}

/**
 * Augment MTC unit data combining Units.json + UnitSizes.json
 * CORRECTED: unitId now comes from UnitID field ("1A", "PH4D", etc.)
 */
export function augmentMTCUnit(unitData, sizeData = null) {
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
    createdAt: new Date(),
    
    // Migration metadata
    migrationData: {
      originalData: unitData,
      sizeData: sizeData,
      migratedAt: new Date().toISOString()
    }
  };
}

/**
 * Process Categories data
 */
export function augmentMTCCategory(categoryData) {
  return {
    name: categoryData.Categories,
    description: categoryData.Categories, // Use same as description
    type: 'expense', // Default type
    clientId: 'MTC',
    createdAt: new Date(),
    migrationData: {
      originalData: categoryData,
      migratedAt: new Date().toISOString()
    }
  };
}

/**
 * Process Vendors data
 */
export function augmentMTCVendor(vendorData) {
  return {
    name: vendorData.Vendors,
    description: vendorData.Vendors,
    clientId: 'MTC',
    createdAt: new Date(),
    migrationData: {
      originalData: vendorData,
      migratedAt: new Date().toISOString()
    }
  };
}

/**
 * Process HOA Dues data with transaction linking
 */
export function augmentMTCHOADues(unitId, duesData, transactionLookup) {
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
        migratedAt: new Date().toISOString()
      });
    });
  }
  
  return {
    unitId: unitId,
    year: new Date().getFullYear(), // Current year
    scheduledAmount: duesData.scheduledAmount || 0,
    creditBalance: duesData.creditBalance || 0,
    totalPaid: duesData.totalPaid || 0,
    outstanding: duesData.outstanding || 0,
    payments: payments,
    migrationData: {
      originalData: duesData,
      migratedAt: new Date().toISOString()
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