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
   * Import projects collection (optional)
   * Projects are special assessments - direct Firestore export format
   */
  async importProjects(user) {
    console.log('🏗️ Importing projects collection...');
    const results = { success: 0, failed: 0, errors: [], total: 0, skipped: false };
    
    try {
      // Try to load Projects.json - it's optional
      let projectsData;
      try {
        projectsData = await this.loadJsonFile('Projects.json');
      } catch (error) {
        // Projects.json is optional - skip if not found
        console.log('ℹ️ Projects.json not found - skipping projects import');
        results.skipped = true;
        results.reason = 'Projects.json not found (optional)';
        return results;
      }
      
      // Projects should be an object where each key is a project ID
      const projectKeys = Object.keys(projectsData);
      results.total = projectKeys.length;
      
      // Skip the propaneTanks marker if present (it's config, not a project)
      const actualProjects = projectKeys.filter(key => key !== 'propaneTanks');
      results.total = actualProjects.length;
      
      if (actualProjects.length === 0) {
        console.log('ℹ️ No projects to import');
        return results;
      }
      
      // Report starting
      if (this.onProgress) {
        this.onProgress('projects', 'importing', { total: results.total, processed: 0 });
      }
      
      const db = await this.getDb();
      const projectsRef = db.collection(`clients/${this.clientId}/projects`);
      
      for (let i = 0; i < actualProjects.length; i++) {
        const projectKey = actualProjects[i];
        const projectData = projectsData[projectKey];
        
        try {
          // Clean the project data - preserve structure but update metadata
          const cleanProjectData = {
            ...projectData,
            metadata: {
              ...(projectData.metadata || {}),
              updatedAt: getNow().toISOString(),
              updatedBy: 'import-script'
            }
          };
          
          // Remove any _id field as we use the key as doc ID
          delete cleanProjectData._id;
          
          // Use the project key as the document ID
          const docId = projectKey;
          await projectsRef.doc(docId).set(cleanProjectData);
          
          results.success++;
          console.log(`✅ Imported project: ${projectData.name || docId}`);
          
          // Create metadata record
          await this.createMetadataRecord(
            'projects',
            docId,
            `clients/${this.clientId}/projects/${docId}`,
            projectData
          );
          
        } catch (error) {
          results.failed++;
          results.errors.push(`Error importing project ${projectKey}: ${error.message}`);
          console.error(`❌ Failed to import project ${projectKey}:`, error.message);
        }
        
        // Report progress
        this.reportProgress('projects', i, results.total, results);
      }
      
    } catch (error) {
      throw new Error(`Projects collection import failed: ${error.message}`);
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
          
          // Normalize unitId at import time - extract just the unit number, not owner metadata
          // "102 (Moguel)" → "102" - owner info is display metadata, not part of identifier
          if (augmentedData.unitId && transaction.Unit) {
            augmentedData.unitId = this.normalizeUnitId(transaction.Unit);
          }
          
          // Parse date properly using Luxon via DateService
          // CRITICAL: Always interpret dates in Cancun timezone to prevent day shifts
          // JSON.stringify() converts JS Dates to UTC ISO strings, so we parse as UTC
          // then convert to Cancun to get the correct local date
          let parsedDate;
          if (transaction.Date.includes('T')) {
            // Full ISO timestamp (e.g., 2025-01-01T00:52:34.948Z) - parse as UTC, convert to Cancun
            // This handles the case where a Dec 31 evening timestamp in Cancun
            // gets exported as Jan 1 UTC - we convert back to get the correct Cancun date
            parsedDate = DateTime.fromISO(transaction.Date, { zone: 'utc' })
                                 .setZone('America/Cancun');
          } else if (/^\d{4}-\d{2}-\d{2}$/.test(transaction.Date)) {
            // YYYY-MM-DD format - parse in Cancun timezone
            parsedDate = DateTime.fromISO(transaction.Date, { zone: 'America/Cancun' });
          } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(transaction.Date)) {
            // Legacy format: M/d/yyyy - parse with explicit format in Cancun timezone
            parsedDate = DateTime.fromFormat(transaction.Date, 'M/d/yyyy', { zone: 'America/Cancun' });
          } else {
            // Unknown format - try ISO parse as fallback
            parsedDate = DateTime.fromISO(transaction.Date, { zone: 'America/Cancun' });
          }
          
          if (!parsedDate.isValid) {
            console.warn(`⚠️ Invalid date "${transaction.Date}" for transaction ${i}, using current date`);
            parsedDate = DateTime.now().setZone('America/Cancun');
          }
          
          // Output as ISO date string (YYYY-MM-DD) for createTransaction
          augmentedData.date = parsedDate.toISODate();
          
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
              // Normalize unitId - extract just the unit number
              const normalizedUnit = this.normalizeUnitId(transaction.Unit);
              hoaCrossRef.bySequence[seqKey] = {
                transactionId: transactionId,
                unitId: normalizedUnit,
                amount: transaction.Amount,
                date: transaction.Date
              };
              hoaCrossRef.totalRecords++;
              
              // Also track by unit (using normalized ID as key)
              if (!hoaCrossRef.byUnit[normalizedUnit]) {
                hoaCrossRef.byUnit[normalizedUnit] = [];
              }
              hoaCrossRef.byUnit[normalizedUnit].push({
                transactionId: transactionId,
                unitId: normalizedUnit,
                amount: transaction.Amount,
                date: transaction.Date,
                sequenceNumber: seqNumber
              });
              
              console.log(`📝 Recorded HOA CrossRef: Seq ${seqKey} → ${transactionId}`);
            }
            
            // Build CrossRef for Water Bills transactions
            // Accept both English and Spanish category names
            if ((transaction.Category === "Water Consumption" || transaction.Category === "Consumo de agua") && seqNumber) {
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
              type: "hoa-month", // Use hyphens to match categoryId format
              targetId: `month_${payment.month}_${year}`, // month_3_2026 format
              targetName: `${monthName} ${year}`, // "March 2026" format
              amount: amountInCentavos, // Convert pesos to centavos with validation
              percentage: null, // Required field
              categoryName: "HOA Dues", // Required for split transaction UI
              categoryId: "hoa-dues", // Must match categories collection format (hyphen, not underscore)
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
            allocationType: 'hoa-month', // Use hyphens to match categoryId format
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
          // NOTE: initializeYearDocument() was intentionally disabled in Phase 4 refactor
          // because it can't auto-initialize without scheduledAmount.
          // Import has scheduledAmount from HOADues.json, so we create the document directly.
          
          const db = await this.getDb();
          const duesRef = db.collection('clients').doc(this.clientId)
            .collection('units').doc(unitId)
            .collection('dues').doc(year.toString());
          
          // Prepare document data with scheduledAmount
          const duesDocument = {
            year: year,
            scheduledAmount: unitData.scheduledAmount || 0, // From HOADues.json
            payments: []
          };
          duesDocument.creditBalance = admin.firestore.FieldValue.delete();
          duesDocument.creditBalanceHistory = admin.firestore.FieldValue.delete();
          
          // Process payments
          if (unitData.payments && unitData.payments.length > 0) {
            const paymentData = unitData.payments.map(payment => {
              // Extract sequence reference from notes and look up transaction ID: "Seq: 25010"
              let reference = null;
              let extractedDate = null;
              
              if (payment.notes) {
                const seqMatch = payment.notes.match(/Seq:\s*(\d+)/);
                if (seqMatch) {
                  const sequenceNumber = seqMatch[1];
                  // Look up transaction ID from CrossRef using sequence number
                  if (crossReference && crossReference.bySequence && crossReference.bySequence[sequenceNumber]) {
                    reference = crossReference.bySequence[sequenceNumber].transactionId;
                    console.log(`🔗 Payment reference: Seq ${sequenceNumber} → Transaction ${reference}`);
                    
                    // Extract date from transactionId: "2025-07-17_124221_397" → "2025-07-17"
                    // This is more reliable than parsing the notes date format
                    if (reference && reference.includes('_')) {
                      const datePart = reference.split('_')[0]; // Get "2025-07-17"
                      try {
                        const parsedDate = DateTime.fromISO(datePart, { zone: 'America/Cancun' });
                        if (parsedDate.isValid) {
                          extractedDate = parsedDate.toJSDate();
                          console.log(`📅 Extracted date from transactionId: ${datePart}`);
                        }
                      } catch (e) {
                        console.warn(`⚠️ Could not parse date from transactionId ${reference}`);
                      }
                    }
                  } else {
                    console.warn(`⚠️ No CrossRef found for sequence ${sequenceNumber} in unit ${unitId}`);
                    reference = sequenceNumber; // Fallback to sequence number
                  }
                }
              }
              
              // Fallback: Try to extract date from notes if transactionId parsing failed
              if (!extractedDate && payment.notes) {
                const dateMatch = payment.notes.match(/Posted:.*?on\s+(.+?)\s+GMT/i);
                if (dateMatch) {
                  try {
                    // Try parsing as JavaScript Date string format "Thu Jul 17 2025 09:38:52"
                    const dateStr = dateMatch[1].trim();
                    const jsDate = new Date(dateStr);
                    if (!isNaN(jsDate.getTime())) {
                      extractedDate = jsDate;
                      console.log(`📅 Parsed date from notes: ${dateStr}`);
                    }
                  } catch (e) {
                    console.warn(`⚠️ Could not parse date from notes for unit ${unitId}: ${payment.notes}`);
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
            
            // Add payments to the document
            duesDocument.payments = paymentData;
            
            console.log(`✅ Preparing ${paymentData.length} payments for unit ${unitId}`);
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
            
            // CRITICAL: Validate all centavos amounts in history
            const validatedAmount = validateCentavos(Math.abs(tx.amount), 'tx.amount');
            const validatedBalanceBefore = validateCentavos(runningBalance - tx.amount, 'balanceBefore');
            const validatedBalanceAfter = validateCentavos(runningBalance, 'balanceAfter');
            
            creditBalanceHistory.push({
              id: this.generateId(),
              timestamp: txDate,
              transactionId: tx.transactionId,
              type: type,
              amount: validatedAmount, // Store as positive value (validated)
              description: description,
              balanceBefore: validatedBalanceBefore,
              balanceAfter: validatedBalanceAfter,
              notes: tx.notes || ''
            });
          }
          
          // Calculate final balance and add starting balance if needed
          // CRITICAL: Validate all centavos calculations
          const finalCreditBalance = validateCentavos((unitData.creditBalance || 0) * 100, 'unitData.creditBalance');
          const startingBalance = validateCentavos(finalCreditBalance - runningBalance, 'startingBalance');
          
          // If there was a starting balance (from prior period or manual adjustments), add it as first entry
          if (startingBalance !== 0) {
            // Get client config and calculate fiscal year start date
            const clientConfig = await this.getClientConfig();
            const fiscalYearStartMonth = validateFiscalYearConfig(clientConfig);
            const { startDate } = getFiscalYearBounds(year, fiscalYearStartMonth);
            
            // Insert at beginning of history array
            // CRITICAL: Validate all centavos amounts in starting balance entry
            const validatedStartingAmount = validateCentavos(Math.abs(startingBalance), 'startingBalance');
            
            creditBalanceHistory.unshift({
              id: this.generateId(),
              timestamp: startDate, // Start of fiscal year
              transactionId: null,
              type: 'starting_balance',
              amount: validatedStartingAmount,
              description: startingBalance > 0 ? 'Starting credit balance from prior period' : 'Starting debit balance from prior period',
              balanceBefore: 0,
              balanceAfter: startingBalance, // Already validated above
              notes: 'Imported from legacy system'
            });
            
            // Adjust all subsequent balanceBefore/balanceAfter to include starting balance
            let cumulativeBalance = startingBalance; // Already validated
            for (let i = 1; i < creditBalanceHistory.length; i++) {
              const entry = creditBalanceHistory[i];
              const changeAmount = entry.type === 'credit_used' ? -entry.amount : entry.amount;
              // CRITICAL: Validate cumulative balance calculations
              entry.balanceBefore = validateCentavos(cumulativeBalance, `history[${i}].balanceBefore`);
              cumulativeBalance = validateCentavos(cumulativeBalance + changeAmount, `cumulativeBalance[${i}]`);
              entry.balanceAfter = validateCentavos(cumulativeBalance, `history[${i}].balanceAfter`);
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
          
          // CRITICAL: Validate final credit balance before write
          const validatedCreditBalance = validateCentavos(finalCreditBalance, 'finalCreditBalance');
          const validatedScheduledAmount = validateCentavos((unitData.scheduledAmount || 0) * 100, 'scheduledAmount');
          
          // Complete the dues document with all required fields
          duesDocument.scheduledAmount = validatedScheduledAmount;
          duesDocument.totalPaid = totalPaid;
          
          // Write the complete dues document (use set with merge to handle existing docs)
          // NOTE: creditBalance is deprecated in dues document - use new structure instead
          await duesRef.set(duesDocument, { merge: true });
          
          // PHASE 1A NEW STRUCTURE: Write credit balance to /units/creditBalances
          // This is the single source of truth for current credit balances
          const creditBalancesRef = db.collection('clients').doc(this.clientId)
            .collection('units').doc('creditBalances');
          
          // Get existing creditBalances document
          const creditBalancesDoc = await creditBalancesRef.get();
          const allCreditBalances = creditBalancesDoc.exists ? creditBalancesDoc.data() : {};
          
          // Update this unit's credit balance in the new structure
          allCreditBalances[unitId] = {
            creditBalance: validatedCreditBalance,
            lastChange: {
              year: year.toString(),
              historyIndex: creditBalanceHistory.length - 1,
              timestamp: getNow().toISOString()
            },
            history: creditBalanceHistory
          };
          
          // Write to new structure
          await creditBalancesRef.set(allCreditBalances);
          
          results.success++;
          console.log(`✅ Processed HOA dues for unit ${unitId}:`);
          console.log(`   - Payments: ${unitData.payments?.length || 0}`);
          console.log(`   - Credit Balance: ${validatedCreditBalance/100} pesos (${validatedCreditBalance} centavos)`);
          console.log(`   - Written to NEW structure: clients/${this.clientId}/units/creditBalances`);
          
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
   * Extract numeric unit ID from full unit label
   * "102 (Moguel)" → "102"
   * "PH2B (Rosania)" → "PH2B"
   * @param {string} unitLabel - Full unit label with owner name
   * @returns {string} Normalized unit ID
   */
  normalizeUnitId(unitLabel) {
    if (!unitLabel) return null;
    const match = String(unitLabel).match(/^([A-Za-z0-9]+)/);
    return match ? match[1] : unitLabel;
  }

  /**
   * Get fiscal quarter from date (fiscal year starts July)
   * Q1 = Jul-Sep (months 6-8), Q2 = Oct-Dec (months 9-11),
   * Q3 = Jan-Mar (months 0-2), Q4 = Apr-Jun (months 3-5)
   * @param {Date|string} date - Date to calculate quarter for
   * @param {number} fiscalYearStartMonth - First month of fiscal year (1-12, default 7 for July)
   * @returns {Object} { quarter: number, year: number } - year is fiscal year
   */
  getFiscalQuarter(date, fiscalYearStartMonth = 7) {
    const dateObj = date instanceof Date ? date : new Date(date + 'T12:00:00');
    const month = dateObj.getMonth(); // 0-11
    
    // Calculate fiscal year using getFiscalYear utility
    const fiscalYear = getFiscalYear(dateObj, fiscalYearStartMonth);
    
    if (month >= 6 && month <= 8) {
      // Jul, Aug, Sep = Q1
      return { quarter: 1, year: fiscalYear };
    } else if (month >= 9 && month <= 11) {
      // Oct, Nov, Dec = Q2
      return { quarter: 2, year: fiscalYear };
    } else if (month >= 0 && month <= 2) {
      // Jan, Feb, Mar = Q3
      return { quarter: 3, year: fiscalYear };
    } else {
      // Apr, May, Jun = Q4
      return { quarter: 4, year: fiscalYear };
    }
  }

  /**
   * Extract penalty charges from unitAccounting.json
   * @param {Array} unitAccounting - Raw unitAccounting data
   * @param {number} fiscalYearStartMonth - First month of fiscal year (1-12, default 7 for July)
   * @returns {Object} Penalties grouped by unit and fiscal quarter
   */
  extractPenalties(unitAccounting, fiscalYearStartMonth = 7) {
    const penalties = {};
    
    if (!Array.isArray(unitAccounting)) {
      console.warn('⚠️  unitAccounting is not an array, skipping penalty extraction');
      return penalties;
    }
    
    for (const entry of unitAccounting) {
      const category = entry['Categoría'] || entry.Category || '';
      if (category !== 'Cargo por pago atrasado') continue;
      
      const unitId = this.normalizeUnitId(entry.Depto || entry.Unit);
      if (!unitId) continue;
      
      const date = new Date(entry.Fecha || entry.Date);
      if (isNaN(date.getTime())) {
        console.warn(`⚠️  Invalid date for penalty entry:`, entry);
        continue;
      }
      
      const amount = parseFloat(entry.Cantidad || entry.Amount || 0);
      if (isNaN(amount) || amount === 0) continue;
      
      const isPaid = entry['✓'] === true || entry.Paid === true;
      
      // Calculate fiscal quarter (using fiscal year, not calendar year)
      const fiscalQ = this.getFiscalQuarter(date, fiscalYearStartMonth);
      const key = `${unitId}_${fiscalQ.year}_Q${fiscalQ.quarter}`;
      
      if (!penalties[key]) {
        penalties[key] = { 
          unitId, 
          fiscalYear: fiscalQ.year,
          fiscalQuarter: fiscalQ.quarter, 
          totalPenalty: 0, 
          entries: [] 
        };
      }
      penalties[key].totalPenalty += amount;
      penalties[key].entries.push({ date, amount, isPaid });
    }
    
    // Convert totals to centavos
    for (const key in penalties) {
      penalties[key].totalPenaltyCentavos = validateCentavos(
        pesosToCentavos(penalties[key].totalPenalty),
        `penalty[${key}].totalPenalty`
      );
    }
    
    return penalties;
  }

  /**
   * Extract lavado (car/boat wash) charges from unitAccounting.json
   * @param {Array} unitAccounting - Raw unitAccounting data
   * @returns {Array} Lavado charges with normalized unit IDs
   */
  extractLavadoCharges(unitAccounting) {
    const lavado = [];
    
    if (!Array.isArray(unitAccounting)) {
      console.warn('⚠️  unitAccounting is not an array, skipping lavado extraction');
      return lavado;
    }
    
    for (const entry of unitAccounting) {
      const category = entry['Categoría'] || entry.Category || '';
      if (!category.startsWith('Lavado')) continue;
      
      const unitId = this.normalizeUnitId(entry.Depto || entry.Unit);
      if (!unitId) continue;
      
      const date = new Date(entry.Fecha || entry.Date);
      if (isNaN(date.getTime())) {
        console.warn(`⚠️  Invalid date for lavado entry:`, entry);
        continue;
      }
      
      const amount = parseFloat(entry.Cantidad || entry.Amount || 0);
      if (isNaN(amount) || amount === 0) continue;
      
      lavado.push({
        unitId: unitId,
        originalUnitId: entry.Depto || entry.Unit,
        date: date,
        category: category,
        amount: validateCentavos(pesosToCentavos(amount), `lavado[${lavado.length}].amount`),
        isPaid: entry['✓'] === true || entry.Paid === true,
        paidBy: entry.Pagado || null  // Payment reference if exists
      });
    }
    
    return lavado;
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
      const txnCrossRefKeys = Object.keys(txnCrossRef.byPaymentSeq || {});
      console.log(`✓ Loaded transaction CrossRef with ${txnCrossRefKeys.length} payments`);
      
      // Verify CrossRef keys match payment sequences from waterCrossRef
      if (waterCrossRef.length > 0 && txnCrossRefKeys.length > 0) {
        const uniquePaymentSeqs = [...new Set(waterCrossRef.map(c => c.PaymentSeq))];
        const matchingKeys = uniquePaymentSeqs.filter(seq => txnCrossRefKeys.includes(seq));
        console.log(`   Verification: ${matchingKeys.length} of ${uniquePaymentSeqs.length} payment sequences found in CrossRef`);
        if (matchingKeys.length < uniquePaymentSeqs.length) {
          const missing = uniquePaymentSeqs.filter(seq => !txnCrossRefKeys.includes(seq));
          console.warn(`   ⚠️  Missing CrossRef entries for: ${missing.slice(0, 3).map(s => `"${s}"`).join(', ')}${missing.length > 3 ? '...' : ''}`);
        }
      }
      
      // Load client config FIRST to get fiscal year configuration (needed for penalty extraction)
      const clientConfig = await this.getClientConfig();
      const fiscalYearStartMonth = validateFiscalYearConfig(clientConfig);
      const waterBillsConfig = clientConfig.config?.waterBills || clientConfig.waterBills || {};
      const paymentDueDay = waterBillsConfig.paymentDueDate || 10; // Day of month when payment is due
      console.log(`📅 Using fiscal year start month: ${fiscalYearStartMonth}`);
      console.log(`📅 Water bills due date: Day ${paymentDueDay} of bill month`);
      
      // Load unitAccounting.json for penalties and lavado charges
      let penalties = {};
      let lavadoCharges = [];
      try {
        const unitAccountingData = await this.loadJsonFile('unitAccounting.json');
        // Pass fiscalYearStartMonth to extractPenalties so it calculates fiscal year correctly
        penalties = this.extractPenalties(unitAccountingData, fiscalYearStartMonth);
        lavadoCharges = this.extractLavadoCharges(unitAccountingData);
        console.log(`✓ Loaded penalties: ${Object.keys(penalties).length} unit-quarter groups`);
        if (Object.keys(penalties).length > 0) {
          console.log(`   Penalty keys: ${Object.keys(penalties).join(', ')}`);
        }
        console.log(`✓ Loaded lavado charges: ${lavadoCharges.length} entries`);
      } catch (error) {
        console.warn(`⚠️  unitAccounting.json not found or error loading: ${error.message}`);
        console.warn(`   Penalties and lavado charges will not be imported`);
      }
      
      // Parse readings chronologically and group into quarters
      const chronology = this.buildWaterBillsChronology(readingsData, waterCrossRef, txnCrossRef, fiscalYearStartMonth);
      console.log(`📅 Built chronology with ${chronology.length} quarter cycles`);
      
      // Process each quarter cycle: readings → bills → payments
      for (const quarterCycle of chronology) {
        try {
          const quarterId = `${quarterCycle.fiscalYear}-Q${quarterCycle.fiscalQuarter}`;
          console.log(`\n📅 Processing Quarter ${quarterId}: Fiscal months ${quarterCycle.quarterStartMonth}-${quarterCycle.quarterEndMonth}`);
          
          // Step 1: Import readings for all months in this quarter (always import, even for prior year)
          for (const monthCycle of quarterCycle.months) {
            await this.importMonthReadings(monthCycle);
            results.readingsImported++;
          }
          
          // Step 2: Generate quarterly bill (only for fiscal year 2026+, skip prior year quarters)
          if (quarterCycle.shouldGenerateBill !== false) {
            await this.generateQuarterBills(quarterCycle, paymentDueDay, fiscalYearStartMonth, penalties, lavadoCharges);
            results.billsGenerated++;
            
            // Step 3: Process payments made during this quarter (only if bill was generated)
            if (quarterCycle.payments && quarterCycle.payments.length > 0) {
              await this.processQuarterPayments(quarterCycle, txnCrossRef, fiscalYearStartMonth);
              results.paymentsApplied += quarterCycle.payments.length;
            }
          } else {
            console.log(`⏭️  Skipping bill generation for ${quarterId} - prior year quarter (readings imported for starting meter)`);
          }
          
          results.cyclesProcessed++;
          console.log(`✅ Completed quarter ${quarterId}`);
          
        } catch (error) {
          const quarterId = `${quarterCycle.fiscalYear}-Q${quarterCycle.fiscalQuarter}`;
          console.error(`❌ Error processing quarter ${quarterId}:`, error.message);
          results.errors.push({
            quarter: quarterId,
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
   * NOW GROUPS MONTHS INTO QUARTERS instead of individual months
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
        // Normalize unitId - extract just the unit number
        const unitId = this.normalizeUnitId(unitData.Unit);
        const reading = unitData[dateKey];
        
        if (reading !== '' && unitId) {
          readingsByMonth[monthStr].readings[unitId] = reading;
        }
      }
    }
    
    // Group payments by CHARGE DATE (not payment date) to determine which billing month/quarter they belong to
    // A payment can pay for charges from multiple months, so we need to group by ChargeDate
    const paymentsByBillingMonth = {};
    for (const charge of waterCrossRef) {
      // Use ChargeDate to determine which billing month this charge belongs to
      const chargeDate = new Date(charge.ChargeDate);
      // Billing month is the month of the charge date
      const billingMonth = `${chargeDate.getFullYear()}-${String(chargeDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (!paymentsByBillingMonth[billingMonth]) {
        paymentsByBillingMonth[billingMonth] = [];
      }
      paymentsByBillingMonth[billingMonth].push(charge);
    }
    
    // Build monthly chronology first (for grouping into quarters)
    const monthlyChronology = [];
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
      
      monthlyChronology.push({
        readingMonth,
        billingMonth,
        fiscalYear,
        fiscalMonth,
        readings: readingsByMonth[readingMonth].readings,
        payments: paymentsByBillingMonth[billingMonth] || []
      });
    }
    
    // Group monthly cycles into quarters
    // Q1 = fiscal months 0-2, Q2 = 3-5, Q3 = 6-8, Q4 = 9-11
    const quarterlyChronology = [];
    const monthsByFiscalYear = {};
    
    // Group by fiscal year first
    for (const monthCycle of monthlyChronology) {
      const fiscalYear = monthCycle.fiscalYear;
      if (!monthsByFiscalYear[fiscalYear]) {
        monthsByFiscalYear[fiscalYear] = [];
      }
      monthsByFiscalYear[fiscalYear].push(monthCycle);
    }
    
    // For each fiscal year, group into quarters
    // CRITICAL: Import readings for all years (including prior year for starting meter),
    // but only create bills for fiscal year 2026+
    for (const [fiscalYearStr, months] of Object.entries(monthsByFiscalYear)) {
      const fiscalYear = parseInt(fiscalYearStr);
      
      // Group months into quarters
      for (let quarter = 1; quarter <= 4; quarter++) {
        const quarterStartMonth = (quarter - 1) * 3; // Q1=0, Q2=3, Q3=6, Q4=9
        const quarterEndMonth = quarterStartMonth + 2; // Q1=0-2, Q2=3-5, etc.
        
        const quarterMonths = months.filter(m => 
          m.fiscalMonth >= quarterStartMonth && m.fiscalMonth <= quarterEndMonth
        );
        
        if (quarterMonths.length > 0) {
          // Aggregate readings from all 3 months
          const aggregatedReadings = {};
          const allPayments = [];
          const monthNames = [];
          
          for (const monthCycle of quarterMonths) {
            // Merge readings (later months override earlier if same unit)
            Object.assign(aggregatedReadings, monthCycle.readings);
            // Collect all payments
            allPayments.push(...monthCycle.payments);
            
            // Get month name for breakdown
            const billingDate = new Date(monthCycle.billingMonth + '-01');
            const monthName = billingDate.toLocaleString('en-US', { month: 'long' });
            monthNames.push(monthName);
          }
          
          // CRITICAL: Only create bills for fiscal year 2026 and later
          // Prior year quarters (e.g., 2025-Q4) are skipped - readings imported but no bills generated
          const shouldGenerateBill = fiscalYear >= 2026;
          
          quarterlyChronology.push({
            fiscalYear,
            fiscalQuarter: quarter,
            months: quarterMonths, // Preserve monthly detail
            aggregatedReadings,
            payments: allPayments,
            quarterMonths: monthNames, // Human-readable month names
            quarterStartMonth,
            quarterEndMonth,
            shouldGenerateBill // Flag to skip bill generation for prior year quarters
          });
        }
      }
    }
    
    return quarterlyChronology;
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
   * Generate quarterly bills by aggregating 3 months of data
   * Creates bill documents with ID format: {fiscalYear}-Q{quarter} (e.g., 2026-Q1)
   * @param {Object} quarterCycle - Quarter cycle data
   * @param {number} paymentDueDay - Day of month when payment is due
   * @param {number} fiscalYearStartMonth - Fiscal year start month (1-12)
   * @param {Object} penalties - Penalties grouped by unit and fiscal quarter
   * @param {Array} lavadoCharges - Lavado charges array
   */
  async generateQuarterBills(quarterCycle, paymentDueDay, fiscalYearStartMonth, penalties = {}, lavadoCharges = []) {
    const waterBillsService = (await import('./waterBillsService.js')).default;
    const { waterDataService } = await import('./waterDataService.js');
    const db = await this.getDb();
    
    // Get water billing config from the same location waterDataService uses
    // This ensures consistency with how buildSingleMonthData retrieves config
    const waterBillsConfigDoc = await db
      .collection('clients').doc(this.clientId)
      .collection('config').doc('waterBills')
      .get();
    
    let waterBillsConfig = {};
    if (waterBillsConfigDoc.exists) {
      waterBillsConfig = waterBillsConfigDoc.data();
      console.log(`💧 Water billing config loaded: ratePerM3 = ${waterBillsConfig.ratePerM3} centavos`);
    } else {
      console.warn('⚠️  No water billing config found at clients/{clientId}/config/waterBills, using defaults');
      // Use defaults that match waterDataService.fetchWaterBillingConfig
      waterBillsConfig = { ratePerM3: 5000 }; // Default to 5000 cents ($50)
    }
    
    const rateInCentavos = waterBillsConfig.ratePerM3 || 5000;
    const minimumCharge = waterBillsConfig.minimumCharge || 0;
    const rateCarWash = waterBillsConfig.rateCarWash || 0;
    const rateBoatWash = waterBillsConfig.rateBoatWash || 0;
    
    // Calculate bill date: First day of first month in quarter
    const firstMonth = quarterCycle.months[0];
    const [yearNum, monthNum] = firstMonth.billingMonth.split('-').map(Number);
    const billDate = DateTime.fromObject(
      { year: yearNum, month: monthNum, day: 1, hour: 0, minute: 0, second: 0 },
      { zone: 'America/Cancun' }
    ).toJSDate();
    
    // Calculate due date: Start of NEXT quarter
    const lastMonthInQuarter = quarterCycle.months[quarterCycle.months.length - 1];
    const [lastYear, lastMonth] = lastMonthInQuarter.billingMonth.split('-').map(Number);
    // Next quarter starts the month after the last month of current quarter
    const nextQuarterDate = DateTime.fromObject(
      { year: lastYear, month: lastMonth, day: 1 },
      { zone: 'America/Cancun' }
    ).plus({ months: 1 });
    
    const dueDate = nextQuarterDate.toISO();
    const penaltyStartDate = nextQuarterDate.plus({ days: waterBillsConfig.penaltyDays || 30 }).toISO();
    
    console.log(`  📅 Quarter ${quarterCycle.fiscalYear}-Q${quarterCycle.fiscalQuarter}: Bill date: ${billDate.toISOString()}, Due date: ${dueDate}`);
    
    // Aggregate monthly data for all units
    const unitTotals = {};
    const monthlyBreakdowns = {};
    
    // Process each month in the quarter
    for (const monthCycle of quarterCycle.months) {
      try {
        // Get monthly data using waterDataService (calculates consumption from readings)
        const monthData = await waterDataService.buildSingleMonthData(
          this.clientId,
          monthCycle.fiscalYear,
          monthCycle.fiscalMonth
        );
        
        if (!monthData || !monthData.units) {
          console.warn(`  ⚠️  No data found for fiscal month ${monthCycle.fiscalMonth}`);
          continue;
        }
      
      // Get month name for breakdown
      const billingDate = new Date(monthCycle.billingMonth + '-01');
      const monthName = billingDate.toLocaleString('en-US', { month: 'long' });
      
      // Aggregate data for each unit
      for (const [unitId, unitData] of Object.entries(monthData.units)) {
        if (!unitTotals[unitId]) {
          unitTotals[unitId] = {
            totalConsumption: 0,
            totalWaterCharge: 0,
            totalCarWashCharge: 0,
            totalBoatWashCharge: 0,
            totalAmount: 0,
            carWashCount: 0,
            boatWashCount: 0,
            allWashes: []
          };
          monthlyBreakdowns[unitId] = [];
        }
        
        // Extract consumption and charges
        const consumption = unitData.consumption || 0;
        const waterCharge = unitData.billAmount || 0; // Already in centavos
        
        // Extract car/boat wash counts
        let carWashCount = 0;
        let boatWashCount = 0;
        let washes = [];
        
        if (unitData.currentReading?.washes && Array.isArray(unitData.currentReading.washes)) {
          washes = unitData.currentReading.washes;
          carWashCount = washes.filter(w => w.type === 'car').length;
          boatWashCount = washes.filter(w => w.type === 'boat').length;
        }
        
        const carWashCharge = validateCentavos(carWashCount * rateCarWash, 'carWashCharge');
        const boatWashCharge = validateCentavos(boatWashCount * rateBoatWash, 'boatWashCharge');
        const monthTotal = validateCentavos(waterCharge + carWashCharge + boatWashCharge, 'monthTotal');
        
        // Accumulate totals
        unitTotals[unitId].totalConsumption = validateCentavos(
          unitTotals[unitId].totalConsumption + consumption,
          'totalConsumption'
        );
        unitTotals[unitId].totalWaterCharge = validateCentavos(
          unitTotals[unitId].totalWaterCharge + waterCharge,
          'totalWaterCharge'
        );
        unitTotals[unitId].totalCarWashCharge = validateCentavos(
          unitTotals[unitId].totalCarWashCharge + carWashCharge,
          'totalCarWashCharge'
        );
        unitTotals[unitId].totalBoatWashCharge = validateCentavos(
          unitTotals[unitId].totalBoatWashCharge + boatWashCharge,
          'totalBoatWashCharge'
        );
        unitTotals[unitId].totalAmount = validateCentavos(
          unitTotals[unitId].totalAmount + monthTotal,
          'totalAmount'
        );
        unitTotals[unitId].carWashCount += carWashCount;
        unitTotals[unitId].boatWashCount += boatWashCount;
        unitTotals[unitId].allWashes.push(...washes);
        
        // Add to monthly breakdown
          monthlyBreakdowns[unitId].push({
            month: monthName,
            consumption: consumption,
            waterCharge: waterCharge,
            carWashCount: carWashCount,
            boatWashCount: boatWashCount,
            carWashCharge: carWashCharge,
            boatWashCharge: boatWashCharge,
            totalAmount: monthTotal,
            washes: washes || [] // Always an array, even if empty
          });
      }
      } catch (error) {
        console.error(`  ❌ Error processing month ${monthCycle.fiscalMonth} (${monthCycle.billingMonth}):`, error.message);
        throw error; // Re-throw to stop quarter processing
      }
    }
    
    // Build bills object for Firestore
    const bills = {};
    let totalNewCharges = 0;
    let unitsWithBills = 0;
    
    // Match penalties and lavado charges to this quarter
    const quarterKey = `${quarterCycle.fiscalYear}_Q${quarterCycle.fiscalQuarter}`;
    console.log(`  🔍 Looking for penalties with quarter key: ${quarterKey}`);
    if (Object.keys(penalties).length > 0) {
      console.log(`  📋 Available penalty keys: ${Object.keys(penalties).join(', ')}`);
    }
    
    for (const [unitId, totals] of Object.entries(unitTotals)) {
      // Normalize unitId for matching (penalties use normalized IDs like "102", not "102 (Moguel)")
      const normalizedUnitId = this.normalizeUnitId(unitId);
      
      // Check for imported penalty for this unit and quarter
      const penaltyKey = `${normalizedUnitId}_${quarterKey}`;
      const penaltyData = penalties[penaltyKey];
      if (penaltyData) {
        console.log(`  ✅ Found penalty for unit ${normalizedUnitId} (${unitId}): ${centavosToPesos(penaltyData.totalPenaltyCentavos).toFixed(2)} pesos`);
      }
      
      // Find lavado charges for this unit in this quarter's date range
      const quarterStartDate = new Date(quarterCycle.months[0].billingMonth + '-01');
      const quarterEndDate = new Date(quarterCycle.months[quarterCycle.months.length - 1].billingMonth + '-01');
      quarterEndDate.setMonth(quarterEndDate.getMonth() + 1); // End of last month
      
      const unitLavadoCharges = lavadoCharges.filter(lavado => {
        const lavadoNormalizedUnitId = this.normalizeUnitId(lavado.originalUnitId || lavado.unitId);
        const lavadoDate = lavado.date instanceof Date ? lavado.date : new Date(lavado.date);
        return lavadoNormalizedUnitId === normalizedUnitId && 
               lavadoDate >= quarterStartDate && 
               lavadoDate < quarterEndDate;
      });
      
      // Calculate total lavado charge from unitAccounting.json (in addition to washes from readings)
      let importedLavadoCharge = 0;
      for (const lavado of unitLavadoCharges) {
        importedLavadoCharge = validateCentavos(
          importedLavadoCharge + lavado.amount,
          `lavado[${unitId}].total`
        );
      }
      
      // Base amount includes water charge, car wash, boat wash, and imported lavado
      const baseAmount = validateCentavos(
        totals.totalAmount + importedLavadoCharge,
        `baseAmount[${unitId}]`
      );
      
      // Apply imported penalty if available
      const importedPenaltyAmount = penaltyData?.totalPenaltyCentavos || 0;
      
      // Total amount includes base + imported penalty
      const totalAmountWithPenalty = validateCentavos(
        baseAmount + importedPenaltyAmount,
        `totalAmountWithPenalty[${unitId}]`
      );
      
      if (baseAmount > 0 || importedPenaltyAmount > 0) {
        // Build bill object
        const billData = {
          // Consumption summary
          totalConsumption: totals.totalConsumption,
          
          // Service counts
          carWashCount: totals.carWashCount,
          boatWashCount: totals.boatWashCount,
          
          // Preserve washes array (always an array, even if empty)
          washes: totals.allWashes || [],
          
          // Monthly breakdown
          monthlyBreakdown: monthlyBreakdowns[unitId],
          
          // Detailed charges (ALL IN CENTAVOS)
          waterCharge: totals.totalWaterCharge,
          carWashCharge: totals.totalCarWashCharge,
          boatWashCharge: totals.totalBoatWashCharge,
          importedLavadoCharge: importedLavadoCharge, // Lavado from unitAccounting.json
          
          // Core financial fields (ALL IN CENTAVOS)
          currentCharge: baseAmount,
          penaltyAmount: importedPenaltyAmount, // Imported penalty from unitAccounting.json
          totalAmount: totalAmountWithPenalty,
          status: 'unpaid',
          paidAmount: 0,
          
          // Payment tracking
          penaltyPaid: 0,
          basePaid: 0,
          payments: [],
          
          // Timestamp
          lastPenaltyUpdate: getNow().toISOString(),
          
          // Import metadata
          dataSource: 'sheets_import',
          importedAt: getNow().toISOString()
        };
        
        // Only add penalty field if there's an imported penalty (Firestore doesn't allow undefined)
        if (importedPenaltyAmount > 0) {
          billData.penalty = {
            amount: importedPenaltyAmount,
            source: 'imported', // Mark as imported, not calculated
            entries: penaltyData?.entries || []
          };
        }
        
        bills[unitId] = billData;
        
        totalNewCharges += totalAmountWithPenalty;
        unitsWithBills++;
        
        if (importedPenaltyAmount > 0) {
          console.log(`  💰 Applied imported penalty to unit ${unitId}: ${centavosToPesos(importedPenaltyAmount).toFixed(2)} pesos`);
        }
        if (importedLavadoCharge > 0) {
          console.log(`  🚿 Applied imported lavado charges to unit ${unitId}: ${centavosToPesos(importedLavadoCharge).toFixed(2)} pesos`);
        }
      }
    }
    
    // Create quarterly bill document
    const billId = `${quarterCycle.fiscalYear}-Q${quarterCycle.fiscalQuarter}`;
    const monthNames = ['July', 'August', 'September', 'October', 'November', 'December', 
                        'January', 'February', 'March', 'April', 'May', 'June'];
    
    const billsData = {
      billDate: billDate.toISOString(),
      dueDate: dueDate,
      penaltyStartDate: penaltyStartDate,
      billingPeriod: 'quarterly', // CRITICAL: Must be exactly this string
      fiscalYear: quarterCycle.fiscalYear,
      fiscalQuarter: quarterCycle.fiscalQuarter, // 1-4
      quarterMonths: quarterCycle.quarterMonths, // Human-readable month names
      readingsIncluded: quarterCycle.months.map(m => ({
        month: m.fiscalMonth,
        label: `${monthNames[m.fiscalMonth]} usage`,
        docId: `${m.fiscalYear}-${String(m.fiscalMonth).padStart(2, '0')}`
      })),
      configSnapshot: {
        ratePerM3: rateInCentavos,
        minimumCharge: minimumCharge,
        penaltyRate: waterBillsConfig.penaltyRate || 0.05,
        penaltyDays: waterBillsConfig.penaltyDays || 30,
        currency: waterBillsConfig.currency || 'MXN',
        currencySymbol: waterBillsConfig.currencySymbol || '$',
        rateCarWash: rateCarWash,
        rateBoatWash: rateBoatWash,
        compoundPenalty: waterBillsConfig.compoundPenalty || false
      },
      bills: {
        units: bills
      },
      summary: {
        totalUnits: unitsWithBills,
        totalNewCharges: totalNewCharges,
        totalBilled: totalNewCharges,
        totalUnpaid: totalNewCharges,
        totalPaid: 0,
        currency: waterBillsConfig.currency || 'MXN',
        currencySymbol: waterBillsConfig.currencySymbol || '$'
      },
      metadata: {
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        generatedBy: 'import-service',
        penaltiesApplied: false
      }
    };
    
    // Ensure waterBills document exists
    const waterBillsRef = db
      .collection('clients').doc(this.clientId)
      .collection('projects').doc('waterBills');
    
    const waterBillsDoc = await waterBillsRef.get();
    if (!waterBillsDoc.exists) {
      console.log('🔧 Creating waterBills document to prevent ghost status...');
      await waterBillsRef.set({
        _purgeMarker: 'DO_NOT_DELETE',
        _createdBy: 'import-service',
        _createdAt: admin.firestore.FieldValue.serverTimestamp(),
        _structure: 'waterBills'
      });
    }
    
    // Save quarterly bill document
    const billsRef = db
      .collection('clients').doc(this.clientId)
      .collection('projects').doc('waterBills')
      .collection('bills');
    
    await billsRef.doc(billId).set(billsData);
    
    console.log(`  💵 Generated quarterly bill ${billId}: ${unitsWithBills} units, ${quarterCycle.months.length} months, total: ${totalNewCharges} centavos`);
    
    // Invalidate cache
    waterDataService.invalidate(this.clientId, quarterCycle.fiscalYear);
  }
  
  /**
   * Process payments for a quarter
   * CRITICAL: Converts payment amounts from pesos to centavos (WB1 requirement)
   * Maps payments to quarterly bills instead of monthly bills
   */
  async processQuarterPayments(quarterCycle, txnCrossRef, fiscalYearStartMonth) {
    // Group charges by payment sequence
    const paymentGroups = {};
    
    for (const charge of quarterCycle.payments) {
      const paySeq = charge.PaymentSeq;
      
      // CRITICAL: Convert amount from pesos to centavos (import files are in pesos)
      // Validate conversion output to ensure integer centavos
      const amountInCentavos = validateCentavos(pesosToCentavos(charge.AmountApplied), 'AmountApplied');
      
      if (!paymentGroups[paySeq]) {
        paymentGroups[paySeq] = {
          paymentSeq: paySeq,
          unit: this.normalizeUnitId(charge.Unit),
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
    
    // Apply each payment to quarterly bills
    for (const [paySeq, payment] of Object.entries(paymentGroups)) {
      // Look up transaction ID from CrossRef
      const transactionId = txnCrossRef?.byPaymentSeq?.[paySeq]?.transactionId || null;
      
      if (!transactionId) {
        console.warn(`⚠️  No transaction ID found in CrossRef for payment ${paySeq}`);
      }
      
      // Filter charges to only those that belong to the current quarter
      // A payment might have charges from multiple quarters, but we only process charges for this quarter
      const chargesForThisQuarter = payment.charges.filter(charge => {
        const chargeDate = new Date(charge.ChargeDate);
        const chargeFiscalYear = getFiscalYear(chargeDate, fiscalYearStartMonth);
        const calendarMonth = chargeDate.getMonth() + 1;
        let chargeFiscalMonth = calendarMonth - fiscalYearStartMonth;
        if (chargeFiscalMonth < 0) chargeFiscalMonth += 12;
        const chargeFiscalQuarter = Math.floor(chargeFiscalMonth / 3) + 1;
        
        return chargeFiscalYear === quarterCycle.fiscalYear && 
               chargeFiscalQuarter === quarterCycle.fiscalQuarter;
      });
      
      if (chargesForThisQuarter.length === 0) {
        // This payment has no charges for this quarter, skip it
        continue;
      }
      
      // Find which quarterly bills this payment applies to (should only be the current quarter)
      const billsToUpdate = await this.findQuarterBillsForCharges(
        chargesForThisQuarter, 
        quarterCycle.fiscalYear, 
        quarterCycle.fiscalQuarter,
        fiscalYearStartMonth
      );
      
      if (billsToUpdate.length === 0) {
        console.warn(`⚠️  No quarterly bills found for payment ${paySeq} (quarter ${quarterCycle.fiscalYear}-Q${quarterCycle.fiscalQuarter})`);
        continue;
      }
      
      // Update each bill with payment info including transaction ID
      // Note: For quarterly bills, there should only be one bill per unit per quarter
      for (const billUpdate of billsToUpdate) {
        billUpdate.transactionId = transactionId;
        billUpdate.paymentDate = payment.paymentDate;
        billUpdate.paymentSeq = paySeq;
        await this.applyPaymentToQuarterBill(billUpdate, fiscalYearStartMonth);
      }
      
      // Convert centavos to pesos for logging
      const totalAmountPesos = centavosToPesos(payment.totalAmount);
      console.log(`  💰 Applied payment ${paySeq} (txn: ${transactionId || 'none'}): $${totalAmountPesos.toFixed(2)} (${payment.totalAmount} centavos) → ${billsToUpdate.length} quarterly bill(s)`);
    }
  }
  
  /**
   * Process payments for a single month
   * CRITICAL: Converts payment amounts from pesos to centavos (WB1 requirement)
   * NOTE: This method is kept for backwards compatibility but should not be used for quarterly imports
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
          unit: this.normalizeUnitId(charge.Unit),
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
      
      // Normalize unitId - extract just the unit number
      const normalizedUnit = this.normalizeUnitId(charge.Unit);
      
      // Find existing bill update or create new one
      let billUpdate = billUpdates.find(
        b => b.fiscalYear === fiscalYear && b.fiscalMonth === fiscalMonth && b.unitId === normalizedUnit
      );
      
      if (!billUpdate) {
        billUpdate = {
          fiscalYear,
          fiscalMonth,
          unitId: normalizedUnit,
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
    
    // Determine best transactionId for linking:
    // - If bill is paid, prefer payment from last month of quarter
    // - Otherwise, use most recent payment
    let bestTransactionId = null;
    if (newStatus === 'paid' && updatedPayments.length > 0) {
      // Calculate last month of quarter (fiscal months: Q1=0-2, Q2=3-5, Q3=6-8, Q4=9-11)
      // Last month = (quarter * 3) - 1 (e.g., Q1 last month = 2, Q2 last month = 5)
      const lastMonthOfQuarter = (billUpdate.fiscalQuarter * 3) - 1;
      
      // Find payment from last month of quarter
      const lastMonthPayment = updatedPayments.find(payment => {
        if (!payment.date) return false;
        const paymentDate = new Date(payment.date);
        const paymentFiscalYear = getFiscalYear(paymentDate, fiscalYearStartMonth);
        const calendarMonth = paymentDate.getMonth() + 1;
        let paymentFiscalMonth = calendarMonth - fiscalYearStartMonth;
        if (paymentFiscalMonth < 0) paymentFiscalMonth += 12;
        
        return paymentFiscalYear === billUpdate.fiscalYear && 
               paymentFiscalMonth === lastMonthOfQuarter &&
               payment.transactionId;
      });
      
      bestTransactionId = lastMonthPayment?.transactionId || null;
    }
    
    // If no last-month payment found (or bill not paid), use most recent payment with transactionId
    if (!bestTransactionId && updatedPayments.length > 0) {
      // Sort by date descending and find first with transactionId
      const sortedPayments = [...updatedPayments].sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });
      bestTransactionId = sortedPayments.find(p => p.transactionId)?.transactionId || null;
    }
    
    await billRef.update({
      [`bills.units.${billUpdate.unitId}.paidAmount`]: newPaidAmount,
      [`bills.units.${billUpdate.unitId}.basePaid`]: newBasePaid,
      [`bills.units.${billUpdate.unitId}.penaltyPaid`]: newPenaltyPaid,
      [`bills.units.${billUpdate.unitId}.status`]: newStatus,
      [`bills.units.${billUpdate.unitId}.payments`]: updatedPayments,
      [`bills.units.${billUpdate.unitId}.transactionId`]: bestTransactionId
    });
    
    // Convert centavos to pesos for logging
    const amountPesos = centavosToPesos(billUpdate.amountApplied);
    console.log(`    ✓ Updated quarterly bill ${billId} unit ${billUpdate.unitId}: +$${amountPesos.toFixed(2)} (${billUpdate.amountApplied} centavos) → ${newStatus} (txn: ${bestTransactionId || 'none'})`);
  }
  
  /**
   * Find which quarterly bills a set of charges applies to
   * Maps monthly charges to quarterly bills based on fiscal month
   */
  async findQuarterBillsForCharges(charges, fiscalYear, fiscalQuarter, fiscalYearStartMonth) {
    const billUpdates = [];
    
    for (const charge of charges) {
      const chargeDate = new Date(charge.ChargeDate);
      const chargeFiscalYear = getFiscalYear(chargeDate, fiscalYearStartMonth);
      const calendarMonth = chargeDate.getMonth() + 1;
      let chargeFiscalMonth = calendarMonth - fiscalYearStartMonth;
      if (chargeFiscalMonth < 0) chargeFiscalMonth += 12;
      
      // Calculate which quarter this fiscal month belongs to
      const chargeQuarter = Math.floor(chargeFiscalMonth / 3) + 1; // Q1=1, Q2=2, Q3=3, Q4=4
      
      // Only include if charge belongs to the target quarter
      if (chargeFiscalYear === fiscalYear && chargeQuarter === fiscalQuarter) {
        // Normalize unitId - extract just the unit number
        const normalizedUnit = this.normalizeUnitId(charge.Unit);
        
        // Find existing bill update or create new one
        let billUpdate = billUpdates.find(
          b => b.fiscalYear === fiscalYear && b.fiscalQuarter === fiscalQuarter && b.unitId === normalizedUnit
        );
        
        if (!billUpdate) {
          billUpdate = {
            fiscalYear,
            fiscalQuarter,
            unitId: normalizedUnit,
            amountApplied: 0,
            basePaid: 0,
            penaltyPaid: 0
          };
          billUpdates.push(billUpdate);
        }
        
        // Use centavos version (already converted in processQuarterPayments)
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
    }
    
    return billUpdates;
  }
  
  /**
   * Apply payment to a specific quarterly bill
   * @param {Object} billUpdate - Payment update data
   * @param {number} fiscalYearStartMonth - Fiscal year start month (1-12)
   */
  async applyPaymentToQuarterBill(billUpdate, fiscalYearStartMonth = 7) {
    const db = await this.getDb();
    
    const billId = `${billUpdate.fiscalYear}-Q${billUpdate.fiscalQuarter}`;
    const billRef = db
      .collection('clients').doc(this.clientId)
      .collection('projects').doc('waterBills')
      .collection('bills').doc(billId);
    
    const billDoc = await billRef.get();
    if (!billDoc.exists) {
      console.warn(`⚠️  Quarterly bill document ${billId} not found for unit ${billUpdate.unitId}`);
      return;
    }
    
    const billData = billDoc.data();
    const unitBill = billData.bills?.units?.[billUpdate.unitId];
    
    if (!unitBill) {
      console.warn(`⚠️  No bill for unit ${billUpdate.unitId} in quarterly bill ${billId}`);
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
    console.log(`    ✓ Updated quarterly bill ${billId} unit ${billUpdate.unitId}: +$${amountPesos.toFixed(2)} (${billUpdate.amountApplied} centavos) → ${newStatus} (txn: ${billUpdate.transactionId || 'none'})`);
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