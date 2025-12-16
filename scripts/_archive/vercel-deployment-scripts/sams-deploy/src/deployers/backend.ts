import { BaseDeployer, DeployerOptions } from './base';
import { DeploymentResult } from '../types';
import { DeploymentError } from '../utils/error-handler';
import { executeWithRetry } from '../utils/process';
import * as path from 'path';
import * as fs from 'fs/promises';

export class BackendDeployer extends BaseDeployer {
  private readonly VERCEL_PROJECT_ID = 'prj_NeSBFub0ZvcZ8FJhp8jgPNzZgpId';
  private readonly HEALTH_CHECK_ENDPOINT = '/api/health';

  constructor(options: DeployerOptions) {
    super(options);
  }

  async build(): Promise<void> {
    this.logProgress('Building Backend API...');
    
    try {
      // Install dependencies
      this.logProgress('Installing dependencies...');
      await executeWithRetry('npm', ['install'], {
        cwd: this.projectPath,
        timeout: this.config.deploymentSettings.buildTimeout * 1000,
        maxRetries: this.config.deploymentSettings.retryAttempts,
        retryDelay: this.config.deploymentSettings.retryDelay
      });

      // Verify service account keys are present
      await this.verifyServiceAccountKeys();

      // Update CORS configuration
      await this.updateCorsConfiguration();

      this.logProgress('Build preparation completed successfully');
    } catch (error) {
      if (error instanceof DeploymentError) {
        throw error;
      }
      throw new DeploymentError(
        `Build failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'BUILD_FAILED',
        { error: error instanceof Error ? error.stack : error }
      );
    }
  }

  async deploy(): Promise<DeploymentResult> {
    try {
      this.logProgress('Deploying Backend API to Vercel...');
      
      // Prepare environment variables for deployment
      const envVars = this.getEnvironmentVariables();
      
      // Deploy to Vercel
      const deploymentUrl = await this.executeVercelDeploy(
        this.VERCEL_PROJECT_ID,
        {
          env: envVars,
          prod: this.environment === 'production',
          skipBuild: false // Let Vercel handle the build
        }
      );
      
      this.logProgress(`Deployment URL: ${deploymentUrl}`);
      
      // Verify deployment health
      await this.verifyDeployment(deploymentUrl);
      
      return this.createResult(true, deploymentUrl);
    } catch (error) {
      if (error instanceof DeploymentError) {
        throw error;
      }
      throw new DeploymentError(
        `Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DEPLOYMENT_FAILED',
        { error: error instanceof Error ? error.stack : error }
      );
    }
  }

  protected async checkComponentPrerequisites(): Promise<void> {
    // Check for required files
    const requiredFiles = [
      'package.json',
      'index.js',
      'vercel.json',
      'firebase.js'
    ];
    
    for (const file of requiredFiles) {
      const filePath = path.join(this.projectPath, file);
      try {
        await fs.access(filePath);
      } catch {
        throw new DeploymentError(
          `Required file not found: ${file}`,
          'FILE_MISSING',
          { file, path: filePath }
        );
      }
    }
    
    // Check for package.json structure
    const packageJsonPath = path.join(this.projectPath, 'package.json');
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      
      // Verify type is module (for ES modules)
      if (packageJson.type !== 'module') {
        throw new DeploymentError(
          'package.json must have "type": "module" for ES modules',
          'PACKAGE_CONFIG_ERROR',
          { type: packageJson.type }
        );
      }
      
      // Verify required dependencies
      const requiredDeps = ['express', 'cors', 'firebase-admin', 'dotenv'];
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };
      
