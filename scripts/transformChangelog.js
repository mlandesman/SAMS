#!/usr/bin/env node
/**
 * Transform raw changelog.seed.json into curated changelog.json
 * 
 * Usage: node scripts/transformChangelog.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const INPUT_FILE = path.join(rootDir, 'public/changelog.seed.json');
const OUTPUT_FILE = path.join(rootDir, 'frontend/sams-ui/public/changelog.json');

// Patterns to skip entirely
const SKIP_PATTERNS = [
  /^Merge /i,                     // Merge commits
  /^chore: bump version/i,        // Version bumps (already captured in bumpCommit)
  /^chore: cleanup/i,             // Cleanup chores
  /^chore: remove debug/i,        // Debug removal
  /^chore: update version files/i,
  /^docs:/i,                      // Documentation changes
  /^revert:/i,                    // Reverts (usually followed by proper fix)
  /^Add logging/i,                // Debug logging
  /^Add debug logging/i,
  /^Add detailed.*logging/i,
  /^Add error handling and logging/i,
];

// Pattern to extract type prefix
const TYPE_PATTERNS = [
  /^(feat|fix|enhancement|refactor|perf|chore|docs|revert|test)\s*\([^)]+\):\s*/i,
  /^(feat|fix|enhancement|refactor|perf|chore|docs|revert|test):\s*/i,
];

// Task reference patterns to strip
const TASK_PATTERNS = [
  /\s*\(Tasks?\s*[\d#-]+\)\s*/gi,  // (Task 1-2), (Tasks 1-2), (Task 3), (Task #137)
  /\s*-\s*Phase\s*\d+[A-Z]?\s*(foundation)?/gi, // - Phase 1B foundation
];

/**
 * Check if commit should be skipped
 */
function shouldSkip(message) {
  return SKIP_PATTERNS.some(pattern => pattern.test(message));
}

/**
 * Extract issue numbers from commit message
 * Returns { primary, all } where primary is the first issue found
 */
function extractIssues(message) {
  const issues = [];
  const seen = new Set();
  
  // Find all issue references with their positions
  const patterns = [
    /Issue #(\d+)/gi,
    /issue-(\d+)/gi,
    /#(\d+)/g,
  ];
  
  const matches = [];
  for (const pattern of patterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(message)) !== null) {
      if (match[1] && !seen.has(match[1])) {
        seen.add(match[1]);
        matches.push({ issue: match[1], index: match.index });
      }
    }
  }
  
  // Sort by position in message to get primary (first) issue
  matches.sort((a, b) => a.index - b.index);
  
  return {
    primary: matches.length > 0 ? matches[0].issue : null,
    all: matches.map(m => m.issue).sort((a, b) => Number(a) - Number(b))
  };
}

/**
 * Extract type from commit message
 */
function extractType(message) {
  for (const pattern of TYPE_PATTERNS) {
    const match = message.match(pattern);
    if (match) {
      const type = match[1].toLowerCase();
      switch (type) {
        case 'feat':
          return 'feat';
        case 'fix':
          return 'fix';
        case 'enhancement':
          return 'feat'; // Treat enhancement as feature
        case 'refactor':
          return 'maint';
        case 'perf':
          return 'perf';
        case 'chore':
          return 'maint';
        default:
          return 'other';
      }
    }
  }
  return 'other';
}

/**
 * Clean commit message text
 */
