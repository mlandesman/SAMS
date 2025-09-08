import { BaseDeployer, DeployerOptions } from './base';
import { DeploymentResult } from '../types';
import { logger } from '../utils/logger';
import { executeWithRetry, checkCommandExists } from '../utils/process';
import { DeploymentError } from '../utils/error-handler';
import * as path from 'path';
import * as fs from 'fs/promises';

export class FirebaseDeployer extends BaseDeployer {
  private firebaseProject: string;
  private rulesBackupPath: string;

  constructor(options: DeployerOptions) {
    super(options);
    
    // Set Firebase project from options or environment config
    const envConfig = this.getEnvironmentConfig();
    this.firebaseProject = this.options.firebaseProject || envConfig.firebaseProject;
    
    // Set backup path for rules
    this.rulesBackupPath = path.join(
      path.dirname(this.projectPath),
      '.firebase-rules-backup',
      this.environment,
      new Date().toISOString().replace(/:/g, '-')
    );
  }

  protected async checkComponentPrerequisites(): Promise<void> {
    // Check if Firebase CLI is installed
    const hasFirebase = await checkCommandExists('firebase');
    if (!hasFirebase) {
      throw new DeploymentError(
        'Firebase CLI is not installed. Run: npm install -g firebase-tools',
        'FIREBASE_NOT_FOUND'
      );
    }
    
    // Check if firestore.rules exists
    const firestoreRulesPath = path.join(this.projectPath, 'firestore.rules');
    try {
      await fs.access(firestoreRulesPath);
    } catch {
      throw new DeploymentError(
        'firestore.rules file not found',
        'FIRESTORE_RULES_NOT_FOUND',
        { path: firestoreRulesPath }
      );
    }
    
    // Check if storage.rules exists
    const storageRulesPath = path.join(this.projectPath, 'storage.rules');
    try {
      await fs.access(storageRulesPath);
    } catch {
      throw new DeploymentError(
        'storage.rules file not found',
        'STORAGE_RULES_NOT_FOUND',
        { path: storageRulesPath }
      );
    }
  }

  async build(): Promise<void> {
    // Firebase rules don't need building, but we'll validate them
    this.logProgress('Validating Firebase security rules...');
    
    if (this.options.dryRun) {
      this.logProgress('Dry run: Skipping rules validation');
      return;
    }
    
    // Validate Firestore rules
    try {
      await executeWithRetry('firebase', [
        'firestore:rules:test',
        '--project', this.firebaseProject
      ], {
        cwd: this.projectPath,
        timeout: 30000,
        maxRetries: 1
      });
      this.logProgress('✓ Firestore rules validation passed');
    } catch (error) {
      // Non-critical: Tests might not be set up
      logger.warn('Firestore rules tests not configured or failed - continuing anyway');
    }
  }

  async deploy(): Promise<DeploymentResult> {
    try {
      // Switch to the correct Firebase project
      await this.switchFirebaseProject();
      
      // Backup existing rules
      await this.backupExistingRules();
      
      // Deploy Firestore rules
      const firestoreResult = await this.deployFirestoreRules();
      if (!firestoreResult.success && !this.options.force) {
        return firestoreResult;
      }
      
      // Deploy Storage rules
      const storageResult = await this.deployStorageRules();
      if (!storageResult.success && !this.options.force) {
        return storageResult;
      }
      
      // Success
      const projectUrl = `https://console.firebase.google.com/project/${this.firebaseProject}`;
      return this.createResult(true, projectUrl);
      
    } catch (error) {
      const deploymentError = error instanceof Error ? error : new Error('Unknown deployment error');
      return this.createResult(false, undefined, deploymentError);
    }
  }

