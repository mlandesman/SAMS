import axios, { AxiosResponse } from 'axios';
import puppeteer, { Browser } from 'puppeteer';
import { 
  Component, 
  Environment, 
  VerificationCheck, 
  HealthCheckConfig, 
  UICheckConfig
} from '../types';
import { logger } from '../utils/logger';
import { DeploymentError } from '../utils/error-handler';

export interface HealthCheckerOptions {
  component: Component;
  environment: Environment;
  baseUrl: string;
  timeout?: number;
  retries?: number;
  verbose?: boolean;
}

export class HealthChecker {
  private component: Component;
  private environment: Environment;
  // Remove baseUrl as it's not used in checks
  private timeout: number;
  private retries: number;
  private verbose: boolean;
  private browser?: Browser;

  constructor(options: HealthCheckerOptions) {
    this.component = options.component;
    this.environment = options.environment;
    // baseUrl is passed but not stored as it's used per-check
    this.timeout = options.timeout || 30000;
    this.retries = options.retries || 3;
    this.verbose = options.verbose || false;
  }

  /**
   * Perform comprehensive health checks on deployed components
   */
  async performHealthChecks(config: HealthCheckConfig): Promise<VerificationCheck[]> {
    const checks: VerificationCheck[] = [];
    
    try {
      // Basic endpoint availability check
      checks.push(await this.checkEndpointHealth(config));
      
      // Response time check
      checks.push(await this.checkResponseTime(config));
      
      // SSL certificate check (for HTTPS endpoints)
      if (config.endpoint.startsWith('https://')) {
        checks.push(await this.checkSSLCertificate(config));
      }
      
      // Content validation check
      if (config.checkContent) {
        checks.push(await this.checkEndpointContent(config));
      }
      
      // Headers validation
      if (config.headers) {
        checks.push(await this.checkResponseHeaders(config));
      }
      
    } catch (error) {
      checks.push({
        name: 'health-check-error',
        type: 'health',
        success: false,
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: 0,
        error: error instanceof Error ? error : new Error('Unknown error')
      });
    }
    
    return checks;
  }

