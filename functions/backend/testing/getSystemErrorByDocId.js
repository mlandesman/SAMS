#!/usr/bin/env node
/**
 * Fetch a system error by docID from Firestore (dev) via the error-reporting API.
 * Uses the test harness API client (SuperAdmin token required for GET /error-reporting).
 * Run from repo root or functions/backend:
 *   node functions/backend/testing/getSystemErrorByDocId.js <docID>
 *   node testing/getSystemErrorByDocId.js <docID>   (if cwd is functions/backend)
 *
 * Requires: Backend running (e.g. localhost:5001) and default test user to be SuperAdmin.
 */

import { createApiClient } from './apiClient.js';
import { testConfig } from './config.js';

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

function printError(docID, record) {
  const ts = formatTimestamp(record.timestamp);
  const msg = record.message ?? '—';
  const details = record.details ?? '—';
  const url = record.url ?? '—';
  const level = record.level ?? '—';
  const source = record.source ?? '—';
  const module = record.module ?? '—';
  const ack = record.acknowledged
    ? `Yes (by ${record.acknowledgedBy ?? '?'} at ${formatTimestamp(record.acknowledgedAt)})`
    : 'No';
  const version = record.version ?? '—';
  const env = record.environment ?? '—';
  const userAgent = record.userAgent ?? '—';

  console.log('---');
  console.log('System Error (Firestore dev)');
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
  if (userAgent) {
    console.log('User-Agent:', userAgent);
    console.log('---');
  }
}

async function main() {
  const docID = process.argv[2];
  if (!docID) {
    console.error('Usage: node getSystemErrorByDocId.js <docID>');
    console.error('Example: node getSystemErrorByDocId.js ixwUHt2sS8SfSk8TubSy');
    process.exit(1);
  }

  try {
    const api = await createApiClient();
    const limit = 500;
    const response = await api.get(`/error-reporting?all=true&limit=${limit}`);
    const { errors } = response.data;
    const record = Array.isArray(errors) ? errors.find((e) => e.id === docID) : null;

    if (!record) {
      console.error(`No system error found for docID: ${docID}`);
      console.error(`Fetched ${errors?.length ?? 0} errors from dev Firestore.`);
      process.exit(4);
    }

    printError(docID, record);
  } catch (err) {
    if (err.response?.status === 403) {
      console.error('403: GET /error-reporting requires SuperAdmin. Use a test user that is SuperAdmin.');
    } else if (err.response?.data?.error) {
      console.error('API Error:', err.response.data.error);
    } else if (err.code === 'ECONNREFUSED') {
      console.error('Backend not reachable. Start the backend (e.g. on localhost:5001) and try again.');
    } else {
      console.error(err.message || err);
    }
    process.exit(3);
  }
}

main();
