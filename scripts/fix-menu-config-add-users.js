#!/usr/bin/env node

/**
 * Fix Menu Configuration - Add Missing User Management
 * Adds the missing "User Management" menu item to existing activities config
 */

import { initializeFirebase, printEnvironmentInfo } from './client-onboarding/utils/environment-config.js';
import { getCurrentTimestamp } from './client-onboarding/utils/timestamp-converter.js';

const CLIENT_ID = 'MTC';

async function fixMenuConfig() {
  try {
    // Initialize Firebase
    const { db } = await initializeFirebase('dev');
    printEnvironmentInfo('dev');
    
    console.log('\n🔧 Fixing menu configuration - adding User Management...\n');
    
    // Get current activities config
    const configRef = db.collection('clients').doc(CLIENT_ID).collection('config').doc('activities');
    const configDoc = await configRef.get();
    
    if (!configDoc.exists) {
      console.error('❌ Error: Activities config does not exist');
      process.exit(1);
    }
    
    const currentData = configDoc.data();
    console.log('📋 Current menu items:', currentData.menuItems?.length || 0);
    
    // Check if User Management already exists
    const hasUserManagement = currentData.menuItems?.some(item => 
      item.activity === 'Users' || item.label === 'User Management'
    );
    
    if (hasUserManagement) {
      console.log('✅ User Management already exists in menu');
      process.exit(0);
    }
    
    // Add User Management to the menu items
    const updatedMenuItems = [
      ...(currentData.menuItems || []),
      { label: "User Management", activity: "Users" }
    ];
    
    // Update the config
    await configRef.update({
      menuItems: updatedMenuItems,
      updated: getCurrentTimestamp()
    });
    
    console.log('✅ Added User Management to menu configuration');
    console.log(`📊 Total menu items: ${updatedMenuItems.length}`);
    console.log('📝 Complete menu:');
    updatedMenuItems.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.label} (${item.activity})`);
    });
    
    console.log('\n🎉 Menu fix complete! SuperAdmin should now see all activities.');
    
  } catch (error) {
    console.error('❌ Error fixing menu config:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the fix
fixMenuConfig();