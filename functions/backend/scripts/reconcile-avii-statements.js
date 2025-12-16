/**
 * AVII Statement Reconciliation Script
 * 
 * Compares Sheets data (source of truth) with SAMS data (target system)
 * Uses fuzzy matching with date and amount tolerances
 * Generates comprehensive reconciliation reports
 * 
 * Usage:
 *   node backend/scripts/reconcile-avii-statements.js [unit-id]
 * 
 * Example:
 *   node backend/scripts/reconcile-avii-statements.js 101
 *   node backend/scripts/reconcile-avii-statements.js  # all units
 */

import { loadUnitSheetsData, loadAllSheetsData } from './load-sheets-data.js';
import { testHarness } from '../testing/testHarness.js';
import { loadUnitSAMSData, loadAllSAMSData } from './load-sams-statement-data.js';
import { writeFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

const OUTPUT_DIR = '/Users/michael/Projects/SAMS-Docs/docs/AVII-Reconciliation';
const FISCAL_YEAR = 2026;

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Calculate string similarity (Levenshtein-based, normalized to 0-1)
 */
function stringSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;
  
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  // Exact match after normalization
  if (s1 === s2) return 1;
  
  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  
  // Simple word overlap
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  const commonWords = words1.filter(w => words2.includes(w));
  if (commonWords.length > 0) {
    const overlap = commonWords.length / Math.max(words1.length, words2.length);
    if (overlap > 0.5) return overlap;
  }
  
  // Levenshtein distance
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix = [];
  
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return maxLen === 0 ? 1 : 1 - (distance / maxLen);
}

/**
 * Check if two dates are within tolerance
 */
function datesWithinTolerance(date1, date2, toleranceDays = 5) {
  if (!date1 || !date2) return false;
  
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;
  
  const diffDays = Math.abs((d1 - d2) / (1000 * 60 * 60 * 24));
  return diffDays <= toleranceDays;
}

/**
 * Check if two amounts are within tolerance
 */
function amountsWithinTolerance(amount1, amount2, tolerance = 0.01) {
  if (amount1 === null || amount2 === null) return false;
  
  const diff = Math.abs(Math.abs(amount1) - Math.abs(amount2));
  
  // Absolute tolerance for small amounts
  if (Math.abs(amount1) < 100) {
    return diff <= tolerance;
  }
  
  // Percentage tolerance for large amounts (0.1%)
  const percentTolerance = Math.abs(amount1) * 0.001;
  return diff <= Math.max(tolerance, percentTolerance);
}

/**
 * Match transactions between Sheets and SAMS
 */
/**
 * Normalize category names for matching
 */
function normalizeCategory(category) {
  if (!category) return 'Other';
  
  const cat = category.toLowerCase();
  
  // HOA Dues variations
  if (cat.includes('mantenimiento') || cat.includes('hoa') || cat.includes('hoa dues')) {
    return 'HOA Dues';
  }
  
  // Water variations (including car/boat washes which are part of water bills)
  if (cat.includes('agua') || cat.includes('water') || cat.includes('consumption') || 
      cat.includes('lavado')) {
    return 'Water Bills';
  }
  
  // Penalties
  if (cat.includes('penalty') || cat.includes('cargo') || cat.includes('late')) {
    return 'Penalties';
  }
  
  // Payments (negative amounts)
  if (cat.includes('payment') || cat === 'payments') {
    return 'Payments';
  }
  
  return 'Other';
}

