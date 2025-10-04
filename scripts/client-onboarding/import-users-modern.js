/**
 * Modern Users Import
 * Uses controllers and DateService for all operations
 * Creates Firebase Auth users and Firestore user documents
 * 
 * Phase 2: Import Script Modernization
 * Date: 2025-09-29
 */

import admin from 'firebase-admin';
import { initializeFirebase, getDb } from '../backend/firebase.js';
import { createUser } from '../backend/controllers/userManagementController.js';
import { 
  createMockContext, 
  createDateService,
  ProgressLogger,
  handleControllerResponse,
  validateImportData,
  loadJsonData,
  createImportSummary
} from './utils/import-utils-modern.js';

const CLIENT_ID = 'MTC';

/**
 * Load units mapping for user-unit associations
 */
async function loadUnitsMapping(db) {
  console.log('🔗 Loading units mapping...');
  
  const unitsRef = db.collection('clients').doc(CLIENT_ID).collection('units');
  const unitsSnapshot = await unitsRef.get();
  
  const unitsMap = {};
  unitsSnapshot.forEach(doc => {
    const unit = doc.data();
    unitsMap[unit.unitId] = doc.id;
  });
  
  console.log(`✅ Loaded ${Object.keys(unitsMap).length} unit mappings`);
  return unitsMap;
}

/**
 * Create or get Firebase Auth user
 */
async function createOrGetAuthUser(userData) {
  const { Email: email, LastName: lastName, Password: password } = userData;
  
  try {
    // Try to get existing user
    const existingUser = await admin.auth().getUserByEmail(email);
    return { user: existingUser, isNew: false };
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      // Create new user
      const newUser = await admin.auth().createUser({
        email: email,
        password: password,
        displayName: lastName,
        emailVerified: false
      });
      return { user: newUser, isNew: true };
    } else {
      throw error;
    }
  }
}

/**
 * Import users using modern controller
 */
async function importUsers(usersData, unitsMap, mockContext, dateService) {
  console.log('\n👤 Importing Users...\n');
  
  const logger = new ProgressLogger('Users', usersData.length);
  const db = await getDb();
  const userIds = [];
  let authCreated = 0;
  let authExisting = 0;
  
  for (const userData of usersData) {
    try {
      const email = userData.Email;
      
      // Create or get Firebase Auth user first
      const { user: authUser, isNew } = await createOrGetAuthUser(userData);
      
      if (isNew) {
        authCreated++;
      } else {
        authExisting++;
      }
      
      // Check if Firestore user document already exists
      const userRef = db.collection('users').doc(authUser.uid);
      const userDoc = await userRef.get();
      
      if (userDoc.exists) {
        logger.logItem(`${userData.LastName} (${email})`, 'duplicate');
        continue;
      }
      
      // Prepare user data for controller
      const userPayload = {
        uid: authUser.uid,
        email: email,
        name: userData.LastName || userData.Email,
        phone: userData.Phone || '',
        role: userData.Type === 'Admin' ? 'admin' : 'user',
        permissions: {
          superAdmin: false,
          propertyAdmin: userData.Type === 'Admin' ? [CLIENT_ID] : []
        },
        propertyAccess: [CLIENT_ID],
        units: {},
        status: 'active',
        preferences: {
          timezone: 'America/Cancun',
          locale: 'en-US',
          dateFormat: 'MM/dd/yyyy',
          timeFormat: 'h:mm a'
        }
      };
      
      // Add unit associations if available
      if (userData.UnitIDs && Array.isArray(userData.UnitIDs)) {
        for (const unitId of userData.UnitIDs) {
          if (unitsMap[unitId]) {
            userPayload.units[unitsMap[unitId]] = {
              unitId: unitId,
              role: 'owner',
              primary: true
            };
          }
        }
      }
      
      // Add migration data
      userPayload.migrationData = {
        source: 'MTC_import',
        importDate: new Date().toISOString(),
        originalData: userData
      };
      
      // Call controller through mock context
      mockContext.req.body = userPayload;
      const result = await createUser(mockContext.req, mockContext.res);
      
      const userId = handleControllerResponse(result);
      if (userId) {
        userIds.push(userId);
        logger.logItem(`${userData.LastName} (${email})`, 'success');
      } else {
        logger.logItem(`${userData.LastName} (${email})`, 'error');
      }
      
    } catch (error) {
      logger.logError(`${userData.LastName} (${userData.Email})`, error);
    }
  }
  
  const summary = logger.logSummary();
  summary.userIds = userIds;
  summary.authCreated = authCreated;
  summary.authExisting = authExisting;
  return summary;
}

