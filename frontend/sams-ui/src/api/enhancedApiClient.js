/**
 * Enhanced API Client for Enterprise Backend Alignment
 * FRONTEND-ALIGNMENT-001 - Phase 1.1
 * 
 * Provides standardized error handling and performance monitoring
 * for all API calls to the enterprise backend
 */

import { 
  StandardizedError, 
  ErrorFactory, 
  parseBackendError, 
  ErrorMetrics,
  ERROR_CODES,
  PerformanceMonitor,
  ConnectionManager,
  RequestOptimizer,
  ResponseTimeOptimizer
} from '@sams/shared-components';
import { getCurrentUser } from '../firebaseClient';
import { config } from '../config';
import { addOptimizationMethods } from './enhancedApiClientOptimized';

/**
 * Enhanced API client with enterprise features
 */
export class EnhancedApiClient {
  constructor(baseUrl = config.api.baseUrl, defaultOptions = {}) {
    this.baseUrl = baseUrl;
    this.defaultOptions = {
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      enableMetrics: true,
      enableErrorReporting: true,
      enableOptimization: true,
      ...defaultOptions
    };
    this.interceptors = {
      request: [],
      response: []
    };
    
    // Initialize performance optimizations for enterprise backend
    this.connectionManager = ConnectionManager.getInstance({
      maxConcurrentRequests: 8,      // Optimized for enterprise backend
      enableRequestBatching: true,
      enableConnectionReuse: true,
      enableHTTP2: true
    });
    
    this.requestOptimizer = RequestOptimizer.getInstance({
      enableCaching: true,
      enableDeduplication: true,
      enablePrefetching: true,
      defaultCacheTTL: 300000        // 5 minutes for enterprise data
    });
    
    this.responseTimeOptimizer = ResponseTimeOptimizer.getInstance({
      targetResponseTime: 1000,      // 1 second target for desktop
      enableSmartCompression: true,
      enableResponseStreaming: true,
      enablePayloadOptimization: true,
      compressionPreference: 'balanced'
    });
  }

  /**
   * Add request interceptor
   */
  addRequestInterceptor(interceptor) {
    this.interceptors.request.push(interceptor);
  }

  /**
   * Add response interceptor
   */
  addResponseInterceptor(interceptor) {
    this.interceptors.response.push(interceptor);
  }

  /**
   * Get authentication headers
   */
  async getAuthHeaders() {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      throw ErrorFactory.authentication(
        ERROR_CODES.UNAUTHORIZED,
        'User not authenticated'
      );
    }

