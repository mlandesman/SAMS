/**
 * Legacy operator bootstrap identity (Firestore may omit globalRole).
 * Must stay aligned with `frontend/sams-ui/src/utils/userRoles.js` (LEGACY_SUPERADMIN_EMAIL).
 */
export const LEGACY_SUPERADMIN_EMAIL = 'michael@landesman.com';

export function isLegacySuperAdminEmail(email) {
  return typeof email === 'string' && email.toLowerCase() === LEGACY_SUPERADMIN_EMAIL;
}
