/**
 * Passkey (WebAuthn) controller - registration and authentication flows.
 * PK1: Backend WebAuthn Endpoints + Credential Storage
 */

import { getDb } from '../firebase.js';
import admin from 'firebase-admin';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { webauthnConfig } from '../config/webauthnConfig.js';
import { getNow } from '../services/DateService.js';
import { validateInviteToken } from './inviteController.js';
import { logError } from '../../shared/logger.js';
import crypto from 'crypto';

const CHALLENGE_TTL_MINUTES = 5;

/**
 * Helper: Look up user by email in Firestore
 */
async function getUserByEmail(db, email) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;
  const snapshot = await db.collection('users').where('email', '==', normalizedEmail).limit(1).get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { ...doc.data(), uid: doc.id };
}

/**
 * Helper: Store challenge in Firestore with TTL
 */
async function storeChallenge(db, challengeId, data) {
  const now = getNow();
  const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MINUTES * 60 * 1000);
  await db.collection('system').doc('webauthn').collection('challenges').doc(challengeId).set({
    ...data,
    createdAt: admin.firestore.Timestamp.fromDate(now),
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
  });
}

/**
 * Helper: Get and delete challenge atomically (one-time use).
 * Uses a Firestore transaction to prevent replay attacks from concurrent requests.
 */
async function consumeChallenge(db, challengeId) {
  const ref = db.collection('system').doc('webauthn').collection('challenges').doc(challengeId);
  return db.runTransaction(async (txn) => {
    const doc = await txn.get(ref);
    if (!doc.exists) return null;
    const data = doc.data();
    const now = getNow();
    const expiresAt = data.expiresAt?.toDate?.() ?? new Date(0);
    txn.delete(ref);
    if (expiresAt < now) return null;
    return data;
  });
}

/**
 * Helper: Clean expired challenges (fire-and-forget, never blocks callers)
 */
function cleanupExpiredChallenges(db) {
  const now = admin.firestore.Timestamp.fromDate(getNow());
  db.collection('system').doc('webauthn').collection('challenges')
    .where('expiresAt', '<', now)
    .limit(50)
    .get()
    .then((snapshot) => {
      if (snapshot.empty) return;
      const batch = db.batch();
      snapshot.docs.forEach((d) => batch.delete(d.ref));
      return batch.commit();
    })
    .catch((err) => logError('Challenge cleanup failed (non-fatal):', err));
}

/**
 * POST /auth/passkey/register/options
 * Returns WebAuthn registration options. Requires either valid Firebase Auth (bootstrap) or inviteToken.
 */
