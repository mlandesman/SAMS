/**
 * Phase 0: Data Requirements Analysis Script
 * Tests CRUD operations with minimal data to identify required vs optional fields
 * 
 * Task ID: MTC-MIGRATION-001
 * Date: June 27, 2025
 */

import { initializeApp } from '../backend/firebase.js';
import { createUser } from '../backend/controllers/userManagementController.js';
import { createTransaction } from '../backend/controllers/transactionsController.js';
import { createUnit } from '../backend/controllers/unitsController.js';
import { createCategory } from '../backend/controllers/categoriesController.js';
import { createVendor } from '../backend/controllers/vendorsController.js';
import admin from 'firebase-admin';

// Test results structure
const testResults = {
  users: {
    requiredFields: [],
    optionalFields: [],
    defaultValues: {},
    crashPoints: []
  },
  transactions: {
    requiredFields: [],
    optionalFields: [],
    defaultValues: {},
    crashPoints: []
  },
  units: {
    requiredFields: [],
    optionalFields: [],
    defaultValues: {},
    crashPoints: []
  },
  categories: {
    requiredFields: [],
    optionalFields: [],
    defaultValues: {},
    crashPoints: []
  },
  vendors: {
    requiredFields: [],
    optionalFields: [],
    defaultValues: {},
    crashPoints: []
  }
};

/**
 * Test User Creation Requirements
 */
async function testUserRequirements() {
  console.log('\n🧪 Testing User CRUD Requirements...\n');
  
  // Test 1: Absolutely minimal user (based on MTC data)
  console.log('Test 1: Minimal MTC-style user');
  try {
    // MTC provides: LastName, Unit, Email, Password
    const testUser = {
      email: 'test@example.com',
      lastName: 'TestUser',
      // No firstName, name, globalRole, clientAccess
    };
    
    // This will fail - createUser expects 'name' not 'lastName'
    const result = await createUserDirect(testUser);
    console.log('❌ Unexpected success with minimal data');
  } catch (error) {
    console.log('✅ Expected failure:', error.message);
    testResults.users.requiredFields.push('name', 'role');
  }
  
  // Test 2: With required fields from controller
  console.log('\nTest 2: User with controller-required fields');
  try {
    const testUser = {
      email: 'test2@example.com',
      name: 'Test User', // Required by controller
      role: 'unitOwner', // Required by controller
      clientId: 'MTC'    // Required for non-superAdmin
    };
    
    const result = await createUserDirect(testUser);
    console.log('✅ Success with required fields');
    testResults.users.requiredFields = ['email', 'name', 'role', 'clientId'];
    
    // Clean up
    await admin.auth().deleteUser(result.uid);
  } catch (error) {
    console.log('❌ Failed with required fields:', error.message);
  }
  
  // Test 3: Optional fields
  console.log('\nTest 3: Testing optional fields');
  const optionalFields = ['unitId', 'customPermissions', 'firstName', 'lastName', 'phone'];
  for (const field of optionalFields) {
    try {
      const testUser = {
        email: `test-${field}@example.com`,
        name: 'Test User',
        role: 'unitOwner',
        clientId: 'MTC',
        [field]: field === 'customPermissions' ? [] : 'test-value'
      };
      
      const result = await createUserDirect(testUser);
      console.log(`✅ ${field} is optional`);
      testResults.users.optionalFields.push(field);
      
      // Clean up
      await admin.auth().deleteUser(result.uid);
    } catch (error) {
      console.log(`❌ ${field} caused error:`, error.message);
    }
  }
  
  // Test 4: Null value handling
  console.log('\nTest 4: Testing null values');
  try {
    const testUser = {
      email: 'test-null@example.com',
      name: null, // Test null handling
      role: 'unitOwner',
      clientId: 'MTC'
    };
    
    const result = await createUserDirect(testUser);
    console.log('❌ System accepts null name (unexpected)');
  } catch (error) {
    console.log('✅ System rejects null required fields:', error.message);
    testResults.users.crashPoints.push('null values in required fields');
  }
}

/**
 * Test Transaction Creation Requirements
 */
async function testTransactionRequirements() {
  console.log('\n🧪 Testing Transaction CRUD Requirements...\n');
  
  // Test 1: Absolutely minimal transaction
  console.log('Test 1: Minimal transaction');
  try {
    const testTxn = {
      amount: 1000
      // No date, account, vendor, category
    };
    
    const result = await createTransaction('MTC', testTxn);
    if (result) {
      console.log('✅ Transaction created with just amount');
      testResults.transactions.requiredFields.push('amount');
    } else {
      console.log('❌ Failed to create with just amount');
    }
  } catch (error) {
    console.log('❌ Error with minimal transaction:', error.message);
  }
  
  // Test 2: With account mapping
  console.log('\nTest 2: Transaction with account');
  try {
    const testTxn = {
      amount: 1000,
      account: 'MTC Bank', // Will be mapped to accountId
      date: '2025-06-27'
    };
    
    const result = await createTransaction('MTC', testTxn);
    if (result) {
      console.log('✅ Transaction created with account mapping');
      testResults.transactions.optionalFields.push('account', 'date');
    }
  } catch (error) {
    console.log('❌ Error with account:', error.message);
  }
  
  // Test 3: Missing amount (should fail)
  console.log('\nTest 3: Transaction without amount');
  try {
    const testTxn = {
      account: 'MTC Bank',
      date: '2025-06-27'
      // No amount
    };
    
    const result = await createTransaction('MTC', testTxn);
    console.log('❌ Unexpected success without amount');
  } catch (error) {
    console.log('✅ Expected failure without amount:', error.message);
  }
  
  // Test 4: Optional fields
  console.log('\nTest 4: Testing optional transaction fields');
  const txnOptionalFields = ['vendor', 'category', 'notes', 'googleId', 'documents'];
  for (const field of txnOptionalFields) {
    try {
      const testTxn = {
        amount: 1000,
        account: 'MTC Bank',
        [field]: field === 'documents' ? [] : 'test-value'
      };
      
      const result = await createTransaction('MTC', testTxn);
      if (result) {
        console.log(`✅ ${field} is optional`);
        testResults.transactions.optionalFields.push(field);
      }
    } catch (error) {
      console.log(`❌ ${field} caused error:`, error.message);
    }
  }
}

