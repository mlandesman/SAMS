/**
 * Enterprise Security Middleware
 * Request validation, rate limiting, and security enforcement
 * Phase 2: Data Validation & Security Implementation
 */

import { EnterpriseDataValidator, SecurityAuditLogger } from '../utils/dataValidation-enterprise.js';
import { getDbEnterprise, releaseDbConnection } from '../firebase-enterprise.js';

// Enterprise security configuration
const SECURITY_CONFIG = {
  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000, // per window per IP
    maxRequestsPerUser: 500, // per window per user
    burstLimit: 50, // immediate burst protection
    burstWindowMs: 60 * 1000 // 1 minute burst window
  },

  // Request size limits
  requestLimits: {
    maxBodySize: 10 * 1024 * 1024, // 10MB
    maxQueryParams: 50,
    maxHeaders: 100,
    maxCookies: 20
  },

  // Security headers
  securityHeaders: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  },

  // Suspicious patterns
  suspiciousPatterns: {
    userAgent: /bot|crawler|spider|scraper|curl|wget|python|postman/i,
    rapidRequests: 10, // requests per second threshold
    unusualMethods: ['TRACE', 'CONNECT', 'OPTIONS'],
    longParams: 1000 // max length for any single parameter
  }
};

/**
 * Rate limiting manager
 */
class RateLimitManager {
  constructor() {
    this.requestCounts = new Map();
    this.burstCounts = new Map();
    this.blockedIPs = new Set();

    // Cleanup old entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Check if request should be rate limited
   */
  checkRateLimit(ip, userId = null) {
    const now = Date.now();
    const windowStart = now - SECURITY_CONFIG.rateLimit.windowMs;
    const burstWindowStart = now - SECURITY_CONFIG.rateLimit.burstWindowMs;

    if (this.blockedIPs.has(ip)) {
      return { allowed: false, reason: 'IP blocked due to abuse', retryAfter: 3600 };
    }

    const key = `${ip}:${userId || 'anonymous'}`;
    if (!this.requestCounts.has(key)) {
      this.requestCounts.set(key, []);
    }
    if (!this.burstCounts.has(key)) {
      this.burstCounts.set(key, []);
    }

    const requests = this.requestCounts.get(key);
    const burstRequests = this.burstCounts.get(key);

    // Clean old requests
    const recentRequests = requests.filter(time => time > windowStart);
    const recentBurstRequests = burstRequests.filter(time => time > burstWindowStart);

    if (recentBurstRequests.length >= SECURITY_CONFIG.rateLimit.burstLimit) {
      this.addSuspiciousActivity(ip, 'burst_limit_exceeded', {
        requests: recentBurstRequests.length,
        limit: SECURITY_CONFIG.rateLimit.burstLimit
      });
      return {
        allowed: false,
        reason: 'Burst limit exceeded',
        retryAfter: Math.ceil(SECURITY_CONFIG.rateLimit.burstWindowMs / 1000)
      };
    }

    const maxAllowed = userId ? SECURITY_CONFIG.rateLimit.maxRequestsPerUser : SECURITY_CONFIG.rateLimit.maxRequests;
    if (recentRequests.length >= maxAllowed) {
      this.addSuspiciousActivity(ip, 'rate_limit_exceeded', {
        requests: recentRequests.length,
        limit: maxAllowed
      });
      return {
        allowed: false,
        reason: 'Rate limit exceeded',
        retryAfter: Math.ceil(SECURITY_CONFIG.rateLimit.windowMs / 1000)
      };
    }

    recentRequests.push(now);
    recentBurstRequests.push(now);
    this.requestCounts.set(key, recentRequests);
    this.burstCounts.set(key, recentBurstRequests);

    return { allowed: true };
  }

  /**
   * Block IP address
   */
  blockIP(ip, reason) {
    this.blockedIPs.add(ip);
    console.warn(`🚫 Blocked IP ${ip}: ${reason}`);

    // Auto-unblock after 1 hour
    setTimeout(() => {
      this.blockedIPs.delete(ip);
      // Removed excessive success logging for performance
    }, 60 * 60 * 1000);
  }

  /**
   * Add suspicious activity
   */
  addSuspiciousActivity(ip, activity, metadata = {}) {
    console.warn(`⚠️ Suspicious activity from ${ip}: ${activity}`, metadata);

    // Block IP after multiple violations
    const violations = this.getViolationCount(ip);
    if (violations >= 5) {
      this.blockIP(ip, 'Multiple security violations');
    }
  }

  /**
   * Get violation count for IP
   */
  getViolationCount(ip) {
    // Simple in-memory tracking - in production, use database
    if (!this.violationCounts) {
      this.violationCounts = new Map();
    }

    const count = this.violationCounts.get(ip) || 0;
    this.violationCounts.set(ip, count + 1);
    return count + 1;
  }

  /**
   * Cleanup old entries
   */
  cleanup() {
    const now = Date.now();
    const cutoff = now - SECURITY_CONFIG.rateLimit.windowMs;

    for (const [key, requests] of this.requestCounts.entries()) {
      const recentRequests = requests.filter(time => time > cutoff);
      if (recentRequests.length === 0) {
        this.requestCounts.delete(key);
      } else {
        this.requestCounts.set(key, recentRequests);
      }
    }

    for (const [key, requests] of this.burstCounts.entries()) {
      const recentRequests = requests.filter(time => time > (now - SECURITY_CONFIG.rateLimit.burstWindowMs));
      if (recentRequests.length === 0) {
        this.burstCounts.delete(key);
      } else {
        this.burstCounts.set(key, recentRequests);
      }
    }
  }
}

// Global rate limiter instance
const rateLimiter = new RateLimitManager();

/**
 * Request sanitizer
 */
class RequestSanitizer {
  /**
   * Sanitize request parameters
   */
  static sanitizeParams(params) {
    const sanitized = {};

    for (const [key, value] of Object.entries(params)) {
      // Limit key length
      if (key.length > 100) {
        continue; // Skip overly long keys
      }

      if (typeof value === 'string') {

        if (value.length > SECURITY_CONFIG.suspiciousPatterns.longParams) {
          continue; // Skip overly long values
        }

        // Basic sanitization
        sanitized[key] = value.trim().substring(0, 1000);
      } else if (typeof value === 'number') {
        sanitized[key] = value;
      } else if (typeof value === 'boolean') {
        sanitized[key] = value;
      }
      // Skip other types (objects, arrays, etc.)
    }

    return sanitized;
  }

