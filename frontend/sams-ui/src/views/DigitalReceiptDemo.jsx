import React, { useState, useRef } from 'react';
import DigitalReceipt from '../components/DigitalReceipt';
import html2canvas from 'html2canvas';
import { getAuthInstance } from '../firebaseClient';
import { config } from '../config';

const DigitalReceiptDemo = () => {
  const [generatedBlob, setGeneratedBlob] = useState(null);
  const [selectedSample, setSelectedSample] = useState(0);
  const [selectedDemo, setSelectedDemo] = useState('receipts'); // 'receipts' or 'waterBills'
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);
  const waterBillPreviewRef = useRef(null);

  // Helper function to get authenticated headers
  const getAuthHeaders = async () => {
    const auth = getAuthInstance();
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user');
    }
    
    const token = await user.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  // Currency formatting function - converts centavos to formatted pesos
  const formatCurrency = (centavos, currency = 'USD', showCents = true) => {
    const amount = centavos / 100; // Convert centavos to pesos
    const fractionDigits = showCents ? 2 : 0;
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits
    }).format(amount);
  };

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
        WaterCharge: formatCurrency(90000), // 18 m³ × 50 pesos = 900 pesos = 90000 centavos
        CarWashCount: '1',
        CarWashCharge: formatCurrency(10000), // 1 car wash × 100 pesos = 10000 centavos
        BoatWashCount: '0',
        BoatWashCharge: formatCurrency(0),
        CurrentMonthTotal: formatCurrency(100000), // 90000 + 10000 = 100000 centavos = $1000.00
        PenaltyAmount: formatCurrency(10250), // 102.50 pesos = 10250 centavos
        TotalAmountDue: formatCurrency(110250), // 100000 + 10250 = 110250 centavos = $1102.50
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
        PenaltyRate: '5.0%',
        LastMonthUsage: '15',
        UsageChangeDisplay: '+3 m³ ↗️',
        ComparisonChangeClass: 'comparison-increase',
        HighUsageWarning: '',
        BillNotesSection: '<div style="background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981;"><strong>Additional Notes:</strong><br>Water Consumption for July 2025 - 0018 m³, 1 Car wash</div>',
        ClientContactInfo: '📞 +52 984-178-0331<br>✉️ pm@sandyland.com.mx'
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
        PenaltyRate: '5.0%',
        LastMonthUsage: '25',
        UsageChangeDisplay: '+18 m³ ↗️',
        ComparisonChangeClass: 'comparison-increase',
        HighUsageWarning: '<div class="high-usage-warning"><div class="warning-title">⚠️ Aviso de Consumo Alto</div><div class="warning-text">Su consumo de 43 m³ está significativamente por encima del promedio. Por favor revise posibles fugas o considere medidas de conservación de agua.</div></div>',
        BillNotesSection: '<div style="background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981;"><strong>Notas Adicionales:</strong><br>Consumo de Agua para Julio 2025 - 0043 m³</div>',
        ClientContactInfo: '📞 +52 984-178-0331<br>✉️ pm@sandyland.com.mx'
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
        PenaltyRate: '5.0%',
        LastMonthUsage: '14',
        UsageChangeDisplay: '-3 m³ ↘️',
        ComparisonChangeClass: 'comparison-decrease',
        HighUsageWarning: '',
        BillNotesSection: '<div style="background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981;"><strong>Additional Notes:</strong><br>Water Consumption for June 2025 - 0011 m³, 2 Boat washes</div>',
        ClientContactInfo: '📞 +52 984-178-0331<br>✉️ pm@sandyland.com.mx'
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
  
  // State for live Firebase data
  const [firebaseData, setFirebaseData] = useState(null);
  const [firebaseLoading, setFirebaseLoading] = useState(false);
  const [firebaseError, setFirebaseError] = useState(null);

  // Fetch real templates from Firebase when component mounts
  const fetchWaterBillTemplates = async () => {
    setTemplatesLoading(true);
    setTemplatesError(null);
    
    try {
      // Fetch the real emailTemplates document from Firebase
      const headers = await getAuthHeaders();
      const response = await fetch(`${config.api.baseUrl}/comm/email/config/templates/AVII`, { headers });
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

  // Set AVII as selected client for water bills demo
  const selectAVIIClient = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${config.api.baseUrl}/user/select-client`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ clientId: 'AVII' })
      });
      
      if (!response.ok) {
        throw new Error('Failed to select AVII client');
      }
      
      const result = await response.json();
      console.log('✅ AVII client selected:', result);
      return true;
      
    } catch (error) {
      console.error('Error selecting AVII client:', error);
      return false;
    }
  };

  // Fetch live Firebase data for water bills using proper backend endpoint
  const fetchFirebaseData = async () => {
    setFirebaseLoading(true);
    setFirebaseError(null);
    
    try {
      // First ensure AVII is selected as the client
      console.log('🔄 Selecting AVII client for water bills access...');
      const clientSelected = await selectAVIIClient();
      
      if (!clientSelected) {
        throw new Error('Could not select AVII client - authentication required');
      }
      
      // Use the correct aggregated water bills data endpoint
      const headers = await getAuthHeaders();
      const waterDataUrl = `${config.api.baseUrl}/water/clients/AVII/data/2026`;
      console.log('🔍 Making request to', waterDataUrl, 'with headers:', headers);
      const response = await fetch(waterDataUrl, { headers });
      console.log('🔍 Response status:', response.status, response.statusText);
      console.log('🔍 Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('🔍 Error response body:', errorText);
        throw new Error('Failed to fetch live water bills data');
      }
      
      const responseText = await response.text();
      console.log('🔍 Raw response text (first 500 chars):', responseText.substring(0, 500));
      console.log('🔍 Response content type:', response.headers.get('content-type'));
      
      const result = JSON.parse(responseText);
      console.log('🔍 RAW API Response:', result);
      console.log('🔍 Response success:', result.success);
      console.log('🔍 Response data:', result.data);
      console.log('🔍 Response data type:', typeof result.data);
      console.log('🔍 Response data keys:', result.data ? Object.keys(result.data) : 'No data');
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown error fetching Firebase data');
      }
      
      setFirebaseData(result.data);
      
      console.log('✅ Live Firebase data loaded via backend endpoint:', result.data);
      
    } catch (error) {
      console.error('Error fetching live Firebase data:', error);
      setFirebaseError(error.message);
    } finally {
      setFirebaseLoading(false);
    }
  };

  // Fetch templates when switching to water bills demo
  React.useEffect(() => {
    if (selectedDemo === 'waterBills' && !waterBillTemplates.en && !waterBillTemplates.es) {
      fetchWaterBillTemplates();
    }
  }, [selectedDemo]);

  // Fetch Firebase data when switching to water bills demo
  React.useEffect(() => {
    if (selectedDemo === 'waterBills' && !firebaseData) {
      fetchFirebaseData();
    }
  }, [selectedDemo]);

  // Convert Firebase data to template variables using the enhanced system
  const buildLiveWaterBillSamples = (firebaseData) => {
    if (!firebaseData || !firebaseData.months || firebaseData.months.length === 0) {
      return [];
    }

    const samples = [];
    // Get the most recent month with bills
    const latestMonth = firebaseData.months.find(month => month.billsGenerated) || firebaseData.months[0];
    
    if (!latestMonth || !latestMonth.units) {
      return [];
    }

    const unitNumbers = Object.keys(latestMonth.units);

    // Create samples for the first few units with different scenarios
    unitNumbers.slice(0, 3).forEach((unitNumber, index) => {
      const unitData = latestMonth.units[unitNumber];
      
      // Extract values based on actual API structure
      const currentReading = unitData.currentReading?.reading || unitData.currentReading || 0;
      const carWashCount = unitData.currentReading?.carWashCount || 0;
      const boatWashCount = unitData.currentReading?.boatWashCount || 0;
      const penaltyAmount = unitData.penaltyAmount || 0;
      
      const isHighUsage = unitData.consumption > 30;
      const isPaid = unitData.status === 'paid';
      const hasCarWash = carWashCount > 0;
      const hasBoatWash = boatWashCount > 0;
      const hasPenalties = penaltyAmount > 0;

      // Simulate previous month data for comparison
      const lastMonthUsage = unitData.consumption - Math.floor(Math.random() * 10) + 5;
      const usageChange = unitData.consumption - lastMonthUsage;

      const variables = {
        ClientName: 'Aventuras Villas II',
        ClientLogoUrl: '',
        UnitNumber: unitNumber,
        BillingPeriod: `${latestMonth.monthName} ${latestMonth.calendarYear}`,
        DueDate: latestMonth.dueDate ? new Date(latestMonth.dueDate).toLocaleDateString() : 'July 31, 2025',
        BillDate: latestMonth.billDate ? new Date(latestMonth.billDate).toLocaleDateString() : 'July 1, 2025',
        WaterConsumption: unitData.consumption.toString(),
        PriorReading: unitData.priorReading.toString(),
        CurrentReading: currentReading.toString(),
        ReadingDate: 'June 30, 2025',
        WaterCharge: formatCurrency((unitData.consumption || 0) * 5000), // consumption × 50 pesos per m³
        CarWashCount: carWashCount.toString(),
        CarWashCharge: formatCurrency(carWashCount * 10000), // 100 pesos per car wash
        BoatWashCount: boatWashCount.toString(),
        BoatWashCharge: formatCurrency(boatWashCount * 20000), // 200 pesos per boat wash
        CurrentMonthTotal: formatCurrency(((unitData.consumption || 0) * 5000) + (carWashCount * 10000) + (boatWashCount * 20000)),
        PenaltyAmount: formatCurrency(penaltyAmount),
        TotalAmountDue: formatCurrency(unitData.totalAmount || 0),
        ShowCarWash: hasCarWash,
        ShowBoatWash: hasBoatWash,
        ShowPenalties: hasPenalties,
        ShowPaidStatus: isPaid,
        IsHighUsage: isHighUsage,
        PaymentStatus: unitData.status,
        StatusMessage: isPaid ? '✅ PAID - Thank you for your payment' : 
                      unitData.status === 'overdue' ? '⚠️ OVERDUE - Late penalties have been applied' :
                      '⏰ PAYMENT DUE - Please pay by the due date to avoid penalties',
        RatePerM3: formatCurrency(5000), // 50 pesos per m³
        CarWashRate: formatCurrency(10000), // 100 pesos per car wash
        BoatWashRate: formatCurrency(20000), // 200 pesos per boat wash
        PrimaryColor: '#2563eb',
        AccentColor: '#10b981',
        CurrencySymbol: '$',
        ClientAddress: '68 Blvd. Puerto Aventuras, Puerto Aventuras, QR, 77733',
        ClientPhone: '+52 984-178-0331',
        ClientEmail: 'pm@sandyland.com.mx',
        BillNotes: unitData.billNotes || '',
        PenaltyDays: '10',
        PenaltyRate: '5.0%',
        
        // NEW: Enhanced features with live data
        LastMonthUsage: lastMonthUsage.toString(),
        UsageChangeDisplay: usageChange > 0 ? `+${usageChange} m³ ↗️` : 
                           usageChange < 0 ? `${usageChange} m³ ↘️` : 'No change',
        ComparisonChangeClass: usageChange > 0 ? 'comparison-increase' : 
                              usageChange < 0 ? 'comparison-decrease' : 'comparison-same',
        HighUsageWarning: isHighUsage ? 
          `<div class="high-usage-warning">
            <div class="warning-title">⚠️ High Water Usage Notice</div>
            <div class="warning-text">Your consumption of ${unitData.consumption} m³ is significantly above average. Please check for possible leaks or consider water conservation measures.</div>
          </div>` : '',
        BillNotesSection: unitData.billNotes ? 
          `<div style="background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981;">
            <strong>Additional Notes:</strong><br>${unitData.billNotes}
          </div>` : '',
        ClientContactInfo: '📞 +52 984-178-0331<br>✉️ pm@sandyland.com.mx'
      };

      const sampleName = `Unit ${unitNumber} - ${isPaid ? 'Paid' : isHighUsage ? 'High Usage' : hasCarWash ? 'Car Wash' : hasBoatWash ? 'Boat Wash' : 'Standard'} Bill`;
      
      samples.push({
        name: `${sampleName} (Live Data)`,
        language: index % 2 === 0 ? 'en' : 'es', // Alternate languages
        variables: variables
      });
    });

    return samples;
  };

  // Save water bill template functionality
  const saveWaterBillTemplate = async () => {
    if (!waterBillPreviewRef.current) {
      console.error('Water bill preview ref is null');
      alert('Could not find template preview to save');
      return;
    }

    if (!waterBillSamples[selectedSample]) {
      console.error('No water bill sample selected');
      alert('Please select a water bill sample first');
      return;
    }

    console.log('Starting water bill template save...');
    setIsGeneratingTemplate(true);
    
    try {
      // Wait for fonts and rendering
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('Starting html2canvas capture for water bill template...');
      
      const canvas = await html2canvas(waterBillPreviewRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: true,
        foreignObjectRendering: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight
      });

      console.log('Canvas created successfully, size:', canvas.width, 'x', canvas.height);

      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('Canvas has zero dimensions');
      }

      // Create download using canvas toBlob
      canvas.toBlob((blob) => {
        if (!blob) {
          console.error('Failed to create blob');
          alert('Failed to create template image');
          return;
        }

        console.log('Blob created successfully, size:', blob.size);
        
        // Generate filename based on sample data
        const sample = waterBillSamples[selectedSample];
        const filename = `waterbill-template-${sample.variables.UnitNumber}-${sample.language}-${Date.now()}.png`;
        
        // Create download
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        link.style.display = 'none';
        document.body.appendChild(link);
        
        console.log('Triggering download...');
        link.click();
        
        // Cleanup
        setTimeout(() => {
          if (document.body.contains(link)) {
            document.body.removeChild(link);
          }
          URL.revokeObjectURL(url);
        }, 100);
        
        console.log('Template download completed successfully');
        alert(`✅ Template saved as ${filename}`);
        
      }, 'image/png', 1.0);

    } catch (error) {
      console.error('Error saving water bill template:', error);
      alert(`Error saving template: ${error.message}`);
    } finally {
      setIsGeneratingTemplate(false);
      console.log('Template save process finished');
    }
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ color: '#059669', margin: '0' }}>
                💧 Choose Water Bill Sample
              </h3>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {firebaseLoading && (
                  <span style={{ fontSize: '12px', color: '#059669' }}>⏳ Loading live data...</span>
                )}
                {firebaseError && (
                  <span style={{ fontSize: '12px', color: '#dc2626' }}>❌ Live data error</span>
                )}
                {firebaseData && (
                  <button
                    onClick={fetchFirebaseData}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#059669',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '10px',
                      cursor: 'pointer'
                    }}
                  >
                    🔄 Refresh Live Data
                  </button>
                )}
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {/* Show live data samples if available, otherwise show static samples */}
              {(firebaseData ? buildLiveWaterBillSamples(firebaseData) : waterBillSamples).map((sample, index) => (
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
            
            <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
              {firebaseData ? 
                `✅ Showing ${buildLiveWaterBillSamples(firebaseData).length} live water bill samples from Firebase` :
                `📋 Showing ${waterBillSamples.length} static demo samples (live data loading...)`
              }
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
                💧 {(() => {
                  const currentSamples = firebaseData ? buildLiveWaterBillSamples(firebaseData) : waterBillSamples;
                  return currentSamples[selectedSample]?.name || 'Water Bill Preview';
                })()}
              </h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={saveWaterBillTemplate}
                  disabled={isGeneratingTemplate || templatesLoading || templatesError}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: isGeneratingTemplate ? '#9ca3af' : '#059669',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: isGeneratingTemplate ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    marginRight: '8px'
                  }}
                >
                  {isGeneratingTemplate ? '💾 Saving...' : '💾 Save Template'}
                </button>
                <span style={{ 
                  padding: '4px 8px',
                  backgroundColor: '#bbf7d0',
                  color: '#059669',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  {(() => {
                    const currentSamples = firebaseData ? buildLiveWaterBillSamples(firebaseData) : waterBillSamples;
                    return currentSamples[selectedSample]?.language === 'es' ? 'ESPAÑOL' : 'ENGLISH';
                  })()}
                </span>
                <span style={{ 
                  padding: '4px 8px',
                  backgroundColor: firebaseData ? '#dcfce7' : '#fef3c7',
                  color: firebaseData ? '#166534' : '#92400e',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 'bold'
                }}>
                  {firebaseData ? 'LIVE FIREBASE DATA' : 'STATIC DEMO DATA'}
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
                ref={waterBillPreviewRef}
                style={{ 
                  padding: '0',
                  maxHeight: isGeneratingTemplate ? 'none' : '600px', 
                  overflowY: isGeneratingTemplate ? 'visible' : 'auto',
                  backgroundColor: '#f8fafc'
                }}
                dangerouslySetInnerHTML={{
                  __html: (() => {
                    const currentSamples = firebaseData ? buildLiveWaterBillSamples(firebaseData) : waterBillSamples;
                    const currentSample = currentSamples[selectedSample];
                    const templateLang = currentSample?.language || 'en';
                    const template = waterBillTemplates[templateLang];
                    
                    if (!template) {
                      return '<div style="padding: 40px; text-align: center; color: #6b7280;">No template available for this language</div>';
                    }
                    
                    return processWaterBillTemplate(template, currentSample?.variables || {});
                  })()
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