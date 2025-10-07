import express from 'express';
import { getNow } from '../services/DateService.js';

const router = express.Router();

/**
 * Version endpoint - returns deployment version information
 * GET /api/version
 */
router.get('/', async (req, res) => {
  try {
    // Version info embedded at build time
    const backendVersion = {
      component: 'backend',
      version: process.env.VITE_APP_VERSION || '0.0.1',
      buildDate: process.env.VITE_APP_BUILD_DATE || getNow().toISOString(),
      git: {
        hash: process.env.VITE_APP_GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || 'unknown',
        branch: process.env.VERCEL_GIT_COMMIT_REF || 'unknown'
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
    res.json({
      status: 'healthy',
      component: 'backend',
      version: process.env.VITE_APP_VERSION || '0.0.1',
      gitCommit: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || 'unknown',
      buildDate: getNow().toISOString(),
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