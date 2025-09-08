/**
 * Security Error Handler for Enterprise Backend Alignment
 * FRONTEND-ALIGNMENT-001 - Phase 1.2
 * 
 * Specialized handling for authentication, authorization, and security validation errors
 * Aligns with enterprise backend security error responses
 */

import React, { useState, useEffect } from 'react';
import { StandardizedError, ErrorFactory } from './StandardizedError';
import { ErrorDisplay } from './ErrorDisplay';
// Import ERROR_CODES directly to avoid circular dependency
const ERROR_CODES = {
  // Authentication
  UNAUTHORIZED: 'UNAUTHORIZED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  
  // Authorization
  CLIENT_ACCESS_DENIED: 'CLIENT_ACCESS_DENIED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INSUFFICIENT_PRIVILEGES: 'INSUFFICIENT_PRIVILEGES',
  
  // System
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED'
} as const;

/**
 * Security error categories and their handling strategies
 */
export const SECURITY_ERROR_CATEGORIES = {
  AUTHENTICATION: {
    codes: [
      ERROR_CODES.UNAUTHORIZED,
      ERROR_CODES.TOKEN_EXPIRED,
      ERROR_CODES.INVALID_CREDENTIALS,
      ERROR_CODES.ACCOUNT_DISABLED
    ],
    severity: 'high',
    autoRedirect: true,
    showUserActions: true
  },
  AUTHORIZATION: {
    codes: [
      ERROR_CODES.CLIENT_ACCESS_DENIED,
      ERROR_CODES.PERMISSION_DENIED,
      ERROR_CODES.INSUFFICIENT_PRIVILEGES
    ],
    severity: 'high',
    autoRedirect: false,
    showUserActions: true
  },
  RATE_LIMITING: {
    codes: [
      ERROR_CODES.RATE_LIMIT_EXCEEDED
    ],
    severity: 'medium',
    autoRedirect: false,
    autoRetry: true
  },
  ACCOUNT_SECURITY: {
    codes: [
      'ACCOUNT_LOCKED',
      'PASSWORD_EXPIRED',
      'MFA_REQUIRED',
      'SECURITY_VIOLATION'
    ],
    severity: 'critical',
    autoRedirect: true,
    showUserActions: true
  }
};

/**
 * Security error context for user guidance
 */
interface SecurityErrorContext {
  currentUser?: any;
  currentClient?: any;
  attemptedAction?: string;
  previousPath?: string;
  sessionInfo?: any;
}

/**
 * Enhanced security error with context-aware messaging
 */
export class SecurityError extends StandardizedError {
  public readonly securityCategory: string;
  public readonly requiresLogout: boolean;
  public readonly requiresRedirect: boolean;
  public readonly redirectPath?: string;
  public readonly allowRetry: boolean;

  constructor(
    message: string,
    code: string,
    context: SecurityErrorContext = {},
    securityCategory?: string
  ) {
    super(message, code, {
      category: 'authentication',
      severity: 'high',
      ...context
    });

    this.securityCategory = securityCategory || this.inferSecurityCategory(code);
    this.requiresLogout = this.shouldLogout(code);
    this.requiresRedirect = this.shouldRedirect(code);
    this.redirectPath = this.getRedirectPath(code, context);
    this.allowRetry = this.shouldAllowRetry(code);
  }

  private inferSecurityCategory(code: string): string {
    for (const [category, config] of Object.entries(SECURITY_ERROR_CATEGORIES)) {
      if (config.codes.includes(code)) {
        return category;
      }
    }
    return 'AUTHENTICATION';
  }

  private shouldLogout(code: string): boolean {
    const logoutCodes = [
      ERROR_CODES.UNAUTHORIZED,
      ERROR_CODES.TOKEN_EXPIRED,
      ERROR_CODES.ACCOUNT_DISABLED,
      'ACCOUNT_LOCKED',
      'SECURITY_VIOLATION'
    ];
    return logoutCodes.includes(code);
  }

  private shouldRedirect(code: string): boolean {
    const redirectCodes = [
      ERROR_CODES.UNAUTHORIZED,
      ERROR_CODES.TOKEN_EXPIRED,
      'PASSWORD_EXPIRED',
      'MFA_REQUIRED'
    ];
    return redirectCodes.includes(code);
  }

  private getRedirectPath(code: string, context: SecurityErrorContext): string | undefined {
    const redirectMap: Record<string, string> = {
      [ERROR_CODES.UNAUTHORIZED]: '/login',
      [ERROR_CODES.TOKEN_EXPIRED]: '/login',
      'PASSWORD_EXPIRED': '/setup-password',
      'MFA_REQUIRED': '/mfa-setup',
      [ERROR_CODES.CLIENT_ACCESS_DENIED]: '/dashboard'
    };

    return redirectMap[code];
  }

