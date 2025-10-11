/**
 * Test Configuration for SAMS Backend Test Harness
 * Centralizes all configuration options for testing
 */

// Environment detection
const isProduction = process.env.NODE_ENV === 'production';
const isStaging = process.env.NODE_ENV === 'staging';
const isDevelopment = !isProduction && !isStaging;

// Base configuration
const testConfig = {
  // API Configuration
  API_BASE_URL: process.env.TEST_API_BASE_URL || 'http://localhost:5001',
  DEFAULT_TIMEOUT: 30000, // 30 seconds
  
  // Test Users
  DEFAULT_TEST_UID: 'fjXv8gX1CYWBvOZ1CS27j96oRCT2',
  
  // Common test user IDs (add more as needed)
  TEST_USERS: {
    DEFAULT: 'fjXv8gX1CYWBvOZ1CS27j96oRCT2',
    // Add more test users here as they become available
  },

  // Debugging options
  DEBUG_REQUESTS: process.env.TEST_DEBUG === 'true' || isDevelopment,
  DEBUG_TOKENS: process.env.TEST_DEBUG_TOKENS === 'true',
  VERBOSE_LOGGING: process.env.TEST_VERBOSE === 'true',
  
  // Test execution options
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
  
  // Backend health check
  BACKEND_HEALTH_CHECK_PATH: '/system/health',
  BACKEND_START_TIMEOUT: 30000, // 30 seconds to wait for backend startup
  
  // Firebase configuration (inherited from environment)
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'sandyland-management-system',
  
  // Common API endpoints for quick reference
  ENDPOINTS: {
    HEALTH: '/system/health',
    USER_PROFILE: '/api/user/profile',
    USER_CLIENTS: '/api/user/clients',
    SELECT_CLIENT: '/api/user/select-client',
    CURRENT_CLIENT: '/api/user/current-client',
    TRANSACTIONS: '/api/transactions',
    CATEGORIES: '/api/categories',
    VENDORS: '/api/vendors',
    UNITS: '/api/units',
    ADMIN_USERS: '/api/admin/users'
  },
  
  // Test result formatting
  RESULT_FORMAT: {
    SHOW_TIMESTAMPS: true,
    SHOW_DURATION: true,
    COLORED_OUTPUT: !isProduction, // No colors in production logs
    DETAILED_ERRORS: isDevelopment
  },
  
  // File logging configuration
  FILE_LOGGING: {
    ENABLED: process.env.TEST_LOG_FILE === 'true' || true, // Default enabled
    LOG_DIRECTORY: './test-results',
    LOG_FILENAME_PATTERN: 'test-results-{timestamp}.json',
    APPEND_MODE: false, // false = new file each run, true = append to existing
    INCLUDE_CONSOLE_OUTPUT: true,
    AUTO_CLEANUP_DAYS: 7 // Delete logs older than 7 days
  },
  
  // Environment flags
  ENVIRONMENT: {
    IS_DEVELOPMENT: isDevelopment,
    IS_STAGING: isStaging,
    IS_PRODUCTION: isProduction
  }
};

/**
 * Get configuration for a specific test environment
 * @param {string} environment - 'development', 'staging', or 'production'
 * @returns {Object} - Environment-specific configuration
 */
function getEnvironmentConfig(environment = 'development') {
  const envConfigs = {
    development: {
      ...testConfig,
      API_BASE_URL: 'http://localhost:5001',
      DEBUG_REQUESTS: true,
      VERBOSE_LOGGING: true
    },
    staging: {
      ...testConfig,
      API_BASE_URL: process.env.STAGING_API_URL || 'https://staging-api.sams.sandyland.com.mx',
      DEBUG_REQUESTS: false,
      VERBOSE_LOGGING: false
    },
    production: {
      ...testConfig,
      API_BASE_URL: process.env.PRODUCTION_API_URL || 'https://api.sams.sandyland.com.mx',
      DEBUG_REQUESTS: false,
      VERBOSE_LOGGING: false,
      RESULT_FORMAT: {
        ...testConfig.RESULT_FORMAT,
        COLORED_OUTPUT: false,
        DETAILED_ERRORS: false
      }
    }
  };

  return envConfigs[environment] || envConfigs.development;
}

/**
 * Validate that required configuration is present
 * @returns {Object} - Validation result with any missing config
 */
function validateConfig() {
  const required = [
    'API_BASE_URL',
    'DEFAULT_TEST_UID'
  ];
  
  const missing = required.filter(key => !testConfig[key]);
  
  return {
    isValid: missing.length === 0,
    missing,
    config: testConfig
  };
}

/**
 * Get a test user ID by name or return the default
 * @param {string} userKey - Key from TEST_USERS or direct UID
 * @returns {string} - User ID for testing
 */
function getTestUserId(userKey = 'DEFAULT') {
  return testConfig.TEST_USERS[userKey] || userKey || testConfig.DEFAULT_TEST_UID;
}

/**
 * Check if we're running in debug mode
 * @returns {boolean} - True if debugging is enabled
 */
function isDebugMode() {
  return testConfig.DEBUG_REQUESTS || testConfig.VERBOSE_LOGGING;
}

export {
  testConfig,
  getEnvironmentConfig,
  validateConfig,
  getTestUserId,
  isDebugMode
};