function matchTransactions(sheetsTxns, samsTxns, options = {}) {
  const {
    dateTolerance = 5, // days
    amountTolerance = 0.01, // absolute or percentage
    reconciliationDate = null // Filter SAMS transactions after this date
  } = options;
  
  // Filter SAMS transactions by reconciliation date if provided
  let filteredSAMS = samsTxns;
  if (reconciliationDate) {
    const cutoff = new Date(reconciliationDate);
    cutoff.setHours(23, 59, 59, 999);
    filteredSAMS = samsTxns.filter(txn => {
      const txnDate = new Date(txn.date);
      return txnDate <= cutoff;
    });
  }
  
  const matched = [];
  const unmatchedSheets = [];
  const unmatchedSAMS = [];
  
  // Track which transactions have been matched
  const sheetsMatched = new Set();
  const samsMatched = new Set();
  
  // First pass: Try one-to-one matches (exact date + category + amount)
  for (let s = 0; s < sheetsTxns.length; s++) {
    if (sheetsMatched.has(s)) continue;
    
    const sheetsTxn = sheetsTxns[s];
    let bestMatch = null;
    let bestIndex = -1;
    let bestScore = 0;
    
    for (let a = 0; a < filteredSAMS.length; a++) {
      if (samsMatched.has(a)) continue;
      
      const samsTxn = filteredSAMS[a];
      
      // Check date tolerance
      const dateMatch = datesWithinTolerance(sheetsTxn.date, samsTxn.date, dateTolerance);
      if (!dateMatch) continue;
      
      // Check category match
      const sheetsCategory = normalizeCategory(sheetsTxn.category);
      const samsCategory = normalizeCategory(samsTxn.category);
      const categoryMatch = sheetsCategory === samsCategory;
      
      // Check if it's a charge/payment match (same category, opposite signs)
      const isChargePaymentMatch = categoryMatch && 
        ((sheetsTxn.amount > 0 && samsTxn.amount < 0) || 
         (sheetsTxn.amount < 0 && samsTxn.amount > 0));
      
      // Or same category, same sign (regular match)
      const isRegularMatch = categoryMatch && 
        ((sheetsTxn.amount > 0 && samsTxn.amount > 0) || 
         (sheetsTxn.amount < 0 && samsTxn.amount < 0));
      
      if (!isChargePaymentMatch && !isRegularMatch) continue;
      
      // Check amount tolerance (compare absolute values)
      const amountMatch = amountsWithinTolerance(
        Math.abs(sheetsTxn.amount), 
        Math.abs(samsTxn.amount), 
        amountTolerance
      );
      if (!amountMatch) continue;
      
      // Calculate score
      const dateScore = dateMatch ? 0.4 : 0;
      const categoryScore = categoryMatch ? 0.3 : 0;
      const amountScore = amountMatch ? 0.3 : 0;
      const score = dateScore + categoryScore + amountScore;
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = samsTxn;
        bestIndex = a;
      }
    }
    
    if (bestMatch) {
      sheetsMatched.add(s);
      samsMatched.add(bestIndex);
      
      matched.push({
        sheets: [sheetsTxn],
        sams: bestMatch,
        matchScore: bestScore,
        matchType: 'one-to-one',
        dateDiff: Math.abs((new Date(sheetsTxn.date) - new Date(bestMatch.date)) / (1000 * 60 * 60 * 24)),
        amountDiff: Math.abs(Math.abs(sheetsTxn.amount) - Math.abs(bestMatch.amount))
      });
    }
  }
  
  // Second pass: Group water transactions by fiscal quarter, then match to SAMS
  // User's logic: All water-related bills (Consumo de agua, Lavado de autos, Lavado de barcos, 
  // Cargo por pago atrasado) are grouped and summed by fiscal quarter:
  // Q1 = 07/2025-09/2025, Q2 = 10/2025-12/2025, Q3 = 01/2026-03/2026, Q4 = 04/2026-06/2026
  
  // Helper: Get fiscal quarter from date (fiscal year starts July)
  function getFiscalQuarter(dateStr) {
    // Parse date string (YYYY-MM-DD format)
    const date = new Date(dateStr + 'T12:00:00'); // Use noon to avoid timezone issues
    const month = date.getMonth(); // 0-11
    const year = date.getFullYear();
    
    // Fiscal Q1 = Jul-Sep (months 6-8) of calendar year
    // Fiscal Q2 = Oct-Dec (months 9-11) of calendar year
    // Fiscal Q3 = Jan-Mar (months 0-2) of calendar year (next fiscal year)
    // Fiscal Q4 = Apr-Jun (months 3-5) of calendar year (next fiscal year)
    
    if (month >= 6 && month <= 8) {
      // Jul, Aug, Sep = Q1
      return { quarter: 1, year };
    } else if (month >= 9 && month <= 11) {
      // Oct, Nov, Dec = Q2
      return { quarter: 2, year };
    } else if (month >= 0 && month <= 2) {
      // Jan, Feb, Mar = Q3
      return { quarter: 3, year };
    } else {
      // Apr, May, Jun = Q4
      return { quarter: 4, year };
    }
  }
  
  // Helper: Check if transaction is water-related
  // Categories: Consumo de agua, Lavado de autos, Lavado de barcos, Cargo por pago atrasado
  function isWaterRelated(txn) {
    const cat = (txn.category || '').toLowerCase();
    const desc = (txn.description || '').toLowerCase();
    
    // Check category and description for water-related terms
    const isWater = cat.includes('agua') || cat.includes('water') || cat.includes('consumption') ||
                    cat.includes('lavado') || desc.includes('lavado') ||
                    cat.includes('cargo') || desc.includes('cargo') ||
                    cat.includes('penalty') || desc.includes('penalty') ||
                    cat.includes('late') || desc.includes('late');
    
    // Also check if normalizeCategory would classify it as Water Bills
    const normalized = normalizeCategory(txn.category);
    return isWater || normalized === 'Water Bills';
  }
  
  // Step 1: Group unmatched Sheets water transactions by fiscal quarter
  // Separate charges (positive) from payments (negative) for matching
  const sheetsWaterByQuarter = new Map(); // key: "Q1-2025", value: { charges: [], payments: [], totalCharges: 0, totalPayments: 0 }
  
  // Debug: Track if we should log (for unit 101)
  const DEBUG_UNIT = process.env.DEBUG_UNIT === '101' || process.argv.includes('101');
  
  if (DEBUG_UNIT) {
    console.log('\n🔍 DEBUG: Water Transaction Grouping');
    console.log('='.repeat(70));
  }
  
  for (let s = 0; s < sheetsTxns.length; s++) {
    if (sheetsMatched.has(s)) continue;
    
    const sheetsTxn = sheetsTxns[s];
    const isWater = isWaterRelated(sheetsTxn);
    
    if (DEBUG_UNIT && isWater) {
      console.log(`\n📋 Sheets Transaction ${s}:`);
      console.log(`   Date: ${sheetsTxn.date}`);
      console.log(`   Category: ${sheetsTxn.category}`);
      console.log(`   Description: ${sheetsTxn.description}`);
      console.log(`   Amount: $${sheetsTxn.amount.toFixed(2)}`);
      console.log(`   Is Water Related: ${isWater}`);
    }
    
    if (!isWater) continue;
    
    const { quarter, year } = getFiscalQuarter(sheetsTxn.date);
    const key = `Q${quarter}-${year}`;
    
    if (DEBUG_UNIT) {
      console.log(`   → Grouped into: ${key} (${sheetsTxn.amount >= 0 ? 'CHARGE' : 'PAYMENT'})`);
    }
    
    if (!sheetsWaterByQuarter.has(key)) {
      sheetsWaterByQuarter.set(key, { 
        charges: [], 
        payments: [], 
        totalCharges: 0, 
        totalPayments: 0,
        quarter, 
        year 
      });
    }
    
    const quarterData = sheetsWaterByQuarter.get(key);
    if (sheetsTxn.amount >= 0) {
      // Charge (positive amount)
      quarterData.charges.push({ index: s, txn: sheetsTxn });
      quarterData.totalCharges += sheetsTxn.amount;
    } else {
      // Payment (negative amount)
      quarterData.payments.push({ index: s, txn: sheetsTxn });
      quarterData.totalPayments += sheetsTxn.amount; // Keep negative
    }
  }
  
  if (DEBUG_UNIT) {
    console.log('\n📊 Aggregated Quarters:');
    for (const [key, data] of sheetsWaterByQuarter.entries()) {
      console.log(`\n   ${key}:`);
      console.log(`   Charges: ${data.charges.length} transactions, Total: $${data.totalCharges.toFixed(2)}`);
      data.charges.forEach((item, idx) => {
        console.log(`     C${idx + 1}. ${item.txn.date} | ${item.txn.category} | ${item.txn.description} | $${item.txn.amount.toFixed(2)}`);
      });
      console.log(`   Payments: ${data.payments.length} transactions, Total: $${data.totalPayments.toFixed(2)}`);
      data.payments.forEach((item, idx) => {
        console.log(`     P${idx + 1}. ${item.txn.date} | ${item.txn.category} | ${item.txn.description} | $${item.txn.amount.toFixed(2)}`);
      });
    }
  }
  
  // Step 2: Match SAMS water bills to aggregated Sheets quarters
  if (DEBUG_UNIT) {
    console.log('\n🔍 DEBUG: SAMS Water Bill Matching');
    console.log('='.repeat(70));
  }
  
  for (let a = 0; a < filteredSAMS.length; a++) {
    if (samsMatched.has(a)) continue;
    
    const samsTxn = filteredSAMS[a];
    const samsCategory = normalizeCategory(samsTxn.category);
    
    if (samsCategory !== 'Water Bills') continue;
    
    const samsDate = new Date(samsTxn.date);
    const samsAmount = samsTxn.amount; // Preserve sign
    
    if (DEBUG_UNIT) {
      console.log(`\n💧 SAMS Water Bill ${a}:`);
      console.log(`   Date: ${samsTxn.date}`);
      console.log(`   Description: ${samsTxn.description}`);
      console.log(`   Amount: $${samsAmount.toFixed(2)}`);
    }
    
    // Try to determine which quarter this SAMS bill is for
    // Option 1: Parse from description (e.g., "Water Bill Q1 2025")
    const samsDesc = (samsTxn.description || '').toLowerCase();
    let targetQuarter = null;
    let targetYear = null;
    
    const qMatch = samsDesc.match(/q([1-4])\s*(\d{4})?/);
    if (qMatch) {
      targetQuarter = parseInt(qMatch[1]);
      targetYear = qMatch[2] ? parseInt(qMatch[2]) : samsDate.getFullYear();
      if (DEBUG_UNIT) {
        console.log(`   → Parsed from description: Q${targetQuarter} ${targetYear}`);
      }
    } else {
      // Option 2: Try to parse month name from description (e.g., "June Water Bill")
      const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                          'july', 'august', 'september', 'october', 'november', 'december'];
      const monthAbbr = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
                          'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      
      let foundMonth = -1;
      for (let i = 0; i < monthNames.length; i++) {
        if (samsDesc.includes(monthNames[i]) || samsDesc.includes(monthAbbr[i])) {
          foundMonth = i; // 0-11
          break;
        }
      }
      
      if (foundMonth >= 0) {
        const samsMonth = samsDate.getMonth(); // Month of the bill date (0-11)
        
        // Special case: If bill is dated in July (month 6) and mentions June (month 5),
        // it's a Q1 charge for the fiscal year starting in that July
        // Example: "June Water Bill" dated July 23, 2025 → Q1 2026 (fiscal year starting July 2025)
        if (samsMonth === 6 && foundMonth === 5) { // July bill for June consumption
          targetQuarter = 1;
          targetYear = samsDate.getFullYear(); // Q1 of fiscal year starting in this July
          if (DEBUG_UNIT) {
            console.log(`   → Special case: July bill for June consumption → Q1 ${targetYear} (fiscal year starting in July)`);
          }
        } else {
          // Determine quarter from month
          // Q1 = Jul-Sep (months 6-8), Q2 = Oct-Dec (9-11), Q3 = Jan-Mar (0-2), Q4 = Apr-Jun (3-5)
          if (foundMonth >= 6 && foundMonth <= 8) {
            targetQuarter = 1;
            targetYear = samsDate.getFullYear();
          } else if (foundMonth >= 9 && foundMonth <= 11) {
            targetQuarter = 2;
            targetYear = samsDate.getFullYear();
          } else if (foundMonth >= 0 && foundMonth <= 2) {
            targetQuarter = 3;
            targetYear = samsDate.getFullYear();
          } else {
            targetQuarter = 4;
            targetYear = samsDate.getFullYear();
          }
          if (DEBUG_UNIT) {
            console.log(`   → Parsed month from description: ${monthNames[foundMonth]} → Q${targetQuarter} ${targetYear}`);
          }
        }
      } else {
        // Option 3: Infer from date (bill date is typically at start of next quarter)
        // If bill is in October, it's for Q1 (Jul-Sep)
        // If bill is in January, it's for Q2 (Oct-Dec)
        // If bill is in April, it's for Q3 (Jan-Mar)
        // If bill is in July, it's for Q4 (Apr-Jun)
        const samsMonth = samsDate.getMonth();
        if (samsMonth === 9) { // October
          targetQuarter = 1;
          targetYear = samsDate.getFullYear();
        } else if (samsMonth === 0) { // January
          targetQuarter = 2;
          targetYear = samsDate.getFullYear() - 1; // Previous calendar year
        } else if (samsMonth === 3) { // April
          targetQuarter = 3;
          targetYear = samsDate.getFullYear();
        } else if (samsMonth === 6) { // July
          targetQuarter = 4;
          targetYear = samsDate.getFullYear();
        } else {
          // Fallback: use quarter of transaction date
          const fiscalQ = getFiscalQuarter(samsTxn.date);
          targetQuarter = fiscalQ.quarter;
          targetYear = fiscalQ.year;
        }
        if (DEBUG_UNIT) {
          console.log(`   → Inferred from date: Q${targetQuarter} ${targetYear} (month ${samsMonth})`);
        }
      }
    }
    
    const quarterKey = `Q${targetQuarter}-${targetYear}`;
    const quarterData = sheetsWaterByQuarter.get(quarterKey);
    
    if (DEBUG_UNIT) {
      console.log(`   → Looking for Sheets quarter: ${quarterKey}`);
      if (quarterData) {
        console.log(`   ✅ Found Sheets quarter data:`);
        console.log(`      Charges: ${quarterData.charges.length} transactions, Total: $${quarterData.totalCharges.toFixed(2)}`);
        console.log(`      Payments: ${quarterData.payments.length} transactions, Total: $${quarterData.totalPayments.toFixed(2)}`);
        console.log(`      SAMS Amount: $${samsAmount.toFixed(2)} (${samsAmount >= 0 ? 'CHARGE' : 'PAYMENT'})`);
      } else {
        console.log(`   ❌ No Sheets quarter data found for ${quarterKey}`);
      }
    }
    
    if (quarterData) {
      // Match charges to charges (positive amounts) or payments to payments (negative amounts)
      let sheetsAmount = null;
      let sheetsTxns = [];
      let sheetsIndices = [];
      
      if (samsAmount >= 0) {
        // SAMS charge - match to Sheets charges
        if (quarterData.charges.length > 0) {
          sheetsAmount = quarterData.totalCharges;
          sheetsTxns = quarterData.charges.map(item => item.txn);
          sheetsIndices = quarterData.charges.map(item => item.index);
        }
      } else {
        // SAMS payment - try line-by-line matching first, then aggregate if needed
        // First, try to match individual payments
        let matchedPayment = false;
        for (const payment of quarterData.payments) {
          if (sheetsMatched.has(payment.index)) continue;
          
          const paymentAmount = payment.txn.amount; // Negative
          const dateMatch = datesWithinTolerance(payment.txn.date, samsTxn.date, dateTolerance * 3);
          const amountMatch = amountsWithinTolerance(Math.abs(paymentAmount), Math.abs(samsAmount), amountTolerance * 10);
          
          if (dateMatch && amountMatch) {
            // One-to-one match found
            if (DEBUG_UNIT) {
              console.log(`   ✅ LINE-BY-LINE MATCH! Matching Sheets payment: ${payment.txn.date} $${paymentAmount.toFixed(2)}`);
            }
            
            sheetsMatched.add(payment.index);
            samsMatched.add(a);
            matchedPayment = true;
            
            matched.push({
              sheets: [payment.txn],
              sams: samsTxn,
              matchScore: 0.9,
              matchType: 'one-to-one',
              dateDiff: Math.abs((new Date(payment.txn.date) - samsDate) / (1000 * 60 * 60 * 24)),
              amountDiff: Math.abs(Math.abs(paymentAmount) - Math.abs(samsAmount))
            });
            break;
          }
        }
        
        // If no line-by-line match, try aggregated match (many-to-one: multiple Sheets payments → one SAMS payment)
        if (!matchedPayment && quarterData.payments.length > 0) {
          // Check if aggregated Sheets payments match SAMS payment
          const aggregatedSheetsAmount = quarterData.totalPayments; // Negative total
          const amountDiff = Math.abs(aggregatedSheetsAmount - samsAmount);
          const amountMatch = amountsWithinTolerance(
            Math.abs(aggregatedSheetsAmount), 
            Math.abs(samsAmount), 
            amountTolerance * 50 // Larger tolerance for aggregated payments that may include credits/refunds
          );
          
          if (amountMatch) {
            // Many-to-one match: multiple Sheets payments match one SAMS payment
            if (DEBUG_UNIT) {
              console.log(`   ✅ AGGREGATED PAYMENT MATCH! Matching ${quarterData.payments.length} Sheets payments (total: $${Math.abs(aggregatedSheetsAmount).toFixed(2)}) to SAMS payment: $${Math.abs(samsAmount).toFixed(2)}`);
            }
            
            sheetsAmount = aggregatedSheetsAmount;
            sheetsTxns = quarterData.payments.map(item => item.txn);
            sheetsIndices = quarterData.payments.map(item => item.index);
          } else {
            sheetsAmount = null; // Amounts don't match, leave unmatched
            if (DEBUG_UNIT) {
              console.log(`   ❌ Aggregated payment amounts don't match: Sheets $${Math.abs(aggregatedSheetsAmount).toFixed(2)} vs SAMS $${Math.abs(samsAmount).toFixed(2)} (diff: $${amountDiff.toFixed(2)})`);
            }
          }
        } else {
          sheetsAmount = null; // Already matched line-by-line
        }
      }
      
      if (sheetsAmount !== null && sheetsTxns.length > 0) {
        const amountDiff = Math.abs(sheetsAmount - samsAmount);
        const amountMatch = amountsWithinTolerance(
          sheetsAmount, 
          samsAmount, 
          amountTolerance * 10 // More tolerance for aggregated amounts
        );
        
        if (DEBUG_UNIT) {
          console.log(`   Amount Match Check (Aggregated):`);
          console.log(`      Sheets ${samsAmount >= 0 ? 'Charges' : 'Payments'}: $${sheetsAmount.toFixed(2)}`);
          console.log(`      SAMS ${samsAmount >= 0 ? 'Charge' : 'Payment'}: $${samsAmount.toFixed(2)}`);
          console.log(`      Difference: $${amountDiff.toFixed(2)}`);
          console.log(`      Tolerance: $${(amountTolerance * 10).toFixed(2)}`);
          console.log(`      Match: ${amountMatch ? '✅ YES' : '❌ NO'}`);
        }
        
        if (amountMatch) {
          // Many-to-one match found
          if (DEBUG_UNIT) {
            console.log(`   ✅ AGGREGATED MATCH FOUND! Linking ${sheetsIndices.length} Sheets transactions to SAMS transaction`);
          }
          
          sheetsIndices.forEach(idx => sheetsMatched.add(idx));
          samsMatched.add(a);
          
          matched.push({
            sheets: sheetsTxns,
            sams: samsTxn,
            matchScore: 0.9,
            matchType: 'many-to-one',
            dateDiff: 0,
            amountDiff: amountDiff,
            aggregatedAmount: sheetsAmount,
            quarter: quarterKey
          });
        }
      } else if (DEBUG_UNIT && samsAmount >= 0) {
        console.log(`   ❌ No matching ${samsAmount >= 0 ? 'charges' : 'payments'} found in Sheets quarter`);
      }
    }
  }
  
  if (DEBUG_UNIT) {
    console.log('\n' + '='.repeat(70));
  }
  
