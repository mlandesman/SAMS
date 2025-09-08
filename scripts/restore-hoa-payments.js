#!/usr/bin/env node

/**
 * Emergency HOA Payment Data Recovery Script
 * 
 * This script restores corrupted HOA payment data that was wiped out
 * by the backend bug that replaces entire documents instead of updating.
 * 
 * Usage: node restore-hoa-payments.js
 */

import { getDb } from '../backend/firebase.js';
import admin from 'firebase-admin';

// Known good payment data for MTC units
const knownPayments = {
  'MTC': {
    '1A': {
      '2025': {
        payments: [
          { month: 1, paid: true, amount: 4600, date: null, reference: null },
          { month: 2, paid: true, amount: 4600, date: null, reference: null },
          { month: 3, paid: true, amount: 4600, date: null, reference: null },
          { month: 4, paid: true, amount: 4600, date: null, reference: null },
          { month: 5, paid: true, amount: 4600, date: null, reference: null },
          { month: 6, paid: true, amount: 4600, date: null, reference: null },
          { month: 7, paid: true, amount: 4600, date: null, reference: null },
          { month: 8, paid: true, amount: 4600, date: null, reference: null },
          { month: 9, paid: true, amount: 4600, date: null, reference: null },
          { month: 10, paid: true, amount: 4600, date: null, reference: null },
          { month: 11, paid: false, amount: 0, date: null, reference: null },
          { month: 12, paid: false, amount: 0, date: null, reference: null }
        ],
        creditBalance: 43900,
        scheduledAmount: 460000
      }
    },
    '1B': {
      '2025': {
        payments: [
          { month: 1, paid: false, amount: 0, date: null, reference: null },
          { month: 2, paid: false, amount: 0, date: null, reference: null },
          { month: 3, paid: false, amount: 0, date: null, reference: null },
          { month: 4, paid: false, amount: 0, date: null, reference: null },
          { month: 5, paid: false, amount: 0, date: null, reference: null },
          { month: 6, paid: false, amount: 0, date: null, reference: null },
          { month: 7, paid: false, amount: 0, date: null, reference: null },
          { month: 8, paid: false, amount: 0, date: null, reference: null },
          { month: 9, paid: false, amount: 0, date: null, reference: null },
          { month: 10, paid: false, amount: 0, date: null, reference: null },
          { month: 11, paid: false, amount: 0, date: null, reference: null },
          { month: 12, paid: false, amount: 0, date: null, reference: null }
        ],
        creditBalance: 328800,
        scheduledAmount: 440000
      }
    },
    '1C': {
      '2025': {
        payments: [
          { month: 1, paid: true, amount: 4400, date: null, reference: null },
          { month: 2, paid: true, amount: 4400, date: null, reference: null },
          { month: 3, paid: true, amount: 4400, date: null, reference: null },
          { month: 4, paid: true, amount: 4400, date: null, reference: null },
          { month: 5, paid: true, amount: 4400, date: null, reference: null },
          { month: 6, paid: true, amount: 4400, date: null, reference: null },
          { month: 7, paid: true, amount: 4400, date: null, reference: null },
          { month: 8, paid: true, amount: 4400, date: null, reference: null },
          { month: 9, paid: true, amount: 4400, date: null, reference: null },
          { month: 10, paid: false, amount: 0, date: null, reference: null },
          { month: 11, paid: false, amount: 0, date: null, reference: null },
          { month: 12, paid: false, amount: 0, date: null, reference: null }
        ],
        creditBalance: 60000,
        scheduledAmount: 440000
      }
    },
    '2A': {
      '2025': {
        payments: [
          {
            month: 1,
            paid: true,
            amount: 4600,
            date: new Date('2025-01-04T23:15:57.000Z'),
            notes: 'Posted: MXN 4,600.00 on Sat Jan 04 2025 10:44:48 GMT-0500 (Eastern Standard Time)\nJan 2025 XOOM (Remesa Fam)\nSeq: 25023',
            sequenceNumber: '25023',
            transactionId: '2025-01-04_231557_000'
          },
          {
            month: 2,
            paid: true,
            amount: 4600,
            date: new Date('2025-02-03T23:16:19.000Z'),
            notes: 'Posted: MXN 9,200.00 on Mon Feb 03 2025 16:21:01 GMT-0500 (Eastern Standard Time)\nFeb, Mar 2025 Wire Transfer\nSeq: 25033',
            sequenceNumber: '25033',
            transactionId: '2025-02-03_231619_000'
          },
          {
            month: 3,
            paid: true,
            amount: 4600,
            date: new Date('2025-02-03T23:16:19.000Z'),
            notes: 'Posted: MXN 9,200.00 on Mon Feb 03 2025 16:21:01 GMT-0500 (Eastern Standard Time)\nFeb, Mar 2025 Wire Transfer\nSeq: 25033',
            sequenceNumber: '25033',
            transactionId: '2025-02-03_231619_000'
          },
          {
            month: 4,
            paid: true,
            amount: 4600,
            date: new Date('2025-04-04T23:17:15.000Z'),
            notes: 'Posted: MXN 4,600.00 on Tue Apr 08 2025 10:26:34 GMT-0500 (Eastern Standard Time)\nApr 2025 REMESA FAM\nSeq: 25073',
            sequenceNumber: '25073',
            transactionId: '2025-04-04_231715_000'
          },
          {
            month: 5,
            paid: true,
            amount: 4600,
            date: new Date('2025-05-01T13:56:30.000Z'),
            notes: 'Posted: MXN 4,600.00 on Thu May 01 2025 09:56:30 GMT-0500 (Eastern Standard Time)\nMay 2025 Sent 46,000, returned 41,400 via Venmo\nSeq: 25099',
            sequenceNumber: '25099',
            transactionId: null
          },
          {
            month: 6,
            paid: true,
            amount: 4600,
            date: new Date('2025-06-09T23:18:03.000Z'),
            notes: 'Posted: MXN 4,600.00 on Mon Jun 09 2025 22:36:16 GMT-0500 (Eastern Standard Time)\nJun 2025 Xoom → CiBanco\nSeq: 25113',
            sequenceNumber: '25113',
            transactionId: '2025-06-09_231803_000'
          },
          {
            month: 7,
            paid: true,
            amount: 4600,
            date: new Date('2025-07-07T23:18:22.000Z'),
            notes: 'Posted: MXN 3,800.00 on Mon Jul 07 2025 01:47:55 GMT-0500 (Eastern Standard Time)\nJul 2025 using MXN 800.00 from Credit Balance \nSeq: 25128',
            sequenceNumber: '25128',
            transactionId: '2025-07-07_231822_000'
          },
          { month: 8, paid: false, amount: 0, date: null, reference: null },
          { month: 9, paid: false, amount: 0, date: null, reference: null },
          { month: 10, paid: false, amount: 0, date: null, reference: null },
          { month: 11, paid: false, amount: 0, date: null, reference: null },
          { month: 12, paid: false, amount: 0, date: null, reference: null }
        ],
        creditBalance: 9400,
        scheduledAmount: 460000
      }
    },
    '2B': {
      '2025': {
        payments: [
          { month: 1, paid: true, amount: 4400, date: null, reference: null },
          { month: 2, paid: true, amount: 4400, date: null, reference: null },
          { month: 3, paid: true, amount: 4400, date: null, reference: null },
          { month: 4, paid: true, amount: 4400, date: null, reference: null },
          { month: 5, paid: true, amount: 4400, date: null, reference: null },
          { month: 6, paid: true, amount: 4400, date: null, reference: null },
          { month: 7, paid: true, amount: 4400, date: null, reference: null },
          { month: 8, paid: true, amount: 4400, date: null, reference: null },
          { month: 9, paid: false, amount: 0, date: null, reference: null },
          { month: 10, paid: false, amount: 0, date: null, reference: null },
          { month: 11, paid: false, amount: 0, date: null, reference: null },
          { month: 12, paid: false, amount: 0, date: null, reference: null }
        ],
        creditBalance: 0,
        scheduledAmount: 440000
      }
    },
    '2C': {
      '2025': {
        payments: [
          { month: 1, paid: true, amount: 4400, date: null, reference: null },
          { month: 2, paid: true, amount: 4400, date: null, reference: null },
          { month: 3, paid: true, amount: 4400, date: null, reference: null },
          { month: 4, paid: true, amount: 4400, date: null, reference: null },
          { month: 5, paid: true, amount: 4400, date: null, reference: null },
          { month: 6, paid: true, amount: 4400, date: null, reference: null },
          { month: 7, paid: true, amount: 4400, date: null, reference: null },
          { month: 8, paid: true, amount: 4400, date: null, reference: null },
          { month: 9, paid: true, amount: 4400, date: null, reference: null },
          { month: 10, paid: false, amount: 0, date: null, reference: null },
          { month: 11, paid: false, amount: 0, date: null, reference: null },
          { month: 12, paid: false, amount: 0, date: null, reference: null }
        ],
        creditBalance: 0,
        scheduledAmount: 440000
      }
    },
    'PH1A': {
      '2025': {
        payments: [
          { month: 1, paid: true, amount: 5800, date: null, reference: null },
          { month: 2, paid: true, amount: 5800, date: null, reference: null },
          { month: 3, paid: true, amount: 5800, date: null, reference: null },
          { month: 4, paid: true, amount: 5800, date: null, reference: null },
          { month: 5, paid: true, amount: 5800, date: null, reference: null },
          { month: 6, paid: true, amount: 5800, date: null, reference: null },
          { month: 7, paid: true, amount: 5800, date: null, reference: null },
          { month: 8, paid: true, amount: 5800, date: null, reference: null },
          { month: 9, paid: false, amount: 0, date: null, reference: null },
          { month: 10, paid: false, amount: 0, date: null, reference: null },
          { month: 11, paid: false, amount: 0, date: null, reference: null },
          { month: 12, paid: false, amount: 0, date: null, reference: null }
        ],
        creditBalance: 0,
        scheduledAmount: 580000
      }
    },
    'PH2B': {
      '2025': {
        payments: [
          { month: 1, paid: false, amount: 0, date: null, reference: null },
          { month: 2, paid: false, amount: 0, date: null, reference: null },
          { month: 3, paid: false, amount: 0, date: null, reference: null },
          { month: 4, paid: false, amount: 0, date: null, reference: null },
          { month: 5, paid: false, amount: 0, date: null, reference: null },
          { month: 6, paid: false, amount: 0, date: null, reference: null },
          { month: 7, paid: false, amount: 0, date: null, reference: null },
          { month: 8, paid: false, amount: 0, date: null, reference: null },
          { month: 9, paid: false, amount: 0, date: null, reference: null },
          { month: 10, paid: false, amount: 0, date: null, reference: null },
          { month: 11, paid: false, amount: 0, date: null, reference: null },
          { month: 12, paid: false, amount: 0, date: null, reference: null }
        ],
        creditBalance: 40000,
        scheduledAmount: 580000
      }
    },
    'PH3C': {
      '2025': {
        payments: [
          { month: 1, paid: false, amount: 0, date: null, reference: null },
          { month: 2, paid: false, amount: 0, date: null, reference: null },
          { month: 3, paid: false, amount: 0, date: null, reference: null },
          { month: 4, paid: false, amount: 0, date: null, reference: null },
          { month: 5, paid: false, amount: 0, date: null, reference: null },
          { month: 6, paid: false, amount: 0, date: null, reference: null },
          { month: 7, paid: false, amount: 0, date: null, reference: null },
          { month: 8, paid: false, amount: 0, date: null, reference: null },
          { month: 9, paid: false, amount: 0, date: null, reference: null },
          { month: 10, paid: false, amount: 0, date: null, reference: null },
          { month: 11, paid: false, amount: 0, date: null, reference: null },
          { month: 12, paid: false, amount: 0, date: null, reference: null }
        ],
        creditBalance: 111044,
        scheduledAmount: 580000
      }
    },
    'PH4D': {
      '2025': {
        payments: [
          { month: 1, paid: false, amount: 0, date: null, reference: null },
          { month: 2, paid: false, amount: 0, date: null, reference: null },
          { month: 3, paid: false, amount: 0, date: null, reference: null },
          { month: 4, paid: false, amount: 0, date: null, reference: null },
          { month: 5, paid: false, amount: 0, date: null, reference: null },
          { month: 6, paid: false, amount: 0, date: null, reference: null },
          { month: 7, paid: false, amount: 0, date: null, reference: null },
          { month: 8, paid: false, amount: 0, date: null, reference: null },
          { month: 9, paid: false, amount: 0, date: null, reference: null },
          { month: 10, paid: false, amount: 0, date: null, reference: null },
          { month: 11, paid: false, amount: 0, date: null, reference: null },
          { month: 12, paid: false, amount: 0, date: null, reference: null }
        ],
        creditBalance: 40000,
        scheduledAmount: 580000
      }
    }
  }
};

