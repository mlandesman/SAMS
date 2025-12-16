import { Command } from 'commander';
import { DeploymentTracker } from '../monitors';
import { logger } from '../utils/logger';
import { Component, Environment } from '../types';
import chalk from 'chalk';

export function createHistoryCommand(): Command {
  const historyCommand = new Command('history')
    .description('View deployment history')
    .option('-c, --component <component>', 'Filter by component (desktop, mobile, backend)')
    .option('-e, --env <environment>', 'Filter by environment (development, staging, production)')
    .option('-l, --limit <number>', 'Number of records to show', '10')
    .option('--export <file>', 'Export history to file (json or csv)')
    .option('--stats', 'Show deployment statistics')
    .option('--cleanup <days>', 'Clean up deployments older than specified days')
    .action(async (options) => {
      const tracker = new DeploymentTracker();
      
      try {
        await tracker.initialize();
        
        // Handle cleanup
        if (options.cleanup) {
          const removed = await tracker.cleanup(parseInt(options.cleanup));
          logger.success(`Cleaned up ${removed} old deployment records`);
          return;
        }
        
        // Handle export
        if (options.export) {
          const format = options.export.endsWith('.csv') ? 'csv' : 'json';
          await tracker.exportHistory(options.export, format);
          return;
        }
        
        // Handle statistics
        if (options.stats) {
          const stats = await tracker.getStatistics(
            options.component as Component,
            options.env as Environment
          );
          
          logger.section('Deployment Statistics (Last 30 Days)');
          logger.table({
            'Total Deployments': stats.total.toString(),
            'Successful': chalk.green(stats.successful.toString()),
            'Failed': chalk.red(stats.failed.toString()),
            'Success Rate': chalk.bold(`${stats.successRate.toFixed(1)}%`),
            'Avg Duration': `${(stats.averageDuration / 1000).toFixed(1)}s`
          });
          return;
        }
        
        // Show deployment history
        const history = await tracker.getDeploymentHistory(
          options.component as Component,
          options.env as Environment,
          parseInt(options.limit)
        );
        
        if (history.length === 0) {
          logger.info('No deployment history found');
          return;
        }
        
        logger.section('Deployment History');
        
        for (const deployment of history) {
          const status = deployment.success 
            ? chalk.green('✓ SUCCESS') 
            : chalk.red('✗ FAILED');
          
          const duration = `${(deployment.duration / 1000).toFixed(1)}s`;
          const timestamp = new Date(deployment.timestamp).toLocaleString();
          
          console.log(`\n${status} ${chalk.bold(deployment.component)} → ${chalk.cyan(deployment.environment)}`);
          console.log(`  ID: ${deployment.id}`);
          console.log(`  Time: ${timestamp}`);
          console.log(`  Duration: ${duration}`);
          
          if (deployment.url) {
            console.log(`  URL: ${deployment.url}`);
          }
          
          if (deployment.metadata?.version) {
            console.log(`  Version: ${deployment.metadata.version}`);
          }
          
          if (deployment.metadata?.gitCommit) {
            console.log(`  Commit: ${deployment.metadata.gitCommit}`);
          }
          
          if (deployment.metadata?.deployedBy) {
            console.log(`  Deployed by: ${deployment.metadata.deployedBy}`);
          }
          
          if (deployment.error) {
            console.log(`  Error: ${chalk.red(deployment.error)}`);
          }
        }
        
      } catch (error) {
        logger.error(`Failed to retrieve deployment history: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
      }
    });
  
  return historyCommand;
}