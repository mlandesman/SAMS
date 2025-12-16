import { BaseDeployer, DeployerOptions } from './base';
import { DeploymentResult } from '../types';
import { execute } from '../utils/process';
import { DeploymentError } from '../utils/error-handler';
import { logger } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Simplified Desktop Deployer that wraps Vercel CLI
 * This ensures all agents deploy consistently without complex build logic
 */
export class DesktopDeployer extends BaseDeployer {
  private readonly PRODUCTION_DOMAIN = 'sams.sandyland.com.mx';
  private readonly VERCEL_PROJECT = 'sams-frontend';

  constructor(options: DeployerOptions) {
    super(options);
  }

  /**
   * Simple build process - run npm build with cache busting
   */
  async build(): Promise<void> {
    this.updateStatus('building', 40, 'Building desktop UI');
    this.logProgress('Building desktop UI...');
    
    // Remove maintenance mode for production
    if (this.environment === 'production') {
      await this.disableMaintenanceMode();
    }
    
    // Update version info for About modal
    await this.updateVersionInfo();
    
    // Update cache-busting timestamp in service worker
    await this.updateServiceWorkerCache();
    
    try {
      // Simple npm build
      await execute('npm', ['run', 'build'], {
        cwd: this.projectPath,
        timeout: 300000, // 5 minutes
        onStdout: (data) => logger.debug(`[BUILD] ${data}`),
        onStderr: (data) => logger.debug(`[BUILD] ${data}`)
      });
      
      this.updateStatus('building', 60, 'Build completed');
      this.logProgress('Build completed successfully');
    } catch (error) {
      throw new DeploymentError(
        'Failed to build desktop UI',
        'BUILD_FAILED',
        { error: error instanceof Error ? error.message : error }
      );
    }
  }

  /**
   * Deploy using Vercel CLI directly - simple and reliable
   */
  async deploy(): Promise<DeploymentResult> {
    this.updateStatus('deploying', 70, 'Deploying to Vercel');
    
    try {
      // Ensure we're linked to the correct project
      await this.linkVercelProject();
      
      // Deploy using Vercel CLI
      const isProd = this.environment === 'production';
      const args = isProd ? ['--prod'] : [];
      
      this.logProgress(`Deploying to ${this.environment}...`);
      
      const result = await execute('vercel', args, {
        cwd: this.projectPath,
        timeout: 600000, // 10 minutes
        captureOutput: true,
        onStdout: (data) => {
          logger.debug(`[VERCEL] ${data}`);
          // Extract deployment URL from output
          const urlMatch = data.match(/https:\/\/[^\s]+/);
          if (urlMatch) {
            this.logProgress(`Deployment URL: ${urlMatch[0]}`);
          }
        },
        onStderr: (data) => logger.debug(`[VERCEL] ${data}`)
      });
      
      // Extract deployment URL from output
      const deploymentUrl = this.extractDeploymentUrl(result.stdout);
      
      if (!deploymentUrl) {
        throw new DeploymentError(
          'Could not extract deployment URL from Vercel output',
          'NO_DEPLOYMENT_URL'
        );
      }
      
      this.updateStatus('ready', 90, 'Deployment successful');
      this.logProgress(`✅ Deployed to ${deploymentUrl}`);
      
      if (isProd) {
        this.logProgress(`✅ Production: https://${this.PRODUCTION_DOMAIN}`);
      }
      
      return this.createResult(true, deploymentUrl);
      
    } catch (error) {
      if (error instanceof DeploymentError) {
        throw error;
      }
      
      throw new DeploymentError(
        'Deployment failed',
        'DEPLOY_FAILED',
        { error: error instanceof Error ? error.message : error }
      );
    }
  }

