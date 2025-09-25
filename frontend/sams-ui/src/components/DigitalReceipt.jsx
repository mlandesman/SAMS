import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { formatMXCurrency } from '../utils/numberToWords';
import { sendReceiptEmail } from '../api/email';
import NotificationModal from './NotificationModal';
import { useNotification } from '../hooks/useNotification';
import './DigitalReceipt.css';

/**
 * DigitalReceipt Component - Professional Design System
 * 
 * Professional, clean receipt design using Sandyland Email Branding
 * Features:
 * - Clean white background with subtle brand accent
 * - Professional table-based layout for email compatibility 
 * - Mobile-first responsive design
 * - Touch-friendly interface elements
 * - Maximum 3-color palette for professional appearance
 * Can be exported as JPG/PNG for email or WhatsApp sharing
 */
const DigitalReceipt = ({ 
  transactionData,
  clientData,
  onImageGenerated,
  showPreview = true,
  onEmailSent,
  // Optional external notification handlers (to render at parent level)
  onEmailSuccess = null,
  onEmailError = null
}) => {
  console.log('🧾 [DIGITAL RECEIPT] Component instantiated with props:', {
    hasTransactionData: !!transactionData,
    transactionDataKeys: transactionData ? Object.keys(transactionData) : null
  });
  const receiptRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  
  // Use notification hook
  const { 
    notification, 
    closeNotification, 
    showError, 
    showEmailSuccess
  } = useNotification();

  // Debug: Log notification state changes
  React.useEffect(() => {
    if (notification.isOpen) {
      console.log('🔔 DigitalReceipt notification opened:', notification);
    }
  }, [notification]);

  // Validate that we have required transaction data
  if (!transactionData) {
    console.error('🧾 [DIGITAL RECEIPT] No transaction data provided');
    return (
      <div className="digital-receipt-error">
        <h3>Error: No Transaction Data</h3>
        <p>Cannot generate receipt without transaction data.</p>
      </div>
    );
  }

  console.log('🧾 [DIGITAL RECEIPT] Transaction data received:', transactionData);

  // Validate required fields
  const requiredFields = ['date', 'receiptNumber', 'receivedFrom', 'amount'];
  const missingFields = requiredFields.filter(field => !transactionData[field]);
  
  console.log('🧾 [DIGITAL RECEIPT] Required fields validation:', {
    requiredFields,
    providedFields: Object.keys(transactionData),
    missingFields
  });
  
  if (missingFields.length > 0) {
    console.error('🧾 [DIGITAL RECEIPT] Missing required fields:', missingFields);
    return (
      <div className="digital-receipt-error">
        <h3>Error: Missing Required Data</h3>
        <p>Cannot generate receipt. Missing: {missingFields.join(', ')}</p>
      </div>
    );
  }

  // Extract contact information for email functionality
  const ownerEmails = transactionData.ownerEmails || [];
  const ownerPhone = transactionData.ownerPhone || '';
  const hasContactInfo = ownerEmails.length > 0 || ownerPhone;
  
  console.log('Digital Receipt - Contact info available:', {
    emails: ownerEmails,
    phone: ownerPhone,
    hasContactInfo
  });

  const defaultClient = {
    name: clientData?.basicInfo?.displayName || 'No Client Name Specified',
    logoUrl: '/sandyland-logo.png'  // Use local logo from public folder
  };

  // Use provided data - NO DEFAULTS for transaction data
  const receipt = transactionData;
  const client = { ...defaultClient, ...clientData };

  // Format currency for display using our custom MX$ format
  const formatCurrency = (amount) => {
    return formatMXCurrency(amount);
  };

  // Generate receipt image
  const generateReceiptImage = async () => {
    if (!receiptRef.current) {
      console.error('Receipt ref is null');
      showError('Could not find receipt element to generate image');
      return;
    }

    console.log('Starting image generation...');
    setIsGenerating(true);
    
    try {
      // Wait for fonts and rendering
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('Starting html2canvas capture...');
      
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: true,
        foreignObjectRendering: false
      });

      console.log('Canvas created successfully, size:', canvas.width, 'x', canvas.height);

      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('Canvas has zero dimensions');
      }

      // Create download using canvas toBlob
      canvas.toBlob((blob) => {
        if (!blob) {
          console.error('Failed to create blob');
          showError('Failed to create receipt image');
          return;
        }

        console.log('Blob created successfully, size:', blob.size);
        
        // Create download
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `receipt-${receipt.receiptNumber || 'unknown'}.png`;
        link.href = url;
        link.style.display = 'none';
        document.body.appendChild(link);
        
        console.log('Triggering download...');
        link.click();
        
        // Cleanup
        setTimeout(() => {
          if (document.body.contains(link)) {
            document.body.removeChild(link);
          }
          URL.revokeObjectURL(url);
        }, 100);
        
        console.log('Download completed successfully');
        
        // Call callback if provided
        if (onImageGenerated) {
          onImageGenerated(blob);
        }
        
      }, 'image/png', 1.0);

    } catch (error) {
      console.error('Error generating receipt image:', error);
      showError(`Error generating receipt: ${error.message}`);
    } finally {
      setIsGenerating(false);
      console.log('Image generation process finished');
    }
  };

  // Generate and send receipt via email
  const sendReceiptViaEmail = async () => {
    if (!receiptRef.current) {
      showError('Receipt Error', 'Receipt not ready for sending. Please try again.');
      return;
    }

    if (!hasContactInfo) {
      showError('Email Error', 'No email addresses found for this unit owner. Please check the unit contact information.');
      return;
    }

    console.log('Starting email send process...');
    setIsSendingEmail(true);
    
    try {
      // Wait for fonts and rendering
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('Generating receipt image for email...');
      
      // Optimize canvas generation for better email size
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: null,
        scale: 1.5, // Reduced from 2 to 1.5 for smaller file size
        useCORS: true,
        allowTaint: true,
        logging: false,
        foreignObjectRendering: false,
        width: receiptRef.current.offsetWidth,
        height: receiptRef.current.offsetHeight,
        // Add quality optimization
        pixelRatio: 1
      });

      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('Failed to generate receipt image');
      }

      // Convert canvas to base64 with JPEG compression for smaller size
      const receiptImageBase64 = canvas.toDataURL('image/jpeg', 0.85); // 85% quality JPEG
      
      console.log('Sending email via API...');
      
      // Send email using the client ID from clientData
      const clientId = clientData?.id;
      if (!clientId) {
        console.error('No client ID provided - cannot send receipt email');
        throw new Error('No client selected. Cannot send receipt email.');
      }
      const emailResult = await sendReceiptEmail(clientId, transactionData, receiptImageBase64, clientData);
      
      if (emailResult.success) {
        console.log('📧 Email sent successfully, showing success notification...');
        console.log('Email result:', emailResult);
        
        // Use external handler if provided, otherwise use internal notification
        if (onEmailSuccess) {
          onEmailSuccess(
            emailResult.recipients || [],
            emailResult.cc || [],
            transactionData.unitId || 'N/A',
            formatMXCurrency(transactionData.amount)
          );
        } else {
          showEmailSuccess(
            emailResult.recipients || [],
            emailResult.cc || [],
            transactionData.unitId || 'N/A',
            formatMXCurrency(transactionData.amount)
          );
        }
        
        // Call callback if provided
        if (onEmailSent) {
          onEmailSent(emailResult);
        }
      } else {
        console.log('❌ Email failed, showing error notification...');
        
        // Use external handler if provided, otherwise use internal notification
        if (onEmailError) {
          onEmailError(`Failed to send receipt email: ${emailResult.error}`);
        } else {
          showError(
            'Email Failed', 
            `Failed to send receipt email: ${emailResult.error}`,
            [{ label: 'Error Details', value: emailResult.error }]
          );
        }
      }
    } catch (error) {
      console.error('Error sending receipt email:', error);
      
      // Use external handler if provided, otherwise use internal notification
      if (onEmailError) {
        onEmailError(`An unexpected error occurred while sending the email: ${error.message}`);
      } else {
        showError(
          'Email Error', 
          'An unexpected error occurred while sending the email.',
          [{ label: 'Error Details', value: error.message }]
        );
      }
    } finally {
      setIsSendingEmail(false);
    }
  };

  console.log('🧾 [DIGITAL RECEIPT] Rendering receipt component...');

  return (
    <div className="digital-receipt-container">
      {showPreview && (
        <div className="receipt-controls">
          <h3>Professional Digital Receipt</h3>
          
          {/* Contact Information Display */}
          {hasContactInfo && (
            <div className="contact-info-section">
              <h4>📧 Email & Contact Information Ready</h4>
              {ownerEmails.length > 0 && (
                <div className="contact-emails">
                  <strong>Email addresses ({ownerEmails.length}):</strong>
                  <ul>
                    {ownerEmails.map((email, index) => (
                      <li key={index}>{email}</li>
                    ))}
                  </ul>
                </div>
              )}
              {ownerPhone && (
                <div className="contact-phone">
                  <strong>Phone:</strong> {ownerPhone}
                </div>
              )}
              <div className="email-ready-status">
                ✅ Ready for email integration
              </div>
            </div>
          )}
          
          {!hasContactInfo && (
            <div className="contact-info-warning">
              ⚠️ No email or phone information available for this unit
            </div>
          )}
          
          {/* Email Sending Actions */}
          {hasContactInfo && (
            <div className="email-actions">
              <button 
                onClick={sendReceiptViaEmail}
                disabled={isSendingEmail}
                className="send-email-button primary"
              >
                {isSendingEmail ? '📧 Sending Email...' : '📧 Send Receipt via Email'}
              </button>
            </div>
          )}
          
          {/* Image Generation Action */}
          <button 
            onClick={generateReceiptImage}
            disabled={isGenerating}
            className="generate-button secondary"
          >
            {isGenerating ? 'Generating...' : '💾 Save Receipt Image'}
          </button>
          
          {/* Future Actions */}
          {hasContactInfo && ownerPhone && (
            <div className="future-actions">
              <button className="whatsapp-button disabled" disabled>
                📱 WhatsApp (Coming Soon)
              </button>
            </div>
          )}
        </div>
      )}

      <div 
        ref={receiptRef} 
        className="receipt-image"
        style={{
          width: '600px',
          height: '900px',
          position: showPreview ? 'relative' : 'absolute',
          top: showPreview ? 'auto' : '-9999px'
        }}
      >
        {/* Professional Clean Background */}
        <div className="receipt-background">
          
          {/* Professional Header with Clean Branding */}
          <div className="receipt-header">
            <div className="company-branding">
              <img 
                src={client.logoUrl} 
                alt="Sandyland Properties Logo" 
                className="company-logo"
                onLoad={() => console.log('Sandyland logo loaded successfully')}
                onError={() => console.log('Sandyland logo failed to load')}
              />
              <h1 className="company-name">{client.name}</h1>
            </div>
            <h2 className="receipt-title">Recibo de Pago / Payment Receipt</h2>
          </div>

          {/* Professional Table-Based Receipt Content - Email Compatible */}
          <div className="receipt-body">
            <table className="receipt-table" cellPadding="0" cellSpacing="0">
              <tbody>
                <tr>
                  <td className="label">Fecha / Date:</td>
                  <td className="value">{receipt.date}</td>
                </tr>
                <tr>
                  <td className="label">No. de Transacción / Transaction No.:</td>
                  <td className="value receipt-number">{receipt.receiptNumber}</td>
                </tr>
                <tr>
                  <td className="label">Recibí de / Received From:</td>
                  <td className="value owner-name">{receipt.receivedFrom}</td>
                </tr>
                <tr>
                  <td className="label">Unidad / Unit:</td>
                  <td className="value">{receipt.unitId}</td>
                </tr>
                <tr className="amount-row">
                  <td className="label">Cantidad / Amount:</td>
                  <td className="value amount" style={{ textAlign: 'left', fontWeight: 'bold', fontSize: '2em' }}>{formatCurrency(receipt.amount)}</td>
                </tr>
                <tr>
                  <td className="label">Por concepto de / For:</td>
                  <td className="value">{receipt.category}</td>
                </tr>
                <tr>
                  <td className="label">Forma de Pago / Payment Method:</td>
                  <td className="value">{receipt.paymentMethod}</td>
                </tr>
                {receipt.notes && (
                  <tr>
                    <td className="label">Notas / Notes:</td>
                    <td className="value notes">{receipt.notes}</td>
                  </tr>
                )}
              </tbody>
            </table>
            
            {/* Professional Amount in Words Section */}
            <div className="amount-in-words">
              <strong>Cantidad en Letras / Amount in Words:</strong>
              <em>{receipt.amountInWords}</em>
            </div>
          </div>

          {/* Professional Footer with Portal Integration */}
          <div className="receipt-footer">
            <div className="receipt-footer-text">
              Gracias por su pago puntual. / Thank you for your prompt payment.
            </div>
            {/* Future portal link integration */}
            <div style={{ margin: '16px 0', fontSize: '12px', color: '#666' }}>
              📊 View your account history in SAMS portal
            </div>
          </div>
        </div>
      </div>

      {/* Notification Modal - only render if external handlers not provided */}
      {!onEmailSuccess && !onEmailError && (
        <NotificationModal
          isOpen={notification.isOpen}
          onClose={closeNotification}
          type={notification.type}
          title={notification.title}
          message={notification.message}
          details={notification.details}
        />
      )}
    </div>
  );
};

export default DigitalReceipt;
