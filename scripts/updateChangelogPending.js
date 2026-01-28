#!/usr/bin/env node
/**
 * scripts/updateChangelogPending.js
 * 
 * Add a changelog entry to the "pending" version in changelog.json.
 * If no pending version exists, creates one.
 * 
 * Usage:
 *   node scripts/updateChangelogPending.js --type feat --text "Added new feature"
 *   node scripts/updateChangelogPending.js --type fix --issues "115,60" --text "Fixed bugs"
 *   node scripts/updateChangelogPending.js --type feat --issues "158" --text "Changelog feature"
 * 
 * Options:
 *   --type     Change type: feat, fix, maint, perf, other (required)
 *   --issues   Comma-separated issue numbers (optional)
 *   --text     Description of the change (required)
 *   --dry-run  Show what would be added without writing
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
    type: null,
    issues: [],
    text: null,
    dryRun: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--type':
        result.type = args[++i];
        break;
      case '--issues':
        result.issues = args[++i].split(',').map(s => s.trim()).filter(Boolean);
        break;
      case '--text':
        result.text = args[++i];
        break;
      case '--dry-run':
        result.dryRun = true;
        break;
    }
  }

  return result;
}

/**
 * Validate arguments
 */
function validateArgs(args) {
  const validTypes = ['feat', 'fix', 'maint', 'perf', 'other'];
  
  if (!args.type) {
    console.error('Error: --type is required');
    console.error('Valid types:', validTypes.join(', '));
    process.exit(1);
  }
  
  if (!validTypes.includes(args.type)) {
    console.error(`Error: Invalid type "${args.type}"`);
    console.error('Valid types:', validTypes.join(', '));
    process.exit(1);
  }
  
  if (!args.text) {
    console.error('Error: --text is required');
    process.exit(1);
  }
}

/**
 * Read changelog file
 */
function readChangelog() {
  if (!fs.existsSync(CHANGELOG_PATH)) {
    console.log('Changelog file not found, creating new one');
    return { releases: [] };
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
 * Add entry to pending version
 */
function addPendingEntry(changelog, entry) {
  // Check if top entry is pending
  if (changelog.releases.length > 0 && changelog.releases[0].version === PENDING_VERSION) {
    // Add to existing pending version
    changelog.releases[0].changes.push(entry);
    return { action: 'added', version: PENDING_VERSION, isNew: false };
  }
  
  // Create new pending version
  const pendingRelease = {
    version: PENDING_VERSION,
    date: null,
    changes: [entry]
  };
  
  changelog.releases.unshift(pendingRelease);
  return { action: 'created', version: PENDING_VERSION, isNew: true };
}

/**
 * Main function
 */
function main() {
  const args = parseArgs();
  validateArgs(args);
  
  const entry = {
    type: args.type,
    issues: args.issues,
    text: args.text
  };
  
  console.log('\n📝 Changelog Entry:');
  console.log(`   Type: ${entry.type}`);
  console.log(`   Issues: ${entry.issues.length > 0 ? entry.issues.map(i => `#${i}`).join(', ') : '(none)'}`);
  console.log(`   Text: ${entry.text}`);
  
  if (args.dryRun) {
    console.log('\n🔍 Dry run - no changes written');
    return;
  }
  
  const changelog = readChangelog();
  const result = addPendingEntry(changelog, entry);
  writeChangelog(changelog);
  
  if (result.isNew) {
    console.log('\n✅ Created new "pending" version with entry');
  } else {
    console.log(`\n✅ Added entry to existing "pending" version (${changelog.releases[0].changes.length} total changes)`);
  }
  
  console.log(`   File: ${CHANGELOG_PATH}`);
}

main();
