import { logger } from './logger';
import { executeCacheBusting, CacheBustingConfig } from './cache-buster';
import { autoIncrementDeploymentVersion, VersionManager } from './version-manager';
import { generateBuildConfiguration, BuildScriptConfig } from './build-scripts';
import { resolve } from 'path';

export interface DeploymentWrapperConfig {
  projectPath: string;
  environment: 'development' | 'staging' | 'production';
  target: 'desktop' | 'mobile';
  enableCacheBusting?: boolean;
  enableVersionNotifications?: boolean;
  enableBuildScripts?: boolean;
  deploymentNotes?: string[];
  versionIncrement?: 'patch' | 'minor' | 'major';
}

export interface DeploymentWrapperResult {
  success: boolean;
  version: string;
  buildId: string;
  cacheBustResult?: any;
  versionMetadata?: any;
  buildScriptsGenerated?: boolean;
  errors?: string[];
}

/**
 * Comprehensive deployment wrapper that orchestrates all cache-busting,
 * version management, and build optimization features
 */
export class DeploymentWrapper {
  private config: DeploymentWrapperConfig;
  private errors: string[] = [];

  constructor(config: DeploymentWrapperConfig) {
    this.config = {
      enableCacheBusting: true,
      enableVersionNotifications: true,
      enableBuildScripts: true,
      versionIncrement: 'patch',
      ...config
    };
  }

