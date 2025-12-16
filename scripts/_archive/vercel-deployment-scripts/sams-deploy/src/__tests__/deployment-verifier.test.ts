import { DeploymentVerifier } from '../verifiers/deployment-verifier';
import { VerificationConfig, DeploymentResult } from '../types';

// Mock the health checker
jest.mock('../verifiers/health-checker');

// Mock axios
jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock version utils
jest.mock('../utils/version', () => ({
  getCurrentVersion: jest.fn(() => Promise.resolve({ version: '1.0.0', deployedBy: 'test' }))
}));

describe('DeploymentVerifier', () => {
  let verifier: DeploymentVerifier;
  let mockDeploymentResult: DeploymentResult;
  let mockVerificationConfig: VerificationConfig;

  beforeEach(() => {
    mockDeploymentResult = {
      success: true,
      component: 'desktop',
      environment: 'development',
      deploymentId: 'test-deployment-123',
      url: 'https://test.example.com',
      duration: 30000
    };

    mockVerificationConfig = {
      healthChecks: {
        desktop: {
          endpoint: 'https://test.example.com/health',
          method: 'GET',
          expectedStatus: 200,
          timeout: 30000,
          retries: 3
        }
      },
      uiChecks: {
        desktop: {
          url: 'https://test.example.com',
          checkElement: 'body',
          checkConsoleErrors: true
        }
      },
      performanceChecks: {
        desktop: {
          url: 'https://test.example.com',
          metrics: ['load'],
          thresholds: { load: 5000 }
        }
      },
      securityChecks: {
        desktop: {
          url: 'https://test.example.com',
          checks: ['https', 'headers']
        }
      },
      cacheChecks: {
        desktop: {
          url: 'https://test.example.com/version.json',
          cacheKey: 'version',
          expectedVersion: '1.0.0'
        }
      },
      integrationChecks: {
        crossComponentUrls: ['https://test.example.com/api'],
        apiEndpoints: ['https://api.example.com/health']
      }
    };

    verifier = new DeploymentVerifier({
      component: 'desktop',
      environment: 'development',
      baseUrl: 'https://test.example.com',
      deploymentResult: mockDeploymentResult,
      config: mockVerificationConfig,
      timeout: 30000,
      retries: 2
    });

    jest.clearAllMocks();
  });

  describe('verify', () => {
    it('should run all verification checks successfully', async () => {
      // Mock successful HTTP responses
      mockedAxios.get.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {
          'content-security-policy': 'default-src \'self\'',
          'x-frame-options': 'DENY'
        },
        data: { version: '1.0.0' }
      });

      const result = await verifier.verify();

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.component).toBe('desktop');
      expect(result.environment).toBe('development');
      expect(result.checks).toBeDefined();
      expect(result.checks.length).toBeGreaterThan(0);
    });

    it('should handle verification failures gracefully', async () => {
      // Mock failed HTTP responses
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      const result = await verifier.verify();

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.checks.some(check => !check.success)).toBe(true);
    });

    it('should skip verification if no config provided', async () => {
      const verifierWithoutConfig = new DeploymentVerifier({
        component: 'desktop',
        environment: 'development',
        baseUrl: 'https://test.example.com',
        deploymentResult: mockDeploymentResult,
        config: {} as VerificationConfig,
        timeout: 30000,
        retries: 2
      });

      const result = await verifierWithoutConfig.verify();

      expect(result).toBeDefined();
      // Should still run some checks even without full config
      expect(result.checks.length).toBeGreaterThan(0);
    });
  });

  describe('validateCacheBusting', () => {
    it('should validate cache busting with correct version', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        headers: {
          'cache-control': 'no-cache, no-store, must-revalidate'
        },
        data: JSON.stringify({ version: '1.0.0' })
      });

      const result = await verifier.verify();
      
      const cacheCheck = result.checks.find(check => check.name.includes('cache-busting'));
      expect(cacheCheck).toBeDefined();
      expect(cacheCheck?.success).toBe(true);
    });

    it('should detect cache busting failures', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        headers: {},
        data: JSON.stringify({ version: '0.9.0' }) // Wrong version
      });

      const result = await verifier.verify();
      
      const cacheCheck = result.checks.find(check => check.name.includes('cache-busting'));
      expect(cacheCheck?.success).toBe(false);
    });
  });

  describe('testCrossComponentIntegration', () => {
    it('should test cross-component URLs', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        data: 'OK'
      });

      const result = await verifier.verify();
      
      const integrationChecks = result.checks.filter(check => check.type === 'integration');
      expect(integrationChecks.length).toBeGreaterThan(0);
    });

    it('should handle cross-component failures', async () => {
      mockedAxios.get.mockImplementation((url) => {
        if (typeof url === 'string' && url.includes('api')) {
          return Promise.reject(new Error('API not available'));
        }
        return Promise.resolve({ status: 200, data: 'OK' });
      });

      const result = await verifier.verify();
      
      const failedIntegrationCheck = result.checks.find(
        check => check.type === 'integration' && !check.success
      );
      expect(failedIntegrationCheck).toBeDefined();
    });
  });

  describe('runPerformanceChecks', () => {
    it('should validate performance within thresholds', async () => {
      // Mock fast response
      mockedAxios.get.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              status: 200,
              data: 'OK'
            });
          }, 100); // Fast response
        });
      });

      const result = await verifier.verify();
      
      const performanceCheck = result.checks.find(check => check.type === 'performance');
      expect(performanceCheck).toBeDefined();
    });

    it('should detect performance issues', async () => {
      // Mock slow response
      mockedAxios.get.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              status: 200,
              data: 'OK'
            });
          }, 6000); // Slow response (exceeds 5000ms threshold)
        });
      });

      const result = await verifier.verify();
      
      const performanceCheck = result.checks.find(
        check => check.type === 'performance' && check.name.includes('load-time')
      );
      expect(performanceCheck?.success).toBe(false);
    });
  });

  describe('runSecurityValidation', () => {
    it('should validate security headers', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        headers: {
          'x-frame-options': 'DENY',
          'x-content-type-options': 'nosniff',
          'x-xss-protection': '1; mode=block',
          'strict-transport-security': 'max-age=31536000',
          'content-security-policy': 'default-src \'self\''
        },
        data: 'OK'
      });

      const result = await verifier.verify();
      
      const securityCheck = result.checks.find(
        check => check.type === 'security' && check.name.includes('security-headers')
      );
      expect(securityCheck).toBeDefined();
      expect(securityCheck?.success).toBe(true);
    });

    it('should detect missing security headers', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        headers: {
          'x-frame-options': 'DENY' // Only one security header
        },
        data: 'OK'
      });

      const result = await verifier.verify();
      
      const securityCheck = result.checks.find(
        check => check.type === 'security' && check.name.includes('security-headers')
      );
      expect(securityCheck?.success).toBe(false);
    });

    it('should validate HTTPS usage', async () => {
      const result = await verifier.verify();
      
      const httpsCheck = result.checks.find(
        check => check.type === 'security' && check.name.includes('https')
      );
      expect(httpsCheck).toBeDefined();
      expect(httpsCheck?.success).toBe(true); // URL starts with https://
    });
  });

  describe('verifyRollbackReadiness', () => {
    it('should confirm rollback readiness when deployment ID is available', async () => {
      const result = await verifier.verify();
      
      const rollbackCheck = result.checks.find(check => check.name.includes('rollback-readiness'));
      expect(rollbackCheck).toBeDefined();
      expect(rollbackCheck?.success).toBe(true);
    });

    it('should detect missing rollback information', async () => {
      const deploymentWithoutId = {
        ...mockDeploymentResult,
        deploymentId: undefined
      };

      const verifierWithoutRollback = new DeploymentVerifier({
        component: 'desktop',
        environment: 'development',
        baseUrl: 'https://test.example.com',
        deploymentResult: deploymentWithoutId,
        config: mockVerificationConfig
      });

      const result = await verifierWithoutRollback.verify();
      
      const rollbackCheck = result.checks.find(check => check.name.includes('rollback-readiness'));
      expect(rollbackCheck?.success).toBe(false);
    });
  });
});