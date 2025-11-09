/**
 * Client Onboarding Controller
 * Template-based client creation system for SAMS
 * Extracts MTC client structure and creates new clients from templates
 */

import admin from 'firebase-admin';
import { getDb } from '../firebase.js';
import { getNow } from '../services/DateService.js';
import creditService from '../services/creditService.js';

/**
 * Extract client template from existing client (primarily MTC)
 */
const extractClientTemplate = async (req, res) => {
  try {
    const { sourceClientId } = req.params;
    console.log(`🔍 Extracting template from client: ${sourceClientId}`);

    // Get database instance
    const db = await getDb();

    // Extract all client structure components
    const template = {
      clientType: "HOA_Management",
      version: "1.0.0",
      extractedFrom: sourceClientId,
      extractedAt: getNow().toISOString(),
      
      // Client metadata template
      clientMetadata: await extractClientMetadata(sourceClientId, db),
      
      // Account structure template
      accountStructure: await extractAccountStructure(sourceClientId, db),
      
      // Category templates
      categoryTemplates: await extractCategoryTemplates(sourceClientId, db),
      
      // Vendor templates  
      vendorTemplates: await extractVendorTemplates(sourceClientId, db),
      
      // Unit configuration templates
      unitTemplates: await extractUnitTemplates(sourceClientId, db),
      
      // Payment method templates
      paymentMethodTemplates: await extractPaymentMethodTemplates(sourceClientId, db),
      
      // Configuration templates
      configurationTemplates: await extractConfigurationTemplates(sourceClientId, db),
      
      // Auto-categorization rules
      autoCategorizeRules: await extractAutoCategorizeRules(sourceClientId, db),
      creditTemplates: await extractCreditTemplates(sourceClientId, db)
    };

    res.json({
      success: true,
      template,
      extractedComponents: Object.keys(template).length,
      message: `Template extracted successfully from ${sourceClientId}`
    });

  } catch (error) {
    console.error('❌ Template extraction failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Template extraction failed'
    });
  }
};

/**
 * Create new client from template
 */
const createClientFromTemplate = async (req, res) => {
  try {
    const {
      clientInfo,
      templateData,
      customizations = {},
      adminUser,
      initialUsers = []
    } = req.body;

    console.log(`🏗️ Creating new client: ${clientInfo.code} using template`);

    // Get database instance
    const db = await getDb();

    // Validate required fields
    if (!clientInfo.name || !clientInfo.code || !templateData) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: clientInfo.name, clientInfo.code, and templateData'
      });
    }

    // Check if client already exists
    const existingClient = await db.collection('clients').doc(clientInfo.code).get();
    if (existingClient.exists) {
      return res.status(409).json({
        success: false,
        error: `Client with code ${clientInfo.code} already exists`
      });
    }

    // Create client using batch operations for atomicity
    const batch = db.batch();
    const clientId = clientInfo.code;

    // Step 1: Create base client document
    const clientRef = db.collection('clients').doc(clientId);
    const clientData = {
      ...templateData.clientMetadata,
      ...clientInfo,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      templateVersion: templateData.version,
      sourceTemplate: templateData.extractedFrom
    };
    batch.set(clientRef, clientData);

    // Step 2: Initialize all collections from template
    await initializeClientCollections(clientId, templateData, customizations, batch, db);

    // Step 3: Set up initial user access
    if (adminUser) {
      await setupInitialUserAccess(clientId, adminUser, initialUsers);
    }

    // Commit all changes
    await batch.commit();
    console.log(`✅ Client ${clientId} created successfully`);

    res.json({
      success: true,
      clientId,
      collectionsCreated: [
        'categories',
        'vendors', 
        'accounts',
        'paymentMethods',
        'units',
        'config'
      ],
      message: `Client ${clientInfo.name} (${clientId}) created successfully`
    });

  } catch (error) {
    console.error('❌ Client creation failed:', error);
    
    // Attempt cleanup if partial creation occurred
    try {
      if (req.body.clientInfo?.code) {
        const db = await getDb();
        await cleanupPartialClient(req.body.clientInfo.code, db);
      }
    } catch (cleanupError) {
      console.error('❌ Cleanup failed:', cleanupError);
    }

    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Client creation failed'
    });
  }
};

