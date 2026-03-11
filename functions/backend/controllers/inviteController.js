/**
 * Invite token management for passkey registration.
 * Admin generates invites; users redeem them during passkey registration.
 */

import { getDb } from '../firebase.js';
import admin from 'firebase-admin';
import crypto from 'crypto';
import { getNow } from '../services/DateService.js';
import { webauthnConfig } from '../config/webauthnConfig.js';
import { logError } from '../../shared/logger.js';
import { sendPasskeyInvite } from '../services/emailService.js';

const INVITE_EXPIRY_HOURS = 72;

/**
 * Get invites collection ref: system/invites/tokens/{token}
 */
function getInvitesCollection(db) {
  return db.collection('system').doc('invites').collection('tokens');
}

/**
 * Validate invite token. Returns { userId, email } if valid, null otherwise.
 * Internal helper, not a route.
 */
export async function validateInviteToken(db, token) {
  if (!token || typeof token !== 'string') return null;
  const ref = getInvitesCollection(db).doc(token);
  const doc = await ref.get();
  if (!doc.exists) return null;
  const data = doc.data();
  if (data.consumed) return null;
  const expiresAt = data.expiresAt?.toDate?.() ?? new Date(0);
  if (expiresAt < getNow()) return null;
  return { userId: data.userId, email: data.email };
}

/**
 * POST /auth/invite (admin-only)
 * Generate invite token for a user to register a passkey.
 */
export async function generateInvite(req, res) {
  try {
    const role = req.user?.samsProfile?.globalRole;
    if (role !== 'admin' && role !== 'superAdmin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId } = req.body || {};
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const db = await getDb();
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    const userData = userDoc.data();
    const email = userData.email || '';

    const token = crypto.randomBytes(32).toString('base64url');
    const now = getNow();
    const expiresAt = new Date(now.getTime() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);

    await getInvitesCollection(db).doc(token).set({
      userId,
      email,
      createdAt: admin.firestore.Timestamp.fromDate(now),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      consumed: false,
    });

    const origin = Array.isArray(webauthnConfig.origin)
      ? webauthnConfig.origin[0]
      : webauthnConfig.origin;
    const inviteUrl = `${origin}/invite/${token}`;

    const userName = userData.name || userData.displayName || email;
    const adminEmail = req.user?.email || req.user?.samsProfile?.email || 'Administrator';
    let emailSent = false;

    if (email) {
      const emailResult = await sendPasskeyInvite({
        email,
        name: userName,
        inviteUrl,
        invitedBy: adminEmail,
      });
      emailSent = emailResult?.success || false;
    }

    res.json({ inviteToken: token, inviteUrl, emailSent });
  } catch (error) {
    logError('Invite generation error:', error);
    res.status(500).json({ error: 'Failed to generate invite' });
  }
}
