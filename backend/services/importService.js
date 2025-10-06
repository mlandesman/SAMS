/*
 * File: /backend/services/importService.js
 * Purpose: Service for handling web-based import operations using real controllers
 */

import fs from 'fs/promises';
import path from 'path';
import admin from 'firebase-admin';
import { DateService } from './DateService.js';
import { getFiscalYear } from '../utils/fiscalYearUtils.js';
import { readFileFromFirebaseStorage, deleteImportFiles } from '../api/importStorage.js';
import { 
  augmentMTCTransaction,
  augmentMTCUnit,
  augmentMTCCategory,
  augmentMTCVendor,
  augmentMTCUser,
  augmentMTCHOADues,
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
   */
  async loadJsonFile(filename) {
    try {
      let data;
      
      if (this.isFirebaseStorage) {
        // Read from Firebase Storage using the provided clientId
        const filePath = `imports/${this.clientId}/${filename}`;
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
          updatedAt: new Date().toISOString(),
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
            updatedAt: new Date().toISOString(),
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
            updatedAt: new Date().toISOString(),
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
          const augmentedData = augmentMTCCategory(category);
          
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
          const augmentedData = augmentMTCVendor(vendor);
          
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
          const augmentedData = augmentMTCUnit(unit, sizeData);
          
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
          const augmentedData = augmentMTCUser(mapping);
          
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
    
    // Initialize CrossRef structure
    const hoaCrossRef = {
      generated: new Date().toISOString(),
      totalRecords: 0,
      bySequence: {},
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
          
          // Debug vendor lookup for first few transactions
          if (i < 5) {
            console.log(`🔍 Transaction ${i}: Vendor="${transaction.Vendor}", vendorId=${vendorId}, vendorMap has key: ${vendorMap.hasOwnProperty(transaction.Vendor)}`);
          }
          
          const augmentedData = augmentMTCTransaction(transaction, vendorId, categoryId, accountId, vendorName);
          
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
        const crossRefPath = path.join(this.dataPath, 'HOA_Transaction_CrossRef.json');
        await fs.writeFile(crossRefPath, JSON.stringify(hoaCrossRef, null, 2));
        console.log(`💾 Saved HOA CrossRef with ${hoaCrossRef.totalRecords} entries to ${crossRefPath}`);
        results.hoaCrossRefGenerated = true;
        results.hoaCrossRefRecords = hoaCrossRef.totalRecords;
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
      const year = new Date().getFullYear();
      
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
            return {
              id: `alloc_${String(index + 1).padStart(3, '0')}`, // alloc_001, alloc_002, etc.
              type: "hoa_month",
              targetId: `month_${payment.month}_${year}`, // month_3_2026 format
              targetName: `${monthName} ${year}`, // "March 2026" format
              amount: payment.amount * 100, // Convert pesos to centavos
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
                createdAt: new Date().toISOString()
              }
            };
          });
          
          // Calculate if there's a credit balance allocation needed
          const totalDuesAmount = hoaData.payments.reduce((sum, p) => sum + (p.amount * 100), 0);
          const transactionAmount = Math.round(transaction.Amount * 100); // Convert to centavos
          const creditAmount = transactionAmount - totalDuesAmount;
          
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
                createdAt: new Date().toISOString()
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
                    // Parse the date string
                    const dateStr = dateMatch[1].trim();
                    // Convert "Sat Dec 28 2024 13:56:50" format
                    extractedDate = new Date(dateStr);
                    if (isNaN(extractedDate.getTime())) {
                      extractedDate = null; // Invalid date
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
              
              return {
                month: payment.month,
                amount: payment.paid * 100, // Convert to cents  
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
                  const totalDuesAmount = hoaPaymentsForSequence.reduce((sum, p) => sum + (p.amount * 100), 0);
                  const transactionAmount = Math.round(transaction.Amount * 100);
                  const creditAmount = transactionAmount - totalDuesAmount;
                  
                  if (creditAmount !== 0) {
                    runningBalance += creditAmount;
                    
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
            
            creditBalanceHistory.push({
              id: this.generateId(),
              timestamp: new Date(tx.date),
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
          
          // If there was a starting balance (from pre-2025 or manual adjustments), add it as first entry
          if (startingBalance !== 0) {
            // Insert at beginning of history array
            creditBalanceHistory.unshift({
              id: this.generateId(),
              timestamp: new Date('2025-01-01'), // Start of 2025
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
          const totalPaid = unitData.payments 
            ? unitData.payments.reduce((sum, p) => sum + (p.paid || 0), 0) * 100 
            : 0;
          
          // Update dues document with scheduled amount, totals, credit balance and history
          await duesRef.update({
            scheduledAmount: (unitData.scheduledAmount || 0) * 100, // Convert pesos to centavos
            totalPaid: totalPaid, // Calculate from payments
            creditBalance: finalCreditBalance,
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
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
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
    const accountsRef = db.collection('clients').doc(this.clientId).collection('accounts');
    const accountsSnapshot = await accountsRef.get();
    
    const accountsMap = {};
    accountsSnapshot.forEach(doc => {
      const account = doc.data();
      accountsMap[account.name] = {
        id: doc.id,
        name: account.name,
        type: account.type
      };
    });
    
    console.log(`✅ Loaded ${Object.keys(accountsMap).length} account mappings`);
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
    const yearEndDate = new Date(`${fiscalYear}-12-31`).toISOString();
    
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
        const currentFiscalYear = getFiscalYear(new Date(), clientConfig.fiscalYearStart);
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
            date: yearData.date || new Date(`${year}-12-31`).toISOString(),
            accounts: yearData.accounts || [],
            created: new Date().toISOString(),
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
              updated: new Date().toISOString(),
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
   * Execute import for selected components
   */
  async executeImport(user, components = []) {
    console.log(`🚀 Starting import for components: ${components.join(', ')}`);
    
    // Define import order
    const importOrder = [
      'categories',
      'vendors',
      'units',
      'users',
      'transactions',
      'hoadues',
      'yearEndBalances'
    ];
    
    // Filter and order components based on defined order
    const orderedComponents = importOrder.filter(comp => components.includes(comp));
    
    const results = {
      status: 'running',
      components: {},
      startTime: new Date().toISOString()
    };
    
    // Map component names to import methods
    const importMethods = {
      'categories': this.importCategories.bind(this),
      'vendors': this.importVendors.bind(this),
      'units': this.importUnits.bind(this),
      'users': this.importUsers.bind(this),
      'transactions': this.importTransactions.bind(this),
      'hoadues': this.importHOADues.bind(this),
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
    results.endTime = new Date().toISOString();
    
    return results;
  }
}