import express from 'express';
import { getNow } from '../services/DateService.js';
import { getVersionInfo } from '../../shared/utils/versionUtils.js';

const router = express.Router();

/**
 * Version endpoint - returns deployment version information
 * GET /system/version
 */
router.get('/', async (req, res) => {
  try {
    // Get version from shared/version.json via versionUtils
    const versionInfo = getVersionInfo();
    
    // Detect production via GCLOUD_PROJECT (Firebase Cloud Functions)
    const isProduction = process.env.GCLOUD_PROJECT === 'sams-sandyland-prod';
    
    const backendVersion = {
      component: 'backend',
      version: versionInfo.version,
      buildDate: versionInfo.buildDate,
      buildNumber: versionInfo.build?.buildNumber || 'unknown',
      git: versionInfo.git || { hash: 'unknown', branch: 'unknown' },
      endpoint: '/system/version',
      deploymentTime: getNow().toISOString(),
      nodeVersion: process.version,
      environment: isProduction ? 'production' : (process.env.NODE_ENV || 'development'),
      // Full version display
      versionDisplay: versionInfo.versionDisplay,
      fullVersionDisplay: versionInfo.fullVersionDisplay,
      // App metadata
      appName: versionInfo.appName,
      shortName: versionInfo.shortName,
      companyName: versionInfo.companyName
    };
    
    res.json(backendVersion);
  } catch (error) {
    console.error('Error generating version info:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve version information',
      component: 'backend',
      timestamp: getNow().toISOString()
    });
  }
});

/**
 * Health check endpoint with version info
 * GET /system/version/health
 */
router.get('/health', async (req, res) => {
  try {
    const versionInfo = getVersionInfo();
    res.json({
      status: 'healthy',
      component: 'backend',
      version: versionInfo.version,
      gitCommit: versionInfo.git?.hash || 'unknown',
      buildNumber: versionInfo.build?.buildNumber || 'unknown',
      buildDate: versionInfo.buildDate,
      uptime: process.uptime(),
      timestamp: getNow().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      component: 'backend',
      error: error.message,
      timestamp: getNow().toISOString()
    });
  }
});

export default router;