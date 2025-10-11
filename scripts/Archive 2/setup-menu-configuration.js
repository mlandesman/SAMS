import admin from 'firebase-admin';
import { initializeApp, cert } from 'firebase-admin/app';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const env = args[0] || 'dev';

console.log(`🔧 Setting up menu configuration in ${env} environment`);

// Load service account
const serviceAccountPath = env === 'prod' 
  ? path.join(__dirname, '../serviceAccountKey-prod.json')
  : path.join(__dirname, '../backend/serviceAccountKey.json');

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();

async function setupMenuConfiguration() {
  const clientId = 'MTC';
  
  try {
    // Define the complete menu items including Budgets
    const menuItems = [
      { label: "Dashboard", activity: "Dashboard" },
      { label: "Transactions", activity: "Transactions" },
      { label: "HOA Dues", activity: "HOADues" },
      { label: "Projects", activity: "Projects" },
      { label: "Budgets", activity: "Budgets" },
      { label: "List Management", activity: "ListManagement" },
      { label: "Settings", activity: "Settings" },
      { label: "User Management", activity: "Users" }
    ];
    
    console.log(`\n📋 Setting menu configuration for client: ${clientId}`);
    console.log('Menu items to configure:', menuItems.length);
    
    // Set the menu configuration in the correct path
    await db.collection('clients').doc(clientId).collection('config').doc('activities').set({
      menu: menuItems,
      updatedAt: new Date(),
      updatedBy: 'setup-script'
    });
    
    console.log('✅ Menu configuration saved successfully!');
    
    // Verify the configuration
    const verifyDoc = await db.collection('clients').doc(clientId).collection('config').doc('activities').get();
    if (verifyDoc.exists) {
      const data = verifyDoc.data();
      console.log('\n✅ Verification successful:');
      console.log(`- Menu items: ${data.menu?.length || 0}`);
      console.log(`- Has Budgets: ${data.menu?.some(item => item.activity === 'Budgets') ? '✅' : '❌'}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit();
  }
}

setupMenuConfiguration();