/**
 * Selective Purge Script for Dev Environment
 * 
 * Purpose: Selectively purge specific collections from Dev Firestore
 * Supports fine-grained control over what gets purged
 * 
 * Usage:
 *   node purge-selective.cjs                           # Interactive mode
 *   node purge-selective.cjs --only transactions,hoadues    # Only purge specific collections
 *   node purge-selective.cjs --skip users,clients          # Purge all except specified
 *   node purge-selective.cjs --list                       # List all collections without purging
 */

const admin = require('firebase-admin');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

// Available collections that can be purged
const PURGEABLE_COLLECTIONS = {
  // Static data (rarely needs purging)
  clients: { description: 'Client configuration and settings', category: 'static' },
  users: { description: 'User accounts', category: 'static' },
  
  // Variable data (frequently purged/reimported)
  units: { description: 'Unit records', category: 'variable' },
  transactions: { description: 'Financial transactions', category: 'variable', dependencies: ['categories', 'vendors', 'accounts'] },
  hoadues: { description: 'HOA dues records', category: 'variable', dependencies: ['units'] },
  
  // Reference data
  categories: { description: 'Transaction categories', category: 'reference' },
  vendors: { description: 'Vendor records', category: 'reference' },
  accounts: { description: 'Chart of accounts', category: 'reference' },
  yearEndBalances: { description: 'Year-end balance snapshots', category: 'reference' },
  
  // System data
  exchangeRates: { description: 'Currency exchange rates', category: 'system', protected: true }
};

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

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    only: [],
    skip: [],
    list: false,
    help: false,
    force: false,
    interactive: args.length === 0
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--list' || arg === '-l') {
      options.list = true;
    } else if (arg === '--force' || arg === '-f') {
      options.force = true;
    } else if (arg === '--only' && i + 1 < args.length) {
      options.only = args[++i].split(',').map(s => s.trim());
    } else if (arg === '--skip' && i + 1 < args.length) {
      options.skip = args[++i].split(',').map(s => s.trim());
    }
  }
  
  // Validate options
  if (options.only.length > 0 && options.skip.length > 0) {
    console.error(`${colors.red}Error: Cannot use --only and --skip together${colors.reset}`);
    process.exit(1);
  }
  
  return options;
}

// Show help message
function showHelp() {
  console.log(`
${colors.bright}Selective Purge Script for SAMS${colors.reset}

${colors.yellow}Usage:${colors.reset}
  node purge-selective.cjs [options]

${colors.yellow}Options:${colors.reset}
  --help, -h              Show this help message
  --list, -l              List all collections and their status
  --only <collections>    Only purge specified collections (comma-separated)
  --skip <collections>    Skip specified collections (comma-separated)
  --force, -f             Skip confirmation prompts

${colors.yellow}Examples:${colors.reset}
  node purge-selective.cjs                               # Interactive mode
  node purge-selective.cjs --only transactions,hoadues   # Only purge transactions and HOA dues
  node purge-selective.cjs --skip users,clients          # Purge everything except users and clients
  node purge-selective.cjs --list                        # Show collections without purging

${colors.yellow}Available Collections:${colors.reset}
${Object.entries(PURGEABLE_COLLECTIONS)
  .map(([name, info]) => `  ${name.padEnd(20)} - ${info.description} ${info.protected ? '(protected)' : ''}`)
  .join('\n')}

${colors.yellow}Categories:${colors.reset}
  static     - Configuration data (clients, users)
  variable   - Transactional data (transactions, hoadues, units)
  reference  - Lookup data (categories, vendors, accounts)
  system     - System data (exchangeRates)
`);
}

// Promisify readline question
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

// Initialize Firebase Admin for Dev environment
function initializeFirebase() {
  const env = process.env.FIRESTORE_ENV || process.env.NODE_ENV || 'dev';
  
  console.log(`${colors.yellow}Environment check: FIRESTORE_ENV=${process.env.FIRESTORE_ENV}, NODE_ENV=${process.env.NODE_ENV}${colors.reset}`);
  
  const serviceAccountPath = path.resolve(__dirname, '../../backend/serviceAccountKey.json');
  
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`Service account file not found: ${serviceAccountPath}`);
  }

  const serviceAccount = require(serviceAccountPath);
  const devProjectId = 'sandyland-management-system';
  
  console.log(`${colors.cyan}Service account project: ${serviceAccount.project_id}${colors.reset}`);
  console.log(`${colors.cyan}Target project: ${devProjectId}${colors.reset}`);
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: devProjectId,
    databaseURL: `https://${devProjectId}.firebaseio.com`
  });

  const db = admin.firestore();
  db.settings({
    ignoreUndefinedProperties: true
  });

  console.log(`${colors.cyan}Firebase initialized with project: ${devProjectId}${colors.reset}`);
  
  return db;
}