    try {
      const { getAuthInstance } = await import('../firebaseClient');
      const auth = getAuthInstance();
      const token = await auth.currentUser?.getIdToken();
      
      if (!token) {
        throw ErrorFactory.authentication(
          ERROR_CODES.TOKEN_EXPIRED,
          'Failed to get authentication token'
        );
      }
      
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Client-Version': '1.0.0',
        'X-Request-Time': new Date().toISOString()
      };
    } catch (error) {
      if (error instanceof StandardizedError) {
        throw error;
      }
      throw ErrorFactory.authentication(
        ERROR_CODES.UNAUTHORIZED,
        'Authentication failed'
      );
    }
  }

  /**
   * Apply request interceptors
   */
  async applyRequestInterceptors(options) {
    let processedOptions = { ...options };
    
    for (const interceptor of this.interceptors.request) {
      processedOptions = await interceptor(processedOptions);
    }
    
    return processedOptions;
  }

  /**
   * Apply response interceptors
   */
  async applyResponseInterceptors(response) {
    let processedResponse = response;
    
    for (const interceptor of this.interceptors.response) {
      processedResponse = await interceptor(processedResponse);
    }
    
    return processedResponse;
  }

  /**
   * Enhanced fetch with enterprise optimization and error handling
   */
  async enhancedFetch(url, options = {}) {
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Merge with default options
    const finalOptions = {
      ...this.defaultOptions,
      ...options,
      headers: {
        ...this.defaultOptions.headers,
        ...options.headers,
        'X-Request-ID': requestId
      }
    };

    // Apply request interceptors
    const processedOptions = await this.applyRequestInterceptors(finalOptions);

    // Performance tracking
    const startTime = performance.now();
    let attempt = 0;
    const maxRetries = processedOptions.retries || 3;

    while (attempt <= maxRetries) {
      try {
        // Add authentication headers if required
        if (processedOptions.authenticated !== false) {
          const authHeaders = await this.getAuthHeaders();
          processedOptions.headers = {
            ...processedOptions.headers,
            ...authHeaders
          };
        }

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, processedOptions.timeout);

        // Make the request
        const response = await fetch(fullUrl, {
          ...processedOptions,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Calculate response time
        const responseTime = performance.now() - startTime;

        // Record performance metrics to both internal system and performance monitor
        if (processedOptions.enableMetrics) {
          this.recordMetrics(url, responseTime, response.status, attempt);
          
          // Record to performance monitor for enterprise monitoring
          const monitor = PerformanceMonitor.getInstance();
          monitor.recordMetric(
            `api_${url.split('/').pop() || 'request'}`,
            responseTime,
            'api',
            {
              url: fullUrl,
              method: processedOptions.method || 'GET',
              status: response.status,
              attempts: attempt + 1,
              requestId
            }
          );
        }

        // Check for HTTP errors
        if (!response.ok) {
          const errorData = await this.parseErrorResponse(response);
          throw this.createHttpError(response.status, errorData, {
            requestId,
            url: fullUrl,
            attempt: attempt + 1
          });
        }

        // Apply response interceptors
        const processedResponse = await this.applyResponseInterceptors(response);

        // Return successful response
        return processedResponse;

      } catch (error) {
        attempt++;

        // Handle abort errors (timeout)
        if (error.name === 'AbortError') {
          const timeoutError = ErrorFactory.network(
            ERROR_CODES.TIMEOUT,
            `Request timed out after ${processedOptions.timeout}ms`,
            {
              requestId,
              url: fullUrl,
              timeout: processedOptions.timeout,
              attempt
            }
          );
          
          if (attempt > maxRetries) {
            throw timeoutError;
          }
          
          // Wait before retrying
          await this.wait(this.calculateRetryDelay(attempt, processedOptions.retryDelay));
          continue;
        }

        // Parse and standardize other errors
        const standardizedError = parseBackendError(error);
        
        // Add request context
        standardizedError.details = {
          ...standardizedError.details,
          requestId,
          url: fullUrl,
          attempt
        };

        // Record error metrics
        if (processedOptions.enableMetrics) {
          ErrorMetrics.recordError(standardizedError);
        }

        // Check if we should retry
        if (attempt <= maxRetries && this.shouldRetry(standardizedError, attempt)) {
          console.log(`Retrying request (attempt ${attempt}/${maxRetries}): ${fullUrl}`);
          await this.wait(this.calculateRetryDelay(attempt, processedOptions.retryDelay));
          continue;
        }

        // No more retries - throw the error
        throw standardizedError;
      }
    }
  }

  /**
   * Parse error response from backend
   */
  async parseErrorResponse(response) {
    try {
      const text = await response.text();
      return text ? JSON.parse(text) : {};
    } catch {
      return { error: response.statusText || 'Unknown error' };
    }
  }

  /**
   * Create HTTP error from response
   */
  createHttpError(status, errorData, context = {}) {
    const errorMap = {
      400: () => ErrorFactory.validation(
        errorData.code || ERROR_CODES.VALIDATION_ERROR,
        errorData.error || 'Bad request'
      ),
      401: () => ErrorFactory.authentication(
        errorData.code || ERROR_CODES.UNAUTHORIZED,
        errorData.error || 'Unauthorized'
      ),
      403: () => ErrorFactory.authorization(
        errorData.code || ERROR_CODES.PERMISSION_DENIED,
        errorData.error || 'Forbidden'
      ),
      404: () => ErrorFactory.system(
        'NOT_FOUND',
        errorData.error || 'Resource not found'
      ),
      429: () => ErrorFactory.system(
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        errorData.error || 'Too many requests'
      ),
      500: () => ErrorFactory.system(
        ERROR_CODES.INTERNAL_ERROR,
        errorData.error || 'Internal server error'
      ),
      502: () => ErrorFactory.network(
        'BAD_GATEWAY',
        'Bad gateway'
      ),
      503: () => ErrorFactory.network(
        ERROR_CODES.SERVICE_UNAVAILABLE,
        'Service unavailable'
      ),
      504: () => ErrorFactory.network(
        ERROR_CODES.TIMEOUT,
        'Gateway timeout'
      )
    };

    const createError = errorMap[status] || (() => 
      ErrorFactory.system(
        'HTTP_ERROR',
        `HTTP ${status}: ${errorData.error || 'Unknown error'}`
      )
    );

    const error = createError();
    error.details = {
      ...error.details,
      httpStatus: status,
      ...errorData.details,
      ...context
    };

    return error;
  }

  /**
   * Check if error should be retried
   */
  shouldRetry(error, attempt) {
    // Don't retry authentication/authorization errors
    if (error.category === 'authentication' || error.category === 'authorization') {
      return false;
    }

    // Don't retry validation errors
    if (error.category === 'validation') {
      return false;
    }

    // Retry network and system errors
    return error.retry && (error.category === 'network' || error.category === 'system');
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  calculateRetryDelay(attempt, baseDelay) {
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000;
    return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
  }

  /**
   * Wait for specified time
   */
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Record performance metrics
   */
  recordMetrics(url, responseTime, status, attempts) {
    const metrics = {
      url,
      responseTime,
      status,
      attempts,
      timestamp: new Date().toISOString()
    };

    // Log performance metrics
    if (responseTime > 5000) {
      console.warn('Slow API response:', metrics);
    }

    // Send to monitoring service
    if (window.gtag) {
      window.gtag('event', 'api_call', {
        custom_parameter_1: url,
        custom_parameter_2: responseTime,
        custom_parameter_3: status
      });
    }
  }

  /**
   * Convenience methods for different HTTP verbs
   */
  async get(url, options = {}) {
    return this.enhancedFetch(url, { ...options, method: 'GET' });
  }

  async post(url, data, options = {}) {
    return this.enhancedFetch(url, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async put(url, data, options = {}) {
    return this.enhancedFetch(url, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async patch(url, data, options = {}) {
    return this.enhancedFetch(url, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async delete(url, options = {}) {
    return this.enhancedFetch(url, { ...options, method: 'DELETE' });
  }
}

// Add enterprise optimization methods to the class
addOptimizationMethods(EnhancedApiClient);

// Create default instance
export const apiClient = new EnhancedApiClient();

// Add default request interceptor for client context
apiClient.addRequestInterceptor(async (options) => {
  // Add client ID from context if available
  const clientContext = window.__SAMS_CLIENT_CONTEXT__;
  if (clientContext?.selectedClient?.id) {
    options.headers = {
      ...options.headers,
      'X-Client-ID': clientContext.selectedClient.id
    };
  }

  return options;
});

// Add default response interceptor for error handling
apiClient.addResponseInterceptor(async (response) => {
  // Add any global response processing here
  return response;
});

export default apiClient;