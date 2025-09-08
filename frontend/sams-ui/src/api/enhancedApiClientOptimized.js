/**
 * Optimized Enhanced API Client for Enterprise Backend Alignment
 * FRONTEND-ALIGNMENT-001 - Phase 2.1
 * 
 * Replaces the enhancedFetch method with enterprise-optimized version
 * using ConnectionManager and RequestOptimizer
 */

/**
 * Enhanced fetch with enterprise optimization and error handling
 */
export async function optimizedEnhancedFetch(apiClient, url, options = {}) {
  const fullUrl = url.startsWith('http') ? url : `${apiClient.baseUrl}${url}`;
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Merge with default options
  const finalOptions = {
    ...apiClient.defaultOptions,
    ...options,
    headers: {
      ...apiClient.defaultOptions.headers,
      ...options.headers,
      'X-Request-ID': requestId
    }
  };

  // Apply request interceptors
  const processedOptions = await apiClient.applyRequestInterceptors(finalOptions);

  try {
    // Add authentication headers if required
    if (processedOptions.authenticated !== false) {
      const authHeaders = await apiClient.getAuthHeaders();
      processedOptions.headers = {
        ...processedOptions.headers,
        ...authHeaders
      };
    }

    // Use enterprise optimization if enabled
    if (processedOptions.enableOptimization) {
      // Use response time optimizer for critical performance requirements
      if (processedOptions.priority === 'critical' || processedOptions.enableResponseTimeOptimization) {
        return await apiClient.responseTimeOptimizer.optimizeResponse(
          fullUrl,
          () => apiClient.connectionManager.fetch(fullUrl, processedOptions, {
            priority: processedOptions.priority || 'normal',
            batchable: apiClient.isBatchableRequest(processedOptions),
            bypassQueue: processedOptions.priority === 'critical'
          }),
          {
            priority: processedOptions.priority || 'normal',
            fieldsToSelect: processedOptions.fieldsToSelect,
            enablePrediction: processedOptions.enablePrediction,
            maxAge: processedOptions.cacheTTL
          }
        ).then(optimizedResponse => {
          // Log response time optimization results
          if (optimizedResponse.metadata.optimizationApplied.length > 0) {
            console.log('⚡ Response time optimizations applied:', 
              optimizedResponse.metadata.optimizationApplied);
          }
          return optimizedResponse.data;
        });
      } else {
        return await apiClient.requestOptimizer.optimizedRequest(
          fullUrl,
          processedOptions,
          {
            priority: processedOptions.priority || 'normal',
            cacheTTL: processedOptions.cacheTTL,
            bypassCache: processedOptions.bypassCache,
            enablePrefetch: processedOptions.enablePrefetch,
            cacheKey: processedOptions.cacheKey
          }
        );
      }
    } else {
      // Fallback to connection manager only
      const response = await apiClient.connectionManager.fetch(fullUrl, processedOptions, {
        priority: processedOptions.priority || 'normal',
        batchable: apiClient.isBatchableRequest(processedOptions),
        bypassQueue: processedOptions.priority === 'critical'
      });

      if (!response.ok) {
        const errorData = await apiClient.parseErrorResponse(response);
        throw apiClient.createHttpError(response.status, errorData, {
          requestId,
          url: fullUrl
        });
      }

      // Apply response interceptors
      const processedResponse = await apiClient.applyResponseInterceptors(response);
      return processedResponse;
    }
  } catch (error) {
    // Enhanced error handling
    const standardizedError = parseBackendError(error);
    
    // Add request context
    standardizedError.details = {
      ...standardizedError.details,
      requestId,
      url: fullUrl,
      optimizationEnabled: processedOptions.enableOptimization
    };

    // Record error metrics
    if (processedOptions.enableMetrics) {
      ErrorMetrics.recordError(standardizedError);
    }

    throw standardizedError;
  }
}

/**
 * Helper method to check if request is batchable
 */
export function isBatchableRequest(options) {
  const method = options.method || 'GET';
  
  // Only GET requests are typically batchable
  if (method !== 'GET') return false;
  
  // Don't batch large requests
  if (options.body && JSON.stringify(options.body).length > 1000) return false;
  
  // Don't batch authentication requests
  if (options.url && options.url.includes('/auth/')) return false;
  
  return true;
}

/**
 * Method to add to EnhancedApiClient prototype
 */
export function addOptimizationMethods(EnhancedApiClient) {
  // Replace the enhancedFetch method
  EnhancedApiClient.prototype.enhancedFetch = function(url, options = {}) {
    return optimizedEnhancedFetch(this, url, options);
  };

  // Add helper method
  EnhancedApiClient.prototype.isBatchableRequest = function(options) {
    return isBatchableRequest(options);
  };

  // Add optimization controls
  EnhancedApiClient.prototype.enableOptimization = function() {
    this.defaultOptions.enableOptimization = true;
  };

  EnhancedApiClient.prototype.disableOptimization = function() {
    this.defaultOptions.enableOptimization = false;
  };

  // Add performance stats
  EnhancedApiClient.prototype.getOptimizationStats = function() {
    return {
      connection: this.connectionManager.getStats(),
      request: this.requestOptimizer.getStats(),
      responseTime: this.responseTimeOptimizer.getStats(),
      health: this.connectionManager.getHealthStatus()
    };
  };

  // Add cache management
  EnhancedApiClient.prototype.clearCache = function() {
    this.requestOptimizer.clearCache();
    this.responseTimeOptimizer.clearCache();
  };

  // Add configuration updates
  EnhancedApiClient.prototype.updateOptimizationConfig = function(config) {
    if (config.connection) {
      this.connectionManager.updateConfig(config.connection);
    }
    if (config.request) {
      this.requestOptimizer.updateConfig(config.request);
    }
    if (config.responseTime) {
      this.responseTimeOptimizer.updateConfig(config.responseTime);
    }
  };

  // Convenience methods with optimization options
  EnhancedApiClient.prototype.getCached = function(url, options = {}) {
    return this.enhancedFetch(url, {
      ...options,
      method: 'GET',
      priority: 'low',
      cacheTTL: 600000, // 10 minutes
      enablePrefetch: true
    });
  };

  EnhancedApiClient.prototype.getCritical = function(url, options = {}) {
    return this.enhancedFetch(url, {
      ...options,
      method: 'GET',
      priority: 'critical',
      bypassCache: true,
      bypassQueue: true
    });
  };

  EnhancedApiClient.prototype.postOptimized = function(url, data, options = {}) {
    return this.enhancedFetch(url, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
      priority: 'high'
    });
  };

  // Response time optimized methods
  EnhancedApiClient.prototype.getOptimized = function(url, options = {}) {
    return this.enhancedFetch(url, {
      ...options,
      method: 'GET',
      enableResponseTimeOptimization: true,
      priority: 'normal'
    });
  };

  EnhancedApiClient.prototype.getFast = function(url, options = {}) {
    return this.enhancedFetch(url, {
      ...options,
      method: 'GET',
      enableResponseTimeOptimization: true,
      priority: 'critical',
      enablePrediction: true
    });
  };

  EnhancedApiClient.prototype.getWithFields = function(url, fieldsToSelect, options = {}) {
    return this.enhancedFetch(url, {
      ...options,
      method: 'GET',
      enableResponseTimeOptimization: true,
      fieldsToSelect,
      priority: 'normal'
    });
  };
}