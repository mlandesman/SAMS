/**
 * PDF Service
 * Converts HTML to PDF using Puppeteer
 */

import puppeteer from 'puppeteer';

/**
 * Generate PDF from HTML content
 * @param {string} htmlContent - Complete HTML document
 * @param {Object} options - PDF generation options
 * @returns {Buffer} PDF buffer
 */
export async function generatePdf(htmlContent, options = {}) {
  let browser = null;
  
  try {
    // Launch browser in headless mode
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set viewport to ensure proper rendering
    await page.setViewport({
      width: 816, // 8.5 inches at 96 DPI
      height: 1056, // 11 inches at 96 DPI
      deviceScaleFactor: 1
    });
    
    // Set content and wait for resources to load
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    // Wait a moment for any dynamic content to settle
    await page.waitForTimeout(500);
    
    // Generate PDF
    const pdf = await page.pdf({
      format: options.format || 'Letter',
      printBackground: true,
      margin: {
        top: options.marginTop || '0.5in',
        right: options.marginRight || '0.5in',
        bottom: options.marginBottom || '0.5in',
        left: options.marginLeft || '0.5in'
      },
      displayHeaderFooter: false,
      preferCSSPageSize: false,
      scale: 1.0
    });
    
    await browser.close();
    browser = null;
    
    return pdf;
    
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    throw new Error(`PDF generation failed: ${error.message}`);
  }
}