  private shouldAllowRetry(code: string): boolean {
    const noRetryCodes = [
      ERROR_CODES.CLIENT_ACCESS_DENIED,
      ERROR_CODES.PERMISSION_DENIED,
      ERROR_CODES.ACCOUNT_DISABLED,
      'ACCOUNT_LOCKED',
      'SECURITY_VIOLATION'
    ];
    return !noRetryCodes.includes(code);
  }

  /**
   * Generate security-specific user messages
   */
  protected generateUserFriendlyMessage(): string {
    const securityMessages: Record<string, string> = {
      // Authentication errors
      [ERROR_CODES.UNAUTHORIZED]: 'Please sign in to continue.',
      [ERROR_CODES.TOKEN_EXPIRED]: 'Your session has expired. Please sign in again.',
      [ERROR_CODES.INVALID_CREDENTIALS]: 'The credentials you entered are incorrect.',
      [ERROR_CODES.ACCOUNT_DISABLED]: 'Your account has been disabled. Please contact support.',
      
      // Authorization errors
      [ERROR_CODES.CLIENT_ACCESS_DENIED]: 'You don\'t have access to this client or property.',
      [ERROR_CODES.PERMISSION_DENIED]: 'You don\'t have permission to perform this action.',
      [ERROR_CODES.INSUFFICIENT_PRIVILEGES]: 'Your account level doesn\'t allow this operation.',
      
      // Rate limiting
      [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please wait a moment before trying again.',
      
      // Account security
      'ACCOUNT_LOCKED': 'Your account has been temporarily locked for security reasons.',
      'PASSWORD_EXPIRED': 'Your password has expired and must be changed.',
      'MFA_REQUIRED': 'Multi-factor authentication is required to continue.',
      'SECURITY_VIOLATION': 'A security violation has been detected. Please contact support.'
    };

    return securityMessages[this.code] || 'A security error occurred. Please try again.';
  }

  /**
   * Generate security-specific action items
   */
  protected generateActionItems(): string[] {
    const actionItemsMap: Record<string, string[]> = {
      [ERROR_CODES.UNAUTHORIZED]: [
        'Sign in with your email and password',
        'Contact support if you can\'t access your account'
      ],
      [ERROR_CODES.TOKEN_EXPIRED]: [
        'Sign in again to refresh your session',
        'Try refreshing the page'
      ],
      [ERROR_CODES.CLIENT_ACCESS_DENIED]: [
        'Contact your property manager for access',
        'Verify you\'re accessing the correct property',
        'Check with your administrator'
      ],
      [ERROR_CODES.PERMISSION_DENIED]: [
        'Contact your administrator for the required permissions',
        'Verify your account has the necessary access level'
      ],
      [ERROR_CODES.RATE_LIMIT_EXCEEDED]: [
        'Wait 1-2 minutes before trying again',
        'Reduce the frequency of your requests'
      ],
      'ACCOUNT_LOCKED': [
        'Wait for the lockout period to expire',
        'Contact support to unlock your account'
      ],
      'PASSWORD_EXPIRED': [
        'Change your password using the password reset link',
        'Contact support if you need assistance'
      ]
    };

    return actionItemsMap[this.code] || [
      'Try refreshing the page',
      'Contact support if the problem persists'
    ];
  }
}

/**
 * Security error factory for common scenarios
 */
export class SecurityErrorFactory {
  /**
   * Create authentication error
   */
  static authentication(
    code: string, 
    message: string, 
    context: SecurityErrorContext = {}
  ): SecurityError {
    return new SecurityError(message, code, context, 'AUTHENTICATION');
  }

  /**
   * Create authorization error with client context
   */
  static authorization(
    code: string, 
    message: string, 
    context: SecurityErrorContext = {}
  ): SecurityError {
    return new SecurityError(message, code, context, 'AUTHORIZATION');
  }

  /**
   * Create session expired error
   */
  static sessionExpired(context: SecurityErrorContext = {}): SecurityError {
    return new SecurityError(
      'Your session has expired',
      ERROR_CODES.TOKEN_EXPIRED,
      context,
      'AUTHENTICATION'
    );
  }

  /**
   * Create client access denied error
   */
  static clientAccessDenied(
    clientId: string, 
    context: SecurityErrorContext = {}
  ): SecurityError {
    return new SecurityError(
      `Access denied to client ${clientId}`,
      ERROR_CODES.CLIENT_ACCESS_DENIED,
      { ...context, clientId },
      'AUTHORIZATION'
    );
  }

