/**
 * Standardized Error Handling System
 * FRONTEND-ALIGNMENT-001 - Phase 1.1
 * 
 * Unified error handling for Desktop UI and Mobile PWA
 * Aligns with enterprise backend error response format
 */

// Core error classes and utilities
export {
  StandardizedError,
  ErrorFactory,
  parseBackendError,
  ErrorMetrics,
  type StandardizedErrorDetails,
  type StandardizedErrorResponse
} from './StandardizedError';

// React components for error display
export {
  ErrorDisplay,
  ErrorToast,
  type ErrorDisplayProps,
  type ErrorToastProps
} from './ErrorDisplay';

// Enhanced error boundary
export {
  EnhancedErrorBoundary,
  useErrorHandler,
  withErrorBoundary
} from './EnhancedErrorBoundary';

// API error handling hooks
export {
  useApiErrorHandler,
  useSimpleApiError,
  type ApiErrorHandlerConfig,
  type ApiCallOptions,
  type ApiErrorState
} from './useApiErrorHandler';

// Security error handling
export {
  SecurityError,
  SecurityErrorFactory,
  SecurityErrorDisplay,
  useSecurityErrorHandler,
  SECURITY_ERROR_CATEGORIES
} from './SecurityErrorHandler';

// Performance error monitoring
export {
  PerformanceError,
  PerformanceMonitor,
  usePerformanceMonitor,
  PERFORMANCE_THRESHOLDS
} from './PerformanceErrorMonitor';

export {
  PerformanceErrorDisplay,
  PerformanceToast
} from './PerformanceErrorDisplay';

// Re-export for convenience (removed duplicates)

/**
 * Common error codes used throughout the application
 */
export const ERROR_CODES = {
  // Authentication
  UNAUTHORIZED: 'UNAUTHORIZED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  
  // Authorization
  CLIENT_ACCESS_DENIED: 'CLIENT_ACCESS_DENIED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INSUFFICIENT_PRIVILEGES: 'INSUFFICIENT_PRIVILEGES',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
  INVALID_FORMAT: 'INVALID_FORMAT',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  
  // Network
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  
  // System
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Business
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  TRANSACTION_LIMIT_EXCEEDED: 'TRANSACTION_LIMIT_EXCEEDED',
  DUPLICATE_TRANSACTION: 'DUPLICATE_TRANSACTION',
  
  // Component
  COMPONENT_ERROR: 'COMPONENT_ERROR',
  HOOK_ERROR: 'HOOK_ERROR',
  
  // Default
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

/**
 * Error categories for classification
 */
export const ERROR_CATEGORIES = {
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  VALIDATION: 'validation',
  NETWORK: 'network',
  SYSTEM: 'system',
  BUSINESS: 'business',
  COMPONENT: 'component'
} as const;

/**
 * Error severity levels
 */
export const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
} as const;

// Utility functions removed - use ErrorFactory directly

/**
 * Global error configuration
 */
export interface GlobalErrorConfig {
  enableAutoRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  enableReporting?: boolean;
  enableUserFeedback?: boolean;
  enableMetrics?: boolean;
  logErrors?: boolean;
  supportEmail?: string;
}

let globalConfig: GlobalErrorConfig = {
  enableAutoRetry: false,
  maxRetries: 3,
  retryDelay: 1000,
  enableReporting: true,
  enableUserFeedback: true,
  enableMetrics: true,
  logErrors: process.env.NODE_ENV === 'development',
  supportEmail: 'support@sandyland.com'
};

/**
 * Configure global error handling settings
 */
export const configureErrorHandling = (config: Partial<GlobalErrorConfig>) => {
  globalConfig = { ...globalConfig, ...config };
};

/**
 * Get current global error configuration
 */
export const getErrorConfig = (): GlobalErrorConfig => globalConfig;

// Types already exported above with their modules

/**
 * Version information
 */
export const VERSION = '1.0.0';
export const BUILD_DATE = new Date().toISOString();

// Default export removed to avoid scope issues - use named exports instead