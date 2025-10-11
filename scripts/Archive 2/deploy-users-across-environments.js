#!/usr/bin/env node

/**
 * Cross-Environment User Deployment Script
 * 
 * Safely copies user documents between Firebase environments
 * Uses email-based document IDs to prevent UID mismatches
 * 
 * Usage:
 *   node deploy-users-across-environments.js --from=dev --to=staging
 *   node deploy-users-across-environments.js --from=staging --to=prod --dry-run
 */

const admin = require('firebase-admin');
const readline = require('readline');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    from: null,
    to: null,
    dryRun: false,
    filter: null
  };
  
  args.forEach(arg => {
    if (arg.startsWith('--from=')) {
      options.from = arg.split('=')[1];
    } else if (arg.startsWith('--to=')) {
      options.to = arg.split('=')[1];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--filter=')) {
      options.filter = arg.split('=')[1];
    }
  });
  
  return options;
}

// Environment configurations
const environments = {
  dev: {
    name: 'Development',
    projectId: 'sandyland-management-system',
    serviceAccountPath: '../backend/config/firebase-service-account-dev.json'
  },
  staging: {
    name: 'Staging',
    projectId: 'sandyland-sams-prod', // Your staging project
    serviceAccountPath: '../backend/config/firebase-service-account-staging.json'
  },
  prod: {
    name: 'Production',
    projectId: 'sams-sandyland-prod',
    serviceAccountPath: '../backend/config/firebase-service-account.json'
  }
};

// Initialize Firebase Admin for an environment
function initializeFirebase(env) {
  const config = environments[env];
  if (!config) {
    throw new Error(`Unknown environment: ${env}`);
  }
  
  try {
    const serviceAccount = require(config.serviceAccountPath);
    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: config.projectId
    }, env); // Use env as app name to allow multiple instances
    
    console.log(`✅ Connected to ${config.name} (${config.projectId})`);
    return app;
  } catch (error) {
    throw new Error(`Failed to initialize ${env}: ${error.message}`);
  }
}

