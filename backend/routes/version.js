import express from 'express';
import { getNow } from '../services/DateService.js';
import fs from 'fs';
import path from 'path';

const router = express.Router();

/**
 * Get version information from shared version.json file
 */
function getVersionInfo() {
  try {
    // Try to read from shared version.json (included in vercel.json)
    const versionPath = path.join(process.cwd(), '../shared/version.json');
    if (fs.existsSync(versionPath)) {
      const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
      return {
        version: versionData.version || '0.0.1',
        buildDate: versionData.buildDate || versionData.build?.timestamp || getNow().toISOString(),
        gitHash: versionData.git?.hash || versionData.gitCommit || 'unknown',
        gitBranch: versionData.git?.branch || versionData.gitBranch || 'unknown'
      };
    }
  } catch (error) {
    console.warn('Could not read shared version.json:', error.message);
  }
  
  // Fallback to environment variables or defaults
  return {
    version: process.env.VITE_APP_VERSION || process.env.npm_package_version || '0.0.1',
    buildDate: process.env.VITE_APP_BUILD_DATE || getNow().toISOString(),
    gitHash: process.env.VITE_APP_GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || 'unknown',
    gitBranch: process.env.VERCEL_GIT_COMMIT_REF || 'unknown'
  };
}

/**
 * Version endpoint - returns deployment version information
 * GET /api/version
 */
router.get('/', async (req, res) => {
  try {
    // Get version info from shared version.json or fallback to environment variables
    const versionInfo = getVersionInfo();
    
    // Version info embedded at build time
    const backendVersion = {
      component: 'backend',
      version: versionInfo.version,
      buildDate: versionInfo.buildDate,
      git: {
        hash: versionInfo.gitHash,
        branch: versionInfo.gitBranch
      },
      endpoint: '/api/version',
      deploymentTime: getNow().toISOString(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
      // Add deployment URL info
      deploymentUrl: process.env.VERCEL_URL || 'localhost',
      region: process.env.VERCEL_REGION || 'local',
      // Vercel deployment info
      vercel: {
        env: process.env.VERCEL_ENV || 'development',
        gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA,
        gitCommitRef: process.env.VERCEL_GIT_COMMIT_REF,
        gitCommitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE
      }
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
 * GET /api/version/health
 */
router.get('/health', async (req, res) => {
  try {
    const versionInfo = getVersionInfo();
    
    res.json({
      status: 'healthy',
      component: 'backend',
      version: versionInfo.version,
      gitCommit: versionInfo.gitHash,
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
export { getVersionInfo };