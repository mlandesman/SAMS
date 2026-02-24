#!/usr/bin/env node
/**
 * Show a system error by docID from the local systemErrors store.
 * For use by humans and agents when investigating captured frontend/backend errors.
 *
 * Usage:
 *   node scripts/show-system-error.js <docID>
 *   node scripts/show-system-error.js <docID> [path-to-systemErrors.json]
 *
 * Default path: test-results/systemErrors.json
 * (Keys in the JSON file are docIDs; values are the error documents.)
 *
 * Production: Errors are also stored in Firestore collection `systemErrors`.
 * Use the same docID in Firebase Console or via the error-reporting API.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const defaultPath = path.join(projectRoot, 'test-results', 'systemErrors.json');

function formatTimestamp(ts) {
  if (!ts) return '—';
  if (typeof ts === 'string') return ts;
  const sec = ts._seconds ?? ts.seconds;
  if (sec == null) return JSON.stringify(ts);
  const d = new Date(sec * 1000);
  const ns = ts._nanoseconds ?? ts.nanoseconds ?? 0;
  if (ns) d.setMilliseconds(Math.round(ns / 1e6));
  return d.toISOString();
}

function main() {
  const docID = process.argv[2];
  const filePath = process.argv[3] ? path.resolve(process.cwd(), process.argv[3]) : defaultPath;

  if (!docID) {
    console.error('Usage: node scripts/show-system-error.js <docID> [path-to-systemErrors.json]');
    console.error('Example: node scripts/show-system-error.js v0Bul2WYmTtwOzPBn9Dq');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    console.error('Default is test-results/systemErrors.json. Pass a path as second argument if needed.');
    process.exit(2);
  }

  let data;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    data = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read or parse JSON:', e.message);
    process.exit(3);
  }

  const record = typeof data === 'object' && data !== null && docID in data
    ? data[docID]
    : Array.isArray(data)
      ? data.find((r) => r._id === docID || r.id === docID)
      : null;

  if (!record) {
    console.error(`No system error found for docID: ${docID}`);
    console.error(`Checked: ${filePath}`);
    process.exit(4);
  }

  const ts = formatTimestamp(record.timestamp);
  const msg = record.message ?? '—';
  const details = record.details ?? '—';
  const url = record.url ?? '—';
  const level = record.level ?? '—';
  const source = record.source ?? '—';
  const module = record.module ?? '—';
  const ack = record.acknowledged ? `Yes (by ${record.acknowledgedBy ?? '?'} at ${formatTimestamp(record.acknowledgedAt)})` : 'No';
  const version = record.version ?? '—';
  const env = record.environment ?? '—';
  const userAgent = record.userAgent ?? '—';

  console.log('---');
  console.log('System Error');
  console.log('docID:', docID);
  console.log('---');
  console.log('Message:', msg);
  console.log('Level:  ', level);
  console.log('Source: ', source);
  console.log('Module: ', module);
  console.log('URL:    ', url);
  console.log('Time:   ', ts);
  console.log('Acked:  ', ack);
  console.log('Version:', version);
  console.log('Env:    ', env);
  console.log('---');
  console.log('Details (stack / payload):');
  console.log(details);
  console.log('---');
  if (userAgent !== '—') {
    console.log('User-Agent:', userAgent);
    console.log('---');
  }
}

main();
