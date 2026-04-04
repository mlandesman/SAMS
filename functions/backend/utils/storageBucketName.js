/**
 * Firebase Storage bucket for uploads (reconciliation PDFs, imports, etc.).
 * Keep in sync with deployment target; used by multiple controllers/services.
 */
export function getStorageBucketName() {
  if (process.env.GCLOUD_PROJECT === 'sams-sandyland-prod' || process.env.NODE_ENV === 'production') {
    return 'sams-sandyland-prod.firebasestorage.app';
  }
  if (process.env.NODE_ENV === 'staging') {
    return 'sams-staging-6cdcd.firebasestorage.app';
  }
  return 'sandyland-management-system.firebasestorage.app';
}
