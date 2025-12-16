import { BaseDeployer, DeployerOptions } from './base';
import { DeploymentResult } from '../types';
import { DeploymentError } from '../utils/error-handler';
import { execute, executeWithRetry } from '../utils/process';
import { executeCacheBusting } from '../utils/cache-buster';
import { autoIncrementDeploymentVersion, VersionManager } from '../utils/version-manager';
import * as path from 'path';
import * as fs from 'fs/promises';

export class MobileDeployer extends BaseDeployer {
  private readonly VERCEL_PROJECT_ID = 'prj_YK2LOarIlgUlUWAaKRfCLaxgrk0l';
  private readonly MOBILE_DOMAIN = 'mobile.sams.sandyland.com.mx';

  constructor(options: DeployerOptions) {
    super(options);
  }

  async build(): Promise<void> {
    this.logProgress('Building Mobile PWA...');
    
    try {
      // Increment version for deployment
      const versionMetadata = await autoIncrementDeploymentVersion(
        this.projectPath,
        this.environment,
        'patch',
        ['Mobile PWA deployment', 'PWA cache invalidation', 'Version notifications enabled']
      );
      
      this.logProgress(`🔢 Building Mobile PWA v${versionMetadata.version}`);

      // Install dependencies
      this.logProgress('Installing dependencies...');
      await executeWithRetry('npm', ['install', '--legacy-peer-deps'], {
        cwd: this.projectPath,
        timeout: this.config.deploymentSettings.buildTimeout * 1000,
        maxRetries: this.config.deploymentSettings.retryAttempts,
        retryDelay: this.config.deploymentSettings.retryDelay
      });

      // Generate version notification script
      const versionManager = new VersionManager(this.projectPath, this.environment);
      const notificationScript = versionManager.generateVersionNotificationScript();
      
      // Write version notification script to public directory
      const notificationPath = path.join(this.projectPath, 'public', 'version-check.js');
      await fs.writeFile(notificationPath, notificationScript);
      this.logProgress('Generated version notification script');

      // Build the mobile app
      this.logProgress('Running build command...');
      await executeWithRetry('npm', ['run', 'build'], {
        cwd: this.projectPath,
        timeout: this.config.deploymentSettings.buildTimeout * 1000,
        maxRetries: this.config.deploymentSettings.retryAttempts,
        retryDelay: this.config.deploymentSettings.retryDelay,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          VITE_APP_ENV: this.environment,
          VITE_USE_EMULATOR: 'false',
          VITE_API_BASE_URL: this.getApiUrl(),
          VITE_BUILD_VERSION: versionMetadata.version,
          VITE_BUILD_ID: versionMetadata.buildId,
          VITE_CACHE_BUST: new Date().getTime().toString()
        }
      });

      // Verify build output
      const distPath = path.join(this.projectPath, 'dist');
      try {
        await fs.access(distPath);
        const stats = await fs.stat(distPath);
        if (!stats.isDirectory()) {
          throw new DeploymentError(
            'Build output is not a directory',
            'BUILD_OUTPUT_INVALID',
            { path: distPath }
          );
        }
        
        // Check for essential PWA files
        const essentialFiles = ['index.html', 'manifest.json', 'sw.js'];
        for (const file of essentialFiles) {
          const filePath = path.join(distPath, file);
          try {
            await fs.access(filePath);
          } catch {
            throw new DeploymentError(
              `Essential PWA file missing: ${file}`,
              'PWA_FILE_MISSING',
              { file, path: filePath }
            );
          }
        }
        
        // Check for PWA icons
        const iconFiles = ['icon-192x192.png', 'icon-512x512.png'];
        for (const icon of iconFiles) {
          const iconPath = path.join(distPath, icon);
          try {
            await fs.access(iconPath);
          } catch {
            this.logProgress(`Warning: PWA icon missing: ${icon}`);
          }
        }
        
        this.logProgress('Build completed successfully');
        
        // Execute PWA-specific cache-busting
        this.logProgress('🔥 Executing PWA cache-busting...');
        const cacheBustResult = await executeCacheBusting({
          environment: this.environment as any,
          projectPath: this.projectPath,
          buildOutputPath: distPath,
          skipVercelPurge: false,
          skipFileRename: false
        });
        
        if (!cacheBustResult.success) {
          this.logProgress('⚠️ PWA cache-busting had issues:', cacheBustResult.errors);
        } else {
          this.logProgress(`✅ PWA cache-busting completed: ${cacheBustResult.filesUpdated.length} items updated`);
        }
        
        // Update PWA manifest with cache-busting info
        await this.updatePWAManifestForCacheBusting(distPath, cacheBustResult.uniqueId);
        
      } catch (error) {
        if (error instanceof DeploymentError) {
          throw error;
        }
        throw new DeploymentError(
          'Build output directory not found',
          'BUILD_OUTPUT_NOT_FOUND',
          { path: distPath }
        );
      }
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
      this.logProgress('Deploying Mobile PWA to Vercel...');
      
      // Prepare environment variables for deployment
      const envVars = this.getEnvironmentVariables();
      
      // Deploy to Vercel
      const deploymentUrl = await this.executeVercelDeploy(
        this.VERCEL_PROJECT_ID,
        {
          env: envVars,
          prod: this.environment === 'production',
          prebuilt: true,
          outputDirectory: 'dist'
        }
      );
      
      this.logProgress(`Deployment URL: ${deploymentUrl}`);
      
      // Verify deployment
      await this.verifyDeployment(deploymentUrl);
      
      // Set up custom domain for production
      if (this.environment === 'production') {
        await this.setupCustomDomain();
      }
      
      // Post-deployment PWA cache invalidation
      await this.postDeploymentPWACacheInvalidation(deploymentUrl);
      
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
    // Check for required environment files
    const envFiles = ['.env.production', '.env.development'];
    for (const envFile of envFiles) {
      const envPath = path.join(this.projectPath, envFile);
      try {
        await fs.access(envPath);
      } catch {
        this.logProgress(`Warning: ${envFile} not found`);
      }
    }
    
    // Check for package.json
    const packageJsonPath = path.join(this.projectPath, 'package.json');
    try {
      await fs.access(packageJsonPath);
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      
      // Verify required scripts
      const requiredScripts = ['build', 'dev'];
      for (const script of requiredScripts) {
        if (!packageJson.scripts?.[script]) {
          throw new DeploymentError(
            `Required script not found in package.json: ${script}`,
            'SCRIPT_MISSING',
            { script }
          );
        }
      }
    } catch (error) {
      if (error instanceof DeploymentError) {
        throw error;
      }
      throw new DeploymentError(
        'package.json not found or invalid',
        'PACKAGE_JSON_ERROR',
        { path: packageJsonPath }
      );
    }
  }

