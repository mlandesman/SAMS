# SAMS Operational Procedures
*Production deployment, maintenance, and operational guidelines from APM v0.3*

## Overview

This document contains all operational procedures, deployment processes, and maintenance guidelines established during APM v0.3. These procedures have been tested in production with MTC and AVII clients and should be followed for v0.4 operations.

## Deployment Procedures

### Production Deployment Pipeline

```bash
# Full deployment workflow
Development → Testing → Staging → Production

1. Development (localhost:3000)
   ├── Feature development
   ├── Unit testing
   └── Integration testing

2. Testing (CI/CD Pipeline)
   ├── Automated tests
   ├── Security scanning
   └── Build verification

3. Staging (staging.sams.sandyland.com.mx)
   ├── User acceptance testing
   ├── Performance testing
   └── Final validation

4. Production (sams.sandyland.com.mx)
   ├── Blue-green deployment
   ├── Health checks
   └── Rollback capability
```

### Pre-Deployment Checklist

```markdown
## Before Every Deployment

### Code Quality
- [ ] All tests passing (npm test)
- [ ] No ESLint errors (npm run lint)
- [ ] Code review approved
- [ ] Version number updated
- [ ] CHANGELOG.md updated

### Database
- [ ] Migration scripts ready
- [ ] Backup current database
- [ ] Test migrations on staging
- [ ] Rollback scripts prepared

### Configuration
- [ ] Environment variables verified
- [ ] Feature flags configured
- [ ] API keys rotated if needed
- [ ] Firebase rules updated

### Security
- [ ] Security scan completed
- [ ] Dependency audit clean
- [ ] Sensitive data check
- [ ] Access controls verified

### Communication
- [ ] Stakeholders notified
- [ ] Maintenance window scheduled
- [ ] Support team briefed
- [ ] Documentation updated
```

### Deployment Commands

```bash
# Frontend Deployment (Vercel)
npm run build:prod
vercel --prod

# Backend Deployment (Firebase Functions)
npm run deploy:functions

# Database Rules Deployment
firebase deploy --only firestore:rules

# Full Stack Deployment
./scripts/deploy-production.sh

# Rollback if needed
./scripts/rollback-production.sh
```

### Environment Configuration

```javascript
// Environment-specific configurations
const environments = {
  development: {
    name: 'Development',
    url: 'http://localhost:3000',
    api: 'http://localhost:5000',
    firebase: devFirebaseConfig,
    features: {
      debug: true,
      testing: true,
      analytics: false
    }
  },
  staging: {
    name: 'Staging',
    url: 'https://staging.sams.sandyland.com.mx',
    api: 'https://staging-api.sams.sandyland.com.mx',
    firebase: stagingFirebaseConfig,
    features: {
      debug: false,
      testing: true,
      analytics: true
    }
  },
  production: {
    name: 'Production',
    url: 'https://sams.sandyland.com.mx',
    api: 'https://api.sams.sandyland.com.mx',
    firebase: prodFirebaseConfig,
    features: {
      debug: false,
      testing: false,
      analytics: true
    }
  }
};
```

## Data Migration Procedures

### Client Onboarding Process

```bash
# Step 1: Prepare client data
cd scripts/client-onboarding
mkdir data/CLIENT_NAME

# Step 2: Convert data to standard format
python convert_to_standard.py \
  --input raw_data/ \
  --output data/CLIENT_NAME/ \
  --client CLIENT_NAME

# Step 3: Validate data
node validate-import-data.js CLIENT_NAME

# Step 4: Dry run import
npm run import:dry-run CLIENT_NAME

# Step 5: Review dry run results
cat logs/dry-run-CLIENT_NAME.log

# Step 6: Execute import
npm run import:execute CLIENT_NAME

# Step 7: Verify import
npm run import:verify CLIENT_NAME

# Step 8: Generate report
npm run import:report CLIENT_NAME
```

### Data Import Scripts

```javascript
// Master import orchestrator
const importClient = async (clientId, options = {}) => {
  const steps = [
    { name: 'Setup', fn: setupClientEnvironment },
    { name: 'Users', fn: importUsers },
    { name: 'Units', fn: importUnits },
    { name: 'Vendors', fn: importVendors },
    { name: 'Categories', fn: importCategories },
    { name: 'Accounts', fn: importAccounts },
    { name: 'Transactions', fn: importTransactions },
    { name: 'HOA Dues', fn: importHOADues },
    { name: 'Documents', fn: importDocuments },
    { name: 'Validation', fn: validateImport }
  ];
  
  const results = {
    clientId,
    startTime: new Date(),
    steps: [],
    errors: [],
    warnings: []
  };
  
  for (const step of steps) {
    console.log(`Executing: ${step.name}`);
    
    try {
      const stepResult = await step.fn(clientId, options);
      results.steps.push({
        name: step.name,
        status: 'success',
        ...stepResult
      });
    } catch (error) {
      results.steps.push({
        name: step.name,
        status: 'failed',
        error: error.message
      });
      results.errors.push(error);
      
      if (!options.continueOnError) {
        break;
      }
    }
  }
  
  results.endTime = new Date();
  results.duration = results.endTime - results.startTime;
  
  // Save import report
  await saveImportReport(results);
  
  return results;
};
```

