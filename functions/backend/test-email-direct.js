/**
 * Direct Email Test - Bypass Authentication for Testing
 * Run this script to test email functionality directly
 */

import nodemailer from 'nodemailer';

// Test Gmail configuration
async function testDirectEmail() {
  try {
    console.log('🧪 Testing direct email sending...');
    
    // Gmail configuration (using same as production)
    const gmailUser = process.env.GMAIL_USER || 'michael@landesman.com';
    const gmailPass = process.env.GMAIL_APP_PASSWORD;
    
    console.log('📧 Using Gmail user:', gmailUser);
    console.log('🔑 Gmail password configured:', gmailPass ? 'Yes' : 'NO - MISSING');
    
    if (!gmailPass) {
      console.error('❌ GMAIL_APP_PASSWORD not set. Cannot test email.');
      console.log('💡 Set environment variable: export GMAIL_APP_PASSWORD=your_app_password');
      return;
    }
    
    // Create transporter
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPass
      }
    });
    
    // Test email configuration
    console.log('🔧 Testing transporter...');
    await transporter.verify();
    console.log('✅ Gmail transporter verified successfully');
    
    // Send test email
    const testEmail = {
      from: `SAMS Test <${gmailUser}>`,
      to: 'michael@landesman.com',
      subject: 'SAMS Email Test - Professional Receipt System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #00b8d4 0%, #00d2ff 100%); padding: 20px; text-align: center; color: white;">
            <h1 style="margin: 0;">Sandyland Properties</h1>
            <p style="margin: 5px 0 0 0;">Marina Turquesa Condominiums</p>
          </div>
          
          <div style="padding: 20px; background: #fff;">
            <h2 style="color: #2c3e50;">Email System Test - SUCCESS! ✅</h2>
            
            <p>This confirms that the SAMS email infrastructure is working properly:</p>
            
            <ul style="line-height: 1.6;">
              <li><strong>Gmail SMTP:</strong> Connected and authenticated</li>
              <li><strong>Professional Styling:</strong> Clean design implemented</li>
              <li><strong>Email Delivery:</strong> Successfully reaching michael@landesman.com</li>
              <li><strong>Template System:</strong> HTML formatting working</li>
            </ul>
            
            <div style="background: #ecf0f1; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0; color: #00b8d4;">Next Steps:</h3>
              <p style="margin: 0;">The receipt email system is ready for testing. Use the Receipt Demo at /receipt-demo to send professional receipt emails.</p>
            </div>
          </div>
          
          <div style="background: #ecf0f1; padding: 15px; text-align: center; font-size: 14px; color: #666;">
            <p style="margin: 0;">SAMS Professional Email System | Sandyland Properties</p>
          </div>
        </div>
      `
    };
    
    console.log('📤 Sending test email...');
    const result = await transporter.sendMail(testEmail);
    console.log('✅ Test email sent successfully!');
    console.log('📧 Message ID:', result.messageId);
    console.log('📬 Check michael@landesman.com for the test email');
    
  } catch (error) {
    console.error('❌ Email test failed:', error);
    
    if (error.code === 'EAUTH') {
      console.log('🔑 Authentication failed. Check Gmail App Password:');
      console.log('   1. Go to https://myaccount.google.com/apppasswords');
      console.log('   2. Generate new app password for "SAMS Email System"');
      console.log('   3. Set environment variable: export GMAIL_APP_PASSWORD=generated_password');
    } else if (error.code === 'ECONNECTION') {
      console.log('🌐 Connection failed. Check internet connectivity and Gmail SMTP access.');
    }
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testDirectEmail();
}

export { testDirectEmail };