  private async switchFirebaseProject(): Promise<void> {
    this.logProgress(`Switching to Firebase project: ${this.firebaseProject}`);
    
    if (this.options.dryRun) {
      this.logProgress('Dry run: Would switch to Firebase project');
      return;
    }
    
    try {
      await executeWithRetry('firebase', [
        'use', this.firebaseProject
      ], {
        cwd: this.projectPath,
        timeout: 10000,
        maxRetries: 2
      });
      this.logProgress(`✓ Switched to Firebase project: ${this.firebaseProject}`);
    } catch (error) {
      throw new DeploymentError(
        `Failed to switch Firebase project: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FIREBASE_PROJECT_SWITCH_FAILED',
        { project: this.firebaseProject, error }
      );
    }
  }

  private async backupExistingRules(): Promise<void> {
    this.logProgress('Backing up existing security rules...');
    
    if (this.options.dryRun) {
      this.logProgress('Dry run: Would backup existing rules');
      return;
    }
    
    try {
      // Create backup directory
      await fs.mkdir(this.rulesBackupPath, { recursive: true });
      
      // Get current Firestore rules from Firebase
      const firestoreBackup = await executeWithRetry('firebase', [
        'firestore:rules:get',
        '--project', this.firebaseProject
      ], {
        cwd: this.projectPath,
        timeout: 30000,
        captureOutput: true
      });
      
      // Save Firestore rules backup
      if (firestoreBackup.stdout) {
        const firestoreBackupFile = path.join(this.rulesBackupPath, 'firestore.rules');
        await fs.writeFile(firestoreBackupFile, firestoreBackup.stdout);
        this.logProgress(`✓ Backed up Firestore rules to: ${firestoreBackupFile}`);
      }
      
      // Storage rules backup (Firebase doesn't have a direct get command, so we'll copy local)
      const storageRulesPath = path.join(this.projectPath, 'storage.rules');
      const storageBackupFile = path.join(this.rulesBackupPath, 'storage.rules');
      await fs.copyFile(storageRulesPath, storageBackupFile);
      this.logProgress(`✓ Backed up Storage rules to: ${storageBackupFile}`);
      
    } catch (error) {
      logger.warn(`Failed to backup rules: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Continue with deployment even if backup fails
    }
  }

  private async deployFirestoreRules(): Promise<DeploymentResult> {
    this.logProgress('Deploying Firestore security rules...');
    
    if (this.options.dryRun) {
      this.logProgress('Dry run: Would deploy Firestore rules');
      return this.createResult(true);
    }
    
    try {
      await executeWithRetry('firebase', [
        'deploy',
        '--only', 'firestore:rules',
        '--project', this.firebaseProject,
        '--force' // Skip confirmation prompts
      ], {
        cwd: this.projectPath,
        timeout: 60000,
        maxRetries: 2,
        onStdout: (data) => {
          // Log Firebase output
          if (data.includes('Deploy complete!')) {
            this.logProgress('✓ Firestore rules deployed successfully');
          }
        }
      });
      
      return this.createResult(true);
    } catch (error) {
      return this.createResult(false, undefined, error instanceof Error ? error : new Error('Firestore rules deployment failed'));
    }
  }

  private async deployStorageRules(): Promise<DeploymentResult> {
    this.logProgress('Deploying Storage security rules...');
    
    if (this.options.dryRun) {
      this.logProgress('Dry run: Would deploy Storage rules');
      return this.createResult(true);
    }
    
    try {
      await executeWithRetry('firebase', [
        'deploy',
        '--only', 'storage:rules',
        '--project', this.firebaseProject,
        '--force' // Skip confirmation prompts
      ], {
        cwd: this.projectPath,
        timeout: 60000,
        maxRetries: 2,
        onStdout: (data) => {
          // Log Firebase output
          if (data.includes('Deploy complete!')) {
            this.logProgress('✓ Storage rules deployed successfully');
          }
        }
      });
      
      return this.createResult(true);
    } catch (error) {
      return this.createResult(false, undefined, error instanceof Error ? error : new Error('Storage rules deployment failed'));
    }
  }

  protected async postDeployHook(result: DeploymentResult): Promise<void> {
    if (result.success && !this.options.dryRun) {
      this.logProgress('Firebase deployment completed successfully');
      this.logProgress(`Project: ${this.firebaseProject}`);
      this.logProgress(`Console: https://console.firebase.google.com/project/${this.firebaseProject}`);
      
      // Log backup location
      this.logProgress(`Rules backed up to: ${this.rulesBackupPath}`);
    }
  }

  /**
   * Rollback to previous rules version
   */
  async rollback(backupPath?: string): Promise<DeploymentResult> {
    this.logProgress('Rolling back Firebase rules...');
    
    if (!backupPath) {
      // Find the most recent backup
      const backupDir = path.join(path.dirname(this.projectPath), '.firebase-rules-backup', this.environment);
      try {
        const backups = await fs.readdir(backupDir);
        if (backups.length === 0) {
          throw new DeploymentError('No backup files found', 'NO_BACKUPS_FOUND');
        }
        // Sort by date (newest first)
        backups.sort().reverse();
        backupPath = path.join(backupDir, backups[0]);
      } catch (error) {
        throw new DeploymentError(
          'Failed to find backup files',
          'BACKUP_ACCESS_FAILED',
          { error }
        );
      }
    }
    
    try {
      // Copy backup files to project directory
      const firestoreBackup = path.join(backupPath, 'firestore.rules');
      const storageBackup = path.join(backupPath, 'storage.rules');
      
      await fs.copyFile(firestoreBackup, path.join(this.projectPath, 'firestore.rules'));
      await fs.copyFile(storageBackup, path.join(this.projectPath, 'storage.rules'));
      
      this.logProgress('✓ Restored rules from backup');
      
      // Deploy the restored rules
      return await this.deploy();
      
    } catch (error) {
      throw new DeploymentError(
        `Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ROLLBACK_FAILED',
        { backupPath, error }
      );
    }
  }
}