  /**
   * Ensure we're linked to the correct Vercel project
   */
  private async linkVercelProject(): Promise<void> {
    try {
      // Check if .vercel directory exists
      const vercelDir = path.join(this.projectPath, '.vercel');
      const vercelJsonPath = path.join(vercelDir, 'project.json');
      
      try {
        const projectJson = await fs.readFile(vercelJsonPath, 'utf-8');
        const project = JSON.parse(projectJson);
        
        // Check if we're linked to the correct project
        if (project.projectId && project.orgId) {
          logger.debug(`Already linked to project: ${project.projectId}`);
          return;
        }
      } catch {
        // .vercel/project.json doesn't exist or is invalid
      }
      
      // Link to the correct project
      this.logProgress(`Linking to Vercel project: ${this.VERCEL_PROJECT}`);
      
      await execute('vercel', ['link', '--yes', '--project', this.VERCEL_PROJECT], {
        cwd: this.projectPath,
        timeout: 30000,
        captureOutput: true
      });
      
      this.logProgress('Successfully linked to Vercel project');
      
    } catch (error) {
      // If linking fails, we'll try to proceed anyway
      logger.warn(`Failed to link Vercel project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Disable maintenance mode for production deployments
   */
  private async disableMaintenanceMode(): Promise<void> {
    const envPath = path.join(this.projectPath, '.env.production');
    
    try {
      let envContent = await fs.readFile(envPath, 'utf-8');
      
      // Update maintenance mode to false
      envContent = envContent.replace(
        /VITE_MAINTENANCE_MODE=true/g,
        'VITE_MAINTENANCE_MODE=false'
      );
      
      await fs.writeFile(envPath, envContent, 'utf-8');
      this.logProgress('Maintenance mode disabled for production');
      
    } catch (error) {
      logger.warn(`Could not disable maintenance mode: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update version.json for the About modal
   */
  private async updateVersionInfo(): Promise<void> {
    // Look for version.json in both shared and project paths
    const versionPaths = [
      path.join(path.dirname(this.projectPath), 'shared', 'version.json'),
      path.join(this.projectPath, 'src', 'version.json'),
      path.join(this.projectPath, 'public', 'version.json')
    ];
    
    const now = new Date();
    const versionData = {
      appName: 'SAMS',
      shortName: 'SAMS',
      companyName: 'Sandyland Properties',
      copyright: '2025',
      version: '0.0.1', // This will be managed by HIGH-002 issue
      buildDate: now.toISOString(),
      buildTimestamp: now.getTime(),
      environment: this.environment,
      gitBranch: 'main',
      gitCommit: 'latest',
      developers: [
        'Michael Landesman',
        'Claude AI'
      ],
      features: [
        'PWA Support',
        'Multi-Client Management',
        'Financial Reporting',
        'Document Storage',
        'Unit Management'
      ],
      build: {
        timestamp: now.toISOString(),
        environment: this.environment,
        nodeVersion: process.version,
        platform: process.platform,
        buildNumber: `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}.${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`
      },
      deployment: {
        target: this.environment,
        date: now.toISOString(),
        automated: true
      }
    };
    
    // Try to get git info
    try {
      const gitHash = await execute('git', ['rev-parse', '--short', 'HEAD'], {
        cwd: this.projectPath,
        timeout: 5000,
        captureOutput: true
      });
      
      const gitBranch = await execute('git', ['branch', '--show-current'], {
        cwd: this.projectPath,
        timeout: 5000,
        captureOutput: true
      });
      
      versionData.gitCommit = gitHash.stdout.trim();
      versionData.gitBranch = gitBranch.stdout.trim() || 'main';
    } catch (error) {
      logger.debug('Could not get git info for version.json');
    }
    
    // Update all version.json files found
    let updated = false;
    for (const versionPath of versionPaths) {
      try {
        await fs.writeFile(versionPath, JSON.stringify(versionData, null, 2), 'utf-8');
        this.logProgress(`Updated version info: ${versionPath}`);
        updated = true;
      } catch (error) {
        logger.debug(`Skipped version file: ${versionPath}`);
      }
    }
    
    if (updated) {
      this.logProgress(`Version info updated for ${this.environment} deployment`);
    }
  }

  /**
   * Simple cache busting - update service worker cache name with timestamp
   */
  private async updateServiceWorkerCache(): Promise<void> {
    const swPath = path.join(this.projectPath, 'public', 'sw.js');
    
    try {
      const swContent = await fs.readFile(swPath, 'utf-8');
      
      // Update cache version with current timestamp to bust cache
      const timestamp = Date.now();
      const updatedContent = swContent.replace(
        /const CACHE_NAME = ['"`]sams-[^'"`]+['"`]/,
        `const CACHE_NAME = 'sams-v1-${timestamp}'`
      );
      
      await fs.writeFile(swPath, updatedContent, 'utf-8');
      this.logProgress(`Cache busting: Updated service worker with timestamp ${timestamp}`);
      
    } catch (error) {
      // Don't fail deployment if service worker update fails
      logger.debug(`Service worker cache update skipped: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract deployment URL from Vercel CLI output
   */
  private extractDeploymentUrl(output: string): string | null {
    // Look for production or preview URLs in the output
    const patterns = [
      /Production: (https:\/\/[^\s]+)/,
      /Preview: (https:\/\/[^\s]+)/,
      /(https:\/\/sams-frontend-[^\s]+\.vercel\.app)/,
      /(https:\/\/[^\s]+\.vercel\.app)/
    ];
    
    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  }

  /**
   * Check prerequisites - simplified version
   */
  protected async checkComponentPrerequisites(): Promise<void> {
    // Check if npm is installed
    try {
      await execute('npm', ['--version'], {
        cwd: this.projectPath,
        timeout: 5000,
        captureOutput: true
      });
    } catch {
      throw new DeploymentError(
        'npm is not installed or not accessible',
        'NPM_NOT_FOUND'
      );
    }
    
    // Check if vercel CLI is installed
    try {
      await execute('vercel', ['--version'], {
        cwd: this.projectPath,
        timeout: 5000,
        captureOutput: true
      });
    } catch {
      throw new DeploymentError(
        'Vercel CLI is not installed. Run: npm install -g vercel',
        'VERCEL_CLI_NOT_FOUND'
      );
    }
    
    // Check if node_modules exists
    const nodeModulesPath = path.join(this.projectPath, 'node_modules');
    try {
      await fs.access(nodeModulesPath);
    } catch {
      this.logProgress('Installing dependencies...');
      
      try {
        await execute('npm', ['ci'], {
          cwd: this.projectPath,
          timeout: 300000, // 5 minutes
          onStdout: (data) => logger.debug(`[NPM] ${data}`),
          onStderr: (data) => logger.debug(`[NPM] ${data}`)
        });
      } catch (error) {
        throw new DeploymentError(
          'Failed to install dependencies',
          'NPM_INSTALL_FAILED',
          { error: error instanceof Error ? error.message : error }
        );
      }
    }
    
    // Check for .env.production in production deployments
    if (this.environment === 'production') {
      const envPath = path.join(this.projectPath, '.env.production');
      try {
        await fs.access(envPath);
      } catch {
        logger.warn('.env.production file not found - deployment may use default settings');
      }
    }
  }

  /**
   * Post-deployment tasks - simplified
   */
  protected async postDeployHook(result: DeploymentResult): Promise<void> {
    if (result.success && result.url) {
      logger.success('╔═══════════════════════════════════════════════════════════╗');
      logger.success('║                  DEPLOYMENT SUCCESSFUL                    ║');
      logger.success('╠═══════════════════════════════════════════════════════════╣');
      logger.success(`║ Component:    Desktop UI                                  ║`);
      logger.success(`║ Environment:  ${this.environment.padEnd(44)} ║`);
      logger.success(`║ Deployment:   ${result.url.substring(0, 44).padEnd(44)} ║`);
      
      if (this.environment === 'production') {
        logger.success(`║ Production:   https://${this.PRODUCTION_DOMAIN.padEnd(36)} ║`);
      }
      
      logger.success('╚═══════════════════════════════════════════════════════════╝');
    }
  }
}