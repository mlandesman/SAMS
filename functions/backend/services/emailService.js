/**
 * Email Service for SAMS User Management
 * Handles user invitations and password reset notifications
 * Uses existing Sandyland email infrastructure with professional branding
 */

import nodemailer from 'nodemailer';
import { logError } from '../../shared/logger.js';

/**
 * Get Gmail transporter for health checks. Returns null if not configured.
 * @returns {object|null} Nodemailer transporter or null
 */
export function getTransporter() {
  try {
    return createGmailTransporter();
  } catch {
    return null;
  }
}

/**
 * Create Gmail transporter using existing Sandyland configuration
 * @returns {object} Nodemailer transporter
 */
function createGmailTransporter() {
  // Using existing Gmail SMTP configuration from digital receipts
  const gmailUser = process.env.GMAIL_USER || 'michael@landesman.com';
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  
  console.log('🔧 Creating Gmail transporter with user:', gmailUser);
  console.log('🔧 Gmail password configured:', gmailPass ? 'Yes' : 'No');
  
  if (!gmailPass) {
    const error = new Error('GMAIL_APP_PASSWORD environment variable not set');
    console.error('❌ Email configuration error:', error.message);
    throw error;
  }
  
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailPass
    }
  });
}

/**
 * Professional Sandyland email signature with logo and contact info
 */
const SANDYLAND_SIGNATURE = `
<div style="margin-top: 20px; font-family: Tahoma, Arial, sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; margin: 0;">
    <tr>
      <td style="padding: 0 16px 0 0; vertical-align: top;">
        <!-- Logo -->
        <img src="https://cdn.signaturehound.com/users/1i998hnkklfejv8/43fbac1f-010c-4cd0-b0f9-615220e29fd7.png" 
             alt="Marina Turquesa Logo" 
             width="100" 
             height="100" 
             style="display: block; border: 0; border-radius: 8px;">
      </td>
      
      <!-- Vertical divider -->
      <td style="padding: 0 16px; border-left: 4px solid #007bff; vertical-align: top;">
      </td>
      
      <td style="padding: 0; vertical-align: top;">
        <!-- Contact Information -->
        <table cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
          <tr>
            <td style="padding-bottom: 3px;">
              <div style="font-size: 16px; font-weight: bold; color: #333; margin: 0; line-height: .9;">
                Michael y Sandra Landesman
              </div>
              <div style="font-size: 14px; color: #888; margin: 0; line-height: .9;">
                Administradores
              </div>
            </td>
          </tr>
          
          <!-- Email -->
          <tr>
            <td style="padding: 0;">
              <table cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                <tr>
                  <td style="padding-right: 6px; vertical-align: middle;">
                    <img src="https://cdn.signaturehound.com/icons/email_default_00d2ff.png" 
                         alt="Email" 
                         width="16" 
                         height="16" 
                         style="display: block; border: 0;">
                  </td>
                  <td style="vertical-align: middle;">
                    <a href="mailto:ms@landesman.com" 
                       style="color: #007bff; text-decoration: none; font-size: 14px; line-height: .9;">
                      ms@landesman.com
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Phone/WhatsApp -->
          <tr>
            <td style="padding: 0;">
              <table cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                <tr>
                  <td style="padding-right: 6px; vertical-align: middle;">
                    <img src="https://cdn.signaturehound.com/icons/mobile_default_00d2ff.png" 
                         alt="Phone" 
                         width="16" 
                         height="16" 
                         style="display: block; border: 0;">
                  </td>
                  <td style="vertical-align: middle;">
                    <a href="tel:+529841780331" 
                       style="color: #007bff; text-decoration: none; font-size: 14px; line-height: .9;">
                      +52 98 41 78 03 31 WhatsApp
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Address -->
          <tr>
            <td style="padding: 0;">
              <table cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                <tr>
                  <td style="padding-right: 6px; vertical-align: top;">
                    <img src="https://cdn.signaturehound.com/icons/map_default_00d2ff.png" 
                         alt="Location" 
                         width="16" 
                         height="16" 
                         style="display: block; border: 0;">
                  </td>
                  <td style="vertical-align: top;">
                    <a href="https://goo.gl/maps/LZGN41nxDnVGqTV99" 
                       style="color: #007bff; text-decoration: none; font-size: 14px; line-height: .9;">
                      Caleta Yalkú 9, PH4D<br>
                      Puerto Aventuras, Solidaridad, QROO 77733
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  
  <!-- Reduced spacer -->
  <div style="height: 15px;"></div>
</div>`;

