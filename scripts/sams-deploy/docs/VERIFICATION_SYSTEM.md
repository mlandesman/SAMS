# Post-Deployment Verification System

The SAMS deployment system includes a comprehensive post-deployment verification system that automatically validates deployments to ensure they are working correctly before considering them successful.

## Overview

The verification system consists of two main components:

1. **HealthChecker** - Performs individual health, UI, and API checks
2. **DeploymentVerifier** - Coordinates all verification steps and provides comprehensive validation

## Features

### Health Checks
- **Endpoint Availability**: Verify all endpoints are responding
- **Response Time**: Ensure response times are within acceptable limits
- **SSL Certificate Validation**: Check HTTPS certificates are valid
- **Content Validation**: Verify expected content is present in responses
- **Header Validation**: Check for required HTTP headers

### UI Verification
- **Page Load Testing**: Verify pages load without errors
- **Element Presence**: Check critical UI elements are present
- **Text Content Validation**: Ensure expected text appears on pages
- **Console Error Detection**: Identify JavaScript errors in the browser
- **Screenshot Capture**: Take screenshots for visual verification

### API Testing
- **Endpoint Health**: Test all API endpoints respond correctly
- **Cross-Component Integration**: Verify components can communicate
- **Authentication**: Test API authentication mechanisms

### Performance Validation
- **Load Time Checks**: Ensure pages load within acceptable timeframes
- **Response Size Validation**: Check response sizes are reasonable
- **Core Web Vitals**: Monitor key performance metrics

### Security Validation
- **HTTPS Enforcement**: Verify all traffic uses HTTPS
- **Security Headers**: Check for essential security headers
- **Content Security Policy**: Validate CSP implementation
- **CORS Configuration**: Verify cross-origin policies

### Cache Validation
- **Cache Busting**: Ensure new versions are being served
- **Version Validation**: Confirm deployed version matches expected
- **Cache Headers**: Verify proper cache control headers

### Environment Validation
- **Environment Variables**: Check all required variables are present
- **Configuration Validation**: Verify environment-specific settings

### Rollback Readiness
- **Deployment Information**: Ensure rollback data is available
- **Previous Version Tracking**: Maintain deployment history

## Configuration

Add verification configuration to your `deploy-config.json`:

```json
{
  "verification": {
    "healthChecks": {
      "desktop": {
        "endpoint": "https://sams.sandyland.com.mx",
        "method": "GET",
        "expectedStatus": 200,
        "timeout": 30000,
        "retries": 3,
        "checkContent": "SAMS"
      },
      "mobile": {
        "endpoint": "https://mobile.sams.sandyland.com.mx",
        "method": "GET",
        "expectedStatus": 200,
        "timeout": 30000,
        "retries": 3
      },
      "backend": {
        "endpoint": "https://api.sams.sandyland.com.mx/api/health",
        "method": "GET",
        "expectedStatus": 200,
        "timeout": 15000,
        "retries": 3,
        "headers": {
          "Accept": "application/json"
        }
      }
    },
    "uiChecks": {
      "desktop": {
        "url": "https://sams.sandyland.com.mx",
        "checkElement": "body",
        "checkText": "SAMS",
        "checkConsoleErrors": true,
        "screenshot": true,
        "timeout": 30000
      },
      "mobile": {
        "url": "https://mobile.sams.sandyland.com.mx",
        "checkElement": ".app-container",
        "checkConsoleErrors": true,
        "screenshot": true
      }
    },
    "performanceChecks": {
      "desktop": {
        "url": "https://sams.sandyland.com.mx",
        "metrics": ["load", "fcp"],
        "thresholds": {
          "load": 5000,
          "fcp": 2000
        }
      }
    },
    "securityChecks": {
      "desktop": {
        "url": "https://sams.sandyland.com.mx",
        "checks": ["https", "headers", "csp"]
      }
    },
    "cacheChecks": {
      "desktop": {
        "url": "https://sams.sandyland.com.mx/version.json",
        "cacheKey": "version",
        "expectedVersion": "1.0.0"
      }
    },
    "integrationChecks": {
      "crossComponentUrls": [
        "https://sams.sandyland.com.mx/api/health"
      ],
      "apiEndpoints": [
        "https://api.sams.sandyland.com.mx/api/health"
      ]
    }
  }
}
```

