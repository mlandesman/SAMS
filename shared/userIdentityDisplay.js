/**
 * Canonical display-name resolution for SAMS user records (Firestore users collection shape).
 * Used by backend unit contact resolution and frontend owner/manager surfaces.
 *
 * Order: profile.firstName + profile.lastName, profile.displayName, contactName, name, displayName, email (last resort for labels).
 * Non-string field values are coerced (Firestore may store legacy scalars).
 */

function strField(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v).trim();
  return '';
}

export function getDisplayNameFromUser(userData = {}) {
  if (!userData || typeof userData !== 'object') return '';

  const profile = userData.profile || {};
  const firstName = strField(profile.firstName);
  const lastName = strField(profile.lastName);
  const fullName = `${firstName} ${lastName}`.trim();
  if (fullName) return fullName;

  const profileDisplayName = strField(profile.displayName);
  if (profileDisplayName) return profileDisplayName;

  const contactName = strField(userData.contactName);
  if (contactName) return contactName;

  const name = strField(userData.name);
  if (name) return name;

  const displayName = strField(userData.displayName);
  if (displayName) return displayName;

  const email = strField(userData.email);
  if (email) return email;

  return '';
}
