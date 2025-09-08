import { numToWords } from '../frontend/sams-ui/src/utils/numberToWords.js';

/**
 * Test script to map a transaction to receipt format
 * Tests both data mapping and numToWords functionality
 */
async function testReceiptMapping() {
  // Sample transaction data from the screenshot
  const transaction = {
    id: 'pTYTepHBldSqs9Ys8PR5',
    accountType: 'Bank',
    amount: 20000,
    category: 'HOA Dues',
    createdAt: 'June 14, 2025 at 1:42:30 PM UTC-5',
    creditBalanceAdded: 0,
    date: 'June 13, 2025 at 7:00:00 PM UTC-5',
    duesDistribution: [
      { amount: 5800, month: 7, unitId: 'PH4D', year: 2025 },
      { amount: 5800, month: 8, unitId: 'PH4D', year: 2025 },
      { amount: 5800, month: 9, unitId: 'PH4D', year: 2025 },
      { amount: 5800, month: 10, unitId: 'PH4D', year: 2025 }
    ],
    metadata: {
      months: { 0: 7, 1: 8, 2: 9, 3: 10 },
      type: 'hoa_dues',
      unitId: 'PH4D',
      year: 2025
    },
    notes: 'HOA Dues payment for Unit PH4D - Jul, Aug, Sep, Oct 2025 - These are the notes for this deposit. Wise → CiBanco',
    paymentMethod: 'bank_transfer',
    reference: 'DUES-PH4D-2025',
    transactionType: 'income',
    unit: 'PH4D',
    vendor: 'Deposit'
  };

  // Sample client data (we'll get this from context in the real implementation)
  const clientData = {
    clientName: 'Marina Turquesa Condominiums',
    address: 'Blvd. Kukulcán Km 6.5, Zona Hotelera, 77500 Cancún, Q.R.',
    email: 'admin@marinaturquesa.com',
    phone: '+52 998 123 4567',
    logoUrl: 'https://firebasestorage.googleapis.com/v0/b/sandyland-management-system.firebasestorage.app/o/logos%2Fsandyland-properties-high-resolution-logo-transparent.png?alt=media&token=a39645c7-aa81-41a0-9b20-35086de026d0'
  };

  try {
    // Convert amount to words in both languages
    const amountInWordsEng = numToWords(transaction.amount, "Pesos", "Eng");
    const amountInWordsEsp = numToWords(transaction.amount, "Pesos", "Esp");

    // Create description from duesDistribution
    const monthNames = {
      7: "Julio",
      8: "Agosto",
      9: "Septiembre",
      10: "Octubre"
    };

    const months = transaction.duesDistribution.map(d => monthNames[d.month]).join(', ');
    const description = `HOA Dues payment for Unit ${transaction.unit} - ${months} ${transaction.metadata.year}`;

    // Map transaction data to receipt format
    const receiptData = {
      receiptNumber: transaction.id.slice(-8).toUpperCase(),
      date: transaction.date.split(' at')[0],  // Just get the date part
      receivedFrom: "Owner Name", // We'll need to look this up from the unit data
      amount: transaction.amount,
      amountInWordsEng,
      amountInWordsEsp,
      paymentMethod: transaction.paymentMethod,
      reference: transaction.reference,
      notes: transaction.notes,
      itemDescription: description,
      unitNumber: transaction.unit,
      category: transaction.category,
      transactionType: transaction.transactionType,
      duesDistribution: transaction.duesDistribution,
      
      // Client data
      clientName: clientData.clientName,
      clientAddress: clientData.address,
      clientEmail: clientData.email,
      clientPhone: clientData.phone,
      clientLogo: clientData.logoUrl,
      
      // Additional transaction metadata
      currency: "MXN",
      createdAt: transaction.createdAt
    };

    console.log('\n📝 Mapped Receipt Data:');
    console.log(JSON.stringify(receiptData, null, 2));

    console.log('\n💰 Amount in Words Test:');
    console.log('English:', amountInWordsEng);
    console.log('Spanish:', amountInWordsEsp);

    console.log('\n📅 Months covered:', months);
    console.log('Description:', description);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testReceiptMapping();
