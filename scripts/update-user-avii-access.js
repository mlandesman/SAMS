import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Determine which environment to use
const args = process.argv.slice(2);
const env = args[0] || 'dev';

console.log(`\n🚀 Running in ${env.toUpperCase()} environment\n`);

// Load environment variables
const envFile = env === 'production' ? '.env.production' : '.env';
const envPath = path.join(__dirname, '..', envFile);
dotenv.config({ path: envPath });

// Validate environment variables
const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) {
  console.error('❌ FIREBASE_PROJECT_ID not found in environment');
  process.exit(1);
}

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath),
  projectId: projectId
});

const db = admin.firestore();

async function updateUserAVIIAccess() {
  try {
    console.log(`\n🔍 Looking for michael@landesman.com user document...`);
    
    // First, try to find by email
    const emailQuery = await db.collection('users').where('email', '==', 'michael@landesman.com').get();
    
    if (!emailQuery.empty) {
      for (const doc of emailQuery.docs) {
        const userData = doc.data();
        console.log(`\n📄 Found user document with ID: ${doc.id}`);
        console.log('Current user data:', JSON.stringify(userData, null, 2));
        
        // Check current property access
        const currentPropertyAccess = userData.propertyAccess || {};
        console.log('\nCurrent propertyAccess:', JSON.stringify(currentPropertyAccess, null, 2));
        
        // Add AVII access if not present
        if (!currentPropertyAccess.AVII) {
          console.log('\n✅ Adding AVII property access...');
          
          const updatedPropertyAccess = {
            ...currentPropertyAccess,
            AVII: {
              isAdmin: true,
              unitAssignments: []
            }
          };
          
          // Update the document
          await db.collection('users').doc(doc.id).update({
            propertyAccess: updatedPropertyAccess,
            lastModified: admin.firestore.FieldValue.serverTimestamp()
          });
          
          console.log('✅ Successfully added AVII property access!');
          console.log('Updated propertyAccess:', JSON.stringify(updatedPropertyAccess, null, 2));
        } else {
          console.log('\n✅ User already has AVII property access:');
          console.log(JSON.stringify(currentPropertyAccess.AVII, null, 2));
        }
      }
    } else {
      console.log('❌ No user document found with email michael@landesman.com');
      
      // Try to find by UID if you know it
      console.log('\n🔍 Listing all users to help identify the correct document...');
      const allUsers = await db.collection('users').limit(10).get();
      console.log(`Found ${allUsers.size} users:`);
      
      allUsers.forEach(doc => {
        const data = doc.data();
        console.log(`- ID: ${doc.id}, Email: ${data.email || 'N/A'}, GlobalRole: ${data.globalRole || 'N/A'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error updating user:', error);
  } finally {
    // Clean up
    await admin.app().delete();
    process.exit(0);
  }
}

// Run the update
updateUserAVIIAccess();