/**
 * Canonical display-name resolution for SAMS user records (Firestore users collection shape).
 * Used by backend unit contact resolution and frontend owner/manager surfaces.
 *
 * Order: profile.firstName + profile.lastName, name, displayName, email (last resort for labels).
 */

export function getDisplayNameFromUser(userData = {}) {
  if (!userData || typeof userData !== 'object') return '';

  const profile = userData.profile || {};
  const firstName = typeof profile.firstName === 'string' ? profile.firstName.trim() : '';
  const lastName = typeof profile.lastName === 'string' ? profile.lastName.trim() : '';
  const fullName = `${firstName} ${lastName}`.trim();
  if (fullName) return fullName;

  if (typeof userData.name === 'string' && userData.name.trim()) {
    return userData.name.trim();
  }
  if (typeof userData.displayName === 'string' && userData.displayName.trim()) {
    return userData.displayName.trim();
  }
  if (typeof userData.email === 'string' && userData.email.trim()) {
    return userData.email.trim();
  }
  return '';
}