// Collect unmatched
  for (let s = 0; s < sheetsTxns.length; s++) {
    if (!sheetsMatched.has(s)) {
      unmatchedSheets.push(sheetsTxns[s]);
    }
  }
  
  for (let a = 0; a < filteredSAMS.length; a++) {
    if (!samsMatched.has(a)) {
      unmatchedSAMS.push(filteredSAMS[a]);
    }
  }
  
  return { matched, unmatchedSheets, unmatchedSAMS };
}

/**
 * Categorize discrepancy
 */
function categorizeDiscrepancy(txn) {
  const desc = (txn.description || '').toLowerCase();
  const category = (txn.category || '').toLowerCase();
  
  if (category.includes('mantenimiento') || category.includes('hoa') || desc.includes('hoa dues')) {
    return 'HOA Dues';
  }
  if (category.includes('agua') || category.includes('water') || desc.includes('water')) {
    return 'Water Bills';
  }
  if (category.includes('penalty') || category.includes('cargo') || desc.includes('penalty') || desc.includes('late')) {
    return 'Penalties';
  }
  if (category.includes('lavado') || desc.includes('car wash') || desc.includes('boat wash')) {
    return 'Other';
  }
  if (txn.amount < 0) {
    return 'Payments';
  }
  
  return 'Other';
}

