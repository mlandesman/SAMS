#!/usr/bin/env node
/**
 * scripts/finalizeChangelog.js
 * 
 * Finalize the "pending" changelog entry by replacing with actual version.
 * Called by deploySams.sh after version bump.
 * 
 * Usage:
 *   node scripts/finalizeChangelog.js --version 1.9.4
 *   node scripts/finalizeChangelog.js --version 1.9.4 --date 2026-01-28
 * 
 * Options:
 *   --version  The version number to apply (required)
 *   --date     Release date in YYYY-MM-DD format (defaults to today)
 *   --dry-run  Show what would be changed without writing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const CHANGELOG_PATH = path.join(rootDir, 'frontend/sams-ui/public/changelog.json');
const PENDING_VERSION = 'pending';

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    version: null,
    date: null,
    dryRun: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--version':
        result.version = args[++i];
        break;
      case '--date':
        result.date = args[++i];
        break;
      case '--dry-run':
        result.dryRun = true;
        break;
    }
  }

  // Default date to today
  if (!result.date) {
    const today = new Date();
    result.date = today.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  return result;
}

/**
 * Validate arguments
 */
function validateArgs(args) {
  if (!args.version) {
    console.error('Error: --version is required');
    console.error('Usage: node scripts/finalizeChangelog.js --version 1.9.4');
    process.exit(1);
  }
  
  // Basic version format check
  if (!/^\d+\.\d+\.\d+$/.test(args.version)) {
    console.error(`Error: Invalid version format "${args.version}"`);
    console.error('Expected format: X.Y.Z (e.g., 1.9.4)');
    process.exit(1);
  }
  
  // Basic date format check
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
    console.error(`Error: Invalid date format "${args.date}"`);
    console.error('Expected format: YYYY-MM-DD (e.g., 2026-01-28)');
    process.exit(1);
  }
}

/**
 * Read changelog file
 */
function readChangelog() {
  if (!fs.existsSync(CHANGELOG_PATH)) {
    console.error('Error: Changelog file not found');
    console.error('Path:', CHANGELOG_PATH);
    process.exit(1);
  }
  
  const content = fs.readFileSync(CHANGELOG_PATH, 'utf8');
  return JSON.parse(content);
}

/**
 * Write changelog file
 */
function writeChangelog(data) {
  fs.writeFileSync(CHANGELOG_PATH, JSON.stringify(data, null, 2));
}

/**
 * Finalize pending version
 */
function finalizePending(changelog, version, date) {
  if (changelog.releases.length === 0) {
    return { success: false, reason: 'No releases found in changelog' };
  }
  
  const topRelease = changelog.releases[0];
  
  if (topRelease.version !== PENDING_VERSION) {
    return { 
      success: false, 
      reason: `Top release is "${topRelease.version}", not "pending"`,
      hint: 'No pending changes to finalize. This is OK if no changes were added since last deploy.'
    };
  }
  
  // Check if version already exists elsewhere in changelog
  const existingVersion = changelog.releases.find(r => r.version === version);
  if (existingVersion && existingVersion !== topRelease) {
    return {
      success: false,
      reason: `Version ${version} already exists in changelog`,
      hint: 'Use a different version number'
    };
  }
  
  // Finalize
  const changeCount = topRelease.changes.length;
  topRelease.version = version;
  topRelease.date = date;
  
  return { 
    success: true, 
    version, 
    date, 
    changeCount 
  };
}

/**
 * Main function
 */
function main() {
  const args = parseArgs();
  validateArgs(args);
  
  console.log('\n📋 Finalizing Changelog');
  console.log(`   Version: ${args.version}`);
  console.log(`   Date: ${args.date}`);
  
  const changelog = readChangelog();
  
  if (args.dryRun) {
    console.log('\n🔍 Dry run mode');
    
    if (changelog.releases.length > 0 && changelog.releases[0].version === PENDING_VERSION) {
      console.log(`   Would finalize ${changelog.releases[0].changes.length} pending changes`);
      console.log('   Changes:');
      for (const change of changelog.releases[0].changes) {
        const issues = change.issues?.length > 0 ? ` (${change.issues.map(i => `#${i}`).join(', ')})` : '';
        console.log(`     [${change.type}] ${change.text}${issues}`);
      }
    } else {
      console.log('   No pending version found');
    }
    return;
  }
  
  const result = finalizePending(changelog, args.version, args.date);
  
  if (!result.success) {
    console.log(`\n⚠️  ${result.reason}`);
    if (result.hint) {
      console.log(`   ${result.hint}`);
    }
    // Exit with 0 - this is not an error, just nothing to do
    return;
  }
  
  writeChangelog(changelog);
  
  console.log(`\n✅ Finalized changelog for v${result.version}`);
  console.log(`   Date: ${result.date}`);
  console.log(`   Changes: ${result.changeCount}`);
  console.log(`   File: ${CHANGELOG_PATH}`);
}

main();