export async function registrationOptions(req, res) {
  try {
    const { email, inviteToken } = req.body || {};
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const db = await getDb();
    cleanupExpiredChallenges(db);

    // Authorization: either inviteToken OR valid Firebase Auth session (admin bootstrap)
    let uid;
    let user;

    if (inviteToken) {
      const inviteResult = await validateInviteToken(db, inviteToken);
      if (!inviteResult) {
        return res.status(401).json({ error: 'Invalid or expired invite token' });
      }
      uid = inviteResult.userId;
      if ((inviteResult.email || '').trim().toLowerCase() !== normalizedEmail) {
        return res.status(403).json({ error: 'Invite token does not match this email' });
      }
      const userDoc = await db.collection('users').doc(uid).get();
      user = userDoc.exists ? { ...userDoc.data(), uid } : { uid, email: normalizedEmail, name: normalizedEmail };
    } else {
      // Bearer token: use token as source of truth (Firestore doc.id may not match Auth UID)
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Valid Firebase Auth session or invite token required' });
      }
      const idToken = authHeader.split('Bearer ')[1];
      let decoded;
      try {
        decoded = await admin.auth().verifyIdToken(idToken);
      } catch (e) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      uid = decoded.uid;
      const tokenEmail = (decoded.email || '').trim().toLowerCase();
      let userDoc = await db.collection('users').doc(uid).get();
      // Fallback: if no doc at uid, lookup by email (legacy email-as-docId)
      if (!userDoc.exists) {
        const byEmail = await getUserByEmail(db, normalizedEmail);
        if (byEmail) {
          if (byEmail.uid !== uid) {
            return res.status(403).json({
              error: 'UID mismatch: Firestore user doc ID does not match token UID',
              hint: `User found at users/${byEmail.uid} but token has uid ${uid}. Migrate to UID-based docs.`
            });
          }
          userDoc = { exists: true, data: () => byEmail };
        }
      }
      const userData = userDoc.exists ? userDoc.data() : {};
      const userEmail = (userData.email || '').trim().toLowerCase();
      if (!tokenEmail && !userEmail) {
        return res.status(403).json({
          error: 'Cannot verify email ownership — no email on token or user profile',
          hint: 'User must have an email set in Firebase Auth or Firestore before registering a passkey.',
        });
      }
      const emailMatches =
        (tokenEmail && tokenEmail === normalizedEmail) ||
        (userEmail && userEmail === normalizedEmail);
      if (!emailMatches) {
        return res.status(403).json({
          error: 'Requested email does not match user',
          hint: `Token: ${tokenEmail || '(empty)'}, Firestore: ${userEmail || '(empty)'}, requested: ${normalizedEmail}`
        });
      }
      if (!userDoc.exists) {
        return res.status(404).json({
          error: 'User profile not found in Firestore',
          hint: `Ensure users/${uid} exists or a user with email ${normalizedEmail} exists.`
        });
      }
      user = { ...userData, uid };
    }

    // Fetch existing passkeys for excludeCredentials
    const passkeysSnap = await db.collection('users').doc(uid).collection('passkeys').get();
    const excludeCredentials = passkeysSnap.docs.map((d) => ({
      id: d.id,
      transports: d.data().transports || [],
    }));

    const userIDBytes = new TextEncoder().encode(uid);
    const options = await generateRegistrationOptions({
      rpName: webauthnConfig.rpName,
      rpID: webauthnConfig.rpID,
      userName: normalizedEmail,
      userDisplayName: user.name || user.displayName || normalizedEmail,
      userID: userIDBytes,
      excludeCredentials: excludeCredentials.length ? excludeCredentials : undefined,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      attestationType: 'none',
    });

    const challengeId = crypto.randomBytes(16).toString('hex');
    await storeChallenge(db, challengeId, {
      challenge: options.challenge,
      userId: uid,
      email: normalizedEmail,
      type: 'registration',
      ...(inviteToken && { inviteToken }),
    });

    res.json({ options, challengeId });
  } catch (error) {
    logError('Passkey registration options error:', error);
    res.status(500).json({ error: 'Failed to generate registration options' });
  }
}

/**
 * POST /auth/passkey/register/verify
 * Verifies registration response, stores credential, returns custom token.
 */
