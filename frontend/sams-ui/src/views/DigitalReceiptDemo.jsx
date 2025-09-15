import React, { useState } from 'react';
import DigitalReceipt from '../components/DigitalReceipt';

const DigitalReceiptDemo = () => {
  const [generatedBlob, setGeneratedBlob] = useState(null);
  const [selectedSample, setSelectedSample] = useState(0);
  const [selectedDemo, setSelectedDemo] = useState('receipts'); // 'receipts' or 'waterBills'

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

  // Water bill template samples with processed variables (real AVII data)
  const waterBillSamples = [
    {
      name: 'Unit 101 - Payment Receipt (English)',
      language: 'en',
      variables: {
        ClientName: 'Aventuras Villas II',
        ClientLogoUrl: '',
        UnitNumber: '101',
        BillingPeriod: 'July 2025',
        DueDate: 'July 31, 2025',
        BillDate: 'July 1, 2025',
        WaterConsumption: '18',
        PriorReading: '1749',
        CurrentReading: '1767',
        ReadingDate: 'June 30, 2025',
        WaterCharge: '$9.00',
        CarWashCount: '1',
        CarWashCharge: '$1.00',
        BoatWashCount: '0',
        BoatWashCharge: '$0.00',
        CurrentMonthTotal: '$10.00',
        PenaltyAmount: '$0.00',
        TotalAmountDue: '$10.00',
        ShowCarWash: true,
        ShowBoatWash: false,
        ShowPenalties: false,
        ShowPaidStatus: true,
        IsHighUsage: false,
        PaymentStatus: 'paid',
        StatusMessage: '✅ PAID - Thank you for your payment',
        RatePerM3: '$0.50',
        CarWashRate: '$1.00',
        BoatWashRate: '$2.00',
        PrimaryColor: '#2563eb',
        AccentColor: '#10b981',
        CurrencySymbol: '$',
        ClientAddress: '68 Blvd. Puerto Aventuras, Puerto Aventuras, QR, 77733',
        ClientPhone: '+52 984-178-0331',
        ClientEmail: 'pm@sandyland.com.mx',
        BillNotes: 'Water Consumption for July 2025 - 0018 m³, 1 Car wash',
        PenaltyDays: '10',
        PenaltyRate: '5.0%'
      }
    },
    {
      name: 'Unit 203 - High Usage Bill (Spanish)',
      language: 'es',
      variables: {
        ClientName: 'Aventuras Villas II',
        ClientLogoUrl: '',
        UnitNumber: '203',
        BillingPeriod: 'Julio 2025',
        DueDate: '31 de julio de 2025',
        BillDate: '1 de julio de 2025',
        WaterConsumption: '43',
        PriorReading: '1576',
        CurrentReading: '1619',
        ReadingDate: '30 de junio de 2025',
        WaterCharge: '$21.50',
        CarWashCount: '0',
        CarWashCharge: '$0.00',
        BoatWashCount: '0',
        BoatWashCharge: '$0.00',
        CurrentMonthTotal: '$21.50',
        PenaltyAmount: '$0.00',
        TotalAmountDue: '$21.50',
        ShowCarWash: false,
        ShowBoatWash: false,
        ShowPenalties: false,
        ShowPaidStatus: false,
        IsHighUsage: true,
        PaymentStatus: 'unpaid',
        StatusMessage: '⏰ PAGO PENDIENTE - Por favor pague antes de la fecha límite para evitar recargos',
        RatePerM3: '$0.50',
        CarWashRate: '$1.00',
        BoatWashRate: '$2.00',
        PrimaryColor: '#2563eb',
        AccentColor: '#10b981',
        CurrencySymbol: '$',
        ClientAddress: '68 Blvd. Puerto Aventuras, Puerto Aventuras, QR, 77733',
        ClientPhone: '+52 984-178-0331',
        ClientEmail: 'pm@sandyland.com.mx',
        BillNotes: 'Consumo de Agua para Julio 2025 - 0043 m³',
        PenaltyDays: '10',
        PenaltyRate: '5.0%'
      }
    },
    {
      name: 'Unit 106 - Overdue Bill (English)',
      language: 'en',
      variables: {
        ClientName: 'Aventuras Villas II',
        ClientLogoUrl: '',
        UnitNumber: '106',
        BillingPeriod: 'June 2025',
        DueDate: 'June 30, 2025',
        BillDate: 'June 1, 2025',
        WaterConsumption: '11',
        PriorReading: '1340',
        CurrentReading: '1351',
        ReadingDate: 'May 31, 2025',
        WaterCharge: '$5.50',
        CarWashCount: '0',
        CarWashCharge: '$0.00',
        BoatWashCount: '2',
        BoatWashCharge: '$4.00',
        CurrentMonthTotal: '$9.50',
        PenaltyAmount: '$0.48',
        TotalAmountDue: '$9.98',
        ShowCarWash: false,
        ShowBoatWash: true,
        ShowPenalties: true,
        ShowPaidStatus: false,
        IsHighUsage: false,
        PaymentStatus: 'overdue',
        StatusMessage: '⚠️ OVERDUE - Late penalties have been applied',
        RatePerM3: '$0.50',
        CarWashRate: '$1.00',
        BoatWashRate: '$2.00',
        PrimaryColor: '#2563eb',
        AccentColor: '#10b981',
        CurrencySymbol: '$',
        ClientAddress: '68 Blvd. Puerto Aventuras, Puerto Aventuras, QR, 77733',
        ClientPhone: '+52 984-178-0331',
        ClientEmail: 'pm@sandyland.com.mx',
        BillNotes: 'Water Consumption for June 2025 - 0011 m³, 2 Boat washes',
        PenaltyDays: '10',
        PenaltyRate: '5.0%'
      }
    }
  ];

  const handleImageGenerated = (blob) => {
    setGeneratedBlob(blob);
    console.log('Receipt image generated:', blob);
  };

  const handleSampleChange = (index) => {
    setSelectedSample(index);
    setGeneratedBlob(null); // Reset generated blob when changing samples
  };

  // Water bill template processing function - simple and clean
  const processWaterBillTemplate = (template, variables) => {
    if (!template) {
      return '<div style="padding: 40px; text-align: center; color: #dc2626;">No template available</div>';
    }
    
    let processedTemplate = template;
    
    // Replace {{Variable}} format in template with variable values
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      processedTemplate = processedTemplate.replace(regex, String(value || ''));
    });
    
    // Handle Handlebars conditionals
    // {{#if condition}} ... {{/if}}
    processedTemplate = processedTemplate.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
      const conditionValue = variables[condition];
      return conditionValue ? content : '';
    });
    
    // {{#if condition}} ... {{else}} ... {{/if}}
    processedTemplate = processedTemplate.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, ifContent, elseContent) => {
      const conditionValue = variables[condition];
      return conditionValue ? ifContent : elseContent;
    });
    
    return processedTemplate;
  };

  // State for storing real Firebase templates
  const [waterBillTemplates, setWaterBillTemplates] = useState({ en: null, es: null });
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState(null);

  // Fetch real templates from Firebase when component mounts
  const fetchWaterBillTemplates = async () => {
    setTemplatesLoading(true);
    setTemplatesError(null);
    
    try {
      // Fetch the real emailTemplates document from Firebase
      const response = await fetch('/comm/email/config/templates/AVII');
      if (!response.ok) {
        throw new Error('Failed to fetch water bill templates');
      }
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Unknown error fetching templates');
      }
      
      // Extract the actual templates from Firebase emailTemplates document
      const emailTemplates = result.data;
      const waterBillTemplates = emailTemplates.waterBill;
      
      if (!waterBillTemplates) {
        throw new Error('Water bill templates not found in emailTemplates document');
      }
      
      setWaterBillTemplates({
        en: waterBillTemplates.body_en || null,
        es: waterBillTemplates.body_es || null
      });
      
      console.log('✅ Real Firebase templates loaded:', {
        en: !!waterBillTemplates.body_en,
        es: !!waterBillTemplates.body_es,
        enLength: waterBillTemplates.body_en?.length,
        esLength: waterBillTemplates.body_es?.length
      });
      
      // Debug: Show sample of template content
      if (waterBillTemplates.body_en) {
        console.log('📧 English template sample:', waterBillTemplates.body_en.substring(0, 500));
      }
      
    } catch (error) {
      console.error('Error fetching water bill templates:', error);
      setTemplatesError(error.message);
    } finally {
      setTemplatesLoading(false);
    }
  };

  // Fetch templates when switching to water bills demo
  React.useEffect(() => {
    if (selectedDemo === 'waterBills' && !waterBillTemplates.en && !waterBillTemplates.es) {
      fetchWaterBillTemplates();
    }
  }, [selectedDemo]);

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
          Email Templates Demo
        </h1>
        
        <p style={{ 
          textAlign: 'center', 
          color: '#666',
          marginBottom: '30px',
          fontSize: '1.1rem'
        }}>
          Preview professional email templates for receipts and water bills
        </p>

        {/* Demo Type Selector */}
        <div style={{
          marginBottom: '30px',
          padding: '20px',
          backgroundColor: '#f0f8ff',
          borderRadius: '12px',
          border: '2px solid #0863bf'
        }}>
          <h3 style={{ color: '#0863bf', marginBottom: '15px' }}>
            📧 Choose Email Template Type
          </h3>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
            <button
              onClick={() => setSelectedDemo('receipts')}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: selectedDemo === 'receipts' ? '3px solid #0863bf' : '2px solid #ddd',
                backgroundColor: selectedDemo === 'receipts' ? '#0863bf' : 'white',
                color: selectedDemo === 'receipts' ? 'white' : '#666',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: selectedDemo === 'receipts' ? 'bold' : 'normal'
              }}
            >
              📄 Payment Receipts
            </button>
            <button
              onClick={() => setSelectedDemo('waterBills')}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: selectedDemo === 'waterBills' ? '3px solid #0863bf' : '2px solid #ddd',
                backgroundColor: selectedDemo === 'waterBills' ? '#0863bf' : 'white',
                color: selectedDemo === 'waterBills' ? 'white' : '#666',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: selectedDemo === 'waterBills' ? 'bold' : 'normal'
              }}
            >
              💧 Water Bills
            </button>
          </div>
        </div>

        {/* Sample Selector */}
        {selectedDemo === 'receipts' && (
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
        )}

        {/* Water Bill Sample Selector */}
        {selectedDemo === 'waterBills' && (
          <div style={{
            marginBottom: '30px',
            padding: '20px',
            backgroundColor: '#f0fdf4',
            borderRadius: '12px',
            border: '2px solid #bbf7d0'
          }}>
            <h3 style={{ color: '#059669', marginBottom: '15px' }}>
              💧 Choose Water Bill Sample (Real AVII Data)
            </h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {waterBillSamples.map((sample, index) => (
                <button
                  key={index}
                  onClick={() => handleSampleChange(index)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: selectedSample === index ? '2px solid #059669' : '2px solid #ddd',
                    backgroundColor: selectedSample === index ? '#bbf7d0' : 'white',
                    color: selectedSample === index ? '#059669' : '#666',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: selectedSample === index ? 'bold' : 'normal'
                  }}
                >
                  {sample.name}
                </button>
              ))}
            </div>
          </div>
        )}

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
            {selectedDemo === 'receipts' 
              ? 'This component generates high-quality PNG images that can be automatically attached to emails or shared via WhatsApp when unit owners make payments. The receipt includes all necessary payment details and features the Sandyland ocean-to-sand gradient background.'
              : 'Professional water bill email templates with real AVII data, bilingual support, and mobile-responsive design. Features GAAP-compliant billing with service charges, penalty calculations, and AVII branding.'
            }
          </p>
        </div>

        {/* Receipts Preview */}
        {selectedDemo === 'receipts' && (
          <DigitalReceipt
            transactionData={sampleTransactions[selectedSample]}
            clientData={sampleClientData}
            onImageGenerated={handleImageGenerated}
            showPreview={true}
          />
        )}

        {/* Water Bills Preview */}
        {selectedDemo === 'waterBills' && (
          <div style={{ 
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            overflow: 'hidden',
            backgroundColor: 'white'
          }}>
            <div style={{
              padding: '15px',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: '0', color: '#059669' }}>
                💧 {waterBillSamples[selectedSample]?.name || 'Water Bill Preview'}
              </h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ 
                  padding: '4px 8px',
                  backgroundColor: '#bbf7d0',
                  color: '#059669',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  {waterBillSamples[selectedSample]?.language === 'es' ? 'ESPAÑOL' : 'ENGLISH'}
                </span>
                <span style={{ 
                  padding: '4px 8px',
                  backgroundColor: '#fef3c7',
                  color: '#92400e',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 'bold'
                }}>
                  REAL FIREBASE DATA
                </span>
              </div>
            </div>
            
            {/* Loading State */}
            {templatesLoading && (
              <div style={{ 
                padding: '40px',
                textAlign: 'center',
                backgroundColor: '#f8fafc',
                color: '#6b7280'
              }}>
                <div style={{ marginBottom: '10px' }}>⏳ Loading real Firebase templates...</div>
                <div style={{ fontSize: '12px' }}>Fetching emailTemplates from clients/AVII/config/emailTemplates</div>
              </div>
            )}
            
            {/* Error State */}
            {templatesError && (
              <div style={{ 
                padding: '40px',
                textAlign: 'center',
                backgroundColor: '#fef2f2',
                color: '#dc2626'
              }}>
                <div style={{ marginBottom: '10px' }}>❌ Error loading templates</div>
                <div style={{ fontSize: '12px' }}>{templatesError}</div>
                <button
                  onClick={fetchWaterBillTemplates}
                  style={{
                    marginTop: '10px',
                    padding: '8px 16px',
                    backgroundColor: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Retry
                </button>
              </div>
            )}
            
            {/* Template Preview */}
            {!templatesLoading && !templatesError && (
              <div 
                style={{ 
                  padding: '0',
                  maxHeight: '600px', 
                  overflowY: 'auto',
                  backgroundColor: '#f8fafc'
                }}
                dangerouslySetInnerHTML={{
                  __html: waterBillTemplates[waterBillSamples[selectedSample]?.language || 'en'] 
                    ? processWaterBillTemplate(
                        waterBillTemplates[waterBillSamples[selectedSample]?.language || 'en'],
                        waterBillSamples[selectedSample]?.variables || {}
                      )
                    : '<div style="padding: 40px; text-align: center; color: #6b7280;">No template available for this language</div>'
                }}
              />
            )}
          </div>
        )}

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
          {selectedDemo === 'receipts' ? (
            <ul style={{ color: '#bf360c', lineHeight: '1.6' }}>
              <li><strong>Background:</strong> Uses the same Sandyland gradient as the splash screen</li>
              <li><strong>Format:</strong> Resembles traditional tear-off receipt books with perforated edges</li>
              <li><strong>Export:</strong> Generates high-quality PNG images (800x600px at 2x scale)</li>
              <li><strong>Integration:</strong> Ready to integrate with email and WhatsApp sharing</li>
              <li><strong>Customization:</strong> Supports different transaction types and client branding</li>
              <li><strong>Multilingual:</strong> Spanish-language receipts for Mexican market</li>
            </ul>
          ) : (
            <ul style={{ color: '#bf360c', lineHeight: '1.6' }}>
              <li><strong>Real Data:</strong> Uses actual AVII water bill data with GAAP compliance</li>
              <li><strong>Bilingual:</strong> English and Spanish templates with proper translations</li>
              <li><strong>Mobile-Responsive:</strong> Professional layout optimized for all email clients</li>
              <li><strong>Service Charges:</strong> Car wash and boat wash with real pricing ($1.00 / $2.00)</li>
              <li><strong>Conditional Logic:</strong> High usage warnings, penalty notices, payment status</li>
              <li><strong>AVII Branding:</strong> Real client colors and contact information</li>
              <li><strong>Currency Formatting:</strong> Mexican peso formatting with centavos conversion</li>
              <li><strong>Timezone Handling:</strong> America/Cancun timezone with proper date formatting</li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default DigitalReceiptDemo;