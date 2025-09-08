# SAMS Deploy - Deployment Automation System

A comprehensive deployment automation tool for the SAMS (Sandyland Management System) that handles multi-environment deployments across Vercel and Firebase.

## Features

- 🚀 **Multi-Environment Support**: Deploy to development, staging, or production
- 🎯 **Component-Specific Deployment**: Deploy desktop, mobile, backend, or Firebase rules individually
- 🔄 **Rollback Capability**: Quickly revert to previous deployments
- 📊 **Real-time Monitoring**: Track deployment progress and status
- 🧪 **Dry Run Mode**: Preview deployment actions without executing them
- 🎨 **Beautiful CLI**: Color-coded output with progress indicators
- ⚡ **Fast & Reliable**: Built with TypeScript for type safety and performance

## Installation

```bash
# From the project root
cd scripts/sams-deploy
npm install
npm run build

# Make it globally available
npm link
```

## Usage

### Basic Commands

```bash
# Deploy all components to production
sams-deploy --env production --component all

# Deploy mobile app to staging
sams-deploy --env staging --component mobile

# Deploy backend with monitoring
sams-deploy --env production --component backend --monitor

# Dry run to see what would be deployed
sams-deploy --env production --all --dry-run

# Rollback desktop UI
sams-deploy --env production --component desktop --rollback
```

### Options

- `-e, --env <environment>`: Target environment (dev, staging, production)
- `-c, --component <component>`: Component to deploy (desktop, mobile, backend, firebase, all)
- `-d, --dry-run`: Perform a dry run without deploying
- `-m, --monitor`: Monitor deployment status
- `-r, --rollback`: Rollback to previous deployment
- `-v, --verbose`: Enable verbose logging
- `-q, --quiet`: Suppress non-essential output
- `--firebase-project <project>`: Override Firebase project ID
- `--no-cache`: Skip build cache
- `--force`: Force deployment even with warnings
- `--timeout <seconds>`: Deployment timeout (default: 300)

### Environment Variables

Create `.env` files for environment-specific variables:

```bash
# .env.production
VERCEL_TOKEN=your_vercel_token
FIREBASE_TOKEN=your_firebase_token
SLACK_WEBHOOK=your_slack_webhook
```

## Configuration

The deployment system uses `deploy-config.json` for project settings:

```json
{
  "projects": {
    "desktop": {
      "vercelProjectId": "prj_xxx",
      "buildCommand": "npm run build:ui",
      "outputDirectory": "frontend/sams-ui/dist"
    }
  },
  "environments": {
    "production": {
      "firebaseProject": "sams-prod",
      "desktopUrl": "https://sams.sandyland.com.mx"
    }
  }
}
```

## Development

```bash
# Run in development mode
npm run dev -- --env staging --component mobile

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build the project
npm run build
```

## Architecture

The deployment system is built with a modular architecture:

- **CLI Layer**: Commander.js-based interface with comprehensive options
- **Configuration Management**: Zod-validated configuration with environment support
- **Deployment Modules**: Component-specific deployment logic (Phase 2)
- **Monitoring System**: Real-time status tracking and health checks (Phase 3)
- **Utilities**: Logging, error handling, version management, and git integration

## Phase 1 Status

✅ **Completed**:
- Core CLI structure with Commander.js
- Configuration loading and validation
- Logger with color-coded output
- Error handling framework
- Version management utilities
- Git integration helpers
- Basic test suite

🚧 **Upcoming (Phase 2)**:
- Vercel deployment integration
- Firebase rules deployment
- Component-specific build processes
- Deployment status monitoring

## Troubleshooting

### Common Issues

1. **Configuration not found**: Ensure `deploy-config.json` exists in the scripts directory
2. **Invalid environment**: Use one of: development, staging, or production
3. **Missing commands**: Install required CLIs: `npm install -g vercel firebase-tools`

### Debug Mode

Run with verbose logging to see detailed information:

```bash
sams-deploy --env production --component all --verbose
```

## Contributing

When adding new features:

1. Follow the TypeScript strict mode guidelines
2. Add comprehensive error handling
3. Include unit tests for new functionality
4. Update this README with new options/features
5. Log progress to the Memory Bank

## License

MIT