function cleanText(message) {
  let text = message;
  
  // Remove type prefixes
  for (const pattern of TYPE_PATTERNS) {
    text = text.replace(pattern, '');
  }
  
  // Remove task references FIRST (before issue stripping breaks them)
  text = text.replace(/\s*\(Task #\d+\)\s*/gi, '');  // (Task #137)
  for (const pattern of TASK_PATTERNS) {
    text = text.replace(pattern, '');
  }
  
  // Remove issue references from text
  text = text.replace(/\(Issue #\d+\)/gi, '');
  text = text.replace(/\(#\d+(?:,\s*#?\d+)*\)/gi, '');
  text = text.replace(/\(issue-\d+\)/gi, '');
  text = text.replace(/#(\d+)\)$/gi, ')');
  text = text.replace(/\s*\(#\d+\)\s*$/gi, '');
  
  // Clean up trailing parentheses that are now empty
  text = text.replace(/\s*\(\s*\)\s*/g, '');
  
  // Clean up whitespace
  text = text.trim();
  
  // Capitalize first letter
  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }
  
  // Remove trailing periods if present
  text = text.replace(/\.$/, '');
  
  return text;
}

/**
 * Process commits for a version, grouping by issue
 */
function processCommits(commits) {
  const issueGroups = new Map(); // primaryIssue -> { type, allIssues, messages }
  const noIssueCommits = [];
  
  for (const commit of commits) {
    const message = commit.message;
    
    // Skip non-user-facing commits
    if (shouldSkip(message)) {
      continue;
    }
    
    const { primary: primaryIssue, all: allIssues } = extractIssues(message);
    const type = extractType(message);
    const text = cleanText(message);
    
    // Skip if text is empty after cleaning
    if (!text) {
      continue;
    }
    
    if (primaryIssue) {
      // Group by primary (first) issue found in message
      if (!issueGroups.has(primaryIssue)) {
        issueGroups.set(primaryIssue, { 
          type, 
          allIssues: new Set(allIssues),
          messages: [],
          firstCommitDate: commit.date
        });
      }
      const group = issueGroups.get(primaryIssue);
      group.messages.push(text);
      // Add any additional issues
      allIssues.forEach(i => group.allIssues.add(i));
      // Use the most "major" type (feat > fix > other)
      if (type === 'feat' || (type === 'fix' && group.type !== 'feat')) {
        group.type = type;
      }
    } else {
      noIssueCommits.push({ type, text, date: commit.date });
    }
  }
  
  const changes = [];
  
  // Process issue groups - create summarized entries
  for (const [, group] of issueGroups) {
    // For multiple commits with same issue, use the most descriptive message
    // Usually the first or most complete one
    let bestText = group.messages[0];
    
    // If there are multiple messages, try to find the most descriptive one
    if (group.messages.length > 1) {
      // Prefer messages that don't start with "Add" if there's a more complete description
      const descriptive = group.messages.find(m => 
        !m.startsWith('Add ') && m.length > 20
      );
      if (descriptive) {
        bestText = descriptive;
      } else {
        // Otherwise use the longest message
        bestText = group.messages.reduce((a, b) => a.length > b.length ? a : b);
      }
    }
    
    changes.push({
      type: group.type,
      issues: Array.from(group.allIssues).sort((a, b) => Number(a) - Number(b)),
      text: bestText
    });
  }
  
  // Process no-issue commits
  for (const commit of noIssueCommits) {
    // Skip very short or generic messages
    if (commit.text.length < 10) continue;
    
    changes.push({
      type: commit.type,
      issues: [],
      text: commit.text
    });
  }
  
  // Sort by type (feat first, then fix, then other)
  const typeOrder = { feat: 0, fix: 1, perf: 2, maint: 3, other: 4 };
  changes.sort((a, b) => (typeOrder[a.type] ?? 5) - (typeOrder[b.type] ?? 5));
  
  return changes;
}

/**
 * Main transformation function
 */
function transformChangelog() {
  console.log('Reading seed file:', INPUT_FILE);
  const seedData = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  
  console.log(`Processing ${seedData.length} versions...`);
  
  const releases = [];
  let totalChanges = 0;
  const skippedVersions = [];
  
  for (const version of seedData) {
    const changes = processCommits(version.commits || []);
    
    if (changes.length === 0) {
      skippedVersions.push({
        version: version.version,
        reason: 'No user-facing changes'
      });
      continue;
    }
    
    releases.push({
      version: version.version,
      date: version.releasedAt,
      changes
    });
    
    totalChanges += changes.length;
  }
  
  const output = { releases };
  
  // Write output
  console.log('Writing output to:', OUTPUT_FILE);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  
  // Report
  console.log('\n=== Transformation Complete ===');
  console.log(`Versions processed: ${releases.length}`);
  console.log(`Versions skipped: ${skippedVersions.length}`);
  console.log(`Total change entries: ${totalChanges}`);
  
  if (skippedVersions.length > 0) {
    console.log('\nSkipped versions:');
    for (const v of skippedVersions) {
      console.log(`  - ${v.version}: ${v.reason}`);
    }
  }
  
  console.log('\nOutput written to:', OUTPUT_FILE);
  
  return { releases, skippedVersions, totalChanges };
}

// Run
transformChangelog();
