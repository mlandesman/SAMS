#!/usr/bin/env node

/**
 * Fix Menu Structure - Change menuItems to menu
 * Frontend expects 'menu' array but script created 'menuItems' array
 */

import { initializeFirebase, printEnvironmentInfo } from './client-onboarding/utils/environment-config.js';
import { getCurrentTimestamp } from './client-onboarding/utils/timestamp-converter.js';

const CLIENT_ID = 'MTC';

async function fixMenuStructure() {
  try {
    // Initialize Firebase
    const { db } = await initializeFirebase('dev');
    printEnvironmentInfo('dev');
    
    console.log('\n🔧 Fixing menu structure - changing menuItems to menu...\n');
    
    // Get current activities config
    const configRef = db.collection('clients').doc(CLIENT_ID).collection('config').doc('activities');
    const configDoc = await configRef.get();
    
    if (!configDoc.exists) {
      console.error('❌ Error: Activities config does not exist');
      process.exit(1);
    }
    
    const currentData = configDoc.data();
    console.log('📋 Current structure keys:', Object.keys(currentData));
    
    if (currentData.menu && Array.isArray(currentData.menu)) {
      console.log('✅ Menu structure is already correct (has menu array)');
      console.log(`📊 Menu items: ${currentData.menu.length}`);
      process.exit(0);
    }
    
    if (!currentData.menuItems || !Array.isArray(currentData.menuItems)) {
      console.error('❌ Error: No menuItems array found to convert');
      process.exit(1);
    }
    
    console.log(`📊 Found menuItems array with ${currentData.menuItems.length} items`);
    console.log('🔄 Converting menuItems to menu...');
    
    // Create the correct structure
    const fixedData = {
      menu: currentData.menuItems, // Move menuItems to menu
      updatedAt: getCurrentTimestamp(),
      updatedBy: 'fix-menu-structure-script'
    };
    
    // Remove the old menuItems field and update with correct structure
    await configRef.set(fixedData);
    
    console.log('✅ Menu structure fixed!');
    console.log('📝 Menu items:');
    fixedData.menu.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.label} (${item.activity})`);
    });
    
    console.log('\n🎉 Frontend should now be able to load the menu configuration!');
    
  } catch (error) {
    console.error('❌ Error fixing menu structure:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the fix
fixMenuStructure();