#!/usr/bin/env node

/**
 * Modern Transaction Import Script
 * Uses transactionsController.createTransaction for all operations
 * Maintains exact same transaction ID generation as controller
 * 
 * Phase 4: Complex Import Script Modernization
 * Date: 2025-09-29
 */

import { initializeApp, getApp } from '../../backend/firebase.js';
import { createTransaction } from '../../backend/controllers/transactionsController.js';
import { databaseFieldMappings } from '../../backend/utils/databaseFieldMappings.js';
import { 
  createMockContext, 
  createDateService, 
  ProgressLogger,
  handleControllerResponse,
  convertLegacyDate,
  loadJsonData,
  createImportSummary,
  validateImportData
} from './utils/import-utils-modern.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { generateTransactionId } = databaseFieldMappings;

// Configuration
const CONFIG = {
  dataDir: process.env.DATA_DIR || 'MTCdata',
  transactionsFile: 'Transactions.json',
  mappingFile: 'transaction-id-mapping.json',
  crossRefFile: 'HOA_Transaction_CrossRef.json',
  debug: process.env.DEBUG === 'true'
};

/**
 * Extract unit ID from unit string
 */
function extractUnitId(unitString) {
  if (!unitString) return null;
  
  // Handle formats like "1A", "PH4D", "Unit 1A", etc.
  const match = unitString.match(/\b(\w+\d+\w*)\b/);
  return match ? match[1] : unitString.trim();
}

/**
 * Parse vendor and category names from the data
 */
async function resolveVendorAndCategory(clientId, transaction) {
  const result = {
    vendorId: null,
    vendorName: transaction.Vendor || null,
    categoryId: null,
    categoryName: transaction.Category || null,
    categoryType: 'expense' // default
  };

  // Special handling for split transactions
  if (result.categoryName && (result.categoryName.toLowerCase() === 'split' || result.categoryName === '-Split-')) {
    result.categoryId = '-split-';
    result.categoryName = '-Split-';
    return result;
  }

  // Note: In a real implementation, we would query the database here
  // For now, we'll let the controller handle the resolution
  // by passing the names and letting it do the lookup

  // Determine category type based on category name
  // This is simplified - in reality would query the categories collection
  if (result.categoryName) {
    const incomeCategoryNames = ['Income', 'Rental Income', 'Other Income', 'Interest Income'];
    if (incomeCategoryNames.some(name => result.categoryName.toLowerCase().includes(name.toLowerCase()))) {
      result.categoryType = 'income';
    }
  }

  return result;
}

/**
 * Build split allocations from transaction data
 */
function buildSplitAllocations(transaction) {
  // Check if this is a split transaction
  if (!transaction.Splits || !Array.isArray(transaction.Splits)) {
    return null;
  }

  return transaction.Splits.map((split, index) => ({
    id: `alloc_${String(index + 1).padStart(3, '0')}`,
    type: 'category',
    categoryId: split.categoryId || null,
    categoryName: split.Category || split.categoryName,
    amount: Math.round(parseFloat(split.Amount) * 100), // Convert to cents
    percentage: split.Percentage || null,
    notes: split.Notes || null
  }));
}

/**
 * Import a single transaction
 */