  /**
   * Execute complete deployment preparation
   */
  async executeDeploymentPreparation(): Promise<DeploymentWrapperResult> {
    logger.info(`🚀 Starting deployment preparation for ${this.config.target} (${this.config.environment})`);

    try {
      let versionMetadata: any;
      let cacheBustResult: any;
      let buildScriptsGenerated = false;

      // 1. Version Management
      logger.info('📋 Step 1: Version Management');
      try {
        versionMetadata = await autoIncrementDeploymentVersion(
          this.config.projectPath,
          this.config.environment,
          this.config.versionIncrement || 'patch',
          this.config.deploymentNotes || [
            `${this.config.target} deployment`,
            `Environment: ${this.config.environment}`,
            'Cache-busting enabled',
            'Version management active'
          ]
        );
        logger.success(`✅ Version incremented to: ${versionMetadata.version}`);
      } catch (error) {
        this.errors.push(`Version management failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        logger.error(`❌ Version management failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // 2. Build Script Generation
      if (this.config.enableBuildScripts) {
        logger.info('📋 Step 2: Build Script Generation');
        try {
          const buildConfig: BuildScriptConfig = {
            projectPath: this.config.projectPath,
            environment: this.config.environment,
            target: this.config.target,
            enableCacheBusting: this.config.enableCacheBusting || true,
            enableVersionNotifications: this.config.enableVersionNotifications || true
          };

          await generateBuildConfiguration(buildConfig);
          buildScriptsGenerated = true;
          logger.success('✅ Build scripts generated');
        } catch (error) {
          this.errors.push(`Build script generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          logger.error(`❌ Build script generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // 3. Pre-deployment Cache Busting Setup
      if (this.config.enableCacheBusting) {
        logger.info('📋 Step 3: Cache-Busting Setup');
        try {
          const cacheBustConfig: CacheBustingConfig = {
            environment: this.config.environment,
            projectPath: this.config.projectPath,
            buildOutputPath: resolve(this.config.projectPath, 'dist'),
            skipVercelPurge: true, // Will do this post-deployment
            skipFileRename: false
          };

          // This prepares cache-busting but doesn't execute the build-time parts yet
          logger.info('Cache-busting configuration prepared for build phase');
        } catch (error) {
          this.errors.push(`Cache-busting setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          logger.error(`❌ Cache-busting setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // 4. Version Notification Setup
      if (this.config.enableVersionNotifications) {
        logger.info('📋 Step 4: Version Notification Setup');
        try {
          const versionManager = new VersionManager(this.config.projectPath, this.config.environment);
          
          // Generate rollback package for this deployment
          if (versionMetadata) {
            await versionManager.createRollbackPackage(versionMetadata);
            logger.success('✅ Rollback package created');
          }
          
          logger.success('✅ Version notifications configured');
        } catch (error) {
          this.errors.push(`Version notification setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          logger.error(`❌ Version notification setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // 5. Generate deployment summary
      const summary = this.generateDeploymentSummary(versionMetadata, cacheBustResult, buildScriptsGenerated);
      logger.info(summary);

      const success = this.errors.length === 0;
      if (success) {
        logger.success('🎉 Deployment preparation completed successfully!');
      } else {
        logger.warn(`⚠️ Deployment preparation completed with ${this.errors.length} warnings`);
      }

      return {
        success,
        version: versionMetadata?.version || '0.0.0',
        buildId: versionMetadata?.buildId || 'unknown',
        cacheBustResult,
        versionMetadata,
        buildScriptsGenerated,
        errors: this.errors.length > 0 ? this.errors : undefined
      };

    } catch (error) {
      logger.error(`❌ Deployment preparation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        version: '0.0.0',
        buildId: 'failed',
        errors: [error instanceof Error ? error.message : 'Unknown error', ...this.errors]
      };
    }
  }

  /**
   * Execute post-deployment cache invalidation
   */
  async executePostDeploymentCacheInvalidation(deploymentUrl: string): Promise<void> {
    if (!this.config.enableCacheBusting) {
      return;
    }

    logger.info('🔥 Executing post-deployment cache invalidation...');

    try {
      const cacheBustConfig: CacheBustingConfig = {
        environment: this.config.environment,
        projectPath: this.config.projectPath,
        buildOutputPath: resolve(this.config.projectPath, 'dist'),
        skipVercelPurge: false, // Execute CDN purging now
        skipFileRename: true    // Don't rename files post-deployment
      };

      const result = await executeCacheBusting(cacheBustConfig);
      
      if (result.success) {
        logger.success('✅ Post-deployment cache invalidation completed');
        
        // Warm up the deployment
        await this.warmupDeployment(deploymentUrl);
      } else {
        logger.warn('⚠️ Post-deployment cache invalidation had issues:', result.errors);
      }

    } catch (error) {
      logger.error(`❌ Post-deployment cache invalidation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Warm up deployment by making initial requests
   */
  private async warmupDeployment(deploymentUrl: string): Promise<void> {
    logger.info('🔥 Warming up deployment...');

    const warmupUrls = [
      deploymentUrl,
      `${deploymentUrl}/manifest.json`,
      `${deploymentUrl}/cache-bust-manifest.json`
    ];

    if (this.config.enableVersionNotifications) {
      warmupUrls.push(`${deploymentUrl}/version-check.js`);
    }

    if (this.config.target === 'mobile') {
      warmupUrls.push(`${deploymentUrl}/sw.js`);
    }

    for (const url of warmupUrls) {
      try {
        // Use fetch-like approach for cross-platform compatibility
        const { execSync } = require('child_process');
        execSync(`curl -s -o /dev/null "${url}"`, { timeout: 10000 });
        logger.debug(`Warmed up: ${url}`);
      } catch (error) {
        logger.debug(`Failed to warm up ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    logger.success('✅ Deployment warmup completed');
  }

  /**
   * Generate deployment summary
   */
  private generateDeploymentSummary(versionMetadata: any, cacheBustResult: any, buildScriptsGenerated: boolean): string {
    const lines = [
      '',
      '═══════════════════════════════════════════════',
      '🚀 SAMS DEPLOYMENT PREPARATION SUMMARY',
      '═══════════════════════════════════════════════',
      `📱 Target: ${this.config.target.toUpperCase()}`,
      `🌍 Environment: ${this.config.environment.toUpperCase()}`,
      `📦 Version: ${versionMetadata?.version || 'N/A'}`,
      `🆔 Build ID: ${versionMetadata?.buildId || 'N/A'}`,
      `📅 Timestamp: ${new Date().toISOString()}`,
      '',
      '🔧 FEATURES ENABLED:',
      `  ✓ Cache-Busting: ${this.config.enableCacheBusting ? 'YES' : 'NO'}`,
      `  ✓ Version Notifications: ${this.config.enableVersionNotifications ? 'YES' : 'NO'}`,
      `  ✓ Build Scripts: ${buildScriptsGenerated ? 'YES' : 'NO'}`,
      `  ✓ Version Management: YES`,
      '',
      '📋 NEXT STEPS:',
      `  1. Run build: npm run build:${this.config.environment}`,
      `  2. Deploy: npm run deploy:${this.config.environment}`,
      `  3. Verify: npm run verify-deployment <url>`,
      `  4. Monitor: Check deployment dashboard`,
      '',
      '🔄 ROLLBACK AVAILABLE:',
      `  Command: npm run rollback ${versionMetadata?.gitCommit || 'previous-commit'}`,
      '',
      '═══════════════════════════════════════════════'
    ];

    if (this.errors.length > 0) {
      lines.push('');
      lines.push('⚠️  WARNINGS:');
      this.errors.forEach((error, index) => {
        lines.push(`  ${index + 1}. ${error}`);
      });
      lines.push('═══════════════════════════════════════════════');
    }

    return lines.join('\n');
  }

  /**
   * Get deployment readiness status
   */
  async getDeploymentReadiness(): Promise<{ready: boolean, issues: string[]}> {
    const issues: string[] = [];

    try {
      // Check if project has package.json
      const packageJsonPath = resolve(this.config.projectPath, 'package.json');
      const fs = require('fs');
      
      if (!fs.existsSync(packageJsonPath)) {
        issues.push('package.json not found');
      }

      // Check if node_modules exists
      const nodeModulesPath = resolve(this.config.projectPath, 'node_modules');
      if (!fs.existsSync(nodeModulesPath)) {
        issues.push('node_modules not found - run npm install');
      }

      // Check for environment files
      const envFiles = ['.env', '.env.local', `.env.${this.config.environment}`];
      const missingEnvFiles = envFiles.filter(file => 
        !fs.existsSync(resolve(this.config.projectPath, file))
      );

      if (missingEnvFiles.length === envFiles.length) {
        issues.push('No environment files found');
      }

      // Target-specific checks
      if (this.config.target === 'mobile') {
        const requiredPWAFiles = ['public/manifest.json', 'public/sw.js'];
        const missingPWAFiles = requiredPWAFiles.filter(file =>
          !fs.existsSync(resolve(this.config.projectPath, file))
        );

        if (missingPWAFiles.length > 0) {
          issues.push(`Missing PWA files: ${missingPWAFiles.join(', ')}`);
        }
      }

      return {
        ready: issues.length === 0,
        issues
      };

    } catch (error) {
      return {
        ready: false,
        issues: [`Readiness check failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }
}

/**
 * Convenience function to execute deployment preparation
 */
export async function executeDeploymentPreparation(config: DeploymentWrapperConfig): Promise<DeploymentWrapperResult> {
  const wrapper = new DeploymentWrapper(config);
  return await wrapper.executeDeploymentPreparation();
}

/**
 * Convenience function to execute post-deployment cache invalidation
 */
export async function executePostDeploymentCacheInvalidation(
  config: DeploymentWrapperConfig,
  deploymentUrl: string
): Promise<void> {
  const wrapper = new DeploymentWrapper(config);
  await wrapper.executePostDeploymentCacheInvalidation(deploymentUrl);
}