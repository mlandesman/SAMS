#!/usr/bin/env node

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const changelogPath = resolve(__dirname, '../frontend/sams-ui/public/changelog.json');

const typeLabels = {
  feat: '✨ Feature',
  fix: '🐛 Fix',
  enhancement: '⬆️  Enhancement',
  perf: '⚡ Performance',
  maint: '🔧 Maintenance',
  other: '📝 Other',
};

const typeOrder = ['feat', 'enhancement', 'fix', 'perf', 'maint', 'other'];

try {
  const changelog = JSON.parse(readFileSync(changelogPath, 'utf-8'));
  const pending = changelog.releases.filter(
    (r) => r.version === 'pending' || r.date === null
  );

  if (pending.length === 0) {
    console.log('\n  No pending changes — everything has been deployed.\n');
    process.exit(0);
  }

  const allChanges = pending.flatMap((r) => r.changes);

  const grouped = {};
  for (const change of allChanges) {
    const type = change.type || 'other';
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(change);
  }

  const bar = '═'.repeat(60);
  console.log(`\n╔${bar}╗`);
  console.log(`║  SAMS — Pending Deployment Summary${' '.repeat(25)}║`);
  console.log(`╚${bar}╝\n`);

  let total = 0;
  const issueSet = new Set();

  for (const type of typeOrder) {
    const items = grouped[type];
    if (!items || items.length === 0) continue;

    const label = typeLabels[type] || type;
    console.log(`  ${label} (${items.length})`);
    console.log(`  ${'─'.repeat(50)}`);

    for (const item of items) {
      const issues =
        item.issues && item.issues.length > 0
          ? ` [${item.issues.map((i) => `#${i}`).join(', ')}]`
          : '';
      item.issues?.forEach((i) => issueSet.add(i));
      console.log(`    • ${item.text}${issues}`);
      total++;
    }
    console.log();
  }

  console.log(`  ${'─'.repeat(50)}`);
  console.log(`  Total changes: ${total}`);
  if (issueSet.size > 0) {
    const sorted = [...issueSet].sort((a, b) => Number(a) - Number(b));
    console.log(`  Issues addressed: ${sorted.map((i) => `#${i}`).join(', ')}`);
  }
  console.log();
} catch (err) {
  console.error(`Error reading changelog: ${err.message}`);
  process.exit(1);
}
