import admin from 'firebase-admin';
import { initializeApp, cert } from 'firebase-admin/app';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const env = args[0] || 'dev';

console.log(`🏥 Checking ${env} environment health...\n`);

// Load service account based on environment
const getServiceAccountPath = () => {
  switch(env) {
    case 'prod':
    case 'production':
      return path.join(__dirname, '../sams-production-serviceAccountKey.json');
    case 'staging':
      return path.join(__dirname, '../serviceAccountKey-staging.json');
    default:
      return path.join(__dirname, '../backend/serviceAccountKey.json');
  }
};

const serviceAccountPath = getServiceAccountPath();

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();

async function checkEnvironmentHealth() {
  const results = {
    firebase: false,
    menuConfig: false,
    superAdmin: false,
    apiHealth: false,
    userStructure: false
  };
  
  try {
    // 1. Check Firebase Connection
    console.log('1️⃣ Checking Firebase connection...');
    const testDoc = await db.collection('health_check').doc('test').set({
      timestamp: new Date(),
      environment: env
    });
    results.firebase = true;
    console.log('✅ Firebase connection healthy\n');
    
    // 2. Check Menu Configuration
    console.log('2️⃣ Checking menu configuration...');
    const menuDoc = await db.collection('clients').doc('MTC').collection('config').doc('activities').get();
    if (menuDoc.exists) {
      const menu = menuDoc.data();
      const hasBudgets = menu.menu?.some(item => item.activity === 'Budgets');
      results.menuConfig = true;
      console.log(`✅ Menu configuration exists (${menu.menu?.length || 0} items)`);
      console.log(`   Budgets menu: ${hasBudgets ? '✅' : '❌'}\n`);
    } else {
      console.log('❌ Menu configuration missing\n');
    }
    
    // 3. Check SuperAdmin User
    console.log('3️⃣ Checking SuperAdmin user...');
    const usersSnapshot = await db.collection('users').where('globalRole', '==', 'superAdmin').get();
    if (!usersSnapshot.empty) {
      results.superAdmin = true;
      console.log(`✅ Found ${usersSnapshot.size} SuperAdmin user(s)`);
      usersSnapshot.forEach(doc => {
        const user = doc.data();
        console.log(`   - ${user.email} (Doc ID: ${doc.id.substring(0, 8)}...)`);
      });
      console.log();
    } else {
      console.log('❌ No SuperAdmin users found\n');
    }
    
    // 4. Check User Document Structure
    console.log('4️⃣ Checking user document structure...');
    const sampleUser = usersSnapshot.empty ? null : usersSnapshot.docs[0];
    if (sampleUser) {
      const userData = sampleUser.data();
      const hasRequiredFields = userData.uid && userData.email && userData.globalRole;
      const isUidBased = sampleUser.id === userData.uid;
      results.userStructure = hasRequiredFields && isUidBased;
      console.log(`✅ User structure check:`);
      console.log(`   UID-based documents: ${isUidBased ? '✅' : '❌'}`);
      console.log(`   Required fields: ${hasRequiredFields ? '✅' : '❌'}\n`);
    }
    
    // 5. Check API Health (prod and staging only)
    if (env === 'prod' || env === 'production' || env === 'staging') {
      console.log('5️⃣ Checking API health...');
      let apiUrl;
      if (env === 'staging') {
        apiUrl = 'https://backend-staging-michael-landesmans-projects.vercel.app/api/health';
      } else {
        apiUrl = 'https://backend-michael-landesmans-projects.vercel.app/api/health';
      }
      
      try {
        const response = await fetch(apiUrl, {
          method: 'GET',
          timeout: 5000
        });
        results.apiHealth = response.ok;
        console.log(`✅ API health check: ${response.status} (${apiUrl})\n`);
      } catch (error) {
        console.log(`⚠️  API health check failed: ${error.message}\n`);
      }
    }
    
    // Summary
    console.log('📊 Environment Health Summary:');
    console.log('================================');
    Object.entries(results).forEach(([key, value]) => {
      if (key === 'apiHealth' && env !== 'prod') return;
      console.log(`${key.padEnd(20)} ${value ? '✅' : '❌'}`);
    });
    
    const allHealthy = Object.values(results).filter(v => v !== false).length === 
                       Object.keys(results).filter(k => !(k === 'apiHealth' && env !== 'prod')).length;
    
    console.log('\n' + (allHealthy ? '✅ Environment is healthy!' : '⚠️  Some issues detected'));
    
  } catch (error) {
    console.error('❌ Health check error:', error);
  } finally {
    // Cleanup
    await db.collection('health_check').doc('test').delete();
    process.exit();
  }
}

checkEnvironmentHealth();