  private getEnvironmentVariables(): Record<string, string> {
    return {
      VITE_FIREBASE_API_KEY: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyCuRdgX3QTl0O5XVcucp_6P2C2uQx1fu0c',
      VITE_FIREBASE_AUTH_DOMAIN: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'sams-sandyland-prod.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: process.env.VITE_FIREBASE_PROJECT_ID || 'sams-sandyland-prod',
      VITE_FIREBASE_STORAGE_BUCKET: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'sams-sandyland-prod.firebasestorage.app',
      VITE_FIREBASE_MESSAGING_SENDER_ID: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '939117788746',
      VITE_FIREBASE_APP_ID: process.env.VITE_FIREBASE_APP_ID || '1:939117788746:web:85f1fd75effaaa2b7c30b3',
      VITE_USE_EMULATOR: 'false',
      VITE_APP_ENV: this.environment,
      VITE_API_BASE_URL: this.getApiUrl()
    };
  }

  private getApiUrl(): string {
    const envConfig = this.getEnvironmentConfig();
    return envConfig.backendUrl;
  }

  private async verifyDeployment(url: string): Promise<void> {
    this.logProgress('Verifying Mobile PWA deployment...');
    
    try {
      // Give the deployment some time to propagate
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check if the deployment is accessible
      const healthCheck = this.config.healthChecks.mobile;
      const verificationUrl = `${url}${healthCheck.endpoint}`;
      
      this.logProgress(`Checking: ${verificationUrl}`);
      
      // Use curl to check the deployment
      const result = await executeWithRetry(
        'curl',
        ['-s', '-o', '/dev/null', '-w', '%{http_code}', verificationUrl],
        {
          timeout: healthCheck.timeout * 1000,
          maxRetries: 3,
          retryDelay: 2000,
          captureOutput: true
        }
      );
      
      const statusCode = parseInt(result.stdout.trim());
      if (statusCode !== healthCheck.expectedStatus) {
        throw new DeploymentError(
          `Health check failed. Expected ${healthCheck.expectedStatus}, got ${statusCode}`,
          'HEALTH_CHECK_FAILED',
          { url: verificationUrl, statusCode, expected: healthCheck.expectedStatus }
        );
      }
      
      // Verify PWA manifest
      const manifestUrl = `${url}/manifest.json`;
      this.logProgress(`Verifying PWA manifest: ${manifestUrl}`);
      
      const manifestResult = await executeWithRetry(
        'curl',
        ['-s', manifestUrl],
        {
          timeout: 10000,
          captureOutput: true
        }
      );
      
      try {
        const manifest = JSON.parse(manifestResult.stdout);
        if (!manifest.name || !manifest.short_name) {
          throw new Error('Invalid manifest structure');
        }
        this.logProgress('PWA manifest verified successfully');
      } catch (error) {
        throw new DeploymentError(
          'PWA manifest verification failed',
          'MANIFEST_INVALID',
          { error: error instanceof Error ? error.message : 'Unknown error' }
        );
      }
      
      // Verify service worker
      const swUrl = `${url}/sw.js`;
      this.logProgress(`Verifying service worker: ${swUrl}`);
      
      const swResult = await executeWithRetry(
        'curl',
        ['-s', '-o', '/dev/null', '-w', '%{http_code}', swUrl],
        {
          timeout: 10000,
          captureOutput: true
        }
      );
      
      const swStatusCode = parseInt(swResult.stdout.trim());
      if (swStatusCode !== 200) {
        throw new DeploymentError(
          'Service worker verification failed',
          'SERVICE_WORKER_FAILED',
          { url: swUrl, statusCode: swStatusCode }
        );
      }
      
      this.logProgress('Mobile PWA deployment verified successfully');
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

  private async setupCustomDomain(): Promise<void> {
    this.logProgress(`Setting up custom domain: ${this.MOBILE_DOMAIN}`);
    
    try {
      // Check if domain is already configured
      const checkResult = await execute(
        'vercel',
        ['domains', 'ls', '--project', this.VERCEL_PROJECT_ID],
        {
          captureOutput: true,
          env: {
            ...process.env,
            VERCEL_TOKEN: process.env.VERCEL_TOKEN
          }
        }
      );
      
      if (checkResult.stdout.includes(this.MOBILE_DOMAIN)) {
        this.logProgress('Custom domain already configured');
        return;
      }
      
      // Add domain to project
      this.logProgress('Adding domain to project...');
      await execute(
        'vercel',
        ['domains', 'add', this.MOBILE_DOMAIN, '--project', this.VERCEL_PROJECT_ID],
        {
          env: {
            ...process.env,
            VERCEL_TOKEN: process.env.VERCEL_TOKEN
          }
        }
      );
      
      this.logProgress('Custom domain configured successfully');
    } catch (error) {
      // Domain setup failures are non-critical
      this.logProgress(`Warning: Failed to set up custom domain: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  protected async postDeployHook(result: DeploymentResult): Promise<void> {
    if (result.success && result.url) {
      this.logProgress('Running post-deployment tasks...');
      
      // Log deployment information
      this.logProgress('=== Mobile PWA Deployment Complete ===');
      this.logProgress(`Environment: ${this.environment}`);
      this.logProgress(`Deployment URL: ${result.url}`);
      if (this.environment === 'production') {
        this.logProgress(`Custom Domain: https://${this.MOBILE_DOMAIN}`);
      }
      this.logProgress(`API Endpoint: ${this.getApiUrl()}`);
      this.logProgress('=====================================');
      
      // Provide instructions for testing PWA features
      this.logProgress('\nTo test PWA features:');
      this.logProgress('1. Visit the deployment URL on a mobile device');
      this.logProgress('2. Look for the "Add to Home Screen" prompt');
      this.logProgress('3. Test offline functionality');
      this.logProgress('4. Verify push notifications (if implemented)');
    }
  }

  /**
   * Update PWA manifest with cache-busting information
   */
  private async updatePWAManifestForCacheBusting(distPath: string, uniqueId: string): Promise<void> {
    const manifestPath = path.join(distPath, 'manifest.json');
    
    try {
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);
      
      // Add cache-busting metadata to manifest
      manifest.version = uniqueId;
      manifest.cache_bust_id = uniqueId;
      manifest.last_updated = new Date().toISOString();
      manifest.cache_strategy = 'network-first';
      
      // Ensure start_url has cache-busting parameter
      if (manifest.start_url && !manifest.start_url.includes('?')) {
        manifest.start_url += `?v=${uniqueId}`;
      }
      
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      this.logProgress('Updated PWA manifest with cache-busting info');
      
    } catch (error) {
      this.logProgress(`Warning: Failed to update PWA manifest: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute post-deployment PWA cache invalidation
   */
  private async postDeploymentPWACacheInvalidation(deploymentUrl: string): Promise<void> {
    this.logProgress('🔥 Executing post-deployment PWA cache invalidation...');
    
    try {
      // Execute final cache-busting for PWA
      const cacheBustResult = await executeCacheBusting({
        environment: this.environment as any,
        projectPath: this.projectPath,
        buildOutputPath: path.join(this.projectPath, 'dist'),
        skipVercelPurge: false,
        skipFileRename: true // Skip file renaming post-deployment
      });
      
      if (cacheBustResult.success) {
        this.logProgress('✅ Post-deployment PWA cache invalidation completed');
      } else {
        this.logProgress('⚠️ Post-deployment PWA cache invalidation had issues:', cacheBustResult.errors);
      }
      
      // Validate PWA functionality
      await this.validatePWAFunctionality(deploymentUrl);
      
      // Warm up PWA resources
      await this.warmupPWAResources(deploymentUrl);
      
    } catch (error) {
      this.logProgress(`PWA cache invalidation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Don't fail deployment if cache invalidation fails
    }
  }

  /**
   * Validate PWA functionality after deployment
   */
  private async validatePWAFunctionality(deploymentUrl: string): Promise<void> {
    this.logProgress('🔍 Validating PWA functionality...');
    
    const pwaEndpoints = [
      { url: `${deploymentUrl}/manifest.json`, description: 'PWA Manifest' },
      { url: `${deploymentUrl}/sw.js`, description: 'Service Worker' },
      { url: `${deploymentUrl}/icon-192x192.png`, description: 'PWA Icon 192' },
      { url: `${deploymentUrl}/icon-512x512.png`, description: 'PWA Icon 512' },
      { url: `${deploymentUrl}/cache-bust-manifest.json`, description: 'Cache-Bust Manifest' },
      { url: `${deploymentUrl}/version-check.js`, description: 'Version Check Script' }
    ];
    
    for (const endpoint of pwaEndpoints) {
      try {
        const result = await executeWithRetry('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', endpoint.url], {
          timeout: 10000,
          maxRetries: 2,
          retryDelay: 1000,
          captureOutput: true
        });
        
        const statusCode = parseInt(result.stdout.trim());
        if (statusCode === 200) {
          this.logProgress(`✅ ${endpoint.description}: OK`);
        } else {
          this.logProgress(`⚠️ ${endpoint.description}: Status ${statusCode}`);
        }
      } catch (error) {
        this.logProgress(`❌ ${endpoint.description}: Failed - ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    this.logProgress('PWA functionality validation completed');
  }

  /**
   * Warm up PWA resources
   */
  private async warmupPWAResources(deploymentUrl: string): Promise<void> {
    this.logProgress('🔥 Warming up PWA resources...');
    
    const warmupUrls = [
      deploymentUrl,
      `${deploymentUrl}/manifest.json`,
      `${deploymentUrl}/sw.js`,
      `${deploymentUrl}/cache-bust-manifest.json`,
      `${deploymentUrl}/version-check.js`
    ];
    
    for (const url of warmupUrls) {
      try {
        await execute('curl', ['-s', '-o', '/dev/null', url], {
          timeout: 10000,
          captureOutput: true
        });
        this.logProgress(`Warmed up: ${url}`);
      } catch (error) {
        this.logProgress(`Failed to warm up ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    this.logProgress('✅ PWA resource warmup completed');
  }
}