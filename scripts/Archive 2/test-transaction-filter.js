#!/usr/bin/env node

/**
 * Test script to verify Transaction view filter defaults to Current Month
 * This tests the fix for DESK-TRANS-001
 */

import puppeteer from 'puppeteer';

const FRONTEND_URL = 'http://localhost:5173';
const TEST_EMAIL = process.argv[2];
const TEST_PASSWORD = process.argv[3];

if (!TEST_EMAIL || !TEST_PASSWORD) {
  console.error('Usage: node test-transaction-filter.js <email> <password>');
  process.exit(1);
}

async function testTransactionFilter() {
  const browser = await puppeteer.launch({ 
    headless: false, // Set to true for automated testing
    devtools: true 
  });
  
  try {
    const page = await browser.newPage();
    
    // Clear localStorage to ensure clean test
    await page.goto(FRONTEND_URL);
    await page.evaluate(() => {
      localStorage.clear();
      console.log('Cleared localStorage');
    });
    
    // Navigate to login
    await page.goto(`${FRONTEND_URL}/login`);
    console.log('📍 Navigated to login page');
    
    // Wait for login form
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    
    // Login
    await page.type('input[type="email"]', TEST_EMAIL);
    await page.type('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    console.log('✅ Logged in');
    
    // Wait for redirect to dashboard
    await page.waitForNavigation();
    await page.waitForTimeout(2000);
    
    // Navigate to transactions
    await page.goto(`${FRONTEND_URL}/transactions`);
    console.log('📍 Navigated to transactions view');
    
    // Wait for transactions to load
    await page.waitForSelector('.transaction-table, .transactions-table', { timeout: 10000 });
    await page.waitForTimeout(2000); // Give time for data to load
    
    // Check the filter label
    const filterLabel = await page.evaluate(() => {
      // Try multiple selectors
      const selectors = [
        '.date-toggle-btn',
        '.filter-label-with-count',
        '.date-range-dropdown button',
        '[class*="date-range"] button',
        '[class*="filter"] button'
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          console.log(`Found filter element with selector: ${selector}`);
          console.log(`Filter text: ${element.textContent}`);
          return element.textContent.trim();
        }
      }
      
      // If no filter button found, check for any element showing date range
      const allButtons = Array.from(document.querySelectorAll('button'));
      for (const btn of allButtons) {
        if (btn.textContent.includes('Month') || btn.textContent.includes('Year') || btn.textContent.includes('Time')) {
          console.log(`Found potential filter button: ${btn.textContent}`);
          return btn.textContent.trim();
        }
      }
      
      return 'Filter not found';
    });
    
    console.log(`\n🔍 Current filter label: "${filterLabel}"`);
    
    // Check transaction dates
    const transactionData = await page.evaluate(() => {
      const rows = document.querySelectorAll('tr[id^="txn-row-"], .transaction-row, tbody tr');
      const transactions = [];
      
      rows.forEach(row => {
        // Try to find date in various formats
        const cells = row.querySelectorAll('td');
        for (const cell of cells) {
          const text = cell.textContent;
          // Look for date patterns (MM/DD/YYYY, YYYY-MM-DD, etc.)
          if (text.match(/\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}/)) {
            transactions.push({
              date: text.trim(),
              rowText: row.textContent.substring(0, 100)
            });
            break;
          }
        }
      });
      
      return {
        count: transactions.length,
        firstFive: transactions.slice(0, 5),
        allDates: transactions.map(t => t.date)
      };
    });
    
    console.log(`\n📊 Transaction data:`);
    console.log(`   Total transactions displayed: ${transactionData.count}`);
    
    if (transactionData.count > 0) {
      // Analyze dates
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      const datesByMonth = {};
      transactionData.allDates.forEach(dateStr => {
        const date = new Date(dateStr);
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        datesByMonth[monthYear] = (datesByMonth[monthYear] || 0) + 1;
      });
      
      console.log(`\n   Transactions by month:`);
      Object.entries(datesByMonth).sort().forEach(([monthYear, count]) => {
        console.log(`     ${monthYear}: ${count} transactions`);
      });
      
      // Check if showing only current month
      const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
      const onlyCurrentMonth = Object.keys(datesByMonth).length === 1 && datesByMonth[currentMonthKey];
      
      console.log(`\n   First 5 transactions:`);
      transactionData.firstFive.forEach((t, i) => {
        console.log(`     ${i + 1}. ${t.date}`);
      });
      
      // Test results
      console.log('\n📋 TEST RESULTS:');
      console.log('─'.repeat(50));
      
      const filterShowsCurrentMonth = filterLabel.toLowerCase().includes('current month');
      const dataIsCurrentMonthOnly = onlyCurrentMonth;
      
      if (filterShowsCurrentMonth && dataIsCurrentMonthOnly) {
        console.log('✅ PASS: Filter shows "Current Month" and data matches');
      } else if (filterShowsCurrentMonth && !dataIsCurrentMonthOnly) {
        console.log('⚠️  PARTIAL: Filter shows "Current Month" but data includes other months');
      } else if (!filterShowsCurrentMonth) {
        console.log(`❌ FAIL: Filter shows "${filterLabel}" instead of "Current Month"`);
      }
      
      console.log(`\n   Filter Label: ${filterShowsCurrentMonth ? '✅' : '❌'} ${filterLabel}`);
      console.log(`   Data Match: ${dataIsCurrentMonthOnly ? '✅' : '❌'} ${onlyCurrentMonth ? 'Only current month' : 'Multiple months'}`);
    } else {
      console.log('⚠️  No transactions found - may need to add test data');
    }
    
    console.log('\n💡 To manually verify:');
    console.log('   1. Check that filter shows "Current Month"');
    console.log('   2. Verify only current month transactions are displayed');
    console.log('   3. Test other filter options work correctly');
    
    // Keep browser open for manual inspection
    console.log('\n🔍 Browser will remain open for manual inspection.');
    console.log('   Press Ctrl+C to close when done.');
    
    await new Promise(() => {}); // Keep process alive
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await browser.close();
    process.exit(1);
  }
}

// Run the test
testTransactionFilter().catch(console.error);