### Database Backup and Restore

```bash
# Automated backup script
#!/bin/bash

# Daily backup procedure
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
PROJECT_ID="sams-production"
BUCKET="gs://sams-backups"

# Export Firestore
gcloud firestore export \
  --project=$PROJECT_ID \
  $BUCKET/backups/$BACKUP_DATE

# Verify backup
gcloud firestore operations list \
  --project=$PROJECT_ID

# Store backup metadata
echo "{
  \"date\": \"$BACKUP_DATE\",
  \"project\": \"$PROJECT_ID\",
  \"location\": \"$BUCKET/backups/$BACKUP_DATE\",
  \"type\": \"scheduled\",
  \"status\": \"completed\"
}" > backup-manifests/$BACKUP_DATE.json

# Clean old backups (keep 30 days)
find backup-manifests -mtime +30 -delete
```

### Emergency Restore Procedure

```bash
# Restore from backup
#!/bin/bash

BACKUP_DATE=$1
PROJECT_ID="sams-production"
BUCKET="gs://sams-backups"

# Confirm restore
read -p "Restore from $BACKUP_DATE? This will overwrite current data! (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "Restore cancelled"
  exit 1
fi

# Create pre-restore backup
./create-emergency-backup.sh

# Import from backup
gcloud firestore import \
  --project=$PROJECT_ID \
  $BUCKET/backups/$BACKUP_DATE

# Verify restore
node scripts/verify-restore.js $BACKUP_DATE

# Notify team
./notify-restore-complete.sh $BACKUP_DATE
```

## Monitoring and Maintenance

### Daily Operations Checklist

```markdown
## Daily Tasks (Morning)

### System Health
- [ ] Check system status dashboard
- [ ] Review overnight error logs
- [ ] Verify all services running
- [ ] Check backup completion
- [ ] Review security alerts

### Performance
- [ ] API response times < 200ms
- [ ] Database query performance
- [ ] Memory usage < 80%
- [ ] CPU usage < 70%
- [ ] Storage usage < 80%

### Business Operations
- [ ] New user registrations
- [ ] Transaction processing
- [ ] Payment confirmations
- [ ] Document uploads
- [ ] Email delivery status

### Security
- [ ] Failed login attempts
- [ ] Suspicious activity alerts
- [ ] Rate limit violations
- [ ] Permission denied events
- [ ] New admin actions
```

### System Monitoring

```javascript
// Health check endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: packageJson.version
  });
});

app.get('/health/detailed', requireAuth, (req, res) => {
  const checks = {
    database: checkDatabase(),
    storage: checkStorage(),
    authentication: checkAuth(),
    email: checkEmailService(),
    apis: checkExternalAPIs()
  };
  
  Promise.all(Object.values(checks))
    .then(results => {
      res.json({
        status: results.every(r => r.healthy) ? 'healthy' : 'degraded',
        services: results,
        timestamp: new Date()
      });
    });
});
```

### Performance Monitoring

```javascript
// Performance metrics collection
const metrics = {
  // Response time tracking
  trackResponseTime: (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      
      // Log slow requests
      if (duration > 1000) {
        logger.warn('Slow request', {
          method: req.method,
          path: req.path,
          duration,
          status: res.statusCode
        });
      }
      
      // Record metric
      recordMetric('api_response_time', duration, {
        endpoint: req.path,
        method: req.method,
        status: res.statusCode
      });
    });
    
    next();
  },
  
  // Database query tracking
  trackQuery: async (collection, operation, query) => {
    const start = Date.now();
    
    try {
      const result = await query;
      const duration = Date.now() - start;
      
      recordMetric('db_query_time', duration, {
        collection,
        operation,
        resultCount: result.size || result.length
      });
      
      return result;
    } catch (error) {
      recordMetric('db_query_error', 1, {
        collection,
        operation,
        error: error.message
      });
      throw error;
    }
  }
};
```

### Error Tracking and Recovery