/**
 * Sandyland email configuration (matching digital receipts)
 */
const SANDYLAND_EMAIL_CONFIG = {
  fromEmail: 'michael@sandyland.com.mx',
  fromName: 'Sandyland Properties',
  replyTo: 'pm@sandyland.com.mx',
  ccList: ['pm@sandyland.com.mx']
};

/**
 * Send passkey invite email with registration link.
 * @param {object} params
 * @param {string} params.email - Recipient email
 * @param {string} params.name - Recipient display name
 * @param {string} params.inviteUrl - Passkey registration URL (/invite/:token)
 */
export async function sendPasskeyInvite({ email, name, inviteUrl }) {
  try {
    const emailTransporter = createGmailTransporter();
    const samsUrl = process.env.FRONTEND_URL || 'https://sams.sandyland.com.mx';
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sandyland Asset Management - Account Setup</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .info-box { background: white; padding: 15px; border-left: 4px solid #007bff; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏡 Welcome to Sandyland Asset Management</h1>
          </div>
          
          <div class="content">
            <h2>Hi ${name},</h2>
            
            <p>You've been invited to join the Sandyland Asset Management System (SAMS).</p>
            
            <p>To set up your account, click the button below. You'll be asked to register a passkey using your device's biometrics (Face ID, Touch ID, or fingerprint).</p>
            
            <div style="text-align: center;">
              <a href="${inviteUrl}" class="button">Register Your Passkey</a>
            </div>
            
            <div style="background: #fff3cd; padding: 15px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <strong>🔄 What Happens Next:</strong><br/>
              1. Click "Register Your Passkey" above<br/>
              2. Your device will prompt you for biometric verification (Face ID, Touch ID, or fingerprint)<br/>
              3. Once registered, click "Sign In to SAMS" to sign in<br/>
              4. Future sign-ins: visit <a href="${samsUrl}">${samsUrl}</a> and use your passkey
            </div>
            
            <p><strong>⚠️ Important:</strong></p>
            <ul>
              <li><strong>Expires in 72 hours:</strong> This link must be used within 72 hours.</li>
              <li><strong>Single use:</strong> The link can only be used once to register a passkey.</li>
              <li><strong>Device required:</strong> Use a device with biometric support (iPhone, iPad, Mac with Touch ID, etc.).</li>
            </ul>
            
            <p>If you have any questions or need a new invite link, contact your property administrator.</p>
            
            <div class="footer">
              <p><strong>Sandyland Asset Management System</strong><br>
              This is an automated message. Please do not reply to this email.<br>
              For support, contact us using the information below.</p>
            </div>
          </div>
        </div>
        
        ${SANDYLAND_SIGNATURE}
      </body>
      </html>
    `;

    const textContent = `
Welcome to Sandyland Asset Management System!

Hi ${name},

You've been invited to join the Sandyland Asset Management System (SAMS).

To set up your account, visit the link below to register your passkey:
${inviteUrl}

What happens next:
1. Open the link above
2. Your device will prompt for biometric verification (Face ID, Touch ID, or fingerprint)
3. Once registered, click "Sign In to SAMS" to sign in
4. Future sign-ins: visit ${samsUrl} and use your passkey

Important:
- This link expires in 72 hours
- It can only be used once
- Use a device with biometric support

If you need assistance, contact your property administrator.

---
Sandyland Asset Management System
This is an automated message. Please do not reply.
    `;

    const mailOptions = {
      from: {
        name: SANDYLAND_EMAIL_CONFIG.fromName,
        address: SANDYLAND_EMAIL_CONFIG.fromEmail
      },
      to: email,
      cc: SANDYLAND_EMAIL_CONFIG.ccList,
      replyTo: SANDYLAND_EMAIL_CONFIG.replyTo,
      subject: `🏡 Sandyland Asset Management - Set Up Your Account`,
      text: textContent,
      html: htmlContent
    };

    const result = await emailTransporter.sendMail(mailOptions);
    
    return {
      success: true,
      messageId: result.messageId,
    };

  } catch (error) {
    logError('Failed to send passkey invite email:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send manual password notification email
 */
export async function sendPasswordNotification({ email, name, password, clientName, role, createdBy }) {
  const displayName = (name && String(name).trim()) || email || 'User';
  console.log('📧 sendPasswordNotification called with:', { email, name: displayName, clientName, role, createdBy, passwordLength: password?.length });
  
  try {
    console.log('🔧 Creating Gmail transporter for password notification...');
    const emailTransporter = createGmailTransporter();
    console.log('✅ Gmail transporter created successfully');
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sandyland Asset Management - Your Account Access</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .password-box { background: #fff3cd; border: 2px solid #ffc107; padding: 15px; border-radius: 4px; margin: 20px 0; text-align: center; }
          .info-box { background: white; padding: 15px; border-left: 4px solid #007bff; margin: 20px 0; }
          .warning { background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 4px; margin: 15px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏡 Welcome to Sandyland Asset Management</h1>
          </div>
          
          <div class="content">
            <h2>Hi ${displayName},</h2>
            
            <p>Your account for the Sandyland Asset Management System (SAMS) has been created by <strong>${createdBy}</strong>.</p>
            
            <div class="info-box">
              <strong>Your Account Details:</strong><br>
              📧 <strong>Email:</strong> ${email}<br>
              🏢 <strong>Property:</strong> ${clientName}<br>
              👤 <strong>Role:</strong> ${role}<br>
            </div>
            
            <div class="password-box">
              <h3>🔑 Your Temporary Password</h3>
              <code style="font-size: 18px; font-weight: bold; background: white; padding: 8px 16px; border-radius: 4px; display: inline-block; letter-spacing: 1px;">${password}</code>
            </div>
            
            <div class="warning">
              <strong>⚠️ Important Security Notice:</strong>
              <ul style="margin: 10px 0;">
                <li>This is a <strong>temporary password</strong> for your first login only</li>
                <li>You will be required to change it immediately upon signing in</li>
                <li>Please delete this email after setting your new password</li>
                <li>Never share your password with anyone</li>
                <li>Choose a strong, unique password for your new account</li>
              </ul>
            </div>
            
            <p><strong>Getting Started:</strong></p>
            <ol>
              <li>Visit: <a href="${process.env.FRONTEND_URL || 'https://sams.sandyland.com.mx'}">${process.env.FRONTEND_URL || 'https://sams.sandyland.com.mx'}</a></li>
              <li>Sign in with your email and the temporary password above</li>
              <li>You'll be prompted to create a new, secure password</li>
              <li>Start managing your property account!</li>
            </ol>
            
            <p>If you have any questions or need assistance with your account setup, please don't hesitate to contact us using the information below.</p>
            
            <p>Welcome to Sandyland Properties!</p>
            
            <div class="footer">
              <p><strong>Sandyland Asset Management System</strong><br>
              This is an automated message. Please do not reply to this email.<br>
              For support, contact us using the information below.</p>
            </div>
          </div>
        </div>
        
        ${SANDYLAND_SIGNATURE}
      </body>
      </html>
    `;

    const textContent = `
Welcome to Sandyland Asset Management System!

Hi ${displayName},

Your SAMS account has been created by ${createdBy}.

Account Details:
- Email: ${email}
- Client: ${clientName}
- Role: ${role}

TEMPORARY PASSWORD: ${password}

IMPORTANT SECURITY NOTICE:
- This is a temporary password
- You will be prompted to change it on first login
- Please delete this email after setting your new password
- Never share your password with anyone

Getting Started:
1. Visit: ${process.env.FRONTEND_URL || 'http://localhost:3000'}
2. Sign in with your email and temporary password
3. Create a new, secure password when prompted
4. Start using SAMS!

If you need assistance, contact your administrator.

Welcome to the team!

---
Sandyland Asset Management System
This is an automated message. Please do not reply.
    `;

    const mailOptions = {
      from: {
        name: SANDYLAND_EMAIL_CONFIG.fromName,
        address: SANDYLAND_EMAIL_CONFIG.fromEmail
      },
      to: email,
      cc: SANDYLAND_EMAIL_CONFIG.ccList,
      replyTo: SANDYLAND_EMAIL_CONFIG.replyTo,
      subject: `🏡 Your Sandyland SAMS Account - Login Details`,
      text: textContent,
      html: htmlContent
    };

    const result = await emailTransporter.sendMail(mailOptions);
    console.log('✅ Password notification email sent successfully:', result.messageId);
    
    return {
      success: true,
      messageId: result.messageId
    };

  } catch (error) {
    console.error('❌ Failed to send password notification email:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test email configuration
 */
export async function testEmailConfig() {
  try {
    const emailTransporter = createGmailTransporter();
    const result = await emailTransporter.verify();
    console.log('✅ Email configuration is valid');
    return { success: true };
  } catch (error) {
    console.error('❌ Email configuration test failed:', error);
    return { success: false, error: error.message };
  }
}