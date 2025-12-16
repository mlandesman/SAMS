#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { version } from '../package.json';
import { DeploymentOptions, Component } from './types';
import { loadConfiguration, validateEnvironment } from './config';
import { logger } from './utils/logger';
import { handleError } from './utils/error-handler';
import { DeploymentOrchestrator } from './orchestrator';
import { createHistoryCommand, createRollbackCommand } from './commands';

const program = new Command();

program
  .name('sams-deploy')
  .description('SAMS Deployment Automation System')
  .version(version)
  .option('-e, --env <environment>', 'deployment environment (dev, staging, production)', 'development')
  .option('-c, --component <component>', 'component to deploy (desktop, mobile, backend, firebase, all)', 'all')
  .option('-d, --dry-run', 'perform a dry run without actual deployment', false)
  .option('-m, --monitor', 'monitor deployment status', false)
  .option('-v, --verbose', 'enable verbose logging', false)
  .option('-q, --quiet', 'suppress non-essential output', false)
  .option('--firebase-project <project>', 'override Firebase project ID')
  .option('--no-cache', 'skip build cache', false)
  .option('--force', 'force deployment even with warnings', false)
  .option('--timeout <seconds>', 'deployment timeout in seconds', '300')
  .helpOption('-h, --help', 'display help for command')
  .addHelpText('after', `
Examples:
  $ sams-deploy --env production --component all
  $ sams-deploy --env staging --component mobile --monitor
  $ sams-deploy --env dev --component desktop --dry-run
  $ sams-deploy history --component mobile --env production
  $ sams-deploy rollback mobile production
  $ sams-deploy rollback mobile production --to dep_123456_abcdef --dry-run
  $ sams-deploy rollback mobile production --emergency
  $ sams-deploy rollback list mobile production
  $ sams-deploy rollback history --component mobile --environment production
  $ npx sams-deploy --help

Environment Options:
  - development (dev)
  - staging
  - production (prod)

Component Options:
  - desktop: SAMS Desktop UI
  - mobile: SAMS Mobile PWA
  - backend: SAMS Backend API
  - firebase: Firebase Rules & Configuration
  - all: Deploy all components

Rollback Commands:
  - rollback <component> <environment>: Enhanced rollback with comprehensive verification
  - rollback list <component> <environment>: List available rollback candidates
  - rollback history: View rollback history with filtering options

Rollback Options:
  - --to <deploymentId>: Rollback to specific deployment
  - --dry-run: Preview rollback without executing
  - --force: Force rollback without confirmation
  - --monitor: Monitor rollback progress and verify success
  - --emergency: Emergency rollback mode with minimal safety checks
  - --skip-backup: Skip creating backup before rollback
`);

// Add sub-commands
program.addCommand(createHistoryCommand());
program.addCommand(createRollbackCommand());

// Handle deploy command (default behavior)
program
  .command('deploy', { isDefault: true })
  .description('Deploy components to specified environment')
  .action(async () => {
    await runDeploy();
  });

async function runDeploy() {
  const options = program.opts() as DeploymentOptions;

  // Initialize logger with verbosity settings
  logger.setVerbosity({
    verbose: options.verbose,
    quiet: options.quiet
  });

  // Display startup banner
  if (!options.quiet) {
    logger.banner();
  }

  // Validate environment
  const environment = validateEnvironment(options.env);
  logger.info(`Environment: ${chalk.cyan(environment)}`);

  // Load configuration
  logger.info('Loading deployment configuration...');
  await loadConfiguration();
  logger.success('Configuration loaded successfully');

  // Validate component selection
  const validComponents: Component[] = ['desktop', 'mobile', 'backend', 'firebase', 'all'];
  if (!validComponents.includes(options.component as Component)) {
    throw new Error(`Invalid component: ${options.component}. Valid options: ${validComponents.join(', ')}`);
  }

  logger.info(`Component: ${chalk.cyan(options.component)}`);

  // Display deployment options
  if (options.dryRun) {
    logger.warn('DRY RUN MODE - No actual deployment will occur');
  }
  if (options.force) {
    logger.warn('FORCE MODE - Warnings will not prevent deployment');
  }

  // Override Firebase project if specified
  if (options.firebaseProject) {
    logger.info(`Firebase Project Override: ${chalk.cyan(options.firebaseProject)}`);
  }

  // Create deployment orchestrator
  const orchestrator = new DeploymentOrchestrator(environment, options);
  await orchestrator.initialize();

  // Normal deployment flow
  const results = await orchestrator.deploy();
  
  // Print summary
  if (results.length > 0) {
    orchestrator.printSummary(results);
  }
  
  // Exit with error code if any deployments failed
  const hasFailures = results.some(r => !r.success);
  if (hasFailures && !options.force) {
    process.exit(1);
  }
}

async function main() {
  try {
    // Parse command line arguments
    await program.parseAsync(process.argv);
  } catch (error) {
    handleError(error);
    process.exit(1);
  }
}

// Run the main function
main();