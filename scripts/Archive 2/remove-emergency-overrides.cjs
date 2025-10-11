#!/usr/bin/env node

/**
 * Emergency Override Removal Script
 * 
 * Removes all the emergency authentication overrides that were added
 * to work around the UID mismatch issue. These are no longer needed
 * once we switch to email-based document IDs.
 * 
 * This script will clean up:
 * - AuthContext.jsx emergency overrides
 * - userRoles.js emergency checks
 * - Sidebar.jsx debug logging
 * - Any other emergency patches
 */

const fs = require('fs').promises;
const path = require('path');

// Files that contain emergency overrides
const filesToClean = [
  {
    path: '../frontend/sams-ui/src/context/AuthContext.jsx',
    description: 'AuthContext emergency overrides',
    patterns: [
      {
        // Remove emergency override block
        start: /\/\/ EMERGENCY OVERRIDE[\s\S]*?if \(samsUserProfile\.email === 'michael@landesman\.com'\) \{/,
        end: /\}[\s]*\/\/ End emergency override/,
        replacement: ''
      },
      {
        // Remove debug logging added for emergency
        pattern: /console\.log\('🚨 EMERGENCY[^']*'\);?\n/g,
        replacement: ''
      },
      {
        // Remove AUTH DEBUG logging
        pattern: /console\.log\('🔍 AUTH DEBUG[^']*'[^)]*\);?\n/g,
        replacement: ''
      }
    ]
  },
  {
    path: '../frontend/sams-ui/src/utils/userRoles.js',
    description: 'userRoles.js emergency checks',
    patterns: [
      {
        // Remove emergency override in isSuperAdmin
        pattern: /\/\/ EMERGENCY OVERRIDE[\s\S]*?if \(email === 'michael@landesman\.com'\) \{[\s\S]*?return true;[\s\S]*?\}[\s]*\/\/ Continue with existing logic\.\.\./,
        replacement: ''
      },
      {
        // Remove emergency console logs
        pattern: /console\.log\('🚨 EMERGENCY: SuperAdmin override[^']*'\);?\n/g,
        replacement: ''
      }
    ]
  },
  {
    path: '../frontend/sams-ui/src/layout/Sidebar.jsx',
    description: 'Sidebar.jsx debug logging',
    patterns: [
      {
        // Remove MENU DEBUG logging
        pattern: /console\.log\('🔍 MENU DEBUG[^']*'[^)]*\);?\n/g,
        replacement: ''
      },
      {
        // Remove SIDEBAR filtering logs
        pattern: /console\.log\('🔍 SIDEBAR:[^']*'[^)]*\);?\n/g,
        replacement: ''
      },
      {
        // Remove LIST MANAGEMENT ACCESS CHECK logs
        pattern: /console\.log\('🚨 LIST MANAGEMENT ACCESS CHECK:'[^)]*\);?\n/g,
        replacement: ''
      }
    ]
  }
];

// Backup directory
const BACKUP_DIR = './emergency-override-backups';

// Create backup of a file
async function backupFile(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  const fileName = path.basename(filePath);
  const backupPath = path.join(BACKUP_DIR, `${fileName}.backup-${Date.now()}`);
  
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  await fs.writeFile(backupPath, content);
  
  return backupPath;
}

