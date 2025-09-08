#!/usr/bin/env node

/**
 * test-hoa-notes-parsing.js
 * Test script to validate HOA notes parsing logic
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/**
 * Parses notes field to extract payment information
 */
function parsePaymentNotes(notes) {
  if (!notes) {
    return { 
      paymentDate: null, 
      sequenceNumber: null, 
      originalAmount: null,
      paymentMethod: null,
      monthsCovered: null
    };
  }
  
  const result = {
    paymentDate: null,
    sequenceNumber: null,
    originalAmount: null,
    paymentMethod: null,
    monthsCovered: null
  };
  
  try {
    // Extract payment date: "Posted: MXN 17,400.00 on Fri Dec 27 2024 16:27:51 GMT-0500"
    const dateMatch = notes.match(/on\s+(.+?)\s+GMT/);
    if (dateMatch) {
      result.paymentDate = new Date(dateMatch[1]);
    }
    
    // Extract sequence number: "Seq: 25009"
    const seqMatch = notes.match(/Seq:\s*(\d+)/);
    if (seqMatch) {
      result.sequenceNumber = parseInt(seqMatch[1]);
    }
    
    // Extract original amount: "MXN 17,400.00"
    const amountMatch = notes.match(/MXN\s+([\d,]+\.?\d*)/);
    if (amountMatch) {
      result.originalAmount = parseFloat(amountMatch[1].replace(/,/g, ''));
    }
    
    // Extract payment method and months info
    const lines = notes.split('\n');
    if (lines.length > 1) {
      result.monthsCovered = lines[1];
      
      // Extract payment method from months line
      const methodMatch = lines[1].match(/;\s*(.+?)(?:\s*→|$)/);
      if (methodMatch) {
        result.paymentMethod = methodMatch[1].trim();
      }
    }
    
  } catch (error) {
    console.warn(`⚠️ Error parsing notes: ${notes}`, error.message);
  }
  
  return result;
}

function testNoteParsing() {
  console.log('🧪 Testing HOA Notes Parsing Logic\n');
  
  // Load test data
  const hoaDuesData = require('../MTCdata/HOADues.json');
  const transactionsData = require('../MTCdata/Transactions.json');
  
  console.log(`📊 Loaded ${Object.keys(hoaDuesData).length} units and ${transactionsData.length} transactions\n`);
  
  // Create transaction lookup
  const transactionLookup = new Map();
  transactionsData.forEach((transaction, index) => {
    const sequenceNumber = transaction[""];
    if (sequenceNumber) {
      transactionLookup.set(sequenceNumber, { ...transaction, originalIndex: index });
    }
  });
  
  console.log(`🔍 Created lookup with ${transactionLookup.size} transactions\n`);
  
  // Test parsing on a few units
  const testUnits = ['PH4D', '1A', '1B'];
  
  for (const unitId of testUnits) {
    if (!hoaDuesData[unitId]) {
      console.log(`❌ Unit ${unitId} not found\n`);
      continue;
    }
    
    console.log(`📋 Testing Unit ${unitId}:`);
    const unitData = hoaDuesData[unitId];
    
    for (const payment of unitData.payments.slice(0, 3)) { // Test first 3 payments
      if (payment.notes) {
        console.log(`\n  🗒️ Month ${payment.month} Notes:`);
        console.log(`     Raw: ${payment.notes.substring(0, 100)}...`);
        
        const parsed = parsePaymentNotes(payment.notes);
        console.log(`     📅 Date: ${parsed.paymentDate}`);
        console.log(`     🔢 Sequence: ${parsed.sequenceNumber}`);
        console.log(`     💰 Amount: MXN ${parsed.originalAmount}`);
        console.log(`     💳 Method: ${parsed.paymentMethod}`);
        console.log(`     📝 Months: ${parsed.monthsCovered}`);
        
        // Check if transaction exists
        if (parsed.sequenceNumber) {
          const transaction = transactionLookup.get(parsed.sequenceNumber);
          if (transaction) {
            console.log(`     ✅ Transaction found: ${transaction.Date} - $${transaction.Amount}`);
          } else {
            console.log(`     ❌ Transaction ${parsed.sequenceNumber} not found`);
          }
        }
      }
    }
    
    console.log(`\n${'─'.repeat(60)}\n`);
  }
  
  // Summary statistics
  let totalPayments = 0;
  let paymentsWithNotes = 0;
  let paymentsWithSequence = 0;
  let linkedTransactions = 0;
  
  for (const [unitId, unitData] of Object.entries(hoaDuesData)) {
    for (const payment of unitData.payments) {
      if (payment.paid > 0) {
        totalPayments++;
        
        if (payment.notes) {
          paymentsWithNotes++;
          
          const parsed = parsePaymentNotes(payment.notes);
          if (parsed.sequenceNumber) {
            paymentsWithSequence++;
            
            if (transactionLookup.has(parsed.sequenceNumber)) {
              linkedTransactions++;
            }
          }
        }
      }
    }
  }
  
  console.log(`📊 Summary Statistics:`);
  console.log(`   Total payments: ${totalPayments}`);
  console.log(`   Payments with notes: ${paymentsWithNotes} (${(paymentsWithNotes/totalPayments*100).toFixed(1)}%)`);
  console.log(`   Payments with sequence numbers: ${paymentsWithSequence} (${(paymentsWithSequence/totalPayments*100).toFixed(1)}%)`);
  console.log(`   Linked to transactions: ${linkedTransactions} (${(linkedTransactions/totalPayments*100).toFixed(1)}%)`);
  
  console.log(`\n✅ Notes parsing test completed`);
}

// Run the test
testNoteParsing();