```javascript
// Centralized error handler
class ErrorHandler {
  static async handle(error, context = {}) {
    // Classify error
    const classification = this.classify(error);
    
    // Log error
    logger.error('Application error', {
      ...classification,
      ...context,
      stack: error.stack
    });
    
    // Take action based on severity
    switch (classification.severity) {
      case 'critical':
        await this.handleCritical(error, context);
        break;
      case 'high':
        await this.handleHigh(error, context);
        break;
      case 'medium':
        await this.handleMedium(error, context);
        break;
      default:
        await this.handleLow(error, context);
    }
    
    // Record metric
    recordMetric('application_error', 1, classification);
    
    return classification;
  }
  
  static classify(error) {
    if (error.code === 'PERMISSION_DENIED') {
      return { severity: 'medium', category: 'security', recoverable: true };
    }
    
    if (error.code === 'RESOURCE_EXHAUSTED') {
      return { severity: 'high', category: 'performance', recoverable: false };
    }
    
    if (error.message?.includes('Firebase')) {
      return { severity: 'high', category: 'infrastructure', recoverable: false };
    }
    
    return { severity: 'low', category: 'application', recoverable: true };
  }
  
  static async handleCritical(error, context) {
    // Page on-call engineer
    await notifyOnCall('Critical error', error, context);
    
    // Create incident
    await createIncident({
      severity: 'critical',
      error,
      context
    });
    
    // Attempt automatic recovery
    await this.attemptRecovery(error);
  }
}
```

## User Support Procedures

### New User Onboarding

```markdown
## User Onboarding Steps

### 1. Account Creation
- Create user in Firebase Auth
- Create user document in Firestore
- Assign appropriate role
- Grant client access
- Configure unit assignments (if applicable)

### 2. Welcome Email
- Send credentials
- Include getting started guide
- Provide support contact
- Set expectations

### 3. Initial Login Support
- Guide through first login
- Help with password change
- Explain interface
- Show key features

### 4. Training
- Schedule training session
- Provide documentation
- Create practice scenarios
- Answer questions

### 5. Follow-up
- Check in after 1 week
- Address any issues
- Gather feedback
- Offer additional training
```

### Support Ticket Handling

```javascript
// Support ticket workflow
const handleSupportTicket = async (ticket) => {
  // 1. Classify ticket
  const classification = classifyTicket(ticket);
  
  // 2. Auto-respond
  await sendAutoResponse(ticket, classification);
  
  // 3. Route to appropriate team
  switch (classification.category) {
    case 'authentication':
      await routeToAuthTeam(ticket);
      break;
    case 'billing':
      await routeToBillingTeam(ticket);
      break;
    case 'technical':
      await routeToTechTeam(ticket);
      break;
    default:
      await routeToGeneralSupport(ticket);
  }
  
  // 4. Track SLA
  const sla = getSLA(classification.priority);
  await scheduleSLAReminder(ticket, sla);
  
  // 5. Update ticket status
  await updateTicketStatus(ticket.id, 'assigned');
};

// SLA definitions
const slaDefinitions = {
  critical: {
    responseTime: 15 * 60 * 1000,      // 15 minutes
    resolutionTime: 4 * 60 * 60 * 1000 // 4 hours
  },
  high: {
    responseTime: 60 * 60 * 1000,      // 1 hour
    resolutionTime: 24 * 60 * 60 * 1000 // 24 hours
  },
  medium: {
    responseTime: 4 * 60 * 60 * 1000,  // 4 hours
    resolutionTime: 72 * 60 * 60 * 1000 // 72 hours
  },
  low: {
    responseTime: 24 * 60 * 60 * 1000,  // 24 hours
    resolutionTime: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
};
```

## Maintenance Procedures

### Scheduled Maintenance

```bash
# Monthly maintenance script
#!/bin/bash

echo "Starting monthly maintenance - $(date)"

# 1. Database optimization
echo "Optimizing database..."
node scripts/optimize-database.js

# 2. Clean up old logs
echo "Cleaning logs..."
find logs/ -mtime +90 -delete

# 3. Archive old audit logs
echo "Archiving audit logs..."
node scripts/archive-audit-logs.js

# 4. Update dependencies
echo "Checking dependencies..."
npm audit
npm update

# 5. Clear caches
echo "Clearing caches..."
redis-cli FLUSHDB

# 6. Compact storage
echo "Compacting storage..."
node scripts/compact-storage.js

# 7. Generate maintenance report
echo "Generating report..."
node scripts/maintenance-report.js

echo "Maintenance complete - $(date)"
```

### Emergency Procedures