/**
 * Reconcile a single unit
 */
async function reconcileUnit(api, unitId) {
  console.log(`\n🔍 Reconciling Unit ${unitId}...`);
  
  // Load Sheets data
  const sheetsData = await loadUnitSheetsData(unitId);
  
  // Load SAMS data
  const samsData = await loadUnitSAMSData(api, unitId, FISCAL_YEAR);
  
  // Match transactions
  // Enable debug logging for unit 101
  if (unitId === '101') {
    process.env.DEBUG_UNIT = '101';
  }
  
  const matching = matchTransactions(sheetsData.transactions, samsData.transactions, {
    dateTolerance: 5,
    amountTolerance: 0.01,
    reconciliationDate: "2025-10-31",
    
  });
  
  // Clear debug flag
  if (unitId === '101') {
    delete process.env.DEBUG_UNIT;
  }
  
  // Calculate discrepancies
  const balanceDiff = (sheetsData.finalBalance || 0) - (samsData.finalBalance || 0);
  
  // Categorize unmatched transactions
  const unmatchedSheetsCategorized = matching.unmatchedSheets.map(txn => ({
    ...txn,
    category: categorizeDiscrepancy(txn)
  }));
  
  const unmatchedSAMSCategorized = matching.unmatchedSAMS.map(txn => ({
    ...txn,
    category: categorizeDiscrepancy(txn)
  }));
  
  return {
    unitId,
    unitLabel: sheetsData.unitLabel || unitId,
    sheetsBalance: sheetsData.finalBalance,
    samsBalance: samsData.finalBalance,
    balanceDifference: balanceDiff,
    totalMatched: matching.matched.length,
    totalUnmatchedSheets: matching.unmatchedSheets.length,
    totalUnmatchedSAMS: matching.unmatchedSAMS.length,
    matched: matching.matched,
    unmatchedSheets: unmatchedSheetsCategorized,
    unmatchedSAMS: unmatchedSAMSCategorized,
    sheetsData,
    samsData
  };
}

