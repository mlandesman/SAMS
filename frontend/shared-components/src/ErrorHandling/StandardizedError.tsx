/**
 * Standardized Error System for Enterprise Backend Alignment
 * FRONTEND-ALIGNMENT-001 - Phase 1.1
 * 
 * Provides consistent error handling across Desktop UI and Mobile PWA
 * Aligns with enterprise backend error response format
 */

export interface StandardizedErrorDetails {
  code?: string;
  timestamp?: string;
  requestId?: string;
  userId?: string;
  clientId?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  category?: 'authentication' | 'authorization' | 'validation' | 'network' | 'system' | 'business';
  retry?: boolean;
  retryDelay?: number;
  maxRetries?: number;
}

export interface StandardizedErrorResponse {
  error: string;
  message?: string;
  details?: StandardizedErrorDetails;
  userMessage?: string;
  actionItems?: string[];
  supportContact?: string;
}

/**
 * Enhanced error class for enterprise backend alignment
 */
export class StandardizedError extends Error {
  public readonly code: string;
  public readonly details: StandardizedErrorDetails;
  public readonly userMessage: string;
  public readonly actionItems: string[];
  public readonly severity: 'low' | 'medium' | 'high' | 'critical';
  public readonly category: string;
  public readonly retry: boolean;
  public readonly timestamp: string;

  constructor(
    message: string,
    code: string = 'UNKNOWN_ERROR',
    details: StandardizedErrorDetails = {},
    userMessage?: string
  ) {
    super(message);
    this.name = 'StandardizedError';
    this.code = code;
    this.details = {
      timestamp: new Date().toISOString(),
      severity: 'medium',
      category: 'system',
      retry: false,
      ...details
    };
    this.userMessage = userMessage || this.generateUserFriendlyMessage();
    this.actionItems = this.generateActionItems();
    this.severity = this.details.severity || 'medium';
    this.category = this.details.category || 'system';
    this.retry = this.details.retry || false;
    this.timestamp = this.details.timestamp || new Date().toISOString();
  }

  /**
   * Generate user-friendly error message based on error code and category
   */
  protected generateUserFriendlyMessage(): string {
    const errorMap: Record<string, string> = {
      // Authentication errors
      'UNAUTHORIZED': 'You need to sign in to access this feature.',
      'TOKEN_EXPIRED': 'Your session has expired. Please sign in again.',
      'INVALID_CREDENTIALS': 'The email or password you entered is incorrect.',
      'ACCOUNT_DISABLED': 'Your account has been disabled. Please contact support.',
      
      // Authorization errors
      'CLIENT_ACCESS_DENIED': 'You don\'t have permission to access this client.',
      'PERMISSION_DENIED': 'You don\'t have permission to perform this action.',
      'INSUFFICIENT_PRIVILEGES': 'Your account level doesn\'t allow this operation.',
      
      // Validation errors
      'VALIDATION_ERROR': 'Please check your input and try again.',
      'REQUIRED_FIELD_MISSING': 'Please fill in all required fields.',
      'INVALID_FORMAT': 'Please check the format of your input.',
      'DUPLICATE_ENTRY': 'This entry already exists.',
      
      // Network errors
      'NETWORK_ERROR': 'Unable to connect. Please check your internet connection.',
      'TIMEOUT': 'The request took too long. Please try again.',
      'SERVICE_UNAVAILABLE': 'The service is temporarily unavailable.',
      
      // System errors
      'INTERNAL_ERROR': 'An internal error occurred. Please try again later.',
      'DATABASE_ERROR': 'There was a problem accessing your data.',
      'RATE_LIMIT_EXCEEDED': 'Too many requests. Please wait a moment and try again.',
      
      // Business logic errors
      'INSUFFICIENT_BALANCE': 'Insufficient account balance for this transaction.',
      'TRANSACTION_LIMIT_EXCEEDED': 'This transaction exceeds your limit.',
      'DUPLICATE_TRANSACTION': 'This transaction has already been recorded.',
      
      // Default
      'UNKNOWN_ERROR': 'An unexpected error occurred. Please try again.'
    };

    return errorMap[this.code] || errorMap['UNKNOWN_ERROR'];
  }

