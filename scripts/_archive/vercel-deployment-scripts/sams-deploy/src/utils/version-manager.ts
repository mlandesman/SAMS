import { readFile, writeFile, mkdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { execSync } from 'child_process';
import { logger } from './logger';
import { getCurrentVersion, incrementVersion, createVersionTag } from './version';

export interface VersionMetadata {
  version: string;
  timestamp: string;
  gitCommit?: string;
  gitBranch?: string;
  deployedBy?: string;
  environment: 'development' | 'staging' | 'production';
  buildId: string;
  previousVersion?: string;
  rollbackAvailable: boolean;
  deploymentNotes?: string[];
}

export interface VersionNotification {
  hasUpdate: boolean;
  currentVersion: string;
  newVersion?: string;
  deploymentDate?: string;
  features?: string[];
  breaking?: boolean;
  rollbackInstructions?: string;
}

/**
 * Comprehensive version management system for SAMS deployments
 * Handles automatic version incrementing, metadata tracking, and user notifications
 */
export class VersionManager {
  private projectRoot: string;
  private environment: string;

  constructor(projectRoot: string, environment: string = 'development') {
    this.projectRoot = projectRoot;
    this.environment = environment;
  }

  /**
   * Automatically increment version based on deployment type and environment
   */
  async autoIncrementVersion(
    deploymentType: 'patch' | 'minor' | 'major' = 'patch',
    deploymentNotes?: string[]
  ): Promise<VersionMetadata> {
    logger.info(`🔢 Auto-incrementing version (${deploymentType})...`);

    try {
      const currentVersionInfo = await getCurrentVersion();
      const previousVersion = currentVersionInfo.version;
      
      // Increment version
      const newVersion = await incrementVersion(deploymentType);
      
      // Generate build ID
      const buildId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      // Create comprehensive metadata
      const metadata: VersionMetadata = {
        version: newVersion,
        timestamp: new Date().toISOString(),
        gitCommit: this.getGitCommit(),
        gitBranch: this.getGitBranch(),
        deployedBy: process.env.USER || process.env.USERNAME || 'unknown',
        environment: this.environment as any,
        buildId,
        previousVersion,
        rollbackAvailable: true,
        deploymentNotes: deploymentNotes || []
      };

      // Update shared version.json with comprehensive metadata
      await this.updateSharedVersionFile(metadata);

      // Create version history entry
      await this.createVersionHistoryEntry(metadata);

      // Create git tag for tracking
      if (this.environment === 'production') {
        createVersionTag(newVersion, `Production deployment v${newVersion}`);
      }

      logger.success(`✅ Version incremented: ${previousVersion} → ${newVersion}`);
      
      return metadata;

    } catch (error) {
      logger.error(`❌ Version increment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Update the shared version.json file with deployment metadata
   */
  private async updateSharedVersionFile(metadata: VersionMetadata): Promise<void> {
    const sharedVersionPath = resolve(this.projectRoot, '../../shared/version.json');
    
    try {
      // Read existing version data if it exists
      let existingData: any = {};
      try {
        const existingContent = await readFile(sharedVersionPath, 'utf-8');
        existingData = JSON.parse(existingContent);
      } catch {
        // File doesn't exist or is invalid, start fresh
      }

      // Create comprehensive version data
      const versionData = {
        appName: 'SAMS',
        shortName: 'SAMS',
        companyName: 'Sandyland Properties',
        copyright: new Date().getFullYear().toString(),
        version: metadata.version,
        buildDate: metadata.timestamp,
        buildTimestamp: new Date().getTime(),
        environment: metadata.environment,
        gitBranch: metadata.gitBranch || 'unknown',
        gitCommit: metadata.gitCommit || 'unknown',
        developers: ['Michael Landesman', 'Claude AI'],
        features: [
          'PWA Support',
          'Multi-Client Management', 
          'Financial Reporting',
          'Document Storage',
          'Unit Management',
          'Cache-Busting System',
          'Version Management'
        ],
        git: {
          hash: metadata.gitCommit?.substring(0, 7) || 'unknown',
          branch: metadata.gitBranch || 'unknown',
          lastCommitDate: this.getGitLastCommitDate()
        },
        build: {
          timestamp: metadata.timestamp,
          environment: metadata.environment,
          nodeVersion: process.version,
          platform: process.platform,
          buildNumber: metadata.buildId,
          buildId: metadata.buildId
        },
        deployment: {
          target: metadata.environment,
          date: metadata.timestamp,
          automated: true,
          deployedBy: metadata.deployedBy,
          previousVersion: metadata.previousVersion,
          rollbackAvailable: metadata.rollbackAvailable,
          notes: metadata.deploymentNotes
        },
        // Preserve any existing custom fields
        ...existingData
      };

      // Ensure directory exists
      await mkdir(dirname(sharedVersionPath), { recursive: true });
      
      // Write updated version file
      await writeFile(sharedVersionPath, JSON.stringify(versionData, null, 2));
      
      logger.debug(`Updated shared version file: ${sharedVersionPath}`);

    } catch (error) {
      logger.error(`Failed to update shared version file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Create version history entry for tracking deployments
   */
  private async createVersionHistoryEntry(metadata: VersionMetadata): Promise<void> {
    const historyDir = resolve(this.projectRoot, '../../shared/version-history');
    const historyFile = resolve(historyDir, `${metadata.environment}-history.json`);

    try {
      // Ensure directory exists
      await mkdir(historyDir, { recursive: true });

      // Read existing history
      let history: VersionMetadata[] = [];
      try {
        const existingHistory = await readFile(historyFile, 'utf-8');
        history = JSON.parse(existingHistory);
      } catch {
        // File doesn't exist, start fresh
      }

      // Add new entry to history
      history.unshift(metadata);

      // Keep only last 50 entries to prevent file bloat
      if (history.length > 50) {
        history = history.slice(0, 50);
      }

      // Write updated history
      await writeFile(historyFile, JSON.stringify(history, null, 2));
      
      logger.debug(`Created version history entry for v${metadata.version}`);

    } catch (error) {
      logger.warn(`Failed to create version history entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Don't fail deployment if history creation fails
    }
  }

  /**
   * Check if a new version is available and generate notification data
   */
  async checkForNewVersion(currentClientVersion: string): Promise<VersionNotification> {
    try {
      const latestVersion = await getCurrentVersion();
      
      const hasUpdate = this.compareVersions(latestVersion.version, currentClientVersion) > 0;
      
      if (!hasUpdate) {
        return {
          hasUpdate: false,
          currentVersion: currentClientVersion
        };
      }

      // Get deployment metadata for the new version
      const sharedVersionPath = resolve(this.projectRoot, '../../shared/version.json');
      let deploymentInfo: any = {};
      
      try {
        const versionData = await readFile(sharedVersionPath, 'utf-8');
        deploymentInfo = JSON.parse(versionData);
      } catch {
        // If we can't read deployment info, still return basic update notification
      }

      // Determine if this is a breaking change
      const breaking = this.isBreakingChange(currentClientVersion, latestVersion.version);

      return {
        hasUpdate: true,
        currentVersion: currentClientVersion,
        newVersion: latestVersion.version,
        deploymentDate: deploymentInfo.deployment?.date || latestVersion.timestamp,
        features: deploymentInfo.features || [],
        breaking,
        rollbackInstructions: breaking 
          ? 'This update includes breaking changes. Please refresh the page and clear your browser cache if you experience issues.'
          : 'This is a standard update. Simply refresh the page to get the latest version.'
      };

    } catch (error) {
      logger.error(`Failed to check for new version: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        hasUpdate: false,
        currentVersion: currentClientVersion
      };
    }
  }

  /**
   * Generate client-side version notification script
   */
  generateVersionNotificationScript(checkInterval: number = 300000): string {
    return `
// SAMS Version Manager - Auto-generated
(function() {
  const VERSION_CHECK_KEY = 'sams-last-version-check';
  const CURRENT_VERSION_KEY = 'sams-current-version';
  const CHECK_INTERVAL = ${checkInterval}; // 5 minutes default
  
  async function checkForUpdates() {
    try {
      const response = await fetch('/cache-bust-manifest.json?t=' + Date.now());
      if (!response.ok) return;
      
      const manifest = await response.json();
      const currentVersion = localStorage.getItem(CURRENT_VERSION_KEY);
      
      if (!currentVersion) {
        localStorage.setItem(CURRENT_VERSION_KEY, manifest.version);
        return;
      }
      
      if (currentVersion !== manifest.version) {
        showUpdateNotification(currentVersion, manifest.version, manifest);
        localStorage.setItem(CURRENT_VERSION_KEY, manifest.version);
      }
      
      localStorage.setItem(VERSION_CHECK_KEY, Date.now().toString());
      
    } catch (error) {
      console.debug('Version check failed:', error);
    }
  }
  
  function showUpdateNotification(oldVersion, newVersion, manifest) {
    // Create notification element
    const notification = document.createElement('div');
    notification.id = 'sams-update-notification';
    notification.style.cssText = \`
      position: fixed;
      top: 20px;
      right: 20px;
      background: #2563eb;
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 10000;
      max-width: 350px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.4;
    \`;
    
    notification.innerHTML = \`
      <div style="font-weight: 600; margin-bottom: 8px;">
        🚀 SAMS Updated!
      </div>
      <div style="margin-bottom: 12px;">
        Version \${oldVersion} → \${newVersion}
      </div>
      <div style="display: flex; gap: 8px;">
        <button onclick="window.location.reload()" style="
          background: white;
          color: #2563eb;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
        ">Refresh Now</button>
        <button onclick="this.parentElement.parentElement.remove()" style="
          background: transparent;
          color: white;
          border: 1px solid rgba(255,255,255,0.5);
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
        ">Later</button>
      </div>
    \`;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 30 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 30000);
  }
  
  function shouldCheckForUpdates() {
    const lastCheck = localStorage.getItem(VERSION_CHECK_KEY);
    if (!lastCheck) return true;
    
    const timeSinceLastCheck = Date.now() - parseInt(lastCheck);
    return timeSinceLastCheck > CHECK_INTERVAL;
  }
  
  // Initial check
  if (shouldCheckForUpdates()) {
    checkForUpdates();
  }
  
  // Periodic checks
  setInterval(() => {
    if (shouldCheckForUpdates()) {
      checkForUpdates();
    }
  }, CHECK_INTERVAL);
  
  // Check when page becomes visible (tab switching)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && shouldCheckForUpdates()) {
      checkForUpdates();
    }
  });
  
  // Make function available globally
  window.checkSAMSUpdates = checkForUpdates;
})();
`;
  }

  /**
   * Create rollback package for emergency rollbacks
   */
  async createRollbackPackage(metadata: VersionMetadata): Promise<string> {
    const rollbackDir = resolve(this.projectRoot, '../../shared/rollback-packages');
    const rollbackFile = resolve(rollbackDir, `rollback-${metadata.version}-${metadata.buildId}.json`);

    try {
      await mkdir(rollbackDir, { recursive: true });

      const rollbackData = {
        version: metadata.version,
        previousVersion: metadata.previousVersion,
        rollbackDate: new Date().toISOString(),
        environment: metadata.environment,
        gitCommit: metadata.gitCommit,
        gitBranch: metadata.gitBranch,
        buildId: metadata.buildId,
        instructions: [
          `1. Revert to git commit: ${metadata.gitCommit}`,
          `2. Run deployment for ${metadata.environment} environment`,
          `3. Verify functionality before proceeding`,
          `4. Update version.json manually if needed`
        ],
        verificationSteps: [
          'Check application loads correctly',
          'Verify authentication works',
          'Test critical user flows',
          'Confirm data integrity'
        ]
      };

      await writeFile(rollbackFile, JSON.stringify(rollbackData, null, 2));
      
      logger.debug(`Created rollback package: ${rollbackFile}`);
      return rollbackFile;

    } catch (error) {
      logger.warn(`Failed to create rollback package: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  private getGitCommit(): string | undefined {
    try {
      return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    } catch {
      return undefined;
    }
  }

  private getGitBranch(): string | undefined {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    } catch {
      return undefined;
    }
  }

  private getGitLastCommitDate(): string {
    try {
      return execSync('git log -1 --format=%cd --date=format:"%Y-%m-%d %H:%M:%S %z"', { encoding: 'utf-8' }).trim();
    } catch {
      return new Date().toISOString();
    }
  }

  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      
      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }
    
    return 0;
  }

  private isBreakingChange(oldVersion: string, newVersion: string): boolean {
    const oldParts = oldVersion.split('.').map(Number);
    const newParts = newVersion.split('.').map(Number);
    
    // Major version change is considered breaking
    return newParts[0] > oldParts[0];
  }
}

/**
 * Convenience function to create version manager and auto-increment
 */
export async function autoIncrementDeploymentVersion(
  projectRoot: string,
  environment: string,
  deploymentType: 'patch' | 'minor' | 'major' = 'patch',
  deploymentNotes?: string[]
): Promise<VersionMetadata> {
  const versionManager = new VersionManager(projectRoot, environment);
  return await versionManager.autoIncrementVersion(deploymentType, deploymentNotes);
}