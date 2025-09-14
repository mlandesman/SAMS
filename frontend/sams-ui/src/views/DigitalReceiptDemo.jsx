import React, { useState } from 'react';
import DigitalReceipt from '../components/DigitalReceipt';

const DigitalReceiptDemo = () => {
  const [generatedBlob, setGeneratedBlob] = useState(null);
  const [selectedSample, setSelectedSample] = useState(0);

  // Multiple sample transaction data for demo
  const sampleTransactions = [
    {
      date: new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      receiptNumber: 'TXN-2025-001234',
      receivedFrom: 'Juan Carlos Mendez Rodriguez',
      amount: 2850.00,
      amountInWords: 'Dos mil ochocientos cincuenta pesos 00/100 M.N.',
      category: 'Cuotas de Mantenimiento',
      notes: 'Pago de 3 meses: Enero, Febrero, Marzo 2025',
      paymentMethod: 'Transferencia Bancaria',
      unitId: 'PH-B2',
      ownerEmails: ['michael@landesman.com'], // TEST MODE: Override emails
      ownerPhone: '+52-555-123-4567'
    },
    {
      date: new Date(2025, 5, 15).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      receiptNumber: 'TXN-2025-001567',
      receivedFrom: 'María Isabel García Fernández',
      amount: 15750.00,
      amountInWords: 'Quince mil setecientos cincuenta pesos 00/100 M.N.',
      category: 'Cuota Especial - Pintura Edificio',
      notes: 'Pago único para proyecto de renovación de fachada',
      paymentMethod: 'Efectivo',
      unitId: 'A-301',
      ownerEmails: ['michael@landesman.com'], // TEST MODE: Override emails
      ownerPhone: '+52-555-987-6543'
    },
    {
      date: new Date(2025, 5, 20).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      receiptNumber: 'TXN-2025-001789',
      receivedFrom: 'Roberto Sánchez López',
      amount: 4200.00,
      amountInWords: 'Cuatro mil doscientos pesos 00/100 M.N.',
      category: 'Reembolso de Gastos',
      notes: 'Reembolso por reparación de tubería autorizada por administración',
      paymentMethod: 'Cheque',
      unitId: 'B-105',
      ownerEmails: ['michael@landesman.com'], // TEST MODE: Override emails
      ownerPhone: '+52-555-456-7890'
    }
  ];

  const sampleClientData = {
    id: 'MTC', // Required for email service
    name: 'Marina Turquesa Condominiums',
    logoUrl: 'https://firebasestorage.googleapis.com/v0/b/sandyland-management-system.firebasestorage.app/o/logos%2FMTC%2F1752549666390_MTC%20Logo%20Transparent.png?alt=media&token=e5438f60-db5b-4f8d-836b-31d3dcdfb53e'
  };

  const handleImageGenerated = (blob) => {
    setGeneratedBlob(blob);
    console.log('Receipt image generated:', blob);
  };

  const handleSampleChange = (index) => {
    setSelectedSample(index);
    setGeneratedBlob(null); // Reset generated blob when changing samples
  };

  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: '#f0f2f5',
      minHeight: '100vh'
    }}>
      <div style={{ 
        maxWidth: '1000px', 
        margin: '0 auto',
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '30px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ 
          textAlign: 'center', 
          color: '#0863bf',
          marginBottom: '10px',
          fontSize: '2.5rem'
        }}>
          Digital Receipt Demo
        </h1>
        
        <p style={{ 
          textAlign: 'center', 
          color: '#666',
          marginBottom: '30px',
          fontSize: '1.1rem'
        }}>
          Generate professional-looking receipts for HOA dues and special assessments
        </p>

        {/* Sample Selector */}
        <div style={{
          marginBottom: '30px',
          padding: '20px',
          backgroundColor: '#f8fbff',
          borderRadius: '12px',
          border: '2px solid #e3f2fd'
        }}>
          <h3 style={{ color: '#0863bf', marginBottom: '15px' }}>
            📋 Choose Sample Receipt Type
          </h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {sampleTransactions.map((transaction, index) => (
              <button
                key={index}
                onClick={() => handleSampleChange(index)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: selectedSample === index ? '2px solid #0863bf' : '2px solid #ddd',
                  backgroundColor: selectedSample === index ? '#e3f2fd' : 'white',
                  color: selectedSample === index ? '#0863bf' : '#666',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: selectedSample === index ? 'bold' : 'normal'
                }}
              >
                {transaction.category}
              </button>
            ))}
          </div>
        </div>

        <div style={{
          border: '2px dashed #0863bf',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '30px',
          backgroundColor: '#f8fbff'
        }}>
          <h3 style={{ color: '#0863bf', marginBottom: '15px' }}>
            📧 Email & WhatsApp Ready
          </h3>
          <p style={{ margin: '0', color: '#555' }}>
            This component generates high-quality PNG images that can be automatically attached to emails 
            or shared via WhatsApp when unit owners make payments. The receipt includes all necessary 
            payment details and features the Sandyland ocean-to-sand gradient background.
          </p>
        </div>

        <DigitalReceipt
          transactionData={sampleTransactions[selectedSample]}
          clientData={sampleClientData}
          onImageGenerated={handleImageGenerated}
          showPreview={true}
        />

        {generatedBlob && (
          <div style={{ 
            marginTop: '30px', 
            padding: '20px', 
            backgroundColor: '#e8f5e8',
            borderRadius: '8px',
            border: '1px solid #4caf50'
          }}>
            <h4 style={{ color: '#2e7d32', marginBottom: '10px' }}>
              ✅ Receipt Generated Successfully!
            </h4>
            <p style={{ margin: '0', color: '#2e7d32' }}>
              Image size: {Math.round(generatedBlob.size / 1024)} KB | 
              Type: {generatedBlob.type} | 
              Ready for email/WhatsApp sharing
            </p>
          </div>
        )}

        <div style={{ 
          marginTop: '40px',
          padding: '20px',
          backgroundColor: '#fff3e0',
          borderRadius: '8px',
          border: '1px solid #ff9800'
        }}>
          <h3 style={{ color: '#e65100', marginBottom: '15px' }}>
            🛠️ Implementation Features
          </h3>
          <ul style={{ color: '#bf360c', lineHeight: '1.6' }}>
            <li><strong>Background:</strong> Uses the same Sandyland gradient as the splash screen</li>
            <li><strong>Format:</strong> Resembles traditional tear-off receipt books with perforated edges</li>
            <li><strong>Export:</strong> Generates high-quality PNG images (800x600px at 2x scale)</li>
            <li><strong>Integration:</strong> Ready to integrate with email and WhatsApp sharing</li>
            <li><strong>Customization:</strong> Supports different transaction types and client branding</li>
            <li><strong>Multilingual:</strong> Spanish-language receipts for Mexican market</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DigitalReceiptDemo;