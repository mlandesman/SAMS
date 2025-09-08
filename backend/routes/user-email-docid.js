import express from 'express';
import { getDb } from '../firebase.js';
import admin from 'firebase-admin';
import { 
  authenticateUserWithProfile,
  requirePermission,
  logSecurityEvent 
} from '../middleware/clientAuth.js';
import { sanitizeUserData } from '../utils/securityUtils.js';
import { sanitizeEmailForDocId } from '../utils/emailDocId.js';

const router = express.Router();

/**
 * Get user profile with client access information
 * GET /api/user/profile
 * 
 * UPDATED: Now uses email-based document IDs instead of UIDs
 */
router.get('/profile', authenticateUserWithProfile, async (req, res) => {
  try {
    console.log('GET /api/user/profile - Request received');
    
    if (!req.user) {
      console.log('No authenticated user found');
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { uid, email, name } = req.user;
    console.log(`Fetching profile for user: ${email} (UID: ${uid})`);

    // Look up user document by email-based document ID
    const db = await getDb();
    const emailDocId = sanitizeEmailForDocId(email);
    console.log(`Looking up user document with ID: ${emailDocId}`);
    
    let userDoc = await db.collection('users').doc(emailDocId).get();
    
    if (!userDoc.exists) {
      console.log('User document not found by email ID, checking legacy UID...');
      
      // Fallback: Try UID-based lookup for unmigrated users
      userDoc = await db.collection('users').doc(uid).get();
      
      if (!userDoc.exists) {
        console.log('User document not found by UID either, creating new user...');
        
        // Create new user document with email-based ID
        const newUserData = {
          id: emailDocId,
          uid: uid, // Store UID for reference
          email: email,
          name: name || email,
          createdAt: new Date(),
          lastLogin: new Date(),
          globalRole: "user", // Default role, can be updated
          clientAccess: {},
          isActive: true,
          creationMethod: "auto-created",
          accountState: "active"
        };
        
        console.log('Creating new user document:', newUserData);
        await db.collection('users').doc(emailDocId).set(newUserData);
        
        // Re-fetch the created document
        userDoc = await db.collection('users').doc(emailDocId).get();
      } else {
        // Found by UID - migrate to email-based ID
        console.log(`Migrating user from UID ${uid} to email ID ${emailDocId}`);
        const userData = userDoc.data();
        
        // Create new document with email ID
        await db.collection('users').doc(emailDocId).set({
          ...userData,
          uid: uid, // Ensure UID is stored
          _migrated: {
            from: uid,
            at: new Date(),
            method: 'api-auto-migration'
          }
        });
        
        // Delete old UID-based document
        await db.collection('users').doc(uid).delete();
        console.log('Migration complete, old document deleted');
        
        // Re-fetch from new location
        userDoc = await db.collection('users').doc(emailDocId).get();
      }
    }
    
    // Update last login
    await db.collection('users').doc(emailDocId).update({
      lastLogin: new Date(),
      uid: uid // Always ensure current UID is stored
    });
    
    const userData = userDoc.data();
    console.log('User data retrieved:', {
      ...userData,
      clientAccess: userData.clientAccess ? Object.keys(userData.clientAccess) : []
    });
    
    // Ensure user has required fields
    const completeUserData = {
      id: emailDocId,
      uid: uid,
      email: email,
      name: userData.name || name || email,
      globalRole: userData.globalRole || 'user',
      clientAccess: userData.clientAccess || {},
      preferredClient: userData.preferredClient || null,
      isActive: userData.isActive !== undefined ? userData.isActive : true,
      accountState: userData.accountState || 'active',
      createdAt: userData.createdAt,
      lastLogin: new Date()
    };
    
    // Send sanitized user data
    const sanitizedData = sanitizeUserData(completeUserData);
    
    console.log('Returning user profile with client access:', {
      email: sanitizedData.email,
      globalRole: sanitizedData.globalRole,
      clientAccessKeys: Object.keys(sanitizedData.clientAccess || {})
    });
    
    res.json({ user: sanitizedData });
    
  } catch (error) {
    console.error('Error fetching user profile:', error);
    logSecurityEvent(req, 'PROFILE_FETCH_ERROR', false, { error: error.message });
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

/**
 * Get all users (SuperAdmin only)
 * GET /api/user/list
 * 
 * UPDATED: Returns users with email-based document IDs
 */
router.get('/list', 
  authenticateUserWithProfile,
  requirePermission('system.admin'),
  async (req, res) => {
    try {
      const db = await getDb();
      const snapshot = await db.collection('users').get();
      
      const users = [];
      snapshot.forEach(doc => {
        const userData = doc.data();
        users.push({
          docId: doc.id, // This will be the email-based ID
          ...sanitizeUserData(userData)
        });
      });
      
      console.log(`Returning ${users.length} users`);
      res.json(users);
      
    } catch (error) {
      console.error('Error listing users:', error);
      res.status(500).json({ error: 'Failed to list users' });
    }
  }
);

// ... rest of the routes remain the same but use email-based lookups ...

export default router;