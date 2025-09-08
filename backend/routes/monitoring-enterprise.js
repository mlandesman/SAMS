/**
 * Enterprise Monitoring API Routes
 * Comprehensive monitoring and diagnostics endpoints
 * Phase 3: Performance & Monitoring Implementation
 */

import express from 'express';
import { performanceMonitor } from '../utils/performance-monitor.js';
import { healthDiagnostics } from '../utils/health-diagnostics.js';
import { SecurityMonitor } from '../middleware/security-enterprise.js';
import { getConnectionPoolStats } from '../firebase-enterprise.js';
import { getBatchProcessorStats } from '../utils/batchOperations.js';

const router = express.Router();

/**
 * GET /api/monitoring/health
 * Quick health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    const health = healthDiagnostics.getCurrentHealth();
    const overallStatus = health.quick?.overallStatus || 'unknown';

    const statusCode = {
      'healthy': 200,
      'warning': 200,
      'critical': 503,
      'down': 503,
      'unknown': 503
    }[overallStatus] || 503;

    res.status(statusCode).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: health.quick?.results || [],
      lastUpdate: health.quick?.timestamp
    });

  } catch (error) {
    console.error('❌ Health check endpoint error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message
    });
  }
});

/**
 * GET /api/monitoring/health/detailed
 * Detailed health check with all systems
 */
router.get('/health/detailed', async (req, res) => {
  try {
    const health = healthDiagnostics.getCurrentHealth();
    const trends = healthDiagnostics.getHealthTrends();

    res.json({
      current: health.deep || health.quick,
      trends,
      history: health.history,
      lastQuickCheck: health.quick,
      lastDeepCheck: health.deep
    });

  } catch (error) {
    console.error('❌ Detailed health check endpoint error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Detailed health check failed',
      error: error.message
    });
  }
});

/**
 * POST /api/monitoring/health/check
 * Trigger on-demand health check
 */
router.post('/health/check', async (req, res) => {
  try {
    const healthCheck = await healthDiagnostics.performOnDemandCheck();

    res.json({
      message: 'On-demand health check completed',
      result: healthCheck
    });

  } catch (error) {
    console.error('❌ On-demand health check error:', error);
    res.status(500).json({
      status: 'error',
      message: 'On-demand health check failed',
      error: error.message
    });
  }
});

/**
 * GET /api/monitoring/performance
 * Current performance metrics
 */
router.get('/performance', async (req, res) => {
  try {
    const performanceStatus = performanceMonitor.getCurrentStatus();
    const aggregatedMetrics = performanceMonitor.getAggregatedMetrics();

    res.json({
      status: performanceStatus,
      metrics: aggregatedMetrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Performance metrics endpoint error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve performance metrics',
      error: error.message
    });
  }
});

/**
 * GET /api/monitoring/performance/summary
 * Performance summary with recommendations
 */
router.get('/performance/summary', async (req, res) => {
  try {
    const aggregatedMetrics = performanceMonitor.getAggregatedMetrics();

    res.json({
      summary: aggregatedMetrics.summary,
      period: aggregatedMetrics.period,
      recommendations: aggregatedMetrics.summary.recommendations,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Performance summary endpoint error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve performance summary',
      error: error.message
    });
  }
});

/**
 * GET /api/monitoring/security
 * Security metrics and incidents
 */
router.get('/security', async (req, res) => {
  try {
    const timeframe = parseInt(req.query.hours) || 24;
    const securityMetrics = await SecurityMonitor.getSecurityMetrics(timeframe);
    const underAttack = await SecurityMonitor.checkForAttacks();

    res.json({
      metrics: securityMetrics,
      underAttack,
      timeframe: `${timeframe} hours`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Security metrics endpoint error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve security metrics',
      error: error.message
    });
  }
});

/**
 * GET /api/monitoring/database
 * Database and connection pool metrics
 */
router.get('/database', async (req, res) => {
  try {
    const poolStats = getConnectionPoolStats();
    const batchStats = getBatchProcessorStats();

    res.json({
      connectionPool: poolStats,
      batchProcessor: batchStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Database metrics endpoint error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve database metrics',
      error: error.message
    });
  }
});

/**
 * GET /api/monitoring/system
 * System resource metrics
 */
router.get('/system', async (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptime = process.uptime();

    const systemMetrics = {
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
        heapUtilization: (memoryUsage.heapUsed / memoryUsage.heapTotal * 100).toFixed(2) + '%',
        rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
        external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB'
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: {
        seconds: Math.round(uptime),
        formatted: this.formatUptime(uptime)
      },
      process: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid
      },
      timestamp: new Date().toISOString()
    };

    res.json(systemMetrics);

  } catch (error) {
    console.error('❌ System metrics endpoint error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve system metrics',
      error: error.message
    });
  }
});

/**
 * GET /api/monitoring/dashboard
 * Comprehensive monitoring dashboard data
 */
