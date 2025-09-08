/**
 * environment-config.js
 * Centralized environment configuration for SAMS import scripts
 * Supports dev, prod, and staging environments
 */

import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment configuration mapping
const ENVIRONMENTS = {
  dev: {
    projectId: 'sandyland-management-system',
    serviceAccountPath: 'backend/serviceAccountKey.json',
    name: 'Development',
    color: '\x1b[33m' // Yellow
  },
  staging: {
    projectId: 'sams-staging-6cdcd',
    serviceAccountPath: 'backend/serviceAccountKey-staging.json',
    name: 'Staging',
    color: '\x1b[36m' // Cyan
  },
  prod: {
    projectId: 'sams-sandyland-prod',
    serviceAccountPath: 'backend/sams-production-serviceAccountKey.json',
    name: 'Production',
    color: '\x1b[31m' // Red
  }
};

// Default to dev if not specified
const DEFAULT_ENV = 'dev';

/**
 * Gets the current environment from process.env
 * @returns {string} - Current environment (dev, prod, or staging)
 */
function getCurrentEnvironment() {
  const env = process.env.FIRESTORE_ENV || process.env.NODE_ENV || DEFAULT_ENV;
  return ENVIRONMENTS[env] ? env : DEFAULT_ENV;
}

/**
 * Gets environment configuration
 * @param {string} env - Environment name (optional)
 * @returns {Object} - Environment configuration
 */
function getEnvironmentConfig(env = null) {
  const environment = env || getCurrentEnvironment();
  const config = ENVIRONMENTS[environment];
  
  if (!config) {
    throw new Error(`Invalid environment: ${environment}`);
  }
  
  return config;
}

/**
 * Initializes Firebase Admin SDK for the specified environment
 * @param {string} env - Environment name (optional)
 * @returns {Object} - Initialized Firebase Admin instance
 */
async function initializeFirebase(env = null) {
  const config = getEnvironmentConfig(env);
  
  // Check if already initialized
  if (admin.apps.length > 0) {
    console.log(`Firebase already initialized for ${config.name}`);
    return { db: admin.firestore(), admin };
  }
  
  // Try multiple paths to find service account file
  const possiblePaths = [
    path.join(__dirname, '../..', config.serviceAccountPath),
    path.join(__dirname, '../../..', config.serviceAccountPath),
    path.join(process.cwd(), config.serviceAccountPath),
    path.join(process.cwd(), '..', config.serviceAccountPath)
  ];
  
  let serviceAccount = null;
  let foundPath = null;
  
  for (const tryPath of possiblePaths) {
    if (fs.existsSync(tryPath)) {
      serviceAccount = JSON.parse(fs.readFileSync(tryPath, 'utf8'));
      foundPath = tryPath;
      break;
    }
  }
  
  if (!serviceAccount) {
    console.error('Tried the following paths:');
    possiblePaths.forEach(p => console.error(`  - ${p}`));
    throw new Error(`Service account file not found: ${config.serviceAccountPath}`);
  }
  
  // Initialize Firebase
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: config.projectId
  });
  
  const db = admin.firestore();
  
  console.log(`${config.color}✅ Firebase initialized for ${config.name} (${config.projectId})\x1b[0m`);
  console.log(`${config.color}📁 Using service account: ${path.basename(foundPath)}\x1b[0m`);
  
  return { db, admin };
}

/**
 * Prints environment information
 * @param {string} env - Environment name (optional)
 */
function printEnvironmentInfo(env = null) {
  const config = getEnvironmentConfig(env);
  const resetColor = '\x1b[0m';
  
  console.log(`\n${config.color}${'='.repeat(50)}${resetColor}`);
  console.log(`${config.color}🔥 ENVIRONMENT: ${config.name.toUpperCase()}${resetColor}`);
  console.log(`${config.color}📁 Project ID: ${config.projectId}${resetColor}`);
  console.log(`${config.color}${'='.repeat(50)}${resetColor}\n`);
  
  if (config.name === 'Production') {
    console.log(`${config.color}⚠️  WARNING: You are about to modify PRODUCTION data!${resetColor}`);
    console.log(`${config.color}⚠️  Please double-check your actions!${resetColor}\n`);
  }
}

/**
 * Confirms environment selection with user
 * @param {string} env - Environment name
 * @returns {Promise<boolean>} - User confirmation
 */
async function confirmEnvironment(env) {
  const config = getEnvironmentConfig(env);
  
  if (config.name !== 'Production') {
    return true;
  }
  
  // For production, require explicit confirmation
  const resetColor = '\x1b[0m';
  console.log(`\n${config.color}⚠️  You are about to run this script in PRODUCTION!${resetColor}`);
  console.log(`${config.color}⚠️  This will affect live data.${resetColor}`);
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('\nType "PRODUCTION" to confirm, or anything else to cancel: ', (answer) => {
      rl.close();
      resolve(answer === 'PRODUCTION');
    });
  });
}

// Export functions
export {
  getCurrentEnvironment,
  getEnvironmentConfig,
  initializeFirebase,
  printEnvironmentInfo,
  confirmEnvironment,
  ENVIRONMENTS
};