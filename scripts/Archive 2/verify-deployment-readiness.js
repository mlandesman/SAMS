#!/usr/bin/env node

/**
 * Deployment Readiness Verification Script
 * 
 * Purpose: Verifies all prerequisites are met before starting production deployment
 * Run this BEFORE beginning the deployment process
 * 
 * Usage: node scripts/verify-deployment-readiness.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const checks = {
  passed: [],
  warnings: [],
  failed: []
};

// Check if file exists
function checkFile(filePath, description, required = true) {
  const exists = fs.existsSync(filePath);
  const status = exists ? '✅' : required ? '❌' : '⚠️';
  
  console.log(`${status} ${description}`);
  console.log(`   Path: ${filePath}`);
  
  if (exists) {
    checks.passed.push(description);
  } else if (required) {
    checks.failed.push(`${description} - Missing required file`);
  } else {
    checks.warnings.push(`${description} - File not found (may need configuration)`);
  }
  
  return exists;
}

// Check if command exists
function checkCommand(command, description) {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    console.log(`✅ ${description}`);
    checks.passed.push(description);
    return true;
  } catch (error) {
    console.log(`❌ ${description} - Command not found`);
    checks.failed.push(`${description} - Required command missing`);
    return false;
  }
}

// Check Node modules
function checkNodeModules() {
  const packageJsonPath = path.join(__dirname, '../package.json');
  const nodeModulesPath = path.join(__dirname, '../node_modules');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.log('❌ package.json not found');
    checks.failed.push('package.json missing');
    return false;
  }
  
  if (!fs.existsSync(nodeModulesPath)) {
    console.log('❌ node_modules not found - run npm install');
    checks.failed.push('Dependencies not installed');
    return false;
  }
  
  // Check specific required modules
  const requiredModules = ['firebase-admin', 'dotenv'];
  let allModulesPresent = true;
  
  requiredModules.forEach(module => {
    const modulePath = path.join(nodeModulesPath, module);
    if (!fs.existsSync(modulePath)) {
      console.log(`❌ Missing required module: ${module}`);
      checks.failed.push(`Missing module: ${module}`);
      allModulesPresent = false;
    }
  });
  
  if (allModulesPresent) {
    console.log('✅ All required Node modules installed');
    checks.passed.push('Node dependencies');
  }
  
  return allModulesPresent;
}

// Check scripts exist
function checkScripts() {
  console.log('\n📜 Checking deployment scripts...\n');
  
  const scripts = [
    'backup-production-exchangerates.js',
    'backup-production-complete.js',
    'export-dev-to-production.js',
    'migrate-firebase-auth-users.js',
    'import-to-production.js'
  ];
  
  let allScriptsExist = true;
  
  scripts.forEach(script => {
    const scriptPath = path.join(__dirname, script);
    if (!checkFile(scriptPath, `Deployment script: ${script}`)) {
      allScriptsExist = false;
    }
  });
  
  return allScriptsExist;
}

// Check Firebase configuration
function checkFirebaseConfig() {
  console.log('\n🔥 Checking Firebase configuration...\n');
  
  // Check for various possible service account key locations
  const possibleDevKeys = [
    path.join(__dirname, '../firebase-adminsdk.json'),
    path.join(__dirname, '../serviceAccountKey.json'),
    path.join(__dirname, '../firebase-admin-key.json')
  ];
  
  const possibleProdKeys = [
    path.join(__dirname, '../firebase-keys/sams-production-firebase-adminsdk.json'),
    path.join(__dirname, '../serviceAccountKey-prod.json'),
    path.join(__dirname, '../firebase-keys/production-key.json')
  ];
  
  let devKeyFound = false;
  let prodKeyFound = false;
  
  console.log('Development service account key:');
  possibleDevKeys.forEach(keyPath => {
    if (fs.existsSync(keyPath)) {
      console.log(`✅ Found at: ${keyPath}`);
      devKeyFound = true;
    }
  });
  
  if (!devKeyFound) {
    console.log('❌ No development service account key found');
    console.log('   Expected locations:');
    possibleDevKeys.forEach(p => console.log(`   - ${p}`));
    checks.failed.push('Development Firebase service account key');
  } else {
    checks.passed.push('Development Firebase configuration');
  }
  
  console.log('\nProduction service account key:');
  possibleProdKeys.forEach(keyPath => {
    if (fs.existsSync(keyPath)) {
      console.log(`✅ Found at: ${keyPath}`);
      prodKeyFound = true;
    }
  });
  
  if (!prodKeyFound) {
    console.log('⚠️  No production service account key found in expected locations');
    console.log('   Expected locations:');
    possibleProdKeys.forEach(p => console.log(`   - ${p}`));
    checks.warnings.push('Production Firebase service account key - verify script paths');
  } else {
    checks.passed.push('Production Firebase configuration');
  }
  
  return devKeyFound;
}

// Check directories
function checkDirectories() {
  console.log('\n📁 Checking required directories...\n');
  
  const dirs = [
    { path: path.join(__dirname, '../backups'), name: 'Backups directory' },
    { path: path.join(__dirname, '../exports'), name: 'Exports directory' },
    { path: path.join(__dirname, '../migrations'), name: 'Migrations directory' },
    { path: path.join(__dirname, '../imports'), name: 'Imports directory' }
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir.path)) {
      console.log(`⚠️  ${dir.name} doesn't exist - will be created automatically`);
      checks.warnings.push(`${dir.name} - will be created`);
    } else {
      console.log(`✅ ${dir.name} exists`);
      checks.passed.push(dir.name);
    }
  });
}

// Check environment
function checkEnvironment() {
  console.log('\n🌍 Checking environment...\n');
  
  // Check Node version
  const nodeVersion = process.version;
  console.log(`📌 Node.js version: ${nodeVersion}`);
  
  const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
  if (majorVersion < 14) {
    console.log('⚠️  Node.js version is old - recommend v14 or higher');
    checks.warnings.push('Node.js version < 14');
  } else {
    console.log('✅ Node.js version is compatible');
    checks.passed.push('Node.js version');
  }
  
  // Check npm
  checkCommand('npm', 'npm is installed');
  
  // Check Vercel CLI
  if (!checkCommand('vercel', 'Vercel CLI is installed')) {
    console.log('   Install with: npm install -g vercel');
  }
}

// Main verification
async function verifyReadiness() {
  console.log('🚀 Production Deployment Readiness Check');
  console.log('====================================\n');
  
  // Run all checks
  checkEnvironment();
  checkNodeModules();
  checkScripts();
  checkFirebaseConfig();
  checkDirectories();
  
  // Summary
  console.log('\n📊 Verification Summary');
  console.log('====================\n');
  
  console.log(`✅ Passed: ${checks.passed.length} checks`);
  if (checks.passed.length > 0) {
    checks.passed.forEach(check => console.log(`   - ${check}`));
  }
  
  if (checks.warnings.length > 0) {
    console.log(`\n⚠️  Warnings: ${checks.warnings.length} items`);
    checks.warnings.forEach(warning => console.log(`   - ${warning}`));
  }
  
  if (checks.failed.length > 0) {
    console.log(`\n❌ Failed: ${checks.failed.length} critical checks`);
    checks.failed.forEach(failure => console.log(`   - ${failure}`));
  }
  
  // Final verdict
  console.log('\n📋 Deployment Readiness:');
  if (checks.failed.length === 0) {
    console.log('✅ READY FOR DEPLOYMENT (address warnings if any)');
    console.log('\nNext steps:');
    console.log('1. Review and address any warnings above');
    console.log('2. Update script paths if service account keys are in different locations');
    console.log('3. Run backup-production-exchangerates.js as first deployment step');
  } else {
    console.log('❌ NOT READY - Critical issues must be resolved');
    console.log('\nRequired actions:');
    console.log('1. Fix all failed checks listed above');
    console.log('2. Ensure Firebase service account keys are properly configured');
    console.log('3. Run this verification again before proceeding');
  }
  
  console.log('\n📖 See scripts/DEPLOYMENT_SETUP_NOTES.md for configuration help');
}

// Run verification
verifyReadiness().catch(error => {
  console.error('❌ Verification error:', error);
  process.exit(1);
});