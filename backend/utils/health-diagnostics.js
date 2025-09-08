/**
 * Enterprise Health Diagnostics System
 * Comprehensive system health monitoring and diagnostics
 * Phase 3: Performance & Monitoring Implementation
 */

import { getDbEnterprise, releaseDbConnection, getConnectionPoolStats, performHealthCheck } from '../firebase-enterprise.js';
import { getBatchProcessorStats } from '../utils/batchOperations.js';
import { SecurityMonitor } from '../middleware/security-enterprise.js';
import { performanceMonitor } from './performance-monitor.js';

// Health check configuration
const HEALTH_CONFIG = {

  quickCheckInterval: 30000,    // 30 seconds
  deepCheckInterval: 300000,    // 5 minutes

  // Timeout settings
  timeouts: {
    database: 5000,      // 5 seconds
    api: 3000,           // 3 seconds
    memory: 1000,        // 1 second
    disk: 2000           // 2 seconds
  },

  // Health thresholds
  thresholds: {
    database: {
      responseTime: 1000,        // 1 second
      connectionUtilization: 80, // 80%
      errorRate: 1              // 1%
    },
    memory: {
      heapUtilization: 85,      // 85%
      rssLimit: 2 * 1024 * 1024 * 1024, // 2GB
      growthRate: 10            // 10% per minute
    },
    api: {
      responseTime: 2000,       // 2 seconds
      errorRate: 5,             // 5%
      throughput: 1             // 1 req/sec minimum
    },
    security: {
      incidentsPerHour: 50,     // 50 incidents per hour
      criticalIncidents: 5      // 5 critical incidents per hour
    }
  },

  // Diagnostic levels
  levels: {
    HEALTHY: 'healthy',
    WARNING: 'warning',
    CRITICAL: 'critical',
    DOWN: 'down'
  }
};

/**
 * Health check result structure
 */
class HealthCheckResult {
  constructor(name) {
    this.name = name;
    this.status = HEALTH_CONFIG.levels.HEALTHY;
    this.message = 'OK';
    this.details = {};
    this.metrics = {};
    this.timestamp = new Date().toISOString();
    this.duration = 0;
    this.error = null;
  }

  setWarning(message, details = {}) {
    this.status = HEALTH_CONFIG.levels.WARNING;
    this.message = message;
    this.details = { ...this.details, ...details };
  }

  setCritical(message, details = {}) {
    this.status = HEALTH_CONFIG.levels.CRITICAL;
    this.message = message;
    this.details = { ...this.details, ...details };
  }

  setDown(message, error = null) {
    this.status = HEALTH_CONFIG.levels.DOWN;
    this.message = message;
    this.error = error ? error.message : null;
  }

  setMetrics(metrics) {
    this.metrics = metrics;
  }

  setDuration(duration) {
    this.duration = duration;
  }
}

/**
 * Individual health checkers
 */
class HealthCheckers {
  /**
   * Check database health
   */
  static async checkDatabase() {
    const result = new HealthCheckResult('database');
    const startTime = Date.now();

    try {
      // Test database connectivity
      const dbHealthCheck = await Promise.race([
        performHealthCheck(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Database health check timeout')),
          HEALTH_CONFIG.timeouts.database)
        )
      ]);

      const duration = Date.now() - startTime;
      result.setDuration(duration);

      if (!dbHealthCheck.healthy) {
        result.setCritical('Database health check failed', dbHealthCheck);
        return result;
      }

      const poolStats = getConnectionPoolStats();
      const poolUtilization = poolStats.activeConnections && poolStats.totalConnections ?
        (poolStats.activeConnections / 100 * 100) : 0; // Assuming max 100 from config

      result.setMetrics({
        responseTime: duration,
        poolUtilization: poolUtilization.toFixed(2) + '%',
        activeConnections: poolStats.activeConnections,
        totalConnections: poolStats.totalConnections,
        failedConnections: poolStats.failedConnections,
        successRate: poolStats.successRate
      });

      if (duration > HEALTH_CONFIG.thresholds.database.responseTime) {
        result.setWarning(`Slow database response: ${duration}ms`);
      }

      if (poolUtilization > HEALTH_CONFIG.thresholds.database.connectionUtilization) {
        result.setCritical(`High connection pool utilization: ${poolUtilization.toFixed(2)}%`);
      }

      const successRate = parseFloat(poolStats.successRate?.replace('%', '') || '100');
      const errorRate = 100 - successRate;
      if (errorRate > HEALTH_CONFIG.thresholds.database.errorRate) {
        result.setCritical(`High database error rate: ${errorRate.toFixed(2)}%`);
      }

    } catch (error) {
      result.setDown('Database connection failed', error);
      result.setDuration(Date.now() - startTime);
    }

