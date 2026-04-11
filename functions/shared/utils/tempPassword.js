/**
 * Temporary password generation for SAMS (issue #275).
 * Charset excludes HTML-dangerous characters at minimum: & and # (email/template safety).
 * Uses crypto.randomInt for uniform selection (Node 12+).
 */

import crypto from 'crypto';

/** Allowed characters for temp passwords shown in HTML email and UI. */
export const TEMP_PASSWORD_CHARSET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@$%^*';

/**
 * @param {number} [length=12]
 * @returns {string}
 */
export function generateSecureTempPassword(length = 12) {
  if (length < 1) {
    throw new RangeError('generateSecureTempPassword: length must be >= 1');
  }
  const n = TEMP_PASSWORD_CHARSET.length;
  let password = '';
  for (let i = 0; i < length; i++) {
    password += TEMP_PASSWORD_CHARSET.charAt(crypto.randomInt(0, n));
  }
  return password;
}
