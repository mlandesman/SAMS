/*
 * Transaction Deletion with HOA Dues Cleanup - Phase 3 Implementation
 * 
 * Enhanced deletion logic that:
 * - Detects HOA Dues transactions (category === 'HOA Dues' || metadata.type === 'hoa_dues')
 * - Conditionally executes cascading cleanup for HOA transactions only
 * - Preserves original behavior for all non-HOA transactions
 * - Provides comprehensive debugging and audit logging
 * 
 * Implementation Date: June 17, 2025
 * APM Priority: #1 - Transaction Deletion with HOA Dues Cleanup
 */

/**
 * transactions.js
 * CRUD operations for transactions collection
 */

import { getDb, getApp } from '../firebase.js';
import { randomUUID } from 'crypto';
import admin from 'firebase-admin';
import { writeAuditLog } from '../utils/auditLogger.js';
import { normalizeDates } from '../utils/timestampUtils.js';
import { updateAccountBalance, rebuildBalances } from './accountsController.js';
import { applyAccountMapping, validateAccountFields } from '../utils/accountMapping.js';
import databaseFieldMappings from '../utils/databaseFieldMappings.js';
import { validateDocument } from '../utils/validateDocument.js';
import { getMexicoDate, getMexicoDateString } from '../utils/timezone.js';
import { getUserPreferences } from '../utils/userPreferences.js';
import { getNow, DateService } from '../services/DateService.js';
import { getFiscalYear } from '../utils/fiscalYearUtils.js';
import creditService from '../services/creditService.js';

const { dollarsToCents, centsToDollars, generateTransactionId, convertToTimestamp } = databaseFieldMappings;

// Initialize DateService for Mexico timezone
const dateService = new DateService({ timezone: 'America/Cancun' });

// Helper to format date fields consistently for API responses using Mexico timezone
function formatDateField(dateValue) {
  if (!dateValue) return null;
  
  try {
    // Use DateService's formatForFrontend method to create multi-format date object
    return dateService.formatForFrontend(dateValue);
  } catch (error) {
    console.error('Error formatting date field:', error);
    return null;
  }
}

// Helper function to resolve vendor name to ID
async function resolveVendorId(clientId, vendorName) {
  if (!vendorName) return null;
  
  try {
    const db = await getDb();
    const vendorsSnapshot = await db.collection(`clients/${clientId}/vendors`)
      .where('name', '==', vendorName)
      .limit(1)
      .get();
    
    if (!vendorsSnapshot.empty) {
      return vendorsSnapshot.docs[0].id;
    }
    
    console.log(`ℹ️ Vendor "${vendorName}" not found, storing name only`);
    return null;
  } catch (error) {
    console.error('❌ Error resolving vendor ID:', error);
    return null;
  }
}

// Helper function to resolve category name to ID
async function resolveCategoryId(clientId, categoryName) {
  if (!categoryName) return null;
  
  try {
    const db = await getDb();
    const categoriesSnapshot = await db.collection(`clients/${clientId}/categories`)
      .where('name', '==', categoryName)
      .limit(1)
      .get();
    
    if (!categoriesSnapshot.empty) {
      return categoriesSnapshot.docs[0].id;
    }
    
    console.log(`ℹ️ Category "${categoryName}" not found, storing name only`);
    return null;
  } catch (error) {
    console.error('❌ Error resolving category ID:', error);
    return null;
  }
}

// Helper function to resolve category ID to name
async function resolveCategoryName(clientId, categoryId) {
  if (!categoryId) return null;
  
  // HARDCODED OVERRIDE: Handle special "-split-" categoryId for split transactions
  if (categoryId === "-split-") {
    return "-Split-";
  }
  
  try {
    const db = await getDb();
    const categoryDoc = await db.collection(`clients/${clientId}/categories`)
      .doc(categoryId)
      .get();
    
    if (categoryDoc.exists) {
      return categoryDoc.data().name;
    }
    
    console.log(`ℹ️ Category ID "${categoryId}" not found`);
    return null;
  } catch (error) {
    console.error('❌ Error resolving category name:', error);
    return null;
  }
}

// Helper function to resolve vendor ID to name
async function resolveVendorName(clientId, vendorId) {
  if (!vendorId) return null;
  
  try {
    const db = await getDb();
    const vendorDoc = await db.collection(`clients/${clientId}/vendors`)
      .doc(vendorId)
      .get();
    
    if (vendorDoc.exists) {
      return vendorDoc.data().name;
    }
    
    console.log(`ℹ️ Vendor ID "${vendorId}" not found`);
    return null;
  } catch (error) {
    console.error('❌ Error resolving vendor name:', error);
    return null;
  }
}

// Helper function to resolve account ID to name
async function resolveAccountName(clientId, accountId) {
  if (!accountId) return null;
  
  try {
    const db = await getDb();
    const clientDoc = await db.collection('clients').doc(clientId).get();
    
    if (clientDoc.exists) {
      const accounts = clientDoc.data().accounts || [];
      const account = accounts.find(acc => acc.id === accountId);
      
      if (account) {
        return account.name;
      }
    }
    
    console.log(`ℹ️ Account ID "${accountId}" not found`);
    return null;
  } catch (error) {
    console.error('❌ Error resolving account name:', error);
    return null;
  }
}

// Helper function to resolve payment method ID to name
async function resolvePaymentMethodName(clientId, paymentMethodId) {
  if (!paymentMethodId) return null;
  
  try {
    const db = await getDb();
    
    console.log(`🔍 DEBUG: Attempting to resolve payment method - clientId: "${clientId}", paymentMethodId: "${paymentMethodId}"`);
    console.log(`🔍 DEBUG: Full path: clients/${clientId}/paymentMethods/${paymentMethodId}`);
    
    const paymentMethodDoc = await db.collection(`clients/${clientId}/paymentMethods`)
      .doc(paymentMethodId)
      .get();
    
    console.log(`🔍 DEBUG: Document exists: ${paymentMethodDoc.exists}`);
    
    if (paymentMethodDoc.exists) {
      const data = paymentMethodDoc.data();
      console.log(`💳 Found payment method data:`, data);
      return data.name;
    }
    
    console.log(`ℹ️ Payment Method ID "${paymentMethodId}" not found in clients/${clientId}/paymentMethods`);
    return null;
  } catch (error) {
    console.error('❌ Error resolving payment method name:', error);
    return null;
  }
}