// Clean a single file
async function cleanFile(fileConfig) {
  const filePath = path.resolve(__dirname, fileConfig.path);
  
  try {
    console.log(`\n📄 Processing ${fileConfig.description}...`);
    
    // Read file content
    let content = await fs.readFile(filePath, 'utf8');
    const originalContent = content;
    
    // Create backup
    const backupPath = await backupFile(filePath);
    console.log(`  ✅ Backup created: ${backupPath}`);
    
    // Apply patterns
    let changesCount = 0;
    
    for (const patternConfig of fileConfig.patterns) {
      if (patternConfig.start && patternConfig.end) {
        // Handle multi-line block removal
        const startMatch = content.match(patternConfig.start);
        if (startMatch) {
          const startIndex = startMatch.index;
          const afterStart = content.substring(startIndex);
          const endMatch = afterStart.match(patternConfig.end);
          
          if (endMatch) {
            const endIndex = startIndex + endMatch.index + endMatch[0].length;
            const before = content.substring(0, startIndex);
            const after = content.substring(endIndex);
            content = before + patternConfig.replacement + after;
            changesCount++;
            console.log(`  ✅ Removed emergency override block`);
          }
        }
      } else if (patternConfig.pattern) {
        // Handle single pattern replacement
        const matches = content.match(patternConfig.pattern);
        if (matches) {
          content = content.replace(patternConfig.pattern, patternConfig.replacement || '');
          changesCount += matches.length;
          console.log(`  ✅ Removed ${matches.length} emergency log statements`);
        }
      }
    }
    
    // Check if any changes were made
    if (content === originalContent) {
      console.log(`  ℹ️  No emergency overrides found`);
      return { file: fileConfig.path, changes: 0 };
    }
    
    // Write cleaned content
    await fs.writeFile(filePath, content);
    console.log(`  ✅ File cleaned successfully (${changesCount} changes)`);
    
    return { file: fileConfig.path, changes: changesCount };
    
  } catch (error) {
    console.error(`  ❌ Error processing file: ${error.message}`);
    return { file: fileConfig.path, error: error.message };
  }
}

// Main cleanup function
async function removeEmergencyOverrides() {
  console.log('🧹 Emergency Override Removal Tool\n');
  console.log('This will remove all emergency authentication overrides added for the UID mismatch issue.\n');
  
  const results = [];
  
  for (const fileConfig of filesToClean) {
    const result = await cleanFile(fileConfig);
    results.push(result);
  }
  
  // Summary
  console.log('\n📊 Cleanup Summary:\n');
  
  const successful = results.filter(r => !r.error);
  const failed = results.filter(r => r.error);
  const totalChanges = successful.reduce((sum, r) => sum + (r.changes || 0), 0);
  
  console.log(`  Files processed: ${results.length}`);
  console.log(`  Successful: ${successful.length}`);
  console.log(`  Failed: ${failed.length}`);
  console.log(`  Total changes: ${totalChanges}`);
  
  if (failed.length > 0) {
    console.log('\n❌ Failed files:');
    failed.forEach(f => {
      console.log(`  - ${f.file}: ${f.error}`);
    });
  }
  
  console.log(`\n✅ Cleanup complete! Backups saved to: ${BACKUP_DIR}\n`);
  
  // Git commands to run
  console.log('📝 Next steps:\n');
  console.log('1. Review the changes:');
  console.log('   git diff\n');
  console.log('2. Commit the cleanup:');
  console.log('   git add -A');
  console.log('   git commit -m "cleanup: Remove emergency authentication overrides\\n\\nNow using email-based document IDs, emergency overrides are no longer needed."');
  console.log('   git push origin main\n');
  console.log('3. If needed, restore from backups in:', BACKUP_DIR);
}

// Show usage
function showUsage() {
  console.log(`
Emergency Override Removal Script

Removes all emergency authentication overrides that were added to work around
the UID mismatch issue. These overrides are no longer needed after switching
to email-based document IDs.

Usage:
  node remove-emergency-overrides.js

What it removes:
  - Emergency SuperAdmin overrides in AuthContext.jsx
  - Emergency checks in userRoles.js  
  - Debug logging in Sidebar.jsx
  - Any related emergency patches

Backups:
  All modified files are backed up to ./emergency-override-backups/

Prerequisites:
  - Ensure users are migrated to email-based document IDs
  - Test that authentication works without overrides
  - Have git repository in clean state
`);
}

// Main execution
if (process.argv.includes('--help')) {
  showUsage();
} else {
  removeEmergencyOverrides().catch(console.error);
}