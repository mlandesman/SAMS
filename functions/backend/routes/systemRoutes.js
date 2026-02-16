/**
 * System Error Monitor API routes — mounted at /error-reporting
 * POST /log — Frontend error capture (any authenticated user)
 * GET / — Fetch errors (SuperAdmin only, ?all=true for full history)
 * PUT /acknowledge-all — Acknowledge all errors (SuperAdmin only)
 * PUT /:errorId/acknowledge — Acknowledge single error (SuperAdmin only)
 */

import express from 'express';
import { getDb } from '../firebase.js';
import { authenticateUserWithProfile } from '../middleware/clientAuth.js';
import { logInfo } from '../../shared/logger.js';
import {
  getUnacknowledgedErrors,
  getAllErrors,
  getUnacknowledgedErrorCount,
  acknowledgeError,
  acknowledgeAllErrors
} from '../services/errorCaptureService.js';
import admin from 'firebase-admin';

const router = express.Router();

function isSuperAdmin(req) {
  const profile = req.user?.samsProfile || req.userProfile;
  return (
    profile?.globalRole === 'superAdmin' ||
    req.user?.email === 'michael@landesman.com' ||
    profile?.email === 'michael@landesman.com'
  );
}

function requireSuperAdmin(req, res, next) {
  if (!isSuperAdmin(req)) {
    return res.status(403).json({ error: 'SuperAdmin access required' });
  }
  next();
}

// POST /error-reporting/log — Frontend error capture (any authenticated user)
router.post('/log', authenticateUserWithProfile, async (req, res) => {
  try {
    const { source = 'frontend', module: mod, message, details } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    const db = await getDb();
    const doc = {
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      source: String(source).substring(0, 50) || 'frontend',
      module: String(mod || 'general').substring(0, 50),
      level: 'error',
      message: String(message).substring(0, 500),
      details: details ? String(details).substring(0, 2000) : '',
      acknowledged: false,
      acknowledgedBy: null,
      acknowledgedAt: null,
      // Schema expansion — store if provided
      userAgent: req.body.userAgent ? String(req.body.userAgent).substring(0, 300) : null,
      url: req.body.url ? String(req.body.url).substring(0, 500) : null,
      version: req.body.version ? String(req.body.version).substring(0, 50) : null,
      environment: req.body.environment ? String(req.body.environment).substring(0, 20) : null,
    };

    const ref = await db.collection('systemErrors').add(doc);
    logInfo('📥 Frontend error captured', { id: ref.id, module: doc.module });
    return res.status(201).json({ id: ref.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /error-reporting — Fetch errors (SuperAdmin only)
// ?all=true  → return ALL errors (acknowledged + unacknowledged)
// ?all=false → return only unacknowledged (default)
// ?limit=50  → max results (default 50, max 200)
router.get('/', authenticateUserWithProfile, requireSuperAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const includeAll = req.query.all === 'true';
    const db = await getDb();

    let errors;
    if (includeAll) {
      errors = await getAllErrors(db, limit);
    } else {
      errors = await getUnacknowledgedErrors(db, limit);
    }
    const count = await getUnacknowledgedErrorCount(db);
    return res.json({ errors, count });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /error-reporting/acknowledge-all — Must be before :errorId route
router.put('/acknowledge-all', authenticateUserWithProfile, requireSuperAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const userId = req.user?.uid || req.user?.samsProfile?.id || 'unknown';
    const acknowledged = await acknowledgeAllErrors(db, userId);
    return res.json({ acknowledged });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /error-reporting/:errorId/acknowledge — Acknowledge single error (SuperAdmin only)
router.put('/:errorId/acknowledge', authenticateUserWithProfile, requireSuperAdmin, async (req, res) => {
  try {
    const { errorId } = req.params;
    const db = await getDb();
    const userId = req.user?.uid || req.user?.samsProfile?.id || 'unknown';
    await acknowledgeError(db, errorId, userId);
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