  /**
   * Generate actionable items for user based on error type
   */
  protected generateActionItems(): string[] {
    const actionMap: Record<string, string[]> = {
      'UNAUTHORIZED': ['Sign in with your credentials', 'Contact support if you can\'t access your account'],
      'TOKEN_EXPIRED': ['Sign in again', 'Try refreshing the page'],
      'CLIENT_ACCESS_DENIED': ['Contact your administrator', 'Verify you\'re accessing the correct client'],
      'NETWORK_ERROR': ['Check your internet connection', 'Try again in a few moments'],
      'VALIDATION_ERROR': ['Review the highlighted fields', 'Ensure all required information is provided'],
      'RATE_LIMIT_EXCEEDED': ['Wait a moment before trying again', 'Reduce the frequency of your requests'],
      'SERVICE_UNAVAILABLE': ['Try again in a few minutes', 'Contact support if the issue persists']
    };

    return actionMap[this.code] || ['Try again later', 'Contact support if the problem continues'];
  }

  /**
   * Convert to enterprise backend response format
   */
  public toResponse(): StandardizedErrorResponse {
    return {
      error: this.message,
      message: this.userMessage,
      details: this.details,
      userMessage: this.userMessage,
      actionItems: this.actionItems,
      supportContact: 'support@sandyland.com'
    };
  }

  /**
   * Check if error is retryable
   */
  public isRetryable(): boolean {
    return this.retry && (this.details.maxRetries || 3) > 0;
  }

  /**
   * Get retry delay in milliseconds
   */
  public getRetryDelay(): number {
    return this.details.retryDelay || 1000;
  }
}

/**
 * Error factory for common error types
 */
export class ErrorFactory {
  static authentication(code: string, message: string, details?: Partial<StandardizedErrorDetails>): StandardizedError {
    return new StandardizedError(message, code, {
      category: 'authentication',
      severity: 'high',
      retry: code === 'TOKEN_EXPIRED',
      ...details
    });
  }

  static authorization(code: string, message: string, details?: Partial<StandardizedErrorDetails>): StandardizedError {
    return new StandardizedError(message, code, {
      category: 'authorization',
      severity: 'high',
      retry: false,
      ...details
    });
  }

  static validation(code: string, message: string, details?: Partial<StandardizedErrorDetails>): StandardizedError {
    return new StandardizedError(message, code, {
      category: 'validation',
      severity: 'medium',
      retry: false,
      ...details
    });
  }

  static network(code: string, message: string, details?: Partial<StandardizedErrorDetails>): StandardizedError {
    return new StandardizedError(message, code, {
      category: 'network',
      severity: 'medium',
      retry: true,
      retryDelay: 2000,
      maxRetries: 3,
      ...details
    });
  }

  static system(code: string, message: string, details?: Partial<StandardizedErrorDetails>): StandardizedError {
    return new StandardizedError(message, code, {
      category: 'system',
      severity: 'high',
      retry: true,
      retryDelay: 1000,
      maxRetries: 2,
      ...details
    });
  }

  static business(code: string, message: string, details?: Partial<StandardizedErrorDetails>): StandardizedError {
    return new StandardizedError(message, code, {
      category: 'business',
      severity: 'medium',
      retry: false,
      ...details
    });
  }
}

/**
 * Parse backend error response into StandardizedError
 */
export function parseBackendError(error: any): StandardizedError {
  // Handle various error response formats from backend
  if (error.response?.data) {
    const { data } = error.response;
    return new StandardizedError(
      data.error || data.message || 'Backend error',
      data.code || 'BACKEND_ERROR',
      data.details || {},
      data.userMessage
    );
  }

  // Handle network errors
  if (error.code === 'NETWORK_ERROR' || error.message === 'Network Error') {
    return ErrorFactory.network('NETWORK_ERROR', 'Network connection failed');
  }

  // Handle timeout errors
  if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
    return ErrorFactory.network('TIMEOUT', 'Request timed out');
  }

  // Handle generic errors
  return new StandardizedError(
    error.message || 'Unknown error occurred',
    error.code || 'UNKNOWN_ERROR',
    error.details || {}
  );
}

/**
 * Performance monitoring integration for errors
 */
export class ErrorMetrics {
  private static errors: Map<string, number> = new Map();

  static recordError(error: StandardizedError): void {
    const key = `${error.category}_${error.code}`;
    const count = this.errors.get(key) || 0;
    this.errors.set(key, count + 1);

    // Log to performance monitoring if critical
    if (error.severity === 'critical') {
      console.error('Critical error recorded:', {
        code: error.code,
        category: error.category,
        timestamp: error.timestamp,
        count: count + 1
      });
    }
  }

  static getErrorStats(): Record<string, number> {
    return Object.fromEntries(this.errors);
  }

  static resetStats(): void {
    this.errors.clear();
  }
}

export default StandardizedError;