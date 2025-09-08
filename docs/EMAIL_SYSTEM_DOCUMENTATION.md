# Digital Receipt Email System Documentation

## Overview
Complete digital receipt email system for the Sandyland Account Management System (SAMS), providing secure, client-specific email delivery of payment receipts with professional HTML formatting and image attachments.

## System Architecture

### Core Components

#### Backend Services
- **`emailConfigController.js`** - Manages per-client email configuration
- **`emailService.js`** - Handles email sending via Gmail SMTP with nodemailer
- **`/routes/email.js`** - API endpoints for email configuration and sending
- **`/scripts/initializeEmailConfig.js`** - Script to set up default email configurations

#### Frontend Components
- **`DigitalReceipt.jsx`** - Enhanced receipt modal with email functionality
- **`NotificationModal.jsx`** - Reusable success/error notification system
- **`useNotification.js`** - Custom hook for notification state management
- **`/api/email.js`** - Frontend API service for email operations

## Configuration System

### Firestore Structure
```
/clients/{clientId}/config/receiptEmail
├── subject: "Marina Turquesa Condominiums - Payment Receipt"
├── bodyTemplate: "Dear {{ownerName}}, Please find attached..."
├── signature: "<div style='font-family: Arial;'>...</div>"
├── ccList: ["pm@sandyland.com.mx"]
├── fromName: "Marina Turquesa Condominiums"
└── replyTo: "pm@sandyland.com.mx"
```

### Template Variables
The system supports automatic variable substitution in email templates:

- `{{ownerName}}` - Property owner name
- `{{unitNumber}}` - Unit identifier (e.g., "PH4D")
- `{{amount}}` - Payment amount with currency formatting
- `{{paymentDate}}` - Date of payment
- `{{paymentMethod}}` - Payment method used
- `{{receiptNumber}}` - Unique receipt identifier
- `{{propertyName}}` - Property/development name

## Email Configuration Management

### Initialize Default Configuration
```bash
cd backend
node scripts/initializeEmailConfig.js
```

### Update Configuration via API
```javascript
// Get current configuration
const config = await fetch('/api/email/config/MTC');

// Update configuration
await fetch('/api/email/config/MTC', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    subject: "Updated Subject Line",
    bodyTemplate: "Updated email body with {{variables}}",
    signature: "<div>Updated signature</div>"
  })
});
```

## Gmail Integration Setup

### Prerequisites
1. **Gmail Account** with 2-Factor Authentication enabled
2. **App Password** generated for SAMS application
3. **Environment Variables** configured in backend

### Environment Configuration
Create `.env` file in `/backend` directory:
```env
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password
```

### Supported Gmail Accounts
- `ms@landesman.com` - Primary management email
- `michael@sandyland.com.mx` - Secondary management email

## Email Features

### Professional HTML Formatting
- **Responsive Design** - Compatible with major email clients
- **Corporate Branding** - Sandyland logo and styling
- **Compact Signatures** - Optimized spacing and typography
- **Contact Information** - Phone, email, address details

### Image Attachments
- **Receipt Images** - High-quality JPEG format
- **Optimized Size** - Reduced file size for faster delivery
- **Automatic Generation** - Created from receipt modal content

### Delivery Features
- **Multiple Recipients** - Support for multiple owner emails
- **CC Functionality** - Automatic CC to property management
- **Delivery Confirmation** - Success/failure notifications
- **Error Handling** - Graceful fallback for missing data

## Notification System

### NotificationModal Component
Reusable modal for displaying operation results:

```jsx
<NotificationModal
  isOpen={true}
  type="success" // 'success', 'error', 'warning', 'info'
  title="Email Sent Successfully!"
  message="The receipt has been delivered to all recipients."
  details={[
    { label: "Sent to", value: "owner@email.com" },
    { label: "CC", value: "pm@sandyland.com.mx" },
    { label: "Unit", value: "PH4D" },
    { label: "Amount", value: "MX$ 20,000.00" }
  ]}
  onClose={closeHandler}
/>
```

### Architecture Benefits
- **Root-Level Rendering** - Avoids z-index conflicts with parent modals
- **Reusable Design** - Can be used across the application
- **Detailed Feedback** - Shows delivery confirmation and recipient details

## Usage Workflow

### 1. Generate Digital Receipt
- User selects transaction and clicks "Digital Receipt"
- DigitalReceipt modal opens with transaction data
- Receipt displays with professional formatting

### 2. Send via Email
- User clicks "Send Receipt via Email" button
- System validates owner contact information
- Email configuration loaded from Firestore
- Template variables populated with transaction data

### 3. Email Delivery
- Receipt image generated from modal content
- HTML email composed with template and variables
- Email sent via Gmail SMTP with image attachment
- Success/failure notification displayed

### 4. Notification Feedback
- Success: Shows delivery details and recipients
- Error: Shows error message and suggested actions
- Modal renders at root level for proper visibility

## Security Considerations

### Data Protection
- **App Passwords** - Secure Gmail authentication without exposing main password
- **Environment Variables** - Sensitive credentials stored securely
- **Client Isolation** - Each client has separate email configuration
- **Validation** - Input validation and sanitization throughout

### Access Control
- **Backend Authentication** - API endpoints protected
- **Configuration Management** - Only authorized updates allowed
- **Error Handling** - No sensitive information leaked in error messages

## Troubleshooting

### Common Issues

#### Module Not Found Error
```bash
# Ensure you're in the correct directory
cd backend
node scripts/initializeEmailConfig.js
```

#### Gmail Authentication Failed
1. Verify 2FA is enabled on Gmail account
2. Generate new App Password
3. Update GMAIL_APP_PASSWORD in .env file
4. Restart backend service

#### Email Not Sending
1. Check internet connectivity
2. Verify Gmail credentials in .env
3. Check Firestore email configuration
4. Review backend console logs for errors

#### Notification Modal Not Appearing
1. Verify modal is rendered at root level
2. Check z-index conflicts
3. Ensure notification state is properly managed
4. Review browser console for React errors

### Debugging
Enable debug logging in email service:
```javascript
console.log('📧 Email config:', config);
console.log('📧 Template variables:', variables);
console.log('📧 Final email body:', finalBody);
```

## Future Enhancements

### Phase 2 Features
- **Unit Reports** - Detailed financial reports per unit
- **Monthly Reports** - Automated monthly statements
- **Admin UI** - Visual email template editor
- **WhatsApp Integration** - Receipt sharing via Twilio
- **Email Analytics** - Delivery tracking and read receipts

### Scalability Considerations
- **Template Engine** - More sophisticated templating system
- **Email Queuing** - Background processing for bulk emails
- **Multi-Language** - Internationalization support
- **Email Providers** - Support for additional email services
- **Template Library** - Pre-built email templates

## Maintenance

### Regular Tasks
1. **Monitor Email Delivery** - Check for failed sends
2. **Update Signatures** - Keep contact information current
3. **Review Templates** - Ensure messaging stays relevant
4. **Security Audits** - Regular credential rotation

### Configuration Updates
To update email signatures or templates:
1. Run initialization script with new content
2. Or update directly via Firestore console
3. Changes take effect immediately for new emails

## Success Metrics

### Completed Deliverables ✅
- Professional HTML email receipt system
- Client-specific configuration management
- Gmail integration with dual account support
- Notification system with detailed feedback
- Image attachment generation and optimization
- Template variable substitution system
- Comprehensive error handling and validation
- Root-level modal rendering architecture

**Status**: ✅ **PRODUCTION READY** - System fully operational and tested.
