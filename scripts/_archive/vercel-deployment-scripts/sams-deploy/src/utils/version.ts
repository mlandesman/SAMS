import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { execSync } from 'child_process';
import { logger } from './logger';

export interface VersionInfo {
  version: string;
  timestamp: string;
  gitCommit?: string;
  gitBranch?: string;
  deployedBy?: string;
  buildNumber?: string;
}

export async function getCurrentVersion(): Promise<VersionInfo> {
  try {
    // Try to read version from shared version.json first
    const versionPath = resolve(process.cwd(), 'shared', 'version.json');
    const versionData = await readFile(versionPath, 'utf-8');
    const versionJson = JSON.parse(versionData);
    
    return {
      version: versionJson.version || '0.0.0',
      timestamp: new Date().toISOString(),
      gitCommit: getGitCommit(),
      gitBranch: getGitBranch(),
      deployedBy: process.env.USER || 'unknown',
      buildNumber: versionJson.build?.buildNumber || generateBuildNumber()
    };
  } catch (error) {
    logger.debug('Could not read version.json, using git info');
    
    return {
      version: getVersionFromGit() || '0.0.0',
      timestamp: new Date().toISOString(),
      gitCommit: getGitCommit(),
      gitBranch: getGitBranch(),
      deployedBy: process.env.USER || 'unknown',
      buildNumber: generateBuildNumber()
    };
  }
}

export async function incrementVersion(type: 'major' | 'minor' | 'patch' = 'patch'): Promise<string> {
  const current = await getCurrentVersion();
  const parts = current.version.split('.').map(Number);
  
  switch (type) {
    case 'major':
      parts[0]++;
      parts[1] = 0;
      parts[2] = 0;
      break;
    case 'minor':
      parts[1]++;
      parts[2] = 0;
      break;
    case 'patch':
      parts[2]++;
      break;
  }
  
  const newVersion = parts.join('.');
  
  // Update version.json
  try {
    const versionPath = resolve(process.cwd(), 'shared', 'version.json');
    const versionData = {
      version: newVersion,
      timestamp: new Date().toISOString(),
      gitCommit: getGitCommit(),
      gitBranch: getGitBranch()
    };
    
    await writeFile(versionPath, JSON.stringify(versionData, null, 2));
    logger.debug(`Version updated to ${newVersion}`);
  } catch (error) {
    logger.warn('Could not update version.json');
  }
  
  return newVersion;
}

function getGitCommit(): string | undefined {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return undefined;
  }
}

function getGitBranch(): string | undefined {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return undefined;
  }
}

function getVersionFromGit(): string | undefined {
  try {
    const tag = execSync('git describe --tags --abbrev=0', { encoding: 'utf-8' }).trim();
    return tag.replace(/^v/, '');
  } catch {
    return undefined;
  }
}

export function createVersionTag(version: string, message?: string): void {
  try {
    const tag = `v${version}`;
    const tagMessage = message || `Release ${version}`;
    
    execSync(`git tag -a ${tag} -m "${tagMessage}"`, { encoding: 'utf-8' });
    logger.success(`Created git tag: ${tag}`);
  } catch (error) {
    logger.warn(`Could not create git tag: ${error}`);
  }
}

function generateBuildNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hour = now.getHours().toString().padStart(2, '0');
  const minute = now.getMinutes().toString().padStart(2, '0');
  
  return `${year}${month}${day}.${hour}${minute}`;
}