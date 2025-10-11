#!/usr/bin/env node

/**
 * Clean Backend Migration Script
 * Removes ALL legacy fields and structures - no backward compatibility
 * 
 * BACKEND-VALIDATION-001 - Clean Migration
 * Created: July 5, 2025
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CleanBackendMigrator {
  constructor() {
    this.backupDir = path.join(__dirname, 'backups', `clean-migration-${new Date().toISOString().replace(/:/g, '-')}`);
    this.filesModified = [];
    this.errors = [];
    
    // Define all replacements needed
    this.replacements = {
      // Field replacements
      fields: [
        {
          pattern: /\.clientAccess(?![A-Za-z])/g,
          replacement: '.propertyAccess',
          description: 'clientAccess → propertyAccess'
        },
        {
          pattern: /['"]clientAccess['"]/g,
          replacement: '"propertyAccess"',
          description: 'clientAccess key → propertyAccess'
        },
        {
          pattern: /clientAccess:/g,
          replacement: 'propertyAccess:',
          description: 'clientAccess: → propertyAccess:'
        },
        {
          pattern: /\.globalRole(?![A-Za-z])/g,
          replacement: '.isSuperAdmin',
          description: 'globalRole → isSuperAdmin'
        },
        {
          pattern: /globalRole:[^,}\n]*/g,
          replacement: 'isSuperAdmin: false',
          description: 'globalRole: value → isSuperAdmin: false'
        },
        {
          pattern: /globalRole === ['"]superAdmin['"]/g,
          replacement: 'isSuperAdmin === true',
          description: 'globalRole check → isSuperAdmin'
        },
        {
          pattern: /globalRole !== ['"]superAdmin['"]/g,
          replacement: 'isSuperAdmin !== true',
          description: 'globalRole negative check → isSuperAdmin'
        },
        {
          pattern: /\.isActive(?![A-Za-z])/g,
          replacement: '.accountState === "active"',
          description: 'isActive → accountState check'
        },
        {
          pattern: /isActive:[^,}\n]*/g,
          replacement: 'accountState: "active"',
          description: 'isActive: → accountState:'
        },
        {
          pattern: /\.lastLogin(?![A-Za-z])/g,
          replacement: '.lastSignInTime /* Use Firebase Auth metadata */',
          description: 'lastLogin → Firebase Auth metadata'
        }
      ],
      
      // Timestamp replacements
      timestamps: [
        {
          pattern: /new Date\(\)\.toISOString\(\)/g,
          replacement: 'admin.firestore.FieldValue.serverTimestamp()',
          description: 'ISO string → Firestore timestamp'
        },
        {
          pattern: /Date\.now\(\)/g,
          replacement: 'admin.firestore.FieldValue.serverTimestamp()',
          description: 'Date.now() → Firestore timestamp'
        },
        {
          pattern: /createdAt:[^,}\n]*new Date[^,}\n]*/g,
          replacement: 'created: admin.firestore.FieldValue.serverTimestamp()',
          description: 'createdAt → created with timestamp'
        },
        {
          pattern: /updatedAt:[^,}\n]*new Date[^,}\n]*/g,
          replacement: 'updated: admin.firestore.FieldValue.serverTimestamp()',
          description: 'updatedAt → updated with timestamp'
        }
      ],
      
      // Legacy structure removals
      legacy: [
        {
          pattern: /additionalAssignments:[^}]*}/g,
          replacement: '/* additionalAssignments removed - use unitAssignments */',
          description: 'Remove additionalAssignments'
        },
        {
          pattern: /unitId:\s*[^,}\n]*/g,
          replacement: '/* unitId removed - use unitAssignments array */',
          description: 'Remove legacy unitId'
        }
      ],
      
      // Method updates
      methods: [
        {
          pattern: /getClientAccess/g,
          replacement: 'getPropertyAccess',
          description: 'getClientAccess → getPropertyAccess'
        },
        {
          pattern: /hasClientAccess/g,
          replacement: 'hasPropertyAccess',
          description: 'hasClientAccess → hasPropertyAccess'
        },
        {
          pattern: /enforceClientAccess/g,
          replacement: 'enforcePropertyAccess',
          description: 'enforceClientAccess → enforcePropertyAccess'
        }
      ]
    };
  }

  async createBackup(filePath) {
    const relativePath = path.relative(path.join(__dirname, '../..'), filePath);
    const backupPath = path.join(this.backupDir, relativePath);
    
    await fs.mkdir(path.dirname(backupPath), { recursive: true });
    await fs.copyFile(filePath, backupPath);
    
    console.log(`📦 Backed up: ${relativePath}`);
  }

  async processFile(filePath) {
    try {
      await this.createBackup(filePath);
      
      let content = await fs.readFile(filePath, 'utf8');
      const originalContent = content;
      let changeCount = 0;
      
      console.log(`\n🔧 Processing: ${path.basename(filePath)}`);
      
      // Apply all replacement categories
      for (const [category, replacements] of Object.entries(this.replacements)) {
        for (const { pattern, replacement, description } of replacements) {
          const matches = content.match(pattern);
          if (matches && matches.length > 0) {
            content = content.replace(pattern, replacement);
            changeCount += matches.length;
            console.log(`  ✏️  ${description}: ${matches.length} changes`);
          }
        }
      }
      
      // Special handling for userManagementController
      if (filePath.includes('userManagementController')) {
        content = this.cleanUserManagementController(content);
      }
      
      if (content !== originalContent) {
        await fs.writeFile(filePath, content, 'utf8');
        this.filesModified.push({
          file: path.relative(path.join(__dirname, '../..'), filePath),
          changes: changeCount
        });
        console.log(`✅ Updated with ${changeCount} changes`);
      } else {
        console.log('⏭️  No changes needed');
      }
      
    } catch (error) {
      this.errors.push({ file: filePath, error: error.message });
      console.error(`❌ Error: ${error.message}`);
    }
  }

  cleanUserManagementController(content) {
    // Remove all legacy sync functions
    content = content.replace(/\/\/ Backward compatibility[\s\S]*?(?=\n\n)/g, '');
    
    // Update syncManagerAssignments to syncUnitAssignments
    content = content.replace(/syncManagerAssignments/g, 'syncUnitAssignments');
    
    // Remove old manager-specific functions
    content = content.replace(/function updateManagerNameInUnits[\s\S]*?(?=\n\n)/g, '');
    content = content.replace(/async function updateManagerNameInUnits[\s\S]*?(?=\n\n)/g, '');
    
    return content;
  }

  async migrateAllFiles() {
    const filesToMigrate = {
      middleware: [
        'unitAuthorization.js'
      ],
      routes: [
        'auth.js',
        'user.js',
        'units.js',
        'hoaDues.js',
        'reports.js',
        'transactions.js',
        'accounts.js',
        'vendors.js',
        'categories.js',
        'email.js',
        'paymentMethods.js',
        'clientManagement.js',
        'clientOnboarding.js'
      ],
      controllers: [
        'userManagementController.js',
        'transactionsController.js',
        'unitsController.js',
        'hoaDuesController.js',
        'clientsController.js',
        'accountsController.js',
        'vendorsController.js',
        'categoriesController.js'
      ]
    };

    // Process each category
    for (const [category, files] of Object.entries(filesToMigrate)) {
      console.log(`\n📁 Migrating ${category}...`);
      
      for (const file of files) {
        const filePath = path.join(__dirname, '../..', category, file);
        if (await fs.access(filePath).then(() => true).catch(() => false)) {
          await this.processFile(filePath);
        } else {
          console.log(`⚠️  File not found: ${file}`);
        }
      }
    }
  }

  async installCleanMiddleware() {
    console.log('\n🔧 Installing clean middleware...');
    
    const cleanAuthPath = path.join(__dirname, '..', 'middleware', 'clientAuth-clean.js');
    const targetAuthPath = path.join(__dirname, '..', 'middleware', 'clientAuth.js');
    
    await this.createBackup(targetAuthPath);
    
    // Read the clean version and remove the temporary alias
    let cleanContent = await fs.readFile(cleanAuthPath, 'utf8');
    cleanContent = cleanContent.replace(/\/\/ Middleware aliases[\s\S]*?export const enforceClientAccess[^;]*;/g, '');
    cleanContent = cleanContent.replace(/enforceClientAccess, \/\/ Temporary alias\n/g, '');
    
    await fs.writeFile(targetAuthPath, cleanContent, 'utf8');
    
    this.filesModified.push({
      file: 'middleware/clientAuth.js',
      changes: 'Complete rewrite'
    });
    
    console.log('✅ Clean clientAuth.js installed');
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      backupLocation: this.backupDir,
      filesModified: this.filesModified,
      errors: this.errors,
      summary: {
        totalModified: this.filesModified.length,
        totalErrors: this.errors.length,
        totalChanges: this.filesModified.reduce((sum, f) => sum + (typeof f.changes === 'number' ? f.changes : 1), 0)
      }
    };

    await fs.writeFile(
      path.join(__dirname, 'clean-migration-report.json'),
      JSON.stringify(report, null, 2)
    );

    console.log('\n' + '='.repeat(60));
    console.log('CLEAN MIGRATION COMPLETE');
    console.log('='.repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(`Files Modified: ${report.summary.totalModified}`);
    console.log(`Total Changes: ${report.summary.totalChanges}`);
    console.log(`Errors: ${report.summary.totalErrors}`);
    console.log(`\n📁 Backups: ${this.backupDir}`);
    console.log(`📄 Report: clean-migration-report.json`);

    if (this.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      this.errors.forEach(e => console.log(`  - ${e.file}: ${e.error}`));
    }

    console.log('\n✨ All legacy code has been removed!');
    console.log('\n🔄 Next steps:');
    console.log('1. Reload MTC data with new structure');
    console.log('2. Run integration tests');
    console.log('3. Deploy to development environment');
  }

  async run() {
    console.log('🚀 Starting Clean Backend Migration...');
    console.log('⚠️  This will remove ALL backward compatibility!\n');

    await fs.mkdir(this.backupDir, { recursive: true });
    
    // Install clean middleware first
    await this.installCleanMiddleware();
    
    // Migrate all other files
    await this.migrateAllFiles();
    
    // Generate report
    await this.generateReport();
  }
}

// Execute migration
if (process.argv[2] === '--execute') {
  const migrator = new CleanBackendMigrator();
  migrator.run().catch(console.error);
} else {
  console.log('Clean Backend Migration Script');
  console.log('=============================\n');
  console.log('This script will:');
  console.log('1. Remove ALL legacy field references');
  console.log('2. Update to new field structure throughout');
  console.log('3. Remove backward compatibility code');
  console.log('4. Install clean middleware');
  console.log('5. Create backups of all files\n');
  console.log('⚠️  WARNING: No backward compatibility will remain!\n');
  console.log('To execute: node clean-backend-migration.js --execute');
}