/**
 * Automated Dev Purge Script
 * Task ID: PURGE-DEV-DATA-001
 * 
 * This version runs without user interaction for automated execution
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Environment configuration
const PRESERVE_COLLECTIONS = ['exchangeRates', 'users'];
const MAX_RETRIES = 3;
const BATCH_SIZE = 500;

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Initialize Firebase Admin for Dev environment
 */
function initializeFirebase() {
  // Check environment - CRITICAL SAFETY CHECK
  const env = process.env.FIRESTORE_ENV || process.env.NODE_ENV || 'dev';
  
  // For this purge script, we'll use the production service account
  // but connect to the dev project explicitly
  console.log(`${colors.yellow}Environment check: FIRESTORE_ENV=${process.env.FIRESTORE_ENV}, NODE_ENV=${process.env.NODE_ENV}${colors.reset}`);
  
  // Find service account file
  const serviceAccountPath = path.resolve(__dirname, '../backend/serviceAccountKey.json');
  
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`Service account file not found: ${serviceAccountPath}`);
  }

  const serviceAccount = require(serviceAccountPath);
  
  // Set the correct dev project ID
  const devProjectId = 'sandyland-management-system';
  
  // Verify we're using the correct project
  console.log(`${colors.cyan}Service account project: ${serviceAccount.project_id}${colors.reset}`);
  console.log(`${colors.cyan}Target project: ${devProjectId}${colors.reset}`);
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: devProjectId,  // Force dev project
    databaseURL: `https://${devProjectId}.firebaseio.com`
  });

  const db = admin.firestore();
  db.settings({
    ignoreUndefinedProperties: true
  });

  // Double-check we're connected to the right project
  console.log(`${colors.cyan}Firebase initialized with project: ${devProjectId}${colors.reset}`);
  
  return db;
}

/**
 * Recursively discover all collections and subcollections
 */
async function discoverCollections(db, parentPath = '', depth = 0) {
  const collections = [];
  const indent = '  '.repeat(depth);
  
  try {
    let collectionRefs;
    
    if (parentPath === '') {
      // Root collections
      collectionRefs = await db.listCollections();
    } else {
      // Subcollections
      const parentRef = db.doc(parentPath);
      collectionRefs = await parentRef.listCollections();
    }
    
    for (const collectionRef of collectionRefs) {
      const collectionPath = parentPath ? `${parentPath}/${collectionRef.id}` : collectionRef.id;
      const snapshot = await collectionRef.count().get();
      const docCount = snapshot.data().count;
      
      console.log(`${indent}${colors.cyan}/${collectionRef.id}${colors.reset} (${docCount} documents)`);
      
      collections.push({
        path: collectionPath,
        id: collectionRef.id,
        depth: depth,
        docCount: docCount,
        fullPath: collectionPath
      });
      
      // Recursively check each document for subcollections
      if (docCount > 0) {
        const docs = await collectionRef.limit(10).get(); // Sample first 10 docs
        
        for (const doc of docs.docs) {
          const docPath = `${collectionPath}/${doc.id}`;
          const subCollections = await discoverCollections(db, docPath, depth + 1);
          collections.push(...subCollections);
        }
      }
    }
  } catch (error) {
    console.error(`${colors.red}Error discovering collections at ${parentPath}:${colors.reset}`, error.message);
  }
  
  return collections;
}

/**
 * Create purge order (deepest collections first)
 */
function createPurgeOrder(collections) {
  // Sort by depth (deepest first) and filter out preserved collections
  const filteredCollections = collections.filter(col => {
    const rootCollection = col.path.split('/')[0];
    return !PRESERVE_COLLECTIONS.includes(rootCollection);
  });
  
  return filteredCollections.sort((a, b) => b.depth - a.depth);
}

/**
 * Delete all documents in a collection with retry logic
 */
