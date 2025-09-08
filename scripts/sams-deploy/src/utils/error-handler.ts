import chalk from 'chalk';
import { logger } from './logger';

export class DeploymentError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'DeploymentError';
  }
}

export function handleError(error: unknown): void {
  logger.stopSpinner();
  
  console.error('\n' + chalk.red.bold('Deployment Failed'));
  logger.divider();

  if (error instanceof DeploymentError) {
    logger.error(`Error Code: ${error.code}`);
    logger.error(`Message: ${error.message}`);
    
    if (error.details) {
      logger.error('Details:');
      console.error(chalk.gray(JSON.stringify(error.details, null, 2)));
    }
    
    // Provide helpful suggestions based on error code
    const suggestion = getErrorSuggestion(error.code);
    if (suggestion) {
      logger.newline();
      logger.info('Suggestion: ' + chalk.yellow(suggestion));
    }
  } else if (error instanceof Error) {
    logger.error(error.message);
    
    if (error.stack && process.env.NODE_ENV === 'development') {
      logger.debug('Stack trace:');
      console.error(chalk.gray(error.stack));
    }
  } else {
    logger.error('An unknown error occurred');
    console.error(error);
  }

  logger.divider();
  logger.info('For more help, run: ' + chalk.cyan('sams-deploy --help'));
}

function getErrorSuggestion(code: string): string | null {
  const suggestions: Record<string, string> = {
    'CONFIG_NOT_FOUND': 'Make sure deploy-config.json exists in the scripts directory',
    'CONFIG_INVALID': 'Check that deploy-config.json is valid JSON and matches the expected schema',
    'ENV_INVALID': 'Use one of: development, staging, or production',
    'VERCEL_NOT_FOUND': 'Install Vercel CLI: npm install -g vercel',
    'FIREBASE_NOT_FOUND': 'Install Firebase CLI: npm install -g firebase-tools',
    'AUTH_FAILED': 'Run "vercel login" and "firebase login" to authenticate',
    'BUILD_FAILED': 'Check build logs for errors. Run with --verbose for more details',
    'DEPLOY_TIMEOUT': 'Deployment took too long. Try increasing timeout with --timeout',
    'NETWORK_ERROR': 'Check your internet connection and try again',
    'PERMISSION_DENIED': 'Make sure you have the necessary permissions for this environment'
  };

  return suggestions[code] || null;
}