#!/usr/bin/env node

/**
 * Fix Vendor Categories - Remove "General" default
 * 
 * One-time fix to remove the "General" category from all vendors
 * so they can be properly categorized later
 */

import { initializeFirebase } from './utils/environment-config.js';

const CLIENT_ID = 'MTC';

async function fixVendorCategories() {
  const { db } = await initializeFirebase('dev');
  
  console.log('🔧 Fixing vendor categories...\n');
  
  try {
    const vendorsSnapshot = await db.collection(`clients/${CLIENT_ID}/vendors`).get();
    
    if (vendorsSnapshot.empty) {
      console.log('No vendors found to fix');
      return;
    }
    
    console.log(`Found ${vendorsSnapshot.size} vendors to check\n`);
    
    let fixed = 0;
    for (const doc of vendorsSnapshot.docs) {
      const vendor = doc.data();
      
      if (vendor.category === 'General') {
        console.log(`📝 Fixing vendor: ${vendor.name}`);
        
        await doc.ref.update({
          category: '',
          updated: new Date()
        });
        
        fixed++;
        console.log(`   ✅ Removed "General" category\n`);
      }
    }
    
    console.log(`\n✅ Fixed ${fixed} vendors`);
    console.log(`📋 All vendors now have empty category field for proper categorization`);
    
  } catch (error) {
    console.error('❌ Error fixing vendors:', error);
    process.exit(1);
  }
}

// Execute
fixVendorCategories()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });