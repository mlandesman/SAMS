#!/usr/bin/env node

/**
 * Debug Units Import Run
 */

import { spawn } from 'child_process';

const scriptPath = './import-units-enhanced.js';
const args = ['MTC'];

console.log('Running units import with args:', args);

const child = spawn('node', [scriptPath, ...args], {
  env: { ...process.env, FIRESTORE_ENV: 'dev' },
  cwd: process.cwd(),
  stdio: 'inherit'  // This will show all output
});

child.on('error', (error) => {
  console.error('Failed to start process:', error);
});

child.on('exit', (code) => {
  console.log('Process exited with code:', code);
  process.exit(code);
});