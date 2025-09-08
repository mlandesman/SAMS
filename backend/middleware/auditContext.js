/**
 * Middleware to capture user context for audit logging
 * Attaches user information to req.auditContext for use in controllers
 */

export function captureAuditContext(req, res, next) {
  // Extract user information from the authenticated request
  const user = req.user || {};
  
  // Build audit context
  req.auditContext = {
    userId: user.uid || 'SYSTEM',
    userEmail: user.email || 'system@sams.com',
    metadata: {
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      method: req.method,
      path: req.path,
      timestamp: new Date().toISOString()
    }
  };
  
  // Log critical operations
  if (req.method === 'DELETE') {
    console.log('🚨 DELETE operation requested:', {
      path: req.path,
      user: req.auditContext.userEmail,
      userId: req.auditContext.userId,
      ip: req.auditContext.metadata.ip
    });
  }
  
  next();
}

/**
 * Helper to get audit context from request
 * Use in controllers: const audit = getAuditContext(req);
 */
export function getAuditContext(req) {
  return req.auditContext || {
    userId: 'UNKNOWN',
    userEmail: 'unknown@sams.com',
    metadata: {
      warning: 'Audit context not captured - check middleware setup'
    }
  };
}