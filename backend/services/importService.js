/*
 * File: /backend/services/importService.js
 * Purpose: Service for handling web-based import operations using real controllers
 */

import fs from 'fs/promises';
import path from 'path';
import admin from 'firebase-admin';
import { DateTime } from 'luxon';
import { DateService, getNow } from './DateService.js';
import { getFiscalYear, getFiscalYearBounds, validateFiscalYearConfig } from '../utils/fiscalYearUtils.js';
import { pesosToCentavos, centavosToPesos } from '../utils/currencyUtils.js';
import { validateCentavos, validateCentavosInObject } from '../utils/centavosValidation.js';
import { readFileFromFirebaseStorage, deleteImportFiles, findFileCaseInsensitive, writeFileToFirebaseStorage } from '../api/importStorage.js';
import { 
  augmentTransaction,
  augmentUnit,
  augmentCategory,
  augmentVendor,
  augmentUser,
  augmentHOADues,
  linkUsersToUnits,
  validateImportOrder
} from '../utils/data-augmentation-utils.js';
import {
  createTransaction,
  updateTransaction,
  createUnit,
  createCategory,
  createVendor,
  createUser,
  createYearEndBalance,
  createImportMetadata
} from '../controllers/index.js';
import {
  initializeYearDocument,
  recordDuesPayment
} from '../controllers/hoaDuesController.js';

export class ImportService {
  constructor(clientId, dataPath, user = null) {
    this.clientId = clientId;
    this.dataPath = dataPath;
    this.user = user; // Store user context for authenticated Storage operations
    this.dateService = new DateService({ timezone: 'America/Cancun' });
    this.results = {};
    this.onProgress = null; // Progress callback
    this.importScriptName = 'web-based-import-system'; // Track which import system created the data
    this.isFirebaseStorage = dataPath === 'firebase_storage'; // Check if using Firebase Storage
    this.clientConfigCache = null; // Cache client config to avoid repeated DB calls during import
  }
  
  /**
   * Get client config with caching and fallback to DB
   * @returns {Object} Client configuration data
   */
  async getClientConfig() {
    // Return cached config if available
    if (this.clientConfigCache) {
      return this.clientConfigCache;
    }
    
    // Fallback: Load from Firestore (for standalone component imports)
    try {
      const db = await this.getDb();
      const clientDoc = await db.doc(`clients/${this.clientId}`).get();
      if (clientDoc.exists) {
        this.clientConfigCache = clientDoc.data();
        console.log(`✅ Loaded client config from DB - Fiscal year starts in month ${this.clientConfigCache?.configuration?.fiscalYearStartMonth || 1}`);
        return this.clientConfigCache;
      }
    } catch (error) {
      console.warn(`⚠️  Could not load client config: ${error.message}`);
    }
    
    // Return default config if all else fails
    return { configuration: { fiscalYearStartMonth: 1 } };
  }

  /**
   * Helper to report progress
   */
  reportProgress(component, index, total, results) {
    // Report every item for better real-time feedback
    if (this.onProgress) {
      this.onProgress(component, 'importing', {
        total: total,
        processed: index + 1,
        percent: Math.round(((index + 1) / total) * 100),
        ...results
      });
    }
  }