```markdown
## Emergency Response Procedures

### System Down
1. Check monitoring dashboard
2. Verify all services status
3. Check recent deployments
4. Review error logs
5. Initiate rollback if needed
6. Notify stakeholders
7. Document incident

### Data Breach
1. Isolate affected systems
2. Preserve evidence
3. Notify security team
4. Begin investigation
5. Notify legal team
6. Prepare disclosure
7. Implement fixes
8. Post-mortem review

### Performance Crisis
1. Identify bottleneck
2. Scale resources
3. Implement caching
4. Optimize queries
5. Disable non-critical features
6. Monitor recovery
7. Root cause analysis

### Critical Bug in Production
1. Assess impact
2. Implement hotfix
3. Test fix
4. Deploy to production
5. Verify resolution
6. Backport to staging
7. Full fix in next release
```

### Rollback Procedures

```bash
# Automated rollback script
#!/bin/bash

PREVIOUS_VERSION=$1

echo "Starting rollback to version $PREVIOUS_VERSION"

# 1. Backup current state
echo "Creating backup of current state..."
./create-emergency-backup.sh

# 2. Stop services
echo "Stopping services..."
pm2 stop all

# 3. Rollback code
echo "Rolling back code..."
git fetch --all
git checkout $PREVIOUS_VERSION

# 4. Rollback database if needed
echo "Checking for database rollback..."
if [ -f "rollback-scripts/$PREVIOUS_VERSION.sql" ]; then
  echo "Executing database rollback..."
  node scripts/execute-rollback.js $PREVIOUS_VERSION
fi

# 5. Install dependencies
echo "Installing dependencies..."
npm ci

# 6. Build application
echo "Building application..."
npm run build:prod

# 7. Start services
echo "Starting services..."
pm2 start all

# 8. Verify rollback
echo "Verifying rollback..."
node scripts/verify-rollback.js $PREVIOUS_VERSION

echo "Rollback complete"
```

## Troubleshooting Guide

### Common Issues and Solutions

```javascript
const troubleshootingGuide = {
  'Login failures': {
    symptoms: ['Cannot login', 'Invalid credentials', 'Token expired'],
    checks: [
      'Verify Firebase Auth is operational',
      'Check user exists in Firestore',
      'Verify email format in user document',
      'Check token expiration settings',
      'Review CORS configuration'
    ],
    solutions: [
      'Reset user password',
      'Recreate user document',
      'Clear browser cache',
      'Check timezone settings',
      'Verify API endpoint'
    ]
  },
  
  'Permission denied': {
    symptoms: ['403 errors', 'Access denied', 'Unauthorized'],
    checks: [
      'Verify user role',
      'Check client access permissions',
      'Review unit assignments',
      'Validate token claims',
      'Check middleware chain'
    ],
    solutions: [
      'Update user permissions',
      'Grant client access',
      'Assign units to user',
      'Refresh authentication token',
      'Review authorization logic'
    ]
  },
  
  'Performance issues': {
    symptoms: ['Slow loading', 'Timeouts', 'High latency'],
    checks: [
      'Monitor API response times',
      'Check database query performance',
      'Review Firestore indexes',
      'Analyze bundle size',
      'Check network latency'
    ],
    solutions: [
      'Optimize database queries',
      'Add Firestore indexes',
      'Implement caching',
      'Enable CDN',
      'Upgrade infrastructure'
    ]
  },
  
  'Data inconsistency': {
    symptoms: ['Wrong balances', 'Missing data', 'Duplicate entries'],
    checks: [
      'Verify migration scripts',
      'Check calculation logic',
      'Review transaction atomicity',
      'Validate data imports',
      'Check timezone handling'
    ],
    solutions: [
      'Recalculate balances',
      'Run data validation scripts',
      'Fix migration issues',
      'Implement transaction locks',
      'Standardize timezones'
    ]
  }
};
```

### Diagnostic Commands

```bash
# System diagnostics
npm run diagnostics

# Database health check
npm run db:health

# API endpoint testing
npm run test:api

# Security audit
npm audit
npm run security:scan

# Performance profiling
npm run profile

# Check deployment status
vercel status
firebase projects:list

# View recent logs
npm run logs:tail

# Generate system report
npm run report:system
```

## Change Management

### Change Request Process

```markdown
## Change Request Workflow

### 1. Request Submission
- Requester fills out change request form
- Includes business justification
- Defines success criteria
- Estimates impact

### 2. Review and Approval
- Technical review by dev team
- Risk assessment
- Resource estimation
- Stakeholder approval

### 3. Planning
- Create implementation plan
- Define rollback procedure
- Schedule change window
- Notify affected users

### 4. Implementation
- Execute change plan
- Monitor progress
- Document deviations
- Verify success criteria

### 5. Validation
- Test functionality
- Verify no regressions
- Check performance impact
- Confirm user acceptance

### 6. Closure
- Update documentation
- Close change request
- Conduct lessons learned
- Archive artifacts
```

