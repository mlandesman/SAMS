/**
 * Statement Email Template
 * Generates notification-style email HTML for Statement of Account
 * Gmail-safe HTML with inline styles only
 */

/**
 * Generate notification-style email HTML for Statement of Account
 * @param {Object} data - Email data
 * @param {string} language - 'es' or 'en' (default: 'es')
 * @returns {string} - Gmail-safe HTML
 */
export function generateStatementEmailHtml(data, language = 'es') {
  const isSpanish = language === 'es' || language === 'spanish';
  
  // Extract data with defaults
  const {
    unitNumber = '',
    ownerNames = '',
    fiscalYear = '',
    asOfDate = '',
    balanceDue = 0,
    creditBalance = 0,
    netAmount = 0,
    bankName = '',
    bankAccount = '',
    bankClabe = '',
    beneficiary = '',
    reference = '',
    logoUrl = null,
    brandColor = '#1a365d',
    pdfDownloadUrlEn = '',
    pdfDownloadUrlEs = ''
  } = data;
  
  // Format currency
  const formatCurrency = (amount) => {
    const absAmount = Math.abs(amount);
    const formatted = absAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return amount < 0 ? `-$${formatted}` : `$${formatted}`;
  };
  
  // Single-language labels (based on user preference)
  const labels = {
    title: isSpanish ? 'ESTADO DE CUENTA' : 'STATEMENT OF ACCOUNT',
    fiscalYear: isSpanish ? 'Año Fiscal' : 'Fiscal Year',
    date: isSpanish ? 'Fecha' : 'Date',
    financialSummary: isSpanish ? 'RESUMEN FINANCIERO' : 'FINANCIAL SUMMARY',
    balanceDue: isSpanish ? 'Saldo Pendiente:' : 'Balance Due:',
    credit: isSpanish ? 'Crédito Disponible:' : 'Credit:',
    netAmount: isSpanish ? 'MONTO NETO:' : 'NET AMOUNT:',
    paymentInfo: isSpanish ? 'INFORMACIÓN DE PAGO' : 'PAYMENT INFORMATION',
    bank: isSpanish ? 'Banco:' : 'Bank:',
    account: isSpanish ? 'Cuenta:' : 'Account:',
    clabe: 'CLABE:',
    beneficiaryLabel: isSpanish ? 'Beneficiario:' : 'Beneficiary:',
    referenceLabel: isSpanish ? 'Referencia:' : 'Reference:',
    attachmentNote: isSpanish 
      ? '📎 Su estado de cuenta completo está adjunto a este correo electrónico.'
      : '📎 Your complete statement is attached to this email.',
    downloadPdf: isSpanish ? '📄 DESCARGAR PDF' : '📄 DOWNLOAD PDF',
    questions: isSpanish ? '¿Preguntas?' : 'Questions?'
  };
  
  // Build HTML with Gmail-safe inline styles
  const html = `
<!DOCTYPE html>
<html lang="${isSpanish ? 'es' : 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${labels.title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <!-- Top Color Bar -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${brandColor};">
    <tr>
      <td style="height: 8px; background-color: ${brandColor};"></td>
    </tr>
  </table>
  
  <!-- Main Content Container -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <tr>
      <td style="padding: 20px;">
        
        <!-- Logo -->
        ${logoUrl && logoUrl.trim() ? `
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="text-align: center; padding-bottom: 20px;">
              <img src="${logoUrl}" alt="${data.clientName || ''}" style="max-width: 200px; height: auto; display: block; margin: 0 auto;" onerror="this.style.display='none';">
            </td>
          </tr>
        </table>
        ` : ''}
        
        <!-- Title Section -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
          <tr>
            <td style="text-align: center; padding: 15px 0; border-top: 2px solid #333; border-bottom: 2px solid #333;">
              <div style="font-size: 18px; font-weight: bold; color: #333333;">${labels.title}</div>
            </td>
          </tr>
        </table>
        
        <!-- Unit Info -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
          <tr>
            <td style="font-size: 14px; color: #333333; line-height: 1.6;">
              <strong>${isSpanish ? 'Depto' : 'Unit'} ${unitNumber}</strong> - ${ownerNames}<br>
              ${labels.fiscalYear} ${fiscalYear}<br>
              ${labels.date}: ${asOfDate}
            </td>
          </tr>
        </table>
        
        <!-- Financial Summary -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px; border-top: 1px solid #ddd;">
          <tr>
            <td style="padding-top: 15px;">
              <div style="font-size: 12px; font-weight: bold; color: #666666; text-transform: uppercase; margin-bottom: 10px;">
                ${labels.financialSummary}
              </div>
              
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px; color: #333333;">
                <tr>
                  <td style="padding: 5px 0;">${labels.balanceDue}</td>
                  <td style="text-align: right; padding: 5px 0; font-weight: bold;">${formatCurrency(balanceDue)}</td>
                </tr>
                <tr>
                  <td style="padding: 5px 0;">${labels.credit}</td>
                  <td style="text-align: right; padding: 5px 0; color: #28a745;">(${formatCurrency(Math.abs(creditBalance))})</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding: 10px 0; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-weight: bold; font-size: 16px;">${labels.netAmount}</td>
                        <td style="text-align: right; font-weight: bold; font-size: 16px; color: ${brandColor};">${formatCurrency(netAmount)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        
        <!-- Payment Information -->
        ${bankName || bankAccount || bankClabe || beneficiary ? `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px; border-top: 1px solid #ddd;">
          <tr>
            <td style="padding-top: 15px;">
              <div style="font-size: 12px; font-weight: bold; color: #666666; text-transform: uppercase; margin-bottom: 10px;">
                ${labels.paymentInfo}
              </div>
              
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px; color: #333333; line-height: 1.0;">
                ${bankName ? `
                <tr>
                  <td style="padding: 2px 0; width: 120px;"><strong>${labels.bank}</strong></td>
                  <td style="padding: 2px 0;">${bankName}</td>
                </tr>
                ` : ''}
                ${bankAccount ? `
                <tr>
                  <td style="padding: 2px 0;"><strong>${labels.account}</strong></td>
                  <td style="padding: 2px 0;">${bankAccount}</td>
                </tr>
                ` : ''}
                ${bankClabe ? `
                <tr>
                  <td style="padding: 2px 0;"><strong>${labels.clabe}</strong></td>
                  <td style="padding: 2px 0;">${bankClabe}</td>
                </tr>
                ` : ''}
                ${beneficiary ? `
                <tr>
                  <td style="padding: 2px 0;"><strong>${labels.beneficiaryLabel}</strong></td>
                  <td style="padding: 2px 0;">${beneficiary}</td>
                </tr>
                ` : ''}
                ${reference ? `
                <tr>
                  <td style="padding: 2px 0;"><strong>${labels.referenceLabel}</strong></td>
                  <td style="padding: 2px 0;">${reference}</td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>
        </table>
        ` : ''}
        
        <!-- Attachment Notice -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
          <tr>
            <td style="font-size: 14px; color: #333333; line-height: 1.6; padding: 15px 0;">
              ${labels.attachmentNote}
            </td>
          </tr>
        </table>
        
        <!-- Download Buttons (Both languages always available) -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
          <tr>
            <td style="text-align: center;">
              ${pdfDownloadUrlEs ? `
              <a href="${pdfDownloadUrlEs}" style="display: inline-block; padding: 12px 24px; background-color: ${brandColor}; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 5px; font-size: 14px;">
                ${isSpanish ? '📄 DESCARGAR PDF' : '📄 DOWNLOAD PDF'}<br>
                <span style="font-size: 11px; font-weight: normal;">${isSpanish ? '(Español)' : '(Spanish)'}</span>
              </a>
              ` : ''}
              ${pdfDownloadUrlEn ? `
              <a href="${pdfDownloadUrlEn}" style="display: inline-block; padding: 12px 24px; background-color: ${brandColor}; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 5px; font-size: 14px;">
                ${isSpanish ? '📄 DESCARGAR PDF' : '📄 DOWNLOAD PDF'}<br>
                <span style="font-size: 11px; font-weight: normal;">${isSpanish ? '(Inglés)' : '(English)'}</span>
              </a>
              ` : ''}
            </td>
          </tr>
        </table>
        
      </td>
    </tr>
  </table>
  
  <!-- Bottom Color Bar -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${brandColor};">
    <tr>
      <td style="height: 4px; background-color: ${brandColor};"></td>
    </tr>
  </table>
  
  <!-- Footer -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <tr>
      <td style="padding: 20px; text-align: center; font-size: 12px; color: #666666;">
        ${data.clientName || ''}<br>
        ${labels.questions} ${data.contactEmail || 'pm@sandyland.com.mx'}
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
  
  return html;
}
