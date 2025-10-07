import express from 'express';
import { getDb } from '../firebase.js';
import admin from 'firebase-admin';
import { 
  authenticateUserWithProfile,
  requirePermission,
  logSecurityEvent 
} from '../middleware/clientAuth.js';
import { sanitizeUserData } from '../utils/securityUtils.js';
import { DateService, getNow } from '../services/DateService.js';

// Create date service for formatting API responses
const dateService = new DateService({ timezone: 'America/Cancun' });

// Helper to format date fields consistently for API responses
function formatDateField(dateValue) {
  if (!dateValue) return null;
  return dateService.formatForFrontend(dateValue);
}
// Removed email-based document ID imports - reverting to UID-based system

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
        createdAt: getNow(),
        lastLogin: getNow(),
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
      lastLogin: getNow()
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
      createdAt: formatDateField(userData.createdAt),
      lastLogin: formatDateField(getNow())
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

/**
 * Get available clients for authenticated user with role information
 * GET /api/user/clients
 */
router.get('/clients', authenticateUserWithProfile, async (req, res) => {
  try {
    console.log('GET /api/user/clients - Request received');
    
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { uid } = req.user;
    const db = await getDb();
    const userDoc = await db.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      console.log('User profile not found');
      return res.status(404).json({ error: 'User profile not found' });
    }

    const userData = userDoc.data();
    const propertyAccess = userData.propertyAccess || {};
    
    console.log(`User has access to clients: ${Object.keys(propertyAccess).join(', ')}`);

    // Get client details with role information
    const clients = await Promise.all(
      Object.entries(propertyAccess).map(async ([clientId, accessInfo]) => {
        try {
          const clientDoc = await db.collection('clients').doc(clientId).get();
          const clientData = clientDoc.exists ? clientDoc.data() : {};
          return {
            id: clientId,
            name: clientData.name || clientId,
            basicInfo: clientData.basicInfo || {},
            fullName: clientData.basicInfo?.fullName || clientData.fullName || clientData.name || clientId,
            role: accessInfo.role,
            unitId: accessInfo.unitId
          };
        } catch (error) {
          console.error(`Error fetching client ${clientId}:`, error);
          return {
            id: clientId,
            name: clientId, // Fallback to clientId
            basicInfo: {},
            fullName: clientId,
            role: accessInfo.role,
            unitId: accessInfo.unitId
          };
        }
      })
    );

    res.json({ clients });

  } catch (error) {
    console.error('Error in GET /api/user/clients:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user clients',
      details: error.message 
    });
  }
});

/**
 * Select a client for the current session
 * POST /api/user/select-client
 */
router.post('/select-client', authenticateUserWithProfile, async (req, res) => {
  try {
    const { clientId } = req.body;
    const userId = req.user.uid;
    
    console.log(`User ${userId} selecting client: ${clientId}`);
    
    // Verify user has access to this client
    if (!req.user.samsProfile?.propertyAccess || !req.user.samsProfile.propertyAccess[clientId]) {
      return res.status(403).json({ 
        error: 'Access denied to this client' 
      });
    }
    
    // Update user's preferred client
    const db = await getDb();
    await db.collection('users').doc(userId).update({
      preferredClient: clientId,
      lastClientSelection: getNow()
    });
    
    // Log the client selection
    await logSecurityEvent({
      action: 'CLIENT_SELECTED',
      userId: userId,
      userEmail: req.user.email,
      clientId: clientId,
      timestamp: getNow(),
      ip: req.ip
    });
    
    res.json({ 
      success: true,
      message: 'Client selected successfully',
      clientId: clientId
    });
    
  } catch (error) {
    console.error('Error selecting client:', error);
    res.status(500).json({ 
      error: 'Failed to select client' 
    });
  }
});

// ... rest of the routes remain the same but use email-based lookups ...

export default router;