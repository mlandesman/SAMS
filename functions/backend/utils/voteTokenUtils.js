import crypto from 'crypto';
import { getNow } from '../services/DateService.js';

const DEFAULT_SECRET = 'default-insecure-vote-token-secret';

function getTokenSecret() {
  const secret = process.env.VOTE_TOKEN_SECRET || DEFAULT_SECRET;
  if (secret === DEFAULT_SECRET) {
    console.warn('⚠️  VOTE_TOKEN_SECRET not set; using default development secret.');
  }
  return secret;
}

/**
 * Generate a vote token for a specific client/poll/unit combination.
 * @param {string} clientId
 * @param {string} pollId
 * @param {string} unitId
 * @param {Date} expiresAt
 * @returns {string}
 */
export function generateVoteToken(clientId, pollId, unitId, expiresAt) {
  if (!clientId || !pollId || !unitId) {
    throw new Error('Missing parameters for vote token generation');
  }

  const expiryDate = expiresAt instanceof Date ? expiresAt : getNow();

  const payload = {
    c: clientId,
    p: pollId,
    u: unitId,
    e: expiryDate.getTime(),
  };

  const payloadStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadStr).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getTokenSecret())
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

/**
 * Validate and decode a vote token
 * @param {string} token
 * @returns {{ valid: boolean, payload?: { clientId: string, pollId: string, unitId: string, expiresAt: Date }, error?: string }}
 */
export function validateVoteToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token is required' };
  }

  try {
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) {
      return { valid: false, error: 'Invalid token format' };
    }

    const expectedSignature = crypto
      .createHmac('sha256', getTokenSecret())
      .update(payloadB64)
      .digest('base64url');

    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid signature' };
    }

    const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadStr);

    if (!payload?.c || !payload?.p || !payload?.u || !payload?.e) {
      return { valid: false, error: 'Invalid token payload' };
    }

    if (getNow().getTime() > payload.e) {
      return { valid: false, error: 'Token expired' };
    }

    return {
      valid: true,
      payload: {
        clientId: payload.c,
        pollId: payload.p,
        unitId: payload.u,
        expiresAt: new Date(payload.e),
      },
    };
  } catch (error) {
    console.error('❌ Error validating vote token:', error);
    return { valid: false, error: 'Token parsing error' };
  }
}