## Usage

The verification system runs automatically after each successful deployment. You can control verification behavior with command-line options:

```bash
# Deploy with verbose verification output
sams-deploy desktop production --verbose

# Skip verification (not recommended for production)
sams-deploy desktop production --no-verify

# Run verification only (without deployment)
sams-deploy desktop production --verify-only
```

## Verification Results

The system provides detailed results for each check:

```typescript
interface VerificationResult {
  success: boolean;
  component: Component;
  environment: Environment;
  checks: VerificationCheck[];
  duration: number;
  error?: Error;
}

interface VerificationCheck {
  name: string;
  type: 'health' | 'ui' | 'api' | 'security' | 'performance' | 'cache' | 'integration';
  success: boolean;
  message: string;
  duration: number;
  metadata?: Record<string, any>;
  error?: Error;
}
```

## Check Types

### Health Checks
- `endpoint-health-{url}` - Basic endpoint availability
- `response-time-{url}` - Response time validation
- `ssl-certificate-{url}` - SSL certificate validation
- `content-validation-{url}` - Content validation
- `response-headers-{url}` - Header validation

### UI Checks
- `page-load-{url}` - Page loading functionality
- `element-presence-{selector}` - Element existence
- `text-content-{text}` - Text content validation
- `console-errors-{url}` - Console error detection
- `screenshot-{url}` - Screenshot capture

### Performance Checks
- `load-time-{component}` - Page load time
- `response-size-{component}` - Response size validation

### Security Checks
- `https-{component}` - HTTPS enforcement
- `security-headers-{component}` - Security header validation
- `csp-{component}` - Content Security Policy validation

### Cache Checks
- `cache-busting-{component}` - Cache invalidation validation
- `cache-headers-{component}` - Cache control headers

### Integration Checks
- `cross-component-{url}` - Cross-component communication
- `api-endpoint-{url}` - API endpoint validation
- `version-update-{component}` - Version validation
- `rollback-readiness-{component}` - Rollback capability

## Error Handling

The verification system is designed to be resilient:

- **Retries**: Configurable retry attempts for transient failures
- **Timeouts**: Configurable timeouts for each check type
- **Graceful Degradation**: Failed verification doesn't block deployment completion
- **Detailed Logging**: Comprehensive logging for troubleshooting

## Screenshots

UI verification can capture screenshots for visual validation:

- Screenshots are saved to `/tmp/screenshot-{component}-{environment}-{timestamp}.png`
- Screenshots include full page capture
- Useful for visual regression testing

## Integration with Rollback

The verification system validates rollback readiness by:

- Checking deployment ID availability
- Validating deployment history
- Ensuring previous versions are accessible

## Best Practices

1. **Configure Appropriate Timeouts**: Set realistic timeouts based on your application's performance characteristics

2. **Use Content Validation**: Verify critical content is present to catch deployment issues

3. **Monitor Security Headers**: Ensure security headers are properly configured

4. **Test Cross-Component Integration**: Verify all components can communicate properly

5. **Validate Environment Variables**: Ensure all required configuration is present

6. **Enable Screenshots**: Use screenshots for visual validation of critical pages

7. **Set Performance Thresholds**: Define acceptable performance limits for your application

## Troubleshooting

### Common Issues

1. **SSL Certificate Errors**: Check certificate validity and trust chain
2. **Timeout Issues**: Increase timeout values for slow-loading pages
3. **Content Validation Failures**: Verify expected content is actually present
4. **Console Errors**: Check browser console for JavaScript errors
5. **Performance Threshold Exceeded**: Optimize application or adjust thresholds

### Debug Mode

Run with `--verbose` flag for detailed verification output:

```bash
sams-deploy desktop production --verbose
```

This provides:
- Detailed check results
- Performance metrics
- Error details
- Screenshot locations

## Dependencies

The verification system requires:

- **Puppeteer**: For UI testing and screenshots
- **Axios**: For HTTP requests and API testing
- **Node.js 18+**: Runtime environment

## Security Considerations

- Screenshots may contain sensitive information
- Health check endpoints are accessed without authentication by default
- Consider network security when running verification from CI/CD systems