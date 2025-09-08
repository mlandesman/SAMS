import { 
  Component, 
  Environment, 
  VerificationResult, 
  VerificationCheck, 
  VerificationConfig,
  DeploymentResult
} from '../types';
import { HealthChecker } from './health-checker';
import { logger } from '../utils/logger';
import { getCurrentVersion } from '../utils/version';
import axios from 'axios';

export interface DeploymentVerifierOptions {
  component: Component;
  environment: Environment;
  baseUrl: string;
  deploymentResult: DeploymentResult;
  config: VerificationConfig;
  timeout?: number;
  retries?: number;
  verbose?: boolean;
}

export class DeploymentVerifier {
  private component: Component;
  private environment: Environment;
  private baseUrl: string;
  private deploymentResult: DeploymentResult;
  private config: VerificationConfig;
  private timeout: number;
  private retries: number;
  private verbose: boolean;
  private healthChecker: HealthChecker;
  private startTime: Date;

  constructor(options: DeploymentVerifierOptions) {
    this.component = options.component;
    this.environment = options.environment;
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.deploymentResult = options.deploymentResult;
    this.config = options.config;
    this.timeout = options.timeout || 60000;
    this.retries = options.retries || 3;
    this.verbose = options.verbose || false;
    this.startTime = new Date();

    this.healthChecker = new HealthChecker({
      component: this.component,
      environment: this.environment,
      baseUrl: this.baseUrl,
      timeout: this.timeout,
      retries: this.retries,
      verbose: this.verbose
    });
  }