async function restorePayments() {
  console.log('🔧 Starting HOA Payment Data Recovery...\n');
  
  const db = await getDb();

  for (const [clientId, units] of Object.entries(knownPayments)) {
    for (const [unitId, years] of Object.entries(units)) {
      for (const [year, data] of Object.entries(years)) {
        const docPath = `clients/${clientId}/units/${unitId}/dues/${year}`;
        console.log(`📍 Restoring: ${docPath}`);

        try {
          const docRef = db.doc(docPath);
          const doc = await docRef.get();

          if (!doc.exists) {
            console.log('  ❌ Document not found, skipping...');
            continue;
          }

          const currentData = doc.data();
          console.log(`  📊 Current state: ${currentData.payments?.filter(p => p?.paid).length || 0} payments recorded`);

          // Build the corrected payments array
          const correctedPayments = data.payments.map((payment, index) => {
            if (payment.month && payment.paid) {
              // Convert notes format for proper storage
              const paymentData = {
                paid: payment.paid,
                amount: payment.amount * 100, // Convert to cents
                date: payment.date ? admin.firestore.Timestamp.fromDate(new Date(payment.date)) : null,
                reference: payment.transactionId
              };
              
              // Add optional fields if they exist
              if (payment.notes) paymentData.notes = payment.notes;
              if (payment.sequenceNumber) paymentData.sequenceNumber = payment.sequenceNumber;
              if (payment.transactionId) paymentData.transactionId = payment.transactionId;
              
              return paymentData;
            } else {
              // Empty month
              return {
                paid: false,
                amount: 0,
                date: null,
                reference: null
              };
            }
          });

          // Update with merge to preserve other fields
          await docRef.update({
            payments: correctedPayments,
            creditBalance: data.creditBalance,
            scheduledAmount: data.scheduledAmount,
            updated: admin.firestore.Timestamp.now()
          });

          console.log(`  ✅ Restored ${data.payments.filter(p => p.paid).length} payments`);
          console.log(`  💰 Credit Balance: ${data.creditBalance}`);

        } catch (error) {
          console.error(`  ❌ Error: ${error.message}`);
        }
      }
    }
  }

  console.log('\n✨ Recovery complete!');
  process.exit(0);
}

// Add more units as needed
console.log('💡 To add more units, edit the knownPayments object in this script\n');

restorePayments().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});