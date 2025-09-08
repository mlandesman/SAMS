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

console.log(`🔍 Checking menu configuration in ${env} environment`);

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

async function checkMenuConfiguration() {
  try {
    // Check MTC client menu configuration
    const clientId = 'MTC';
    
    console.log(`\n📋 Checking menu configuration for client: ${clientId}`);
    
    // Check if menu document exists
    const menuDoc = await db.collection('clients').doc(clientId).collection('config').doc('activities').get();
    
    if (!menuDoc.exists) {
      console.log('❌ No menu configuration found for MTC');
      return;
    }
    
    const menuData = menuDoc.data();
    console.log('\n✅ Menu configuration found:');
    console.log('Menu items:', menuData.menu?.length || 0);
    
    if (menuData.menu) {
      console.log('\n📋 Menu items:');
      menuData.menu.forEach((item, index) => {
        console.log(`${index + 1}. ${item.label} (${item.activity || 'no activity'})`);
      });
      
      // Check specifically for List Management and other key items
      const hasListManagement = menuData.menu.some(item => 
        item.label?.toLowerCase().includes('list management') || 
        item.activity?.toLowerCase().includes('listmanagement')
      );
      
      const hasSettings = menuData.menu.some(item => 
        item.label?.toLowerCase().includes('settings') || 
        item.activity?.toLowerCase().includes('settings')
      );
      
      const hasUserManagement = menuData.menu.some(item => 
        item.label?.toLowerCase().includes('user management') || 
        item.activity?.toLowerCase().includes('users')
      );
      
      console.log(`\n🔍 Key Menu Items:`);
      console.log(`- List Management: ${hasListManagement ? '✅ Yes' : '❌ No'}`);
      console.log(`- Settings: ${hasSettings ? '✅ Yes' : '❌ No'}`);
      console.log(`- User Management: ${hasUserManagement ? '✅ Yes' : '❌ No'}`);
    }
    
    // Compare dev vs prod if requested
    if (args[1] === 'compare') {
      console.log('\n\n🔄 Comparing with other environment...');
      // Would need to load both environments to compare
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit();
  }
}

checkMenuConfiguration();