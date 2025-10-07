/**
 * Authentication Routes
 * Handles public authentication endpoints like password reset
 */

import express from 'express';
import { getDb } from '../firebase.js';
import admin from 'firebase-admin';
import { sendPasswordNotification } from '../services/emailService.js';
import { getNow } from '../services/DateService.js';

const router = express.Router();

/**
 * Generate secure random password
 */
function generateSecurePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Reset password for forgotten password requests
 * POST /api/auth/reset-password
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { email, requestType } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!email.includes('@') || !email.includes('.')) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log(`🔐 Password reset request for: ${normalizedEmail}`);

    // Check if user exists in Firebase Auth
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(normalizedEmail);
    } catch (authError) {
      if (authError.code === 'auth/user-not-found') {
        return res.status(404).json({ error: 'User not found' });
      }
      throw authError;
    }

    // Check if user exists in Firestore
    const db = await getDb();
    const userDoc = await db.collection('users').doc(userRecord.uid).get();
    
    if (!userDoc.exists) {
      // Try to find by email in Firestore
      const userQuery = await db.collection('users').where('email', '==', normalizedEmail).get();
      if (userQuery.empty) {
        return res.status(404).json({ error: 'User profile not found' });
      }
    }

    const userData = userDoc.exists ? userDoc.data() : userQuery.docs[0].data();
    const userId = userDoc.exists ? userDoc.id : userQuery.docs[0].id;

    // Generate temporary password
    const temporaryPassword = generateSecurePassword();

    // Update Firebase Auth with temporary password
    await admin.auth().updateUser(userRecord.uid, {
      password: temporaryPassword,
      disabled: false
    });

    // Update Firestore profile to require password change
    await db.collection('users').doc(userId).update({
      accountState: 'pending_password_change',
      mustChangePassword: true,
      lastPasswordResetDate: getNow().toISOString(),
      passwordResetBy: 'forgot-password-request',
      isActive: true,
      lastModifiedDate: getNow().toISOString(),
      lastModifiedBy: 'system'
    });

    // Send email notification with temporary password
    try {
      const emailResult = await sendPasswordNotification({
        email: normalizedEmail,
        name: userData.name || 'User',
        temporaryPassword: temporaryPassword,
        isReset: true
      });

      console.log(`✅ Password reset successful for ${normalizedEmail}, email sent: ${emailResult?.success}`);
    } catch (emailError) {
      console.error('❌ Failed to send password reset email:', emailError);
      // Continue anyway - password was reset even if email failed
    }

    res.json({
      success: true,
      message: 'Temporary password has been sent to your email address. You will be required to change it on your next login.',
      email: normalizedEmail
    });

  } catch (error) {
    console.error('Password reset error:', error);
    
    if (error.code === 'auth/too-many-requests') {
      return res.status(429).json({ error: 'Too many password reset requests. Please try again later.' });
    }
    
    res.status(500).json({ 
      error: 'Failed to reset password',
      details: error.message 
    });
  }
});

export default router;