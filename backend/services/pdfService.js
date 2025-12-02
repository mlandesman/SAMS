/**
 * PDF Service
 * Converts HTML to PDF using PDFShift API
 * 
 * PDFShift provides superior paged-media support including:
 * - Dynamic page numbering (Page n of N)
 * - Repeating footers on every page
 * - Better page break control
 * - @page CSS margin boxes
 */

// Using built-in fetch (Node 18+) - no import needed

/**
 * Generate PDF from HTML content using PDFShift.
 * @param {string} htmlContent - Complete HTML document
 * @param {Object} options - { format?: string, footerMeta?: { statementId?: string, generatedAt?: string, language?: string } }
 * @returns {Buffer} PDF buffer
 */
export async function generatePdf(htmlContent, options = {}) {
  try {
    const apiKey = process.env.PDFSHIFT_KEY || 'sk_c93fd189fc28f71a4791805e8e3ec5af92672997';
    
    if (!apiKey) {
      throw new Error('PDFSHIFT_KEY not configured in environment');
    }
    
    const {
      format = 'Letter',
      footerMeta = {}
    } = options;
    const sandboxEnv = process.env.PDFSHIFT_SANDBOX;
    // Keep sandbox mode enabled by default per PDFShift guidance (https://docs.pdfshift.io/#sandbox)
    const useSandbox = sandboxEnv === undefined ? true : sandboxEnv === 'true';
    
    const {
      statementId = '',
      generatedAt = '',
      language = 'english'
    } = footerMeta;
    
    const languageCode = (language || '').toLowerCase();
    const isSpanish = languageCode === 'spanish' || languageCode === 'es';
    
    const footerHtml = `
      <div style="
        font-size:10px;
        line-height:1.3;
        font-family:Arial, sans-serif;
        border-top:1px solid #bbb;
        width:calc(100% - 0.6in);
        max-width:7.4in;
        margin:0 auto;
        padding:6px 20px 14px 20px;
        box-sizing:border-box;
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:18px;
      ">
        <span style="white-space:nowrap;">
          ${isSpanish ? `ID del Estado de Cuenta: ${statementId}` : `Statement ID: ${statementId}`}
        </span>
        <span style="text-align:center; flex:0 0 auto;">
          ${isSpanish ? 'Página <span class="pageNumber"></span> de <span class="totalPages"></span>' : 'Page <span class="pageNumber"></span> of <span class="totalPages"></span>'}
        </span>
        <span style="text-align:right; white-space:nowrap;">
          ${isSpanish ? `Generado: ${generatedAt}` : `Generated: ${generatedAt}`}
        </span>
      </div>
    `.trim();
    
    // Call PDFShift API
    const response = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from('api:' + apiKey).toString('base64')
      },
      body: JSON.stringify({
        source: htmlContent,
        sandbox: useSandbox,
        use_print: true,
        landscape: false,
        format,
        margin: {
          top: '15mm',
          right: '15mm',
          bottom: '2mm', // Restored for footer space
          left: '15mm'
        },
        footer: {
          source: footerHtml,
          height: '10mm',
          start_at: 1,
          spacing: '2mm'
        }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PDFShift API error ${response.status}: ${errorText}`);
    }
    
    // Return PDF buffer
    const pdfBuffer = Buffer.from(await response.arrayBuffer());
    return pdfBuffer;
    
  } catch (error) {
    throw new Error(`PDF generation failed: ${error.message}`);
  }
}

