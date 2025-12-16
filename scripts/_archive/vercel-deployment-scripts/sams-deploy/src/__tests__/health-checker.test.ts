import { HealthChecker } from '../verifiers/health-checker';
import { HealthCheckConfig, UICheckConfig } from '../types';

// Mock axios
jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock puppeteer
jest.mock('puppeteer', () => ({
  launch: jest.fn(() => Promise.resolve({
    newPage: jest.fn(() => Promise.resolve({
      setViewport: jest.fn(),
      goto: jest.fn(() => Promise.resolve({ status: () => 200 })),
      content: jest.fn(() => Promise.resolve('<html><body>Test content</body></html>')),
      $: jest.fn(() => Promise.resolve({})),
      close: jest.fn(),
      on: jest.fn(),
      waitForTimeout: jest.fn(),
      screenshot: jest.fn()
    })),
    close: jest.fn()
  }))
}));

describe('HealthChecker', () => {
  let healthChecker: HealthChecker;

  beforeEach(() => {
    healthChecker = new HealthChecker({
      component: 'desktop',
      environment: 'development',
      baseUrl: 'https://test.example.com',
      timeout: 5000,
      retries: 2
    });

    jest.clearAllMocks();
  });

  afterEach(async () => {
    await healthChecker.cleanup();
  });

  describe('performHealthChecks', () => {
    const mockConfig: HealthCheckConfig = {
      endpoint: 'https://test.example.com/health',
      method: 'GET',
      expectedStatus: 200,
      timeout: 5000,
      retries: 2
    };

    it('should perform successful health check', async () => {
      mockedAxios.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: 'OK'
      } as any);

      const checks = await healthChecker.performHealthChecks(mockConfig);

      expect(checks).toBeDefined();
      expect(checks.length).toBeGreaterThan(0);
      expect(checks[0].success).toBe(true);
      expect(checks[0].type).toBe('health');
      expect(checks[0].name).toContain('endpoint-health');
    });

    it('should handle failed health check', async () => {
      mockedAxios.mockRejectedValueOnce(new Error('Network error'));

      const checks = await healthChecker.performHealthChecks(mockConfig);

      expect(checks).toBeDefined();
      expect(checks.length).toBeGreaterThan(0);
      expect(checks[0].success).toBe(false);
      expect(checks[0].error).toBeDefined();
    });

    it('should validate response status', async () => {
      mockedAxios.mockResolvedValueOnce({
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        data: 'Error'
      } as any);

      const checks = await healthChecker.performHealthChecks(mockConfig);

      expect(checks).toBeDefined();
      expect(checks[0].success).toBe(false);
      expect(checks[0].message).toContain('Expected status 200, got 500');
    });

    it('should check SSL certificate for HTTPS endpoints', async () => {
      const httpsConfig = {
        ...mockConfig,
        endpoint: 'https://secure.example.com/health'
      };

      mockedAxios.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: 'OK'
      } as any);

      const checks = await healthChecker.performHealthChecks(httpsConfig);

      expect(checks.some(check => check.name.includes('ssl-certificate'))).toBe(true);
    });

    it('should validate content when specified', async () => {
      const configWithContentCheck = {
        ...mockConfig,
        checkContent: 'Expected Content'
      };

      mockedAxios.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: 'This contains Expected Content in response'
      } as any);

      const checks = await healthChecker.performHealthChecks(configWithContentCheck);

      const contentCheck = checks.find(check => check.name.includes('content-validation'));
      expect(contentCheck).toBeDefined();
      expect(contentCheck?.success).toBe(true);
    });
  });

  describe('performUIChecks', () => {
    const mockUIConfig: UICheckConfig = {
      url: 'https://test.example.com',
      checkElement: 'body',
      checkText: 'Test content',
      checkConsoleErrors: true,
      screenshot: false
    };

    it('should perform successful page load check', async () => {
      const checks = await healthChecker.performUIChecks(mockUIConfig);

      expect(checks).toBeDefined();
      expect(checks.length).toBeGreaterThan(0);
      
      const pageLoadCheck = checks.find(check => check.name.includes('page-load'));
      expect(pageLoadCheck).toBeDefined();
      expect(pageLoadCheck?.type).toBe('ui');
    });

    it('should check element presence', async () => {
      const checks = await healthChecker.performUIChecks(mockUIConfig);

      const elementCheck = checks.find(check => check.name.includes('element-presence'));
      expect(elementCheck).toBeDefined();
      expect(elementCheck?.success).toBe(true);
    });

    it('should check text content', async () => {
      const checks = await healthChecker.performUIChecks(mockUIConfig);

      const textCheck = checks.find(check => check.name.includes('text-content'));
      expect(textCheck).toBeDefined();
    });

    it('should check console errors', async () => {
      const checks = await healthChecker.performUIChecks(mockUIConfig);

      const consoleCheck = checks.find(check => check.name.includes('console-errors'));
      expect(consoleCheck).toBeDefined();
      expect(consoleCheck?.type).toBe('ui');
    });
  });

  describe('validateEnvironmentVariables', () => {
    it('should validate present environment variables', async () => {
      process.env.TEST_VAR = 'test-value';
      
      const check = await healthChecker.validateEnvironmentVariables(['TEST_VAR']);

      expect(check.success).toBe(true);
      expect(check.message).toContain('All required environment variables present');

      delete process.env.TEST_VAR;
    });

    it('should detect missing environment variables', async () => {
      const check = await healthChecker.validateEnvironmentVariables(['MISSING_VAR']);

      expect(check.success).toBe(false);
      expect(check.message).toContain('Missing environment variables: MISSING_VAR');
    });

    it('should provide detailed metadata', async () => {
      process.env.PRESENT_VAR = 'value';
      
      const check = await healthChecker.validateEnvironmentVariables(['PRESENT_VAR', 'MISSING_VAR']);

      expect(check.metadata).toBeDefined();
      expect(check.metadata?.presentVars).toContain('PRESENT_VAR');
      expect(check.metadata?.missingVars).toContain('MISSING_VAR');

      delete process.env.PRESENT_VAR;
    });
  });
});