  /**
   * Create rate limit error
   */
  static rateLimitExceeded(
    retryAfter?: number,
    context: SecurityErrorContext = {}
  ): SecurityError {
    return new SecurityError(
      'Rate limit exceeded',
      ERROR_CODES.RATE_LIMIT_EXCEEDED,
      { ...context, retryAfter },
      'RATE_LIMITING'
    );
  }
}

/**
 * React component for displaying security errors with enhanced features
 */
interface SecurityErrorDisplayProps {
  error: SecurityError;
  onLogin?: () => void;
  onLogout?: () => void;
  onRetry?: () => void;
  onContactSupport?: () => void;
  showContactInfo?: boolean;
  autoRedirect?: boolean;
  redirectDelay?: number;
}

export const SecurityErrorDisplay: React.FC<SecurityErrorDisplayProps> = ({
  error,
  onLogin,
  onLogout,
  onRetry,
  onContactSupport,
  showContactInfo = true,
  autoRedirect = true,
  redirectDelay = 5000
}) => {
  const [countdown, setCountdown] = useState<number | null>(null);

  // Handle auto-redirect for certain security errors
  useEffect(() => {
    if (autoRedirect && error.requiresRedirect && error.redirectPath) {
      setCountdown(Math.floor(redirectDelay / 1000));
      
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(timer);
            // Trigger redirect
            if (error.requiresLogout && onLogout) {
              onLogout();
            } else if (error.redirectPath && typeof window !== 'undefined') {
              window.location.href = error.redirectPath;
            }
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [autoRedirect, error, onLogout, redirectDelay]);

  // Render security-specific action buttons
  const renderSecurityActions = () => {
    const actions = [];

    // Login action for authentication errors
    if (error.securityCategory === 'AUTHENTICATION' && onLogin) {
      actions.push(
        <button
          key="login"
          onClick={onLogin}
          style={{
            padding: '10px 20px',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            marginRight: '8px'
          }}
        >
          Sign In
        </button>
      );
    }

    // Retry action for retryable errors
    if (error.allowRetry && onRetry) {
      actions.push(
        <button
          key="retry"
          onClick={onRetry}
          style={{
            padding: '10px 20px',
            backgroundColor: '#059669',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            marginRight: '8px'
          }}
        >
          Try Again
        </button>
      );
    }

    // Contact support action
    if (showContactInfo && onContactSupport) {
      actions.push(
        <button
          key="support"
          onClick={onContactSupport}
          style={{
            padding: '10px 20px',
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer'
          }}
        >
          Contact Support
        </button>
      );
    }

    return actions;
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <ErrorDisplay
        error={error}
        onRetry={error.allowRetry ? onRetry : undefined}
        showDetails={process.env.NODE_ENV === 'development'}
      />
      
      {/* Security-specific information */}
      <div style={{
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '16px',
        marginTop: '16px'
      }}>
        <h4 style={{
          margin: '0 0 12px 0',
          color: '#374151',
          fontSize: '16px',
          fontWeight: 600
        }}>
          Security Information
        </h4>
        
        <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
          <div><strong>Category:</strong> {error.securityCategory}</div>
          <div><strong>Error Code:</strong> {error.code}</div>
          {error.details.requestId && (
            <div><strong>Request ID:</strong> {error.details.requestId}</div>
          )}
        </div>

        {/* Auto-redirect countdown */}
        {countdown !== null && (
          <div style={{
            padding: '12px',
            backgroundColor: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '14px',
            color: '#92400e'
          }}>
            🔄 Redirecting in {countdown} seconds...
          </div>
        )}

        {/* Security actions */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {renderSecurityActions()}
        </div>
      </div>
    </div>
  );
};

/**
 * Hook for handling security errors in React components
 */
export const useSecurityErrorHandler = () => {
  const [securityError, setSecurityError] = useState<SecurityError | null>(null);

  const handleSecurityError = (error: any, context: SecurityErrorContext = {}) => {
    let standardizedError: SecurityError;

    if (error instanceof SecurityError) {
      standardizedError = error;
    } else if (error instanceof StandardizedError) {
      standardizedError = new SecurityError(
        error.message,
        error.code,
        { ...error.details, ...context }
      );
    } else {
      standardizedError = new SecurityError(
        error.message || 'Security error occurred',
        error.code || ERROR_CODES.UNAUTHORIZED,
        context
      );
    }

    setSecurityError(standardizedError);

    // Auto-logout for critical security errors
    if (standardizedError.requiresLogout) {
      handleLogout();
    }

    return standardizedError;
  };

  const handleLogout = () => {
    // Clear authentication state
    localStorage.removeItem('authToken');
    sessionStorage.clear();
    
    // Clear client context
    if (window.__SAMS_CLIENT_CONTEXT__) {
      window.__SAMS_CLIENT_CONTEXT__.selectedClient = null;
    }
    
    // Redirect to login
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  const clearSecurityError = () => {
    setSecurityError(null);
  };

  return {
    securityError,
    handleSecurityError,
    handleLogout,
    clearSecurityError
  };
};

export default SecurityErrorDisplay;