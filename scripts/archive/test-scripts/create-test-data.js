// Test Data Creation Script for Field Standardization Testing
// Run this AFTER code updates and database purge
// This creates minimal test data using the app's CRUD functions

const admin = require('firebase-admin');

// Initialize Firebase Admin (adjust path as needed)
const serviceAccount = require('../backend/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Test data definitions
const TEST_CATEGORIES = [
  { name: 'HOA Dues', type: 'income', sortOrder: 1 },
  { name: 'Maintenance', type: 'expense', sortOrder: 2 },
  { name: 'Utilities', type: 'expense', sortOrder: 3 },
  { name: 'Insurance', type: 'expense', sortOrder: 4 },
  { name: 'Bank Interest', type: 'income', sortOrder: 5 },
  { name: 'Legal Fees', type: 'expense', sortOrder: 6 }
];

const TEST_VENDORS = [
  { name: 'ABC Plumbing', category: 'Maintenance', email: 'contact@abcplumbing.mx' },
  { name: 'City Electric', category: 'Utilities', email: 'billing@cityelectric.mx' },
  { name: 'Property Insurance Co', category: 'Insurance', email: 'info@propinsurance.mx' },
  { name: 'Martinez Law Firm', category: 'Legal Fees', email: 'contact@martinezlaw.mx' },
  { name: 'Quick Fix Maintenance', category: 'Maintenance', phone: '+521234567890' }
];

const TEST_UNITS = [
  { 
    unitNumber: '1A', 
    monthlyDues: 50000, // 500.00 pesos
    owner: { firstName: 'Juan', lastName: 'García', email: 'juan.garcia@test.com' }
  },
  { 
    unitNumber: '2B', 
    monthlyDues: 60000, // 600.00 pesos
    owner: { firstName: 'Maria', lastName: 'Rodriguez', email: 'maria.rodriguez@test.com' }
  },
  { 
    unitNumber: '3C', 
    monthlyDues: 55000, // 550.00 pesos
    owner: { firstName: 'Carlos', lastName: 'Mendez', email: 'carlos.mendez@test.com' }
  }
];

// Helper functions (matching the new standards)
function generateId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function getCurrentTimestamp() {
  return new Date().toISOString().replace('Z', '-05:00'); // America/Cancun
}

async function createTestData() {
  const clientId = 'MTC';
  const userId = 'import_script';
  const timestamp = getCurrentTimestamp();
  
  console.log('Creating test data for field standardization testing...\n');
  
  try {
    // 1. Create Categories
    console.log('Creating categories...');
    const categoryMap = {};
    
    for (const cat of TEST_CATEGORIES) {
      const categoryId = generateId(cat.name);
      const categoryData = {
        name: cat.name,
        type: cat.type,
        sortOrder: cat.sortOrder,
        isActive: true,
        createdAt: timestamp,
        createdBy: userId,
        updatedAt: timestamp,
        updatedBy: userId
      };
      
      await db.collection('clients').doc(clientId)
        .collection('categories').doc(categoryId).set(categoryData);
      
      categoryMap[cat.name] = categoryId;
      console.log(`  ✓ Created category: ${cat.name} (${categoryId})`);
    }
    
    // 2. Create Vendors
    console.log('\nCreating vendors...');
    const vendorMap = {};
    
    for (const vendor of TEST_VENDORS) {
      const vendorId = generateId(vendor.name);
      const vendorData = {
        name: vendor.name,
        category: vendor.category,
        email: vendor.email || null,
        phone: vendor.phone || null,
        isActive: true,
        createdAt: timestamp,
        createdBy: userId,
        updatedAt: timestamp,
        updatedBy: userId
      };
      
      await db.collection('clients').doc(clientId)
        .collection('vendors').doc(vendorId).set(vendorData);
      
      vendorMap[vendor.name] = vendorId;
      console.log(`  ✓ Created vendor: ${vendor.name} (${vendorId})`);
    }
    
    // 3. Create Units
    console.log('\nCreating units...');
    
    for (const unit of TEST_UNITS) {
      const unitData = {
        unitNumber: unit.unitNumber,
        monthlyDues: unit.monthlyDues,
        owner: unit.owner,
        isActive: true,
        isRented: false,
        createdAt: timestamp,
        createdBy: userId,
        updatedAt: timestamp,
        updatedBy: userId
      };
      
      await db.collection('clients').doc(clientId)
        .collection('units').doc(unit.unitNumber).set(unitData);
      
      console.log(`  ✓ Created unit: ${unit.unitNumber}`);
    }
    
    // 4. Create Test Transactions
    console.log('\nCreating test transactions...');
    
    const testTransactions = [
      // HOA Payments
      {
        unitId: '1A',
        type: 'income',
        categoryId: categoryMap['HOA Dues'],
        categoryName: 'HOA Dues',
        amount: 50000,
        description: 'January 2025 HOA payment',
        date: '2025-01-01'
      },
      {
        unitId: '2B',
        type: 'income',
        categoryId: categoryMap['HOA Dues'],
        categoryName: 'HOA Dues',
        amount: 60000,
        description: 'January 2025 HOA payment',
        date: '2025-01-02'
      },
      // Expenses
      {
        type: 'expense',
        vendorId: vendorMap['ABC Plumbing'],
        vendorName: 'ABC Plumbing',
        categoryId: categoryMap['Maintenance'],
        categoryName: 'Maintenance',
        amount: 150000,
        description: 'Fixed main water line leak',
        date: '2025-01-03'
      },
      {
        type: 'expense',
        vendorId: vendorMap['City Electric'],
        vendorName: 'City Electric',
        categoryId: categoryMap['Utilities'],
        categoryName: 'Utilities',
        amount: 85000,
        description: 'Monthly electricity bill',
        date: '2025-01-05'
      },
      // More transactions for testing filters
      {
        unitId: '3C',
        type: 'income',
        categoryId: categoryMap['HOA Dues'],
        categoryName: 'HOA Dues',
        amount: 55000,
        description: 'January 2025 HOA payment',
        date: '2025-01-05'
      },
      {
        type: 'income',
        categoryId: categoryMap['Bank Interest'],
        categoryName: 'Bank Interest',
        amount: 2500,
        description: 'Monthly interest earned',
        date: '2025-01-31'
      }
    ];
    
    let transCount = 1;
    for (const trans of testTransactions) {
      const transId = `2025_test_${String(transCount).padStart(3, '0')}`;
      const transData = {
        ...trans,
        clientId: clientId,
        date: trans.date + 'T00:00:00.000-05:00',
        createdAt: timestamp,
        createdBy: userId,
        updatedAt: timestamp,
        updatedBy: userId
      };
      
      // Remove null/undefined fields
      Object.keys(transData).forEach(key => {
        if (transData[key] === null || transData[key] === undefined) {
          delete transData[key];
        }
      });
      
      await db.collection('clients').doc(clientId)
        .collection('transactions').doc(transId).set(transData);
      
      console.log(`  ✓ Created transaction: ${transId} - ${trans.description}`);
      transCount++;
    }
    
    console.log('\n✅ Test data creation complete!');
    console.log('\nSummary:');
    console.log(`- Categories: ${TEST_CATEGORIES.length}`);
    console.log(`- Vendors: ${TEST_VENDORS.length}`);
    console.log(`- Units: ${TEST_UNITS.length}`);
    console.log(`- Transactions: ${testTransactions.length}`);
    console.log('\nYou can now test all CRUD operations and features.');
    
  } catch (error) {
    console.error('❌ Error creating test data:', error);
  } finally {
    process.exit();
  }
}

// Run the script
createTestData();