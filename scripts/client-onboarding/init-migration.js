#!/usr/bin/env node

/**
 * Initialize Client Migration
 * 
 * Creates a standardized migration directory structure for moving
 * a client from one environment to another (typically Dev to Prod)
 * 
 * Usage:
 *   node init-migration.js --client AVII --source dev --target prod
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    params[key] = value;
  }
  
  return params;
}

// Generate migration ID with timestamp
function generateMigrationId(clientId) {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '-')
    .replace('Z', '');
  
  return `${clientId}-${timestamp}`;
}

// Create migration metadata
function createMetadata(clientId, source, target, migrationId) {
  return {
    client: clientId,
    migrationId: migrationId,
    source: source,
    target: target,
    started: new Date().toISOString(),
    completed: null,
    status: 'initialized',
    phases: {
      init: {
        status: 'completed',
        timestamp: new Date().toISOString()
      },
      analyze: {
        status: 'pending',
        timestamp: null
      },
      backup: {
        status: 'pending',
        timestamp: null
      },
      export: {
        status: 'pending',
        timestamp: null
      },
      userMapping: {
        status: 'pending',
        timestamp: null
      },
      purge: {
        status: 'pending',
        timestamp: null
      },
      userMigration: {
        status: 'pending',
        timestamp: null
      },
      import: {
        status: 'pending',
        timestamp: null
      },
      verify: {
        status: 'pending',
        timestamp: null
      }
    },
    files: {
      metadata: 'metadata.json',
      devExport: 'dev-export.json',
      prodBackup: 'prod-backup.json',
      userMapping: 'user-mapping.json',
      checksums: 'checksums.json',
      verificationReport: 'verification-report.txt',
      migrationLog: 'migration.log'
    },
    notes: []
  };
}

// Write log entry
async function writeLog(logPath, message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} [${level}] ${message}\n`;
  
  try {
    await fs.appendFile(logPath, logEntry);
  } catch (error) {
    // If file doesn't exist, create it
    await fs.writeFile(logPath, logEntry);
  }
}

// Main initialization function
async function initMigration() {
  console.log('🚀 Client Migration Initialization');
  console.log('===================================\n');
  
  // Parse arguments
  const params = parseArgs();
  
  if (!params.client || !params.source || !params.target) {
    console.error('❌ Missing required parameters');
    console.error('Usage: node init-migration.js --client <CLIENT_ID> --source <ENV> --target <ENV>');
    console.error('Example: node init-migration.js --client AVII --source dev --target prod');
    process.exit(1);
  }
  
  const { client: clientId, source, target } = params;
  
  // Validate environments
  const validEnvs = ['dev', 'staging', 'prod'];
  if (!validEnvs.includes(source) || !validEnvs.includes(target)) {
    console.error('❌ Invalid environment. Must be one of: dev, staging, prod');
    process.exit(1);
  }
  
  if (source === target) {
    console.error('❌ Source and target environments must be different');
    process.exit(1);
  }
  
  // Generate migration ID
  const migrationId = generateMigrationId(clientId);
  const migrationDir = path.join(__dirname, 'migrations', migrationId);
  
  console.log(`📋 Migration Details:`);
  console.log(`   Client: ${clientId}`);
  console.log(`   Source: ${source}`);
  console.log(`   Target: ${target}`);
  console.log(`   Migration ID: ${migrationId}`);
  console.log(`   Directory: ${migrationDir}`);
  console.log('');
  
  try {
    // Create migration directory
    await fs.mkdir(migrationDir, { recursive: true });
    console.log('✅ Created migration directory');
    
    // Create metadata
    const metadata = createMetadata(clientId, source, target, migrationId);
    const metadataPath = path.join(migrationDir, 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    console.log('✅ Created metadata.json');
    
    // Initialize empty files
    const emptyFiles = [
      'dev-export.json',
      'prod-backup.json',
      'user-mapping.json',
      'checksums.json'
    ];
    
    for (const file of emptyFiles) {
      const filePath = path.join(migrationDir, file);
      await fs.writeFile(filePath, '{}');
    }
    console.log('✅ Initialized migration files');
    
    // Create verification report template
    const reportPath = path.join(migrationDir, 'verification-report.txt');
    await fs.writeFile(reportPath, `Migration Verification Report
=====================================
Migration ID: ${migrationId}
Client: ${clientId}
Source: ${source}
Target: ${target}
Started: ${new Date().toISOString()}

Status: PENDING
`);
    console.log('✅ Created verification report template');
    
    // Initialize migration log
    const logPath = path.join(migrationDir, 'migration.log');
    await writeLog(logPath, `Migration initialized for client ${clientId}`, 'INFO');
    await writeLog(logPath, `Source environment: ${source}`, 'INFO');
    await writeLog(logPath, `Target environment: ${target}`, 'INFO');
    await writeLog(logPath, `Migration directory: ${migrationDir}`, 'INFO');
    console.log('✅ Initialized migration.log');
    
    // Create a symlink to latest migration for this client
    const latestLink = path.join(__dirname, 'migrations', `${clientId}-latest`);
    try {
      // Remove existing symlink if it exists
      await fs.unlink(latestLink);
    } catch (err) {
      // Ignore if doesn't exist
    }
    await fs.symlink(migrationDir, latestLink);
    console.log('✅ Created symlink to latest migration');
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ Migration initialized successfully!');
    console.log('='.repeat(50));
    console.log('\n📁 Migration directory structure:');
    console.log(`   ${migrationDir}/`);
    console.log('      ├── metadata.json           # Migration metadata');
    console.log('      ├── dev-export.json         # Will contain Dev export');
    console.log('      ├── prod-backup.json        # Will contain Prod backup');
    console.log('      ├── user-mapping.json       # Will contain user mappings');
    console.log('      ├── checksums.json          # Will contain checksums');
    console.log('      ├── verification-report.txt # Will contain final report');
    console.log('      └── migration.log           # Operation log');
    
    console.log('\n📋 Next steps:');
    console.log(`   1. Run: analyze-client.js --client ${clientId} --env ${source}`);
    console.log(`   2. Run: backup-prod-client.js --client ${clientId}`);
    console.log(`   3. Run: export-client.js --client ${clientId} --env ${source}`);
    console.log(`   4. Continue with migration process...`);
    
    // Save migration ID to environment for other scripts
    console.log('\n💡 Tip: Set environment variable for this migration:');
    console.log(`   export MIGRATION_ID="${migrationId}"`);
    
  } catch (error) {
    console.error('❌ Failed to initialize migration:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run initialization
initMigration();