// Helper function to get category type (expense or income)
async function getCategoryType(clientId, categoryId, categoryName) {
  if (!categoryId && !categoryName) return null;
  
  try {
    const db = await getDb();
    let categoryDoc = null;
    
    if (categoryId) {
      // Try to get by ID first
      categoryDoc = await db.collection(`clients/${clientId}/categories`).doc(categoryId).get();
    } else if (categoryName) {
      // Fall back to name lookup
      const snapshot = await db.collection(`clients/${clientId}/categories`)
        .where('name', '==', categoryName)
        .limit(1)
        .get();
      if (!snapshot.empty) {
        categoryDoc = snapshot.docs[0];
      }
    }
    
    if (categoryDoc && categoryDoc.exists) {
      const categoryData = categoryDoc.data();
      return categoryData.type || 'expense'; // Default to expense if no type
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error getting category type:', error);
    return null;
  }
}

/**
 * CRUD operations for transactions under a client
 */

// Create a transaction
async function createTransaction(clientId, data) {
  try {
    // Step 0: Prepare data for validation
    const preparedData = {
      ...data,
      clientId, // Add required context fields
      propertyId: data.propertyId || clientId, // Default to clientId if not multi-property
      enteredBy: data.enteredBy || 'system' // Ensure enteredBy is present
    };
    
    // VALIDATION: Check data against schema - REJECT any legacy fields
    const validation = validateDocument('transactions', preparedData, 'create');
    if (!validation.isValid) {
      console.error('❌ Transaction validation failed:', validation.errors);
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }
    
    const db = await getDb();
    
    // Step 1: Convert date to timestamp and amount to cents (using validated data)
    // Use DateService for proper timezone handling
    const normalizedData = {
      ...validation.data, // Start with validated data
      date: dateService.parseFromFrontend(validation.data.date || getMexicoDateString()),
      amount: dollarsToCents(validation.data.amount), // Convert to cents for storage
      // Only add updated timestamp - created should be handled by audit log
      updated: admin.firestore.Timestamp.now(),
      // Ensure payment method is included
      paymentMethod: validation.data.paymentMethod || null,
      // Include unit if provided (for multi-unit properties)
      unitId: validation.data.unit || validation.data.unitId || null
    };
    
    // Remove old createdAt field if present
    delete normalizedData.createdAt;
    
    // Debug: Log date normalization for HOA Dues
    if (normalizedData.categoryName === 'HOA Dues') {
      console.log(`🗓️ [TRANSACTION CREATE DEBUG] HOA Dues transaction dates:`, {
        originalDate: validation.data.date,
        normalizedDate: normalizedData.date,
        normalizedYear: normalizedData.date ? new Date(normalizedData.date._seconds * 1000).getFullYear() : 'no date',
        normalizedISO: normalizedData.date ? new Date(normalizedData.date._seconds * 1000).toISOString() : 'no date'
      });
      
      // Add duesDistribution if not present for HOA Dues
      if (!normalizedData.duesDistribution) {
        normalizedData.duesDistribution = [];
      }
    }
    
    // Step 2: Resolve IDs to names (new primary approach) or names to IDs (fallback)
    // Priority: If IDs are provided, resolve them to names. Otherwise, resolve names to IDs.
    
    let finalVendorId = normalizedData.vendorId;
    let finalVendorName = normalizedData.vendorName;
    let finalCategoryId = normalizedData.categoryId;
    let finalCategoryName = normalizedData.categoryName;
    let finalAccountId = normalizedData.accountId;
    let finalAccountName = normalizedData.accountName;
    let finalPaymentMethodId = normalizedData.paymentMethodId;
    let finalPaymentMethodName = normalizedData.paymentMethod;
    
    console.log('🔄 Resolving transaction field relationships (ID→name priority)');
    
    // Vendor resolution: ID→name first, then name→ID fallback
    if (finalVendorId && !finalVendorName) {
      finalVendorName = await resolveVendorName(clientId, finalVendorId);
      console.log(`🏢 Resolved vendor ID ${finalVendorId} → "${finalVendorName}"`);
    } else if (finalVendorName && !finalVendorId) {
      finalVendorId = await resolveVendorId(clientId, finalVendorName);
      console.log(`🏢 Resolved vendor name "${finalVendorName}" → ${finalVendorId}`);
    }
    
    // Category resolution: ID→name first, then name→ID fallback  
    if (finalCategoryId && !finalCategoryName) {
      finalCategoryName = await resolveCategoryName(clientId, finalCategoryId);
      console.log(`📊 Resolved category ID ${finalCategoryId} → "${finalCategoryName}"`);
    } else if (finalCategoryName && !finalCategoryId) {
      finalCategoryId = await resolveCategoryId(clientId, finalCategoryName);
      console.log(`📊 Resolved category name "${finalCategoryName}" → ${finalCategoryId}`);
    }
    
    // Account resolution: ID→name first, then use account mapping fallback
    if (finalAccountId && !finalAccountName) {
      finalAccountName = await resolveAccountName(clientId, finalAccountId);
      console.log(`💳 Resolved account ID ${finalAccountId} → "${finalAccountName}"`);
    }
    
    // Payment method resolution: ID→name first
    if (finalPaymentMethodId && !finalPaymentMethodName) {
      finalPaymentMethodName = await resolvePaymentMethodName(clientId, finalPaymentMethodId);
      console.log(`💳 Resolved payment method ID ${finalPaymentMethodId} → "${finalPaymentMethodName}"`);
    }
    
    // Store both ID and name in the normalized data
    normalizedData.vendorId = finalVendorId;
    normalizedData.vendorName = finalVendorName || '';
    normalizedData.categoryId = finalCategoryId;
    normalizedData.categoryName = finalCategoryName || '';
    normalizedData.accountId = finalAccountId;
    normalizedData.accountName = finalAccountName || '';
    normalizedData.paymentMethodId = finalPaymentMethodId || null;
    normalizedData.paymentMethod = finalPaymentMethodName || '';
    
    console.log('✅ Field resolution complete:', {
      vendor: `${finalVendorId} | "${finalVendorName}"`,
      category: `${finalCategoryId} | "${finalCategoryName}"`,
      account: `${finalAccountId} | "${finalAccountName}"`,
      paymentMethod: `${finalPaymentMethodId} | "${finalPaymentMethodName}"`
    });
    
    // Step 2.1: Handle split transaction allocations
    if (normalizedData.allocations && Array.isArray(normalizedData.allocations) && normalizedData.allocations.length > 0) {
      console.log('🔄 Processing split transaction allocations:', normalizedData.allocations);
      
      // Validate allocations structure and convert amounts to cents
      for (let i = 0; i < normalizedData.allocations.length; i++) {
        const allocation = normalizedData.allocations[i];
        if (!allocation.categoryName || typeof allocation.amount !== 'number' || allocation.amount === 0) {
          throw new Error(`Invalid allocation at index ${i}: must have categoryName and non-zero amount`);
        }
        // Convert allocation amount from dollars to cents for consistency
        allocation.amount = dollarsToCents(allocation.amount);
      }
      
      // Validate that allocations sum equals transaction amount
      const allocationsTotal = normalizedData.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
      if (allocationsTotal !== normalizedData.amount) {
        throw new Error(`Allocations total (${allocationsTotal} cents) does not equal transaction amount (${normalizedData.amount} cents)`);
      }
      
      // Resolve category relationships for all allocations (ID→name priority)
      for (let allocation of normalizedData.allocations) {
        if (allocation.categoryId && !allocation.categoryName) {
          allocation.categoryName = await resolveCategoryName(clientId, allocation.categoryId);
          console.log(`🔄 Allocation resolved category ID ${allocation.categoryId} → "${allocation.categoryName}"`);
        } else if (allocation.categoryName && !allocation.categoryId) {
          allocation.categoryId = await resolveCategoryId(clientId, allocation.categoryName);
          console.log(`🔄 Allocation resolved category name "${allocation.categoryName}" → ${allocation.categoryId}`);
        }
      }
      
      // Set category to "-Split-" for split transactions
      normalizedData.categoryName = "-Split-";
      normalizedData.categoryId = null; // Clear single category ID since this is split
      
      console.log(`✅ Split transaction validated: ${normalizedData.allocations.length} allocations totaling ${allocationsTotal} cents`);
    }
    
    // Step 2.5: Apply proper accounting sign conventions based on category type
    // BYPASSED ON 2025-07-10: Using sign convention from source data (Google Sheets)
    // The import data already has correct signs: negative for expenses, positive for income
    // Keeping this code commented for reference but not applying any sign changes
    /*
    const categoryType = await getCategoryType(clientId, categoryId, normalizedData.categoryName);
    
    if (categoryType === 'expense') {
      // Expenses should be negative
      normalizedData.amount = -Math.abs(normalizedData.amount);
      normalizedData.transactionType = 'expense';
      console.log(`💸 Applied expense sign convention: ${normalizedData.categoryName} → ${normalizedData.amount} cents`);
    } else if (categoryType === 'income') {
      // Income should be positive
      normalizedData.amount = Math.abs(normalizedData.amount);
      normalizedData.transactionType = 'income';
      console.log(`💰 Applied income sign convention: ${normalizedData.categoryName} → ${normalizedData.amount} cents`);
    } else {
      // Default to expense if category type unknown
      normalizedData.amount = -Math.abs(normalizedData.amount);
      normalizedData.transactionType = 'expense';
      console.log(`⚠️ Unknown category type, defaulting to expense: ${normalizedData.categoryName} → ${normalizedData.amount} cents`);
    }
    */
    
    // Using the sign from the source data as-is
    console.log(`📊 Using amount as provided: ${normalizedData.categoryName} → ${normalizedData.amount} cents`);
    
    // Note: transactionType is deprecated - using 'type' field only
    // normalizedData.transactionType = normalizedData.amount >= 0 ? 'income' : 'expense';
    
    // Step 3: Apply account mapping (accountType → accountId + account)
    const mappedData = applyAccountMapping(normalizedData);
    
    // Step 4: Validate account fields
    const accountValidation = validateAccountFields(mappedData);
    if (!accountValidation.isValid) {
      console.error('❌ Account validation failed:', accountValidation.errors);
      throw new Error(`Account validation failed: ${accountValidation.errors.join(', ')}`);
    }
    
    console.log('✅ Account mapping applied:', {
      accountType: mappedData.accountType,
      accountId: mappedData.accountId,
      accountName: mappedData.accountName
    });
    
    // Generate document ID using transaction date + current time for uniqueness
    // Use the date string from the data (already in YYYY-MM-DD format)
    // and just add current time for uniqueness
    let dateString = data.date;
    
    // Validate date string format
    if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      // Fallback to current date if invalid
      const now = getNow();
      dateString = now.toLocaleDateString("en-CA", {
        timeZone: "America/Cancun",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      });
      console.log('🕐 [DEBUG] Invalid date format, using current date:', dateString);
    }
    
    console.log('🕐 [DEBUG] Generating transaction ID with date:', dateString);
    
    const txnId = await generateTransactionId(dateString);
    console.log('🕐 [DEBUG] Generated transaction ID:', txnId);
    
    // Use a transaction to ensure consistency between transaction and account balance
    await db.runTransaction(async (transaction) => {
      // Add the transaction with new ID format
      const txnRef = db.collection(`clients/${clientId}/transactions`).doc(txnId);
      const transactionData = {
        ...mappedData,
        documents: mappedData.documents || [] // Use actual documents array from data
      };
      
      console.log('💾 About to save transaction data:', transactionData);
      transaction.set(txnRef, transactionData);
      
      // Update account balance if accountId is specified (now always available due to mapping)
      if (mappedData.accountId && typeof mappedData.amount === 'number') {
        try {
          await updateAccountBalance(clientId, mappedData.accountId, mappedData.amount);
          console.log(`✅ Updated account balance for ${mappedData.accountId}: ${mappedData.amount}`);
        } catch (balanceError) {
          console.error('❌ Error updating account balance:', balanceError);
          // Log the error but don't fail the transaction
          // Account might not exist yet if this is an old transaction being imported
        }
      }
      // For backward compatibility: use account field if accountId is not available
      else if (mappedData.account && typeof mappedData.amount === 'number' && !mappedData.accountId) {
        try {
          await updateAccountBalance(clientId, mappedData.account, mappedData.amount);
        } catch (balanceError) {
          console.error('❌ Error updating account balance using legacy account name:', balanceError);
        }
      }
      
    });

    const auditSuccess = await writeAuditLog({
      module: 'transactions',
      action: 'create',
      parentPath: `clients/${clientId}/transactions/${txnId}`,
      docId: txnId,
      friendlyName: validation.data.categoryName || 'Unnamed Transaction',
      notes: `Created transaction record${mappedData.accountName ? ` and updated ${mappedData.accountName} balance` : ''}`,
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for createTransaction.');
    }

    return txnId;
  } catch (error) {
    console.error('❌ Error creating transaction:', error);
    return null;
  }
}

// Update a transaction
async function updateTransaction(clientId, txnId, newData) {
  try {
    // VALIDATION: Check update data against schema - REJECT any legacy fields
    const validation = validateDocument('transactions', newData, 'update');
    if (!validation.isValid) {
      console.error('❌ Transaction update validation failed:', validation.errors);
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }
    
    const db = await getDb();
    const txnRef = db.doc(`clients/${clientId}/transactions/${txnId}`);
    
    // Get the original transaction
    const originalDoc = await txnRef.get();
    if (!originalDoc.exists) {
      throw new Error(`Transaction ${txnId} not found`);
    }
    const originalData = originalDoc.data();
    
    // Prepare update data with conversions (using validated data)
    const normalizedData = {
      ...validation.data
    };
    
    // Convert amount to cents if provided
    if (validation.data.amount !== undefined) {
      normalizedData.amount = dollarsToCents(validation.data.amount);
    }
    
    // Convert dates to timestamps
    if (validation.data.date) {
      normalizedData.date = convertToTimestamp(validation.data.date);
    }
    
    // Resolve field relationships (ID→name priority for updates)
    if (validation.data.vendorId !== undefined || validation.data.vendorName !== undefined ||
        validation.data.categoryId !== undefined || validation.data.categoryName !== undefined ||
        validation.data.accountId !== undefined || validation.data.paymentMethodId !== undefined) {
      
      console.log('🔄 Resolving updated field relationships (ID→name priority)');
      
      // Vendor resolution: ID→name first, then name→ID fallback
      if (validation.data.vendorId !== undefined) {
        if (validation.data.vendorId) {
          normalizedData.vendorId = validation.data.vendorId;
          normalizedData.vendorName = await resolveVendorName(clientId, validation.data.vendorId) || '';
          console.log(`🏢 Updated vendor ID ${validation.data.vendorId} → "${normalizedData.vendorName}"`);
        } else {
          normalizedData.vendorId = null;
          normalizedData.vendorName = '';
        }
      } else if (validation.data.vendorName !== undefined) {
        normalizedData.vendorName = validation.data.vendorName;
        if (validation.data.vendorName) {
          normalizedData.vendorId = await resolveVendorId(clientId, validation.data.vendorName);
          console.log(`🏢 Updated vendor name "${validation.data.vendorName}" → ${normalizedData.vendorId}`);
        } else {
          normalizedData.vendorId = null;
        }
      }
      
      // Category resolution: ID→name first, then name→ID fallback
      if (validation.data.categoryId !== undefined) {
        if (validation.data.categoryId) {
          normalizedData.categoryId = validation.data.categoryId;
          normalizedData.categoryName = await resolveCategoryName(clientId, validation.data.categoryId) || '';
          console.log(`📊 Updated category ID ${validation.data.categoryId} → "${normalizedData.categoryName}"`);
        } else {
          normalizedData.categoryId = null;
          normalizedData.categoryName = '';
        }
      } else if (validation.data.categoryName !== undefined) {
        normalizedData.categoryName = validation.data.categoryName;
        if (validation.data.categoryName) {
          normalizedData.categoryId = await resolveCategoryId(clientId, validation.data.categoryName);
          console.log(`📊 Updated category name "${validation.data.categoryName}" → ${normalizedData.categoryId}`);
        } else {
          normalizedData.categoryId = null;
        }
      }
      
      // Account resolution: ID→name first
      if (validation.data.accountId !== undefined) {
        if (validation.data.accountId) {
          normalizedData.accountId = validation.data.accountId;
          normalizedData.accountName = await resolveAccountName(clientId, validation.data.accountId) || '';
          console.log(`💳 Updated account ID ${validation.data.accountId} → "${normalizedData.accountName}"`);
        } else {
          normalizedData.accountId = null;
          normalizedData.accountName = '';
        }
      }
      
      // Payment method resolution: ID→name first
      if (validation.data.paymentMethodId !== undefined) {
        if (validation.data.paymentMethodId) {
          normalizedData.paymentMethodId = validation.data.paymentMethodId;
          normalizedData.paymentMethod = await resolvePaymentMethodName(clientId, validation.data.paymentMethodId) || '';
          console.log(`💳 Updated payment method ID ${validation.data.paymentMethodId} → "${normalizedData.paymentMethod}"`);
        } else {
          normalizedData.paymentMethodId = null;
          normalizedData.paymentMethod = '';
        }
      }
    }
    
    // Always update the updated timestamp
    normalizedData.updated = convertToTimestamp(getNow());
    
    // Use a transaction to ensure consistency
    await db.runTransaction(async (transaction) => {
      // Update the transaction document
      transaction.update(txnRef, normalizedData);
      
      // Handle account balance updates
      // Get account identifiers - prefer accountId, fall back to account name
      const originalAccountId = originalData.accountId || originalData.account;
      const newAccountId = normalizedData.accountId || normalizedData.account || originalData.accountId || originalData.account;
      
      // Case 1: Amount changed, same account
      if (newAccountId === originalAccountId && 
          normalizedData.amount !== undefined &&
          normalizedData.amount !== originalData.amount && 
          newAccountId) {
        
        const amountDifference = normalizedData.amount - originalData.amount;
        if (amountDifference !== 0) {
          try {
            // Note: updateAccountBalance expects cents now
            await updateAccountBalance(clientId, newAccountId, amountDifference);
            console.log(`Updated ${newAccountId} balance by ${amountDifference} cents`);
          } catch (balanceError) {
            console.error('❌ Error updating account balance:', balanceError);
          }
        }
      } 
      // Case 2: Account changed
      else if (newAccountId !== originalAccountId) {
        // Remove amount from old account if it exists
        if (originalAccountId) {
          try {
            await updateAccountBalance(clientId, originalAccountId, -originalData.amount);
            console.log(`Removed ${originalData.amount} from ${originalAccountId}`);
          } catch (balanceError) {
            console.error(`❌ Error updating old account (${originalAccountId}) balance:`, balanceError);
          }
        }
        
        // Add amount to new account if it exists
        if (newAccountId) {
          try {
            const amountToAdd = normalizedData.amount !== undefined ? normalizedData.amount : originalData.amount;
            await updateAccountBalance(clientId, newAccountId, amountToAdd);
            console.log(`Added ${amountToAdd} cents to ${newAccountId}`);
          } catch (balanceError) {
            console.error(`❌ Error updating new account (${newAccountId}) balance:`, balanceError);
          }
        }
      }
    });

    const auditSuccess = await writeAuditLog({
      module: 'transactions',
      action: 'update',
      parentPath: `clients/${clientId}/transactions/${txnId}`,
      docId: txnId,
      friendlyName: validation.data.categoryName || originalData.categoryName || 'Unnamed Transaction',
      notes: 'Updated transaction record',
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for updateTransaction.');
    }

    return true;
  } catch (error) {
    console.error('❌ Error updating transaction:', error);
    return false;
  }
}

// Delete a transaction with conditional HOA Dues cleanup
async function deleteTransaction(clientId, txnId) {
  console.log(`🚀 [BACKEND] deleteTransaction called: clientId=${clientId}, txnId=${txnId}`);
  
  // 🔍 BACKEND DELETE: Entry point logging
  console.log('🔍 BACKEND DELETE: Starting transaction deletion:', {
    clientId,
    transactionId: txnId,
    timestamp: getNow().toISOString()
  });
  
  try {
    const db = await getDb();
    const txnRef = db.doc(`clients/${clientId}/transactions/${txnId}`);
    
    // Get the original transaction before deleting
    const originalDoc = await txnRef.get();
    if (!originalDoc.exists) {
      console.log(`❌ [BACKEND] Transaction ${txnId} not found`);
      throw new Error(`Transaction ${txnId} not found`);
    }
    const originalData = originalDoc.data();
    
    console.log(`📄 [BACKEND] Transaction data:`, {
      id: txnId,
      category: originalData.category,
      metadata: originalData.metadata,
      creditBalanceAdded: originalData.creditBalanceAdded
    });
    
    // Check if this is an HOA Dues transaction requiring special cleanup
    const isHOATransaction = originalData.category === 'HOA Dues' || 
                            originalData.metadata?.type === 'hoa_dues';
    
    // 🔍 BACKEND DELETE: Transaction detection analysis
    console.log('🔍 BACKEND DELETE: Transaction analysis:', {
        transactionId: txnId,
        category: originalData?.category,
        metadataType: originalData?.metadata?.type,
        isHOADetected: isHOATransaction,
        fullTransactionData: JSON.stringify(originalData, null, 2)
    });
                            
    // Check if this is a Water Bills transaction requiring special cleanup
    // For split transactions, check allocations array for water bills allocations
    const hasWaterAllocations = originalData.allocations?.some(alloc => 
      alloc.categoryId === 'water_bills' || 
      alloc.categoryId === 'water-consumption' ||
      alloc.categoryName === 'Water Consumption' ||
      alloc.type === 'water_bill' ||
      alloc.type === 'water_penalty' ||
      alloc.type === 'water_credit' ||
      alloc.metadata?.processingStrategy === 'water_bills'
    ) || false;
    
    const isWaterTransaction = originalData.categoryId === 'water_payments' || 
                              originalData.categoryName === 'Water Payments' ||
                              originalData.categoryId === 'water-consumption' ||
                              originalData.categoryName === 'Water Consumption' ||
                              originalData.category === 'water_bills' ||
                              hasWaterAllocations; // Check allocations for split transactions
                            
    console.log(`🏠 [BACKEND] HOA Transaction check: ${isHOATransaction}`);
    console.log(`💧 [BACKEND] Water Transaction check: ${isWaterTransaction}`);
    if (isHOATransaction) {
      console.log(`🏠 [BACKEND] HOA metadata:`, originalData.metadata);
    }
    if (isWaterTransaction) {
      console.log(`💧 [BACKEND] Water transaction data:`, {
        unitId: originalData.unitId,
        amount: originalData.amount,
        description: originalData.description
      });
    }
    
    let hoaCleanupExecuted = false;
    let hoaCleanupDetails = null;
    let waterCleanupExecuted = false;
    let waterCleanupDetails = null;
    let creditReversalExecuted = false;
    let creditReversalAmount = 0;
    let creditBalanceBefore = 0;
    
    // ══════════════════════════════════════════════════════════════════════
    // CREDIT REVERSAL FIRST (Simple → Complex Pattern)
    // ══════════════════════════════════════════════════════════════════════
    // For Water Bills transactions, reverse credit changes BEFORE the complex
    // bill cleanup transaction. If the transaction fails, we can easily rollback
    // with a single credit update.
    // ══════════════════════════════════════════════════════════════════════
    
    if (isWaterTransaction && originalData.unitId) {
      try {
        console.log(`💳 [BACKEND] Step 1: Reversing credit balance changes for transaction ${txnId}`);
        
        // Get credit history to find this transaction's entries
        const creditHistory = await creditService.getCreditHistory(clientId, originalData.unitId, 100);
        
        // Find entries for this transaction
        const transactionEntries = creditHistory.history.filter(entry => 
          entry.transactionId === txnId
        );
        
        console.log(`💳 [BACKEND] Found ${transactionEntries.length} credit history entries for transaction ${txnId}`);
        
        if (transactionEntries.length > 0) {
          // Calculate reversal amount (reverse the effect of each entry)
          let reversalAmountCentavos = 0;
          for (const entry of transactionEntries) {
            // entry.amount is in dollars, need to reverse it
            // If credit was added (+), we need to subtract (-) to reverse
            // If credit was used (-), we need to add (+) to restore
            reversalAmountCentavos -= (entry.amount * 100);
            console.log(`💳 [BACKEND] Reversing entry: ${entry.amount > 0 ? 'Added' : 'Used'} $${Math.abs(entry.amount)} (${entry.note})`);
          }
          
          console.log(`💳 [BACKEND] Total credit reversal: ${reversalAmountCentavos} centavos (${reversalAmountCentavos / 100} pesos)`);
          
          if (reversalAmountCentavos !== 0) {
            // Store balance before for potential rollback
            creditBalanceBefore = creditHistory.currentBalance * 100; // Convert to centavos
            creditReversalAmount = reversalAmountCentavos;
            
            // Apply credit reversal using credit service
            const creditResult = await creditService.updateCreditBalance(
              clientId,
              originalData.unitId,
              reversalAmountCentavos,
              `${txnId}_reversal`,
              `Reversal of credit changes from deleted water bills transaction ${txnId}`,
              'waterBills'
            );
            
            creditReversalExecuted = true;
            console.log(`✅ [BACKEND] Credit reversal complete: ${creditResult.previousBalance} → ${creditResult.newBalance} centavos`);
          } else {
            console.log(`ℹ️ [BACKEND] No credit changes to reverse for transaction ${txnId}`);
          }
        } else {
          console.log(`ℹ️ [BACKEND] No credit history entries found for transaction ${txnId}`);
        }
      } catch (creditError) {
        console.error(`❌ [BACKEND] Error reversing credit balance:`, creditError);
        throw new Error(`Failed to reverse credit balance: ${creditError.message}`);
      }
    }
    
    // ══════════════════════════════════════════════════════════════════════
    // WATER BILLS TRANSACTION (Complex Operation)
    // ══════════════════════════════════════════════════════════════════════
    // Now execute the complex bill cleanup transaction. If this fails, we can
    // easily rollback the credit reversal above with a single credit update.
    // ══════════════════════════════════════════════════════════════════════
    
    try {
      console.log(`🔄 [BACKEND] Step 2: Starting complex bill cleanup transaction`);
      
      // Use a transaction to ensure consistency
      await db.runTransaction(async (transaction) => {
        // PHASE 1: ALL READS FIRST (as required by Firestore)
      
      // Read transaction document (already done above, but we have the data)
      
      // Read dues document if this is an HOA transaction requiring cleanup
      let duesDoc = null;
      let duesData = null;
      if (isHOATransaction && (originalData.metadata?.unitId || originalData.metadata?.id) && originalData.metadata?.year) {
        const unitId = originalData.metadata.unitId || originalData.metadata.id;
        const year = originalData.metadata.year;
        const duesPath = `clients/${clientId}/units/${unitId}/dues/${year}`;
        const duesRef = db.doc(duesPath);
        
        console.log(`🔍 [BACKEND] Reading dues document: ${duesPath}`);
        duesDoc = await transaction.get(duesRef);
        
        if (duesDoc.exists) {
          duesData = duesDoc.data();
          console.log(`📊 [BACKEND] Current dues data:`, {
            creditBalance: duesData.creditBalance,
            paymentsCount: duesData.payments?.length || 0
          });
        } else {
          console.warn(`⚠️ [BACKEND] Dues document not found at ${duesPath} - HOA cleanup will be skipped`);
        }
      }
      
      // Read water bill documents if this is a Water Bills transaction requiring cleanup
      let waterBillDocs = [];
      if (isWaterTransaction && originalData.unitId) {
        console.log(`🔍 [BACKEND] Searching for water bills paid by transaction ${txnId} for unit ${originalData.unitId}`);
        
        // Query all water bill documents to find those with payments from this transaction
        const billsSnapshot = await db.collection('clients').doc(clientId)
          .collection('projects').doc('waterBills')
          .collection('bills')
          .get();
        
        for (const billDoc of billsSnapshot.docs) {
          const billDocData = await transaction.get(billDoc.ref);
          if (billDocData.exists) {
            const billData = billDocData.data();
            const unitBill = billData.bills?.units?.[originalData.unitId];
            
            // Check if this bill has ANY payment from our transaction
            // Bills have a payments array, not a lastPayment object
            const hasPaymentFromTransaction = unitBill?.payments?.some(
              payment => payment.transactionId === txnId
            );
            
            if (hasPaymentFromTransaction) {
              console.log(`💧 [BACKEND] Found water bill ${billDoc.id} paid by transaction ${txnId}`);
              waterBillDocs.push({
                ref: billDoc.ref,
                id: billDoc.id,
                data: billData,
                unitBill: unitBill
              });
            }
          }
        }
        
        console.log(`💧 [BACKEND] Found ${waterBillDocs.length} water bills to reverse for transaction ${txnId}`);
      }
      
      // PHASE 2: ALL WRITES SECOND
      
      // Delete the transaction
      transaction.delete(txnRef);
      
      // Reverse the effect on account balance
      const accountId = originalData.accountId || originalData.account;
      if (accountId && typeof originalData.amount === 'number') {
        try {
          await updateAccountBalance(clientId, accountId, -originalData.amount);
          console.log(`💰 [BACKEND] Reversed balance effect on ${accountId} by ${-originalData.amount}`);
        } catch (balanceError) {
          console.error('❌ [BACKEND] Error updating account balance on delete:', balanceError);
        }
      }
      
      // Execute HOA Dues cleanup if applicable
      if (isHOATransaction && duesDoc && duesData && (originalData.metadata?.unitId || originalData.metadata?.id) && originalData.metadata?.year) {
        const unitId = originalData.metadata.unitId || originalData.metadata.id;
        console.log(`🧹 [BACKEND] Starting HOA cleanup for Unit: ${unitId}, Year: ${originalData.metadata.year}`);
        
        // 🧹 BACKEND CLEANUP: HOA cleanup function entry
        console.log('🧹 BACKEND CLEANUP: HOA cleanup function called:', {
          clientId,
          transactionId: txnId,
          functionExecuting: 'executeHOADuesCleanupWrite',
          unitId,
          year: originalData.metadata.year,
          duesDocExists: !!duesDoc,
          duesDataExists: !!duesData
        });
        
        hoaCleanupDetails = executeHOADuesCleanupWrite(
          transaction, 
          duesDoc.ref, 
          duesData, 
          originalData, 
          txnId
        );
        hoaCleanupExecuted = true;
        console.log(`✅ [BACKEND] HOA Dues cleanup prepared for transaction ${txnId}`, hoaCleanupDetails);
      } else if (isHOATransaction) {
        console.log(`⚠️ [BACKEND] HOA transaction detected but cleanup skipped:`, {
          hasUnitId: !!(originalData.metadata?.unitId || originalData.metadata?.id),
          hasYear: !!originalData.metadata?.year,
          duesDocExists: !!duesDoc?.exists,
          metadata: originalData.metadata
        });
      }
      
      // Execute Water Bills cleanup if applicable
      if (isWaterTransaction && waterBillDocs.length > 0 && originalData.unitId) {
        console.log(`🧹 [BACKEND] Starting Water Bills cleanup for Unit: ${originalData.unitId}`);
        
        waterCleanupDetails = await executeWaterBillsCleanupWrite(
          transaction, 
          waterBillDocs, 
          originalData, 
          txnId,
          clientId
        );
        waterCleanupExecuted = true;
        console.log(`✅ [BACKEND] Water Bills cleanup prepared for transaction ${txnId}`, waterCleanupDetails);
      } else if (isWaterTransaction) {
        console.log(`⚠️ [BACKEND] Water transaction detected but cleanup skipped:`, {
          hasUnitId: !!originalData.unitId,
          billDocsFound: waterBillDocs.length,
          transactionId: txnId
        });
      }
      });
      
      console.log(`✅ [BACKEND] Complex bill cleanup transaction completed successfully`);
      
    } catch (transactionError) {
      // ══════════════════════════════════════════════════════════════════════
      // ROLLBACK CREDIT REVERSAL (Simple → Complex Pattern)
      // ══════════════════════════════════════════════════════════════════════
      // Transaction failed! Rollback the credit reversal we did earlier.
      // This is a single, simple operation.
      // ══════════════════════════════════════════════════════════════════════
      
      console.error(`❌ [BACKEND] Transaction failed:`, transactionError);
      
      if (creditReversalExecuted && creditReversalAmount !== 0) {
        console.log(`🔄 [BACKEND] Rolling back credit reversal: restoring ${-creditReversalAmount} centavos`);
        
        try {
          // Reverse the reversal (restore original change)
          await creditService.updateCreditBalance(
            clientId,
            originalData.unitId,
            -creditReversalAmount, // Negative to undo the reversal
            `${txnId}_rollback`,
            `Rollback of credit reversal due to transaction deletion failure for ${txnId}`,
            'waterBills'
          );
          
          console.log(`✅ [BACKEND] Credit balance rolled back successfully`);
        } catch (rollbackError) {
          console.error(`❌❌ [BACKEND] CRITICAL: Failed to rollback credit balance:`, rollbackError);
          console.error(`❌❌ [BACKEND] Manual intervention required! Unit ${originalData.unitId} credit balance may be incorrect.`);
          // Don't throw - we want to report the original transaction error
        }
      }
      
      throw transactionError; // Re-throw the original error
    }

    // 🔄 SURGICAL UPDATE: Trigger after Firestore transaction commits
    // This ensures aggregatedData (including lastPenaltyUpdate) is updated after delete
    if (waterCleanupExecuted && waterCleanupDetails?.affectedUnits?.length > 0) {
      try {
        console.log(`🔄 [BACKEND] Starting surgical update for ${waterCleanupDetails.affectedUnits.length} unit(s) after payment reversal`);
        
        // Dynamic import of waterDataService (singleton instance)
        const { waterDataService } = await import('../services/waterDataService.js');
        
        // Group affected units by year for efficient updates
        const updatesByYear = new Map();
        for (const affected of waterCleanupDetails.affectedUnits) {
          if (!updatesByYear.has(affected.year)) {
            updatesByYear.set(affected.year, []);
          }
          updatesByYear.get(affected.year).push({
            unitId: affected.unitId,
            monthId: affected.monthId
          });
        }
        
        console.log(`🔄 [BACKEND] Affected years for surgical update:`, Array.from(updatesByYear.keys()));
        
        // Trigger surgical updates per year
        for (const [year, affectedUnitsAndMonths] of updatesByYear) {
          console.log(`🔄 [BACKEND] Surgical update for year ${year} with ${affectedUnitsAndMonths.length} unit-month combination(s)`);
          
          await waterDataService.updateAggregatedDataAfterPayment(
            clientId,
            year,
            affectedUnitsAndMonths
          );
          
          console.log(`✅ [BACKEND] Surgical update completed for year ${year}`);
        }
        
        console.log(`✅ [BACKEND] All surgical updates completed successfully after payment reversal`);
        
      } catch (recalcError) {
        console.error('❌ [BACKEND] Error during surgical update:', recalcError);
        console.error('   Error details:', recalcError.message);
        console.error('   Stack trace:', recalcError.stack);
        // Don't fail the delete - transaction already committed successfully
        // Payment reversal is complete, surgical update is a cache optimization
        console.warn('⚠️ [BACKEND] Payment deleted successfully but surgical update failed');
        console.warn('   Bills returned to unpaid status correctly');
        console.warn('   Manual refresh or full recalc will fix aggregatedData');
      }
    }

    // Enhanced audit logging with cleanup details
    let auditNotes = `Deleted transaction record${originalData.account ? ` and adjusted ${originalData.account} balance` : ''}`;
    
    if (hoaCleanupExecuted && hoaCleanupDetails) {
      auditNotes += `. HOA cleanup: reversed ${Math.abs(hoaCleanupDetails.creditBalanceReversed || 0)} credit balance, cleared ${hoaCleanupDetails.monthsCleared || 0} month(s) of payment data`;
    }
    
    if (waterCleanupExecuted && waterCleanupDetails) {
      auditNotes += `. Water Bills cleanup: reset ${waterCleanupDetails.billsReversed || 0} bill(s) payment data`;
      if (creditReversalExecuted && creditReversalAmount !== 0) {
        auditNotes += `, reversed credit balance by ${creditReversalAmount / 100} pesos`;
      }
    }

    let auditAction = 'delete';
    if (hoaCleanupExecuted) auditAction = 'delete_with_hoa_cleanup';
    if (waterCleanupExecuted) auditAction = 'delete_with_water_cleanup';
    if (hoaCleanupExecuted && waterCleanupExecuted) auditAction = 'delete_with_multi_cleanup';

    const auditSuccess = await writeAuditLog({
      module: 'transactions',
      action: auditAction,
      parentPath: `clients/${clientId}/transactions/${txnId}`,
      docId: txnId,
      friendlyName: originalData.category || 'Unnamed Transaction',
      notes: auditNotes,
      metadata: {
        ...(hoaCleanupExecuted ? {
          hoaCleanupExecuted: true,
          unitAffected: originalData.metadata?.unitId || originalData.metadata?.id,
          yearAffected: originalData.metadata?.year,
          creditBalanceReversed: hoaCleanupDetails?.creditBalanceReversed,
          monthsCleared: hoaCleanupDetails?.monthsCleared
        } : {}),
        ...(waterCleanupExecuted ? {
          waterCleanupExecuted: true,
          waterUnitAffected: originalData.unitId,
          billsReversed: waterCleanupDetails?.billsReversed,
          creditReversalExecuted: creditReversalExecuted,
          creditBalanceReversed: creditReversalAmount
        } : {})
      }
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for deleteTransaction.');
    }

    // Trigger balance rebuild for HOA transactions to ensure account balances are accurate
    if (hoaCleanupExecuted) {
      console.log(`🔄 [BACKEND] Triggering balance rebuild after HOA transaction deletion`);
      try {
        await rebuildBalances(clientId);
        console.log(`✅ [BACKEND] Balance rebuild completed after HOA transaction deletion`);
      } catch (rebuildError) {
        console.error(`❌ [BACKEND] Error during balance rebuild after HOA transaction deletion:`, rebuildError);
        // Don't fail the deletion if balance rebuild fails, just log the error
      }
    }
    
    // Invalidate water data cache for water transactions to reflect payment reversals
    if (waterCleanupExecuted) {
      console.log(`🔄 [BACKEND] Invalidating water data cache after water transaction deletion`);
      try {
        const { waterDataService } = await import('../services/waterDataService.js');
        waterDataService.invalidate(clientId);
        console.log(`✅ [BACKEND] Water data cache invalidated after water transaction deletion`);
      } catch (cacheError) {
        console.error(`❌ [BACKEND] Error invalidating water cache after water transaction deletion:`, cacheError);
        // Don't fail the deletion if cache invalidation fails, just log the error
      }
    }

    return true;
  } catch (error) {
    console.error('❌ Error deleting transaction:', error);
    return false;
  }
}

/**
 * Extract HOA month data from transaction - supports both allocations and duesDistribution
 * @param {Object} transactionData - Transaction data
 * @returns {Array} Array of month objects with { month, unitId, year, amount }
 */
function getHOAMonthsFromTransaction(transactionData) {
  // Check for allocations first (new format)
  if (transactionData.allocations && transactionData.allocations.length > 0) {
    return transactionData.allocations
      .filter(allocation => allocation.type === "hoa_month")
      .map(allocation => ({
        month: allocation.data.month,
        unitId: allocation.data.unitId,
        year: allocation.data.year,
        amount: allocation.amount
      }));
  }
  
  // Fallback to duesDistribution (legacy format)
  if (transactionData.duesDistribution && transactionData.duesDistribution.length > 0) {
    return transactionData.duesDistribution.map(dues => ({
      month: dues.month,
      unitId: dues.unitId,
      year: dues.year,
      amount: dues.amount
    }));
  }
  
  // No HOA month data found
  return [];
}

// HOA Dues cleanup logic for transaction deletion (write-only operations)
function executeHOADuesCleanupWrite(firestoreTransaction, duesRef, duesData, originalData, txnId) {
  // 🧹 CREDIT BALANCE DEBUG: Add entry point logging
  console.log('🧹 CLEANUP: Starting HOA dues cleanup write:', {
    transactionId: txnId,
    transactionData: {
      category: originalData.category,
      amount: originalData.amount,
      metadata: originalData.metadata,
      allocations: originalData.allocations,
      duesDistribution: originalData.duesDistribution
    },
    duesData: {
      creditBalance: duesData.creditBalance,
      creditHistoryLength: duesData.creditBalanceHistory?.length || 0,
      paymentsType: Array.isArray(duesData.payments) ? 'array' : typeof duesData.payments
    }
  });
  const currentCreditBalance = duesData.creditBalance || 0;
  // Handle payments as either array or object with numeric keys
  let currentPayments = duesData.payments || [];
  
  // If payments is an object with numeric keys (0-11), convert to array
  if (!Array.isArray(currentPayments) && typeof currentPayments === 'object') {
    console.log(`🔄 [BACKEND] Converting payments object to array`);
    const paymentsArray = [];
    for (let i = 0; i < 12; i++) {
      paymentsArray[i] = currentPayments[i] || null;
    }
    currentPayments = paymentsArray;
  }
  
  console.log(`🧹 [BACKEND] Processing HOA cleanup write operations for transaction ${txnId}`);
  console.log(`📊 [BACKEND] Clean architecture: Credit data NOT stored in transactions`);
  console.log(`📊 [BACKEND] Will reverse credit changes by analyzing credit history in dues document`);
  
  // 1. CLEAN ARCHITECTURE: Analyze credit history to determine what to reverse
  let creditBalanceReversal = 0;
  let newCreditBalance = currentCreditBalance;
  
  // Find credit history entries for this transaction
  const creditHistory = duesData.creditBalanceHistory || [];
  const transactionEntries = creditHistory.filter(entry => entry.transactionId === txnId);
  
  // 💰 BACKEND CREDIT: Credit balance processing
  const targetUnitId = originalData.metadata?.unitId || originalData.metadata?.id;
  console.log('💰 BACKEND CREDIT: Credit balance processing:', {
    unitId: targetUnitId,
    creditHistoryLength: duesData.creditBalanceHistory?.length || 0,
    entriesToReverse: transactionEntries.length,
    currentCreditBalance: duesData.creditBalance,
    entriesFound: transactionEntries.map(e => ({
      id: e.id,
      type: e.type,
      amount: e.amount,
      transactionId: e.transactionId
    }))
  });
  
  console.log(`💳 [BACKEND] Found ${transactionEntries.length} credit history entries for transaction ${txnId}`);
  
  // Reverse all credit changes for this transaction
  for (const entry of transactionEntries) {
    if (entry.type === 'credit_added') {
      creditBalanceReversal -= entry.amount; // Subtract added credit
      console.log(`💳 [BACKEND] Reversing credit addition: -${entry.amount} centavos`);
    } else if (entry.type === 'credit_used') {
      creditBalanceReversal += entry.amount; // Restore used credit
      console.log(`💳 [BACKEND] Restoring used credit: +${entry.amount} centavos`);
    } else if (entry.type === 'credit_repair') {
      creditBalanceReversal -= entry.amount; // Reverse repair
      console.log(`💳 [BACKEND] Reversing credit repair: -${entry.amount} centavos`);
    }
  }
  
  newCreditBalance = Math.max(0, currentCreditBalance + creditBalanceReversal);
  console.log(`💳 [BACKEND] Total reversal: ${creditBalanceReversal} centavos (${creditBalanceReversal / 100} pesos)`);
  console.log(`💳 [BACKEND] Balance update: ${currentCreditBalance} → ${newCreditBalance} centavos (${currentCreditBalance / 100} → ${newCreditBalance / 100} pesos)`);
  
  // 2. Clear payment entries for this transaction
  let monthsCleared = 0;
  const updatedPayments = [...currentPayments]; // Make a copy
  
  // Get the months this transaction paid for - check allocations first, fallback to duesDistribution
  const monthsData = getHOAMonthsFromTransaction(originalData);
  console.log(`📅 [BACKEND] Transaction ${txnId} paid for ${monthsData.length} months`);
  
  // Clear each month that was paid by this transaction
  monthsData.forEach(monthData => {
    const monthIndex = monthData.month - 1; // Convert month (1-12) to index (0-11)
    const payment = updatedPayments[monthIndex];
    
    if (payment && payment.reference === txnId) {
      console.log(`🗑️ [BACKEND] Clearing payment for month ${monthData.month} (index ${monthIndex})`);
      monthsCleared++;
      
      // Clear the payment entry
      updatedPayments[monthIndex] = {
        amount: 0,
        date: null,
        notes: null,
        paid: false,
        reference: null
      };
    } else {
      console.log(`⚠️ [BACKEND] Month ${monthData.month} payment reference doesn't match: expected ${txnId}, found ${payment?.reference}`);
    }
  });
  
  // 3. Handle credit balance history updates
  let creditBalanceHistory = Array.isArray(duesData.creditBalanceHistory) ? [...duesData.creditBalanceHistory] : [];
  
  // Remove entries that match the deleted transaction
  creditBalanceHistory = creditBalanceHistory.filter(entry => entry.transactionId !== txnId);
  
  // Add reversal entry if there was a credit balance change
  if (creditBalanceReversal !== 0) {
    const reversalType = creditBalanceReversal > 0 ? 'credit_restored' : 'credit_removed';
    const description = creditBalanceReversal > 0 ? 'from Transaction Deletion' : 'from Transaction Deletion';
    
    creditBalanceHistory.push({
      id: randomUUID(),
      timestamp: getNow().toISOString(),
      transactionId: txnId + '_reversal',
      type: reversalType,
      amount: Math.abs(creditBalanceReversal),  // Store in centavos
      description: description,
      balanceBefore: currentCreditBalance,  // Store in centavos
      balanceAfter: newCreditBalance,     // Store in centavos
      notes: `Transaction ${txnId} deleted`
    });
  }
  
  // 📝 CREDIT BALANCE DEBUG: Add detailed update operations logging
  console.log('📝 UPDATE: Applying credit balance changes:', {
    unitId: originalData.metadata?.unitId || originalData.metadata?.id,
    balanceBefore: currentCreditBalance,
    balanceAfter: newCreditBalance,
    creditBalanceReversal: creditBalanceReversal,
    historyEntriesRemoved: transactionEntries.length,
    newHistoryEntry: creditBalanceReversal !== 0 ? {
      type: creditBalanceReversal > 0 ? 'credit_restored' : 'credit_removed',
      amount: Math.abs(creditBalanceReversal),
      transactionId: txnId + '_reversal'
    } : null,
    monthsCleared: monthsCleared,
    finalHistoryLength: creditBalanceHistory.length
  });

  // 4. Update dues document with cleaned data and history
  const updateData = {
    creditBalance: newCreditBalance,
    payments: updatedPayments,
    creditBalanceHistory: creditBalanceHistory
  };
  
  console.log(`💾 [BACKEND] Updating dues document: creditBalance ${currentCreditBalance} -> ${newCreditBalance}, cleared ${monthsCleared} payments, updated notes`);
  firestoreTransaction.update(duesRef, updateData);
  
  // 🎯 BACKEND CLEANUP COMPLETE: Final summary
  console.log('🎯 BACKEND CLEANUP COMPLETE: HOA cleanup summary:', {
    transactionId: txnId,
    unitId: originalData.metadata?.unitId || originalData.metadata?.id,
    year: originalData.metadata?.year,
    creditBalanceReversed: `${creditBalanceReversal} centavos (${creditBalanceReversal / 100} pesos)`,
    newCreditBalance: `${newCreditBalance} centavos (${newCreditBalance / 100} pesos)`,
    monthsCleared: monthsCleared,
    success: true
  });
  
  return {
    creditBalanceReversed: creditBalanceReversal,
    monthsCleared: monthsCleared,
    newCreditBalance: newCreditBalance
  };
}

// Water Bills cleanup logic for transaction deletion (bill reversal only - credit handled separately)
async function executeWaterBillsCleanupWrite(firestoreTransaction, waterBillDocs, originalData, txnId, clientId) {
  console.log(`🧹 [BACKEND] Processing Water Bills cleanup write operations for transaction ${txnId}`);
  
  let billsReversed = 0;
  const affectedUnits = []; // Track for surgical update
  
  const unitId = originalData.unitId;
  
  // Process each water bill document that was paid by this transaction
  for (const billDoc of waterBillDocs) {
    const { ref: billRef, id: billId, data: billData, unitBill } = billDoc;
    
    console.log(`💧 [BACKEND] Reversing payment for water bill ${billId} Unit ${unitId}`);
    
    // Find the payment in the payments array that matches our transaction
    const payments = unitBill.payments || [];
    const paymentToReverse = payments.find(p => p.transactionId === txnId);
    
    if (!paymentToReverse) {
      console.warn(`⚠️ [BACKEND] Skipping bill ${billId} - no payment found with transaction ID ${txnId}`);
      continue;
    }
    
    // Calculate reversed amounts
    const paidAmountToReverse = paymentToReverse.amount || 0;
    const basePaidToReverse = paymentToReverse.baseChargePaid || 0;
    const penaltyPaidToReverse = paymentToReverse.penaltyPaid || 0;
    
    // Calculate new totals after reversal
    const newPaidAmount = Math.max(0, (unitBill.paidAmount || 0) - paidAmountToReverse);
    const newBasePaid = Math.max(0, (unitBill.basePaid || 0) - basePaidToReverse);
    const newPenaltyPaid = Math.max(0, (unitBill.penaltyPaid || 0) - penaltyPaidToReverse);
    
    // Remove this payment from the payments array
    const updatedPayments = payments.filter(p => p.transactionId !== txnId);
    
    // Determine new status
    const totalAmount = unitBill.totalAmount || 0;
    let newStatus = 'unpaid';
    if (newPaidAmount >= totalAmount) {
      newStatus = 'paid';
    } else if (newPaidAmount > 0) {
      newStatus = 'partial';
    }
    
    console.log(`💧 [BACKEND] Bill ${billId} reversal: paid ${unitBill.paidAmount} → ${newPaidAmount}, status ${unitBill.status} → ${newStatus}`);
    
    // Update the water bill document
    firestoreTransaction.update(billRef, {
      [`bills.units.${unitId}.paidAmount`]: newPaidAmount,
      [`bills.units.${unitId}.basePaid`]: newBasePaid,
      [`bills.units.${unitId}.penaltyPaid`]: newPenaltyPaid,
      [`bills.units.${unitId}.status`]: newStatus,
      [`bills.units.${unitId}.payments`]: updatedPayments // Remove the payment from the array
    });
    
    billsReversed++;
    
    // Track affected unit for surgical update
    const [year, month] = billId.split('-');
    affectedUnits.push({
      unitId,
      year: parseInt(year),
      monthId: billId
    });
  }
  
  // ══════════════════════════════════════════════════════════════════════
  // Return details for surgical update trigger
  // ══════════════════════════════════════════════════════════════════════
  
  console.log(`✅ [BACKEND] Water Bills cleanup complete: ${billsReversed} bills reversed`);
  
  return {
    billsReversed: billsReversed,
    affectedUnits: affectedUnits // Return for surgical update
  };
}

// HOA Dues cleanup logic for transaction deletion (DEPRECATED - kept for reference)
async function executeHOADuesCleanup(firestoreTransaction, db, clientId, originalData, txnId) {
  const unitId = originalData.metadata.unitId;
  const year = originalData.metadata.year;
  const duesPath = `clients/${clientId}/units/${unitId}/dues/${year}`;
  const duesRef = db.doc(duesPath);
  
  console.log(`Executing HOA cleanup for transaction ${txnId} - Unit: ${unitId}, Year: ${year}`);
  
  // Get current dues document
  const duesDoc = await firestoreTransaction.get(duesRef);
  if (!duesDoc.exists) {
    console.warn(`Dues document not found at ${duesPath} - skipping HOA cleanup`);
    return { creditBalanceReversed: 0, monthsCleared: 0 };
  }
  
  const duesData = duesDoc.data();
  const currentCreditBalance = duesData.creditBalance || 0;
  const currentPayments = duesData.payments || [];
  
  // 1. Calculate credit balance reversal
  const creditBalanceReversal = -(originalData.creditBalanceAdded || 0);
  const newCreditBalance = Math.max(0, currentCreditBalance + creditBalanceReversal);
  
  // 2. Clear payment entries for this transaction
  let monthsCleared = 0;
  const updatedPayments = currentPayments.map(payment => {
    if (payment && payment.transactionId === txnId) {
      monthsCleared++;
      console.log(`Clearing payment for month ${payment.month}`);
      // Clear the payment entry but preserve the array structure
      return {
        month: payment.month,
        paid: 0,
        date: null,
        transactionId: null,
        notes: null
      };
    }
    return payment;
  });
  
  // 3. Update dues document with cleaned data
  const updateData = {
    creditBalance: newCreditBalance,
    payments: updatedPayments
  };
  
  console.log(`Updating dues document: creditBalance ${currentCreditBalance} -> ${newCreditBalance}, cleared ${monthsCleared} payments`);
  firestoreTransaction.update(duesRef, updateData);
  
  return {
    creditBalanceReversed: creditBalanceReversal,
    monthsCleared: monthsCleared,
    newCreditBalance: newCreditBalance
  };
}

// List all transactions
async function listTransactions(clientId) {
  try {
    const db = await getDb();
    const snapshot = await db.collection(`clients/${clientId}/transactions`).get();
    const transactions = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      
      // Build transaction with ONLY valid fields
      const transaction = {
        id: doc.id,
        ...data,
        // Keep amount in cents - frontend expects cents for formatCurrency
        amount: data.amount,
        // NO LEGACY FIELDS - only proper field names
        vendorId: data.vendorId || null,
        vendorName: data.vendorName || '',
        categoryId: data.categoryId || null,
        categoryName: data.categoryName || '',
        accountId: data.accountId || null,
        accountName: data.accountName || '',
        accountType: data.accountType || '',
        // Other fields
        type: data.type || 'expense',
        paymentMethod: data.paymentMethod || '',
        unitId: data.unitId || null,
        notes: data.notes || '',
        // Format dates using DateService for frontend
        date: formatDateField(data.date),
        created: formatDateField(data.created),
        updated: formatDateField(data.updated),
        // Metadata
        enteredBy: data.enteredBy || '',
        documents: data.documents || []
      };
      
      transactions.push(transaction);
    });

    return transactions;
  } catch (error) {
    console.error('❌ Error listing transactions:', error);
    return [];
  }
}

// Get a transaction by ID
async function getTransaction(clientId, txnId) {
  try {
    const db = await getDb();
    const txnRef = db.doc(`clients/${clientId}/transactions/${txnId}`);
    const txnDoc = await txnRef.get();

    if (!txnDoc.exists) {
      return null;
    }

    const data = txnDoc.data();
    return {
      id: txnDoc.id,
      ...data,
      // Keep amount in cents - frontend expects cents for formatCurrency
      amount: data.amount,
      // NO LEGACY FIELDS - only proper field names
      vendorId: data.vendorId || null,
      vendorName: data.vendorName || '',
      categoryId: data.categoryId || null,
      categoryName: data.categoryName || '',
      accountId: data.accountId || null,
      accountName: data.accountName || '',
      accountType: data.accountType || '',
      // Other fields
      type: data.type || 'expense',
      paymentMethod: data.paymentMethod || '',
      unitId: data.unitId || null,
      notes: data.notes || '',
      // Format dates using DateService for frontend
      date: formatDateField(data.date),
      created: formatDateField(data.created),
      updated: formatDateField(data.updated),
      // Metadata
      enteredBy: data.enteredBy || '',
      documents: data.documents || []
    };
  } catch (error) {
    console.error('❌ Error getting transaction:', error);
    return null;
  }
}

/**
 * Add document reference to transaction
 */
async function addDocumentToTransaction(clientId, transactionId, documentId, documentInfo) {
  try {
    const db = await getDb();
    const txnRef = db.doc(`clients/${clientId}/transactions/${transactionId}`);
    
    // Add document reference to transaction's documents array
    await txnRef.update({
      documents: admin.firestore.FieldValue.arrayUnion({
        id: documentId,
        filename: documentInfo.filename || documentInfo.originalName,
        uploadedAt: documentInfo.uploadedAt || getNow(),
        type: documentInfo.documentType || 'receipt'
      })
    });
    
    console.log(`✅ Added document ${documentId} to transaction ${transactionId}`);
    return true;
  } catch (error) {
    console.error('❌ Error adding document to transaction:', error);
    return false;
  }
}

/**
 * Remove document reference from transaction
 */
async function removeDocumentFromTransaction(clientId, transactionId, documentId) {
  try {
    const db = await getDb();
    const txnRef = db.doc(`clients/${clientId}/transactions/${transactionId}`);
    
    // Get current transaction to find the document reference
    const txnDoc = await txnRef.get();
    if (!txnDoc.exists) {
      console.warn(`Transaction ${transactionId} not found`);
      return false;
    }
    
    const txnData = txnDoc.data();
    const documents = txnData.documents || [];
    
    // Filter out the document to remove
    const updatedDocuments = documents.filter(doc => doc.id !== documentId);
    
    await txnRef.update({
      documents: updatedDocuments
    });
    
    console.log(`✅ Removed document ${documentId} from transaction ${transactionId}`);
    return true;
  } catch (error) {
    console.error('❌ Error removing document from transaction:', error);
    return false;
  }
}

/**
 * Get all documents for a transaction
 */
async function getTransactionDocuments(clientId, transactionId) {
  try {
    const db = await getDb();
    const txnRef = db.doc(`clients/${clientId}/transactions/${transactionId}`);
    const txnDoc = await txnRef.get();
    
    if (!txnDoc.exists) {
      return [];
    }
    
    const txnData = txnDoc.data();
    return txnData.documents || [];
  } catch (error) {
    console.error('❌ Error getting transaction documents:', error);
    return [];
  }
}

/**
 * Delete transaction with cascading document cleanup
 */
async function deleteTransactionWithDocuments(clientId, transactionId) {
  try {
    const db = await getDb();
    
    // Get transaction with its document references
    const txnRef = db.doc(`clients/${clientId}/transactions/${transactionId}`);
    const txnDoc = await txnRef.get();

    if (!txnDoc.exists) {
      console.warn(`Transaction ${transactionId} not found`);
      return false;
    }
    
    const txnData = txnDoc.data();
    // Handle documents field - it could be an array or object, ensure it's always an array
    let documentsFromTxn = txnData.documents || [];
    if (!Array.isArray(documentsFromTxn)) {
      // If documents is an object, extract the values or keys
      documentsFromTxn = Object.values(documentsFromTxn).filter(Boolean);
    }
    
    console.log(`🔍 [DELETE] Transaction documents array:`, documentsFromTxn);
    
    // Also find documents that link to this transaction (in case bidirectional linking is broken)
    console.log(`🔍 [DELETE] Finding documents linked to transaction ${transactionId}...`);
    const linkedDocsSnapshot = await db.collection(`clients/${clientId}/documents`)
      .where('linkedTo.type', '==', 'transaction')
      .where('linkedTo.id', '==', transactionId)
      .get();
    
    const documentsFromQuery = linkedDocsSnapshot.docs.map(doc => doc.id);
    console.log(`🔍 [DELETE] Documents found via linkedTo query:`, documentsFromQuery);
    
    // Combine both sources and remove duplicates
    const allDocuments = [...new Set([...documentsFromTxn, ...documentsFromQuery])];
    console.log(`🔍 [DELETE] All documents to delete:`, allDocuments);
    
    // Delete all associated documents
    if (allDocuments.length > 0) {
      console.log(`🗑️ [DELETE] Deleting ${allDocuments.length} documents associated with transaction ${transactionId}`);
      
      const documentDeletionPromises = allDocuments.map(async (documentId) => {
        try {
          console.log(`🗑️ Processing document deletion: ${documentId}`);
          
          // First, get the document to retrieve storage reference
          const docRef = db.doc(`clients/${clientId}/documents/${documentId}`);
          const docSnapshot = await docRef.get();
          
          let storageRef = null;
          if (docSnapshot.exists) {
            const docData = docSnapshot.data();
            storageRef = docData.storageRef;
            console.log(`📄 Document ${documentId} found with storage ref: ${storageRef}`);
          }
          
          // Delete from Firestore
          await docRef.delete();
          console.log(`✅ Deleted document from Firestore: ${documentId}`);
          
          // Delete from Storage (if storageRef exists)
          if (storageRef) {
            try {
              // Use the properly initialized Firebase app
              const app = await getApp();
              const bucket = app.storage().bucket();
              await bucket.file(storageRef).delete();
              console.log(`🗑️ Deleted file from storage: ${storageRef}`);
            } catch (storageError) {
              console.warn(`⚠️ Could not delete storage file ${storageRef}:`, storageError.message);
            }
          }
          
          console.log(`✅ Deleted document ${documentId} completely`);
        } catch (docError) {
          console.error(`❌ Failed to delete document ${documentId}:`, docError);
        }
      });
      
      await Promise.all(documentDeletionPromises);
    }
    
    // Now delete the transaction using the existing deleteTransaction function
    return await deleteTransaction(clientId, transactionId);
    
  } catch (error) {
    console.error('❌ Error deleting transaction with documents:', error);
    return false;
  }
}

// Query transactions with filters
async function queryTransactions(clientId, filters = {}) {
  try {
    const db = await getDb();
    let query = db.collection(`clients/${clientId}/transactions`);
    
    // Apply date range filter if provided
    if (filters.startDate) {
      const startTimestamp = convertToTimestamp(filters.startDate);
      query = query.where('date', '>=', startTimestamp);
    }
    
    if (filters.endDate) {
      const endTimestamp = convertToTimestamp(filters.endDate);
      query = query.where('date', '<=', endTimestamp);
    }
    
    // Apply category filter if provided
    if (filters.category) {
      query = query.where('category', '==', filters.category);
    }
    
    // Apply vendor filter if provided
    if (filters.vendor) {
      query = query.where('vendor', '==', filters.vendor);
    }
    
    // Apply amount range filter if provided (remember to convert to cents)
    if (filters.minAmount !== undefined) {
      const minCents = dollarsToCents(filters.minAmount);
      query = query.where('amount', '>=', minCents);
    }
    
    if (filters.maxAmount !== undefined) {
      const maxCents = dollarsToCents(filters.maxAmount);
      query = query.where('amount', '<=', maxCents);
    }
    
    // Order by date descending by default
    query = query.orderBy('date', 'desc');
    
    const snapshot = await query.get();
    const transactions = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      
      // Build transaction with proper field mapping (same as listTransactions)
      const transaction = {
        id: doc.id,
        ...data,
        // Keep amount in cents - frontend expects cents for formatCurrency
        amount: data.amount,
        // NO LEGACY FIELDS - only proper field names
        vendorId: data.vendorId || null,
        vendorName: data.vendorName || '',
        categoryId: data.categoryId || null,
        categoryName: data.categoryName || '',
        accountId: data.accountId || null,
        accountName: data.accountName || '',
        accountType: data.accountType || '',
        // Other fields
        type: data.type || 'expense',
        paymentMethod: data.paymentMethod || '',
        unitId: data.unitId || null,
        notes: data.notes || '',
        // Format dates using DateService for frontend
        date: formatDateField(data.date),
        created: formatDateField(data.created),
        updated: formatDateField(data.updated),
        // Metadata
        enteredBy: data.enteredBy || '',
        documents: data.documents || []
      };
      
      transactions.push(transaction);
    });
    
    return transactions;
  } catch (error) {
    console.error('❌ Error querying transactions:', error);
    return [];
  }
}

export { 
  createTransaction, 
  updateTransaction, 
  deleteTransaction, 
  listTransactions,
  getTransaction,
  queryTransactions,
  addDocumentToTransaction,
  removeDocumentFromTransaction,
  getTransactionDocuments,
  deleteTransactionWithDocuments
};