async function importTransaction(clientId, transaction, index, dateService, transactionLookup) {
  try {
    const { req, res } = createMockContext(clientId);

    // Resolve vendor and category
    const { vendorId, vendorName, categoryId, categoryName, categoryType } = 
      await resolveVendorAndCategory(clientId, transaction);

    // Parse amount
    const amount = parseFloat(transaction.Amount);
    if (isNaN(amount)) {
      throw new Error(`Invalid amount: ${transaction.Amount}`);
    }

    // Convert date to ISO format
    const transactionDate = convertLegacyDate(transaction.Date, dateService);
    if (!transactionDate) {
      throw new Error(`Invalid date: ${transaction.Date}`);
    }

    // Build transaction data matching controller expectations
    const transactionData = {
      // Core fields
      date: transactionDate,
      amount: amount, // Controller expects dollars, will convert to cents
      
      // Category and vendor
      categoryId: categoryId,
      categoryName: categoryName,
      vendorId: vendorId,
      vendorName: vendorName,
      
      // Account information
      accountId: transaction.accountId || null,
      accountName: transaction.Account || transaction.accountName,
      accountType: transaction.accountType || 'bank',
      
      // Additional fields
      notes: transaction.Notes || '',
      type: amount >= 0 ? 'income' : 'expense',
      
      // Document references if any
      documents: transaction.Documents || []
    };

    // Handle HOA Dues special metadata
    if (categoryName === 'HOA Dues' && transaction.Unit) {
      const unitId = extractUnitId(transaction.Unit);
      if (unitId) {
        transactionData.unitId = unitId;
        transactionData.metadata = {
          type: 'hoa_dues',
          originalUnit: transaction.Unit,
          sequenceNumber: transaction[''] || transaction.sequence || index + 1
        };
      }
    }

    // Handle split transactions
    const splits = buildSplitAllocations(transaction);
    if (splits && splits.length > 0) {
      transactionData.allocations = splits;
      transactionData.allocationSummary = {
        totalAllocated: splits.reduce((sum, s) => sum + s.amount, 0),
        allocationCount: splits.length,
        allocationType: 'category',
        hasMultipleTypes: false
      };
    }

    // Set request body
    req.body = transactionData;

    // Call the controller
    const transactionId = await createTransaction(clientId, transactionData);
    
    if (!transactionId) {
      throw new Error('Failed to create transaction - no ID returned');
    }

    // Store in lookup for cross-referencing
    const sequenceNumber = transaction[''] || transaction.sequence || index + 1;
    transactionLookup.bySequence[sequenceNumber] = {
      transactionId,
      amount: amount,
      date: transactionDate,
      category: categoryName,
      vendor: vendorName,
      account: transactionData.accountName
    };

    // Track HOA dues for cross-reference
    if (categoryName === 'HOA Dues' && transactionData.unitId) {
      transactionLookup.hoaDuesTransactions.push({
        transactionId,
        unitId: transactionData.unitId,
        amount: amount,
        date: transactionDate,
        sequenceNumber
      });
    }

    return { success: true, transactionId };
    
  } catch (error) {
    console.error(`Error importing transaction at index ${index}:`, error.message);
    if (CONFIG.debug) {
      console.error('Transaction data:', transaction);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Main import function
 */
async function importTransactions() {
  const startTime = Date.now();
  console.log('🚀 Starting Modern Transaction Import...\n');

  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const clientId = args[0];
    const environment = args[1] || 'dev';

    if (!clientId) {
      throw new Error('Usage: node import-transactions-modern.js <clientId> [environment]');
    }

    console.log(`📋 Configuration:`);
    console.log(`   Client: ${clientId}`);
    console.log(`   Environment: ${environment}`);
    console.log(`   Data Directory: ${CONFIG.dataDir}`);
    console.log(`   Debug Mode: ${CONFIG.debug}\n`);

    // Initialize Firebase
    process.env.SAMS_ENV = environment;
    await initializeApp();
    console.log('✅ Firebase initialized\n');

    // Initialize DateService
    const dateService = createDateService();

    // Load transaction data
    const dataPath = path.join(__dirname, CONFIG.dataDir, CONFIG.transactionsFile);
    console.log(`📄 Loading transactions from: ${dataPath}`);
    const transactions = await loadJsonData(dataPath);
    console.log(`✅ Loaded ${transactions.length} transactions\n`);

    // Validate data structure
    const validation = validateImportData(transactions, ['Date', 'Amount', 'Category']);
    if (!validation.valid) {
      throw new Error(`Data validation failed: ${validation.errors.join(', ')}`);
    }

    // Initialize progress tracking
    const progress = new ProgressLogger('Transaction Import', transactions.length);

    // Initialize transaction lookup for cross-referencing
    const transactionLookup = {
      generated: new Date().toISOString(),
      totalRecords: 0,
      bySequence: {},
      hoaDuesTransactions: []
    };

    // Import each transaction
    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i];
      const displayName = `${transaction.Date} - ${transaction.Category} - $${transaction.Amount}`;
      
      const result = await importTransaction(clientId, transaction, i, dateService, transactionLookup);
      
      if (result.success) {
        progress.logItem(displayName, 'success');
        transactionLookup.totalRecords++;
      } else {
        progress.logError(displayName, { message: result.error });
      }

      // Add small delay to avoid overwhelming the system
      if (i > 0 && i % 50 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Save transaction ID mapping
    const mappingPath = path.join(__dirname, CONFIG.mappingFile);
    await fs.writeFile(mappingPath, JSON.stringify(transactionLookup, null, 2));
    console.log(`\n📝 Saved transaction ID mapping to: ${mappingPath}`);

    // Save HOA dues cross-reference if any
    if (transactionLookup.hoaDuesTransactions.length > 0) {
      const crossRefData = {
        generated: transactionLookup.generated,
        totalRecords: transactionLookup.hoaDuesTransactions.length,
        bySequence: {}
      };

      // Build cross-reference by sequence number
      transactionLookup.hoaDuesTransactions.forEach(hoa => {
        crossRefData.bySequence[hoa.sequenceNumber] = {
          transactionId: hoa.transactionId,
          unitId: hoa.unitId,
          amount: hoa.amount,
          date: hoa.date
        };
      });

      const crossRefPath = path.join(__dirname, CONFIG.crossRefFile);
      await fs.writeFile(crossRefPath, JSON.stringify(crossRefData, null, 2));
      console.log(`📝 Saved HOA cross-reference to: ${crossRefPath}`);
    }

    // Display summary
    const summary = progress.logSummary();
    const importSummary = createImportSummary('import-transactions-modern.js', summary, startTime);
    
    console.log('\n✅ Transaction import completed!');
    console.log(JSON.stringify(importSummary, null, 2));

  } catch (error) {
    console.error('\n❌ Transaction import failed:', error.message);
    if (CONFIG.debug) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the import
importTransactions().catch(console.error);