/**
 * Generate user credentials report
 */
async function generateCredentialsReport(userIds) {
  console.log('\n📄 Generating credentials report...\n');
  
  const credentials = [];
  const db = await getDb();
  
  for (const userId of userIds) {
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      credentials.push({
        name: userData.name,
        email: userData.email,
        temporaryPassword: '*** Must be reset ***',
        role: userData.role,
        units: Object.keys(userData.units || {}).join(', ')
      });
    }
  }
  
  // Save credentials report
  const reportPath = './user-credentials-modern.json';
  await import('fs/promises').then(fs => 
    fs.default.writeFile(reportPath, JSON.stringify(credentials, null, 2))
  );
  
  console.log(`✅ Credentials report saved to ${reportPath}`);
  console.log('⚠️  All users must reset their passwords on first login');
  
  return credentials.length;
}

/**
 * Verify imports
 */
async function verifyImports() {
  console.log('\n🔍 Verifying imports...\n');
  
  const db = await getDb();
  const usersRef = db.collection('users');
  const auditLogsRef = db.collection('auditLogs');
  
  // Count users with this client access
  const usersSnapshot = await usersRef.where('propertyAccess', 'array-contains', CLIENT_ID).get();
  
  console.log(`👤 Users with MTC access: ${usersSnapshot.size}`);
  
  // Check recent audit logs
  const auditSnapshot = await auditLogsRef
    .where('module', '==', 'userManagement')
    .where('action', '==', 'create')
    .orderBy('timestamp', 'desc')
    .limit(10)
    .get();
  
  console.log(`📝 Recent audit logs: ${auditSnapshot.size}`);
  
  return {
    users: usersSnapshot.size,
    auditLogs: auditSnapshot.size
  };
}

/**
 * Main import process
 */
async function main() {
  console.log('🚀 Starting Modern Users Import...\n');
  const startTime = Date.now();
  
  try {
    // Initialize Firebase
    await initializeFirebase();
    const db = await getDb();
    
    // Create mock context for controllers
    const { req, res } = createMockContext(CLIENT_ID);
    const mockContext = { req, res };
    
    // Create DateService
    const dateService = createDateService();
    
    // Load data
    const usersData = await loadJsonData('./MTCdata/Users.json');
    
    // Validate data
    const validation = validateImportData(usersData, ['Email', 'LastName']);
    if (!validation.valid) {
      throw new Error(`Users data validation failed: ${validation.errors.join(', ')}`);
    }
    
    console.log(`✅ Loaded ${usersData.length} users\n`);
    
    // Load units mapping
    const unitsMap = await loadUnitsMapping(db);
    
    // Import users
    const usersResult = await importUsers(usersData, unitsMap, mockContext, dateService);
    
    // Generate credentials report
    const credentialsCount = await generateCredentialsReport(usersResult.userIds);
    
    // Verify imports
    const verification = await verifyImports();
    
    // Create summary
    const summary = createImportSummary('Users Import', {
      total: usersResult.total,
      success: usersResult.success,
      duplicates: usersResult.duplicates,
      errors: usersResult.errors,
      users: usersResult,
      verification: verification
    }, startTime);
    
    // Final report
    console.log('\n' + '='.repeat(70));
    console.log('👤 MODERN USERS IMPORT COMPLETE');
    console.log('='.repeat(70));
    console.log(`🎯 Client: ${CLIENT_ID}`);
    console.log(`⏰ Duration: ${summary.duration}`);
    console.log(`👤 Users: ${usersResult.success}/${usersResult.total} imported`);
    console.log(`🔑 Auth accounts created: ${usersResult.authCreated}`);
    console.log(`ℹ️  Auth accounts existing: ${usersResult.authExisting}`);
    console.log(`📄 Credentials report: ${credentialsCount} users`);
    console.log(`📝 Audit logs created: ${verification.auditLogs}`);
    
    if (summary.success) {
      console.log('\n✅ IMPORT SUCCESSFUL!');
      console.log('⚠️  Remember: All users must reset their passwords on first login');
    } else {
      console.log('\n⚠️ IMPORT COMPLETED WITH ERRORS');
      console.log('Please review the errors above before proceeding.');
    }
    
    console.log('='.repeat(70));
    
    return summary;
    
  } catch (error) {
    console.error('\n💥 Import failed:', error);
    throw error;
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { importUsers, main as performUsersImport };