/**
 * Get available client templates
 */
const getClientTemplates = async (req, res) => {
  try {
    // For now, we have one template based on MTC
    // In the future, this could pull from a templates collection
    const templates = [
      {
        id: 'hoa_management',
        name: 'HOA Management Template',
        description: 'Standard HOA community management setup based on Marina Turquesa Condominiums',
        version: '1.0.0',
        sourceClient: 'MTC',
        features: [
          'Unit-based dues management',
          'Expense categorization for HOA operations',
          'Multi-currency support',
          'Document management',
          'Financial reporting'
        ],
        dataStructure: {
          accounts: 'Bank and cash account management',
          categories: 'HOA-specific income and expense categories',
          vendors: 'Common HOA service providers',
          units: 'Unit owner and dues tracking',
          paymentMethods: 'Standard payment processing'
        }
      }
    ];

    res.json({
      success: true,
      templates,
      count: templates.length
    });

  } catch (error) {
    console.error('❌ Failed to get templates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Helper functions for template extraction

async function extractClientMetadata(clientId, db) {
  const clientDoc = await db.collection('clients').doc(clientId).get();
  if (!clientDoc.exists) {
    throw new Error(`Client ${clientId} not found`);
  }

  const data = clientDoc.data();
  // Remove client-specific data, keep structure
  return {
    fullName: '', // Will be replaced with new client name
    notes: '',
    email: '',
    phone: '',
    address: '',
    iconUrl: '',
    logoUrl: '',
    accounts: data.accounts || [],
    // Keep structural fields
    createdAt: null,
    updatedAt: null
  };
}

async function extractAccountStructure(clientId, db) {
  // MTC stores accounts in the client document, but let's also check for account collection
  const clientDoc = await db.collection('clients').doc(clientId).get();
  const clientData = clientDoc.data();
  
  return {
    defaultAccounts: clientData.accounts || [],
    structure: {
      fields: ['name', 'type', 'currency', 'balance', 'active'],
      types: ['bank', 'cash'],
      currencies: ['MXN', 'USD']
    }
  };
}

async function extractCategoryTemplates(clientId, db) {
  const categoriesSnapshot = await db.collection('clients').doc(clientId).collection('categories').get();
  
  const categories = {
    income: [],
    expense: []
  };

  categoriesSnapshot.forEach(doc => {
    const data = doc.data();
    const category = {
      name: data.name || doc.id,
      type: data.type || 'expense', // Default to expense
      required: false // All categories optional for new clients
    };
    
    if (category.type === 'income') {
      categories.income.push(category);
    } else {
      categories.expense.push(category);
    }
  });

  return categories;
}

async function extractVendorTemplates(clientId, db) {
  const vendorsSnapshot = await db.collection('clients').doc(clientId).collection('vendors').get();
  
  const vendors = [];
  vendorsSnapshot.forEach(doc => {
    const data = doc.data();
    vendors.push({
      name: data.name || doc.id,
      category: data.category || 'General',
      type: data.type || 'regular'
    });
  });

  return vendors;
}

async function extractUnitTemplates(clientId, db) {
  const unitsSnapshot = await db.collection('clients').doc(clientId).collection('units').get();
  
  const structure = {
    fields: ['unitId', 'unitName', 'owners', 'emails', 'duesAmount', 'percentOwned', 'active'],
    sampleUnit: null
  };

  if (!unitsSnapshot.empty) {
    const firstUnit = unitsSnapshot.docs[0].data();
    structure.sampleUnit = {
      unitId: '', // Will be replaced
      unitName: '',
      owners: [],
      emails: [],
      duesAmount: firstUnit.duesAmount || 0,
      percentOwned: 0,
      active: true
    };
  }

  return structure;
}

async function extractPaymentMethodTemplates(clientId, db) {
  const methodsSnapshot = await db.collection('clients').doc(clientId).collection('paymentMethods').get();
  
  const methods = [];
  methodsSnapshot.forEach(doc => {
    const data = doc.data();
    methods.push({
      name: data.name || doc.id,
      type: data.type || 'standard'
    });
  });

  // Add standard payment methods if none exist
  if (methods.length === 0) {
    methods.push(
      { name: 'Bank Transfer', type: 'transfer' },
      { name: 'Cash', type: 'cash' },
      { name: 'Check', type: 'check' },
      { name: 'Credit Card', type: 'card' }
    );
  }

  return methods;
}

async function extractConfigurationTemplates(clientId, db) {
  const configDoc = await db.collection('clients').doc(clientId).collection('config').doc('lists').get();
  
  const defaultConfig = {
    lists: {
      vendor: true,
      category: true,
      method: true,
      unit: true,
      exchangerates: true
    },
    features: {
      hoaDues: true,
      documents: true,
      multiCurrency: true,
      emailNotifications: true
    }
  };

  if (configDoc.exists) {
    return { ...defaultConfig, ...configDoc.data() };
  }

  return defaultConfig;
}

async function extractAutoCategorizeRules(clientId, db) {
  // Look for auto-categorization rules in the client configuration
  try {
    const rulesDoc = await db.collection('clients').doc(clientId).collection('config').doc('autoCategorize').get();
    
    if (rulesDoc.exists) {
      return rulesDoc.data();
    }
  } catch (error) {
    console.log('No auto-categorize rules found, using defaults');
  }

  return {
    vendorToCategory: {},
    rules: []
  };
}

async function extractCreditTemplates(clientId, db) {
  try {
    const creditBalancesRef = db.collection('clients').doc(clientId)
      .collection('units').doc('creditBalances');
    const creditBalancesDoc = await creditBalancesRef.get();

    if (!creditBalancesDoc.exists) {
      console.log(`ℹ️ No credit balance document found for client ${clientId} during template extraction`);
      return {};
    }

    const creditData = creditBalancesDoc.data() || {};
    const unitIds = Object.keys(creditData);
    const creditTemplates = {};

    await Promise.all(unitIds.map(async (unitId) => {
      try {
        const historyResult = await creditService.getCreditHistory(clientId, unitId, 25);
        const currentBalanceCentavos = creditData[unitId]?.creditBalance || 0;

        creditTemplates[unitId] = {
          currentBalanceCentavos,
          currentBalancePesos: currentBalanceCentavos / 100,
          history: historyResult.history || []
        };
      } catch (error) {
        console.warn(`⚠️ Failed to extract credit history for unit ${unitId}:`, error.message);
      }
    }));

    return creditTemplates;
  } catch (error) {
    console.warn(`⚠️ Could not extract credit templates for client ${clientId}:`, error.message);
    return {};
  }
}

// Helper functions for client creation

async function initializeClientCollections(clientId, templateData, customizations, batch, db) {
  // Initialize categories
  await initializeCategories(clientId, templateData.categoryTemplates, customizations.categories, batch, db);
  
  // Initialize vendors
  await initializeVendors(clientId, templateData.vendorTemplates, customizations.vendors, batch, db);
  
  // Initialize payment methods
  await initializePaymentMethods(clientId, templateData.paymentMethodTemplates, customizations.paymentMethods, batch, db);
  
  // Initialize configuration
  await initializeConfiguration(clientId, templateData.configurationTemplates, customizations.config, batch, db);
  
  // Units will be created separately as they're typically imported from external data
  console.log(`✅ Collections initialized for client ${clientId}`);
}

async function initializeCategories(clientId, categoryTemplates, customizations = {}, batch, db) {
  const categoriesToAdd = [...categoryTemplates.income, ...categoryTemplates.expense];
  
  // Apply customizations
  if (customizations.add) {
    categoriesToAdd.push(...customizations.add);
  }
  
  const categoriesToRemove = customizations.remove || [];
  const finalCategories = categoriesToAdd.filter(cat => !categoriesToRemove.includes(cat.name));

  finalCategories.forEach(category => {
    const categoryRef = db.collection('clients').doc(clientId).collection('categories').doc();
    batch.set(categoryRef, {
      name: category.name,
      type: category.type,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
}

async function initializeVendors(clientId, vendorTemplates, customizations = {}, batch, db) {
  let vendorsToAdd = [...vendorTemplates];
  
  // Apply customizations
  if (customizations.add) {
    vendorsToAdd.push(...customizations.add);
  }

  vendorsToAdd.forEach(vendor => {
    const vendorRef = db.collection('clients').doc(clientId).collection('vendors').doc();
    batch.set(vendorRef, {
      name: vendor.name,
      category: vendor.category,
      type: vendor.type,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
}

async function initializePaymentMethods(clientId, methodTemplates, customizations = {}, batch, db) {
  const methodsToAdd = [...methodTemplates];
  
  methodsToAdd.forEach(method => {
    const methodRef = db.collection('clients').doc(clientId).collection('paymentMethods').doc();
    batch.set(methodRef, {
      name: method.name,
      type: method.type,
      status: "active",  // Set all payment methods to active by default
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
}

async function initializeConfiguration(clientId, configTemplates, customizations = {}, batch, db) {
  // Set up lists configuration
  const listsRef = db.collection('clients').doc(clientId).collection('config').doc('lists');
  
  // Extract just the lists configuration from the template
  const listsConfig = configTemplates.lists || {
    vendor: true,
    category: true,
    method: true,
    unit: true,
    exchangerates: true
  };
  
  const listsData = {
    ...listsConfig,
    ...(customizations.lists || {}),
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };
  batch.set(listsRef, listsData);
  
  // Set up menu activities configuration
  const activitiesRef = db.collection('clients').doc(clientId).collection('config').doc('activities');
  const defaultMenuItems = [
    { label: "Dashboard", activity: "Dashboard" },
    { label: "Transactions", activity: "Transactions" },
    { label: "HOA Dues", activity: "HOADues" },
    { label: "Projects", activity: "Projects" },
    { label: "Budgets", activity: "Budgets" },
    { label: "List Management", activity: "ListManagement" },
    { label: "Settings", activity: "Settings" }
  ];
  
  const menuData = {
    menu: customizations.menu || defaultMenuItems,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };
  batch.set(activitiesRef, menuData);
}

async function setupInitialUserAccess(clientId, adminUser, initialUsers) {
  // This would integrate with the user management system
  // For now, just log the requirement
  console.log(`📝 TODO: Set up user access for client ${clientId}`);
  console.log(`Admin user: ${adminUser}`);
  console.log(`Initial users: ${initialUsers.length}`);
}

async function cleanupPartialClient(clientId, db) {
  console.log(`🧹 Cleaning up partial client creation: ${clientId}`);
  
  // Delete client document and all subcollections
  const clientRef = db.collection('clients').doc(clientId);
  
  // Delete subcollections
  const subcollections = ['categories', 'vendors', 'paymentMethods', 'config', 'units'];
  
  for (const subcollection of subcollections) {
    const snapshot = await clientRef.collection(subcollection).get();
    const batch = db.batch();
    
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    if (!snapshot.empty) {
      await batch.commit();
    }
  }
  
  // Delete main client document
  await clientRef.delete();
  console.log(`✅ Cleanup completed for ${clientId}`);
}

export {
  extractClientTemplate,
  createClientFromTemplate,
  getClientTemplates
};