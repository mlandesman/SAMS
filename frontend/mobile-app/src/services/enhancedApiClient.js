/**
 * Enhanced API Client for Mobile PWA Enterprise Backend Alignment
 * FRONTEND-ALIGNMENT-001 - Phase 2.1
 * 
 * Replaces basic fetch with enterprise-optimized API client
 * leveraging ConnectionManager and RequestOptimizer for mobile performance
 */

import { 
  ConnectionManager,
  RequestOptimizer,
  ResponseTimeOptimizer,
  PerformanceUtils
} from '@sams/shared-components';
import { auth } from './firebase';

// Enhanced API client configuration optimized for mobile
const MOBILE_API_CONFIG = {
  // Connection settings optimized for mobile networks
  connection: {
    maxConcurrentRequests: 4,        // Reduced for mobile bandwidth
    enableRequestBatching: true,
    enableConnectionReuse: true,
    enableHTTP2: true,
    connectionTimeout: 20000,        // 20s for mobile networks
    retryDelay: 2000                 // Longer retry delay for mobile
  },
  
  // Request optimization for mobile data efficiency
  request: {
    enableCaching: true,
    enableDeduplication: true,
    enablePrefetching: false,        // Disabled for mobile data saving
    defaultCacheTTL: 600000,         // 10 minutes for mobile offline support
    maxCacheSize: 50,                // Smaller cache for mobile memory
    enableCompression: true,
    compressionThreshold: 512        // Lower threshold for mobile
  },
  
  // Response time optimization for mobile networks
  responseTime: {
    targetResponseTime: 2000,        // 2 seconds target for mobile
    enableSmartCompression: true,
    enableResponseStreaming: false,  // Disabled for mobile battery saving
    enablePayloadOptimization: true,
    compressionPreference: 'size',   // Prefer size reduction for mobile data
    enableAdaptiveCaching: true,
    enableResponsePrediction: false  // Disabled for mobile battery saving
  }
};

/**
 * Enhanced mobile API client with enterprise backend optimization
 */
class MobileEnhancedApiClient {
  constructor() {
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
    
    // Initialize enterprise performance optimizations for mobile
    const optimization = PerformanceUtils.initializeOptimizations(MOBILE_API_CONFIG);
    this.connectionManager = optimization.connectionManager;
    this.requestOptimizer = optimization.requestOptimizer;
    this.responseTimeOptimizer = optimization.responseTimeOptimizer;
    
    console.log('📱 Mobile Enhanced API Client initialized with enterprise optimizations');
    console.log('📊 Performance optimization stats:', optimization.getStats());
  }

  /**
   * Get authentication headers with enterprise optimization
   */
  async getAuthHeaders() {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user');
    }
    