// Get collections to purge based on options
function getCollectionsToPurge(options) {
  let collections = Object.keys(PURGEABLE_COLLECTIONS);
  
  // Filter out protected collections
  collections = collections.filter(col => !PURGEABLE_COLLECTIONS[col].protected);
  
  if (options.only.length > 0) {
    // Only purge specified collections
    collections = options.only.filter(col => {
      if (!PURGEABLE_COLLECTIONS[col]) {
        console.log(`${colors.yellow}Warning: Unknown collection '${col}' will be ignored${colors.reset}`);
        return false;
      }
      if (PURGEABLE_COLLECTIONS[col].protected) {
        console.log(`${colors.yellow}Warning: Protected collection '${col}' will be skipped${colors.reset}`);
        return false;
      }
      return true;
    });
  } else if (options.skip.length > 0) {
    // Purge all except specified
    collections = collections.filter(col => !options.skip.includes(col));
  }
  
  return collections;
}

// Check dependencies
function checkDependencies(collections) {
  const warnings = [];
  
  for (const col of collections) {
    const info = PURGEABLE_COLLECTIONS[col];
    if (info.dependencies) {
      for (const dep of info.dependencies) {
        if (!collections.includes(dep)) {
          warnings.push({
            collection: col,
            dependency: dep,
            message: `'${col}' depends on '${dep}' which is not being purged`
          });
        }
      }
    }
  }
  
  return warnings;
}

// Interactive mode - let user select collections
async function interactiveSelection() {
  console.log(`\n${colors.bright}Select collections to purge:${colors.reset}\n`);
  
  const selections = {};
  const categories = ['variable', 'reference', 'static'];
  
  for (const category of categories) {
    console.log(`\n${colors.cyan}${category.toUpperCase()} DATA:${colors.reset}`);
    
    const categoryCollections = Object.entries(PURGEABLE_COLLECTIONS)
      .filter(([_, info]) => info.category === category && !info.protected);
    
    for (const [name, info] of categoryCollections) {
      const defaultChoice = category === 'variable' ? 'y' : 'n';
      const prompt = `  Purge ${name.padEnd(20)} (${info.description})? [${defaultChoice}]: `;
      const answer = await question(prompt);
      selections[name] = answer === '' ? defaultChoice === 'y' : answer.toLowerCase() === 'y';
    }
  }
  
  return Object.keys(selections).filter(key => selections[key]);
}

// List collections and their current document counts
async function listCollections(db) {
  console.log(`\n${colors.bright}=== COLLECTION STATUS ===${colors.reset}\n`);
  
  const categories = ['static', 'variable', 'reference', 'system'];
  
  for (const category of categories) {
    console.log(`${colors.cyan}${category.toUpperCase()}:${colors.reset}`);
    
    const categoryCollections = Object.entries(PURGEABLE_COLLECTIONS)
      .filter(([_, info]) => info.category === category);
    
    for (const [name, info] of categoryCollections) {
      try {
        const snapshot = await db.collection(name).count().get();
        const count = snapshot.data().count;
        const status = info.protected ? '🔒' : '✓';
        console.log(`  ${status} ${name.padEnd(20)} - ${count.toString().padStart(6)} docs - ${info.description}`);
      } catch (error) {
        console.log(`  ✗ ${name.padEnd(20)} -      ? docs - ${info.description}`);
      }
    }
    console.log();
  }
}

// Delete all documents in a collection
async function purgeCollection(db, collectionName) {
  const BATCH_SIZE = 500;
  
  try {
    console.log(`${colors.yellow}Purging: ${collectionName}${colors.reset}`);
    const collectionRef = db.collection(collectionName);
    
    let totalDeleted = 0;
    let hasMore = true;
    
    while (hasMore) {
      const snapshot = await collectionRef.limit(BATCH_SIZE).get();
      
      if (snapshot.empty) {
        hasMore = false;
        break;
      }
      
      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      totalDeleted += snapshot.size;
      
      if (totalDeleted % 1000 === 0) {
        console.log(`  ${colors.blue}Progress: ${totalDeleted} documents deleted...${colors.reset}`);
      }
    }
    
    console.log(`  ${colors.green}✓ Deleted ${totalDeleted} documents from ${collectionName}${colors.reset}`);
    return totalDeleted;
    
  } catch (error) {
    console.error(`${colors.red}Error purging ${collectionName}:${colors.reset}`, error.message);
    throw error;
  }
}

