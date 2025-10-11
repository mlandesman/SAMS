// Setup Water Meter collections and test data for AVII units
import admin from 'firebase-admin';
import { getDb } from '../firebase.js';
import { randomUUID } from 'crypto';

/**
 * Setup script to create waterMeter collections and test data for all 10 AVII units
 * Creates the unit-centric data structure for automatic security inheritance:
 * - /clients/AVII/units/{unitId}/waterMeter/config
 * - /clients/AVII/units/{unitId}/waterMeter/2025/readings/{readingId}
 * - /clients/AVII/units/{unitId}/waterMeter/2025/bills/{billId}
 * - /clients/AVII/units/{unitId}/waterMeter/2025/balance
 */

const AVII_UNITS = ['101', '102', '103', '104', '105', '106', '201', '202', '203', '204'];
const CLIENT_ID = 'AVII';
const YEAR = 2025;

// Water meter billing configuration for AVII (no IVA)
const BILLING_CONFIG = {
  currency: 'MXN',
  ratePerCubicMeter: 5000, // 50.00 MXN per m³, stored as cents
  minimumCharge: 5000,     // 50.00 MXN minimum, stored as cents  
  includeIVA: false,       // AVII doesn't apply IVA per requirements
  billingPeriod: 'monthly'
};

const setupWaterMeters = async () => {
  console.log('💧 Setting up Water Meter collections for AVII units...');
  console.log(`📍 Units: ${AVII_UNITS.join(', ')}`);
  console.log(`📅 Year: ${YEAR}`);
  console.log('');

  try {
    const db = await getDb();
    
    // Process units in batches to avoid overwhelming Firestore
    const batchSize = 5;
    
    for (let i = 0; i < AVII_UNITS.length; i += batchSize) {
      const unitBatch = AVII_UNITS.slice(i, i + batchSize);
      
      console.log(`🔄 Processing batch: ${unitBatch.join(', ')}`);
      
      // Process batch in parallel
      await Promise.all(
        unitBatch.map(unitId => setupUnitWaterMeter(db, unitId))
      );
      
      console.log(`✅ Completed batch: ${unitBatch.join(', ')}\n`);
    }

    console.log('🎯 Water Meter Setup Complete!');
    console.log('📋 Created structure:');
    console.log('   - Meter configurations for all units');
    console.log('   - Complete test data for units 101 and 201');
    console.log('   - Basic structure for remaining units');
    console.log('');
    console.log('🧪 Test units (101, 201) include:');
    console.log('   - Meter configuration with serial number');
    console.log('   - August 2025 reading');
    console.log('   - Generated bill based on consumption');
    console.log('   - Current balance summary');

  } catch (error) {
    console.error('❌ Error setting up water meters:', error);
    process.exit(1);
  }
};

/**
 * Setup water meter structure for a single unit
 * @param {FirebaseFirestore.Firestore} db - Firestore database instance
 * @param {string} unitId - Unit identifier (e.g., '101', '201')
 */
const setupUnitWaterMeter = async (db, unitId) => {
  const basePath = `clients/${CLIENT_ID}/units/${unitId}/waterMeter`;
  
  try {
    // Create batch for atomic operations
    const batch = db.batch();
    
    // 1. Setup meter configuration
    await setupMeterConfig(db, batch, basePath, unitId);
    
    // 2. Setup test data for units 101 and 201
    if (unitId === '101' || unitId === '201') {
      await setupTestData(db, batch, basePath, unitId);
    }
    
    // Commit all changes atomically
    await batch.commit();
    
    console.log(`   ✅ Unit ${unitId}: Water meter setup complete`);
    
  } catch (error) {
    console.error(`   ❌ Unit ${unitId}: Error setting up water meter:`, error);
    throw error;
  }
};

/**
 * Setup meter configuration document
 * @param {FirebaseFirestore.Firestore} db - Firestore database instance  
 * @param {FirebaseFirestore.WriteBatch} batch - Firestore batch
 * @param {string} basePath - Base path for unit water meter
 * @param {string} unitId - Unit identifier
 */
const setupMeterConfig = async (db, batch, basePath, unitId) => {
  const configRef = db.doc(`${basePath}/config`);
  
  // Check if config already exists
  const existingConfig = await configRef.get();
  if (existingConfig.exists) {
    console.log(`   ℹ️  Unit ${unitId}: Config already exists, skipping`);
    return;
  }
  
  const configData = {
    unitId,
    clientId: CLIENT_ID,
    meterType: 'waterMeter',
    serialNumber: `WM-AVII-${unitId}`,
    installDate: admin.firestore.Timestamp.fromDate(new Date('2024-01-01')),
    status: 'active',
    location: `Unit ${unitId} - Water Meter`,
    
    // Billing configuration
    billingConfig: BILLING_CONFIG,
    
    // Metadata
    created: admin.firestore.Timestamp.now(),
    updated: admin.firestore.Timestamp.now()
  };
  
  batch.set(configRef, configData);
  console.log(`   📋 Unit ${unitId}: Added meter configuration`);
};