    return result;
  }

  /**
   * Check memory health
   */
  static async checkMemory() {
    const result = new HealthCheckResult('memory');
    const startTime = Date.now();

    try {
      const memoryUsage = process.memoryUsage();
      const heapUtilization = (memoryUsage.heapUsed / memoryUsage.heapTotal * 100);

      result.setMetrics({
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
        heapUtilization: heapUtilization.toFixed(2) + '%',
        rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
        external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB'
      });

      if (heapUtilization > HEALTH_CONFIG.thresholds.memory.heapUtilization) {
        result.setCritical(`High heap utilization: ${heapUtilization.toFixed(2)}%`);
      } else if (heapUtilization > (HEALTH_CONFIG.thresholds.memory.heapUtilization - 10)) {
        result.setWarning(`Elevated heap utilization: ${heapUtilization.toFixed(2)}%`);
      }

      if (memoryUsage.rss > HEALTH_CONFIG.thresholds.memory.rssLimit) {
        result.setCritical(`RSS memory limit exceeded: ${Math.round(memoryUsage.rss / 1024 / 1024)} MB`);
      }

      result.setDuration(Date.now() - startTime);

    } catch (error) {
      result.setDown('Memory check failed', error);
      result.setDuration(Date.now() - startTime);
    }

    return result;
  }

  /**
   * Check API health
   */
  static async checkAPI() {
    const result = new HealthCheckResult('api');
    const startTime = Date.now();

    try {

      const performanceStatus = performanceMonitor.getCurrentStatus();

      result.setMetrics({
        uptime: Math.round(performanceStatus.uptime) + ' seconds',
        healthScore: performanceStatus.healthScore,
        status: performanceStatus.status,
        activeRequests: performanceStatus.activeRequests,
        metricsCollected: performanceStatus.metricsCollected
      });

      if (performanceStatus.healthScore < 60) {
        result.setCritical(`Low health score: ${performanceStatus.healthScore}/100`);
      } else if (performanceStatus.healthScore < 80) {
        result.setWarning(`Moderate health score: ${performanceStatus.healthScore}/100`);
      }

      if (performanceStatus.activeRequests > 100) {
        result.setWarning(`High number of active requests: ${performanceStatus.activeRequests}`);
      }

      result.setDuration(Date.now() - startTime);

    } catch (error) {
      result.setDown('API health check failed', error);
      result.setDuration(Date.now() - startTime);
    }

    return result;
  }

  /**
   * Check batch processing health
   */
  static async checkBatchProcessing() {
    const result = new HealthCheckResult('batch_processing');
    const startTime = Date.now();

    try {
      const batchStats = getBatchProcessorStats();

      result.setMetrics({
        totalBatches: batchStats.totalBatches,
        successfulBatches: batchStats.successfulBatches,
        batchSuccessRate: batchStats.batchSuccessRate,
        totalOperations: batchStats.totalOperations,
        operationSuccessRate: batchStats.operationSuccessRate,
        averageBatchTime: batchStats.averageBatchTime + 'ms'
      });

      const batchSuccessRate = parseFloat(batchStats.batchSuccessRate?.replace('%', '') || '100');
      if (batchSuccessRate < 95) {
        result.setCritical(`Low batch success rate: ${batchSuccessRate}%`);
      } else if (batchSuccessRate < 98) {
        result.setWarning(`Moderate batch success rate: ${batchSuccessRate}%`);
      }

      const operationSuccessRate = parseFloat(batchStats.operationSuccessRate?.replace('%', '') || '100');
      if (operationSuccessRate < 98) {
        result.setCritical(`Low operation success rate: ${operationSuccessRate}%`);
      } else if (operationSuccessRate < 99.5) {
        result.setWarning(`Moderate operation success rate: ${operationSuccessRate}%`);
      }

      if (batchStats.averageBatchTime > 5000) {
        result.setWarning(`Slow batch processing: ${batchStats.averageBatchTime}ms average`);
      }

      result.setDuration(Date.now() - startTime);

    } catch (error) {
      result.setDown('Batch processing check failed', error);
      result.setDuration(Date.now() - startTime);
    }

    return result;
  }

  /**
   * Check security health
   */
  static async checkSecurity() {
    const result = new HealthCheckResult('security');
    const startTime = Date.now();

    try {
      const securityMetrics = await SecurityMonitor.getSecurityMetrics(1); // Last hour

      if (!securityMetrics) {
        result.setWarning('Unable to retrieve security metrics');
        result.setDuration(Date.now() - startTime);
        return result;
      }

      result.setMetrics({
        totalIncidents: securityMetrics.totalIncidents,
        criticalIncidents: securityMetrics.severityBreakdown.critical || 0,
        highIncidents: securityMetrics.severityBreakdown.high || 0,
        mediumIncidents: securityMetrics.severityBreakdown.medium || 0,
        timeframe: securityMetrics.timeframe
      });

      if (securityMetrics.totalIncidents > HEALTH_CONFIG.thresholds.security.incidentsPerHour) {
        result.setCritical(`High security incident rate: ${securityMetrics.totalIncidents} incidents/hour`);
      }

      const criticalIncidents = securityMetrics.severityBreakdown.critical || 0;
      if (criticalIncidents > HEALTH_CONFIG.thresholds.security.criticalIncidents) {
        result.setCritical(`Critical security incidents detected: ${criticalIncidents} in last hour`);
      } else if (criticalIncidents > 0) {
        result.setWarning(`Critical security incidents detected: ${criticalIncidents} in last hour`);
      }

      const underAttack = await SecurityMonitor.checkForAttacks();
      if (underAttack) {
        result.setCritical('Potential security attack detected');
      }

      result.setDuration(Date.now() - startTime);

    } catch (error) {
      result.setDown('Security check failed', error);
      result.setDuration(Date.now() - startTime);
    }

    return result;
  }

  /**
   * Check system resources
   */
  static async checkSystemResources() {
    const result = new HealthCheckResult('system_resources');
    const startTime = Date.now();

    try {
      const cpuUsage = process.cpuUsage();
      const uptime = process.uptime();

      result.setMetrics({
        uptime: Math.round(uptime) + ' seconds',
        uptimeFormatted: this.formatUptime(uptime),
        cpuUser: cpuUsage.user,
        cpuSystem: cpuUsage.system,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      });

      if (uptime < 300) { // Less than 5 minutes
        result.setWarning(`Low uptime: ${Math.round(uptime)} seconds - possible recent restart`);
      }

      result.setDuration(Date.now() - startTime);

    } catch (error) {
      result.setDown('System resources check failed', error);
      result.setDuration(Date.now() - startTime);
    }

    return result;
  }

  /**
   * Format uptime in human-readable format
   */
  static formatUptime(uptimeSeconds) {
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
}

