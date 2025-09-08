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
 */
router.get('/profile', authenticateUserWithProfile, async (req, res) => {
  try {
    console.log('GET /api/user/profile - Request received');
    
    if (!req.user) {
      console.log('No authenticated user found');
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { uid, email, name } = req.user;
    console.log(`Fetching profile for user: ${uid} (${email})`);

    // Look up user document in Firestore
    const db = await getDb();
    let userDoc = await db.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      console.log('User document not found by UID, trying email lookup...');
      
      // Try to find by email as fallback
      const emailQuery = await db.collection('users').where('email', '==', email).get();
      
      if (!emailQuery.empty) {
        console.log('Found user document by email');
        const existingDoc = emailQuery.docs[0];
        const existingData = existingDoc.data();
        
        // Copy the document to the correct UID-based location
        console.log(`Migrating user document from ${existingDoc.id} to ${uid}`);
        await db.collection('users').doc(uid).set(existingData);
        
        // Update last login timestamp
        await db.collection('users').doc(uid).update({
          lastLogin: new Date()
        });

        console.log('Migrated existing user profile');

        return res.json({ 
          user: { 
            id: uid,
            uid: uid,
            ...existingData 
          } 
        });
      }
      
      console.log('User document not found, creating default profile');
      
      // Create default user profile for new users
      const newUser = {
        email: email,
        name: name || email.split('@')[0], // Use email prefix if no display name
        clientAccess: {
          "MTC": { role: "admin", unitId: null }
        },
        globalRole: "admin", // Default new users to admin for now
        preferredClient: "MTC",
        createdAt: new Date(),
        lastLogin: new Date()
      };
      
      await db.collection('users').doc(uid).set(newUser);
      console.log('Created new user profile:', newUser);
      
      return res.json({ 
        user: { 
          id: uid,
          uid: uid, // Include both for compatibility
          ...newUser 
        } 
      });
    }

    // Update last login timestamp
    await db.collection('users').doc(uid).update({
      lastLogin: new Date()
    });

    const userData = userDoc.data();
    console.log('Retrieved existing user profile');

    res.json({ 
      user: { 
        id: uid,
        uid: uid, // Include both for compatibility
        ...userData 
      } 
    });

  } catch (error) {
    console.error('Error in GET /api/user/profile:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user profile',
      details: error.message 
    });
  }
});

/**
 * Update user profile information
 * PUT /api/user/profile
 */
router.put('/profile', authenticateUserWithProfile, async (req, res) => {
  try {
    console.log('PUT /api/user/profile - Request received');
    
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { uid } = req.user;
    const { name, phone, notifications, mustChangePassword, accountState } = req.body;
    
    console.log(`Updating profile for user: ${uid}`);
    if (mustChangePassword !== undefined) console.log(`Setting mustChangePassword to: ${mustChangePassword}`);
    if (accountState !== undefined) console.log(`Setting accountState to: ${accountState}`);

    const db = await getDb();
    const userDoc = await db.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    // Prepare update data
    const updateData = {
      lastProfileUpdate: new Date()
    };

    // Only update provided fields
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (notifications !== undefined) updateData.notifications = notifications;
    if (mustChangePassword !== undefined) updateData.mustChangePassword = mustChangePassword;
    if (accountState !== undefined) updateData.accountState = accountState;

    await db.collection('users').doc(uid).update(updateData);
    
    // Get updated user data
    const updatedDoc = await db.collection('users').doc(uid).get();
    const userData = updatedDoc.data();

    console.log('User profile updated successfully');
    
    res.json({ 
      user: { 
        id: uid, 
        ...userData 
      } 
    });

  } catch (error) {
    console.error('Error in PUT /api/user/profile:', error);
    res.status(500).json({ 
      error: 'Failed to update user profile',
      details: error.message 
    });
  }
});

/**
 * Update user email (requires special handling with Firebase Auth)
 * PUT /api/user/email
 */
router.put('/email', authenticateUserWithProfile, async (req, res) => {
  try {
    console.log('PUT /api/user/email - Request received');
    
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { uid } = req.user;
    const { newEmail } = req.body;
    
    if (!newEmail) {
      return res.status(400).json({ error: 'New email is required' });
    }

    console.log(`Updating email for user: ${uid} to ${newEmail}`);

    // Update Firebase Auth email
    await admin.auth().updateUser(uid, { email: newEmail });
    
    // Update Firestore user document
    const db = await getDb();
    await db.collection('users').doc(uid).update({
      email: newEmail,
      lastProfileUpdate: new Date()
    });

    console.log('User email updated successfully');
    
    res.json({ 
      success: true,
      message: 'Email updated successfully',
      newEmail: newEmail
    });

  } catch (error) {
    console.error('Error in PUT /api/user/email:', error);
    res.status(500).json({ 
      error: 'Failed to update email',
      details: error.message 
    });
  }
});

/**
 * Update user password (Firebase Auth only)
 * PUT /api/user/password
 */