router.get('/dashboard', async (req, res) => {
  try {
    const timeframe = parseInt(req.query.hours) || 1;

    // Gather all monitoring data
    const [
      health,
      performanceStatus,
      securityMetrics,
      poolStats,
      batchStats
    ] = await Promise.allSettled([
      Promise.resolve(healthDiagnostics.getCurrentHealth()),
      Promise.resolve(performanceMonitor.getCurrentStatus()),
      SecurityMonitor.getSecurityMetrics(timeframe),
      Promise.resolve(getConnectionPoolStats()),
      Promise.resolve(getBatchProcessorStats())
    ]);

    // Extract successful results
    const dashboard = {
      overview: {
        status: health.status === 'fulfilled' ? health.value.quick?.overallStatus || 'unknown' : 'error',
        healthScore: performanceStatus.status === 'fulfilled' ? performanceStatus.value.healthScore : 0,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      },
      health: health.status === 'fulfilled' ? health.value : null,
      performance: performanceStatus.status === 'fulfilled' ? performanceStatus.value : null,
      security: securityMetrics.status === 'fulfilled' ? securityMetrics.value : null,
      database: {
        connectionPool: poolStats.status === 'fulfilled' ? poolStats.value : null,
        batchProcessor: batchStats.status === 'fulfilled' ? batchStats.value : null
      },
      system: {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        version: process.version
      },
      alerts: {
        critical: [],
        warnings: []
      }
    };

    // Collect alerts from various sources
    if (health.status === 'fulfilled' && health.value.quick) {
      const criticalChecks = health.value.quick.results?.filter(r => r.status === 'critical' || r.status === 'down') || [];
      const warningChecks = health.value.quick.results?.filter(r => r.status === 'warning') || [];

      dashboard.alerts.critical.push(...criticalChecks.map(c => ({ source: 'health', message: `${c.name}: ${c.message}` })));
      dashboard.alerts.warnings.push(...warningChecks.map(c => ({ source: 'health', message: `${c.name}: ${c.message}` })));
    }

    if (securityMetrics.status === 'fulfilled' && securityMetrics.value) {
      const criticalIncidents = securityMetrics.value.severityBreakdown?.critical || 0;
      if (criticalIncidents > 0) {
        dashboard.alerts.critical.push({
          source: 'security',
          message: `${criticalIncidents} critical security incidents in last ${timeframe} hour(s)`
        });
      }
    }

    res.json(dashboard);

  } catch (error) {
    console.error('❌ Dashboard endpoint error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve dashboard data',
      error: error.message
    });
  }
});

/**
 * GET /api/monitoring/metrics/export
 * Export metrics for external monitoring systems
 */
router.get('/metrics/export', async (req, res) => {
  try {
    const format = req.query.format || 'json';
    const timeframe = parseInt(req.query.hours) || 1;

    const metrics = {
      timestamp: new Date().toISOString(),
      timeframe: `${timeframe} hours`,
      performance: performanceMonitor.getCurrentStatus(),
      health: healthDiagnostics.getCurrentHealth(),
      security: await SecurityMonitor.getSecurityMetrics(timeframe),
      database: {
        connectionPool: getConnectionPoolStats(),
        batchProcessor: getBatchProcessorStats()
      },
      system: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        uptime: process.uptime()
      }
    };

    if (format === 'prometheus') {
      // Convert to Prometheus format
      const prometheusMetrics = this.convertToPrometheus(metrics);
      res.set('Content-Type', 'text/plain');
      res.send(prometheusMetrics);
    } else {
      res.json(metrics);
    }

  } catch (error) {
    console.error('❌ Metrics export endpoint error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to export metrics',
      error: error.message
    });
  }
});

/**
 * Helper function to format uptime
 */
function formatUptime(uptimeSeconds) {
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Convert metrics to Prometheus format
 */
function convertToPrometheus(metrics) {
  const lines = [];

  // System metrics
  lines.push(`# HELP sams_memory_heap_used Memory heap used in bytes`);
  lines.push(`# TYPE sams_memory_heap_used gauge`);
  lines.push(`sams_memory_heap_used ${metrics.system.memory.heapUsed}`);

  lines.push(`# HELP sams_memory_heap_total Memory heap total in bytes`);
  lines.push(`# TYPE sams_memory_heap_total gauge`);
  lines.push(`sams_memory_heap_total ${metrics.system.memory.heapTotal}`);

  lines.push(`# HELP sams_uptime_seconds Process uptime in seconds`);
  lines.push(`# TYPE sams_uptime_seconds counter`);
  lines.push(`sams_uptime_seconds ${metrics.system.uptime}`);

  // Performance metrics
  if (metrics.performance) {
    lines.push(`# HELP sams_health_score Overall health score (0-100)`);
    lines.push(`# TYPE sams_health_score gauge`);
    lines.push(`sams_health_score ${metrics.performance.healthScore}`);

    lines.push(`# HELP sams_active_requests Current active requests`);
    lines.push(`# TYPE sams_active_requests gauge`);
    lines.push(`sams_active_requests ${metrics.performance.activeRequests}`);
  }

  // Database metrics
  if (metrics.database.connectionPool) {
    lines.push(`# HELP sams_db_connections_active Active database connections`);
    lines.push(`# TYPE sams_db_connections_active gauge`);
    lines.push(`sams_db_connections_active ${metrics.database.connectionPool.activeConnections}`);

    lines.push(`# HELP sams_db_connections_total Total database connections created`);
    lines.push(`# TYPE sams_db_connections_total counter`);
    lines.push(`sams_db_connections_total ${metrics.database.connectionPool.totalConnections}`);
  }

  // Security metrics
  if (metrics.security) {
    lines.push(`# HELP sams_security_incidents_total Total security incidents`);
    lines.push(`# TYPE sams_security_incidents_total counter`);
    lines.push(`sams_security_incidents_total ${metrics.security.totalIncidents}`);

    if (metrics.security.severityBreakdown) {
      Object.entries(metrics.security.severityBreakdown).forEach(([severity, count]) => {
        lines.push(`sams_security_incidents_total{severity="${severity}"} ${count}`);
      });
    }
  }

  return lines.join('\n') + '\n';
}

export default router;