/**
 * Comprehensive health diagnostics manager
 */
class HealthDiagnosticsManager {
  constructor() {
    this.lastQuickCheck = null;
    this.lastDeepCheck = null;
    this.healthHistory = [];
    this.intervals = new Map();

    this.startMonitoring();
  }

  /**
   * Start health monitoring
   */
  startMonitoring() {
    // Quick health checks every 30 seconds
    const quickInterval = setInterval(() => {
      this.performQuickHealthCheck();
    }, HEALTH_CONFIG.quickCheckInterval);

    // Deep health checks every 5 minutes
    const deepInterval = setInterval(() => {
      this.performDeepHealthCheck();
    }, HEALTH_CONFIG.deepCheckInterval);

    this.intervals.set('quick', quickInterval);
    this.intervals.set('deep', deepInterval);

    console.log('🏥 Health diagnostics monitoring started');

    // Perform initial checks
    setTimeout(() => this.performQuickHealthCheck(), 1000);
    setTimeout(() => this.performDeepHealthCheck(), 5000);
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring() {
    for (const [name, interval] of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();
    console.log('🏥 Health diagnostics monitoring stopped');
  }

  /**
   * Perform quick health check (essential systems only)
   */
  async performQuickHealthCheck() {
    try {
      const checks = await Promise.allSettled([
        HealthCheckers.checkDatabase(),
        HealthCheckers.checkMemory(),
        HealthCheckers.checkAPI()
      ]);

      const results = checks.map(check =>
        check.status === 'fulfilled' ? check.value :
        { name: 'unknown', status: 'down', message: 'Check failed', error: check.reason?.message }
      );

      this.lastQuickCheck = {
        timestamp: new Date().toISOString(),
        type: 'quick',
        results,
        overallStatus: this.calculateOverallStatus(results)
      };

      // Log critical issues immediately
      const criticalIssues = results.filter(r => r.status === 'critical' || r.status === 'down');
      if (criticalIssues.length > 0) {
        console.error('🚨 CRITICAL HEALTH ISSUES DETECTED:');
        criticalIssues.forEach(issue => {
          console.error(`  ❌ ${issue.name}: ${issue.message}`);
        });
      }

    } catch (error) {
      console.error('❌ Quick health check failed:', error);
    }
  }

  /**
   * Perform deep health check (all systems)
   */
  async performDeepHealthCheck() {
    try {
      const checks = await Promise.allSettled([
        HealthCheckers.checkDatabase(),
        HealthCheckers.checkMemory(),
        HealthCheckers.checkAPI(),
        HealthCheckers.checkBatchProcessing(),
        HealthCheckers.checkSecurity(),
        HealthCheckers.checkSystemResources()
      ]);

      const results = checks.map(check =>
        check.status === 'fulfilled' ? check.value :
        { name: 'unknown', status: 'down', message: 'Check failed', error: check.reason?.message }
      );

      this.lastDeepCheck = {
        timestamp: new Date().toISOString(),
        type: 'deep',
        results,
        overallStatus: this.calculateOverallStatus(results),
        summary: this.generateHealthSummary(results)
      };

      // Store in health history
      this.healthHistory.push(this.lastDeepCheck);

      // Keep only last 24 hours of history
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      this.healthHistory = this.healthHistory.filter(h =>
        new Date(h.timestamp).getTime() > oneDayAgo
      );

      // Store in database for analysis
      await this.storeHealthCheckResults(this.lastDeepCheck);

      // Log health status
      this.logHealthStatus(this.lastDeepCheck);

    } catch (error) {
      console.error('❌ Deep health check failed:', error);
    }
  }

  /**
   * Calculate overall system status
   */
  calculateOverallStatus(results) {
    const statusPriority = {
      'down': 4,
      'critical': 3,
      'warning': 2,
      'healthy': 1
    };

    const worstStatus = results.reduce((worst, result) => {
      const currentPriority = statusPriority[result.status] || 0;
      const worstPriority = statusPriority[worst] || 0;
      return currentPriority > worstPriority ? result.status : worst;
    }, 'healthy');

    return worstStatus;
  }

  /**
   * Generate health summary
   */
  generateHealthSummary(results) {
    const summary = {
      totalChecks: results.length,
      healthy: results.filter(r => r.status === 'healthy').length,
      warning: results.filter(r => r.status === 'warning').length,
      critical: results.filter(r => r.status === 'critical').length,
      down: results.filter(r => r.status === 'down').length,
      issues: [],
      recommendations: []
    };

    // Collect issues and recommendations
    results.forEach(result => {
      if (result.status !== 'healthy') {
        summary.issues.push(`${result.name}: ${result.message}`);
      }

      if (result.name === 'memory' && result.status !== 'healthy') {
        summary.recommendations.push('Consider increasing memory allocation or optimizing memory usage');
      }

      if (result.name === 'database' && result.status !== 'healthy') {
        summary.recommendations.push('Review database performance and connection pool settings');
      }

      if (result.name === 'security' && result.status !== 'healthy') {
        summary.recommendations.push('Investigate security incidents and strengthen security measures');
      }
    });

    return summary;
  }

  /**
   * Store health check results in database
   */
  async storeHealthCheckResults(healthCheck) {
    try {
      const db = await getDbEnterprise();

      try {
        const healthRef = db.collection('health_checks').doc();
        await healthRef.set(healthCheck);
      } finally {
        releaseDbConnection();
      }

    } catch (error) {
      console.error('❌ Failed to store health check results:', error);
    }
  }

  /**
   * Log health status to console
   */
  logHealthStatus(healthCheck) {
    const { overallStatus, summary } = healthCheck;

    const statusIcon = {
      'healthy': '✅',
      'warning': '⚠️',
      'critical': '🚨',
      'down': '💀'
    }[overallStatus];

    console.log(`${statusIcon} SYSTEM HEALTH: ${overallStatus.toUpperCase()}`);
    console.log(`  📊 Status: ${summary.healthy} healthy, ${summary.warning} warning, ${summary.critical} critical, ${summary.down} down`);

    if (summary.issues.length > 0) {
      console.log('  🔍 Issues:');
      summary.issues.forEach(issue => console.log(`    • ${issue}`));
    }

    if (summary.recommendations.length > 0) {
      console.log('  💡 Recommendations:');
      summary.recommendations.forEach(rec => console.log(`    • ${rec}`));
    }
  }

  /**
   * Get current health status
   */
  getCurrentHealth() {
    return {
      quick: this.lastQuickCheck,
      deep: this.lastDeepCheck,
      history: this.healthHistory.slice(-10) // Last 10 checks
    };
  }

  /**
   * Get health trends
   */
  getHealthTrends() {
    if (this.healthHistory.length < 2) {
      return { trend: 'insufficient_data', message: 'Not enough data for trend analysis' };
    }

    const recent = this.healthHistory.slice(-5); // Last 5 checks
    const statusScores = {
      'healthy': 4,
      'warning': 3,
      'critical': 2,
      'down': 1
    };

    const scores = recent.map(h => statusScores[h.overallStatus] || 1);
    const trend = scores[scores.length - 1] - scores[0];

    if (trend > 0) {
      return { trend: 'improving', message: 'System health is improving' };
    } else if (trend < 0) {
      return { trend: 'degrading', message: 'System health is degrading' };
    } else {
      return { trend: 'stable', message: 'System health is stable' };
    }
  }

  /**
   * Perform on-demand health check
   */
  async performOnDemandCheck() {
    console.log('🔍 Performing on-demand health check...');

    const checks = await Promise.allSettled([
      HealthCheckers.checkDatabase(),
      HealthCheckers.checkMemory(),
      HealthCheckers.checkAPI(),
      HealthCheckers.checkBatchProcessing(),
      HealthCheckers.checkSecurity(),
      HealthCheckers.checkSystemResources()
    ]);

    const results = checks.map(check =>
      check.status === 'fulfilled' ? check.value :
      { name: 'unknown', status: 'down', message: 'Check failed', error: check.reason?.message }
    );

    const healthCheck = {
      timestamp: new Date().toISOString(),
      type: 'on_demand',
      results,
      overallStatus: this.calculateOverallStatus(results),
      summary: this.generateHealthSummary(results)
    };

    this.logHealthStatus(healthCheck);

    return healthCheck;
  }
}

// Global health diagnostics manager
const healthDiagnostics = new HealthDiagnosticsManager();

export {
  HealthDiagnosticsManager,
  HealthCheckers,
  HealthCheckResult,
  healthDiagnostics,
  HEALTH_CONFIG
};