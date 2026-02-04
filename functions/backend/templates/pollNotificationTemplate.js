/**
 * Poll/Vote Notification Email Template
 * Used to send voting invitations to unit owners
 */

/**
 * Generate poll notification email HTML
 * @param {Object} options
 * @param {string} options.clientName - Name of the HOA/condo association
 * @param {string} options.clientLogoUrl - Logo URL (optional)
 * @param {string} options.ownerName - Name of the unit owner(s) for personalized greeting
 * @param {string} options.pollTitle - Title of the poll/vote
 * @param {string} options.pollDescription - Description of the poll
 * @param {string} options.pollType - 'vote' or 'poll'
 * @param {string} options.closesAt - Formatted close date
 * @param {string} options.voteUrl - URL with token for voting
 * @param {string} options.unitId - Unit identifier
 * @param {Array<{name: string, url: string}>} options.documents - Attached documents
 * @param {string} options.language - 'english' or 'spanish'
 * @returns {string} HTML email content
 */
export function generatePollNotificationHtml(options) {
  const {
    clientName = 'Your HOA',
    clientLogoUrl,
    ownerName = 'Owner',
    pollTitle,
    pollDescription,
    pollType = 'vote',
    closesAt,
    voteUrl,
    unitId,
    documents = [],
    language = 'english'
  } = options;

  const isSpanish = language === 'spanish' || language === 'es';
  
  // Build personalized greeting with owner name
  const greetingName = ownerName && ownerName !== 'Owner' 
    ? ownerName 
    : (isSpanish ? 'Propietario' : 'Owner');

  const labels = {
    greeting: isSpanish ? `Estimado/a ${greetingName}` : `Dear ${greetingName}`,
    intro: isSpanish
      ? `Se le invita a participar en ${pollType === 'vote' ? 'una votacion' : 'una encuesta'} de ${clientName}.`
      : `You are invited to participate in a ${pollType === 'vote' ? 'vote' : 'poll'} from ${clientName}.`,
    unit: isSpanish ? 'Unidad' : 'Unit',
    deadline: isSpanish ? 'Fecha limite' : 'Deadline',
    reviewDocs: isSpanish ? 'Documentos para Revisar' : 'Documents to Review',
    reviewHint: isSpanish
      ? 'Por favor revise los siguientes documentos antes de votar:'
      : 'Please review the following documents before voting:',
    openDoc: isSpanish ? 'Abrir' : 'Open',
    voteButton: isSpanish
      ? (pollType === 'vote' ? 'Votar Ahora' : 'Responder Encuesta')
      : (pollType === 'vote' ? 'Vote Now' : 'Respond to Poll'),
    clickLink: isSpanish
      ? 'Si el boton no funciona, copie y pegue el siguiente enlace en su navegador:'
      : 'If the button does not work, copy and paste the following link in your browser:',
    footer: isSpanish
      ? 'Este enlace es unico para su unidad. No lo comparta con otros.'
      : 'This link is unique to your unit. Do not share it with others.',
    thankYou: isSpanish ? 'Gracias por su participacion.' : 'Thank you for your participation.',
    regards: isSpanish ? 'Saludos,' : 'Best regards,'
  };

  const documentsSection = documents.length > 0 ? `
    <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0369a1;">
        ${labels.reviewDocs}
      </h3>
      <p style="margin: 0 0 12px 0; font-size: 13px; color: #0c4a6e;">
        ${labels.reviewHint}
      </p>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${documents.map(doc => `
          <a href="${doc.url}" target="_blank" rel="noopener noreferrer"
             style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #ffffff; border: 1px solid #e0f2fe; border-radius: 6px; text-decoration: none; color: #0369a1; font-size: 13px;">
            <span style="flex: 1;">${doc.name}</span>
            <span style="font-size: 12px; color: #0284c7;">${labels.openDoc} ↗</span>
          </a>
        `).join('')}
      </div>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="${isSpanish ? 'es' : 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pollTitle}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
      ${clientLogoUrl ? `<img src="${clientLogoUrl}" alt="${clientName}" style="max-width: 120px; max-height: 60px; margin-bottom: 12px; object-fit: contain;">` : ''}
      <h1 style="margin: 0; font-size: 20px; font-weight: 600;">${clientName}</h1>
    </div>
    
    <!-- Body -->
    <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
      
      <!-- Greeting -->
      <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151;">
        ${labels.greeting},
      </p>
      
      <p style="margin: 0 0 20px 0; font-size: 15px; color: #374151;">
        ${labels.intro}
      </p>
      
      <!-- Poll Info Box -->
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <h2 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #111827;">
          ${pollTitle}
        </h2>
        ${pollDescription ? `<p style="margin: 0 0 12px 0; font-size: 14px; color: #4b5563; line-height: 1.5;">${pollDescription}</p>` : ''}
        <div style="display: flex; flex-wrap: wrap; gap: 16px; font-size: 13px; color: #6b7280;">
          <span><strong>${labels.unit}:</strong> ${unitId}</span>
          <span><strong>${labels.deadline}:</strong> ${closesAt}</span>
        </div>
      </div>
      
      ${documentsSection}
      
      <!-- Vote Button -->
      <div style="text-align: center; margin: 24px 0;">
        <a href="${voteUrl}" target="_blank" rel="noopener noreferrer"
           style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
          ${labels.voteButton}
        </a>
      </div>
      
      <p style="margin: 16px 0 0 0; font-size: 12px; color: #9ca3af; text-align: center;">
        ${labels.clickLink}
      </p>
      <p style="margin: 4px 0 16px 0; font-size: 11px; color: #2563eb; word-break: break-all; text-align: center;">
        ${voteUrl}
      </p>
      
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
      
      <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280;">
        ${labels.footer}
      </p>
      
      <p style="margin: 16px 0 0 0; font-size: 14px; color: #374151;">
        ${labels.thankYou}
      </p>
      
      <p style="margin: 8px 0 0 0; font-size: 14px; color: #374151;">
        ${labels.regards}<br>
        <strong>${clientName}</strong>
      </p>
      
    </div>
    
    <!-- Footer -->
    <div style="background: #f9fafb; padding: 16px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
      <p style="margin: 0; font-size: 11px; color: #9ca3af;">
        ${isSpanish ? 'Mensaje enviado por' : 'Message sent by'} ${clientName} ${isSpanish ? 'via' : 'via'} Sandyland Asset Management System
      </p>
    </div>
    
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text version of poll notification
 */
export function generatePollNotificationText(options) {
  const {
    clientName = 'Your HOA',
    ownerName = 'Owner',
    pollTitle,
    pollDescription,
    pollType = 'vote',
    closesAt,
    voteUrl,
    unitId,
    documents = [],
    language = 'english'
  } = options;

  const isSpanish = language === 'spanish' || language === 'es';
  
  // Build personalized greeting with owner name
  const greetingName = ownerName && ownerName !== 'Owner' 
    ? ownerName 
    : (isSpanish ? 'Propietario' : 'Owner');

  const lines = [
    isSpanish ? `Estimado/a ${greetingName},` : `Dear ${greetingName},`,
    '',
    isSpanish
      ? `Se le invita a participar en ${pollType === 'vote' ? 'una votacion' : 'una encuesta'} de ${clientName}.`
      : `You are invited to participate in a ${pollType === 'vote' ? 'vote' : 'poll'} from ${clientName}.`,
    '',
    `${pollTitle}`,
    pollDescription ? `${pollDescription}` : '',
    '',
    `${isSpanish ? 'Unidad' : 'Unit'}: ${unitId}`,
    `${isSpanish ? 'Fecha limite' : 'Deadline'}: ${closesAt}`,
    ''
  ];

  if (documents.length > 0) {
    lines.push(isSpanish ? 'Documentos para revisar:' : 'Documents to review:');
    documents.forEach(doc => {
      lines.push(`- ${doc.name}: ${doc.url}`);
    });
    lines.push('');
  }

  lines.push(
    isSpanish ? 'Para votar, visite:' : 'To vote, visit:',
    voteUrl,
    '',
    isSpanish
      ? 'Este enlace es unico para su unidad. No lo comparta con otros.'
      : 'This link is unique to your unit. Do not share it with others.',
    '',
    isSpanish ? 'Gracias por su participacion.' : 'Thank you for your participation.',
    '',
    isSpanish ? 'Saludos,' : 'Best regards,',
    clientName
  );

  return lines.join('\n');
}
