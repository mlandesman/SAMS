import { spawn, SpawnOptions } from 'child_process';
import { logger } from './logger';
import { DeploymentError } from './error-handler';

interface ExecuteOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeout?: number;
  captureOutput?: boolean;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
}

interface ExecuteResult {
  code: number;
  stdout: string;
  stderr: string;
  duration: number;
}

export async function execute(
  command: string,
  args: string[] = [],
  options: ExecuteOptions = {}
): Promise<ExecuteResult> {
  const startTime = Date.now();
  const {
    cwd = process.cwd(),
    env = process.env,
    timeout = 300000, // 5 minutes default
    captureOutput = true,
    onStdout,
    onStderr
  } = options;

  logger.debug(`Executing: ${command} ${args.join(' ')}`);

  return new Promise((resolve, reject) => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    
    const spawnOptions: SpawnOptions = {
      cwd,
      env,
      shell: true
    };

    const child = spawn(command, args, spawnOptions);
    
    // Set timeout
    const timeoutHandle = timeout ? setTimeout(() => {
      child.kill('SIGTERM');
      reject(new DeploymentError(
        `Command timed out after ${timeout}ms`,
        'COMMAND_TIMEOUT',
        { command, args }
      ));
    }, timeout) : null;

    // Handle stdout
    child.stdout?.on('data', (data) => {
      const str = data.toString();
      if (captureOutput) {
        stdout.push(str);
      }
      if (onStdout) {
        onStdout(str);
      } else if (!options.captureOutput) {
        process.stdout.write(data);
      }
    });

    // Handle stderr
    child.stderr?.on('data', (data) => {
      const str = data.toString();
      if (captureOutput) {
        stderr.push(str);
      }
      if (onStderr) {
        onStderr(str);
      } else if (!options.captureOutput) {
        process.stderr.write(data);
      }
    });

    // Handle process exit
    child.on('close', (code) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      const duration = Date.now() - startTime;
      const result: ExecuteResult = {
        code: code || 0,
        stdout: stdout.join(''),
        stderr: stderr.join(''),
        duration
      };

      if (code === 0) {
        resolve(result);
      } else {
        reject(new DeploymentError(
          `Command failed with exit code ${code}`,
          'COMMAND_FAILED',
          { command, args, ...result }
        ));
      }
    });

    // Handle process errors
    child.on('error', (error) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      
      reject(new DeploymentError(
        `Failed to execute command: ${error.message}`,
        'COMMAND_ERROR',
        { command, args, error: error.message }
      ));
    });
  });
}

export async function executeWithRetry(
  command: string,
  args: string[] = [],
  options: ExecuteOptions & { maxRetries?: number; retryDelay?: number } = {}
): Promise<ExecuteResult> {
  const { maxRetries = 3, retryDelay = 1000, ...execOptions } = options;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.debug(`Attempt ${attempt}/${maxRetries}`);
      return await execute(command, args, execOptions);
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        logger.warn(`Command failed, retrying in ${retryDelay}ms...`);
        await sleep(retryDelay);
      }
    }
  }

  throw lastError || new Error('Command failed after retries');
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function checkCommandExists(command: string): Promise<boolean> {
  try {
    await execute('which', [command], { captureOutput: true });
    return true;
  } catch {
    return false;
  }
}

export async function ensureCommandsExist(commands: string[]): Promise<void> {
  const missing: string[] = [];
  
  for (const command of commands) {
    if (!(await checkCommandExists(command))) {
      missing.push(command);
    }
  }
  
  if (missing.length > 0) {
    throw new DeploymentError(
      'Required commands not found',
      'COMMANDS_MISSING',
      { missing }
    );
  }
}

/**
 * Simple command execution alias for compatibility
 */
export async function executeCommand(
  command: string,
  args: string[] = [],
  options: ExecuteOptions = {}
): Promise<ExecuteResult> {
  return execute(command, args, options);
}