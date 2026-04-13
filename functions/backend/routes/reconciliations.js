import express from 'express';
import Busboy from 'busboy';
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
  acceptSession,
  manualPairSession,
  excludeFromReconciliation,
  getWorkbench,
  applyMatchGapAdjustment,
  regenerateReconciliationReport
} from '../controllers/reconciliationController.js';

const router = express.Router();
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const MAX_MULTIPART_BYTES = (MAX_UPLOAD_BYTES * 2) + (2 * 1024 * 1024); // bank + optional pdf + form overhead
const ALLOWED_UPLOAD_FIELDS = new Set(['bankFile', 'statementPdf']);

class UploadParseError extends Error {
  constructor(code, message, phase = 'parse') {
    super(message);
    this.name = 'UploadParseError';
    this.code = code;
    this.phase = phase;
    this.status = 400;
  }
}

function uploadLog(req, stage, payload = {}) {
  const cid = clientId(req);
  const sid = req.params?.sessionId || null;
  const contentType = req.headers['content-type'] || null;
  const contentLength = req.headers['content-length'] || null;
  const rawBodyLength = Buffer.isBuffer(req.rawBody) ? req.rawBody.length : 0;
  console.log('[reconciliation.import.upload]', JSON.stringify({
    stage,
    route: 'POST /clients/:clientId/reconciliations/:sessionId/import',
    clientId: cid,
    sessionId: sid,
    contentType,
    contentLength,
    rawBodyPresent: Buffer.isBuffer(req.rawBody),
    rawBodyLength,
    ...payload
  }));
}

async function parseImportMultipartFromRawBody(req) {
  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (!contentType.startsWith('multipart/form-data')) {
    throw new UploadParseError(
      'UPLOAD_PARSE_FAILED',
      'Expected multipart/form-data content type.',
      'content-type'
    );
  }

  const uploadBody = await resolveMultipartBody(req);

  return new Promise((resolve, reject) => {
    let failed = false;
    const parsedFiles = {
      bankFile: [],
      statementPdf: []
    };
    const fileCountByField = {
      bankFile: 0,
      statementPdf: 0
    };

    const fail = (code, message, phase) => {
      if (failed) return;
      failed = true;
      reject(new UploadParseError(code, message, phase));
    };

    const bb = Busboy({
      headers: req.headers,
      limits: {
        files: 2,
        fileSize: MAX_UPLOAD_BYTES
      }
    });

    bb.on('file', (fieldname, file, info) => {
      if (!ALLOWED_UPLOAD_FIELDS.has(fieldname)) {
        file.resume();
        fail('UPLOAD_INVALID_FIELD', `Unexpected file field "${fieldname}".`, 'file-field');
        return;
      }
      fileCountByField[fieldname] += 1;
      if (fileCountByField[fieldname] > 1) {
        file.resume();
        fail('UPLOAD_TOO_MANY_FILES', `Too many files provided for "${fieldname}".`, 'file-count');
        return;
      }

      const chunks = [];
      let size = 0;

      file.on('data', (chunk) => {
        size += chunk.length;
        chunks.push(chunk);
      });
      file.on('limit', () => {
        fail('UPLOAD_PARSE_FAILED', `File too large for "${fieldname}".`, 'file-size');
      });
      file.on('error', (error) => {
        fail('UPLOAD_PARSE_FAILED', `Failed to read "${fieldname}" upload (${error.message}).`, 'file-stream');
      });
      file.on('end', () => {
        if (failed) return;
        const buffer = Buffer.concat(chunks);
        parsedFiles[fieldname].push({
          fieldname,
          originalname: info?.filename || '',
          mimetype: info?.mimeType || 'application/octet-stream',
          encoding: info?.encoding || '7bit',
          buffer,
          size
        });
      });
    });

    bb.on('error', (error) => {
      fail('UPLOAD_PARSE_FAILED', `Failed to parse multipart upload (${error.message}).`, 'busboy');
    });

    bb.on('finish', () => {
      if (failed) return;

      if (parsedFiles.bankFile.length === 0) {
        fail('UPLOAD_MISSING_BANK_FILE', 'bankFile upload is required.', 'contract');
        return;
      }
      if (!parsedFiles.bankFile[0].size) {
        fail('UPLOAD_EMPTY_FILE', 'bankFile upload is empty.', 'contract');
        return;
      }
      if (parsedFiles.statementPdf[0] && !parsedFiles.statementPdf[0].size) {
        fail('UPLOAD_EMPTY_FILE', 'statementPdf upload is empty.', 'contract');
        return;
      }

      const files = { bankFile: parsedFiles.bankFile };
      if (parsedFiles.statementPdf.length > 0) {
        files.statementPdf = parsedFiles.statementPdf;
      }
      resolve({
        files,
        bodySource: uploadBody.source,
        bodyLength: uploadBody.buffer.length
      });
    });

    try {
      bb.end(uploadBody.buffer);
    } catch (error) {
      fail('UPLOAD_PARSE_FAILED', `Failed to process raw upload body (${error.message}).`, 'raw-body');
    }
  });
}