/**
 * Setup test data for specific test units (101, 201)
 * @param {FirebaseFirestore.Firestore} db - Firestore database instance
 * @param {FirebaseFirestore.WriteBatch} batch - Firestore batch  
 * @param {string} basePath - Base path for unit water meter
 * @param {string} unitId - Unit identifier
 */
const setupTestData = async (db, batch, basePath, unitId) => {
  // Generate test reading data
  const unitNumber = parseInt(unitId);
  const previousReading = 1000 + (unitNumber * 10); // e.g., 1010 for unit 101
  const currentReading = previousReading + 15.5; // Typical monthly consumption
  const consumption = currentReading - previousReading;
  
  // Test dates for August 2025
  const readingDate = admin.firestore.Timestamp.fromDate(new Date('2025-08-15'));
  const billingDate = admin.firestore.Timestamp.fromDate(new Date('2025-08-15')); 
  const dueDate = admin.firestore.Timestamp.fromDate(new Date('2025-09-15'));
  
  // 1. Create meter reading
  const readingId = `reading-${Date.now()}-${randomUUID().substring(0, 8)}`;
  const readingRef = db.doc(`${basePath}/${YEAR}/readings/${readingId}`);
  
  const readingData = {
    unitId,
    meterType: 'waterMeter',
    reading: currentReading,
    date: readingDate,
    notes: `Test reading for unit ${unitId}`,
    readBy: 'System Setup',
    created: admin.firestore.Timestamp.now(),
    updated: admin.firestore.Timestamp.now()
  };
  
  batch.set(readingRef, readingData);
  console.log(`   📊 Unit ${unitId}: Added August 2025 reading (${currentReading} m³)`);
  
  // 2. Create water bill based on consumption
  const billId = `bill-${YEAR}-august-${randomUUID().substring(0, 8)}`;
  const billRef = db.doc(`${basePath}/${YEAR}/bills/${billId}`);
  
  // Calculate charges (amounts stored as integers in cents)
  const consumptionCharge = Math.round(consumption * BILLING_CONFIG.ratePerCubicMeter);
  const baseAmount = Math.max(consumptionCharge, BILLING_CONFIG.minimumCharge);
  const ivaAmount = 0; // AVII doesn't apply IVA
  const totalAmount = baseAmount + ivaAmount;
  
  const billData = {
    unitId,
    clientId: CLIENT_ID,
    year: YEAR,
    meterType: 'waterMeter',
    
    // Billing period and dates
    billingDate,
    dueDate,
    billingPeriod: BILLING_CONFIG.billingPeriod,
    
    // Consumption data
    consumption,
    currentReadingData: {
      readingId,
      reading: currentReading,
      date: readingDate
    },
    previousReadingData: {
      reading: previousReading,
      date: admin.firestore.Timestamp.fromDate(new Date('2025-07-15'))
    },
    
    // Billing amounts (stored as integers in cents)
    consumptionCharge,
    baseAmount,
    ivaRate: 0,
    ivaAmount,
    totalAmount,
    currency: BILLING_CONFIG.currency,
    
    // Rate information
    ratePerCubicMeter: BILLING_CONFIG.ratePerCubicMeter,
    minimumCharge: BILLING_CONFIG.minimumCharge,
    
    // Payment tracking
    paid: false,
    paidAmount: 0,
    paidDate: null,
    paymentReference: null,
    
    // Status and notes
    notes: `Generated bill for ${consumption} m³ consumption`,
    status: 'pending',
    
    // Metadata
    created: admin.firestore.Timestamp.now(),
    updated: admin.firestore.Timestamp.now()
  };
  
  batch.set(billRef, billData);
  console.log(`   💰 Unit ${unitId}: Added August 2025 bill ($${(totalAmount / 100).toFixed(2)} MXN)`);
  
  // 3. Create balance summary
  const balanceRef = db.doc(`${basePath}/${YEAR}/balance`);
  
  const balanceData = {
    unitId,
    clientId: CLIENT_ID,
    year: YEAR,
    meterType: 'waterMeter',
    
    // Current balance summary
    currentBalance: totalAmount, // Outstanding balance in cents
    totalBilled: totalAmount,
    totalPaid: 0,
    
    // Payment status
    overdue: false,
    daysPastDue: 0,
    
    // Latest activity
    latestBillId: billId,
    latestBillDate: billingDate,
    latestBillAmount: totalAmount,
    latestReadingId: readingId,
    latestReadingDate: readingDate,
    latestReading: currentReading,
    
    // Summary counters
    totalBills: 1,
    paidBills: 0,
    pendingBills: 1,
    
    // Metadata
    lastUpdated: admin.firestore.Timestamp.now(),
    created: admin.firestore.Timestamp.now()
  };
  
  batch.set(balanceRef, balanceData);
  console.log(`   📈 Unit ${unitId}: Added balance summary (Balance: $${(totalAmount / 100).toFixed(2)} MXN)`);
};

// Check if this script is run directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  setupWaterMeters()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { setupWaterMeters };