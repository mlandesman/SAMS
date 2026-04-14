/**
 * Single contract for Firestore-backed login eligibility.
 *
 * Canonical field: `canLogin` (boolean). Undefined is treated as "legacy / unset"
 * and defaults to allowed unless legacy `loginEnabled === false` is present.
 *
 * `loginEnabled` is obsolete — read only for backward compatibility when
 * `canLogin` was never written.
 */

/**
 * @param {Record<string, unknown>|null|undefined} userData
 * @returns {boolean}
 */
export function isFirestoreLoginEligible(userData) {
  if (!userData) return false;
  if (userData.canLogin === false) return false;
  if (userData.canLogin === true) return true;
  if (userData.loginEnabled === false) return false;
  return true;
}