/**
 * Generate detailed transaction comparison report with references
 */
function generateTransactionComparisonReport(results) {
  const timestamp = new Date().toISOString();
  let report = `# AVII Transaction Comparison Report\n\n`;
  report += `**Generated:** ${timestamp}\n`;
  report += `**Reconciliation Date:** October 31, 2025 (Target)\n\n`;
  report += `This report provides a side-by-side comparison of Sheets and SAMS transactions with reference numbers for matching.\n\n`;
  
  for (const unitId of Object.keys(results).sort()) {
    const result = results[unitId];
    if (result.error) {
      report += `## Unit ${unitId}\n\n`;
      report += `**Error:** ${result.error}\n\n`;
      report += `---\n\n`;
      continue;
    }
    
    if (!result.sheetsData || !result.samsData) {
      report += `## Unit ${unitId} (${result.unitLabel || unitId})\n\n`;
      report += `**Warning:** Missing data (sheetsData: ${!!result.sheetsData}, samsData: ${!!result.samsData})\n\n`;
      report += `---\n\n`;
      continue;
    }
    
    report += `## Unit ${unitId} (${result.unitLabel || unitId})\n\n`;
    report += `- **Sheets Balance:** $${(result.sheetsBalance || 0).toFixed(2)}\n`;
    report += `- **SAMS Balance:** $${(result.samsBalance || 0).toFixed(2)}\n`;
    report += `- **Difference:** $${(result.balanceDifference || 0).toFixed(2)}\n`;
    report += `- **Matched:** ${result.totalMatched || 0} | **Unmatched Sheets:** ${result.totalUnmatchedSheets || 0} | **Unmatched SAMS:** ${result.totalUnmatchedSAMS || 0}\n\n`;
    
    // Create a map of matched transactions
    const matchedRefs = new Map(); // ref number -> { sheets: [], sams: txn }
    let refCounter = 1;
    
    // Process matched transactions
    for (const match of (result.matched || [])) {
      const ref = refCounter++;
      const sheetsList = Array.isArray(match.sheets) ? match.sheets : [match.sheets];
      matchedRefs.set(ref, {
        sheets: sheetsList,
        sams: match.sams,
        matchType: match.matchType || 'unknown',
        amountDiff: match.amountDiff || 0
      });
    }
    
    // Get all Sheets transactions (matched and unmatched)
    const allSheetsTxns = [...(result.sheetsData.transactions || [])];
    const sheetsMatchedIndices = new Set();
    for (const match of result.matched) {
      const sheetsList = Array.isArray(match.sheets) ? match.sheets : [match.sheets];
      for (const sheetTxn of sheetsList) {
        const idx = allSheetsTxns.findIndex(t => 
          t.date === sheetTxn.date && 
          t.amount === sheetTxn.amount && 
          t.description === sheetTxn.description
        );
        if (idx >= 0) sheetsMatchedIndices.add(idx);
      }
    }
    
    // Get all SAMS transactions (matched and unmatched)
    const allSAMSTxns = [...(result.samsData.transactions || [])];
    const samsMatchedIndices = new Set();
    for (const match of result.matched) {
      const idx = allSAMSTxns.findIndex(t => 
        t.date === match.sams.date && 
        t.amount === match.sams.amount && 
        t.description === match.sams.description
      );
      if (idx >= 0) samsMatchedIndices.add(idx);
    }
    
    // Create reference map for Sheets transactions
    const sheetsRefMap = new Map(); // transaction index -> ref number
    for (const [ref, match] of matchedRefs.entries()) {
      for (const sheetTxn of match.sheets) {
        const idx = allSheetsTxns.findIndex(t => 
          t.date === sheetTxn.date && 
          t.amount === sheetTxn.amount && 
          t.description === sheetTxn.description
        );
        if (idx >= 0) {
          if (!sheetsRefMap.has(idx)) sheetsRefMap.set(idx, []);
          sheetsRefMap.get(idx).push(ref);
        }
      }
    }
    
    // Create reference map for SAMS transactions
    const samsRefMap = new Map(); // transaction index -> ref number
    for (const [ref, match] of matchedRefs.entries()) {
      const idx = allSAMSTxns.findIndex(t => 
        t.date === match.sams.date && 
        t.amount === match.sams.amount && 
        t.description === match.sams.description
      );
      if (idx >= 0) {
        samsRefMap.set(idx, ref);
      }
    }
    
    // Sort transactions by date
    const sortedSheets = allSheetsTxns.map((txn, idx) => ({ ...txn, idx }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    const sortedSAMS = allSAMSTxns.map((txn, idx) => ({ ...txn, idx }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Sheets transactions table
    report += `### Sheets Transactions\n\n`;
    report += `| Ref | Date | Category | Description | Amount | Balance |\n`;
    report += `|-----|------|----------|-------------|--------|----------|\n`;
    
    for (const txn of sortedSheets) {
      const refs = sheetsRefMap.get(txn.idx) || [];
      const refStr = refs.length > 0 ? refs.join(', ') : '';
      const matchIndicator = refs.length > 0 ? '✅' : '❌';
      report += `| ${refStr || '-'} ${matchIndicator} | ${txn.date} | ${txn.category || ''} | ${txn.description || ''} | $${txn.amount.toFixed(2)} | ${txn.balance !== null ? '$' + txn.balance.toFixed(2) : '-'} |\n`;
    }
    
    report += `\n### SAMS Transactions\n\n`;
    report += `| Ref | Date | Category | Description | Amount | Balance |\n`;
    report += `|-----|------|----------|-------------|--------|----------|\n`;
    
    for (const txn of sortedSAMS) {
      const ref = samsRefMap.get(txn.idx);
      const refStr = ref || '-';
      const matchIndicator = ref ? '✅' : '❌';
      report += `| ${refStr} ${matchIndicator} | ${txn.date} | ${txn.category || ''} | ${txn.description || ''} | $${txn.amount.toFixed(2)} | ${txn.balance !== null ? '$' + txn.balance.toFixed(2) : '-'} |\n`;
    }
    
    // Match details
    if (matchedRefs.size > 0) {
      report += `\n### Match Details\n\n`;
      report += `| Ref | Match Type | Sheets Transactions | SAMS Transaction | Amount Diff |\n`;
      report += `|-----|------------|----------------------|------------------|-------------|\n`;
      
      for (const [ref, match] of matchedRefs.entries()) {
        const sheetsDesc = match.sheets.length === 1 
          ? `${match.sheets[0].date} $${match.sheets[0].amount.toFixed(2)}`
          : `${match.sheets.length} transactions (${match.sheets.map(s => `$${s.amount.toFixed(2)}`).join(', ')})`;
        const samsDesc = `${match.sams.date} $${match.sams.amount.toFixed(2)}`;
        report += `| ${ref} | ${match.matchType} | ${sheetsDesc} | ${samsDesc} | $${match.amountDiff.toFixed(2)} |\n`;
      }
    }
    
    report += `\n---\n\n`;
  }
  
  return report;
}

/**
 * Generate reconciliation report
 */
function generateReconciliationReport(results) {
  const timestamp = new Date().toISOString();
  
  let report = `# AVII Reconciliation Report\n\n`;
  report += `**Generated:** ${timestamp}\n`;
  report += `**Reconciliation Date:** October 31, 2025 (Target)\n\n`;
  
  report += `## Executive Summary\n\n`;
  report += `This report compares AVII unit account balances between Google Sheets (source of truth) and SAMS (target system).\n\n`;
  
  // Summary table
  report += `### Balance Comparison\n\n`;
  report += `| Unit | Sheets Balance | SAMS Balance | Difference | Status |\n`;
  report += `|------|----------------|--------------|------------|--------|\n`;
  
  let totalSheets = 0;
  let totalSAMS = 0;
  
  for (const unitId of Object.keys(results).sort()) {
    const result = results[unitId];
    if (result.error) continue;
    
    totalSheets += result.sheetsBalance || 0;
    totalSAMS += result.samsBalance || 0;
    
    const diff = result.balanceDifference;
    const status = Math.abs(diff) < 0.01 ? '✅ Match' : '❌ Mismatch';
    
    report += `| ${unitId} | $${(result.sheetsBalance || 0).toFixed(2)} | $${(result.samsBalance || 0).toFixed(2)} | $${diff.toFixed(2)} | ${status} |\n`;
  }
  
  report += `| **TOTAL** | **$${totalSheets.toFixed(2)}** | **$${totalSAMS.toFixed(2)}** | **$${(totalSheets - totalSAMS).toFixed(2)}** | |\n\n`;
  
  // Unit-by-unit details
  report += `## Unit-by-Unit Analysis\n\n`;
  
  for (const unitId of Object.keys(results).sort()) {
    const result = results[unitId];
    if (result.error) {
      report += `### Unit ${unitId}\n\n`;
      report += `**Error:** ${result.error}\n\n`;
      continue;
    }
    
    report += `### Unit ${unitId} (${result.unitLabel})\n\n`;
    report += `- **Sheets Balance:** $${(result.sheetsBalance || 0).toFixed(2)}\n`;
    report += `- **SAMS Balance:** $${(result.samsBalance || 0).toFixed(2)}\n`;
    report += `- **Difference:** $${result.balanceDifference.toFixed(2)}\n`;
    report += `- **Matched Transactions:** ${result.totalMatched}\n`;
    report += `- **Unmatched in Sheets:** ${result.totalUnmatchedSheets}\n`;
    report += `- **Unmatched in SAMS:** ${result.totalUnmatchedSAMS}\n\n`;
    
    if (result.unmatchedSheets.length > 0) {
      report += `#### Missing in SAMS:\n\n`;
      report += `| Date | Description | Amount | Category |\n`;
      report += `|------|-------------|--------|----------|\n`;
      for (const txn of result.unmatchedSheets) {
        report += `| ${txn.date} | ${txn.description} | $${txn.amount.toFixed(2)} | ${txn.category} |\n`;
      }
      report += `\n`;
    }
    
    if (result.unmatchedSAMS.length > 0) {
      report += `#### Extra in SAMS:\n\n`;
      report += `| Date | Description | Amount | Category |\n`;
      report += `|------|-------------|--------|----------|\n`;
      for (const txn of result.unmatchedSAMS) {
        report += `| ${txn.date} | ${txn.description} | $${txn.amount.toFixed(2)} | ${txn.category} |\n`;
      }
      report += `\n`;
    }
  }
  
  return report;
}

/**
 * Generate adjustment schedule
 */
function generateAdjustmentSchedule(results) {
  let schedule = `# AVII Adjustment Schedule\n\n`;
  schedule += `**Generated:** ${new Date().toISOString()}\n\n`;
  schedule += `This schedule documents specific adjustments needed to align SAMS balances with Sheets (source of truth).\n\n`;
  
  schedule += `| Unit | Current SAMS | Target (Sheets) | Adjustment | Category | Notes |\n`;
  schedule += `|------|--------------|-----------------|------------|----------|-------|\n`;
  
  for (const unitId of Object.keys(results).sort()) {
    const result = results[unitId];
    if (result.error) continue;
    
    const adjustment = result.balanceDifference;
    if (Math.abs(adjustment) < 0.01) continue; // Skip if balanced
    
    // Determine primary category from unmatched transactions
    const categories = {};
    [...result.unmatchedSheets, ...result.unmatchedSAMS].forEach(txn => {
      const cat = txn.category || 'Other';
      categories[cat] = (categories[cat] || 0) + Math.abs(txn.amount);
    });
    
    const primaryCategory = Object.keys(categories).reduce((a, b) => 
      categories[a] > categories[b] ? a : b, 'Other'
    );
    
    const notes = result.totalUnmatchedSheets > 0 || result.totalUnmatchedSAMS > 0
      ? `${result.totalUnmatchedSheets} missing, ${result.totalUnmatchedSAMS} extra transactions`
      : 'Balance difference only';
    
    schedule += `| ${unitId} | $${(result.samsBalance || 0).toFixed(2)} | $${(result.sheetsBalance || 0).toFixed(2)} | $${adjustment.toFixed(2)} | ${primaryCategory} | ${notes} |\n`;
  }
  
  return schedule;
}

/**
 * Generate root cause analysis
 */
function generateRootCauseAnalysis(results) {
  let analysis = `# AVII Root Cause Analysis\n\n`;
  analysis += `**Generated:** ${new Date().toISOString()}\n\n`;
  
  // Categorize discrepancies
  const discrepancyCategories = {
    'HOA Dues': { count: 0, units: [] },
    'Water Bills': { count: 0, units: [] },
    'Penalties': { count: 0, units: [] },
    'Payments': { count: 0, units: [] },
    'Other': { count: 0, units: [] }
  };
  
  for (const unitId of Object.keys(results).sort()) {
    const result = results[unitId];
    if (result.error) continue;
    
    const categories = {};
    [...result.unmatchedSheets, ...result.unmatchedSAMS].forEach(txn => {
      const cat = txn.category || 'Other';
      if (!categories[cat]) categories[cat] = 0;
      categories[cat] += Math.abs(txn.amount);
    });
    
    for (const [cat, amount] of Object.entries(categories)) {
      if (discrepancyCategories[cat]) {
        discrepancyCategories[cat].count++;
        if (!discrepancyCategories[cat].units.includes(unitId)) {
          discrepancyCategories[cat].units.push(unitId);
        }
      }
    }
  }
  
  analysis += `## Discrepancy Categories\n\n`;
  for (const [category, data] of Object.entries(discrepancyCategories)) {
    if (data.count > 0) {
      analysis += `### ${category}\n\n`;
      analysis += `- **Affected Units:** ${data.count}\n`;
      analysis += `- **Units:** ${data.units.join(', ')}\n\n`;
    }
  }
  
  analysis += `## Patterns Identified\n\n`;
  
  // Check for systematic issues
  const allUnmatched = [];
  for (const result of Object.values(results)) {
    if (result.error) continue;
    allUnmatched.push(...result.unmatchedSheets, ...result.unmatchedSAMS);
  }
  
  // Group by date range
  const dateRanges = {};
  allUnmatched.forEach(txn => {
    if (txn.date) {
      const date = new Date(txn.date);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!dateRanges[month]) dateRanges[month] = 0;
      dateRanges[month]++;
    }
  });
  
  if (Object.keys(dateRanges).length > 0) {
    analysis += `### Date Range Analysis\n\n`;
    analysis += `Discrepancies by month:\n\n`;
    for (const [month, count] of Object.entries(dateRanges).sort()) {
      analysis += `- **${month}:** ${count} unmatched transactions\n`;
    }
    analysis += `\n`;
  }
  
  analysis += `## Recommendations\n\n`;
  analysis += `1. Review unmatched transactions to identify import process gaps\n`;
  analysis += `2. Verify transaction allocation logic for payments\n`;
  analysis += `3. Check penalty calculation consistency\n`;
  analysis += `4. Validate date handling and timezone normalization\n`;
  analysis += `5. Implement automated reconciliation checks for future imports\n`;
  
  return analysis;
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const unitId = args[0] || null;
  
  await testHarness.runTest({
    name: 'AVII Statement Reconciliation',
    async test({ api }) {
      try {
        const results = {};
        
        if (unitId) {
          // Reconcile single unit
          results[unitId] = await reconcileUnit(api, unitId);
        } else {
          // Reconcile all units
          const units = ['101', '102', '103', '104', '105', '106', '201', '202', '203', '204'];
          for (const uid of units) {
            try {
              results[uid] = await reconcileUnit(api, uid);
              await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
              results[uid] = { error: error.message };
            }
          }
        }
        
        // Generate reports
        console.log('\n📝 Generating reports...');
        
        const report = generateReconciliationReport(results);
        const reportPath = path.join(OUTPUT_DIR, 'AVII_Reconciliation_Report.md');
        await writeFile(reportPath, report, 'utf8');
        console.log(`✅ Reconciliation Report: ${reportPath}`);
        
        const schedule = generateAdjustmentSchedule(results);
        const schedulePath = path.join(OUTPUT_DIR, 'AVII_Adjustment_Schedule.md');
        await writeFile(schedulePath, schedule, 'utf8');
        console.log(`✅ Adjustment Schedule: ${schedulePath}`);
        
        const analysis = generateRootCauseAnalysis(results);
        const analysisPath = path.join(OUTPUT_DIR, 'AVII_Root_Cause_Analysis.md');
        await writeFile(analysisPath, analysis, 'utf8');
        console.log(`✅ Root Cause Analysis: ${analysisPath}`);
        
        const comparison = generateTransactionComparisonReport(results);
        const comparisonPath = path.join(OUTPUT_DIR, 'AVII_Transaction_Comparison.md');
        await writeFile(comparisonPath, comparison, 'utf8');
        console.log(`✅ Transaction Comparison Report: ${comparisonPath}`);
        
        // Summary
        console.log('\n✅ Reconciliation Complete!');
        console.log('='.repeat(70));
        
        const successful = Object.values(results).filter(r => !r.error).length;
        console.log(`Units processed: ${successful}/${Object.keys(results).length}`);
        
        return { passed: true, message: 'Reconciliation complete' };
      } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
        return { passed: false, message: error.message };
      }
    }
  });
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('reconcile-avii-statements.js')) {
  main();
}

export { reconcileUnit, matchTransactions };
