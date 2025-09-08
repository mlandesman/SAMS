import React, { useState } from 'react';
import DigitalReceipt from '../components/DigitalReceipt';
import './ReceiptDemo.css';

/**
 * Demo page to test the DigitalReceipt component
 * Shows the receipt with sample data and allows generation of image
 */
const ReceiptDemo = () => {
  const [imageBlob, setImageBlob] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);

  const handleImageGenerated = (blob) => {
    setImageBlob(blob);
    const url = URL.createObjectURL(blob);
    setImageUrl(url);
    console.log('Receipt image generated!', blob);
  };

  // Sample transaction data
  const sampleTransaction = {
    date: new Date().toLocaleDateString('es-MX', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }),
    receiptNumber: 'TXN-2025-001234',
    receivedFrom: 'Juan Carlos Méndez Rodríguez',
    amount: 2850.00,
    amountInWords: 'Dos mil ochocientos cincuenta pesos 00/100 M.N.',
    category: 'Cuotas de Mantenimiento',
    notes: 'Pago de 3 meses: Enero, Febrero, Marzo 2025',
    paymentMethod: 'Transferencia Bancaria',
    unitId: 'PH-B2'
  };

  const sampleClient = {
    name: 'Marina Turquesa Condominiums',
    logoUrl: 'https://firebasestorage.googleapis.com/v0/b/sandyland-management-system.firebasestorage.app/o/logos%2Fsandyland-properties-high-resolution-logo-transparent.png?alt=media&token=a39645c7-aa81-41a0-9b20-35086de026d0'
  };

  return (
    <div className="receipt-demo-container">
      <div className="demo-header">
        <h1>Digital Receipt Demo</h1>
        <p>
          This demonstrates the digital receipt component that generates 
          images for emailing or WhatsApp sharing to unit owners.
        </p>
      </div>

      <div className="demo-controls">
        <div className="sample-data">
          <h3>Sample Data Being Used:</h3>
          <div className="data-grid">
            <div className="data-item">
              <strong>Cliente:</strong> {sampleClient.name}
            </div>
            <div className="data-item">
              <strong>Unidad:</strong> {sampleTransaction.unitId}
            </div>
            <div className="data-item">
              <strong>Propietario:</strong> {sampleTransaction.receivedFrom}
            </div>
            <div className="data-item">
              <strong>Cantidad:</strong> ${sampleTransaction.amount.toLocaleString('es-MX')} MXN
            </div>
            <div className="data-item">
              <strong>Concepto:</strong> {sampleTransaction.category}
            </div>
            <div className="data-item">
              <strong>Método de Pago:</strong> {sampleTransaction.paymentMethod}
            </div>
          </div>
        </div>
      </div>

      <div className="receipt-section">
        <DigitalReceipt
          transactionData={sampleTransaction}
          clientData={sampleClient}
          onImageGenerated={handleImageGenerated}
          showPreview={true}
        />
      </div>

      {imageUrl && (
        <div className="generated-image-section">
          <h3>Generated Receipt Image:</h3>
          <div className="image-preview">
            <img src={imageUrl} alt="Generated Receipt" className="receipt-preview" />
          </div>
          <div className="image-info">
            <p>
              ✅ Receipt image generated successfully! 
              Size: {imageBlob ? Math.round(imageBlob.size / 1024) : 0}KB
            </p>
            <p>
              This image can now be attached to emails or shared via WhatsApp.
            </p>
          </div>
        </div>
      )}

      <div className="demo-features">
        <h3>Features Demonstrated:</h3>
        <ul>
          <li>🎨 Sandyland gradient background (ocean to sand)</li>
          <li>📄 Tear-off receipt book appearance with perforated edges</li>
          <li>🏢 Company logo and branding integration</li>
          <li>💰 Bilingual formatting (Spanish labels, currency formatting)</li>
          <li>📱 High-quality image generation for digital sharing</li>
          <li>✍️ Professional receipt layout with signature line</li>
          <li>📝 Support for notes and payment method details</li>
          <li>🔢 Amount in words (check-writing style in Spanish)</li>
        </ul>
      </div>
    </div>
  );
};

export default ReceiptDemo;
