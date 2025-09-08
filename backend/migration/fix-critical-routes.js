#!/usr/bin/env node

/**
 * Fix Critical Routes - Focused migration for essential backend files
 * Updates field references to match the new database structure
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Critical files that need immediate fixing
const CRITICAL_FILES = {
  routes: [
    '../routes/user.js',
    '../routes/units.js',
    '../routes/reports.js'
  ],
  controllers: [
    '../controllers/userManagementController.js',
    '../controllers/unitsController.js'
  ],
  middleware: [
    '../middleware/unitAuthorization.js'
  ]
};

// Field replacements
const REPLACEMENTS = [
  // User fields
  {
    pattern: /clientAccess/g,
    replacement: 'propertyAccess',
    description: 'clientAccess → propertyAccess'
  },
  {
    pattern: /globalRole:\s*"user"/g,
    replacement: 'isSuperAdmin: false',
    description: 'globalRole: "user" → isSuperAdmin: false'
  },
  {
    pattern: /globalRole:\s*"superAdmin"/g,
    replacement: 'isSuperAdmin: true',
    description: 'globalRole: "superAdmin" → isSuperAdmin: true'
  },
  {
    pattern: /globalRole === ['"]superAdmin['"]/g,
    replacement: 'isSuperAdmin === true',
    description: 'globalRole check → isSuperAdmin'
  },
  {
    pattern: /\.globalRole/g,
    replacement: '.isSuperAdmin',
    description: '.globalRole → .isSuperAdmin'
  },
  {
    pattern: /isActive:\s*true/g,
    replacement: 'accountState: "active"',
    description: 'isActive: true → accountState: "active"'
  },
  {
    pattern: /\.isActive/g,
    replacement: '.accountState === "active"',
    description: '.isActive → .accountState check'
  },
  // Remove lastLogin references (use Firebase Auth)
  {
    pattern: /lastLogin:\s*new Date\(\)[,\n]/g,
    replacement: '',
    description: 'Remove lastLogin field'
  },
  // Timestamps
  {
    pattern: /createdAt:\s*new Date\(\)/g,
    replacement: 'created: admin.firestore.FieldValue.serverTimestamp()',
    description: 'createdAt → created with Firestore timestamp'
  },
  {
    pattern: /new Date\(\)\.toISOString\(\)/g,
    replacement: 'admin.firestore.FieldValue.serverTimestamp()',
    description: 'ISO string → Firestore timestamp'
  }
];

async function processFile(filePath) {
  try {
    const fullPath = path.join(__dirname, filePath);
    
    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch {
      console.log(`⚠️  Skipping ${filePath} - file not found`);
      return;
    }
    
    console.log(`\n📄 Processing: ${filePath}`);
    
    // Read file
    let content = await fs.readFile(fullPath, 'utf8');
    const originalContent = content;
    
    // Apply replacements
    let totalChanges = 0;
    for (const { pattern, replacement, description } of REPLACEMENTS) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        content = content.replace(pattern, replacement);
        totalChanges += matches.length;
        console.log(`  ✏️  ${description}: ${matches.length} changes`);
      }
    }
    
    // Special handling for user.js - fix the auto-create logic
    if (filePath.includes('user.js')) {
      // Fix the new user creation block
      content = content.replace(
        /const newUserData = \{[\s\S]*?\};/,
        `const newUserData = {
        id: uid,
        uid: uid,
        email: email,
        displayName: name || email,
        created: admin.firestore.FieldValue.serverTimestamp(),
        isSuperAdmin: false,
        propertyAccess: {},
        accountState: "active",
        profile: {
          firstName: name?.split(' ')[0] || '',
          lastName: name?.split(' ').slice(1).join(' ') || '',
          preferredCurrency: 'MXN',
          preferredLanguage: 'english'
        },
        notifications: {
          email: true,
          sms: true,
          duesReminders: true
        },
        creationMethod: "auto-created"
      };`
      );
      console.log('  ✏️  Fixed user creation block');
      totalChanges++;
    }
    
    // Write back if changes were made
    if (content !== originalContent) {
      // Create backup
      const backupPath = fullPath + '.backup-' + Date.now();
      await fs.copyFile(fullPath, backupPath);
      console.log(`  📦 Backup created: ${path.basename(backupPath)}`);
      
      // Write updated content
      await fs.writeFile(fullPath, content, 'utf8');
      console.log(`  ✅ Updated with ${totalChanges} changes`);
    } else {
      console.log('  ⏭️  No changes needed');
    }
    
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

async function main() {
  console.log('🚀 Fixing Critical Backend Routes\n');
  console.log('This will update field references in essential files only.\n');
  
  // Process all critical files
  for (const [category, files] of Object.entries(CRITICAL_FILES)) {
    console.log(`\n=== ${category.toUpperCase()} ===`);
    for (const file of files) {
      await processFile(file);
    }
  }
  
  console.log('\n✅ Critical fixes complete!');
  console.log('\nNext steps:');
  console.log('1. Test authentication flow');
  console.log('2. Test user profile endpoint');
  console.log('3. Test property access checks');
  console.log('4. Run remaining migration for other files');
}

// Execute
main().catch(console.error);