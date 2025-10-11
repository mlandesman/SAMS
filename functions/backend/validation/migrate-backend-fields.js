#!/usr/bin/env node

/**
 * Backend Field Migration Script
 * Safely updates all backend files to use new field structures
 * 
 * BACKEND-VALIDATION-001
 * Created: July 5, 2025
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class BackendMigrator {
  constructor() {
    this.backupDir = path.join(__dirname, 'backups', new Date().toISOString().replace(/:/g, '-'));
    this.changedFiles = [];
    this.errors = [];
  }

  async createBackup(filePath) {
    const relativePath = path.relative(path.join(__dirname, '..'), filePath);
    const backupPath = path.join(this.backupDir, relativePath);
    
    await fs.mkdir(path.dirname(backupPath), { recursive: true });
    await fs.copyFile(filePath, backupPath);
    
    console.log(`📦 Backed up: ${relativePath}`);
  }

  async migrateFile(filePath, replacements) {
    try {
      // Create backup first
      await this.createBackup(filePath);
      
      // Read file content
      let content = await fs.readFile(filePath, 'utf8');
      const originalContent = content;
      
      // Apply replacements
      replacements.forEach(({ pattern, replacement, description }) => {
        const regex = new RegExp(pattern, 'g');
        const matches = content.match(regex);
        
        if (matches && matches.length > 0) {
          content = content.replace(regex, replacement);
          console.log(`  ✏️  ${description}: ${matches.length} replacements`);
        }
      });
      
      // Only write if changes were made
      if (content !== originalContent) {
        await fs.writeFile(filePath, content, 'utf8');
        this.changedFiles.push(path.relative(path.join(__dirname, '..'), filePath));
        console.log(`✅ Updated: ${path.basename(filePath)}`);
      } else {
        console.log(`⏭️  No changes needed: ${path.basename(filePath)}`);
      }
      
    } catch (error) {
      this.errors.push({ file: filePath, error: error.message });
      console.error(`❌ Error processing ${filePath}: ${error.message}`);
    }
  }

  async migrateAuthFiles() {
    console.log('\n🔐 Migrating Authentication Files...\n');
    
    // Define replacements for auth-related files
    const authReplacements = [
      {
        pattern: '\\.clientAccess(?![A-Za-z])',
        replacement: '.propertyAccess',
        description: 'clientAccess → propertyAccess'
      },
      {
        pattern: 'clientAccess:',
        replacement: 'propertyAccess:',
        description: 'clientAccess: → propertyAccess:'
      },
      {
        pattern: "globalRole === 'superAdmin'",
        replacement: "isSuperAdmin === true",
        description: "globalRole check → isSuperAdmin"
      },
      {
        pattern: 'globalRole === "superAdmin"',
        replacement: 'isSuperAdmin === true',
        description: 'globalRole check → isSuperAdmin'
      },
      {
        pattern: '\\.globalRole(?![A-Za-z])',
        replacement: '.isSuperAdmin ? "superAdmin" : "user"',
        description: 'globalRole field → isSuperAdmin ternary'
      },
      {
        pattern: 'globalRole:',
        replacement: 'isSuperAdmin:',
        description: 'globalRole: → isSuperAdmin:'
      },
      {
        pattern: '\\.isActive(?![A-Za-z])',
        replacement: '.accountState === "active"',
        description: 'isActive → accountState check'
      },
      {
        pattern: 'isActive:',
        replacement: 'accountState:',
        description: 'isActive: → accountState:'
      }
    ];
    
    // Process middleware files
    const middlewareFiles = [
      path.join(__dirname, '..', 'middleware', 'unitAuthorization.js')
    ];
    
    for (const file of middlewareFiles) {
      await this.migrateFile(file, authReplacements);
    }
  }

  async migrateRoutes() {
    console.log('\n🛣️  Migrating Route Files...\n');
    
    const routeReplacements = [
      {
        pattern: '\\.clientAccess(?![A-Za-z])',
        replacement: '.propertyAccess',
        description: 'clientAccess → propertyAccess'
      },
      {
        pattern: "globalRole === 'superAdmin'",
        replacement: "isSuperAdmin === true",
        description: "Role check update"
      },
      {
        pattern: 'clientAccess\\[',
        replacement: 'propertyAccess[',
        description: 'Array access update'
      }
    ];
    
    const routeFiles = [
      'user.js',
      'units.js', 
      'hoaDues.js',
      'reports.js'
    ].map(f => path.join(__dirname, '..', 'routes', f));
    
    for (const file of routeFiles) {
      await this.migrateFile(file, routeReplacements);
    }
  }

  async migrateControllers() {
    console.log('\n🎮 Migrating Controller Files...\n');
    
    const controllerReplacements = [
      {
        pattern: '\\.clientAccess(?![A-Za-z])',
        replacement: '.propertyAccess',
        description: 'clientAccess → propertyAccess'
      },
      {
        pattern: 'clientAccess:',
        replacement: 'propertyAccess:',
        description: 'Object key update'
      },
      {
        pattern: "globalRole: 'superAdmin'",
        replacement: "isSuperAdmin: true",
        description: "SuperAdmin assignment"
      },
      {
        pattern: '\\.globalRole(?![A-Za-z])',
        replacement: '.isSuperAdmin ? "superAdmin" : "user"',
        description: 'Role field access'
      },
      {
        pattern: 'new Date\\(\\)\\.toISOString\\(\\)',
        replacement: 'admin.firestore.FieldValue.serverTimestamp()',
        description: 'Timestamp update'
      },
      {
        pattern: 'Date\\.now\\(\\)',
        replacement: 'admin.firestore.FieldValue.serverTimestamp()',
        description: 'Timestamp update'
      }
    ];
    
    const controllerFiles = [
      'clientsController.js'
    ].map(f => path.join(__dirname, '..', 'controllers', f));
    
    for (const file of controllerFiles) {
      await this.migrateFile(file, controllerReplacements);
    }
  }

  async generateMigrationReport() {
    const report = {
      timestamp: new Date().toISOString(),
      backupLocation: this.backupDir,
      changedFiles: this.changedFiles,
      errors: this.errors,
      summary: {
        totalChanged: this.changedFiles.length,
        totalErrors: this.errors.length
      }
    };
    
    const reportPath = path.join(__dirname, 'migration-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log('\n' + '='.repeat(60));
    console.log('MIGRATION COMPLETE');
    console.log('='.repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(`Files Changed: ${report.summary.totalChanged}`);
    console.log(`Errors: ${report.summary.totalErrors}`);
    console.log(`\n📁 Backups saved to: ${this.backupDir}`);
    console.log(`📄 Report saved to: migration-report.json`);
    
    if (this.changedFiles.length > 0) {
      console.log('\n✅ Changed Files:');
      this.changedFiles.forEach(f => console.log(`  - ${f}`));
    }
    
    if (this.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.errors.forEach(e => console.log(`  - ${e.file}: ${e.error}`));
    }
  }

  async run() {
    console.log('🚀 Starting Backend Field Migration...');
    console.log(`📁 Creating backup directory: ${this.backupDir}\n`);
    
    await fs.mkdir(this.backupDir, { recursive: true });
    
    // Copy the fixed clientAuth.js
    console.log('📋 Installing fixed clientAuth.js...');
    const fixedAuthPath = path.join(__dirname, '..', 'middleware', 'clientAuth-fixed.js');
    const targetAuthPath = path.join(__dirname, '..', 'middleware', 'clientAuth.js');
    
    await this.createBackup(targetAuthPath);
    await fs.copyFile(fixedAuthPath, targetAuthPath);
    this.changedFiles.push('middleware/clientAuth.js');
    console.log('✅ Installed fixed clientAuth.js\n');
    
    // Run migrations
    await this.migrateAuthFiles();
    await this.migrateRoutes();
    await this.migrateControllers();
    
    // Note about manual updates needed
    console.log('\n⚠️  MANUAL UPDATES REQUIRED:');
    console.log('1. userManagementController.js - Complex logic requires manual review');
    console.log('2. Timestamp conversions in controllers need manual verification');
    console.log('3. Test all endpoints after migration');
    
    await this.generateMigrationReport();
  }
}

// Safety check
console.log('\n⚠️  WARNING: This script will modify backend files!');
console.log('A backup will be created, but please ensure you have committed any changes.\n');

const args = process.argv.slice(2);
if (args[0] === '--execute') {
  const migrator = new BackendMigrator();
  migrator.run().catch(console.error);
} else {
  console.log('To execute migration, run: node migrate-backend-fields.js --execute');
  console.log('\nThis script will:');
  console.log('1. Back up all files before modification');
  console.log('2. Update field names to match new specification');
  console.log('3. Install the fixed clientAuth.js middleware');
  console.log('4. Generate a migration report');
}