  /**
   * Coordinate all verification steps
   */
  async verify(): Promise<VerificationResult> {
    const allChecks: VerificationCheck[] = [];
    
    try {
      this.logProgress('Starting post-deployment verification...');
      
      // Health checks
      this.logProgress('Running health checks...');
      const healthChecks = await this.runHealthChecks();
      allChecks.push(...healthChecks);
      
      // UI checks
      this.logProgress('Running UI checks...');
      const uiChecks = await this.runUIChecks();
      allChecks.push(...uiChecks);
      
      // API endpoint checks
      this.logProgress('Running API endpoint checks...');
      const apiChecks = await this.runAPIChecks();
      allChecks.push(...apiChecks);
      
      // Cache validation
      this.logProgress('Validating cache busting...');
      const cacheChecks = await this.validateCacheBusting();
      allChecks.push(...cacheChecks);
      
      // Version validation
      this.logProgress('Validating version updates...');
      const versionChecks = await this.validateVersionUpdates();
      allChecks.push(...versionChecks);
      
      // Cross-component integration
      this.logProgress('Testing cross-component integration...');
      const integrationChecks = await this.testCrossComponentIntegration();
      allChecks.push(...integrationChecks);
      
      // Performance checks
      this.logProgress('Running performance checks...');
      const performanceChecks = await this.runPerformanceChecks();
      allChecks.push(...performanceChecks);
      
      // Security validation
      this.logProgress('Running security validation...');
      const securityChecks = await this.runSecurityValidation();
      allChecks.push(...securityChecks);
      
      // Environment variable validation
      this.logProgress('Validating environment variables...');
      const envChecks = await this.validateEnvironmentVariables();
      allChecks.push(envChecks);
      
      // Rollback readiness check
      this.logProgress('Verifying rollback readiness...');
      const rollbackChecks = await this.verifyRollbackReadiness();
      allChecks.push(...rollbackChecks);
      
      const duration = Date.now() - this.startTime.getTime();
      const successfulChecks = allChecks.filter(check => check.success);
      const failedChecks = allChecks.filter(check => !check.success);
      
      const success = failedChecks.length === 0;
      
      this.logProgress(
        `Verification completed: ${successfulChecks.length}/${allChecks.length} checks passed`
      );
      
      if (!success) {
        logger.warn(`Failed checks: ${failedChecks.map(c => c.name).join(', ')}`);
      }
      
      return {
        success,
        component: this.component,
        environment: this.environment,
        checks: allChecks,
        duration
      };
      
    } catch (error) {
      const duration = Date.now() - this.startTime.getTime();
      
      // Add error check
      allChecks.push({
        name: 'verification-error',
        type: 'health',
        success: false,
        message: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: 0,
        error: error instanceof Error ? error : new Error('Unknown error')
      });
      
      return {
        success: false,
        component: this.component,
        environment: this.environment,
        checks: allChecks,
        duration,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Run health checks
   */
  private async runHealthChecks(): Promise<VerificationCheck[]> {
    const componentConfig = this.config.healthChecks[this.component];
    if (!componentConfig) {
      return [{
        name: 'health-check-config-missing',
        type: 'health',
        success: false,
        message: `No health check configuration found for component: ${this.component}`,
        duration: 0
      }];
    }
    
    try {
      return await this.healthChecker.performHealthChecks(componentConfig);
    } catch (error) {
      return [{
        name: 'health-check-failed',
        type: 'health',
        success: false,
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: 0,
        error: error instanceof Error ? error : new Error('Unknown error')
      }];
    }
  }

  /**
   * Run UI checks
   */
  private async runUIChecks(): Promise<VerificationCheck[]> {
    const componentConfig = this.config.uiChecks[this.component];
    if (!componentConfig) {
      return [{
        name: 'ui-check-config-missing',
        type: 'ui',
        success: false,
        message: `No UI check configuration found for component: ${this.component}`,
        duration: 0
      }];
    }
    
    try {
      return await this.healthChecker.performUIChecks(componentConfig);
    } catch (error) {
      return [{
        name: 'ui-check-failed',
        type: 'ui',
        success: false,
        message: `UI check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: 0,
        error: error instanceof Error ? error : new Error('Unknown error')
      }];
    }
  }

  /**
   * Run API endpoint checks
   */
  private async runAPIChecks(): Promise<VerificationCheck[]> {
    const checks: VerificationCheck[] = [];
    const apiEndpoints = this.config.integrationChecks.apiEndpoints;
    
    for (const endpoint of apiEndpoints) {
      const startTime = Date.now();
      const checkName = `api-endpoint-${endpoint}`;
      
      try {
        const response = await axios.get(endpoint, {
          timeout: this.timeout,
          validateStatus: () => true
        });
        
        const duration = Date.now() - startTime;
        const success = response.status < 400;
        
        checks.push({
          name: checkName,
          type: 'api',
          success,
          message: success 
            ? `API endpoint responding (${response.status})` 
            : `API endpoint error (${response.status})`,
          duration,
          metadata: {
            endpoint,
            status: response.status,
            statusText: response.statusText
          }
        });
      } catch (error) {
        const duration = Date.now() - startTime;
        
        checks.push({
          name: checkName,
          type: 'api',
          success: false,
          message: `API endpoint check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          duration,
          error: error instanceof Error ? error : new Error('Unknown error'),
          metadata: { endpoint }
        });
      }
    }
    
    return checks;
  }

  /**
   * Validate cache busting effectiveness
   */
  private async validateCacheBusting(): Promise<VerificationCheck[]> {
    const checks: VerificationCheck[] = [];
    const componentConfig = this.config.cacheChecks[this.component];
    
    if (!componentConfig) {
      return [{
        name: 'cache-check-config-missing',
        type: 'cache',
        success: false,
        message: `No cache check configuration found for component: ${this.component}`,
        duration: 0
      }];
    }
    
    const startTime = Date.now();
    const checkName = `cache-busting-${this.component}`;
    
    try {
      // Check if the new version is being served
      const response = await axios.get(componentConfig.url, {
        timeout: this.timeout,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      const duration = Date.now() - startTime;
      
      // Check if response contains expected version
      const content = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      const versionFound = content.includes(componentConfig.expectedVersion);
      
      checks.push({
        name: checkName,
        type: 'cache',
        success: versionFound,
        message: versionFound 
          ? `New version ${componentConfig.expectedVersion} is being served` 
          : `Expected version ${componentConfig.expectedVersion} not found in response`,
        duration,
        metadata: {
          url: componentConfig.url,
          expectedVersion: componentConfig.expectedVersion,
          cacheKey: componentConfig.cacheKey
        }
      });
      
      // Check cache headers
      const cacheHeaders = response.headers['cache-control'] || '';
      const hasCacheControl = cacheHeaders.length > 0;
      
      checks.push({
        name: `cache-headers-${this.component}`,
        type: 'cache',
        success: hasCacheControl,
        message: hasCacheControl 
          ? `Cache headers present: ${cacheHeaders}` 
          : 'No cache control headers found',
        duration: 0,
        metadata: {
          cacheControl: cacheHeaders,
          etag: response.headers['etag'],
          lastModified: response.headers['last-modified']
        }
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      checks.push({
        name: checkName,
        type: 'cache',
        success: false,
        message: `Cache validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
        error: error instanceof Error ? error : new Error('Unknown error')
      });
    }
    
    return checks;
  }

  /**
   * Validate version updates are live
   */
  private async validateVersionUpdates(): Promise<VerificationCheck[]> {
    const checks: VerificationCheck[] = [];
    const startTime = Date.now();
    const checkName = `version-update-${this.component}`;
    
    try {
      const currentVersion = await getCurrentVersion();
      const versionEndpoint = `${this.baseUrl}/version.json`;
      
      const response = await axios.get(versionEndpoint, {
        timeout: this.timeout,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      const duration = Date.now() - startTime;
      
      const deployedVersion = response.data.version || response.data.buildNumber;
      const versionMatch = deployedVersion === currentVersion.version;
      
      checks.push({
        name: checkName,
        type: 'integration',
        success: versionMatch,
        message: versionMatch 
          ? `Version update confirmed: ${deployedVersion}` 
          : `Version mismatch: expected ${currentVersion.version}, got ${deployedVersion}`,
        duration,
        metadata: {
          expectedVersion: currentVersion.version,
          deployedVersion,
          versionEndpoint
        }
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // If version endpoint doesn't exist, that's not necessarily a failure
      const isNotFound = error instanceof Error && error.message.includes('404');
      
      checks.push({
        name: checkName,
        type: 'integration',
        success: isNotFound, // Success if endpoint doesn't exist (not all components have version endpoints)
        message: isNotFound 
          ? 'Version endpoint not available (acceptable for some components)' 
          : `Version validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
        error: isNotFound ? undefined : (error instanceof Error ? error : new Error('Unknown error'))
      });
    }
    
    return checks;
  }

  /**
   * Test cross-component integration
   */
  private async testCrossComponentIntegration(): Promise<VerificationCheck[]> {
    const checks: VerificationCheck[] = [];
    const crossComponentUrls = this.config.integrationChecks.crossComponentUrls;
    
    for (const url of crossComponentUrls) {
      const startTime = Date.now();
      const checkName = `cross-component-${url}`;
      
      try {
        const response = await axios.get(url, {
          timeout: this.timeout,
          validateStatus: () => true
        });
        
        const duration = Date.now() - startTime;
        const success = response.status < 400;
        
        checks.push({
          name: checkName,
          type: 'integration',
          success,
          message: success 
            ? `Cross-component URL accessible (${response.status})` 
            : `Cross-component URL error (${response.status})`,
          duration,
          metadata: {
            url,
            status: response.status,
            statusText: response.statusText
          }
        });
      } catch (error) {
        const duration = Date.now() - startTime;
        
        checks.push({
          name: checkName,
          type: 'integration',
          success: false,
          message: `Cross-component integration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          duration,
          error: error instanceof Error ? error : new Error('Unknown error'),
          metadata: { url }
        });
      }
    }
    
    return checks;
  }

  /**
   * Run performance checks
   */
  private async runPerformanceChecks(): Promise<VerificationCheck[]> {
    const componentConfig = this.config.performanceChecks[this.component];
    if (!componentConfig) {
      return [{
        name: 'performance-check-config-missing',
        type: 'performance',
        success: false,
        message: `No performance check configuration found for component: ${this.component}`,
        duration: 0
      }];
    }
    
    const checks: VerificationCheck[] = [];
    
    // Basic load time check
    const startTime = Date.now();
    const checkName = `load-time-${this.component}`;
    
    try {
      const response = await axios.get(componentConfig.url, {
        timeout: this.timeout
      });
      
      const duration = Date.now() - startTime;
      const loadThreshold = componentConfig.thresholds.load || 5000; // 5 seconds default
      const success = duration <= loadThreshold;
      
      checks.push({
        name: checkName,
        type: 'performance',
        success,
        message: success 
          ? `Load time ${duration}ms within threshold (${loadThreshold}ms)` 
          : `Load time ${duration}ms exceeds threshold (${loadThreshold}ms)`,
        duration,
        metadata: {
          url: componentConfig.url,
          loadTime: duration,
          threshold: loadThreshold
        }
      });
      
      // Response size check
      const responseSize = JSON.stringify(response.data).length;
      const sizeThreshold = componentConfig.thresholds.size || 1024 * 1024; // 1MB default
      const sizeOk = responseSize <= sizeThreshold;
      
      checks.push({
        name: `response-size-${this.component}`,
        type: 'performance',
        success: sizeOk,
        message: sizeOk 
          ? `Response size ${responseSize} bytes within threshold` 
          : `Response size ${responseSize} bytes exceeds threshold (${sizeThreshold} bytes)`,
        duration: 0,
        metadata: {
          responseSize,
          threshold: sizeThreshold
        }
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      checks.push({
        name: checkName,
        type: 'performance',
        success: false,
        message: `Performance check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
        error: error instanceof Error ? error : new Error('Unknown error')
      });
    }
    
    return checks;
  }

  /**
   * Run security validation
   */
  private async runSecurityValidation(): Promise<VerificationCheck[]> {
    const componentConfig = this.config.securityChecks[this.component];
    if (!componentConfig) {
      return [{
        name: 'security-check-config-missing',
        type: 'security',
        success: false,
        message: `No security check configuration found for component: ${this.component}`,
        duration: 0
      }];
    }
    
    const checks: VerificationCheck[] = [];
    const startTime = Date.now();
    
    try {
      const response = await axios.get(componentConfig.url, {
        timeout: this.timeout
      });
      
      const duration = Date.now() - startTime;
      const headers = response.headers;
      
      // Check for HTTPS
      if (componentConfig.checks.includes('https')) {
        const isHttps = componentConfig.url.startsWith('https://');
        checks.push({
          name: `https-${this.component}`,
          type: 'security',
          success: isHttps,
          message: isHttps ? 'HTTPS enabled' : 'HTTPS not enabled',
          duration: 0,
          metadata: { url: componentConfig.url }
        });
      }
      
      // Check security headers
      if (componentConfig.checks.includes('headers')) {
        const securityHeaders = [
          'x-frame-options',
          'x-content-type-options',
          'x-xss-protection',
          'strict-transport-security',
          'content-security-policy'
        ];
        
        const presentHeaders = securityHeaders.filter(header => headers[header]);
        const success = presentHeaders.length >= 3; // At least 3 security headers
        
        checks.push({
          name: `security-headers-${this.component}`,
          type: 'security',
          success,
          message: success 
            ? `Security headers present: ${presentHeaders.join(', ')}` 
            : `Insufficient security headers: ${presentHeaders.join(', ')}`,
          duration,
          metadata: {
            presentHeaders,
            missingHeaders: securityHeaders.filter(h => !headers[h])
          }
        });
      }
      
      // Check Content Security Policy
      if (componentConfig.checks.includes('csp')) {
        const csp = headers['content-security-policy'];
        checks.push({
          name: `csp-${this.component}`,
          type: 'security',
          success: !!csp,
          message: csp ? 'Content Security Policy present' : 'Content Security Policy missing',
          duration: 0,
          metadata: { csp }
        });
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      checks.push({
        name: `security-check-${this.component}`,
        type: 'security',
        success: false,
        message: `Security validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
        error: error instanceof Error ? error : new Error('Unknown error')
      });
    }
    
    return checks;
  }

  /**
   * Validate environment variables
   */
  private async validateEnvironmentVariables(): Promise<VerificationCheck> {
    const requiredVars = this.getRequiredEnvironmentVariables();
    return await this.healthChecker.validateEnvironmentVariables(requiredVars);
  }

  /**
   * Verify rollback readiness
   */
  private async verifyRollbackReadiness(): Promise<VerificationCheck[]> {
    const checks: VerificationCheck[] = [];
    
    // Check if previous deployment info is available
    const rollbackCheck: VerificationCheck = {
      name: `rollback-readiness-${this.component}`,
      type: 'integration',
      success: !!this.deploymentResult.deploymentId,
      message: this.deploymentResult.deploymentId 
        ? 'Rollback information available' 
        : 'No rollback information available',
      duration: 0,
      metadata: {
        deploymentId: this.deploymentResult.deploymentId,
        hasRollbackInfo: !!this.deploymentResult.deploymentId
      }
    };
    
    checks.push(rollbackCheck);
    
    return checks;
  }

  /**
   * Get required environment variables for component
   */
  private getRequiredEnvironmentVariables(): string[] {
    const baseVars = ['NODE_ENV'];
    
    switch (this.component) {
      case 'desktop':
        return [...baseVars, 'VERCEL_TOKEN'];
      case 'mobile':
        return [...baseVars, 'VERCEL_TOKEN', 'VITE_API_URL'];
      case 'backend':
        return [...baseVars, 'FIREBASE_PROJECT_ID'];
      case 'firebase':
        return [...baseVars, 'FIREBASE_PROJECT_ID', 'GOOGLE_APPLICATION_CREDENTIALS'];
      default:
        return baseVars;
    }
  }

  /**
   * Log progress with component context
   */
  private logProgress(message: string): void {
    const prefix = `[VERIFY:${this.component.toUpperCase()}:${this.environment}]`;
    logger.info(`${prefix} ${message}`);
  }

  /**
   * Clean up resources
   */
  private async cleanup(): Promise<void> {
    try {
      await this.healthChecker.cleanup();
    } catch (error) {
      logger.debug(`Cleanup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}