import { execute } from './process';
import { logger } from './logger';
import { DeploymentError } from './error-handler';

export async function ensureCleanWorkingDirectory(force: boolean = false): Promise<void> {
  try {
    const { stdout } = await execute('git', ['status', '--porcelain'], { captureOutput: true });
    
    if (stdout.trim()) {
      if (force) {
        logger.warn('Working directory has uncommitted changes (proceeding with --force)');
      } else {
        throw new DeploymentError(
          'Working directory has uncommitted changes',
          'GIT_DIRTY',
          { hint: 'Commit or stash your changes, or use --force to proceed anyway' }
        );
      }
    }
  } catch (error) {
    if (error instanceof DeploymentError && error.code === 'GIT_DIRTY') {
      throw error;
    }
    logger.warn('Could not check git status');
  }
}

export async function getCurrentBranch(): Promise<string> {
  try {
    const { stdout } = await execute('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { captureOutput: true });
    return stdout.trim();
  } catch (error) {
    logger.warn('Could not determine current git branch');
    return 'unknown';
  }
}

export async function getLastCommitMessage(): Promise<string> {
  try {
    const { stdout } = await execute('git', ['log', '-1', '--pretty=%B'], { captureOutput: true });
    return stdout.trim();
  } catch (error) {
    logger.warn('Could not get last commit message');
    return '';
  }
}

export async function getCurrentCommitHash(): Promise<string> {
  try {
    const { stdout } = await execute('git', ['rev-parse', 'HEAD'], { captureOutput: true });
    return stdout.trim();
  } catch (error) {
    logger.warn('Could not get current commit hash');
    return 'unknown';
  }
}

export async function createDeploymentCommit(
  environment: string,
  components: string[],
  version: string
): Promise<void> {
  try {
    const message = `Deploy ${components.join(', ')} to ${environment} (v${version})`;
    
    await execute('git', ['add', '-A']);
    await execute('git', ['commit', '-m', message, '--allow-empty']);
    
    logger.success(`Created deployment commit: ${message}`);
  } catch (error) {
    logger.warn('Could not create deployment commit');
  }
}

export async function tagDeployment(
  environment: string,
  version: string,
  deploymentId: string
): Promise<void> {
  try {
    const tag = `deploy-${environment}-${version}-${deploymentId}`;
    const message = `Deployment to ${environment} at ${new Date().toISOString()}`;
    
    await execute('git', ['tag', '-a', tag, '-m', message]);
    logger.debug(`Created deployment tag: ${tag}`);
  } catch (error) {
    logger.warn('Could not create deployment tag');
  }
}