export async function registrationVerify(req, res) {
  try {
    const { email, credential, deviceName, challengeId } = req.body || {};
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail || !credential || !challengeId) {
      return res.status(400).json({ error: 'Email, credential, and challengeId are required' });
    }

    const db = await getDb();
    const challengeData = await consumeChallenge(db, challengeId);
    if (!challengeData || challengeData.type !== 'registration') {
      return res.status(401).json({ error: 'Invalid or expired challenge' });
    }
    if (challengeData.email !== normalizedEmail) {
      return res.status(403).json({ error: 'Challenge does not match email' });
    }

    const uid = challengeData.userId;

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge: challengeData.challenge,
        expectedOrigin: webauthnConfig.origin,
        expectedRPID: webauthnConfig.rpID,
      });
    } catch (err) {
      logError('Registration verification failed:', err);
      return res.status(401).json({ error: 'Verification failed' });
    }

    if (!verification.verified) {
      return res.status(401).json({ error: 'Verification failed' });
    }

    const { credential: regCred, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    const credentialId = regCred.id;
    const publicKeyBase64 = Buffer.from(regCred.publicKey).toString('base64url');
    const transports = regCred.transports || [];

    const now = getNow();
    const credentialDoc = {
      credentialId,
      publicKey: publicKeyBase64,
      counter: regCred.counter,
      deviceName: deviceName || 'Unknown Device',
      createdAt: now.toISOString(),
      lastUsedAt: now.toISOString(),
      transports,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
    };

    const passkeyRef = db.collection('users').doc(uid).collection('passkeys').doc(credentialId);
    const indexRef = db.collection('system').doc('webauthn').collection('credentials').doc(credentialId);

    const batch = db.batch();
    batch.set(passkeyRef, credentialDoc);
    batch.set(indexRef, { userId: uid, createdAt: now.toISOString() });
    if (challengeData.inviteToken) {
      const inviteRef = db.collection('system').doc('invites').collection('tokens').doc(challengeData.inviteToken);
      batch.update(inviteRef, { consumed: true, consumedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    await batch.commit();

    const customToken = await admin.auth().createCustomToken(uid);
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    res.json({
      token: customToken,
      user: {
        uid,
        email: userData.email || normalizedEmail,
        displayName: userData.name || userData.displayName || normalizedEmail,
      },
    });
  } catch (error) {
    logError('Passkey registration verify error:', error);
    res.status(500).json({ error: 'Failed to verify registration' });
  }
}

/**
 * POST /auth/passkey/login/options
 * Returns WebAuthn authentication options. Email optional (discoverable credentials).
 */
export async function authenticationOptions(req, res) {
  try {
    const { email } = req.body || {};
    const db = await getDb();
    cleanupExpiredChallenges(db);

    let allowCredentials = [];
    let userIdForChallenge = null;
    let emailForChallenge = null;

    if (email) {
      const normalizedEmail = (email || '').trim().toLowerCase();
      const user = await getUserByEmail(db, normalizedEmail);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      const passkeysSnap = await db.collection('users').doc(user.uid).collection('passkeys').get();
      allowCredentials = passkeysSnap.docs.map((d) => ({
        id: d.id,
        transports: d.data().transports || [],
      }));
      userIdForChallenge = user.uid;
      emailForChallenge = normalizedEmail;
    }

    const options = await generateAuthenticationOptions({
      rpID: webauthnConfig.rpID,
      allowCredentials: allowCredentials.length ? allowCredentials : undefined,
    });

    const challengeId = crypto.randomBytes(16).toString('hex');
    await storeChallenge(db, challengeId, {
      challenge: options.challenge,
      userId: userIdForChallenge,
      email: emailForChallenge,
      type: 'authentication',
    });

    res.json({ options, challengeId });
  } catch (error) {
    logError('Passkey login options error:', error);
    res.status(500).json({ error: 'Failed to generate authentication options' });
  }
}

/**
 * POST /auth/passkey/login/verify
 * Verifies authentication response, returns custom token.
 */
export async function authenticationVerify(req, res) {
  try {
    const { credential, challengeId } = req.body || {};
    if (!credential || !challengeId) {
      return res.status(400).json({ error: 'Credential and challengeId are required' });
    }

    const credentialId = credential.id;
    if (!credentialId) {
      return res.status(400).json({ error: 'Invalid credential response' });
    }

    const db = await getDb();
    const challengeData = await consumeChallenge(db, challengeId);
    if (!challengeData || challengeData.type !== 'authentication') {
      return res.status(401).json({ error: 'Invalid or expired challenge' });
    }

    // Look up user via credential index (O(1))
    const indexDoc = await db.collection('system').doc('webauthn').collection('credentials').doc(credentialId).get();
    if (!indexDoc.exists) {
      return res.status(401).json({ error: 'Credential not found' });
    }
    const { userId: uid } = indexDoc.data();

    if (challengeData.userId && challengeData.userId !== uid) {
      return res.status(401).json({ error: 'Credential does not belong to the expected user' });
    }

    const passkeyDoc = await db.collection('users').doc(uid).collection('passkeys').doc(credentialId).get();
    if (!passkeyDoc.exists) {
      return res.status(401).json({ error: 'Credential not found' });
    }
    const stored = passkeyDoc.data();
    const publicKeyBytes = new Uint8Array(Buffer.from(stored.publicKey, 'base64url'));

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge: challengeData.challenge,
        expectedOrigin: webauthnConfig.origin,
        expectedRPID: webauthnConfig.rpID,
        credential: {
          id: credentialId,
          publicKey: publicKeyBytes,
          counter: stored.counter,
          transports: stored.transports || [],
        },
      });
    } catch (err) {
      logError('Authentication verification failed:', err);
      return res.status(401).json({ error: 'Verification failed' });
    }

    if (!verification.verified) {
      return res.status(401).json({ error: 'Verification failed' });
    }

    const { newCounter } = verification.authenticationInfo;
    const now = getNow();

    await db.collection('users').doc(uid).collection('passkeys').doc(credentialId).update({
      counter: newCounter,
      lastUsedAt: now.toISOString(),
    });

    const customToken = await admin.auth().createCustomToken(uid);
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    res.json({
      token: customToken,
      user: {
        uid,
        email: userData.email || '',
        displayName: userData.name || userData.displayName || userData.email || '',
      },
    });
  } catch (error) {
    logError('Passkey login verify error:', error);
    res.status(500).json({ error: 'Failed to verify authentication' });
  }
}
