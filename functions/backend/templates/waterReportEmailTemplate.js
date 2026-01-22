/**
 * Water Report Email Template
 * Generates notification-style email HTML for Water Consumption Report
 * Gmail-safe HTML with inline styles only
 */

/**
 * Generate notification-style email HTML for Water Consumption Report
 * @param {Object} data - Email data
 * @param {string} language - 'es' or 'en' (default: 'es')
 * @returns {string} - Gmail-safe HTML
 */
export function generateWaterReportEmailHtml(data, language = 'es') {
  const isSpanish = language === 'es' || language === 'spanish';
  
  // Extract data with defaults
  const {
    unitNumber = '',
    ownerNames = '',
    fiscalYear = '',
    asOfDate = '',
    ytdConsumption = 0,
    ytdCharges = 0,
    dailyAverage = 0,
    percentile = null,
    logoUrl = null,
    brandColor = '#1a365d',
    contactEmail = '',
    contactPhone = '',
    prependText = null
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
  
  // Format consumption (m³)
  const formatConsumption = (consumption) => {
    return consumption.toLocaleString('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    });
  };
  
  // Single-language labels (based on user preference)
  const labels = {
    title: isSpanish ? 'REPORTE DE CONSUMO DE AGUA' : 'WATER CONSUMPTION REPORT',
    greeting: isSpanish ? 'Estimado propietario,' : 'Dear Owner,',
    intro: isSpanish 
      ? 'Adjuntamos su reporte de consumo de agua para la unidad'
      : 'Please find attached your water consumption report for unit',
    summary: isSpanish ? 'RESUMEN' : 'SUMMARY',
    ytdUsage: isSpanish ? 'Consumo del Año:' : 'Year-to-Date Usage:',
    ytdCharges: isSpanish ? 'Cargos del Año:' : 'Year-to-Date Charges:',
    dailyAvg: isSpanish ? 'Promedio Diario:' : 'Daily Average:',
    percentileLabel: isSpanish ? 'Comparación:' : 'Comparison:',
    percentileText: isSpanish 
      ? (percentile !== null ? `Su consumo está en el percentil ${percentile} comparado con otras unidades.` : '')
      : (percentile !== null ? `Your consumption is in the ${percentile}th percentile compared to other units.` : ''),
    attachmentNote: isSpanish 
      ? '📎 Su reporte completo está adjunto a este correo electrónico.'
      : '📎 Your complete report is attached to this email.',
    questions: isSpanish ? '¿Preguntas?' : 'Questions?',
    contact: isSpanish ? 'Contáctenos:' : 'Contact us:'
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
              <img src="${logoUrl}" alt="Logo" style="max-width: 200px; height: auto; display: block; margin: 0 auto;" onerror="this.style.display='none';">
            </td>
          </tr>
        </table>
        ` : ''}
        
        <!-- Prepend Message (custom text added by admin) -->
        ${prependText && prependText.trim() ? `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
          <tr>
            <td style="background: #fff8e1; padding: 16px 20px; border-radius: 8px; border-left: 4px solid #ffc107;">
              <p style="margin: 0; color: #333; line-height: 1.6; font-size: 14px;">${prependText.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>
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
        
        <!-- Greeting -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
          <tr>
            <td style="font-size: 14px; color: #333333; line-height: 1.6;">
              ${labels.greeting}<br><br>
              ${labels.intro} <strong>${unitNumber}</strong>.
            </td>
          </tr>
        </table>
        
        <!-- Summary Section -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px; border-top: 1px solid #ddd;">
          <tr>
            <td style="padding-top: 15px;">
              <div style="font-size: 12px; font-weight: bold; color: #666666; text-transform: uppercase; margin-bottom: 10px;">
                ${labels.summary}
              </div>
              
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px; color: #333333;">
                <tr>
                  <td style="padding: 5px 0;">${labels.ytdUsage}</td>
                  <td style="text-align: right; padding: 5px 0; font-weight: bold;">${formatConsumption(ytdConsumption)} m³</td>
                </tr>
                <tr>
                  <td style="padding: 5px 0;">${labels.ytdCharges}</td>
                  <td style="text-align: right; padding: 5px 0; font-weight: bold;">${formatCurrency(ytdCharges)}</td>
                </tr>
                <tr>
                  <td style="padding: 5px 0;">${labels.dailyAvg}</td>
                  <td style="text-align: right; padding: 5px 0; font-weight: bold; color: ${brandColor};">${formatConsumption(dailyAverage)} m³/día</td>
                </tr>
                ${percentile !== null ? `
                <tr>
                  <td colspan="2" style="padding: 10px 0; border-top: 1px solid #ddd; font-size: 12px; color: #666666;">
                    ${labels.percentileText}
                  </td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>
        </table>
        
        <!-- Attachment Notice -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
          <tr>
            <td style="font-size: 14px; color: #333333; line-height: 1.6; padding: 15px 0;">
              ${labels.attachmentNote}
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
        ${labels.questions}<br>
        ${labels.contact}<br>
        ${contactEmail ? `<a href="mailto:${contactEmail}" style="color: ${brandColor}; text-decoration: none;">${contactEmail}</a>` : ''}
        ${contactPhone ? `<br>${contactPhone}` : ''}
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
  
  return html;
}
