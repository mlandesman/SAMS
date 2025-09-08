// Visual Testing Helper for IAs
// Allows IAs to take screenshots of their UI work

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

class VisualTester {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1280, height: 800 });
  }

  async captureScreen(url, filename = 'screenshot.png') {
    try {
      if (!this.browser) await this.initialize();
      
      console.log(`📸 Navigating to ${url}...`);
      await this.page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // Wait a bit for React to render
      await this.page.waitForTimeout(2000);
      
      const screenshotPath = path.join('/tmp', filename);
      await this.page.screenshot({ 
        path: screenshotPath,
        fullPage: true 
      });
      
      console.log(`✅ Screenshot saved to ${screenshotPath}`);
      
      // Also capture any console errors
      const errors = [];
      this.page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      return {
        success: true,
        path: screenshotPath,
        errors
      };
    } catch (error) {
      console.error('❌ Screenshot failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async testComponent(componentPath) {
    // Test specific component/page
    const baseUrl = 'http://localhost:3000';
    const paths = {
      'water-bills': '/water-bills',
      'hoa-dues': '/hoa',
      'dashboard': '/dashboard',
      'login': '/login'
    };
    
    const url = baseUrl + (paths[componentPath] || componentPath);
    return await this.captureScreen(url, `${componentPath}-test.png`);
  }

  async checkElement(selector) {
    try {
      const element = await this.page.$(selector);
      if (element) {
        const box = await element.boundingBox();
        console.log(`✅ Element ${selector} found at:`, box);
        return true;
      } else {
        console.log(`❌ Element ${selector} NOT FOUND`);
        return false;
      }
    } catch (error) {
      console.log(`❌ Error checking ${selector}:`, error.message);
      return false;
    }
  }

  async getPageText() {
    try {
      const text = await this.page.evaluate(() => document.body.innerText);
      return text;
    } catch (error) {
      return 'Could not get page text: ' + error.message;
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Usage example for IAs:
async function testWaterBillsUI() {
  const tester = new VisualTester();
  
  try {
    // Take screenshot of water bills page
    const result = await tester.captureScreen(
      'http://localhost:3000/water-bills',
      'water-bills-ui.png'
    );
    
    if (result.success) {
      console.log('Screenshot saved. Check if:');
      console.log('1. Page loads without errors');
      console.log('2. Components are visible');
      console.log('3. Data is displayed');
      
      // Check for specific elements
      await tester.checkElement('.water-bills-container');
      await tester.checkElement('.bills-table');
      await tester.checkElement('.water-history-grid');
      
      // Get page text to see if data loaded
      const pageText = await tester.getPageText();
      console.log('Page contains:', pageText.substring(0, 500));
    }
    
    if (result.errors?.length > 0) {
      console.log('⚠️ Console errors detected:', result.errors);
    }
    
  } finally {
    await tester.cleanup();
  }
}

// Export for use in tests
export { VisualTester, testWaterBillsUI };

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testWaterBillsUI().catch(console.error);
}