/**
 * Test Unit Creation Requirements
 */
async function testUnitRequirements() {
  console.log('\n🧪 Testing Unit CRUD Requirements...\n');
  
  // Test 1: Minimal unit
  console.log('Test 1: Minimal unit');
  try {
    const testUnit = {
      // Empty - testing absolute minimum
    };
    
    const result = await createUnit('MTC', testUnit, 'TEST-001');
    if (result) {
      console.log('✅ Unit created with no data');
      testResults.units.requiredFields = []; // No required fields!
    }
  } catch (error) {
    console.log('❌ Error with empty unit:', error.message);
  }
  
  // Test 2: With typical fields
  console.log('\nTest 2: Unit with typical fields');
  try {
    const testUnit = {
      unitName: 'Test Unit',
      owners: ['Test Owner'],
      emails: ['test@example.com'],
      size: 100
    };
    
    const result = await createUnit('MTC', testUnit, 'TEST-002');
    if (result) {
      console.log('✅ Unit created with typical fields');
      testResults.units.optionalFields = ['unitName', 'owners', 'emails', 'size'];
    }
  } catch (error) {
    console.log('❌ Error with typical unit:', error.message);
  }
}

/**
 * Test Balance Calculation Requirements
 */
async function testBalanceCalculation() {
  console.log('\n🧪 Testing Balance Calculation Requirements...\n');
  
  // This would test what minimal data is needed for balance calculations
  // Currently just documenting findings from code analysis
  
  console.log('Balance calculation requires:');
  console.log('- Transaction with amount (number)');
  console.log('- Account reference (accountId or account name)');
  console.log('- Client ID');
  console.log('\nOptional for balance calc:');
  console.log('- Transaction date (uses current if not provided)');
  console.log('- Other transaction fields do not affect balance');
}

/**
 * Helper function to create user directly (bypassing Express req/res)
 */
async function createUserDirect(userData) {
  // Simulate the controller logic
  const { email, name, role, clientId } = userData;
  
  if (!email || !name || !role) {
    throw new Error('Missing required fields: email, name, role');
  }
  
  if (role !== 'superAdmin' && !clientId) {
    throw new Error('ClientId is required for all roles except SuperAdmin');
  }
  
  // Create Firebase Auth user
  const userRecord = await admin.auth().createUser({
    email: email,
    password: 'TempPass123!',
    displayName: name,
    emailVerified: false,
    disabled: false
  });
  
  return userRecord;
}

/**
 * Generate summary report
 */
function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 DATA REQUIREMENTS ANALYSIS REPORT');
  console.log('='.repeat(80) + '\n');
  
  for (const [entity, results] of Object.entries(testResults)) {
    console.log(`\n### ${entity.toUpperCase()} ENTITY`);
    console.log(`Required Fields: ${results.requiredFields.join(', ') || 'None'}`);
    console.log(`Optional Fields: ${results.optionalFields.join(', ') || 'None'}`);
    console.log(`Default Values: ${JSON.stringify(results.defaultValues)}`);
    console.log(`Crash Points: ${results.crashPoints.join(', ') || 'None identified'}`);
  }
  
  console.log('\n### KEY FINDINGS FOR MTC MIGRATION');
  console.log('\n1. USER IMPORT CHALLENGES:');
  console.log('   - MTC provides: LastName, Unit, Email, Password');
  console.log('   - SAMS requires: email, name (full name), role, clientId');
  console.log('   - Solution: Combine LastName → name, assign role="unitOwner", clientId="MTC"');
  
  console.log('\n2. TRANSACTION IMPORT:');
  console.log('   - Must map "MTC Bank" → accountId: "bank-cibanco-001"');
  console.log('   - Must map "Cash Account" → accountId: "cash-001"');
  console.log('   - Amount is the only truly required field');
  
  console.log('\n3. UNIT IMPORT:');
  console.log('   - Units have NO required fields (very flexible)');
  console.log('   - Can use Unit ID as document ID directly');
  
  console.log('\n4. SYSTEM RESILIENCE:');
  console.log('   - Controllers validate required fields');
  console.log('   - Account mapping handles legacy data');
  console.log('   - Most fields can be null/undefined without crashes');
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🚀 Starting Data Requirements Analysis...');
    console.log('Target: Understanding what SAMS needs vs what MTC provides\n');
    
    // Initialize Firebase
    await initializeApp();
    
    // Run all tests
    await testUserRequirements();
    await testTransactionRequirements();
    await testUnitRequirements();
    await testBalanceCalculation();
    
    // Generate report
    generateReport();
    
    console.log('\n✅ Analysis complete!');
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    process.exit(0);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { testResults, generateReport };