    const token = await user.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Client-Type': 'mobile-pwa',
      'X-Client-Version': '1.0.0',
      'X-Performance-Mode': 'mobile-optimized'
    };
  }

  /**
   * Enhanced mobile-optimized request
   */
  async request(url, options = {}, optimizationOptions = {}) {
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
    
    // Mobile-specific optimization options
    const mobileOptimizations = {
      priority: options.priority || 'normal',
      cacheTTL: options.cacheTTL || 600000,      // 10 minutes default
      bypassCache: options.bypassCache || false,
      enablePrefetch: false,                     // Disabled for mobile data saving
      ...optimizationOptions
    };

    // Add authentication headers
    const authHeaders = await this.getAuthHeaders();
    const enhancedOptions = {
      ...options,
      headers: {
        ...authHeaders,
        ...options.headers
      }
    };

    try {
      // Use response time optimizer for critical mobile requests
      if (mobileOptimizations.priority === 'critical' || mobileOptimizations.enableResponseTimeOptimization) {
        const optimizedResponse = await this.responseTimeOptimizer.optimizeResponse(
          fullUrl,
          () => this.connectionManager.fetch(fullUrl, enhancedOptions, {
            priority: mobileOptimizations.priority,
            batchable: false,
            bypassQueue: mobileOptimizations.priority === 'critical'
          }),
          {
            priority: mobileOptimizations.priority,
            enablePrediction: false, // Disabled for mobile battery
            maxAge: mobileOptimizations.cacheTTL
          }
        );
        
        // Log mobile optimization results
        if (optimizedResponse.metadata.optimizationApplied.length > 0) {
          console.log('📱⚡ Mobile response optimizations applied:', 
            optimizedResponse.metadata.optimizationApplied);
        }
        
        return optimizedResponse.data;
      } else {
        // Use enterprise request optimizer for mobile
        const response = await this.requestOptimizer.optimizedRequest(
          fullUrl,
          enhancedOptions,
          mobileOptimizations
        );

        // Handle non-JSON responses for mobile compatibility
        if (typeof response === 'string') {
          try {
            return JSON.parse(response);
          } catch {
            return response;
          }
        }

        return response;
      }
    } catch (error) {
      console.error('📱 Mobile API request failed:', { url: fullUrl, error });
      throw this.enhanceErrorForMobile(error, fullUrl);
    }
  }

  /**
   * Enhance errors with mobile-specific context
   */
  enhanceErrorForMobile(error, url) {
    const mobileError = new Error(error.message);
    mobileError.url = url;
    mobileError.timestamp = new Date().toISOString();
    mobileError.networkStatus = navigator.onLine ? 'online' : 'offline';
    mobileError.connectionType = navigator.connection?.effectiveType || 'unknown';
    mobileError.originalError = error;
    
    return mobileError;
  }

  /**
   * Convenience methods with mobile optimization
   */
  async get(url, options = {}) {
    return this.request(url, { ...options, method: 'GET' }, {
      priority: 'normal',
      cacheTTL: 600000  // Cache GET requests for 10 minutes
    });
  }

  async post(url, data, options = {}) {
    return this.request(url, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    }, {
      priority: 'high',
      bypassCache: true  // Don't cache POST requests
    });
  }

  async put(url, data, options = {}) {
    return this.request(url, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data)
    }, {
      priority: 'high',
      bypassCache: true
    });
  }

  /**
   * Mobile-specific optimized methods
   */
  async getCached(url, options = {}) {
    return this.request(url, { ...options, method: 'GET' }, {
      priority: 'low',
      cacheTTL: 1800000,  // 30 minutes for heavily cached data
      enablePrefetch: false
    });
  }

  async getCritical(url, options = {}) {
    return this.request(url, { ...options, method: 'GET' }, {
      priority: 'critical',
      bypassCache: true,
      bypassQueue: true,
      enableResponseTimeOptimization: true
    });
  }

  /**
   * Mobile-optimized fast request with response time optimization
   */
  async getFast(url, options = {}) {
    return this.request(url, { ...options, method: 'GET' }, {
      priority: 'high',
      enableResponseTimeOptimization: true,
      cacheTTL: 300000  // 5 minutes for fast requests
    });
  }

  /**
   * Upload optimized for mobile networks
   */
  async uploadFile(url, file, metadata = {}, options = {}) {
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
    
    // Get auth headers without Content-Type for FormData
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user');
    }
    
    const token = await user.getIdToken();
    const formData = new FormData();
    formData.append('file', file);
    
    // Add metadata to form data
    Object.entries(metadata).forEach(([key, value]) => {
      if (typeof value === 'object') {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, value);
      }
    });

    const uploadOptions = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Client-Type': 'mobile-pwa',
        'X-Upload-Type': 'mobile-optimized'
      },
      body: formData,
      ...options
    };

    try {
      // Use connection manager directly for file uploads (bypass request optimizer)
      const response = await this.connectionManager.fetch(fullUrl, uploadOptions, {
        priority: 'high',
        batchable: false,
        bypassQueue: false
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('📱 Mobile file upload failed:', { url: fullUrl, error });
      throw this.enhanceErrorForMobile(error, fullUrl);
    }
  }

  /**
   * Get performance statistics for mobile monitoring
   */
  getPerformanceStats() {
    return PerformanceUtils.getPerformanceSummary();
  }

  /**
   * Get mobile-specific performance recommendations
   */
  getRecommendations() {
    const baseRecommendations = PerformanceUtils.getRecommendations();
    const mobileRecommendations = [];

    // Add mobile-specific recommendations
    if (!navigator.onLine) {
      mobileRecommendations.push('Device is offline - using cached data where available');
    }

    if (navigator.connection?.effectiveType === 'slow-2g' || navigator.connection?.effectiveType === '2g') {
      mobileRecommendations.push('Slow network detected - enabling aggressive caching');
    }

    if (navigator.deviceMemory && navigator.deviceMemory < 4) {
      mobileRecommendations.push('Low memory device - reducing cache size');
    }

    return [...baseRecommendations, ...mobileRecommendations];
  }

  /**
   * Clear caches (useful for mobile memory management)
   */
  clearCache() {
    this.requestOptimizer.clearCache();
    console.log('📱 Mobile API cache cleared');
  }
}

