import { Command } from 'commander';
import { logger } from '../utils/logger';
import { DeploymentError } from '../utils/error-handler';
import { Component, Environment } from '../types';
import { RollbackManager, RollbackOptions } from '../rollback/rollback-manager';
import chalk from 'chalk';

export function createRollbackCommand(): Command {
  const rollbackCommand = new Command('rollback')
    .description('Enhanced rollback with comprehensive verification and monitoring')
    .argument('<component>', 'Component to rollback (desktop, mobile, backend, firebase)')
    .argument('<environment>', 'Environment to rollback (development, staging, production)')
    .option('--to <deploymentId>', 'Specific deployment ID to rollback to')
    .option('--dry-run', 'Preview rollback without executing')
    .option('--force', 'Force rollback without confirmation')
    .option('--monitor', 'Monitor rollback progress and verify success')
    .option('--verify-only', 'Only verify rollback success without execution')
    .option('--emergency', 'Emergency rollback mode with minimal safety checks')
    .option('--skip-backup', 'Skip creating backup before rollback')
    .action(async (component: Component, environment: Environment, options) => {
      const rollbackManager = new RollbackManager();
      
      try {
        await rollbackManager.initialize();
        
        // Handle emergency rollback
        if (options.emergency) {
          logger.warn(chalk.red('EMERGENCY ROLLBACK MODE ACTIVATED'));
          const result = await rollbackManager.emergencyRollback(component, environment, options.to);
          
          if (result.success) {
            logger.success(`Emergency rollback completed in ${result.duration}ms`);
            logger.info(`Rollback ID: ${result.rollbackId}`);
          } else {
            logger.error(`Emergency rollback failed: ${result.error?.message}`);
            process.exit(1);
          }
          return;
        }
        
        // Create rollback plan
        const plan = await rollbackManager.createRollbackPlan(component, environment, options.to);
        
        // Display enhanced rollback plan
        logger.section('Enhanced Rollback Plan');
        logger.table({
          'Component': plan.component,
          'Environment': plan.environment,
          'Current Deployment': plan.currentDeployment.deploymentId,
          'Current Version': plan.currentDeployment.metadata?.version || 'unknown',
          'Target Deployment': plan.targetDeployment.deploymentId,
          'Target Version': plan.targetDeployment.metadata?.version || 'unknown',
          'Target Deployed': new Date(plan.targetDeployment.timestamp).toLocaleString(),
          'Rollback Type': plan.rollbackType,
          'Risk Level': plan.riskLevel,
          'Estimated Downtime': `${plan.estimatedDowntime}s`
        });
        
        // Show rollback steps
        logger.section('Rollback Steps');
        plan.rollbackSteps.forEach((step, index) => {
          logger.info(`${index + 1}. ${step}`);
        });
        
        // Show verification steps
        logger.section('Verification Steps');
        plan.verificationSteps.forEach((step, index) => {
          logger.info(`${index + 1}. ${step}`);
        });
        
        if (options.dryRun) {
          logger.info(chalk.yellow('DRY RUN MODE - No changes will be made'));
          return;
        }
        
        // Risk warning for high-risk rollbacks
        if (plan.riskLevel === 'high' && !options.force) {
          logger.warn(chalk.red('HIGH RISK ROLLBACK DETECTED'));
          logger.warn('This rollback may involve significant changes or version downgrades');
        }
        
        // Confirm rollback
        if (!options.force) {
          const readline = await import('readline');
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });
          
          const riskColor = plan.riskLevel === 'high' ? chalk.red : 
                           plan.riskLevel === 'medium' ? chalk.yellow : chalk.green;
          
          const answer = await new Promise<string>((resolve) => {
            rl.question(
              chalk.yellow(`\nProceed with ${riskColor(plan.riskLevel.toUpperCase())} risk rollback? (yes/no): `), 
              resolve
            );
          });
          
          rl.close();
          
          if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
            logger.info('Rollback cancelled');
            return;
          }
        }
        
        // Execute enhanced rollback
        const rollbackOptions: RollbackOptions = {
          targetDeploymentId: options.to,
          dryRun: options.dryRun,
          force: options.force,
          monitor: options.monitor,
          verifyOnly: options.verifyOnly,
          emergencyMode: options.emergency,
          skipBackup: options.skipBackup
        };
        
        const result = await rollbackManager.executeRollback(plan, rollbackOptions);
        
        if (result.success) {
          logger.success(`\nRollback completed successfully!`);
          logger.info(`Rollback ID: ${result.rollbackId}`);
          logger.info(`Duration: ${result.duration}ms`);
          logger.info(`Verification: ${result.verificationPassed ? 'PASSED' : 'FAILED'}`);
          
          if (result.metadata) {
            logger.info(`From: ${result.metadata.fromDeploymentId}`);
            logger.info(`To: ${result.metadata.toDeploymentId}`);
            logger.info(`Type: ${result.metadata.rollbackType}`);
          }
        } else {
          logger.error(`Rollback failed: ${result.error?.message}`);
          logger.error(`Rollback ID: ${result.rollbackId} (for troubleshooting)`);
          process.exit(1);
        }
        
      } catch (error) {
        if (error instanceof DeploymentError) {
          logger.error(`Rollback failed: ${error.message}`);
          if (error.details?.hint) {
            logger.info(`Hint: ${error.details.hint}`);
          }
        } else {
          logger.error(`Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        process.exit(1);
      }
    });
  
  // Add sub-commands for enhanced rollback functionality
  
  // List rollback candidates
  rollbackCommand
    .command('list')
    .description('List available rollback candidates')
    .argument('<component>', 'Component to list candidates for')
    .argument('<environment>', 'Environment to list candidates for')
    .option('--limit <number>', 'Maximum number of candidates to show', '10')
    .action(async (component: Component, environment: Environment, options) => {
      const rollbackManager = new RollbackManager();
      
      try {
        await rollbackManager.initialize();
        
        const candidates = await rollbackManager.listRollbackCandidates(
          component, 
          environment, 
          parseInt(options.limit)
        );
        
        if (candidates.length === 0) {
          logger.warn(`No rollback candidates found for ${component}:${environment}`);
          return;
        }
        
        logger.section(`Rollback Candidates for ${component}:${environment}`);
        
        candidates.forEach((candidate, index) => {
          const age = Math.round((Date.now() - new Date(candidate.timestamp).getTime()) / (1000 * 60 * 60 * 24));
          logger.info(`${index + 1}. ${candidate.deploymentId}`);
          logger.info(`   Version: ${candidate.metadata?.version || 'unknown'}`);
          logger.info(`   Deployed: ${new Date(candidate.timestamp).toLocaleString()} (${age} days ago)`);
          logger.info(`   Git: ${candidate.metadata?.gitBranch || 'unknown'}@${candidate.metadata?.gitCommit || 'unknown'}`);
          logger.info(`   URL: ${candidate.url || 'N/A'}`);
          logger.info('');
        });
        
      } catch (error) {
        logger.error(`Failed to list rollback candidates: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
      }
    });
  
  // View rollback history
  rollbackCommand
    .command('history')
    .description('View rollback history')
    .option('--component <component>', 'Filter by component')
    .option('--environment <environment>', 'Filter by environment')
    .option('--limit <number>', 'Maximum number of records to show', '20')
    .action(async (options) => {
      const rollbackManager = new RollbackManager();
      
      try {
        await rollbackManager.initialize();
        
        const history = await rollbackManager.getRollbackHistory(
          options.component as Component,
          options.environment as Environment,
          parseInt(options.limit)
        );
        
        if (history.length === 0) {
          logger.warn('No rollback history found');
          return;
        }
        
        logger.section('Rollback History');
        
        history.forEach((record, index) => {
          const status = record.success ? chalk.green('SUCCESS') : chalk.red('FAILED');
          const duration = record.duration ? ` (${record.duration}ms)` : '';
          const emergency = record.emergencyMode ? chalk.red(' [EMERGENCY]') : '';
          
          logger.info(`${index + 1}. ${record.id} - ${status}${emergency}`);
          logger.info(`   ${record.component}:${record.environment}`);
          logger.info(`   ${new Date(record.timestamp).toLocaleString()}${duration}`);
          logger.info(`   From: ${record.fromDeploymentId} → To: ${record.toDeploymentId}`);
          logger.info(`   Type: ${record.rollbackType}`);
          logger.info(`   Triggered by: ${record.triggeredBy}`);
          if (record.reason) {
            logger.info(`   Reason: ${record.reason}`);
          }
          if (record.error) {
            logger.error(`   Error: ${record.error}`);
          }
          logger.info('');
        });
        
      } catch (error) {
        logger.error(`Failed to retrieve rollback history: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
      }
    });
  
  return rollbackCommand;
}