// Main execution
async function main() {
  const options = parseArgs();
  
  if (options.help) {
    showHelp();
    process.exit(0);
  }
  
  console.log(`${colors.bright}${colors.magenta}
╔═══════════════════════════════════════════════════════════╗
║            SELECTIVE FIRESTORE PURGE UTILITY              ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}`);
  
  try {
    // Initialize Firebase
    console.log(`${colors.cyan}Initializing Firebase Admin...${colors.reset}`);
    const db = initializeFirebase();
    console.log(`${colors.green}✓ Connected to Dev Firestore${colors.reset}\n`);
    
    // List mode
    if (options.list) {
      await listCollections(db);
      process.exit(0);
    }
    
    // Get collections to purge
    let collectionsToPurge;
    if (options.interactive) {
      collectionsToPurge = await interactiveSelection();
    } else {
      collectionsToPurge = getCollectionsToPurge(options);
    }
    
    if (collectionsToPurge.length === 0) {
      console.log(`${colors.yellow}No collections selected for purging.${colors.reset}`);
      process.exit(0);
    }
    
    // Check dependencies
    const warnings = checkDependencies(collectionsToPurge);
    
    // Show purge plan
    console.log(`\n${colors.bright}=== PURGE PLAN ===${colors.reset}\n`);
    console.log(`${colors.red}Collections to PURGE:${colors.reset}`);
    for (const col of collectionsToPurge) {
      const info = PURGEABLE_COLLECTIONS[col];
      console.log(`  - ${col.padEnd(20)} (${info.description})`);
    }
    
    console.log(`\n${colors.green}Collections to PRESERVE:${colors.reset}`);
    const preservedCollections = Object.keys(PURGEABLE_COLLECTIONS)
      .filter(col => !collectionsToPurge.includes(col));
    for (const col of preservedCollections) {
      const info = PURGEABLE_COLLECTIONS[col];
      console.log(`  - ${col.padEnd(20)} (${info.description})`);
    }
    
    // Show warnings
    if (warnings.length > 0) {
      console.log(`\n${colors.yellow}⚠️  WARNINGS:${colors.reset}`);
      for (const warning of warnings) {
        console.log(`  - ${warning.message}`);
      }
    }
    
    // Confirmation
    if (!options.force) {
      console.log(`\n${colors.bright}${colors.red}⚠️  This operation will permanently delete data!${colors.reset}`);
      const confirmation = await question(`\nType "PURGE" to confirm: `);
      if (confirmation !== 'PURGE') {
        console.log(`\n${colors.red}✗ Purge cancelled${colors.reset}`);
        process.exit(0);
      }
    }
    
    // Execute purge
    console.log(`\n${colors.bright}Executing purge...${colors.reset}`);
    let totalDeleted = 0;
    const results = [];
    
    for (const collection of collectionsToPurge) {
      try {
        const deleted = await purgeCollection(db, collection);
        totalDeleted += deleted;
        results.push({ collection, deleted, status: 'success' });
      } catch (error) {
        results.push({ collection, deleted: 0, status: 'error', error: error.message });
      }
    }
    
    // Show results
    console.log(`\n${colors.bright}=== PURGE RESULTS ===${colors.reset}\n`);
    for (const result of results) {
      if (result.status === 'success') {
        console.log(`${colors.green}✓ ${result.collection.padEnd(20)} - ${result.deleted} documents deleted${colors.reset}`);
      } else {
        console.log(`${colors.red}✗ ${result.collection.padEnd(20)} - Failed: ${result.error}${colors.reset}`);
      }
    }
    
    console.log(`\n${colors.bright}Total documents deleted: ${totalDeleted}${colors.reset}`);
    console.log(`${colors.green}${colors.bright}✅ Purge operation completed!${colors.reset}`);
    
  } catch (error) {
    console.error(`\n${colors.red}${colors.bright}❌ CRITICAL ERROR:${colors.reset}`, error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main().then(() => process.exit(0));
}

module.exports = { main };