async function importUploadParser(req, res, next) {
  uploadLog(req, 'attempt');
  try {
    const parsed = await parseImportMultipartFromRawBody(req);
    req.files = parsed.files;
    uploadLog(req, 'parsed', {
      bodySource: parsed.bodySource,
      bodyLength: parsed.bodyLength,
      parsedFiles: {
        bankFile: req.files.bankFile.map((f) => ({
          originalname: f.originalname,
          mimetype: f.mimetype,
          size: f.size
        })),
        statementPdf: (req.files.statementPdf || []).map((f) => ({
          originalname: f.originalname,
          mimetype: f.mimetype,
          size: f.size
        }))
      }
    });
    return next();
  } catch (error) {
    const code = error?.code || 'UPLOAD_PARSE_FAILED';
    const message = error?.message || 'Failed to parse upload.';
    const phase = error?.phase || 'unknown';
    uploadLog(req, 'failed', { code, phase, error: message });
    return res.status(400).json({ success: false, error: message, code });
  }
}

async function resolveMultipartBody(req) {
  if (Buffer.isBuffer(req.rawBody) && req.rawBody.length > 0) {
    return { source: 'rawBody', buffer: req.rawBody };
  }

  const buffered = await readRequestStreamToBuffer(req);
  if (!buffered.length) {
    throw new UploadParseError(
      'UPLOAD_PARSE_FAILED',
      'Missing upload payload for multipart parsing.',
      'raw-body'
    );
  }
  return { source: 'request-stream', buffer: buffered };
}

function readRequestStreamToBuffer(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    let done = false;

    const cleanup = () => {
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      req.removeListener('error', onError);
      req.removeListener('aborted', onAborted);
    };

    const fail = (error) => {
      if (done) return;
      done = true;
      cleanup();
      reject(error);
    };

    const succeed = () => {
      if (done) return;
      done = true;
      cleanup();
      resolve(Buffer.concat(chunks));
    };

    const onData = (chunk) => {
      total += chunk.length;
      if (total > MAX_MULTIPART_BYTES) {
        fail(new UploadParseError(
          'UPLOAD_PARSE_FAILED',
          `Multipart payload exceeds ${MAX_MULTIPART_BYTES} bytes.`,
          'raw-body'
        ));
        return;
      }
      chunks.push(chunk);
    };

    const onEnd = () => succeed();
    const onError = (error) =>
      fail(new UploadParseError(
        'UPLOAD_PARSE_FAILED',
        `Failed to read multipart request stream (${error.message}).`,
        'raw-body'
      ));
    const onAborted = () =>
      fail(new UploadParseError(
        'UPLOAD_PARSE_FAILED',
        'Multipart request stream was aborted before completion.',
        'raw-body'
      ));

    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
    req.on('aborted', onAborted);
  });
}

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

router.get('/:sessionId/workbench', requirePermission('accounts.manage'), async (req, res) => {
  try {
    const cid = clientId(req);
    const data = await getWorkbench(cid, req.params.sessionId);
    res.json(data);
  } catch (error) {
    console.error('reconciliations workbench:', error);
    res.status(error.message?.includes('not found') ? 404 : 500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
});

router.post('/:sessionId/manual-pair', requirePermission('accounts.manage'), async (req, res) => {
  try {
    const cid = clientId(req);
    const result = await manualPairSession(cid, req.params.sessionId, req.body || {});
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('reconciliations manual-pair:', error);
    res.status(400).json({ success: false, error: error.message || 'Server error' });
  }
});

router.post('/:sessionId/match-gap-adjustment', requirePermission('accounts.manage'), async (req, res) => {
  try {
    const cid = clientId(req);
    const result = await applyMatchGapAdjustment(cid, req.params.sessionId, req.body || {}, req.user);
    res.json(result);
  } catch (error) {
    console.error('reconciliations match-gap-adjustment:', error);
    res.status(400).json({ success: false, error: error.message || 'Server error' });
  }
});

router.post('/:sessionId/regenerate-report', requirePermission('accounts.manage'), async (req, res) => {
  try {
    const cid = clientId(req);
    const result = await regenerateReconciliationReport(cid, req.params.sessionId, req.user);
    res.json(result);
  } catch (error) {
    console.error('reconciliations regenerate-report:', error);
    res.status(400).json({ success: false, error: error.message || 'Server error' });
  }
});

router.post('/:sessionId/exclude', requirePermission('accounts.manage'), async (req, res) => {
  try {
    const cid = clientId(req);
    const result = await excludeFromReconciliation(cid, req.params.sessionId, req.body || {});
    res.json(result);
  } catch (error) {
    console.error('reconciliations exclude:', error);
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
  importUploadParser,
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