  /**
   * Helper to create import metadata record
   */
  async createMetadataRecord(type, documentId, documentPath, originalData, source = 'import-script') {
    try {
      // Clean originalData to remove empty fields and invalid field names
      const cleanedOriginalData = {};
      if (originalData && typeof originalData === 'object') {
        for (const [key, value] of Object.entries(originalData)) {
          // Skip empty string keys and null/undefined values
          if (key && key.trim() !== '' && value !== null && value !== undefined) {
            // Use a safe field name if the original key is empty or invalid
            const safeKey = key.trim() === '' ? 'unnamed_field' : key;
            cleanedOriginalData[safeKey] = value;
          }
        }
      }

      const metadata = {
        type,
        documentId,
        documentPath,
        source,
        originalData: cleanedOriginalData,
        importScript: this.importScriptName
      };

      const result = await createImportMetadata(this.clientId, metadata);
      if (!result.success) {
        console.warn(`Failed to create metadata for ${type}/${documentId}:`, result.error);
      }
      return result;
    } catch (error) {
      console.warn(`Error creating metadata for ${type}/${documentId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Load JSON file from data path (file system or Firebase Storage)
   * Uses dynamic file discovery instead of hardcoded names
   */
  async loadJsonFile(filename) {
    try {
      let data;
      
      if (this.isFirebaseStorage) {
        // Read from Firebase Storage using case-insensitive lookup
        const directoryPath = `imports/${this.clientId}`;
        const actualFileName = await findFileCaseInsensitive(directoryPath, filename, this.user);
        
        if (!actualFileName) {
          throw new Error(`File not found: ${filename}`);
        }
        
        const filePath = `${directoryPath}/${actualFileName}`;
        const text = await readFileFromFirebaseStorage(filePath, this.user);
        data = JSON.parse(text);
      } else {
        // Read from file system (existing logic)
        const filePath = path.join(this.dataPath, filename);
        const text = await fs.readFile(filePath, 'utf-8');
        data = JSON.parse(text);
      }
      
      return data;
    } catch (error) {
      console.error(`❌ Error loading ${filename}:`, error.message);
      throw new Error(`Failed to load ${filename}: ${error.message}`);
    }
  }


  /**
   * Import client document
   */
  async importClient(user) {
    console.log('🏢 Importing client document...');
    const results = { success: 0, failed: 0, errors: [], total: 0 };
    
    try {
      const clientData = await this.loadJsonFile('Client.json');
      results.total = 1; // Client is a single document
      
      // Report starting
      if (this.onProgress) {
        this.onProgress('client', 'importing', { total: results.total, processed: 0 });
      }
      
      try {
        const db = await this.getDb();
        const clientRef = db.doc(`clients/${this.clientId}`);
        
        // Clean the client data - remove any fields that shouldn't be imported
        const cleanClientData = {
          ...clientData,
          updatedAt: getNow().toISOString(),
          updatedBy: 'import-script'
        };
        
        // Remove createdAt as it will be set by the system
        delete cleanClientData.createdAt;
        
        // Set the document
        await clientRef.set(cleanClientData);
        
        results.success++;
        console.log(`✅ Imported client document: ${this.clientId}`);
        
        // Create metadata record
        await this.createMetadataRecord(
          'client',
          this.clientId,
          `clients/${this.clientId}`,
          clientData
        );
        
      } catch (error) {
        results.failed++;
        results.errors.push(`Error importing client document: ${error.message}`);
      }
      
      // Report progress
      this.reportProgress('client', 0, results.total, results);
      
    } catch (error) {
      throw new Error(`Client document import failed: ${error.message}`);
    }
    
    return results;
  }

  /**
   * Import config collection
   */
  async importConfig(user) {
    console.log('⚙️ Importing config collection...');
    const results = { success: 0, failed: 0, errors: [], total: 0 };
    
    try {
      const configData = await this.loadJsonFile('Config.json');
      
      // Config should be an object where each key becomes a separate document
      // e.g., { activities: {...}, emailTemplates: {...} }
      const configKeys = Object.keys(configData);
      results.total = configKeys.length;
      
      // Report starting
      if (this.onProgress) {
        this.onProgress('config', 'importing', { total: results.total, processed: 0 });
      }
      
      const db = await this.getDb();
      const configRef = db.collection(`clients/${this.clientId}/config`);
      
      for (let i = 0; i < configKeys.length; i++) {
        const configKey = configKeys[i];
        const configItem = configData[configKey];
        
        try {
          // Clean the config data
          const cleanConfigData = {
            ...configItem,
            updatedAt: getNow().toISOString(),
            updatedBy: 'import-script'
          };
          
          // Remove createdAt as it will be set by the system
          delete cleanConfigData.createdAt;
          
          // Use the config key as the document ID (e.g., 'activities', 'emailTemplates')
          const docId = configKey;
          await configRef.doc(docId).set(cleanConfigData);
          
          results.success++;
          console.log(`✅ Imported config: ${docId}`);
          
          // Create metadata record
          await this.createMetadataRecord(
            'config',
            docId,
            `clients/${this.clientId}/config/${docId}`,
            configItem
          );
          
        } catch (error) {
          results.failed++;
          results.errors.push(`Error importing config item ${configKey}: ${error.message}`);
        }
        
        // Report progress
        this.reportProgress('config', i, results.total, results);
      }
      
      // Cache the client config for use during import (especially for fiscal year calculations)
      try {
        const db = await this.getDb();
        const clientDoc = await db.doc(`clients/${this.clientId}`).get();
        if (clientDoc.exists) {
          this.clientConfigCache = clientDoc.data();
          console.log(`✅ Cached client config - Fiscal year starts in month ${this.clientConfigCache?.configuration?.fiscalYearStartMonth || 1}`);
        }
      } catch (error) {
        console.warn(`⚠️  Could not cache client config: ${error.message}`);
      }
      
    } catch (error) {
      throw new Error(`Config collection import failed: ${error.message}`);
    }
    
    return results;
  }

  /**
   * Import payment types collection
   */
  async importPaymentTypes(user) {
    console.log('💳 Importing payment types collection...');
    const results = { success: 0, failed: 0, errors: [], total: 0 };
    
    try {
      const paymentTypesData = await this.loadJsonFile('paymentMethods.json');
      
      // Payment types can be either an array, a single object, or an object with keys
      let paymentTypesArray;
      if (Array.isArray(paymentTypesData)) {
        paymentTypesArray = paymentTypesData;
      } else if (paymentTypesData && typeof paymentTypesData === 'object') {
        // Check if it's a keyed object (like {wise: {...}, zelle: {...}})
        // vs a single payment type object
        const keys = Object.keys(paymentTypesData);
        if (keys.length > 0 && keys.some(key => !['_id', 'name', 'type', 'currency', 'details'].includes(key))) {
          // It's a keyed object, convert to array
          paymentTypesArray = Object.values(paymentTypesData);
        } else {
          // It's a single payment type object
          paymentTypesArray = [paymentTypesData];
        }
      } else {
        paymentTypesArray = [];
      }
      results.total = paymentTypesArray.length;
      
      // Report starting
      if (this.onProgress) {
        this.onProgress('paymentTypes', 'importing', { total: results.total, processed: 0 });
      }
      
      const db = await this.getDb();
      const paymentTypesRef = db.collection(`clients/${this.clientId}/paymentMethods`);
      
      for (let i = 0; i < paymentTypesArray.length; i++) {
        const paymentType = paymentTypesArray[i];
        try {
          // Clean the payment type data
          const cleanPaymentTypeData = {
            ...paymentType,
            status: "active",  // Set all imported payment methods to active
            updatedAt: getNow().toISOString(),
            updatedBy: 'import-script'
          };
          
          // Remove createdAt as it will be set by the system
          delete cleanPaymentTypeData.createdAt;
          
          // Use the payment type's ID or generate one
          const docId = paymentType.id || paymentType.name || `paymentType_${i}`;
          await paymentTypesRef.doc(docId).set(cleanPaymentTypeData);
          
          results.success++;
          console.log(`✅ Imported payment type: ${docId}`);
          
          // Create metadata record
          await this.createMetadataRecord(
            'paymentMethod',
            docId,
            `clients/${this.clientId}/paymentMethods/${docId}`,
            paymentType
          );
          
        } catch (error) {
          results.failed++;
          results.errors.push(`Error importing payment type ${i}: ${error.message}`);
        }
        
        // Report progress
        this.reportProgress('paymentTypes', i, results.total, results);
      }
      
    } catch (error) {
      throw new Error(`Payment types collection import failed: ${error.message}`);
    }
    
    return results;
  }

  /**
   * Import categories
   */
  async importCategories(user) {
    console.log('📁 Importing categories...');
    const results = { success: 0, failed: 0, errors: [], total: 0 };
    
    try {
      const categoriesData = await this.loadJsonFile('Categories.json');
      results.total = categoriesData.length;
      
      // Report starting
      if (this.onProgress) {
        this.onProgress('categories', 'importing', { total: results.total, processed: 0 });
      }
      
      for (let i = 0; i < categoriesData.length; i++) {
        const category = categoriesData[i];
        try {
          const augmentedData = augmentCategory(category, this.clientId);
          
          // Remove createdAt as controller adds it
          delete augmentedData.createdAt;
          
          // createCategory expects (clientId, data, user)
          const categoryId = await createCategory(
            this.clientId,
            augmentedData,
            user
          );
          
          if (categoryId) {
            results.success++;
            console.log(`✅ Imported category: ${augmentedData.name}`);
            
            // Create metadata record
            await this.createMetadataRecord(
              'category',
              categoryId,
              `clients/${this.clientId}/categories/${categoryId}`,
              category
            );
          } else {
            results.failed++;
            results.errors.push(`Failed to import category: ${augmentedData.name}`);
          }
          
          // Report progress using helper
          this.reportProgress('categories', i, results.total, results);
        } catch (error) {
          results.failed++;
          results.errors.push(`Error importing category ${category.Category}: ${error.message}`);
        }
      }
    } catch (error) {
      throw new Error(`Categories import failed: ${error.message}`);
    }
    
    return results;
  }

  /**
   * Import vendors
   */
  async importVendors(user) {
    console.log('🏢 Importing vendors...');
    const results = { success: 0, failed: 0, errors: [], total: 0 };
    
    try {
      const vendorsData = await this.loadJsonFile('Vendors.json');
      results.total = vendorsData.length;
      
      // Report starting
      if (this.onProgress) {
        this.onProgress('vendors', 'importing', { total: results.total, processed: 0 });
      }
      
      for (let i = 0; i < vendorsData.length; i++) {
        const vendor = vendorsData[i];
        try {
          const augmentedData = augmentVendor(vendor, this.clientId);
          
          // Remove createdAt as controller adds it
          delete augmentedData.createdAt;
          
          // createVendor expects (clientId, data, user)
          const vendorId = await createVendor(
            this.clientId,
            augmentedData,
            user
          );
          
          if (vendorId) {
            results.success++;
            console.log(`✅ Imported vendor: ${augmentedData.name}`);
            
            // Create metadata record
            await this.createMetadataRecord(
              'vendor',
              vendorId,
              `clients/${this.clientId}/vendors/${vendorId}`,
              vendor
            );
          } else {
            results.failed++;
            results.errors.push(`Failed to import vendor: ${augmentedData.name}`);
          }
          
          // Report progress using helper
          this.reportProgress('vendors', i, results.total, results);
        } catch (error) {
          results.failed++;
          results.errors.push(`Error importing vendor ${vendor.Vendor}: ${error.message}`);
        }
      }
    } catch (error) {
      throw new Error(`Vendors import failed: ${error.message}`);
    }
    
    return results;
  }

  /**
   * Import units
   */
  async importUnits(user) {
    console.log('🏠 Importing units...');
    const results = { success: 0, failed: 0, errors: [], total: 0 };
    
    try {
      const unitsData = await this.loadJsonFile('Units.json');
      const sizesData = await this.loadJsonFile('UnitSizes.json');
      results.total = unitsData.length;
      
      // Create lookup map for sizes
      const sizesMap = new Map(sizesData.map(s => [s.Unit, s]));
      
      // Report starting
      if (this.onProgress) {
        this.onProgress('units', 'importing', { total: results.total, processed: 0 });
      }
      
      for (let i = 0; i < unitsData.length; i++) {
        const unit = unitsData[i];
        try {
          const sizeData = sizesMap.get(unit.Unit) || {};
          const augmentedData = augmentUnit(unit, sizeData);
          
          // Remove createdAt as controller adds it
          delete augmentedData.createdAt;
          
          // createUnit expects (clientId, unitData, docId)
          const unitId = await createUnit(
            this.clientId,
            augmentedData,
            augmentedData.unitId // Use unitId from augmented data as document ID
          );
          
          if (unitId) {
            results.success++;
            console.log(`✅ Imported unit: ${augmentedData.unitName}`);
            
            // Create metadata record
            await this.createMetadataRecord(
              'unit',
              unitId,
              `clients/${this.clientId}/units/${unitId}`,
              { ...unit, ...sizeData }
            );
          } else {
            results.failed++;
            results.errors.push(`Failed to import unit: ${augmentedData.unitName}`);
          }
          
          // Report progress using helper
          this.reportProgress('units', i, results.total, results);
        } catch (error) {
          results.failed++;
          results.errors.push(`Error importing unit ${unit.Unit}: ${error.message}`);
        }
      }
    } catch (error) {
      throw new Error(`Units import failed: ${error.message}`);
    }
    
    return results;
  }

  /**
   * Import users
   */
  async importUsers(user) {
    console.log('👥 Importing users...');
    const results = { success: 0, failed: 0, errors: [] };
    
    try {
      const usersData = await this.loadJsonFile('MTCUsers.json');
      const unitsData = await this.loadJsonFile('Units.json');
      
      // Link users to units
      const userUnitMapping = linkUsersToUnits(usersData, unitsData);
      
      for (const mtcUser of usersData) {
        try {
          const mapping = userUnitMapping.find(m => m.user === mtcUser);
          const augmentedData = augmentUser(mapping, this.clientId);
          
          // Remove createdAt as controller adds it
          delete augmentedData.createdAt;
          
          // TODO: createUser is a route handler, not a direct function
          // Need to implement proper user creation for imports
          const userId = null; // await createUser(user, augmentedData);
          
          if (userId) {
            results.success++;
            console.log(`✅ Imported user: ${augmentedData.email}`);
          } else {
            results.failed++;
            results.errors.push(`Failed to import user: ${augmentedData.email}`);
          }
        } catch (error) {
          results.failed++;
          results.errors.push(`Error importing user ${mtcUser.Email}: ${error.message}`);
        }
      }
    } catch (error) {
      throw new Error(`Users import failed: ${error.message}`);
    }
    
    return results;
  }

  /**
   * Import transactions
   */
  async importTransactions(user, options = {}) {
    console.log('💰 Importing transactions...');
    const { dryRun = false, maxErrors = 3 } = options;
    const results = { success: 0, failed: 0, errors: [], total: 0 };
    
    // Initialize CrossRef structures
    const hoaCrossRef = {
      generated: getNow().toISOString(),
      totalRecords: 0,
      bySequence: {},
      byUnit: {}
    };
    
    const waterBillsCrossRef = {
      generated: getNow().toISOString(),
      totalRecords: 0,
      byPaymentSeq: {},  // PAY-* → transaction info
      byUnit: {}
    };
    
    if (dryRun) {
      console.log('🔍 DRY RUN MODE: No data will be written to Firebase');
    }
    
    try {
      const transactionsData = await this.loadJsonFile('Transactions.json');
      results.total = transactionsData.length;
      
      // Report starting
      if (this.onProgress) {
        this.onProgress('transactions', 'importing', { total: results.total, processed: 0 });
      }
      
      // Get lookup maps for vendor and category IDs
      const db = await this.getDb();
      const vendorMap = await this.getVendorLookupMap(db);
      const categoryMap = await this.getCategoryLookupMap(db);
      const accountMap = await this.getAccountsMapping();
      
      console.log(`📊 Loaded lookup maps: ${Object.keys(vendorMap).length} vendors, ${Object.keys(categoryMap).length} categories, ${Object.keys(accountMap).length} accounts`);
      console.log(`🔍 Sample vendor mappings:`, Object.keys(vendorMap).slice(0, 5));
      
      for (let i = 0; i < transactionsData.length; i++) {
        const transaction = transactionsData[i];
        
        try {
          // Resolve IDs from names with fallback logic
          let vendorId = vendorMap[transaction.Vendor] || null;
          let vendorName = transaction.Vendor;
          
          // If vendor not found, try to map to a real vendor or use fallback
          if (!vendorId) {
            const mappedVendor = this.mapDescriptionToVendor(transaction.Vendor);
            if (mappedVendor) {
              vendorId = vendorMap[mappedVendor] || null;
              vendorName = mappedVendor;
              if (vendorId) {
                console.log(`🔗 Mapped "${transaction.Vendor}" → "${mappedVendor}" (${vendorId})`);
              }
            }
            
            // If still no vendor, use "OTHER" as fallback
            if (!vendorId && vendorMap['OTHER']) {
              vendorId = vendorMap['OTHER'];
              vendorName = 'OTHER';
              console.log(`🔗 Fallback: "${transaction.Vendor}" → "OTHER" (${vendorId})`);
            }
          }
          
          const categoryId = categoryMap[transaction.Category] || null;
          const accountId = accountMap[transaction.Account]?.id || null;
          
          // Debug logging for first few transactions
          if (i < 5) {
            console.log(`🔍 Transaction ${i}:`);
            console.log(`   Vendor="${transaction.Vendor}", vendorId=${vendorId}`);
            console.log(`   Category="${transaction.Category}", categoryId=${categoryId}`);
            console.log(`   Account="${transaction.Account}", accountId=${accountId}`);
            console.log(`   Account exists in map: ${accountMap.hasOwnProperty(transaction.Account)}`);
          }
          
          // FAIL FAST: Stop import if account mapping fails
          if (!accountId) {
            const error = `❌ CRITICAL: No account mapping found for "${transaction.Account}" in transaction ${i}. Available accounts: ${Object.keys(accountMap).join(', ')}`;
            console.error(error);
            throw new Error(error);
          }
          
          const augmentedData = augmentTransaction(transaction, vendorId, categoryId, accountId, vendorName, accountMap, this.clientId);
          
          // Parse date properly - handle ISO format
          // NOTE: createTransaction expects string dates, not Firestore timestamps
          if (transaction.Date.includes('T') && transaction.Date.includes('Z')) {
            // ISO format: 2024-01-03T05:00:00.000Z - extract date part only
            // Split on 'T' to get just the date part: 2024-01-03
            augmentedData.date = transaction.Date.split('T')[0];
          } else {
            // Legacy format: M/d/yyyy - pass as-is to createTransaction
            augmentedData.date = transaction.Date;
          }
          
          // Remove createdAt as controller adds it
          delete augmentedData.createdAt;
          
          let transactionId = null;
          
          if (!dryRun) {
            // createTransaction expects (clientId, data)
            transactionId = await createTransaction(
              this.clientId,
              augmentedData
            );
            
            if (transactionId) {
              results.success++;
              console.log(`✅ Imported transaction: ${augmentedData.description}`);
              
              // Create metadata record
              await this.createMetadataRecord(
                'transaction',
                transactionId,
                `clients/${this.clientId}/transactions/${transactionId}`,
                transaction
              );
            } else {
              results.failed++;
              results.errors.push(`Failed to import transaction: ${augmentedData.description}`);
            }
          } else {
            // Dry run - simulate success
            transactionId = `dry-run-${i}`;
            results.success++;
            console.log(`🔍 [DRY RUN] Would import transaction: ${augmentedData.description}`);
          }
          
          if (transactionId) {
            // Build CrossRef for HOA Dues transactions
            const seqNumber = transaction[""]; // Unnamed first field contains sequence number
            if (transaction.Category === "HOA Dues" && seqNumber) {
              // Convert to string for consistent lookup
              const seqKey = String(seqNumber);
              hoaCrossRef.bySequence[seqKey] = {
                transactionId: transactionId,
                unitId: transaction.Unit,
                amount: transaction.Amount,
                date: transaction.Date
              };
              hoaCrossRef.totalRecords++;
              
              // Also track by unit
              if (!hoaCrossRef.byUnit[transaction.Unit]) {
                hoaCrossRef.byUnit[transaction.Unit] = [];
              }
              hoaCrossRef.byUnit[transaction.Unit].push({
                transactionId: transactionId,
                unitId: transaction.Unit,
                amount: transaction.Amount,
                date: transaction.Date,
                sequenceNumber: seqNumber
              });
              
              console.log(`📝 Recorded HOA CrossRef: Seq ${seqKey} → ${transactionId}`);
            }
            
            // Build CrossRef for Water Bills transactions
            if (transaction.Category === "Water Consumption" && seqNumber) {
              // Extract unit ID from "Unit (Name)" format → "Unit"
              const unitMatch = transaction.Unit?.match(/^(\d+)/);
              const unitId = unitMatch ? unitMatch[1] : transaction.Unit;
              
              waterBillsCrossRef.byPaymentSeq[seqNumber] = {
                transactionId: transactionId,
                unitId: unitId,
                amount: transaction.Amount,
                date: transaction.Date,
                notes: transaction.Notes || ''
              };
              waterBillsCrossRef.totalRecords++;
              
              // Also track by unit
              if (!waterBillsCrossRef.byUnit[unitId]) {
                waterBillsCrossRef.byUnit[unitId] = [];
              }
              waterBillsCrossRef.byUnit[unitId].push({
                paymentSeq: seqNumber,
                transactionId: transactionId,
                amount: transaction.Amount,
                date: transaction.Date
              });
              
              console.log(`💧 Recorded Water Bills CrossRef: ${seqNumber} → ${transactionId}`);
            }
          }
          
          // Report progress using helper
          this.reportProgress('transactions', i, results.total, results);
        } catch (error) {
          results.failed++;
          results.errors.push(`Error importing transaction ${transaction.Google_ID}: ${error.message}`);
          console.error(`❌ Transaction ${i} failed:`, error.message);
          
          // Stop if we hit the max error limit
          if (results.failed >= maxErrors) {
            console.error(`🛑 Stopping import after ${maxErrors} errors`);
            throw new Error(`Import stopped after ${maxErrors} errors. Last error: ${error.message}`);
          }
        }
      }
      
      // Save CrossRef to file if we found any HOA transactions
      if (hoaCrossRef.totalRecords > 0) {
        const crossRefContent = JSON.stringify(hoaCrossRef, null, 2);
        
        if (this.isFirebaseStorage) {
          // Write to Firebase Storage
          const crossRefPath = `imports/${this.clientId}/HOA_Transaction_CrossRef.json`;
          await writeFileToFirebaseStorage(crossRefPath, crossRefContent, this.user);
          console.log(`💾 Saved HOA CrossRef with ${hoaCrossRef.totalRecords} entries to Firebase Storage: ${crossRefPath}`);
        } else {
          // Write to local filesystem
          const crossRefPath = path.join(this.dataPath, 'HOA_Transaction_CrossRef.json');
          await fs.writeFile(crossRefPath, crossRefContent);
          console.log(`💾 Saved HOA CrossRef with ${hoaCrossRef.totalRecords} entries to ${crossRefPath}`);
        }
        
        results.hoaCrossRefGenerated = true;
        results.hoaCrossRefRecords = hoaCrossRef.totalRecords;
      }
      
      // Save Water Bills CrossRef to file if we found any water bill transactions
      if (waterBillsCrossRef.totalRecords > 0) {
        const waterCrossRefContent = JSON.stringify(waterBillsCrossRef, null, 2);
        
        if (this.isFirebaseStorage) {
          // Write to Firebase Storage
          const waterCrossRefPath = `imports/${this.clientId}/Water_Bills_Transaction_CrossRef.json`;
          await writeFileToFirebaseStorage(waterCrossRefPath, waterCrossRefContent, this.user);
          console.log(`💾 Saved Water Bills CrossRef with ${waterBillsCrossRef.totalRecords} entries to Firebase Storage: ${waterCrossRefPath}`);
        } else {
          // Write to local filesystem
          const waterCrossRefPath = path.join(this.dataPath, 'Water_Bills_Transaction_CrossRef.json');
          await fs.writeFile(waterCrossRefPath, waterCrossRefContent);
          console.log(`💾 Saved Water Bills CrossRef with ${waterBillsCrossRef.totalRecords} entries to ${waterCrossRefPath}`);
        }
        
        results.waterBillsCrossRefGenerated = true;
        results.waterBillsCrossRefRecords = waterBillsCrossRef.totalRecords;
      }
      
    } catch (error) {
      throw new Error(`Transactions import failed: ${error.message}`);
    }
    
    return results;
  }

  /**
   * Import HOA dues - Create CrossRef and enhance existing transactions with allocations
   */
  /**
   * Import HOA dues - Create CrossRef and enhance existing transactions with allocations
   */
  async importHOADues(user, options = {}) {
    console.log('🏦 Importing HOA dues and enhancing transactions with allocations...');
    const { dryRun = false, maxErrors = 3 } = options;
    const results = { 
      success: 0, 
      failed: 0, 
      errors: [], 
      linkedPayments: 0, 
      unlinkedPayments: 0, 
      total: 0, 
      enhancedTransactions: 0 
    };
    
    if (dryRun) {
      console.log('🔍 DRY RUN MODE: No HOA Dues data will be written to Firebase');
    }
    
    try {
      const duesData = await this.loadJsonFile('HOADues.json');
      
      // Get fiscal year configuration
      const clientConfig = await this.getClientConfig();
      const fiscalYearStartMonth = validateFiscalYearConfig(clientConfig);
      const year = getFiscalYear(getNow(), fiscalYearStartMonth);
      
      // Load transaction cross-reference if available
      let crossReference = { bySequence: {} };
      try {
        const crossRefData = await this.loadJsonFile('HOA_Transaction_CrossRef.json');
        if (crossRefData && crossRefData.bySequence) {
          crossReference = crossRefData;
          console.log(`✅ Loaded cross-reference with ${Object.keys(crossReference.bySequence).length} entries`);
        }
      } catch (error) {
        console.warn(`⚠️ No cross-reference file found, will try to match sequences manually`);
      }
      
      // Step 1: Build HOADues CrossRef from HOADues.json
      console.log('📋 Building HOA Dues CrossRef...');
      const hoaCrossRef = {};
      
      for (const [unitId, unitData] of Object.entries(duesData)) {
        if (unitData.payments && Array.isArray(unitData.payments)) {
          for (const payment of unitData.payments) {
            const seqMatch = payment.notes?.match(/Seq:\s*(\d+)/);
            const sequenceNumber = seqMatch ? seqMatch[1] : null;
            
            if (sequenceNumber) {
              if (!hoaCrossRef[sequenceNumber]) {
                hoaCrossRef[sequenceNumber] = {
                  sequenceNumber,
                  payments: []
                };
              }
              
              hoaCrossRef[sequenceNumber].payments.push({
                unitId,
                month: payment.month,
                amount: payment.paid,
                notes: payment.notes
              });
            }
          }
        }
      }
      
      console.log(`📊 Built CrossRef with ${Object.keys(hoaCrossRef).length} sequence numbers`);
      
      // Step 2: Load Transactions and find ones that need allocations
      console.log('🔍 Finding transactions that need HOA Dues allocations...');
      const transactionsData = await this.loadJsonFile('Transactions.json');
      
      const transactionsNeedingAllocations = [];
      
      for (const transaction of transactionsData) {
        // Look for sequence number in first unnamed field ("" or index 0)
        const sequenceNumber = transaction[''] || transaction[0] || null;
        
        if (sequenceNumber && hoaCrossRef[sequenceNumber]) {
          const hoaData = hoaCrossRef[sequenceNumber];
          
          // Try to find the transaction ID from our CrossRef
          let transactionId = null;
          if (crossReference.bySequence[sequenceNumber]) {
            transactionId = crossReference.bySequence[sequenceNumber].transactionId;
          }
          
          if (transactionId) {
            transactionsNeedingAllocations.push({
              transactionId,
              sequenceNumber,
              hoaData,
              transaction
            });
            results.linkedPayments += hoaData.payments.length;
            console.log(`🔗 Will enhance transaction ${transactionId} (Seq ${sequenceNumber}) with ${hoaData.payments.length} allocations`);
          } else {
            results.unlinkedPayments += hoaData.payments.length;
            console.log(`⚠️ No transaction ID found for sequence ${sequenceNumber} with ${hoaData.payments.length} payments`);
          }
        }
      }
      
      console.log(`📊 Found ${transactionsNeedingAllocations.length} transactions needing HOA allocations`);
      
      // Step 3: Enhance transactions with allocations
      for (const { transactionId, sequenceNumber, hoaData, transaction } of transactionsNeedingAllocations) {
        try {
          // Build allocations from HOA payments (match working AVII structure)
          const allocations = hoaData.payments.map((payment, index) => {
            const monthName = this.getMonthName(payment.month);
            // CRITICAL: Validate centavos conversion before Firestore write
            const amountInCentavos = validateCentavos(payment.amount * 100, `payment.amount[${index}]`);
            return {
              id: `alloc_${String(index + 1).padStart(3, '0')}`, // alloc_001, alloc_002, etc.
              type: "hoa_month",
              targetId: `month_${payment.month}_${year}`, // month_3_2026 format
              targetName: `${monthName} ${year}`, // "March 2026" format
              amount: amountInCentavos, // Convert pesos to centavos with validation
              percentage: null, // Required field
              categoryName: "HOA Dues", // Required for split transaction UI
              categoryId: "hoa_dues", // Required for consistency
              data: {
                unitId: payment.unitId,
                month: payment.month,
                year: year
              },
              metadata: {
                processingStrategy: "hoa_dues",
                cleanupRequired: true,
                auditRequired: true,
                createdAt: getNow().toISOString()
              }
            };
          });
          
          // Calculate if there's a credit balance allocation needed
          // CRITICAL: Validate all centavos calculations
          const totalDuesAmount = validateCentavos(
            hoaData.payments.reduce((sum, p) => sum + validateCentavos(p.amount * 100, 'payment.amount'), 0),
            'totalDuesAmount'
          );
          const transactionAmount = validateCentavos(transaction.Amount * 100, 'transactionAmount');
          const creditAmount = validateCentavos(transactionAmount - totalDuesAmount, 'creditAmount');
          
          // Add credit allocation if transaction amount doesn't equal dues amount
          if (creditAmount !== 0) {
            const creditType = creditAmount > 0 ? 'overpayment' : 'usage';
            const creditDescription = creditAmount > 0 
              ? 'Credit Added from Overpayment' 
              : 'Credit Used for Payment';
            
            allocations.push({
              id: `alloc_${String(allocations.length + 1).padStart(3, '0')}`,
              type: "account_credit",
              targetId: `credit_${hoaData.payments[0]?.unitId}_${year}`,
              targetName: `Account Credit - Unit ${hoaData.payments[0]?.unitId}`,
              amount: creditAmount, // Positive for credit added, negative for credit used
              percentage: null,
              categoryName: "Account Credit",
              categoryId: "account-credit",
              data: {
                unitId: hoaData.payments[0]?.unitId,
                year: year,
                creditType: creditType
              },
              metadata: {
                processingStrategy: "account_credit",
                cleanupRequired: true,
                auditRequired: true,
                createdAt: getNow().toISOString()
              }
            });
            
            console.log(`💳 Added ${creditType} allocation: ${creditAmount / 100} pesos (Transaction: ${transactionAmount / 100}, Dues: ${totalDuesAmount / 100})`);
          }
          
          // Calculate allocation summary
          const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
          const allocationSummary = {
            totalAllocated: totalAllocated,
            allocationCount: allocations.length,
            allocationType: 'hoa_month',
            hasMultipleTypes: false
          };
          
          // Update the transaction with allocations
          if (!dryRun) {
            await updateTransaction(this.clientId, transactionId, {
              allocations: allocations,
              allocationSummary: allocationSummary,
              categoryName: '-Split-' // Mark as split transaction
            });
            console.log(`✅ Enhanced transaction ${transactionId} with ${allocations.length} allocations`);
          } else {
            console.log(`🔍 [DRY RUN] Would enhance transaction ${transactionId} with ${allocations.length} allocations`);
          }
          
          results.enhancedTransactions++;
          
        } catch (error) {
          console.error(`❌ Failed to enhance transaction ${transactionId}:`, error.message);
          results.errors.push(`Failed to enhance transaction ${transactionId}: ${error.message}`);
        }
      }
      
      // Step 4: Process payments and credit balances for each unit
      console.log('📋 Processing HOA dues payments and credit balances...');
      const unitIds = Object.keys(duesData);
      results.total = unitIds.length;
      
      console.log(`🔍 Debug: Processing ${unitIds.length} units for client ${this.clientId}, year ${year}`);
      console.log(`🔍 Debug: Unit IDs:`, unitIds.slice(0, 3));
      
      // Report starting
      if (this.onProgress) {
        this.onProgress('hoadues', 'importing', { total: results.total, processed: 0 });
      }
      
      // Process each unit's dues data
      for (let i = 0; i < unitIds.length; i++) {
        const unitId = unitIds[i];
        const unitData = duesData[unitId];
        
        try {
          // Initialize year document for this unit
          await initializeYearDocument(this.clientId, unitId, year);
          
          const db = await this.getDb();
          const duesRef = db.collection('clients').doc(this.clientId)
            .collection('units').doc(unitId)
            .collection('dues').doc(year.toString());
          
          // Process payments
          if (unitData.payments && unitData.payments.length > 0) {
            const paymentData = unitData.payments.map(payment => {
              // Extract date from notes: "Posted: MXN 15,000.00 on Sat Dec 28 2024 13:56:50 GMT-0500"
              let extractedDate = null;
              if (payment.notes) {
                const dateMatch = payment.notes.match(/Posted:.*?on\s+(.+?)\s+GMT/i);
                if (dateMatch) {
                  try {
                    // Parse the date string "Sat Dec 28 2024 13:56:50" format
                    const dateStr = dateMatch[1].trim();
                    // Use DateTime's RFC2822 parser for this format
                    const parsedDate = DateTime.fromRFC2822(dateStr, { zone: 'America/Cancun' });
                    if (parsedDate.isValid) {
                      extractedDate = parsedDate.toJSDate();
                    } else {
                      // Fallback: try HTTP format
                      const httpDate = DateTime.fromHTTP(dateStr, { zone: 'America/Cancun' });
                      if (httpDate.isValid) {
                        extractedDate = httpDate.toJSDate();
                      } else {
                        extractedDate = null; // Invalid date
                      }
                    }
                  } catch (e) {
                    console.warn(`⚠️ Could not parse date from notes for unit ${unitId}: ${payment.notes}`);
                  }
                }
              }
              
              // Extract sequence reference from notes and look up transaction ID: "Seq: 25010"
              let reference = null;
              if (payment.notes) {
                const seqMatch = payment.notes.match(/Seq:\s*(\d+)/);
                if (seqMatch) {
                  const sequenceNumber = seqMatch[1];
                  // Look up transaction ID from CrossRef using sequence number
                  if (crossReference && crossReference.bySequence && crossReference.bySequence[sequenceNumber]) {
                    reference = crossReference.bySequence[sequenceNumber].transactionId;
                    console.log(`🔗 Payment reference: Seq ${sequenceNumber} → Transaction ${reference}`);
                  } else {
                    console.warn(`⚠️ No CrossRef found for sequence ${sequenceNumber} in unit ${unitId}`);
                    reference = sequenceNumber; // Fallback to sequence number
                  }
                }
              }
              
              // CRITICAL: Validate centavos conversion before Firestore write
              const amountInCentavos = validateCentavos(payment.paid * 100, `payment.paid[${payment.month}]`);
              return {
                month: payment.month,
                amount: amountInCentavos, // Convert to cents with validation
                paid: payment.paid > 0,
                date: extractedDate,
                method: 'bank',
                notes: payment.notes || '',
                reference: reference, // Backend storage
                transactionId: reference // Frontend display (UI looks for this)
              };
            });
            
            await duesRef.update({
              payments: paymentData
            });
            
            console.log(`✅ Recorded ${paymentData.length} payments for unit ${unitId}`);
          }
          
          // Process credit balance and build history
          const creditBalanceHistory = [];
          let runningBalance = 0;
          
          // Calculate credit balance changes from transaction amounts (match allocation logic)
          const creditBalanceTransactions = [];
          
          // Look for credit balance changes in transactions by sequence
          for (const [sequenceNumber, crossRefData] of Object.entries(crossReference.bySequence)) {
            if (crossRefData.transactionId && hoaCrossRef[sequenceNumber]) {
              const hoaPaymentsForSequence = hoaCrossRef[sequenceNumber].payments.filter(p => p.unitId === unitId);
              
              if (hoaPaymentsForSequence.length > 0) {
                const transaction = transactionsData.find(t => 
                  t[''] == sequenceNumber || t[0] == sequenceNumber
                );
                
                if (transaction) {
                  // Calculate credit using SAME logic as allocation creation
                  // CRITICAL: Validate all centavos calculations
                  const totalDuesAmount = validateCentavos(
                    hoaPaymentsForSequence.reduce((sum, p) => sum + validateCentavos(p.amount * 100, 'p.amount'), 0),
                    'totalDuesAmount'
                  );
                  const transactionAmount = validateCentavos(transaction.Amount * 100, 'transactionAmount');
                  const creditAmount = validateCentavos(transactionAmount - totalDuesAmount, 'creditAmount');
                  
                  if (creditAmount !== 0) {
                    runningBalance = validateCentavos(runningBalance + creditAmount, 'runningBalance');
                    
                    creditBalanceTransactions.push({
                      sequenceNumber,
                      transactionId: crossRefData.transactionId,
                      amount: creditAmount,
                      notes: transaction.Notes,
                      date: transaction.Date,
                      creditType: creditAmount > 0 ? 'overpayment' : 'usage'
                    });
                  }
                }
              }
            }
          }
          
          // Build credit balance history from transactions (match AVII structure)
          for (const tx of creditBalanceTransactions) {
            const type = tx.creditType === 'overpayment' ? 'credit_added' : 'credit_used';
            const description = tx.creditType === 'overpayment' 
              ? 'from Overpayment' 
              : 'from Credit Balance Usage';
            
            // Parse date string properly with timezone (tx.date is ISO string like "2024-07-15")
            const txDate = DateTime.fromISO(tx.date, { zone: 'America/Cancun' }).toJSDate();
            
            creditBalanceHistory.push({
              id: this.generateId(),
              timestamp: txDate,
              transactionId: tx.transactionId,
              type: type,
              amount: Math.abs(tx.amount), // Store as positive value
              description: description,
              balanceBefore: runningBalance - tx.amount,
              balanceAfter: runningBalance,
              notes: tx.notes || ''
            });
          }
          
          // Calculate final balance and add starting balance if needed
          const finalCreditBalance = (unitData.creditBalance || 0) * 100;
          const startingBalance = finalCreditBalance - runningBalance;
          
          // If there was a starting balance (from prior period or manual adjustments), add it as first entry
          if (startingBalance !== 0) {
            // Get client config and calculate fiscal year start date
            const clientConfig = await this.getClientConfig();
            const fiscalYearStartMonth = validateFiscalYearConfig(clientConfig);
            const { startDate } = getFiscalYearBounds(year, fiscalYearStartMonth);
            
            // Insert at beginning of history array
            creditBalanceHistory.unshift({
              id: this.generateId(),
              timestamp: startDate, // Start of fiscal year
              transactionId: null,
              type: 'starting_balance',
              amount: Math.abs(startingBalance),
              description: startingBalance > 0 ? 'Starting credit balance from prior period' : 'Starting debit balance from prior period',
              balanceBefore: 0,
              balanceAfter: startingBalance,
              notes: 'Imported from legacy system'
            });
            
            // Adjust all subsequent balanceBefore/balanceAfter to include starting balance
            let cumulativeBalance = startingBalance;
            for (let i = 1; i < creditBalanceHistory.length; i++) {
              const entry = creditBalanceHistory[i];
              const changeAmount = entry.type === 'credit_used' ? -entry.amount : entry.amount;
              entry.balanceBefore = cumulativeBalance;
              cumulativeBalance += changeAmount;
              entry.balanceAfter = cumulativeBalance;
            }
          }
          
          // Calculate totalPaid from payments array
          // CRITICAL: Validate all centavos conversions
          const totalPaid = unitData.payments 
            ? validateCentavos(
                unitData.payments.reduce((sum, p) => sum + (p.paid || 0), 0) * 100,
                'totalPaid'
              )
            : 0;
          
          // Update dues document with scheduled amount, totals, credit balance and history
          await duesRef.update({
            scheduledAmount: validateCentavos((unitData.scheduledAmount || 0) * 100, 'scheduledAmount'),
            totalPaid: totalPaid, // Already validated above
            creditBalance: validateCentavos(finalCreditBalance, 'creditBalance'),
            creditBalanceHistory: creditBalanceHistory
          });
          
          results.success++;
          console.log(`✅ Processed HOA dues for unit ${unitId}: ${unitData.payments?.length || 0} payments, ${finalCreditBalance/100} credit balance`);
          
          // Create metadata record for the HOA dues year document
          await this.createMetadataRecord(
            'hoa-dues',
            year.toString(),
            `clients/${this.clientId}/units/${unitId}/dues/${year}`,
            unitData
          );
          
        } catch (error) {
          results.failed++;
          results.errors.push(`Error processing HOA dues for unit ${unitId}: ${error.message}`);
        }
        
        // Report progress
        this.reportProgress('hoadues', i, results.total, results);
      }
      
      console.log(`📊 Enhanced ${results.enhancedTransactions} transactions with HOA allocations`);
      console.log(`📊 Linked payments: ${results.linkedPayments}, unlinked: ${results.unlinkedPayments}`);
      
      return results;
      
    } catch (error) {
      console.error(`🔍 DEBUG: Error in importHOADues:`, error.message);
      console.error(`🔍 DEBUG: Stack trace:`, error.stack);
      throw new Error(`HOA dues import failed: ${error.message}`);
    }
  }

  /**
   * Helper to get database instance
   */
  async getDb() {
    if (!this.db) {
      const { getDb } = await import('../firebase.js');
      this.db = await getDb();
    }
    return this.db;
  }

  /**
   * Helper to generate unique IDs
   */
  generateId() {
    return Math.random().toString(36).substring(2) + getNow().getTime().toString(36);
  }

  /**
   * Helper to get month name in Spanish
   */
  getMonthName(monthNumber) {
    const monthNames = {
      1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril", 
      5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto", 
      9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
    };
    return monthNames[monthNumber] || `Month ${monthNumber}`;
  }

  /**
   * Get or create accounts mapping
   */
  async getAccountsMapping() {
    console.log('🔗 Loading accounts mapping...');
    
    const db = await this.getDb();
    const clientDoc = await db.collection('clients').doc(this.clientId).get();
    
    if (!clientDoc.exists) {
      console.error(`❌ Client document not found: ${this.clientId}`);
      return {};
    }
    
    const clientData = clientDoc.data();
    const accountsArray = clientData.accounts || [];
    
    console.log(`📋 Found ${accountsArray.length} accounts in client document`);
    
    const accountsMap = {};
    accountsArray.forEach(account => {
      accountsMap[account.name] = {
        id: account.id,
        name: account.name,
        type: account.type
      };
    });
    
    console.log(`✅ Loaded ${Object.keys(accountsMap).length} account mappings for client ${this.clientId}`);
    console.log('📋 FULL ACCOUNT MAP:', JSON.stringify(accountsMap, null, 2));
    console.log('🔑 Account names available for matching:', Object.keys(accountsMap));
    return accountsMap;
  }

  /**
   * Get vendor lookup map (name -> id)
   */
  async getVendorLookupMap(db) {
    console.log('🏢 Loading vendor lookup map...');
    
    const vendorsRef = db.collection('clients').doc(this.clientId).collection('vendors');
    const vendorsSnapshot = await vendorsRef.get();
    
    const vendorMap = {};
    vendorsSnapshot.forEach(doc => {
      const vendor = doc.data();
      vendorMap[vendor.name] = doc.id;
    });
    
    console.log(`✅ Loaded ${Object.keys(vendorMap).length} vendor mappings`);
    return vendorMap;
  }

  /**
   * Map transaction descriptions to real vendors
   */
  mapDescriptionToVendor(description) {
    const mappings = {
      // Jose variations (map to OTHER since Jose is not in vendor list)
      'Jose - Salary': 'OTHER',
      'Jose Salary': 'OTHER', 
      'José Salary': 'OTHER',
      'José Holiday Pay': 'OTHER',
      'Jose 3 Days work during holidays': 'OTHER',
      'José Shopping Expenses': 'OTHER',
      'Jose (repair lights)': 'OTHER',
      'Jose: Pool and Cleaning Supplies': 'OTHER',
      'Jose - Salary (missed one day)': 'OTHER',
      'Jose - Salary (final payment)': 'OTHER',
      
      // MTC Administration Fee
      'MTC Administration Fee': 'Administration Fee',
      
      // Elevator related
      'Elevator Assessment 1 & 2 (less $1,000)': 'Vertical City',
      'Elevator Assessment (Xoom → MTC Bank)': 'Vertical City',
      'Vertical City Lift (50% deposit for modernization)': 'Vertical City',
      'Elevator Refurb': 'Vertical City',
      'Elevator Refub (paid in USD)': 'Vertical City',
      'Elevator Refub': 'Vertical City',
      'Elevator Refurb (USD)': 'Vertical City',
      'Elevator Refurb #3': 'Vertical City',
      'Elevator Motor ($9,500 of $16,140)': 'Vertical City',
      'Elevator Motor Paid In Full': 'Vertical City',
      'Elevator Motor & Variator (paid in full)': 'Vertical City',
      'Elevator Motor and Variator': 'Vertical City',
      'Elevator Modernization (VC)': 'Vertical City',
      'Pool Pump Maintenance': 'Vertical City',
      
      // Pool related
      'Pool Pump (Bomba) from Unicornio PDC': 'OTHER',
      'Pool and Lawn Chemicals': 'OTHER',
      'Cleaning Supplies': 'OTHER',
      'Pool Skimmer Net': 'OTHER',
      'Janitorial Supplies': 'OTHER',
      
      // Tools and repairs
      'Tools to repair pool door (remachadora)': 'Jorge Juan Perez',
      'Electrician (Rudi) for ground bar parts': 'Rudi (Electrician)',
      'Jorge Juan -- Pool Electrical Repair': 'Jorge Juan Perez',
      'Hose Bib (llave) for backyard (Jorge Juan Perez)': 'Jorge Juan Perez',
      
      // Security
      'Security Camera Install (Parking Lot)': 'OTHER',
      
      // Passport
      'Annual PA Passport (Jose)': 'OTHER',
      
      // Cash transfers
      'Cash to Jose for Supplies (pool and garden)': 'Petty Cash',
      
      // SPLIT transactions (internal accounting)
      '[SPLIT] Overpayment for Account Credit': 'OTHER',
      '[SPLIT] Overpayment for Credit': 'OTHER',
      '[SPLIT] Salary': 'OTHER',
      '[SPLIT] Chemicals': 'OTHER',
      '[SPLIT] Elevator Refurb': 'OTHER',
      '[SPLIT] Payment in Full': 'OTHER',
      '[SPLIT] 50% (less 205 pesos)': 'OTHER',
      '[SPLIT] Elevator Refurb': 'OTHER',
      '[SPLIT] Overpayment for Account Credit': 'OTHER',
      '[SPLIT] Elevator Assessment #3': 'OTHER',
      '[SPLIT] Elevator Motor and Modernization Project': 'OTHER',
      '[SPLIT] Account Credit': 'OTHER',
      '[SPLIT] 50% payment for Elevator Modernization (VC)': 'OTHER',
      '[SPLIT] 50% deposit for new Elevator Motor and Variator': 'OTHER',
      '[SPLIT] Elevator Motor and Variator 2A Paid in Full': 'OTHER',
      '[SPLIT] Elevator Motor and Variator PH3C Paid in Full': 'OTHER',
      
      // Deposits with descriptions
      'Deposit: Roof Water Sealing': 'Deposit',
      'Deposit: HOA Dues': 'Deposit',
      'Deposit: Account Credit': 'Deposit',
      
      // Complex descriptions
      'Paid deposit to Vertical City for Elevator Motor (refund from MTC due of $13,860': 'Vertical City',
      'Vertical City -- 50% Deposit for new Elevator Motor and Variator including shipping': 'Vertical City'
    };
    
    return mappings[description] || null;
  }

  /**
   * Get category lookup map (name -> id)
   */
  async getCategoryLookupMap(db) {
    console.log('📁 Loading category lookup map...');
    
    const categoriesRef = db.collection('clients').doc(this.clientId).collection('categories');
    const categoriesSnapshot = await categoriesRef.get();
    
    const categoryMap = {};
    categoriesSnapshot.forEach(doc => {
      const category = doc.data();
      categoryMap[category.name] = doc.id;
    });
    
    console.log(`✅ Loaded ${Object.keys(categoryMap).length} category mappings`);
    return categoryMap;
  }

  /**
   * Create fallback year-end balance with zero amounts
   */
  createFallbackYearEnd(accountsMap, fiscalYear) {
    // Use DateTime to create year-end date in Cancun timezone
    const yearEndDate = DateTime.fromObject(
      { year: fiscalYear, month: 12, day: 31 },
      { zone: 'America/Cancun' }
    ).toISO();
    
    return {
      year: fiscalYear,
      date: yearEndDate,
      accounts: Object.entries(accountsMap).map(([id, account]) => ({
        id: id,
        name: account.name,
        balance: 0
      }))
    };
  }

  /**
   * Import Water Bills - Chronological processing of readings, bills, and payments
   */
  async importWaterBills(user) {
    console.log('🌊 Starting Water Bills Import...');
    const results = {
      readingsImported: 0,
      billsGenerated: 0,
      paymentsApplied: 0,
      cyclesProcessed: 0,
      errors: []
    };
    
    try {
      // Try to load water bills files - skip if not found
      console.log('📥 Loading water bills data files...');
      
      let readingsData, waterCrossRef, txnCrossRef;
      
      try {
        readingsData = await this.loadJsonFile('waterMeterReadings.json');
      } catch (error) {
        console.log('⏭️  waterMeterReadings.json not found, skipping water bills import');
        return { skipped: true, reason: 'waterMeterReadings.json not found' };
      }
      
      try {
        waterCrossRef = await this.loadJsonFile('waterCrossRef.json');
      } catch (error) {
        console.log('⏭️  waterCrossRef.json not found, skipping water bills import');
        return { skipped: true, reason: 'waterCrossRef.json not found' };
      }
      
      try {
        txnCrossRef = await this.loadJsonFile('Water_Bills_Transaction_CrossRef.json');
      } catch (error) {
        console.log('⚠️  Water_Bills_Transaction_CrossRef.json not found - will not link payments to transactions');
        txnCrossRef = { byPaymentSeq: {}, byUnit: {} };
      }
      
      console.log(`✓ Loaded ${readingsData.length} units with readings`);
      console.log(`✓ Loaded ${waterCrossRef.length} charge records`);
      console.log(`✓ Loaded transaction CrossRef with ${Object.keys(txnCrossRef.byPaymentSeq || {}).length} payments`);
      
      // Load client config to get fiscal year and water bills configuration
      const clientConfig = await this.getClientConfig();
      const fiscalYearStartMonth = validateFiscalYearConfig(clientConfig);
      const waterBillsConfig = clientConfig.config?.waterBills || clientConfig.waterBills || {};
      const paymentDueDay = waterBillsConfig.paymentDueDate || 10; // Day of month when payment is due
      console.log(`📅 Using fiscal year start month: ${fiscalYearStartMonth}`);
      console.log(`📅 Water bills due date: Day ${paymentDueDay} of bill month`);
      
      // Parse readings chronologically
      const chronology = this.buildWaterBillsChronology(readingsData, waterCrossRef, txnCrossRef, fiscalYearStartMonth);
      console.log(`📅 Built chronology with ${chronology.length} month cycles`);
      
      // Process each month cycle: readings → bills → payments
      for (const cycle of chronology) {
        try {
          console.log(`\n📅 Processing: ${cycle.readingMonth} readings → ${cycle.billingMonth} billing`);
          
          // Step 1: Import readings for this month
          await this.importMonthReadings(cycle);
          results.readingsImported++;
          
          // Step 2: Generate bills for this month (using existing service)
          await this.generateMonthBills(cycle, paymentDueDay);
          results.billsGenerated++;
          
          // Step 3: Process payments made during this billing month
          if (cycle.payments && cycle.payments.length > 0) {
            await this.processMonthPayments(cycle, txnCrossRef);
            results.paymentsApplied += cycle.payments.length;
          }
          
          results.cyclesProcessed++;
          console.log(`✅ Completed ${cycle.readingMonth} → ${cycle.billingMonth} cycle`);
          
        } catch (error) {
          console.error(`❌ Error processing cycle ${cycle.readingMonth}:`, error.message);
          results.errors.push({
            cycle: cycle.readingMonth,
            error: error.message
          });
          // Continue with next cycle rather than failing entire import
        }
      }
      
      console.log('\n✅ Water Bills Import Complete');
      console.log(`   Cycles Processed: ${results.cyclesProcessed}`);
      console.log(`   Readings Imported: ${results.readingsImported}`);
      console.log(`   Bills Generated: ${results.billsGenerated}`);
      console.log(`   Payments Applied: ${results.paymentsApplied}`);
      
      return results;
      
    } catch (error) {
      console.error('❌ Water Bills import failed:', error.message);
      throw new Error(`Water Bills import failed: ${error.message}`);
    }
  }
  
  /**
   * Build chronology of reading → billing → payment cycles
   */
  buildWaterBillsChronology(readingsData, waterCrossRef, txnCrossRef, fiscalYearStartMonth) {
    
    // Parse readings by month
    const readingsByMonth = {};
    const firstUnit = readingsData[0];
    const dateKeys = Object.keys(firstUnit).filter(k => k !== 'Unit');
    
    for (const dateKey of dateKeys) {
      const reading = firstUnit[dateKey];
      if (reading === '') continue;
      
      const date = new Date(dateKey);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!readingsByMonth[monthStr]) {
        readingsByMonth[monthStr] = {
          date: date,
          readings: {}
        };
      }
      
      // Extract readings for all units
      for (const unitData of readingsData) {
        const unitId = unitData.Unit;
        const reading = unitData[dateKey];
        
        if (reading !== '') {
          readingsByMonth[monthStr].readings[unitId] = reading;
        }
      }
    }
    
    // Group payments by month
    const paymentsByMonth = {};
    for (const charge of waterCrossRef) {
      const paymentDate = new Date(charge.PaymentDate);
      const monthStr = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (!paymentsByMonth[monthStr]) {
        paymentsByMonth[monthStr] = [];
      }
      paymentsByMonth[monthStr].push(charge);
    }
    
    // Build chronology
    const chronology = [];
    const sortedMonths = Object.keys(readingsByMonth).sort();
    
    for (const readingMonth of sortedMonths) {
      // Billing month is the month after reading month
      const [year, month] = readingMonth.split('-').map(Number);
      const billingDate = new Date(year, month, 1); // Next month
      const billingMonth = `${billingDate.getFullYear()}-${String(billingDate.getMonth() + 1).padStart(2, '0')}`;
      
      // Get fiscal year/month for billing using imported utility
      const fiscalYear = getFiscalYear(billingDate, fiscalYearStartMonth);
      const calendarMonth = billingDate.getMonth() + 1;
      let fiscalMonth = calendarMonth - fiscalYearStartMonth;
      if (fiscalMonth < 0) fiscalMonth += 12;
      
      chronology.push({
        readingMonth,
        billingMonth,
        fiscalYear,
        fiscalMonth,
        readings: readingsByMonth[readingMonth].readings,
        payments: paymentsByMonth[billingMonth] || []
      });
    }
    
    return chronology;
  }
  
  /**
   * Import readings for a single month
   */
  async importMonthReadings(cycle) {
    const waterReadingsService = (await import('./waterReadingsService.js')).default;
    
    const payload = {
      readings: {},
      buildingMeter: null,
      commonArea: null
    };
    
    for (const [unitId, reading] of Object.entries(cycle.readings)) {
      if (unitId === 'Building') {
        payload.buildingMeter = reading;
      } else if (unitId === 'Common') {
        payload.commonArea = reading;
      } else {
        payload.readings[unitId] = reading;
      }
    }
    
    await waterReadingsService.saveReadings(
      this.clientId,
      cycle.fiscalYear,
      cycle.fiscalMonth,
      payload
    );
    
    console.log(`  📊 Imported readings for ${cycle.readingMonth}: ${Object.keys(payload.readings).length} units`);
  }
  
  /**
   * Generate bills for a single month
   * Now calculates proper bill date and due date based on fiscal year/month
   */
  async generateMonthBills(cycle, paymentDueDay = 10) {
    const waterBillsService = (await import('./waterBillsService.js')).default;
    
    // Calculate bill date: First day of the billing month in Cancun timezone
    const [yearNum, monthNum] = cycle.billingMonth.split('-').map(Number);
    const billDate = DateTime.fromObject(
      { year: yearNum, month: monthNum, day: 1, hour: 0, minute: 0, second: 0 },
      { zone: 'America/Cancun' }
    ).toJSDate();
    
    // Calculate due date: paymentDueDay of the billing month
    const dueDate = DateTime.fromObject(
      { year: yearNum, month: monthNum, day: paymentDueDay, hour: 23, minute: 59, second: 59 },
      { zone: 'America/Cancun' }
    ).toISO();
    
    console.log(`  📅 Bill date: ${billDate.toISOString()}, Due date: ${dueDate}`);
    
    // Pass billDate and dueDate as options to bill generation
    await waterBillsService.generateBills(
      this.clientId,
      cycle.fiscalYear,
      cycle.fiscalMonth,
      { 
        billDate: billDate,
        dueDate: dueDate 
      }
    );
    
    console.log(`  💵 Generated bills for ${cycle.billingMonth} (fiscal ${cycle.fiscalYear}-${cycle.fiscalMonth})`);
  }
  
  /**
   * Process payments for a single month
   * CRITICAL: Converts payment amounts from pesos to centavos (WB1 requirement)
   */
  async processMonthPayments(cycle, txnCrossRef) {
    // Group charges by payment sequence
    const paymentGroups = {};
    
    for (const charge of cycle.payments) {
      const paySeq = charge.PaymentSeq;
      
      // CRITICAL: Convert amount from pesos to centavos (import files are in pesos)
      // Validate conversion output to ensure integer centavos
      const amountInCentavos = validateCentavos(pesosToCentavos(charge.AmountApplied), 'AmountApplied');
      
      if (!paymentGroups[paySeq]) {
        paymentGroups[paySeq] = {
          paymentSeq: paySeq,
          unit: charge.Unit,
          paymentDate: charge.PaymentDate,
          charges: [],
          totalAmount: 0,
          baseCharges: 0,
          penalties: 0
        };
      }
      
      // Store converted charge with centavos
      paymentGroups[paySeq].charges.push({
        ...charge,
        AmountAppliedCentavos: amountInCentavos // Add centavos version (validated)
      });
      // Validate all accumulations to prevent floating point contamination
      paymentGroups[paySeq].totalAmount = validateCentavos(
        paymentGroups[paySeq].totalAmount + amountInCentavos,
        'totalAmount'
      );
      
      if (charge.Category === 'WC') {
        paymentGroups[paySeq].baseCharges = validateCentavos(
          paymentGroups[paySeq].baseCharges + amountInCentavos,
          'baseCharges'
        );
      } else if (charge.Category === 'WCP') {
        paymentGroups[paySeq].penalties = validateCentavos(
          paymentGroups[paySeq].penalties + amountInCentavos,
          'penalties'
        );
      }
    }
    
    // Apply each payment to its bills
    for (const [paySeq, payment] of Object.entries(paymentGroups)) {
      // Look up transaction ID from CrossRef
      const transactionId = txnCrossRef?.byPaymentSeq?.[paySeq]?.transactionId || null;
      
      if (!transactionId) {
        console.warn(`⚠️  No transaction ID found in CrossRef for payment ${paySeq}`);
      }
      
      // Find which bills this payment applies to
      const billsToUpdate = await this.findBillsForCharges(payment.charges);
      
      // Update each bill with payment info including transaction ID
      for (const billUpdate of billsToUpdate) {
        billUpdate.transactionId = transactionId;
        billUpdate.paymentDate = payment.paymentDate;
        billUpdate.paymentSeq = paySeq;
        await this.applyPaymentToBill(billUpdate);
      }
      
      // Convert centavos to pesos for logging
      const totalAmountPesos = centavosToPesos(payment.totalAmount);
      console.log(`  💰 Applied payment ${paySeq} (txn: ${transactionId || 'none'}): $${totalAmountPesos.toFixed(2)} (${payment.totalAmount} centavos) → ${billsToUpdate.length} bill(s)`);
    }
  }
  
  /**
   * Find which bills a set of charges applies to
   * CRITICAL: Now uses AmountAppliedCentavos (already converted in processMonthPayments)
   */
  async findBillsForCharges(charges) {
    // Get fiscal year configuration from client config
    const clientConfig = await this.getClientConfig();
    const fiscalYearStartMonth = validateFiscalYearConfig(clientConfig);
    
    const billUpdates = [];
    
    for (const charge of charges) {
      const chargeDate = new Date(charge.ChargeDate);
      const fiscalYear = getFiscalYear(chargeDate, fiscalYearStartMonth);
      const calendarMonth = chargeDate.getMonth() + 1;
      let fiscalMonth = calendarMonth - fiscalYearStartMonth;
      if (fiscalMonth < 0) fiscalMonth += 12;
      
      // Find existing bill update or create new one
      let billUpdate = billUpdates.find(
        b => b.fiscalYear === fiscalYear && b.fiscalMonth === fiscalMonth && b.unitId === charge.Unit.toString()
      );
      
      if (!billUpdate) {
        billUpdate = {
          fiscalYear,
          fiscalMonth,
          unitId: charge.Unit.toString(),
          amountApplied: 0,
          basePaid: 0,
          penaltyPaid: 0
        };
        billUpdates.push(billUpdate);
      }
      
      // Use centavos version (already converted in processMonthPayments)
      // CRITICAL: Validate all accumulations to prevent floating point contamination
      const amountCentavos = validateCentavos(charge.AmountAppliedCentavos, 'AmountAppliedCentavos');
      billUpdate.amountApplied = validateCentavos(
        billUpdate.amountApplied + amountCentavos,
        'amountApplied'
      );
      if (charge.Category === 'WC') {
        billUpdate.basePaid = validateCentavos(
          billUpdate.basePaid + amountCentavos,
          'basePaid'
        );
      } else if (charge.Category === 'WCP') {
        billUpdate.penaltyPaid = validateCentavos(
          billUpdate.penaltyPaid + amountCentavos,
          'penaltyPaid'
        );
      }
    }
    
    return billUpdates;
  }
  
  /**
   * Apply payment to a specific bill
   */
  async applyPaymentToBill(billUpdate) {
    const db = await this.getDb();
    
    const monthStr = `${billUpdate.fiscalYear}-${String(billUpdate.fiscalMonth).padStart(2, '0')}`;
    const billRef = db
      .collection('clients').doc(this.clientId)
      .collection('projects').doc('waterBills')
      .collection('bills').doc(monthStr);
    
    const billDoc = await billRef.get();
    if (!billDoc.exists) {
      console.warn(`⚠️  Bill document ${monthStr} not found for unit ${billUpdate.unitId}`);
      return;
    }
    
    const billData = billDoc.data();
    const unitBill = billData.bills?.units?.[billUpdate.unitId];
    
    if (!unitBill) {
      console.warn(`⚠️  No bill for unit ${billUpdate.unitId} in ${monthStr}`);
      return;
    }
    
    // Update bill with payment info
    // CRITICAL: Validate all accumulations to prevent floating point contamination
    const newPaidAmount = validateCentavos(
      (unitBill.paidAmount || 0) + billUpdate.amountApplied,
      'newPaidAmount'
    );
    const newBasePaid = validateCentavos(
      (unitBill.basePaid || 0) + billUpdate.basePaid,
      'newBasePaid'
    );
    const newPenaltyPaid = validateCentavos(
      (unitBill.penaltyPaid || 0) + billUpdate.penaltyPaid,
      'newPenaltyPaid'
    );
    
    // Determine new status
    let newStatus = 'unpaid';
    if (newPaidAmount >= unitBill.totalAmount) {
      newStatus = 'paid';
    } else if (newPaidAmount > 0) {
      newStatus = 'partial';
    }
    
    // Get existing payments array or initialize it
    const existingPayments = unitBill.payments || [];
    
    // Create new payment entry (following HOA Dues pattern)
    const paymentEntry = {
      amount: billUpdate.amountApplied,
      baseChargePaid: billUpdate.basePaid,
      penaltyPaid: billUpdate.penaltyPaid,
      date: billUpdate.paymentDate || getNow().toISOString(),
      transactionId: billUpdate.transactionId || null,
      reference: billUpdate.paymentSeq || null,
      method: 'bank_transfer', // Default for imports
      recordedAt: getNow().toISOString()
    };
    
    // Append to payments array
    const updatedPayments = [...existingPayments, paymentEntry];
    
    await billRef.update({
      [`bills.units.${billUpdate.unitId}.paidAmount`]: newPaidAmount,
      [`bills.units.${billUpdate.unitId}.basePaid`]: newBasePaid,
      [`bills.units.${billUpdate.unitId}.penaltyPaid`]: newPenaltyPaid,
      [`bills.units.${billUpdate.unitId}.status`]: newStatus,
      [`bills.units.${billUpdate.unitId}.payments`]: updatedPayments
    });
    
    // Convert centavos to pesos for logging
    const amountPesos = centavosToPesos(billUpdate.amountApplied);
    console.log(`    ✓ Updated bill ${monthStr} unit ${billUpdate.unitId}: +$${amountPesos.toFixed(2)} (${billUpdate.amountApplied} centavos) → ${newStatus} (txn: ${billUpdate.transactionId || 'none'})`);
  }

  /**
   * Import year-end balances
   */
  async importYearEndBalances(user) {
    console.log('📊 Importing year-end balances...');
    const results = { success: 0, failed: 0, errors: [], balanceIds: [] };
    
    try {
      // Try to load year-end balances
      let balancesData = null;
      try {
        balancesData = await this.loadJsonFile('yearEndBalances.json');
      } catch (error) {
        if (error.message.includes('ENOENT')) {
          console.log('⚠️  No yearEndBalances.json found - will create fallback with zero balances');
        } else {
          throw error;
        }
      }
      
      // Load client configuration - check both root and subdirectory
      let clientConfig = { fiscalYearStart: 'calendar', accounts: [] };
      try {
        // First try the root directory
        const configData = await this.loadJsonFile('client-config.json');
        if (configData) clientConfig = configData;
      } catch (error) {
        try {
          // Try the subdirectory
          const configData = await this.loadJsonFile('2025-08-06/client-config.json');
          if (configData) clientConfig = configData;
        } catch (subError) {
          console.log('⚠️  No client config found - using defaults');
        }
      }
      
      // Get accounts mapping
      const accountsMap = await this.getAccountsMapping();
      
      // If no data, create fallback
      if (!balancesData) {
        const currentFiscalYear = getFiscalYear(getNow(), clientConfig.fiscalYearStart);
        const fallbackYear = currentFiscalYear - 1;
        
        balancesData = {
          [fallbackYear]: this.createFallbackYearEnd(accountsMap, fallbackYear)
        };
        
        console.log(`📝 Created fallback year-end balance for fiscal year ${fallbackYear}`);
      }
      
      // Process each year
      for (const [year, yearData] of Object.entries(balancesData)) {
        // Skip any internal/private keys
        if (year.startsWith('_')) continue;
        
        try {
          // Extract the simple structure from yearData
          const simpleData = {
            year: yearData.year || parseInt(year),
            date: yearData.date || getNow().toISOString(),
            accounts: yearData.accounts || [],
            created: getNow().toISOString(),
            createdBy: 'import-script'
          };
          
          // Ensure accounts have correct structure
          simpleData.accounts = simpleData.accounts.map(acc => ({
            id: acc.id,
            name: acc.name,
            balance: parseFloat(acc.balance) || 0
          }));
          
          // Save directly to Firestore with the correct structure
          const db = await this.getDb();
          const docId = simpleData.year.toString();
          const balanceRef = db.doc(`clients/${this.clientId}/yearEndBalances/${docId}`);
          
          // Check if document already exists
          const existing = await balanceRef.get();
          if (existing.exists) {
            console.log(`⚠️ Year-end balance for ${simpleData.year} already exists, updating instead`);
            // Update only the accounts array and update metadata
            await balanceRef.update({
              accounts: simpleData.accounts,
              updated: getNow().toISOString(),
              updatedBy: 'import-script'
            });
          } else {
            // Create new document with clean structure
            await balanceRef.set(simpleData);
          }
          
          results.success++;
          results.balanceIds.push(docId);
          console.log(`✅ Imported year-end balance for fiscal year ${year}`);
          
          // Create metadata record
          await this.createMetadataRecord(
            'yearEndBalance',
            docId,
            `clients/${this.clientId}/yearEndBalances/${docId}`,
            yearData
          );
          
        } catch (error) {
          results.failed++;
          results.errors.push(`Error importing balance for year ${year}: ${error.message}`);
        }
      }
    } catch (error) {
      throw new Error(`Year-end balances import failed: ${error.message}`);
    }
    
    return results;
  }

  /**
   * Validate that all required files are present before starting import
   * NOTE: File names must match exactly what the import functions use (case-insensitive lookup handles variations)
   */
  async validateRequiredFiles() {
    const requiredFiles = [
      'Client.json',        // Used by importClient()
      'Config.json',        // Used by importConfig() - NOTE: Capital C
      'Categories.json',    // Used by importCategories()
      'Vendors.json',       // Used by importVendors()
      'Units.json',         // Used by importUnits()
      'Transactions.json',  // Used by importTransactions()
      'HOADues.json',       // Used by importHOADues()
      'paymentMethods.json', // Used by importPaymentTypes()
      'yearEndBalances.json' // Used by importYearEndBalances()
    ];
    
    const missingFiles = [];
    
    for (const fileName of requiredFiles) {
      try {
        await this.loadJsonFile(fileName);
      } catch (error) {
        missingFiles.push(fileName);
      }
    }
    
    if (missingFiles.length > 0) {
      throw new Error(`Missing required files: ${missingFiles.join(', ')}. Cannot proceed with import.`);
    }
    
    console.log('✅ All required files validated successfully');
    return true;
  }

  /**
   * Execute import for selected components
   */
  async executeImport(user, components = []) {
    console.log(`🚀 Starting import for components: ${components.join(', ')}`);
    
    // Validate required files before starting import
    try {
      await this.validateRequiredFiles();
    } catch (error) {
      console.error('❌ File validation failed:', error.message);
      throw error; // Stop import if validation fails
    }
    
    // Define import order
    const importOrder = [
      'categories',
      'vendors',
      'units',
      'users',
      'transactions',
      'hoadues',
      'waterbills',
      'yearEndBalances'
    ];
    
    // Filter and order components based on defined order
    const orderedComponents = importOrder.filter(comp => components.includes(comp));
    
    const results = {
      status: 'running',
      components: {},
      startTime: getNow().toISOString()
    };
    
    // Map component names to import methods
    const importMethods = {
      'categories': this.importCategories.bind(this),
      'vendors': this.importVendors.bind(this),
      'units': this.importUnits.bind(this),
      'users': this.importUsers.bind(this),
      'transactions': this.importTransactions.bind(this),
      'hoadues': this.importHOADues.bind(this),
      'waterbills': this.importWaterBills.bind(this),
      'yearEndBalances': this.importYearEndBalances.bind(this)
    };
    
    // Execute imports in order
    for (const component of orderedComponents) {
      results.components[component] = { status: 'importing' };
      
      try {
        const importMethod = importMethods[component];
        if (!importMethod) {
          throw new Error(`Unknown component: ${component}`);
        }
        
        const componentResult = await importMethod(user);
        results.components[component] = {
          status: 'completed',
          ...componentResult
        };
        
      } catch (error) {
        results.components[component] = {
          status: 'error',
          error: error.message
        };
        console.error(`❌ Error importing ${component}:`, error);
      }
    }
    
    results.status = 'completed';
    results.endTime = getNow().toISOString();
    
    return results;
  }
}