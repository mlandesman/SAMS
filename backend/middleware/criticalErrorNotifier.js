// Critical Error Notifier Middleware
import { sendEmail } from '../services/emailService.js';

// Configuration for critical error monitoring
const CRITICAL_ERROR_PATTERNS = [
  {
    pattern: /Forbidden field .* cannot be used/,
    type: 'FORBIDDEN_FIELD_VIOLATION',
    severity: 'CRITICAL'
  },
  {
    pattern: /Transaction validation failed/,
    type: 'TRANSACTION_VALIDATION_FAILURE',
    severity: 'HIGH'
  },
  {
    pattern: /Failed to create transaction record/,
    type: 'TRANSACTION_CREATION_FAILURE',
    severity: 'HIGH'
  }
];

// In-memory store for recent errors (for local notification)
const recentErrors = [];
const ERROR_RETENTION_MINUTES = 30;

/**
 * Middleware to intercept and notify about critical errors
 */
export function criticalErrorNotifier(err, req, res, next) {
  // Check if this is a critical error
  const errorMessage = err.message || err.toString();
  const matchedPattern = CRITICAL_ERROR_PATTERNS.find(p => 
    p.pattern.test(errorMessage)
  );

  if (matchedPattern) {
    const errorDetails = {
      timestamp: new Date().toISOString(),
      type: matchedPattern.type,
      severity: matchedPattern.severity,
      message: errorMessage,
      endpoint: `${req.method} ${req.originalUrl}`,
      user: req.user?.email || 'Unknown',
      requestBody: req.body,
      stack: err.stack
    };

    // Store locally for dashboard access
    recentErrors.push(errorDetails);
    
    // Clean up old errors
    const cutoffTime = Date.now() - (ERROR_RETENTION_MINUTES * 60 * 1000);
    while (recentErrors.length > 0 && 
           new Date(recentErrors[0].timestamp).getTime() < cutoffTime) {
      recentErrors.shift();
    }

    // Log with special formatting for visibility
    console.error('\n' + '='.repeat(80));
    console.error('🚨 CRITICAL ERROR DETECTED 🚨');
    console.error('='.repeat(80));
    console.error(`Type: ${matchedPattern.type}`);
    console.error(`Severity: ${matchedPattern.severity}`);
    console.error(`Time: ${errorDetails.timestamp}`);
    console.error(`Endpoint: ${errorDetails.endpoint}`);
    console.error(`Message: ${errorMessage}`);
    console.error('='.repeat(80) + '\n');

    // For development, also send email notification
    if (process.env.NODE_ENV === 'development' && process.env.ADMIN_EMAIL) {
      sendCriticalErrorEmail(errorDetails).catch(emailErr => {
        console.error('Failed to send critical error email:', emailErr);
      });
    }
  }

  // Continue with normal error handling
  next(err);
}

/**
 * Get recent critical errors for dashboard display
 */
export function getRecentCriticalErrors() {
  return recentErrors.map(err => ({
    ...err,
    requestBody: undefined, // Don't expose full request body
    stack: undefined // Don't expose stack trace
  }));
}

/**
 * Send email notification for critical errors
 */
async function sendCriticalErrorEmail(errorDetails) {
  const subject = `🚨 CRITICAL: ${errorDetails.type}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #dc3545; color: white; padding: 20px; border-radius: 5px 5px 0 0;">
        <h2 style="margin: 0;">🚨 Critical Error Detected</h2>
      </div>
      <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Type:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${errorDetails.type}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Severity:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${errorDetails.severity}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Time:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${errorDetails.timestamp}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Endpoint:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${errorDetails.endpoint}</td>
          </tr>
          <tr>
            <td style="padding: 10px;"><strong>Message:</strong></td>
            <td style="padding: 10px;"><code style="background-color: #f8d7da; padding: 5px; border-radius: 3px;">${errorDetails.message}</code></td>
          </tr>
        </table>
        
        <div style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border: 1px solid #ffeeba; border-radius: 5px;">
          <strong>Action Required:</strong> This error indicates a critical system failure that needs immediate attention.
        </div>
      </div>
    </div>
  `;

  await sendEmail(
    process.env.ADMIN_EMAIL,
    subject,
    html
  );
}