  /**
   * Validate request structure
   */
  static validateRequest(req) {
    const issues = [];

    const queryCount = Object.keys(req.query || {}).length;
    if (queryCount > SECURITY_CONFIG.requestLimits.maxQueryParams) {
      issues.push(`Too many query parameters: ${queryCount}`);
    }

    const headerCount = Object.keys(req.headers || {}).length;
    if (headerCount > SECURITY_CONFIG.requestLimits.maxHeaders) {
      issues.push(`Too many headers: ${headerCount}`);
    }

    const userAgent = req.headers['user-agent'] || '';
    if (SECURITY_CONFIG.suspiciousPatterns.userAgent.test(userAgent)) {
      issues.push(`Suspicious user agent: ${userAgent}`);
    }

    if (SECURITY_CONFIG.suspiciousPatterns.unusualMethods.includes(req.method)) {
      issues.push(`Unusual HTTP method: ${req.method}`);
    }

    return issues;
  }
}

/**
 * Enterprise security middleware
 */
class EnterpriseSecurityMiddleware {
  /**
   * Apply security headers
   */
  static securityHeaders() {
    return (req, res, next) => {
      // Apply security headers
      for (const [header, value] of Object.entries(SECURITY_CONFIG.securityHeaders)) {
        res.setHeader(header, value);
      }

      next();
    };
  }

  /**
   * Rate limiting middleware
   */
  static rateLimit() {
    return (req, res, next) => {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const userId = req.user?.uid || null;

      const rateLimitResult = rateLimiter.checkRateLimit(ip, userId);

      if (!rateLimitResult.allowed) {
        res.status(429).json({
          error: 'Rate limit exceeded',
          message: rateLimitResult.reason,
          retryAfter: rateLimitResult.retryAfter
        });

        // Log security event
        SecurityAuditLogger.logSecurityIssue({
          field: 'request',
          issue: `Rate limit exceeded: ${rateLimitResult.reason}`,
          severity: 'medium'
        }, {
          ipAddress: ip,
          userId,
          userAgent: req.headers['user-agent']
        });

        return;
      }

      next();
    };
  }

  /**
   * Input validation middleware
   */
  static inputValidation() {
    return (req, res, next) => {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';

      const requestIssues = RequestSanitizer.validateRequest(req);

      if (requestIssues.length > 0) {
        res.status(400).json({
          error: 'Invalid request',
          issues: requestIssues
        });

        // Log security issues
        for (const issue of requestIssues) {
          SecurityAuditLogger.logSecurityIssue({
            field: 'request',
            issue: `Request validation failed: ${issue}`,
            severity: 'medium'
          }, {
            ipAddress: ip,
            userAgent: req.headers['user-agent']
          });
        }

        return;
      }

      // Sanitize request parameters
      if (req.query) {
        req.query = RequestSanitizer.sanitizeParams(req.query);
      }

      if (req.params) {
        req.params = RequestSanitizer.sanitizeParams(req.params);
      }

      next();
    };
  }