      for (const dep of requiredDeps) {
        if (!allDeps[dep]) {
          throw new DeploymentError(
            `Required dependency not found: ${dep}`,
            'DEPENDENCY_MISSING',
            { dependency: dep }
          );
        }
      }
    } catch (error) {
      if (error instanceof DeploymentError) {
        throw error;
      }
      throw new DeploymentError(
        'Failed to validate package.json',
        'PACKAGE_JSON_ERROR',
        { path: packageJsonPath, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  private async verifyServiceAccountKeys(): Promise<void> {
    this.logProgress('Verifying Firebase service account keys...');
    
    const serviceAccountFiles = [
      'serviceAccountKey.json',
      'sams-production-serviceAccountKey.json'
    ];
    
    for (const file of serviceAccountFiles) {
      const filePath = path.join(this.projectPath, file);
      try {
        await fs.access(filePath);
        
        // Verify it's valid JSON
        const content = await fs.readFile(filePath, 'utf-8');
        const serviceAccount = JSON.parse(content);
        
        // Check for required fields
        const requiredFields = ['project_id', 'private_key', 'client_email'];
        for (const field of requiredFields) {
          if (!serviceAccount[field]) {
            throw new DeploymentError(
              `Service account key missing required field: ${field}`,
              'SERVICE_ACCOUNT_INVALID',
              { file, field }
            );
          }
        }
        
        this.logProgress(`Verified: ${file}`);
      } catch (error) {
        if (error instanceof DeploymentError) {
          throw error;
        }
        throw new DeploymentError(
          `Service account key verification failed: ${file}`,
          'SERVICE_ACCOUNT_ERROR',
          { file, error: error instanceof Error ? error.message : 'Unknown error' }
        );
      }
    }
  }

  private async updateCorsConfiguration(): Promise<void> {
    this.logProgress('Updating CORS configuration...');
    
    const indexPath = path.join(this.projectPath, 'index.js');
    try {
      let content = await fs.readFile(indexPath, 'utf-8');
      
      // Define all allowed origins based on environment
      const allowedOrigins = this.getAllowedOrigins();
      
      // Find and update the allowedOrigins array
      const originsPattern = /const\s+allowedOrigins\s*=\s*\[[^\]]*\]/s;
      const newOriginsArray = `const allowedOrigins = [\n${allowedOrigins.map(origin => `  '${origin}'`).join(',\n')}\n]`;
      
      if (originsPattern.test(content)) {
        content = content.replace(originsPattern, newOriginsArray);
        await fs.writeFile(indexPath, content, 'utf-8');
        this.logProgress('CORS configuration updated successfully');
      } else {
        this.logProgress('Warning: Could not find allowedOrigins array in index.js');
      }
    } catch (error) {
      this.logProgress(`Warning: Failed to update CORS configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getAllowedOrigins(): string[] {
    const envConfig = this.getEnvironmentConfig();
    const baseOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'https://sams.sandyland.com.mx',
      'https://mobile.sams.sandyland.com.mx'
    ];
    
    // Add environment-specific URLs
    if (this.environment !== 'production') {
      baseOrigins.push(envConfig.desktopUrl);
      baseOrigins.push(envConfig.mobileUrl);
    }
    
    // Remove duplicates
    return [...new Set(baseOrigins)];
  }

  private getEnvironmentVariables(): Record<string, string> {
    const envConfig = this.getEnvironmentConfig();
    
    return {
      NODE_ENV: this.environment,
      PORT: '5001',
      FIREBASE_PROJECT_ID: envConfig.firebaseProject,
      // Add any other required environment variables
      ...process.env
    };
  }

  private async verifyDeployment(url: string): Promise<void> {
    this.logProgress('Verifying Backend API deployment...');
    
    try {
      // Give the deployment some time to propagate
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Check health endpoint
      const healthUrl = `${url}${this.HEALTH_CHECK_ENDPOINT}`;
      this.logProgress(`Checking health endpoint: ${healthUrl}`);
      
      const result = await executeWithRetry(
        'curl',
        ['-s', '-o', '/dev/null', '-w', '%{http_code}', healthUrl],
        {
          timeout: this.config.healthChecks.backend.timeout * 1000,
          maxRetries: 5,
          retryDelay: 3000,
          captureOutput: true
        }
      );
      
      const statusCode = parseInt(result.stdout.trim());
      if (statusCode !== this.config.healthChecks.backend.expectedStatus) {
        throw new DeploymentError(
          `Health check failed. Expected ${this.config.healthChecks.backend.expectedStatus}, got ${statusCode}`,
          'HEALTH_CHECK_FAILED',
          { url: healthUrl, statusCode, expected: this.config.healthChecks.backend.expectedStatus }
        );
      }
      
      // Verify CORS headers
      await this.verifyCorsHeaders(url);
      
      // Test a few critical endpoints
      await this.verifyEndpoints(url);
      
      this.logProgress('Backend API deployment verified successfully');
    } catch (error) {
      if (error instanceof DeploymentError) {
        throw error;
      }
      throw new DeploymentError(
        `Deployment verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'VERIFICATION_FAILED',
        { error: error instanceof Error ? error.stack : error }
      );
    }
  }

  private async verifyCorsHeaders(url: string): Promise<void> {
    this.logProgress('Verifying CORS headers...');
    
    const testOrigins = [
      'https://sams.sandyland.com.mx',
      'https://mobile.sams.sandyland.com.mx'
    ];
    
    for (const origin of testOrigins) {
      try {
        const result = await executeWithRetry(
          'curl',
          [
            '-s',
            '-I',
            '-H', `Origin: ${origin}`,
            '-H', 'Access-Control-Request-Method: GET',
            `${url}/api/health`
          ],
          {
            timeout: 10000,
            captureOutput: true
          }
        );
        
        if (!result.stdout.includes('access-control-allow-origin')) {
          this.logProgress(`Warning: CORS headers not found for origin: ${origin}`);
        } else {
          this.logProgress(`CORS verified for origin: ${origin}`);
        }
      } catch (error) {
        this.logProgress(`Warning: Failed to verify CORS for ${origin}`);
      }
    }
  }

  private async verifyEndpoints(url: string): Promise<void> {
    this.logProgress('Verifying critical endpoints...');
    
    const endpoints = [
      { path: '/api/auth/reset-password', method: 'GET', expectedStatus: 405 },
      { path: '/api/clients', method: 'GET', expectedStatus: 401 }, // Should require auth
      { path: '/api/transactions', method: 'GET', expectedStatus: 401 } // Should require auth
    ];
    
    for (const endpoint of endpoints) {
      try {
        const result = await executeWithRetry(
          'curl',
          [
            '-s',
            '-o', '/dev/null',
            '-w', '%{http_code}',
            '-X', endpoint.method,
            `${url}${endpoint.path}`
          ],
          {
            timeout: 10000,
            captureOutput: true
          }
        );
        
        const statusCode = parseInt(result.stdout.trim());
        if (statusCode === endpoint.expectedStatus) {
          this.logProgress(`✓ ${endpoint.path} - Status ${statusCode} (expected)`);
        } else {
          this.logProgress(`⚠ ${endpoint.path} - Status ${statusCode} (expected ${endpoint.expectedStatus})`);
        }
      } catch (error) {
        this.logProgress(`✗ ${endpoint.path} - Failed to verify`);
      }
    }
  }

  protected async postDeployHook(result: DeploymentResult): Promise<void> {
    if (result.success && result.url) {
      this.logProgress('Running post-deployment tasks...');
      
      // Log deployment information
      this.logProgress('=== Backend API Deployment Complete ===');
      this.logProgress(`Environment: ${this.environment}`);
      this.logProgress(`Deployment URL: ${result.url}`);
      this.logProgress(`Health Check: ${result.url}${this.HEALTH_CHECK_ENDPOINT}`);
      this.logProgress('======================================');
      
      // Provide instructions for testing
      this.logProgress('\nTo test the API:');
      this.logProgress(`1. Health check: curl ${result.url}${this.HEALTH_CHECK_ENDPOINT}`);
      this.logProgress(`2. Test CORS: curl -H "Origin: https://sams.sandyland.com.mx" ${result.url}/api/health`);
      this.logProgress('3. Monitor logs: vercel logs --project ' + this.VERCEL_PROJECT_ID);
      
      // Update frontend configurations if needed
      if (this.environment === 'production') {
        this.logProgress('\nIMPORTANT: Update frontend configurations with the new API URL:');
        this.logProgress(`- Desktop: VITE_API_BASE_URL=${result.url}/api`);
        this.logProgress(`- Mobile: VITE_API_BASE_URL=${result.url}/api`);
      }
    }
  }
}