// Prompt for confirmation
async function confirm(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(`${message} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

// Check if document ID is email-based
function isEmailDocId(docId) {
  return docId && docId.includes('__at__');
}

// Main deployment function
async function deployUsers(options) {
  const { from, to, dryRun, filter } = options;
  
  if (!from || !to) {
    console.error('❌ Both --from and --to environments must be specified');
    process.exit(1);
  }
  
  if (from === to) {
    console.error('❌ Source and destination environments must be different');
    process.exit(1);
  }
  
  console.log(`\n🚀 User Deployment: ${environments[from].name} → ${environments[to].name}\n`);
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  try {
    // Initialize both environments
    const sourceApp = initializeFirebase(from);
    const destApp = initializeFirebase(to);
    
    const sourceDb = sourceApp.firestore();
    const destDb = destApp.firestore();
    
    // Fetch all users from source
    console.log('\n📊 Fetching users from source environment...');
    const sourceSnapshot = await sourceDb.collection('users').get();
    console.log(`Found ${sourceSnapshot.size} users in ${environments[from].name}\n`);
    
    // Analyze users
    const deploymentPlan = [];
    const skipped = [];
    
    for (const doc of sourceSnapshot.docs) {
      const userData = doc.data();
      const docId = doc.id;
      const email = userData.email;
      
      // Skip if not email-based ID
      if (!isEmailDocId(docId)) {
        skipped.push({
          docId,
          email,
          reason: 'Not using email-based document ID'
        });
        continue;
      }
      
      // Apply filter if specified
      if (filter) {
        if (filter === 'admins' && userData.globalRole !== 'superAdmin' && userData.globalRole !== 'admin') {
          skipped.push({
            docId,
            email,
            reason: 'Not an admin user'
          });
          continue;
        }
        if (filter === 'active' && !userData.isActive) {
          skipped.push({
            docId,
            email,
            reason: 'Inactive user'
          });
          continue;
        }
      }
      
      // Check if user exists in destination
      const destDoc = await destDb.collection('users').doc(docId).get();
      
      deploymentPlan.push({
        docId,
        email,
        globalRole: userData.globalRole,
        isActive: userData.isActive,
        exists: destDoc.exists,
        userData
      });
    }
    
    // Display deployment plan
    console.log('📋 Deployment Plan:\n');
    
    const newUsers = deploymentPlan.filter(u => !u.exists);
    const existingUsers = deploymentPlan.filter(u => u.exists);
    
    if (newUsers.length > 0) {
      console.log('New users to deploy:');
      newUsers.forEach(u => {
        console.log(`  + ${u.email} (${u.globalRole})`);
      });
    }
    
    if (existingUsers.length > 0) {
      console.log('\nExisting users (will be updated):');
      existingUsers.forEach(u => {
        console.log(`  ~ ${u.email} (${u.globalRole})`);
      });
    }
    
    if (skipped.length > 0) {
      console.log('\nSkipped users:');
      skipped.forEach(s => {
        console.log(`  - ${s.email}: ${s.reason}`);
      });
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`  New users: ${newUsers.length}`);
    console.log(`  Updates: ${existingUsers.length}`);
    console.log(`  Skipped: ${skipped.length}`);
    console.log(`  Total to deploy: ${deploymentPlan.length}\n`);
    
    if (deploymentPlan.length === 0) {
      console.log('✅ No users to deploy!');
      return;
    }
    
    // Confirm deployment
    if (!dryRun) {
      const proceed = await confirm(`Deploy ${deploymentPlan.length} users to ${environments[to].name}?`);
      if (!proceed) {
        console.log('❌ Deployment cancelled');
        return;
      }
    }
    
    // Perform deployment
    if (!dryRun) {
      console.log('\n🚀 Starting deployment...\n');
      
      let deployed = 0;
      const batch = destDb.batch();
      
      for (const user of deploymentPlan) {
        const destRef = destDb.collection('users').doc(user.docId);
        
        // Prepare user data with deployment metadata
        const deploymentData = {
          ...user.userData,
          _deployment: {
            from: from,
            to: to,
            deployedAt: admin.firestore.FieldValue.serverTimestamp(),
            deployedBy: 'deployment-script'
          }
        };
        
        // Remove any server timestamps from source
        delete deploymentData.createdAt;
        delete deploymentData.lastLogin;
        
        batch.set(destRef, deploymentData, { merge: true });
        deployed++;
        
        if (deployed % 50 === 0) {
          console.log(`  Deployed ${deployed}/${deploymentPlan.length} users...`);
        }
      }
      
      // Commit the batch
      await batch.commit();
      console.log(`\n✅ Successfully deployed ${deployed} users to ${environments[to].name}\n`);
      
      // Verify deployment
      console.log('🔍 Verifying deployment...');
      const destSnapshot = await destDb.collection('users').get();
      console.log(`✅ Destination now has ${destSnapshot.size} users\n`);
    }
    
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  } finally {
    // Clean up Firebase apps
    await admin.app(from).delete();
    await admin.app(to).delete();
  }
}

// Show usage
function showUsage() {
  console.log(`
Cross-Environment User Deployment Script

Safely copies user documents between Firebase environments using email-based IDs.

Usage:
  node deploy-users-across-environments.js --from=<env> --to=<env> [options]

Environments:
  dev      Development (sandyland-management-system)
  staging  Staging (sandyland-sams-prod)
  prod     Production (sams-sandyland-prod)

Options:
  --dry-run        Show what would be deployed without making changes
  --filter=<type>  Filter users to deploy:
                   admins  - Only superAdmin and admin users
                   active  - Only active users

Examples:
  # Deploy all users from dev to staging
  node deploy-users-across-environments.js --from=dev --to=staging
  
  # Dry run from staging to production
  node deploy-users-across-environments.js --from=staging --to=prod --dry-run
  
  # Deploy only admin users to production
  node deploy-users-across-environments.js --from=staging --to=prod --filter=admins

Prerequisites:
  - Service account JSON files for each environment
  - Users must be using email-based document IDs
  - Run migrate-to-email-docids.js first if needed
`);
}

// Main execution
const options = parseArgs();

if (process.argv.includes('--help') || !options.from || !options.to) {
  showUsage();
} else {
  deployUsers(options).catch(console.error);
}