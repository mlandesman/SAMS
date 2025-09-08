import { Component, Environment, DeploymentOptions, DeploymentResult, DeployConfig } from './types';
import { DesktopDeployer, MobileDeployer, BackendDeployer, FirebaseDeployer } from './deployers';
import { BaseDeployer, DeployerOptions } from './deployers/base';
import { loadConfiguration } from './config';
import { logger } from './utils/logger';
import { DeploymentError } from './utils/error-handler';

export class DeploymentOrchestrator {
  private deployers: Map<Component, BaseDeployer>;
  private environment: Environment;
  private options: DeploymentOptions;
  private config: DeployConfig | null = null;

  constructor(environment: Environment, options: DeploymentOptions) {
    this.environment = environment;
    this.options = options;
    this.deployers = new Map();
  }

  async initialize(): Promise<void> {
    this.config = await loadConfiguration();
    
    // Initialize deployers based on component selection
    const components = this.getComponentsToDeploy();
    
    for (const component of components) {
      const deployerOptions: DeployerOptions = {
        component,
        environment: this.environment,
        config: this.config,
        options: this.options,
        verificationConfig: this.config.verification
      };
      
      const deployer = this.createDeployer(component, deployerOptions);
      if (deployer) {
        this.deployers.set(component, deployer);
      }
    }
    
    logger.info(`Initialized ${this.deployers.size} deployer(s)`);
  }

  private getComponentsToDeploy(): Component[] {
    if (this.options.component === 'all') {
      return ['firebase', 'backend', 'desktop', 'mobile'];
    }
    return [this.options.component as Component];
  }

  private createDeployer(component: Component, options: DeployerOptions): BaseDeployer | null {
    switch (component) {
      case 'desktop':
        return new DesktopDeployer(options);
      case 'mobile':
        return new MobileDeployer(options);
      case 'backend':
        return new BackendDeployer(options);
      case 'firebase':
        return new FirebaseDeployer(options);
      default:
        throw new DeploymentError(
          `Unknown component: ${component}`,
          'UNKNOWN_COMPONENT',
          { component }
        );
    }
  }

  async deploy(): Promise<DeploymentResult[]> {
    const results: DeploymentResult[] = [];
    
    if (this.options.dryRun) {
      logger.info('DRY RUN: Simulating deployment process...');
      
      for (const [component] of this.deployers) {
        logger.info(`Would deploy ${component} to ${this.environment}`);
      }
      
      return results;
    }
    
    // Deploy components in order: firebase -> backend -> desktop -> mobile
    const deploymentOrder: Component[] = ['firebase', 'backend', 'desktop', 'mobile'];
    
    for (const component of deploymentOrder) {
      const deployer = this.deployers.get(component);
      if (!deployer) continue;
      
      try {
        logger.info(`\n${'='.repeat(50)}`);
        logger.info(`Deploying ${component.toUpperCase()} to ${this.environment}`);
        logger.info('='.repeat(50));
        
        const result = await deployer.run();
        results.push(result);
        
        if (result.success) {
          logger.success(`✓ ${component} deployed successfully`);
        } else {
          logger.error(`✗ ${component} deployment failed`);
          
          // Stop on first failure unless force flag is set
          if (!this.options.force) {
            break;
          }
        }
      } catch (error) {
        const errorResult: DeploymentResult = {
          success: false,
          component,
          environment: this.environment,
          error: error instanceof Error ? error : new Error('Unknown error')
        };
        results.push(errorResult);
        
        logger.error(`Failed to deploy ${component}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        // Stop on error unless force flag is set
        if (!this.options.force) {
          break;
        }
      }
    }
    
    return results;
  }

  async rollback(): Promise<void> {
    logger.warn('Rollback functionality not yet implemented');
    throw new DeploymentError(
      'Rollback not implemented',
      'NOT_IMPLEMENTED'
    );
  }

  async monitor(): Promise<void> {
    logger.info('Monitoring deployment status...');
    
    for (const [component] of this.deployers) {
      logger.info(`${component}: Ready`);
    }
  }

  printSummary(results: DeploymentResult[]): void {
    logger.info(`\n${'='.repeat(50)}`);
    logger.info('DEPLOYMENT SUMMARY');
    logger.info('='.repeat(50));
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    logger.info(`Total: ${results.length} | Success: ${successful.length} | Failed: ${failed.length}`);
    
    if (successful.length > 0) {
      logger.info('\n✓ Successful Deployments:');
      for (const result of successful) {
        logger.success(`  - ${result.component}: ${result.url || 'Deployed'}`);
        if (result.duration) {
          logger.info(`    Duration: ${(result.duration / 1000).toFixed(2)}s`);
        }
      }
    }
    
    if (failed.length > 0) {
      logger.info('\n✗ Failed Deployments:');
      for (const result of failed) {
        logger.error(`  - ${result.component}: ${result.error?.message || 'Unknown error'}`);
      }
    }
    
    logger.info('='.repeat(50));
    
    // Provide next steps
    if (successful.length === results.length) {
      logger.success('\n🎉 All deployments completed successfully!');
      this.printNextSteps();
    } else {
      logger.error('\n⚠️  Some deployments failed. Check the logs above for details.');
    }
  }

  private printNextSteps(): void {
    logger.info('\nNext Steps:');
    logger.info('1. Verify deployments at:');
    
    if (this.config) {
      const envConfig = this.config.environments[this.environment];
      logger.info(`   - Desktop: ${envConfig.desktopUrl}`);
      logger.info(`   - Mobile: ${envConfig.mobileUrl}`);
      logger.info(`   - Backend: ${envConfig.backendUrl}/api/health`);
    }
    
    logger.info('2. Monitor logs:');
    logger.info('   - vercel logs --project <project-id>');
    logger.info('3. Test critical user flows');
    logger.info('4. Monitor error tracking dashboard');
  }
}