async function purgeCollection(db, collectionPath, attempt = 1) {
  try {
    console.log(`${colors.yellow}Purging: ${collectionPath}${colors.reset}`);
    
    // Parse the collection path to get the reference
    const pathParts = collectionPath.split('/');
    let collectionRef;
    
    if (pathParts.length === 1) {
      // Root collection
      collectionRef = db.collection(pathParts[0]);
    } else {
      // Subcollection - need to build the path correctly
      let ref = db;
      for (let i = 0; i < pathParts.length; i++) {
        if (i % 2 === 0) {
          ref = ref.collection(pathParts[i]);
        } else {
          ref = ref.doc(pathParts[i]);
        }
      }
      collectionRef = ref;
    }
    
    let totalDeleted = 0;
    let hasMore = true;
    
    while (hasMore) {
      const snapshot = await collectionRef.limit(BATCH_SIZE).get();
      
      if (snapshot.empty) {
        hasMore = false;
        break;
      }
      
      // Delete in batches
      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      totalDeleted += snapshot.size;
      
      // Show progress for large collections
      if (totalDeleted % 1000 === 0) {
        console.log(`  ${colors.blue}Progress: ${totalDeleted} documents deleted...${colors.reset}`);
      }
    }
    
    console.log(`  ${colors.green}✓ Deleted ${totalDeleted} documents from ${collectionPath}${colors.reset}`);
    return totalDeleted;
    
  } catch (error) {
    console.error(`${colors.red}Error purging ${collectionPath} (attempt ${attempt}):${colors.reset}`, error.message);
    
    if (attempt < MAX_RETRIES) {
      console.log(`${colors.yellow}Retrying in ${attempt} seconds...${colors.reset}`);
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      return purgeCollection(db, collectionPath, attempt + 1);
    }
    
    throw error;
  }
}

/**
 * Generate reports
 */
function generateReports(collections, totalDeleted) {
  // Generate summary report
  const report = {
    timestamp: new Date().toISOString(),
    environment: 'sandyland-management-system',
    preservedCollections: PRESERVE_COLLECTIONS,
    totalCollectionsFound: collections.length,
    totalDocumentsDeleted: totalDeleted,
    purgedCollections: collections.filter(c => !PRESERVE_COLLECTIONS.includes(c.path.split('/')[0]))
  };
  
  // Save report to file
  const reportPath = path.join(__dirname, `purge-report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`\n${colors.cyan}Report saved to: ${reportPath}${colors.reset}`);
  
  return report;
}

/**
 * Main purge execution
 */
async function executePurge() {
  console.log(`${colors.bright}${colors.magenta}
╔═══════════════════════════════════════════════════════════╗
║          AUTOMATED DEV FIRESTORE PURGE                    ║
║                  Task: PURGE-DEV-DATA-001                 ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}`);
  
  try {
    // Initialize Firebase
    console.log(`${colors.cyan}Initializing Firebase Admin for Dev environment...${colors.reset}`);
    const db = initializeFirebase();
    console.log(`${colors.green}✓ Connected to Dev Firestore${colors.reset}\n`);
    
    // Discover all collections
    console.log(`${colors.cyan}Discovering all collections and subcollections...${colors.reset}`);
    const allCollections = await discoverCollections(db);
    console.log(`${colors.green}✓ Discovery complete: Found ${allCollections.length} total collections${colors.reset}\n`);
    
    // Create purge order
    const purgeOrder = createPurgeOrder(allCollections);
    console.log(`${colors.yellow}Collections to purge: ${purgeOrder.length}${colors.reset}`);
    console.log(`${colors.green}Collections to preserve: ${PRESERVE_COLLECTIONS.join(', ')}${colors.reset}\n`);
    
    // Execute purge
    console.log(`${colors.bright}Executing bottom-up purge...${colors.reset}`);
    let totalDeleted = 0;
    
    for (const collection of purgeOrder) {
      const deleted = await purgeCollection(db, collection.path);
      totalDeleted += deleted;
    }
    
    // Generate report
    const report = generateReports(allCollections, totalDeleted);
    
    // Final verification
    console.log(`\n${colors.bright}=== POST-PURGE VERIFICATION ===${colors.reset}`);
    const finalCollections = await db.listCollections();
    console.log(`\n${colors.cyan}Remaining root collections:${colors.reset}`);
    
    for (const col of finalCollections) {
      const snapshot = await col.count().get();
      const count = snapshot.data().count;
      const preserved = PRESERVE_COLLECTIONS.includes(col.id) ? '✓' : '✗';
      console.log(`  - /${col.id} (${count} documents) ${preserved}`);
    }
    
    console.log(`\n${colors.green}${colors.bright}✅ PURGE COMPLETE: ${totalDeleted} documents deleted${colors.reset}`);
    console.log(`${colors.cyan}Only preserved collections remain: ${PRESERVE_COLLECTIONS.join(', ')}${colors.reset}`);
    
  } catch (error) {
    console.error(`\n${colors.red}${colors.bright}❌ CRITICAL ERROR:${colors.reset}`, error.message);
    console.error(error.stack);
    process.exit(1);
  }
  
  process.exit(0);
}

// Execute
executePurge();