  /**
   * Check basic endpoint availability
   */
  private async checkEndpointHealth(config: HealthCheckConfig): Promise<VerificationCheck> {
    const startTime = Date.now();
    const checkName = `endpoint-health-${config.endpoint}`;
    
    try {
      const response = await this.makeHttpRequest(config);
      const duration = Date.now() - startTime;
      
      const success = response.status === config.expectedStatus;
      
      return {
        name: checkName,
        type: 'health',
        success,
        message: success 
          ? `Endpoint responding with status ${response.status}` 
          : `Expected status ${config.expectedStatus}, got ${response.status}`,
        duration,
        metadata: {
          status: response.status,
          statusText: response.statusText,
          responseTime: duration,
          endpoint: config.endpoint
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        name: checkName,
        type: 'health',
        success: false,
        message: `Endpoint health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
        error: error instanceof Error ? error : new Error('Unknown error'),
        metadata: {
          endpoint: config.endpoint
        }
      };
    }
  }

  /**
   * Check response time performance
   */
  private async checkResponseTime(config: HealthCheckConfig): Promise<VerificationCheck> {
    const startTime = Date.now();
    const checkName = `response-time-${config.endpoint}`;
    const maxResponseTime = config.timeout || this.timeout;
    
    try {
      await this.makeHttpRequest(config);
      const duration = Date.now() - startTime;
      
      const success = duration <= maxResponseTime;
      
      return {
        name: checkName,
        type: 'performance',
        success,
        message: success 
          ? `Response time ${duration}ms within limit` 
          : `Response time ${duration}ms exceeds limit of ${maxResponseTime}ms`,
        duration,
        metadata: {
          responseTime: duration,
          limit: maxResponseTime,
          endpoint: config.endpoint
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        name: checkName,
        type: 'performance',
        success: false,
        message: `Response time check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }

  /**
   * Check SSL certificate validity
   */
  private async checkSSLCertificate(config: HealthCheckConfig): Promise<VerificationCheck> {
    const startTime = Date.now();
    const checkName = `ssl-certificate-${config.endpoint}`;
    
    try {
      await this.makeHttpRequest({
        ...config,
        timeout: this.timeout
      });
      
      const duration = Date.now() - startTime;
      
      // If we got a response without SSL errors, certificate is valid
      return {
        name: checkName,
        type: 'security',
        success: true,
        message: 'SSL certificate is valid and trusted',
        duration,
        metadata: {
          endpoint: config.endpoint,
          protocol: 'https'
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      const isSSLError = error instanceof Error && (
        error.message.includes('certificate') ||
        error.message.includes('SSL') ||
        error.message.includes('TLS')
      );
      
      return {
        name: checkName,
        type: 'security',
        success: false,
        message: isSSLError 
          ? `SSL certificate error: ${error.message}` 
          : `SSL check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }

  /**
   * Check endpoint content validation
   */
  private async checkEndpointContent(config: HealthCheckConfig): Promise<VerificationCheck> {
    const startTime = Date.now();
    const checkName = `content-validation-${config.endpoint}`;
    
    try {
      const response = await this.makeHttpRequest(config);
      const duration = Date.now() - startTime;
      
      const content = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      
      let success = false;
      let message = '';
      
      if (typeof config.checkContent === 'string') {
        success = content.includes(config.checkContent);
        message = success 
          ? `Content contains expected text: "${config.checkContent}"` 
          : `Content does not contain expected text: "${config.checkContent}"`;
      } else if (config.checkContent instanceof RegExp) {
        success = config.checkContent.test(content);
        message = success 
          ? `Content matches expected pattern: ${config.checkContent}` 
          : `Content does not match expected pattern: ${config.checkContent}`;
      }
      
      return {
        name: checkName,
        type: 'health',
        success,
        message,
        duration,
        metadata: {
          endpoint: config.endpoint,
          contentLength: content.length
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        name: checkName,
        type: 'health',
        success: false,
        message: `Content validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }

  /**
   * Check response headers
   */
  private async checkResponseHeaders(config: HealthCheckConfig): Promise<VerificationCheck> {
    const startTime = Date.now();
    const checkName = `response-headers-${config.endpoint}`;
    
    try {
      const response = await this.makeHttpRequest(config);
      const duration = Date.now() - startTime;
      
      const missingHeaders: string[] = [];
      const incorrectHeaders: string[] = [];
      
      if (config.headers) {
        for (const [expectedHeader, expectedValue] of Object.entries(config.headers)) {
          const actualValue = response.headers[expectedHeader.toLowerCase()];
          
          if (!actualValue) {
            missingHeaders.push(expectedHeader);
          } else if (actualValue !== expectedValue) {
            incorrectHeaders.push(`${expectedHeader}: expected "${expectedValue}", got "${actualValue}"`);
          }
        }
      }
      
      const success = missingHeaders.length === 0 && incorrectHeaders.length === 0;
      
      let message = 'All expected headers present and correct';
      if (!success) {
        const issues = [
          ...missingHeaders.map(h => `Missing header: ${h}`),
          ...incorrectHeaders
        ];
        message = `Header validation issues: ${issues.join(', ')}`;
      }
      
      return {
        name: checkName,
        type: 'health',
        success,
        message,
        duration,
        metadata: {
          endpoint: config.endpoint,
          missingHeaders,
          incorrectHeaders
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        name: checkName,
        type: 'health',
        success: false,
        message: `Header validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }

  /**
   * Perform UI verification with headless browser
   */
  async performUIChecks(config: UICheckConfig): Promise<VerificationCheck[]> {
    const checks: VerificationCheck[] = [];
    
    try {
      await this.initializeBrowser();
      
      // Page load check
      checks.push(await this.checkPageLoad(config));
      
      // Element presence check
      if (config.checkElement) {
        checks.push(await this.checkElementPresence(config));
      }
      
      // Text content check
      if (config.checkText) {
        checks.push(await this.checkTextContent(config));
      }
      
      // Console errors check
      if (config.checkConsoleErrors) {
        checks.push(await this.checkConsoleErrors(config));
      }
      
      // Screenshot capture
      if (config.screenshot) {
        checks.push(await this.captureScreenshot(config));
      }
      
    } catch (error) {
      checks.push({
        name: 'ui-check-error',
        type: 'ui',
        success: false,
        message: `UI check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: 0,
        error: error instanceof Error ? error : new Error('Unknown error')
      });
    } finally {
      await this.closeBrowser();
    }
    
    return checks;
  }

  /**
   * Check page load functionality
   */
  private async checkPageLoad(config: UICheckConfig): Promise<VerificationCheck> {
    const startTime = Date.now();
    const checkName = `page-load-${config.url}`;
    
    try {
      if (!this.browser) {
        throw new Error('Browser not initialized');
      }
      
      const page = await this.browser.newPage();
      
      // Set viewport
      await page.setViewport({ width: 1920, height: 1080 });
      
      // Navigate to page
      const response = await page.goto(config.url, {
        waitUntil: 'networkidle2',
        timeout: config.timeout || this.timeout
      });
      
      const duration = Date.now() - startTime;
      
      const success = response !== null && response.status() < 400;
      
      await page.close();
      
      return {
        name: checkName,
        type: 'ui',
        success,
        message: success 
          ? `Page loaded successfully (${response?.status()})` 
          : `Page load failed (${response?.status() || 'no response'})`,
        duration,
        metadata: {
          url: config.url,
          status: response?.status(),
          loadTime: duration
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        name: checkName,
        type: 'ui',
        success: false,
        message: `Page load check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }

  /**
   * Check element presence on page
   */
  private async checkElementPresence(config: UICheckConfig): Promise<VerificationCheck> {
    const startTime = Date.now();
    const checkName = `element-presence-${config.checkElement}`;
    
    try {
      if (!this.browser) {
        throw new Error('Browser not initialized');
      }
      
      const page = await this.browser.newPage();
      
      await page.goto(config.url, {
        waitUntil: 'networkidle2',
        timeout: config.timeout || this.timeout
      });
      
      // Wait for element or timeout
      const element = await page.$(config.checkElement!);
      const duration = Date.now() - startTime;
      
      const success = element !== null;
      
      await page.close();
      
      return {
        name: checkName,
        type: 'ui',
        success,
        message: success 
          ? `Element found: ${config.checkElement}` 
          : `Element not found: ${config.checkElement}`,
        duration,
        metadata: {
          url: config.url,
          selector: config.checkElement
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        name: checkName,
        type: 'ui',
        success: false,
        message: `Element presence check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }

  /**
   * Check text content on page
   */
  private async checkTextContent(config: UICheckConfig): Promise<VerificationCheck> {
    const startTime = Date.now();
    const checkName = `text-content-${config.checkText}`;
    
    try {
      if (!this.browser) {
        throw new Error('Browser not initialized');
      }
      
      const page = await this.browser.newPage();
      
      await page.goto(config.url, {
        waitUntil: 'networkidle2',
        timeout: config.timeout || this.timeout
      });
      
      // Get page content
      const pageContent = await page.content();
      const duration = Date.now() - startTime;
      
      const success = pageContent.includes(config.checkText!);
      
      await page.close();
      
      return {
        name: checkName,
        type: 'ui',
        success,
        message: success 
          ? `Text found on page: "${config.checkText}"` 
          : `Text not found on page: "${config.checkText}"`,
        duration,
        metadata: {
          url: config.url,
          searchText: config.checkText
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        name: checkName,
        type: 'ui',
        success: false,
        message: `Text content check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }

  /**
   * Check for console errors
   */
  private async checkConsoleErrors(config: UICheckConfig): Promise<VerificationCheck> {
    const startTime = Date.now();
    const checkName = `console-errors-${config.url}`;
    
    try {
      if (!this.browser) {
        throw new Error('Browser not initialized');
      }
      
      const page = await this.browser.newPage();
      const consoleErrors: string[] = [];
      
      // Listen for console messages
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      
      // Listen for page errors
      page.on('pageerror', (error) => {
        consoleErrors.push(`PageError: ${error.message}`);
      });
      
      await page.goto(config.url, {
        waitUntil: 'networkidle2',
        timeout: config.timeout || this.timeout
      });
      
      // Wait a bit for any async errors
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const duration = Date.now() - startTime;
      const success = consoleErrors.length === 0;
      
      await page.close();
      
      return {
        name: checkName,
        type: 'ui',
        success,
        message: success 
          ? 'No console errors detected' 
          : `Console errors detected: ${consoleErrors.length}`,
        duration,
        metadata: {
          url: config.url,
          errorCount: consoleErrors.length,
          errors: consoleErrors
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        name: checkName,
        type: 'ui',
        success: false,
        message: `Console error check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }

  /**
   * Capture screenshot for verification
   */
  private async captureScreenshot(config: UICheckConfig): Promise<VerificationCheck> {
    const startTime = Date.now();
    const checkName = `screenshot-${config.url}`;
    
    try {
      if (!this.browser) {
        throw new Error('Browser not initialized');
      }
      
      const page = await this.browser.newPage();
      
      await page.setViewport({ width: 1920, height: 1080 });
      
      await page.goto(config.url, {
        waitUntil: 'networkidle2',
        timeout: config.timeout || this.timeout
      });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `screenshot-${this.component}-${this.environment}-${timestamp}.png`;
      const screenshotPath = `/tmp/${filename}`;
      
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
        type: 'png'
      });
      
      const duration = Date.now() - startTime;
      
      await page.close();
      
      return {
        name: checkName,
        type: 'ui',
        success: true,
        message: `Screenshot captured: ${filename}`,
        duration,
        metadata: {
          url: config.url,
          screenshotPath,
          filename
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        name: checkName,
        type: 'ui',
        success: false,
        message: `Screenshot capture failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }

  /**
   * Validate environment variables
   */
  async validateEnvironmentVariables(requiredVars: string[]): Promise<VerificationCheck> {
    const startTime = Date.now();
    const checkName = 'environment-variables';
    
    try {
      const missingVars: string[] = [];
      const presentVars: string[] = [];
      
      for (const varName of requiredVars) {
        if (process.env[varName]) {
          presentVars.push(varName);
        } else {
          missingVars.push(varName);
        }
      }
      
      const duration = Date.now() - startTime;
      const success = missingVars.length === 0;
      
      return {
        name: checkName,
        type: 'health',
        success,
        message: success 
          ? `All required environment variables present (${presentVars.length})` 
          : `Missing environment variables: ${missingVars.join(', ')}`,
        duration,
        metadata: {
          required: requiredVars.length,
          present: presentVars.length,
          missing: missingVars.length,
          missingVars,
          presentVars
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        name: checkName,
        type: 'health',
        success: false,
        message: `Environment variable validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }

  /**
   * Initialize Puppeteer browser
   */
  private async initializeBrowser(): Promise<void> {
    if (this.browser) {
      return;
    }
    
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--allow-running-insecure-content'
        ],
        timeout: this.timeout
      });
      
      if (this.verbose) {
        logger.debug('Puppeteer browser initialized');
      }
    } catch (error) {
      throw new DeploymentError(
        'Failed to initialize Puppeteer browser',
        'BROWSER_INIT_FAILED',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Close Puppeteer browser
   */
  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = undefined;
        
        if (this.verbose) {
          logger.debug('Puppeteer browser closed');
        }
      } catch (error) {
        logger.warn(`Failed to close browser: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Make HTTP request with retries
   */
  private async makeHttpRequest(config: HealthCheckConfig): Promise<AxiosResponse> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        const response = await axios({
          method: config.method,
          url: config.endpoint,
          headers: config.headers,
          data: config.body,
          timeout: config.timeout || this.timeout,
          validateStatus: () => true, // Don't throw on any status code
          maxRedirects: 5
        });
        
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (this.verbose) {
          logger.debug(`HTTP request attempt ${attempt}/${this.retries} failed: ${lastError.message}`);
        }
        
        // Wait before retry (except for last attempt)
        if (attempt < this.retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    throw lastError || new Error('HTTP request failed after all retries');
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await this.closeBrowser();
  }
}