import express from 'express';
import { getDb } from '../firebase.js';
import admin from 'firebase-admin';
import { 
  authenticateUserWithProfile,
  requirePermission,
  logSecurityEvent 
} from '../middleware/clientAuth.js';
import { sanitizeUserData } from '../utils/securityUtils.js';

const router = express.Router();

/**
 * Get user profile with client access information
 * GET /api/user/profile
 * 
 * REVERTED: Back to UID-based document IDs (original design)
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

    const db = await getDb();
    let userDoc = await db.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      console.log('User document not found, creating new user...');
      
      // Create new user document with UID as document ID
      const newUserData = {
        id: uid,
        uid: uid,
        email: email,
        name: name || email,
        createdAt: new Date(),
        lastLogin: new Date(),
        globalRole: "user", // Default role, can be updated by admin
        propertyAccess: {},
        isActive: true,
        creationMethod: "auto-created",
        accountState: "active"
      };
      
      console.log('Creating new user document:', newUserData);
      await db.collection('users').doc(uid).set(newUserData);
      
      // Re-fetch the created document
      userDoc = await db.collection('users').doc(uid).get();
    }
    
    // Update last login
    await db.collection('users').doc(uid).update({
      lastLogin: new Date()
    });
    
    const userData = userDoc.data();
    console.log('User data retrieved:', {
      ...userData,
      propertyAccess: userData.propertyAccess ? Object.keys(userData.propertyAccess) : []
    });
    
    // Ensure user has required fields
    const completeUserData = {
      id: uid,
      uid: uid,
      email: email,
      name: userData.name || name || email,
      globalRole: userData.globalRole || 'user',
      propertyAccess: userData.propertyAccess || {},
      preferredClient: userData.preferredClient || null,
      isActive: userData.isActive !== undefined ? userData.isActive : true,
      accountState: userData.accountState || 'active',
      createdAt: userData.createdAt,
      lastLogin: new Date()
    };
    
    // Use sanitizeUserData properly by passing req.user as requesting user
    const sanitizedData = sanitizeUserData(completeUserData, req.user);
    
    console.log('Returning user profile with client access:', {
      email: sanitizedData.email,
      globalRole: sanitizedData.globalRole,
      propertyAccessKeys: Object.keys(sanitizedData.propertyAccess || {})
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
 * REVERTED: Returns users with UID-based document IDs
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
          docId: doc.id, // This will be the UID
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

// ... rest of the routes remain the same ...

export default router;