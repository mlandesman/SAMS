/**
 * Passkey (WebAuthn) and invite routes.
 * Mounted at /auth - all passkey routes are public (WebAuthn protocol handles auth).
 * Invite generation is admin-only.
 */

import { Router } from 'express';
import {
  registrationOptions,
  registrationVerify,
  authenticationOptions,
  authenticationVerify,
  listUserPasskeys,
  revokeUserPasskey,
} from '../controllers/passkeyController.js';
import { generateInvite } from '../controllers/inviteController.js';
import { authenticateUserWithProfile } from '../middleware/clientAuth.js';

const router = Router();

// Public — WebAuthn protocol handles authentication
router.post('/passkey/register/options', registrationOptions);
router.post('/passkey/register/verify', registrationVerify);
router.post('/passkey/login/options', authenticationOptions);
router.post('/passkey/login/verify', authenticationVerify);

// Admin-only
router.post('/invite', authenticateUserWithProfile, generateInvite);
router.get('/passkey/credentials/:userId', authenticateUserWithProfile, listUserPasskeys);
router.delete('/passkey/credentials/:userId/:credentialId', authenticateUserWithProfile, revokeUserPasskey);

export default router;
