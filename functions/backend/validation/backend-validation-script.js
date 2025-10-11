/**
 * Backend Validation Script - BACKEND-VALIDATION-001
 * Purpose: Validate all backend routes and controllers match new database field structures
 * Created: July 5, 2025
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Field mappings showing old vs new field names
const FIELD_MAPPINGS = {
  users: {
    deprecated: ['clientAccess', 'globalRole', 'isActive', 'lastLogin', 'unitId'],
    new: {
      'clientAccess': 'propertyAccess',
      'globalRole': 'isSuperAdmin',
      'isActive': 'accountState',
      'lastLogin': 'Firebase Auth metadata',
      'unitId': 'unitAssignments array'
    },
    structure: {
      propertyAccess: {
        '[clientId]': {
          isAdmin: 'boolean',
          unitAssignments: [{
            unitId: 'string',
            role: 'owner | manager'
          }]
        }
      }
    }
  },
  transactions: {
    deprecated: ['createdAt', 'updatedAt', 'amount as decimal'],
    new: {
      'createdAt': 'created (Firestore Timestamp)',
      'updatedAt': 'updated (Firestore Timestamp)', 
      'amount': 'amount (stored as cents integer)'
    },
    documentIdPattern: 'YYYY-MM-DD_HHMMSS_nnn'
  }
};

// Files to check
const FILES_TO_CHECK = {
  routes: [
    'auth.js',
    'user.js',
    'transactions.js',
    'units.js',
    'accounts.js',
    'vendors.js',
    'categories.js',
    'hoaDues.js',
    'reports.js',
    'email.js',
    'paymentMethods.js',
    'clientManagement.js',
    'clientOnboarding.js'
  ],
  controllers: [
    'userManagementController.js',
    'transactionsController.js',
    'unitsController.js',
    'hoaDuesController.js',
    'clientsController.js'
  ],
  middleware: [
    'clientAuth.js',
    'unitAuthorization.js'
  ]
};

class BackendValidator {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.passed = [];
  }

  async validateFile(filePath, fileType) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const fileName = path.basename(filePath);
      
      console.log(`\n📄 Validating ${fileType}: ${fileName}`);
      
      // Check for deprecated fields
      this.checkDeprecatedFields(content, fileName, fileType);
      
      // Check for proper field usage
      this.checkFieldUsage(content, fileName, fileType);
      
      // Check authorization patterns
      if (fileType === 'middleware' || fileName.includes('auth')) {
        this.checkAuthorizationPatterns(content, fileName);
      }
      
      // Check timestamp usage
      this.checkTimestampUsage(content, fileName);
      
      // Check document ID patterns
      this.checkDocumentIdPatterns(content, fileName);
      
    } catch (error) {
      this.issues.push({
        file: filePath,
        type: 'FILE_ERROR',
        message: `Failed to read file: ${error.message}`
      });
    }
  }

  checkDeprecatedFields(content, fileName, fileType) {
    // Check for deprecated user fields
    const userDeprecatedFields = ['clientAccess', 'globalRole', 'isActive', 'lastLogin'];
    userDeprecatedFields.forEach(field => {
      const regex = new RegExp(`\\.${field}(?![A-Za-z])`, 'g');
      const matches = content.match(regex);
      if (matches) {
        this.issues.push({
          file: fileName,
          type: 'DEPRECATED_FIELD',
          field: field,
          count: matches.length,
          replacement: FIELD_MAPPINGS.users.new[field],
          message: `Found ${matches.length} uses of deprecated field '${field}' - should use '${FIELD_MAPPINGS.users.new[field]}'`
        });
      }
    });

    // Check for old client access patterns
    if (content.includes('clientAccess[') || content.includes('clientAccess.')) {
      this.issues.push({
        file: fileName,
        type: 'DEPRECATED_PATTERN',
        pattern: 'clientAccess',
        message: 'Using old clientAccess pattern - should use propertyAccess'
      });
    }
  }

  checkFieldUsage(content, fileName, fileType) {
    // Check for proper propertyAccess usage
    if (content.includes('propertyAccess')) {
      // Check if using correct structure
      if (!content.includes('isAdmin') && fileName.includes('user')) {
        this.warnings.push({
          file: fileName,
          type: 'MISSING_FIELD',
          message: 'propertyAccess used but missing isAdmin field check'
        });
      }
    }

    // Check for isSuperAdmin usage
    if (content.includes('isSuperAdmin')) {
      this.passed.push({
        file: fileName,
        type: 'CORRECT_FIELD',
        message: 'Correctly using isSuperAdmin field'
      });
    }

    // Check for old globalRole === 'superAdmin' pattern
    if (content.includes("globalRole === 'superAdmin'") || content.includes('globalRole === "superAdmin"')) {
      this.issues.push({
        file: fileName,
        type: 'DEPRECATED_PATTERN',
        pattern: "globalRole === 'superAdmin'",
        message: 'Should use isSuperAdmin boolean instead'
      });
    }
  }

  checkAuthorizationPatterns(content, fileName) {
    // Check for proper authorization patterns
    if (content.includes('hasClientAccess')) {
      // Check if it references propertyAccess
      if (!content.includes('propertyAccess')) {
        this.issues.push({
          file: fileName,
          type: 'INCONSISTENT_AUTH',
          message: 'hasClientAccess method should check propertyAccess, not clientAccess'
        });
      }
    }

    // Check unit assignment patterns
    if (content.includes('unitAssignments')) {
      this.passed.push({
        file: fileName,
        type: 'CORRECT_PATTERN',
        message: 'Using new unitAssignments array structure'
      });
    }
  }

  checkTimestampUsage(content, fileName) {
    // Check for proper timestamp usage
    const oldTimestampPatterns = [
      'new Date().toISOString()',
      'Date.now()',
      'createdAt:',
      'updatedAt:'
    ];

    oldTimestampPatterns.forEach(pattern => {
      if (content.includes(pattern) && !fileName.includes('import') && !fileName.includes('migration')) {
        this.warnings.push({
          file: fileName,
          type: 'TIMESTAMP_PATTERN',
          pattern: pattern,
          message: 'Consider using Firestore Timestamps instead of ISO strings'
        });
      }
    });

    // Check for correct usage
    if (content.includes('FieldValue.serverTimestamp()')) {
      this.passed.push({
        file: fileName,
        type: 'CORRECT_TIMESTAMP',
        message: 'Correctly using Firestore server timestamps'
      });
    }
  }

  checkDocumentIdPatterns(content, fileName) {
    // Check user document ID patterns
    if (fileName.includes('user') && content.includes('doc(')) {
      // Check if using email as doc ID
      if (content.includes('doc(email)') || content.includes('doc(userData.email)')) {
        this.issues.push({
          file: fileName,
          type: 'WRONG_DOC_ID',
          message: 'Using email as document ID - should use Firebase Auth UID'
        });
      }
      
      // Check for correct pattern
      if (content.includes('doc(uid)') || content.includes('doc(userRecord.uid)') || content.includes('doc(decodedToken.uid)')) {
        this.passed.push({
          file: fileName,
          type: 'CORRECT_DOC_ID',
          message: 'Correctly using UID as user document ID'
        });
      }
    }
  }

  async generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('BACKEND VALIDATION REPORT - BACKEND-VALIDATION-001');
    console.log('='.repeat(80));
    
    console.log('\n❌ CRITICAL ISSUES (' + this.issues.length + ')');
    console.log('-'.repeat(40));
    this.issues.forEach(issue => {
      console.log(`\nFile: ${issue.file}`);
      console.log(`Type: ${issue.type}`);
      console.log(`Issue: ${issue.message}`);
      if (issue.field) console.log(`Field: ${issue.field}`);
      if (issue.count) console.log(`Occurrences: ${issue.count}`);
    });

    console.log('\n⚠️  WARNINGS (' + this.warnings.length + ')');
    console.log('-'.repeat(40));
    this.warnings.forEach(warning => {
      console.log(`\nFile: ${warning.file}`);
      console.log(`Type: ${warning.type}`);
      console.log(`Warning: ${warning.message}`);
    });

    console.log('\n✅ PASSED CHECKS (' + this.passed.length + ')');
    console.log('-'.repeat(40));
    this.passed.forEach(pass => {
      console.log(`File: ${pass.file} - ${pass.message}`);
    });

    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalFiles: Object.values(FILES_TO_CHECK).flat().length,
        criticalIssues: this.issues.length,
        warnings: this.warnings.length,
        passed: this.passed.length
      },
      issues: this.issues,
      warnings: this.warnings,
      passed: this.passed
    };

    await fs.writeFile(
      path.join(__dirname, 'validation-report.json'),
      JSON.stringify(report, null, 2)
    );

    console.log('\n📊 Summary:');
    console.log(`Total Files Checked: ${report.summary.totalFiles}`);
    console.log(`Critical Issues: ${report.summary.criticalIssues}`);
    console.log(`Warnings: ${report.summary.warnings}`);
    console.log(`Passed Checks: ${report.summary.passed}`);
    console.log('\nDetailed report saved to: validation-report.json');
  }

  async run() {
    console.log('🔍 Starting Backend Validation...\n');

    // Check routes
    for (const routeFile of FILES_TO_CHECK.routes) {
      const filePath = path.join(__dirname, '..', 'routes', routeFile);
      await this.validateFile(filePath, 'route');
    }

    // Check controllers
    for (const controllerFile of FILES_TO_CHECK.controllers) {
      const filePath = path.join(__dirname, '..', 'controllers', controllerFile);
      await this.validateFile(filePath, 'controller');
    }

    // Check middleware
    for (const middlewareFile of FILES_TO_CHECK.middleware) {
      const filePath = path.join(__dirname, '..', 'middleware', middlewareFile);
      await this.validateFile(filePath, 'middleware');
    }

    await this.generateReport();
  }
}

// Run validation
const validator = new BackendValidator();
validator.run().catch(console.error);