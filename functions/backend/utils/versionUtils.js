import versionConfig from '../../shared/version.json' with { type: 'json' };

/**
 * Get version information for backend API endpoints
 * Simplified version without browser-specific code
 * @returns {Object} Version information
 */
export const getVersionInfo = () => {
  // Detect production via GCLOUD_PROJECT (Firebase Cloud Functions)
  const isProduction = process.env.GCLOUD_PROJECT === 'sams-sandyland-prod';
  const environment = isProduction ? 'production' : (process.env.NODE_ENV || 'development');

  return {
    ...versionConfig,
    environment,
    versionDisplay: `v${versionConfig.version}`,
    fullVersionDisplay: `${versionConfig.shortName} v${versionConfig.version} (${environment})`
  };
};

export default { getVersionInfo };