### Version Control Procedures

```bash
# Branching strategy
main           # Production code
├── staging    # Pre-production
├── develop    # Integration branch
├── feature/*  # Feature branches
├── fix/*      # Bug fix branches
└── hotfix/*   # Emergency fixes

# Version naming convention
# MAJOR.MINOR.PATCH
# 1.0.0 - Initial release
# 1.1.0 - New feature
# 1.1.1 - Bug fix
# 2.0.0 - Breaking change

# Release process
git checkout develop
git pull origin develop
git checkout -b release/1.2.0
# Update version numbers
npm version minor
# Update CHANGELOG.md
git add .
git commit -m "Release v1.2.0"
git push origin release/1.2.0
# Create PR to main
# After merge, tag release
git tag -a v1.2.0 -m "Release version 1.2.0"
git push origin v1.2.0
```

## Documentation Management

### Documentation Standards

```markdown
## Documentation Requirements

### Code Documentation
- JSDoc comments for all functions
- README.md in each module
- API documentation
- Architecture diagrams
- Database schema docs

### Operational Documentation
- Deployment procedures
- Troubleshooting guides
- Runbooks for common tasks
- Disaster recovery plans
- Security procedures

### User Documentation
- User guides
- Video tutorials
- FAQ section
- Release notes
- Feature documentation

### Maintenance Schedule
- Weekly: Update runbooks
- Monthly: Review procedures
- Quarterly: Architecture review
- Annually: Full documentation audit
```

### Knowledge Base Management

```javascript
// Documentation generation
const generateDocs = async () => {
  // Generate API documentation
  await generateApiDocs();
  
  // Generate database schema
  await generateSchemaDoc();
  
  // Generate component documentation
  await generateComponentDocs();
  
  // Create searchable index
  await createSearchIndex();
  
  // Deploy to documentation site
  await deployDocs();
};

// Keep documentation current
const updateDocumentation = async (change) => {
  const affectedDocs = identifyAffectedDocs(change);
  
  for (const doc of affectedDocs) {
    await updateDocument(doc, change);
    await reviewDocument(doc);
    await publishDocument(doc);
  }
  
  await notifyDocUpdate(affectedDocs);
};
```

## Compliance and Auditing

### Audit Procedures

```javascript
// Regular audit schedule
const auditSchedule = {
  daily: [
    'Security event review',
    'Failed login analysis',
    'Permission changes'
  ],
  weekly: [
    'User access review',
    'API usage patterns',
    'Error trend analysis'
  ],
  monthly: [
    'Full permission audit',
    'Data access patterns',
    'Compliance check'
  ],
  quarterly: [
    'Security assessment',
    'Performance review',
    'Capacity planning'
  ],
  annual: [
    'Full system audit',
    'Disaster recovery test',
    'Security penetration test'
  ]
};

// Audit execution
const executeAudit = async (type) => {
  const auditId = generateAuditId();
  const startTime = new Date();
  
  console.log(`Starting ${type} audit - ${auditId}`);
  
  const results = {
    id: auditId,
    type,
    startTime,
    findings: [],
    recommendations: []
  };
  
  // Execute audit checks
  const checks = auditSchedule[type];
  for (const check of checks) {
    const finding = await performCheck(check);
    results.findings.push(finding);
  }
  
  // Generate recommendations
  results.recommendations = generateRecommendations(results.findings);
  
  // Save audit report
  results.endTime = new Date();
  await saveAuditReport(results);
  
  // Notify stakeholders
  if (results.findings.some(f => f.severity === 'high')) {
    await notifyStakeholders(results);
  }
  
  return results;
};
```

## Conclusion

These operational procedures represent the complete operational framework developed and refined during APM v0.3. They have been validated through production operations with multiple clients and should be maintained and enhanced in v0.4.

Key operational principles:
1. **Automation First** - Automate repetitive tasks
2. **Monitor Everything** - Comprehensive monitoring and alerting
3. **Document Changes** - Keep documentation current
4. **Test Before Deploy** - Never deploy untested changes
5. **Plan for Failure** - Always have rollback procedures
6. **Communicate Clearly** - Keep stakeholders informed
7. **Learn from Incidents** - Post-mortem without blame
8. **Maintain Security** - Security in all operations
9. **Optimize Continuously** - Regular performance reviews
10. **Support Users** - Responsive and helpful support