  /**
   * Client validation middleware for multi-tenant security
   */
  static clientValidation() {
    return async (req, res, next) => {
      const clientId = req.params.clientId || req.body.clientId || req.query.clientId;

      if (!clientId) {
        res.status(400).json({
          error: 'Client ID is required'
        });
        return;
      }

      const validation = EnterpriseDataValidator.validateClientId(clientId, req.user?.uid);

      if (!validation.valid) {
        res.status(400).json({
          error: 'Invalid client ID',
          details: validation.errors
        });

        // Log security issues
        if (validation.securityIssues.length > 0) {
          await SecurityAuditLogger.logValidationFailure(validation, {
            ipAddress: req.ip,
            userId: req.user?.uid,
            userAgent: req.headers['user-agent']
          });
        }

        return;
      }

      req.sanitizedClientId = validation.sanitized.clientId;

      next();
    };
  }

  /**
   * Data validation middleware for request bodies
   */
  static dataValidation(validationType) {
    return async (req, res, next) => {
      if (!req.body || Object.keys(req.body).length === 0) {
        next();
        return;
      }

      let validation;
      const context = {
        ipAddress: req.ip,
        userId: req.user?.uid,
        userAgent: req.headers['user-agent']
      };

      switch (validationType) {
        case 'transaction':
          validation = await EnterpriseDataValidator.validateTransaction(req.body, context);
          break;
        case 'balance':
          validation = await EnterpriseDataValidator.validateBalance(req.body, context);
          break;
        case 'user':
          validation = await EnterpriseDataValidator.validateUser(req.body, context);
          break;
        default:
          next();
          return;
      }

      if (!validation.valid) {
        res.status(400).json({
          error: 'Data validation failed',
          details: validation.errors,
          warnings: validation.warnings
        });
        return;
      }

      // Replace request body with sanitized data
      req.sanitizedBody = validation.sanitized;

      // Log warnings if any
      if (validation.warnings.length > 0) {
        console.warn('⚠️ Data validation warnings:', validation.warnings);
      }

      next();
    };
  }

  /**
   * Error handling middleware for security issues
   */
  static errorHandler() {
    return (err, req, res, next) => {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';

      // Log security-related errors
      if (err.name === 'ValidationError' || err.name === 'SecurityError') {
        SecurityAuditLogger.logSecurityIssue({
          field: 'request',
          issue: `Security error: ${err.message}`,
          severity: 'high'
        }, {
          ipAddress: ip,
          userId: req.user?.uid,
          userAgent: req.headers['user-agent'],
          error: err.stack
        });
      }

      // Don't expose internal error details in production
      if (process.env.NODE_ENV === 'production') {
        res.status(500).json({
          error: 'Internal server error',
          message: 'An error occurred while processing your request'
        });
      } else {
        res.status(500).json({
          error: err.name || 'Error',
          message: err.message,
          stack: err.stack
        });
      }
    };
  }
}

/**
 * Security monitoring
 */
class SecurityMonitor {
  /**
   * Get security metrics
   */
  static async getSecurityMetrics(timeframe = 24) {
    try {
      const db = await getDbEnterprise();

      try {
        const cutoff = new Date(Date.now() - (timeframe * 60 * 60 * 1000));

        const snapshot = await db.collection('security_audit')
          .where('timestamp', '>=', cutoff)
          .get();

        const metrics = {
          totalIncidents: snapshot.size,
          severityBreakdown: { critical: 0, high: 0, medium: 0, low: 0 },
          topIssues: {},
          topIPs: {},
          timeframe: `${timeframe} hours`
        };

        snapshot.forEach(doc => {
          const data = doc.data();

          // Count by severity
          metrics.severityBreakdown[data.severity] = (metrics.severityBreakdown[data.severity] || 0) + 1;

          // Count by issue type
          metrics.topIssues[data.issue] = (metrics.topIssues[data.issue] || 0) + 1;

          // Count by IP
          if (data.context?.ipAddress) {
            metrics.topIPs[data.context.ipAddress] = (metrics.topIPs[data.context.ipAddress] || 0) + 1;
          }
        });

        return metrics;

      } finally {
        releaseDbConnection();
      }

    } catch (error) {
    console.error('❌ Operation failed:', error);
    return null;
  }
  }

  /**
   * Check for ongoing attacks
   */
  static async checkForAttacks() {
    const metrics = await this.getSecurityMetrics(1); // Last hour

    if (!metrics) return false;

    const criticalThreshold = 10;
    const highThreshold = 25;

    if (metrics.severityBreakdown.critical >= criticalThreshold) {
      console.error(`🚨 CRITICAL SECURITY ALERT: ${metrics.severityBreakdown.critical} critical incidents in the last hour`);
      return true;
    }

    if (metrics.severityBreakdown.high >= highThreshold) {
      console.warn(`⚠️ HIGH SECURITY ALERT: ${metrics.severityBreakdown.high} high-severity incidents in the last hour`);
      return true;
    }

    return false;
  }
}

// Export the middleware and utilities
export {
  EnterpriseSecurityMiddleware,
  SecurityMonitor,
  RateLimitManager,
  RequestSanitizer,
  SECURITY_CONFIG
};