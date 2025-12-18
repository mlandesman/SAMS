/**
 * environment-config.js
 * Centralized environment configuration for SAMS import scripts
 * Supports dev, prod, and staging environments
 */

import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment configuration mapping
const ENVIRONMENTS = {
  dev: {
    projectId: 'sandyland-management-system',
    serviceAccountPath: 'functions/serviceAccountKey-dev.json',
    altServiceAccountPath: 'backend/serviceAccountKey.json',  // Fallback
    name: 'Development',
    color: '\x1b[33m' // Yellow
  },
  staging: {
    projectId: 'sams-staging-6cdcd',
    serviceAccountPath: 'functions/serviceAccountKey-staging.json',
    name: 'Staging',
    color: '\x1b[36m' // Cyan
  },
  prod: {
    projectId: 'sams-sandyland-prod',
    serviceAccountPath: 'functions/serviceAccountKey-prod.json',
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
 * Supports both service account keys and Application Default Credentials (ADC)
 * @param {string} env - Environment name (optional)
 * @param {Object} options - Options { useADC: boolean }
 * @returns {Object} - Initialized Firebase Admin instance
 */
async function initializeFirebase(env = null, options = {}) {
  const config = getEnvironmentConfig(env);
  const useADC = options.useADC || process.env.USE_ADC === 'true';
  
  // Check if already initialized
  if (admin.apps.length > 0) {
    console.log(`Firebase already initialized for ${config.name}`);
    return { db: admin.firestore(), admin };
  }
  
  // Option 1: Use Application Default Credentials (from gcloud auth)
  if (useADC) {
    try {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: config.projectId
      });
      
      const db = admin.firestore();
      
      console.log(`${config.color}✅ Firebase initialized for ${config.name} (${config.projectId})\x1b[0m`);
      console.log(`${config.color}📁 Using Application Default Credentials (gcloud auth)\x1b[0m`);
      
      return { db, admin };
    } catch (adcError) {
      console.error('❌ Application Default Credentials failed:', adcError.message);
      console.error('💡 Run: gcloud auth application-default login');
      throw adcError;
    }
  }
  
  // Option 2: Use service account key file
  const possiblePaths = [
    path.join(process.cwd(), config.serviceAccountPath),
    path.join(__dirname, '../..', config.serviceAccountPath),
    path.join(__dirname, '../../..', config.serviceAccountPath),
    path.join(process.cwd(), '..', config.serviceAccountPath),
    // Also try backend folder as fallback
    path.join(process.cwd(), 'backend/serviceAccountKey.json'),
    path.join(process.cwd(), 'functions/serviceAccountKey.json')
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
  console.log(`\n${config.color}⚠️  You are about to run this script in PRODUCTION!${resetColor}`);
  console.log(`${config.color}⚠️  This will affect live data.${resetColor}`);
  
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    readline.question('\nType "PRODUCTION" to confirm, or anything else to cancel: ', (answer) => {
      readline.close();
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