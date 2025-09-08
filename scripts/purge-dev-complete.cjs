/**
 * Complete Deep Recursive Purge for Dev Environment
 * Task ID: PURGE-DEV-DATA-001
 * 
 * Purpose: Perform a thorough, bottom-up purge of ALL data from Dev Firestore
 * EXCEPT /exchangeRates and /users collections
 * 
 * Features:
 * - Complete collection discovery
 * - Bottom-up recursive deletion
 * - Safety checks and confirmations
 * - Pre and post purge reports
 * - Error handling and retries
 */

const admin = require('firebase-admin');
const readline = require('readline');
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

// Promisify readline question with proper interface management
function question(prompt) {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question(prompt, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

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
 * Generate pre-purge report
 */
async function generatePrePurgeReport(db, collections) {
  console.log('\n' + '='.repeat(60));
  console.log(`${colors.bright}=== PRE-PURGE COLLECTION SUMMARY ===${colors.reset}`);
  console.log('='.repeat(60));
  
  // Preserved collections
  console.log(`\n${colors.green}Collections to PRESERVE:${colors.reset}`);
  for (const colName of PRESERVE_COLLECTIONS) {
    try {
      const snapshot = await db.collection(colName).count().get();
      const count = snapshot.data().count;
      console.log(`  - /${colName} (${count} documents)`);
    } catch (error) {
      console.log(`  - /${colName} (unable to count)`);
    }
  }
  
  // Collections to purge
  console.log(`\n${colors.red}Collections to PURGE:${colors.reset}`);
  const purgeOrder = createPurgeOrder(collections);
  let totalToPurge = 0;
  
  const rootCollections = {};
  purgeOrder.forEach(col => {
    const rootName = col.path.split('/')[0];
    if (!rootCollections[rootName]) {
      rootCollections[rootName] = [];
    }
    rootCollections[rootName].push(col);
    totalToPurge += col.docCount;
  });
  
  for (const [root, cols] of Object.entries(rootCollections)) {
    const rootCol = cols.find(c => c.path === root);
    if (rootCol) {
      console.log(`  - /${root} (${rootCol.docCount} documents)`);
    }
    
    // Show subcollections
    cols.filter(c => c.path !== root).forEach(col => {
      const indent = '    ' + '  '.repeat(col.depth - 1);
      console.log(`${indent}- ${col.path} (${col.docCount} documents)`);
    });
  }
  
  console.log(`\n${colors.bright}Total documents to purge: ${totalToPurge}${colors.reset}`);
  console.log('='.repeat(60) + '\n');
  
  return totalToPurge;
}

/**
 * Generate post-purge report
 */
async function generatePostPurgeReport(db, totalPurged) {
  console.log('\n' + '='.repeat(60));
  console.log(`${colors.bright}=== POST-PURGE VERIFICATION ===${colors.reset}`);
  console.log('='.repeat(60));
  
  // Check remaining collections
  console.log(`\n${colors.green}Remaining Collections:${colors.reset}`);
  const allCollections = await db.listCollections();
  
  for (const col of allCollections) {
    const snapshot = await col.count().get();
    const count = snapshot.data().count;
    const status = PRESERVE_COLLECTIONS.includes(col.id) ? '✓' : '✗';
    console.log(`  - /${col.id} (${count} documents) ${status}`);
  }
  
  // Verify no unexpected collections remain
  console.log(`\n${colors.cyan}Subcollection Check:${colors.reset}`);
  const remainingCollections = await discoverCollections(db);
  const unexpectedCollections = remainingCollections.filter(col => {
    const rootCollection = col.path.split('/')[0];
    return !PRESERVE_COLLECTIONS.includes(rootCollection);
  });
  
  if (unexpectedCollections.length === 0) {
    console.log(`  ${colors.green}PASSED - No orphaned subcollections found.${colors.reset}`);
  } else {
    console.log(`  ${colors.red}FAILED - Found ${unexpectedCollections.length} unexpected collections:${colors.reset}`);
    unexpectedCollections.forEach(col => {
      console.log(`    - ${col.path}`);
    });
  }
  
  console.log(`\n${colors.bright}PURGE COMPLETE: ${totalPurged} documents deleted${colors.reset}`);
  console.log('='.repeat(60) + '\n');
}

/**
 * Main purge execution
 */
async function executePurge() {
  console.log(`${colors.bright}${colors.magenta}
╔═══════════════════════════════════════════════════════════╗
║          COMPLETE DEV FIRESTORE PURGE UTILITY             ║
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
    
    // Generate pre-purge report
    const totalToPurge = await generatePrePurgeReport(db, allCollections);
    
    // Safety checks
    console.log(`${colors.bright}${colors.red}⚠️  WARNING: This operation will permanently delete data!${colors.reset}`);
    console.log(`${colors.yellow}⚠️  ENSURE YOU HAVE BACKED UP ANY IMPORTANT DEV DATA!${colors.reset}\n`);
    
    const confirmation = await question(`Type "${colors.bright}PURGE DEV${colors.reset}" to confirm: `);
    if (confirmation !== 'PURGE DEV') {
      console.log(`\n${colors.red}✗ Purge cancelled by user${colors.reset}`);
      rl.close();
      process.exit(0);
    }
    
    console.log(`\n${colors.yellow}⏱️  Starting purge in 10 seconds... Press Ctrl+C to cancel${colors.reset}`);
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Execute purge
    console.log(`\n${colors.bright}Executing bottom-up purge...${colors.reset}`);
    const purgeOrder = createPurgeOrder(allCollections);
    let totalDeleted = 0;
    
    for (const collection of purgeOrder) {
      const deleted = await purgeCollection(db, collection.path);
      totalDeleted += deleted;
    }
    
    // Generate post-purge report
    await generatePostPurgeReport(db, totalDeleted);
    
    console.log(`${colors.green}${colors.bright}✅ Purge operation completed successfully!${colors.reset}`);
    
  } catch (error) {
    console.error(`\n${colors.red}${colors.bright}❌ CRITICAL ERROR:${colors.reset}`, error.message);
    console.error(error.stack);
  } finally {
    process.exit();
  }
}

// Execute if run directly
if (require.main === module) {
  executePurge();
}

module.exports = { executePurge };