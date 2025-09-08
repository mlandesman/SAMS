#!/usr/bin/env node

/**
 * Generic script to fix user profile structure for any user
 * Usage: node fix-user-structure.js <userId or email>
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const serviceAccountPath = join(__dirname, '..', 'backend', 'serviceAccountKey.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

const app = initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function findUserByEmail(email) {
  const usersSnapshot = await db.collection('users')
    .where('email', '==', email)
    .limit(1)
    .get();
  
  if (usersSnapshot.empty) {
    return null;
  }
  
  return {
    id: usersSnapshot.docs[0].id,
    data: usersSnapshot.docs[0].data()
  };
}

async function fixUserProfile(userIdOrEmail) {
  console.log(`🔧 Starting user profile fix for: ${userIdOrEmail}\n`);
  
  let userId;
  let userData;
  
  try {
    // Check if it's an email or userId
    if (userIdOrEmail.includes('@')) {
      const userResult = await findUserByEmail(userIdOrEmail);
      if (!userResult) {
        console.error('❌ User not found with email:', userIdOrEmail);
        return;
      }
      userId = userResult.id;
      userData = userResult.data;
    } else {
      userId = userIdOrEmail;
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        console.error('❌ User not found with ID:', userId);
        return;
      }
      userData = userDoc.data();
    }
    
    console.log('📄 Current user data loaded');
    console.log('User:', userData.email, '(' + userId + ')');
    console.log('Current clientAccess:', JSON.stringify(userData.clientAccess, null, 2));
    
    // Check if fix is needed
    const needsFix = Object.entries(userData.clientAccess || {}).some(([clientId, access]) => {
      // Check if this client access needs fixing
      if (access.unitAssignments && access.unitAssignments.length > 0 && !access.unitId) {
        return true; // Needs fix - has assignments but no primary unit
      }
      return false;
    });
    
    if (!needsFix) {
      console.log('\n✅ User profile structure is already correct!');
      return;
    }
    
    // Create the corrected clientAccess
    const fixedClientAccess = {};
    
    for (const [clientId, access] of Object.entries(userData.clientAccess || {})) {
      if (access.unitAssignments && access.unitAssignments.length > 0 && !access.unitId) {
        // Find the primary unit (first owner, or first manager if no owner)
        const ownerAssignment = access.unitAssignments.find(a => a.role === 'unitOwner');
        const primaryAssignment = ownerAssignment || access.unitAssignments[0];
        
        // Remove the primary from assignments array
        const otherAssignments = access.unitAssignments.filter(a => a.unitId !== primaryAssignment.unitId);
        
        fixedClientAccess[clientId] = {
          role: primaryAssignment.role,
          unitId: primaryAssignment.unitId,
          permissions: access.permissions || [],
          addedDate: access.addedDate || primaryAssignment.addedDate,
          addedBy: access.addedBy || primaryAssignment.addedBy,
          unitAssignments: otherAssignments
        };
        
        console.log(`\n🔧 Fixed ${clientId}:`);
        console.log(`  - Primary unit: ${primaryAssignment.unitId} (${primaryAssignment.role})`);
        console.log(`  - Additional units: ${otherAssignments.length}`);
      } else {
        // Keep as is
        fixedClientAccess[clientId] = access;
      }
    }
    
    // Update the document
    const updateData = {
      clientAccess: fixedClientAccess,
      lastModifiedDate: new Date().toISOString(),
      lastModifiedBy: 'fix-script'
    };
    
    // Ensure required fields
    if (!userData.uid) updateData.uid = userId;
    if (!userData.globalRole) updateData.globalRole = 'user';
    if (!userData.isActive) updateData.isActive = true;
    if (!userData.accountState) updateData.accountState = 'active';
    
    await db.collection('users').doc(userId).update(updateData);
    
    console.log('\n✅ User profile updated successfully!');
    
    // Verify the update
    const verifyDoc = await db.collection('users').doc(userId).get();
    const verifyData = verifyDoc.data();
    console.log('\n🔍 Verification - Updated clientAccess:', JSON.stringify(verifyData.clientAccess, null, 2));
    
  } catch (error) {
    console.error('❌ Error updating user profile:', error);
  } finally {
    // Clean exit
    console.log('\n🏁 Script completed');
    process.exit(0);
  }
}

// Get command line argument
const userIdOrEmail = process.argv[2];

if (!userIdOrEmail) {
  console.error('❌ Please provide a userId or email as argument');
  console.error('Usage: node fix-user-structure.js <userId or email>');
  console.error('Example: node fix-user-structure.js ms@landesman.com');
  console.error('Example: node fix-user-structure.js YHk0uE4Qha5XQrBss1Yw');
  process.exit(1);
}

// Run the fix
fixUserProfile(userIdOrEmail);