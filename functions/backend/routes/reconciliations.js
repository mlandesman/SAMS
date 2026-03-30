import express from 'express';
import multer from 'multer';
import {
  authenticateUserWithProfile,
  enforceClientAccess,
  requirePermission
} from '../middleware/clientAuth.js';
import {
  createSession,
  getSession,
  listSessions,
  updateSession,
  deleteSession,
  importBankFile,
  runMatch,
  resolveException,
  acceptSession
} from '../controllers/reconciliationController.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }
});

router.use(authenticateUserWithProfile);
router.use(enforceClientAccess);

function clientId(req) {
  return req.authorizedClientId || req.originalParams?.clientId || req.params.clientId;
}

router.get('/', requirePermission('accounts.manage'), async (req, res) => {
  try {
    const cid = clientId(req);
    const { accountId } = req.query;
    const sessions = await listSessions(cid, accountId || null);
    res.json({ success: true, sessions });
  } catch (error) {
    console.error('reconciliations list:', error);
    res.status(500).json({ success: false, error: error.message || 'Server error' });
  }
});

router.post('/', requirePermission('accounts.manage'), async (req, res) => {
  try {
    const cid = clientId(req);
    const session = await createSession(cid, req.body, req.user);
    res.status(201).json({ success: true, session });
  } catch (error) {
    console.error('reconciliations create:', error);
    res.status(400).json({ success: false, error: error.message || 'Server error' });
  }
});

router.get('/:sessionId', requirePermission('accounts.manage'), async (req, res) => {
  try {
    const cid = clientId(req);
    const includeRows = req.query.include === 'rows' || req.query.includeRows === '1';
    const session = await getSession(cid, req.params.sessionId, { includeRows });
    res.json({ success: true, session });
  } catch (error) {
    console.error('reconciliations get:', error);
    res.status(error.message?.includes('not found') ? 404 : 500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
});

router.put('/:sessionId', requirePermission('accounts.manage'), async (req, res) => {
  try {
    const cid = clientId(req);
    const session = await updateSession(cid, req.params.sessionId, req.body);
    res.json({ success: true, session });
  } catch (error) {
    console.error('reconciliations update:', error);
    res.status(400).json({ success: false, error: error.message || 'Server error' });
  }
});

router.delete('/:sessionId', requirePermission('accounts.manage'), async (req, res) => {
  try {
    const cid = clientId(req);
    const result = await deleteSession(cid, req.params.sessionId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('reconciliations delete:', error);
    res.status(400).json({ success: false, error: error.message || 'Server error' });
  }
});

router.post(
  '/:sessionId/import',
  requirePermission('accounts.manage'),
  upload.fields([
    { name: 'bankFile', maxCount: 1 },
    { name: 'statementPdf', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const cid = clientId(req);
      const result = await importBankFile(cid, req.params.sessionId, req.files, req.user);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error('reconciliations import:', error);
      res.status(400).json({ success: false, error: error.message || 'Server error' });
    }
  }
);

router.post('/:sessionId/match', requirePermission('accounts.manage'), async (req, res) => {
  try {
    const cid = clientId(req);
    const result = await runMatch(cid, req.params.sessionId);
    res.json(result);
  } catch (error) {
    console.error('reconciliations match:', error);
    res.status(400).json({ success: false, error: error.message || 'Server error' });
  }
});

router.put('/:sessionId/resolve', requirePermission('accounts.manage'), async (req, res) => {
  try {
    const cid = clientId(req);
    const result = await resolveException(cid, req.params.sessionId, req.body);
    res.json(result);
  } catch (error) {
    console.error('reconciliations resolve:', error);
    res.status(400).json({ success: false, error: error.message || 'Server error' });
  }
});

router.post('/:sessionId/accept', requirePermission('accounts.manage'), async (req, res) => {
  try {
    const cid = clientId(req);
    const result = await acceptSession(cid, req.params.sessionId, req.user, req.body || {});
    res.json(result);
  } catch (error) {
    console.error('reconciliations accept:', error);
    res.status(400).json({ success: false, error: error.message || 'Server error' });
  }
});

export default router;