// Create singleton instance
export const mobileApiClient = new MobileEnhancedApiClient();

// Enhanced mobile API functions using the optimized client
export const enhancedUserAPI = {
  async getProfile() {
    return mobileApiClient.getCached('/user/profile');
  },

  async updateProfile(profileData) {
    return mobileApiClient.put('/user/profile', profileData);
  },

  async updateEmail(newEmail) {
    return mobileApiClient.put('/user/email', { newEmail });
  },

  async updatePassword(newPassword) {
    return mobileApiClient.put('/user/password', { newPassword });
  },

  async getClients() {
    return mobileApiClient.getCached('/user/clients');
  },

  async selectClient(clientId) {
    return mobileApiClient.post('/user/select-client', { clientId });
  },

  async getCurrentClient() {
    return mobileApiClient.get('/user/current-client');
  }
};

export const enhancedClientAPI = {
  async getCategories(clientId) {
    return mobileApiClient.getCached(`/clients/${clientId}/categories`);
  },

  async getVendors(clientId) {
    return mobileApiClient.getCached(`/clients/${clientId}/vendors`);
  },

  async getAccounts(clientId) {
    return mobileApiClient.getCached(`/clients/${clientId}/accounts`);
  },

  async getPaymentMethods(clientId) {
    return mobileApiClient.getCached(`/clients/${clientId}/paymentmethods`);
  },

  async createTransaction(clientId, transactionData) {
    return mobileApiClient.post(`/clients/${clientId}/transactions`, transactionData);
  },

  async uploadDocument(clientId, file, metadata = {}) {
    return mobileApiClient.uploadFile(`/clients/${clientId}/documents/upload`, file, metadata);
  },

  async uploadDocumentsForTransaction(clientId, files, documentType = 'receipt', category = 'expense_receipt') {
    if (!files || files.length === 0) {
      return [];
    }

    const uploadPromises = files.map(async (file, index) => {
      const metadata = {
        documentType,
        category,
        linkedTo: null,
        notes: `Expense receipt ${index + 1}`,
        tags: ['expense', 'auto-uploaded']
      };

      const result = await this.uploadDocument(clientId, file, metadata);
      return result.document;
    });

    return Promise.all(uploadPromises);
  },

  async linkDocumentsToTransaction(clientId, documentIds, transactionId) {
    if (!documentIds || documentIds.length === 0) {
      return;
    }

    const linkPromises = documentIds.map(documentId => {
      const linkMetadata = {
        linkedTo: {
          type: 'transaction',
          id: transactionId
        }
      };
      
      return this.updateDocumentMetadata(clientId, documentId, linkMetadata);
    });

    return Promise.all(linkPromises);
  },

  async getDocuments(clientId, filters = {}) {
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) queryParams.append(key, value);
    });
    
    const url = `/clients/${clientId}/documents${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return mobileApiClient.get(url);
  },

  async updateDocumentMetadata(clientId, documentId, metadata) {
    return mobileApiClient.put(`/clients/${clientId}/documents/${documentId}/metadata`, metadata);
  }
};

// Export performance monitoring utilities
export const mobilePerformance = {
  getStats: () => mobileApiClient.getPerformanceStats(),
  getRecommendations: () => mobileApiClient.getRecommendations(),
  clearCache: () => mobileApiClient.clearCache()
};

export default mobileApiClient;