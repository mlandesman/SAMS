/**
 * Charset / generation checks for issue #275 (HTML-safe temp passwords).
 * Run: node --test functions/shared/utils/__tests__/tempPassword.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  TEMP_PASSWORD_CHARSET,
  generateSecureTempPassword
} from '../tempPassword.js';

const BLOCKED = ['&', '#'];

describe('tempPassword', () => {
  it('charset excludes & and #', () => {
    for (const ch of BLOCKED) {
      assert.ok(!TEMP_PASSWORD_CHARSET.includes(ch), `must not include ${ch}`);
    }
  });

  it('generated passwords use only charset and default length 12', () => {
    for (let i = 0; i < 500; i++) {
      const p = generateSecureTempPassword();
      assert.strictEqual(p.length, 12);
      for (const ch of p) {
        assert.ok(
          TEMP_PASSWORD_CHARSET.includes(ch),
          `unexpected char ${ch} in ${p}`
        );
      }
      for (const b of BLOCKED) {
        assert.ok(!p.includes(b), `blocked ${b} in ${p}`);
      }
    }
  });

  it('respects custom length', () => {
    assert.strictEqual(generateSecureTempPassword(8).length, 8);
  });
});
