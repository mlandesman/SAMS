import admin from 'firebase-admin';
import { initializeApp, cert } from 'firebase-admin/app';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin (dev environment)
const serviceAccountPath = path.join(__dirname, '../backend/serviceAccountKey.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();

async function checkDatabaseState() {
  console.log('=== SAMS Dev Database State Check ===\n');
  
  try {
    // 1. Check transactions
    console.log('1. TRANSACTIONS:');
    const transactionsSnapshot = await db.collection('transactions').get();
    console.log(`   Total count: ${transactionsSnapshot.size}`);
    
    if (transactionsSnapshot.size > 0) {
      // Sample first few transactions to check field structure
      console.log('\n   Sample transactions (first 3):');
      let count = 0;
      transactionsSnapshot.forEach(doc => {
        if (count < 3) {
          const data = doc.data();
          console.log(`\n   Transaction ${doc.id}:`);
          console.log(`   - Date: ${data.date}`);
          console.log(`   - Client: ${data.client}`);
          console.log(`   - Unit field: ${data.unit ? 'present' : 'missing'}`);
          console.log(`   - UnitId field: ${data.unitId ? 'present' : 'missing'}`);
          console.log(`   - Amount: ${data.amount}`);
          console.log(`   - Type: ${data.type}`);
          console.log(`   - VendorId: ${data.vendorId || 'N/A'}`);
          console.log(`   - CategoryId: ${data.categoryId || 'N/A'}`);
          count++;
        }
      });
      
      // Check for field inconsistencies
      let unitCount = 0;
      let unitIdCount = 0;
      let bothCount = 0;
      let neitherCount = 0;
      
      transactionsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.unit && data.unitId) bothCount++;
        else if (data.unit) unitCount++;
        else if (data.unitId) unitIdCount++;
        else neitherCount++;
      });
      
      console.log('\n   Field presence analysis:');
      console.log(`   - Has both unit and unitId: ${bothCount}`);
      console.log(`   - Has only unit: ${unitCount}`);
      console.log(`   - Has only unitId: ${unitIdCount}`);
      console.log(`   - Has neither: ${neitherCount}`);
    }
    
    // 2. Check units
    console.log('\n2. UNITS:');
    const unitsSnapshot = await db.collection('units').get();
    console.log(`   Total count: ${unitsSnapshot.size}`);
    
    if (unitsSnapshot.size > 0) {
      console.log('\n   Sample units (first 3):');
      let count = 0;
      unitsSnapshot.forEach(doc => {
        if (count < 3) {
          const data = doc.data();
          console.log(`   - ${doc.id}: ${data.unitName || 'No name'}`);
          count++;
        }
      });
    }
    
    // 3. Check vendors
    console.log('\n3. VENDORS:');
    const vendorsSnapshot = await db.collection('vendors').get();
    console.log(`   Total count: ${vendorsSnapshot.size}`);
    
    if (vendorsSnapshot.size > 0) {
      console.log('\n   Sample vendors (first 3):');
      let count = 0;
      vendorsSnapshot.forEach(doc => {
        if (count < 3) {
          const data = doc.data();
          console.log(`   - ${doc.id}: ${data.name || 'No name'}`);
          count++;
        }
      });
    }
    
    // 4. Check categories
    console.log('\n4. CATEGORIES:');
    const categoriesSnapshot = await db.collection('categories').get();
    console.log(`   Total count: ${categoriesSnapshot.size}`);
    
    if (categoriesSnapshot.size > 0) {
      console.log('\n   Sample categories (first 3):');
      let count = 0;
      categoriesSnapshot.forEach(doc => {
        if (count < 3) {
          const data = doc.data();
          console.log(`   - ${doc.id}: ${data.name || 'No name'}`);
          count++;
        }
      });
    }
    
    // 5. Check clients
    console.log('\n5. CLIENTS:');
    const clientsSnapshot = await db.collection('clients').get();
    console.log(`   Total count: ${clientsSnapshot.size}`);
    
    if (clientsSnapshot.size > 0) {
      console.log('\n   Client IDs:');
      clientsSnapshot.forEach(doc => {
        console.log(`   - ${doc.id}`);
      });
    }
    
    // 6. Check users (should only be 2)
    console.log('\n6. USERS:');
    const usersSnapshot = await db.collection('users').get();
    console.log(`   Total count: ${usersSnapshot.size}`);
    
    if (usersSnapshot.size > 0) {
      console.log('\n   Users:');
      usersSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`   - ${doc.id}: ${data.firstName} ${data.lastName} (${data.role})`);
      });
    }
    
    // 7. Check HOA dues
    console.log('\n7. HOA DUES:');
    const hoaDuesSnapshot = await db.collection('hoaDues').get();
    console.log(`   Total count: ${hoaDuesSnapshot.size}`);
    
    // 8. Check balances
    console.log('\n8. BALANCES:');
    const balancesSnapshot = await db.collection('balances').get();
    console.log(`   Total count: ${balancesSnapshot.size}`);
    
    // Summary and recommendations
    console.log('\n=== SUMMARY ===');
    console.log(`Total transactions: ${transactionsSnapshot.size}`);
    console.log(`Total reference data: ${unitsSnapshot.size + vendorsSnapshot.size + categoriesSnapshot.size} items`);
    console.log(`Active clients: ${clientsSnapshot.size}`);
    
    if (transactionsSnapshot.size > 100) {
      console.log('\nRECOMMENDATION: Consider purging - significant transaction data present');
    } else if (transactionsSnapshot.size > 0) {
      console.log('\nRECOMMENDATION: Small amount of data - could work with existing or purge for clean slate');
    } else {
      console.log('\nRECOMMENDATION: Database is already empty - no purge needed');
    }
    
    if (unitCount > 0 || bothCount > 0) {
      console.log('\nWARNING: Found transactions with "unit" field - field standardization needed!');
    }
    
  } catch (error) {
    console.error('Error checking database state:', error);
  } finally {
    process.exit();
  }
}

checkDatabaseState();