router.put('/password', authenticateUserWithProfile, async (req, res) => {
  try {
    console.log('PUT /api/user/password - Request received');
    
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { uid } = req.user;
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    console.log(`Updating password for user: ${uid}`);

    // Update Firebase Auth password
    await admin.auth().updateUser(uid, { password: newPassword });
    
    // Update last profile update timestamp in Firestore
    const db = await getDb();
    await db.collection('users').doc(uid).update({
      lastProfileUpdate: new Date()
    });

    console.log('User password updated successfully');
    
    res.json({ 
      success: true,
      message: 'Password updated successfully'
    });

  } catch (error) {
    console.error('Error in PUT /api/user/password:', error);
    res.status(500).json({ 
      error: 'Failed to update password',
      details: error.message 
    });
  }
});

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
    const clientAccess = userData.clientAccess || {};
    
    console.log(`User has access to clients: ${Object.keys(clientAccess).join(', ')}`);

    // Get client details with role information
    const clients = await Promise.all(
      Object.entries(clientAccess).map(async ([clientId, accessInfo]) => {
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
 * Set preferred client for user
 * POST /api/user/select-client
 */
router.post('/select-client', authenticateUserWithProfile, async (req, res) => {
  try {
    console.log('POST /api/user/select-client - Request received');
    
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { uid } = req.user;
    const { clientId } = req.body;
    
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required' });
    }

    console.log(`User ${uid} selecting client: ${clientId}`);

    // Verify user has access to this client
    const db = await getDb();
    const userDoc = await db.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const userData = userDoc.data();
    const clientAccess = userData.clientAccess || {};
    
    if (!clientAccess[clientId]) {
      console.log(`Access denied - user does not have access to client ${clientId}`);
      return res.status(403).json({ error: 'Access denied to this client' });
    }

    // Update preferred client
    await db.collection('users').doc(uid).update({
      preferredClient: clientId,
      lastClientChange: new Date()
    });

    console.log(`Successfully set preferred client to ${clientId}`);

    res.json({ 
      success: true, 
      clientId,
      role: clientAccess[clientId].role,
      unitId: clientAccess[clientId].unitId
    });

  } catch (error) {
    console.error('Error in POST /api/user/select-client:', error);
    res.status(500).json({ 
      error: 'Failed to select client',
      details: error.message 
    });
  }
});

/**
 * Complete password setup after email invitation
 * POST /api/user/complete-password-setup
 */
router.post('/complete-password-setup', async (req, res) => {
  try {
    console.log('POST /api/user/complete-password-setup - Request received');
    
    const { oobCode } = req.body;
    
    if (!oobCode) {
      return res.status(400).json({ error: 'Reset code is required' });
    }

    // Verify the reset code is valid before proceeding
    let userEmail;
    try {
      // Validate the oobCode by checking if it corresponds to a valid action
      // This is a security measure to ensure only legitimate codes are processed
      const actionCodeInfo = await admin.auth().checkActionCode(oobCode);
      userEmail = actionCodeInfo.data.email;
      
      if (actionCodeInfo.operation !== 'PASSWORD_RESET' && actionCodeInfo.operation !== 'VERIFY_AND_CHANGE_EMAIL') {
        return res.status(400).json({ 
          error: 'Invalid action code type',
          code: 'INVALID_CODE_TYPE'
        });
      }
      
      console.log(`✅ Valid password setup code for email: ${userEmail}`);
    } catch (codeError) {
      console.error('❌ Invalid or expired reset code:', codeError.message);
      return res.status(400).json({ 
        error: 'Invalid or expired reset code',
        code: 'INVALID_RESET_CODE'
      });
    }

    // Since this endpoint is called after successful password reset,
    // we need to find the user and update their profile
    // We'll look for users with pending_invitation state
    const db = await getDb();
    const usersSnapshot = await db.collection('users')
      .where('accountState', '==', 'pending_invitation')
      .get();

    if (usersSnapshot.empty) {
      console.log('No users found with pending_invitation state');
      return res.json({ success: true, message: 'Password setup completed' });
    }

    // Update all users with pending_invitation (should be just one)
    const batch = db.batch();
    usersSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        accountState: 'active',
        mustChangePassword: false,
        lastModifiedDate: new Date().toISOString()
      });
    });

    await batch.commit();
    console.log('Updated user profiles after password setup');

    res.json({ 
      success: true, 
      message: 'Password setup completed and profile updated' 
    });

  } catch (error) {
    console.error('Error in POST /api/user/complete-password-setup:', error);
    res.status(500).json({ 
      error: 'Failed to complete password setup',
      details: error.message 
    });
  }
});

/**
 * Get current client context for user
 * GET /api/user/current-client
 */
router.get('/current-client', authenticateUserWithProfile, async (req, res) => {
  try {
    console.log('GET /api/user/current-client - Request received');
    
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { uid } = req.user;
    const db = await getDb();
    const userDoc = await db.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const userData = userDoc.data();
    const preferredClient = userData.preferredClient;
    
    if (!preferredClient) {
      return res.json({ clientId: null, name: null });
    }

    // Get client details
    try {
      const clientDoc = await db.collection('clients').doc(preferredClient).get();
      const clientName = clientDoc.exists ? clientDoc.data().name : preferredClient;
      
      res.json({ 
        clientId: preferredClient, 
        name: clientName,
        role: userData.clientAccess?.[preferredClient]?.role,
        unitId: userData.clientAccess?.[preferredClient]?.unitId
      });
    } catch (error) {
      console.error(`Error fetching client details for ${preferredClient}:`, error);
      res.json({ 
        clientId: preferredClient, 
        name: preferredClient // Fallback
      });
    }

  } catch (error) {
    console.error('Error in GET /api/user/current-client:', error);
    res.status(500).json({ 
      error: 'Failed to fetch current client',
      details: error.message 
    });
  }
});

export default router;
