/**
 * StatementTextGenerator - Plain text statement generation service
 * Converts aggregated statement data into readable plain text format
 */

import { DateTime } from 'luxon';
import { formatCurrency } from '../utils/currencyUtils.js';

export class StatementTextGenerator {
  /**
   * Generate complete plain text statement
   * @param {Object} statementData - JSON from StatementService.aggregateStatementData()
   * @param {Object} userProfile - User profile (for language preference)
   * @param {Object} clientInfo - Client information (for banking details)
   * @param {Object} unitInfo - Unit information (for owner name, unit ID)
   * @returns {string} Plain text statement
   */
  generatePlainText(statementData, userProfile, clientInfo, unitInfo) {
    const language = userProfile.preferredLanguage || 'english';
    const isSpanish = language === 'spanish';
    
    const lines = [];
    
    // Header
    lines.push(...this._generateHeader(userProfile, clientInfo, unitInfo, statementData.data.statementPeriod, isSpanish));
    lines.push('');
    
    // Banking Information
    lines.push(...this._generateBankingInfo(clientInfo, isSpanish));
    lines.push('');
    
    // HOA Dues Section
    if (statementData.data.hoaDues.transactions.length > 0) {
      lines.push(...this._generateHoaDuesSection(statementData.data.hoaDues, isSpanish));
      lines.push('');
    }
    
    // Water Bills Section
    if (statementData.data.waterBills.transactions.length > 0) {
      lines.push(...this._generateWaterBillsSection(statementData.data.waterBills, isSpanish));
      lines.push('');
    }
    
    // Footer
    lines.push(...this._generateFooter(statementData.data.summary, isSpanish, clientInfo));
    
    return lines.join('\n');
  }

  /**
   * Generate header section
   * @param {Object} userProfile - User profile
   * @param {Object} clientInfo - Client information
   * @param {Object} unitInfo - Unit information
   * @param {Object} statementPeriod - { start: string, end: string }
   * @param {boolean} isSpanish - Whether to use Spanish
   * @returns {Array<string>} Header lines
   * @private
   */
  _generateHeader(userProfile, clientInfo, unitInfo, statementPeriod, isSpanish) {
    const lines = [];
    
    // Client logo placeholder
    lines.push('[CLIENT LOGO]');
    lines.push('');
    
    // Report title
    const title = isSpanish ? 'ESTADO DE CUENTA' : 'STATEMENT OF ACCOUNT';
    lines.push(title);
    lines.push('');
    
    // Unit owner
    const ownerLabel = isSpanish ? 'Propietario:' : 'Unit Owner:';
    lines.push(`${ownerLabel} ${unitInfo.ownerName || 'N/A'}`);
    
    // Unit ID
    const unitLabel = isSpanish ? 'Unidad:' : 'Unit:';
    lines.push(`${unitLabel} ${unitInfo.unitNumber || unitInfo.unitId || 'N/A'}`);
    
    // Statement period
    const periodLabel = isSpanish ? 'Período del Estado:' : 'Statement Period:';
    const startDate = this._formatDate(statementPeriod.start);
    const endDate = this._formatDate(statementPeriod.end);
    lines.push(`${periodLabel} ${startDate} - ${endDate}`);
    
    // Generated date
    const generatedLabel = isSpanish ? 'Generado:' : 'Generated:';
    const currentDate = this._formatDate(new Date().toISOString());
    lines.push(`${generatedLabel} ${currentDate}`);
    
    return lines;
  }

  /**
   * Generate banking information section
   * @param {Object} clientInfo - Client information
   * @param {boolean} isSpanish - Whether to use Spanish
   * @returns {Array<string>} Banking info lines
   * @private
   */
  _generateBankingInfo(clientInfo, isSpanish) {
    const lines = [];
    
    const sectionTitle = isSpanish ? 'INFORMACIÓN BANCARIA' : 'BANKING INFORMATION';
    lines.push(sectionTitle);
    
    // Get bank details from feeStructure.bankDetails
    const bankDetails = clientInfo.feeStructure?.bankDetails || {};
    
    const bankLabel = isSpanish ? 'Banco:' : 'Bank:';
    const branchLabel = isSpanish ? 'Sucursal:' : 'Branch:';
    const accountLabel = isSpanish ? 'Cuenta:' : 'Account:';
    const clabeLabel = isSpanish ? 'CLABE:' : 'CLABE:';
    const beneficiaryLabel = isSpanish ? 'Beneficiario:' : 'Beneficiary:';
    const referenceLabel = isSpanish ? 'Referencia:' : 'Reference:';
    const swiftLabel = 'SWIFT:';
    
    const bankName = bankDetails.bankName || bankDetails.name;
    if (bankName) {
      lines.push(`${bankLabel} ${bankName}`);
    }
    
    if (bankDetails.branch) {
      lines.push(`${branchLabel} ${bankDetails.branch}`);
    }
    
    const accountNumber = bankDetails.accountNumber || bankDetails.account || bankDetails.accountNo;
    if (accountNumber) {
      lines.push(`${accountLabel} ${accountNumber}`);
    }
    
    if (bankDetails.clabe) {
      lines.push(`${clabeLabel} ${bankDetails.clabe}`);
    }
    
    const beneficiary = bankDetails.accountName || bankDetails.beneficiary || clientInfo.name;
    if (beneficiary) {
      lines.push(`${beneficiaryLabel} ${beneficiary}`);
    }
    
    if (bankDetails.reference) {
      lines.push(`${referenceLabel} ${bankDetails.reference}`);
    }
    
    if (bankDetails.swiftCode) {
      lines.push(`${swiftLabel} ${bankDetails.swiftCode}`);
    }
    
    if (lines.length === 1) {
      // Only title so far, add default line
      lines.push(isSpanish ? 'Información bancaria no disponible' : 'Banking details not available');
    }
    
    return lines;
  }

  /**
   * Generate HOA Dues section
   * @param {Object} hoaDuesData - HOA Dues data with transactions and subtotals
   * @param {boolean} isSpanish - Whether to use Spanish
   * @returns {Array<string>} HOA Dues section lines
   * @private
   */
  _generateHoaDuesSection(hoaDuesData, isSpanish) {
    const lines = [];
    
    const sectionTitle = isSpanish ? 'BALANCE MANTENIMIENTO' : 'BALANCE MAINTENANCE FEES';
    lines.push(sectionTitle);
    lines.push('─'.repeat(60));
    
    // Column headers
    const headers = this._generateTableHeaders(isSpanish);
    lines.push(headers);
    lines.push('─'.repeat(60));
    
    // Transaction rows
    hoaDuesData.transactions.forEach(tx => {
      lines.push(this._formatTransactionRow(tx, isSpanish));
    });
    
    lines.push('─'.repeat(60));
    
    // Section subtotal
    const subtotalLabel = isSpanish ? 'BALANCE MANTENIMIENTO:' : 'BALANCE MAINTENANCE FEES:';
    const subtotalAmount = this._formatCurrency(hoaDuesData.runningBalance);
    lines.push(`${subtotalLabel} ${subtotalAmount}`);
    
    return lines;
  }

  /**
   * Generate Water Bills section
   * @param {Object} waterBillsData - Water Bills data with transactions and subtotals
   * @param {boolean} isSpanish - Whether to use Spanish
   * @returns {Array<string>} Water Bills section lines
   * @private
   */
  _generateWaterBillsSection(waterBillsData, isSpanish) {
    const lines = [];
    
    const sectionTitle = isSpanish ? 'BALANCE CONSUMO DE AGUA' : 'BALANCE WATER CONSUMPTION';
    lines.push(sectionTitle);
    lines.push('─'.repeat(60));
    
    // Column headers
    const headers = this._generateTableHeaders(isSpanish);
    lines.push(headers);
    lines.push('─'.repeat(60));
    
    // Transaction rows
    waterBillsData.transactions.forEach(tx => {
      lines.push(this._formatTransactionRow(tx, isSpanish));
    });
    
    lines.push('─'.repeat(60));
    
    // Section subtotal
    const subtotalLabel = isSpanish ? 'BALANCE CONSUMO DE AGUA:' : 'WATER BALANCE:';
    const subtotalAmount = this._formatCurrency(waterBillsData.runningBalance);
    lines.push(`${subtotalLabel} ${subtotalAmount}`);
    
    return lines;
  }

  /**
   * Generate footer section
   * @param {Object} summary - Summary statistics
   * @param {boolean} isSpanish - Whether to use Spanish
   * @param {Object} clientInfo - Client information (for contact info)
   * @returns {Array<string>} Footer lines
   * @private
   */
  _generateFooter(summary, isSpanish, clientInfo) {
    const lines = [];
    
    lines.push('─'.repeat(60));
    
    // Credit Balance
    if (summary.creditBalance > 0) {
      const creditLabel = isSpanish ? 'CRÉDITO DISPONIBLE:' : 'CREDIT BALANCE:';
      const creditAmount = this._formatCurrency(summary.creditBalance);
      lines.push(`${creditLabel} ${creditAmount}`);
    }
    
    // Total balance
    const totalLabel = isSpanish ? 'SALDO TOTAL:' : 'TOTAL BALANCE:';
    const totalAmount = this._formatCurrency(summary.totalBalance);
    lines.push(`${totalLabel} ${totalAmount}`);
    
    lines.push('─'.repeat(60));
    lines.push('');
    
    // Payment terms
    const termsLabel = isSpanish ? 'TÉRMINOS DE PAGO:' : 'PAYMENT TERMS:';
    lines.push(termsLabel);
    
    if (isSpanish) {
      lines.push('• El consumo de agua debe pagarse dentro de los primeros 10 días del mes correspondiente,');
      lines.push('  después de lo cual habrá un interés del 5% por mes.');
      lines.push('• Las cuotas de mantenimiento deben pagarse dentro del primer mes del trimestre correspondiente,');
      lines.push('  después de lo cual habrá un interés del 5% por mes según lo aprobado por la Asamblea de');
      lines.push('  Propietarios del Condominio.');
      lines.push('• Los pagos se aplican primero a las penalizaciones y luego a las cuotas más antiguas según');
      lines.push('  se indica en los artículos 2281 y 2282 del Código Civil del Estado de Quintana Roo.');
      lines.push('• Por razones de seguridad, no recibimos efectivo. Por favor, realice su pago en la cuenta');
      lines.push('  bancaria del condominio y envíenos su recibo.');
    } else {
      lines.push('• Water consumption must be paid within the first 10 days of the corresponding month,');
      lines.push('  after which there will be 5% interest per month.');
      lines.push('• Maintenance fees must be paid within the first month of the corresponding quarter,');
      lines.push('  after which there will be 5% interest per month as approved by the Condominium');
      lines.push('  Owners\' Meeting.');
      lines.push('• Payments are applied first to penalties and then to the oldest installments as');
      lines.push('  indicated in articles 2281 and 2282 of the Civil Code of the State of Quintana Roo.');
      lines.push('• For security reasons, we do not receive cash. Please make your payment in the');
      lines.push('  condominium\'s bank account and send us your receipt.');
    }
    
    lines.push('');
    
    // Contact information
    const contactLabel = isSpanish ? '¿Preguntas? Contacto:' : 'Questions? Contact:';
    const contactInfo = clientInfo.contactInfo?.email || clientInfo.contactInfo?.phone || 'N/A';
    lines.push(`${contactLabel} ${contactInfo}`);
    
    return lines;
  }

  /**
   * Generate table headers
   * @param {boolean} isSpanish - Whether to use Spanish
   * @returns {string} Formatted header row
   * @private
   */
  _generateTableHeaders(isSpanish) {
    if (isSpanish) {
      return 'FECHA      | DESCRIPCIÓN                    | FACTURA/RECIBO | MONTO      | PENALIZACIÓN | PAGOS      | SALDO';
    } else {
      return 'DATE       | DESCRIPTION                    | INVOICE/RECEIPT | AMOUNT     | PENALTY      | PAYMENTS   | BALANCE';
    }
  }

  /**
   * Format transaction row
   * @param {Object} tx - Transaction object
   * @param {boolean} isSpanish - Whether to use Spanish
   * @returns {string} Formatted transaction row
   * @private
   */
  _formatTransactionRow(tx, isSpanish) {
    const date = this._formatDate(tx.date);
    const description = (tx.description || '').substring(0, 28).padEnd(28);
    
    // Invoice/Receipt: Only show payment date for payments, otherwise blank
    // For bills without payments, this column should be blank
    let invoiceReceipt = '';
    if (tx.paymentDate) {
      invoiceReceipt = this._formatDate(tx.paymentDate);
    } else if (tx.payments > 0) {
      // If there's a payment, show the payment date
      // For payment transactions, tx.date is the payment date
      if (tx.type === 'payment') {
        invoiceReceipt = this._formatDate(tx.date);
      } else if (tx.invoiceReceipt && tx.invoiceReceipt !== 'N/A') {
        // Clean transaction ID: remove underscore and everything after it to get date
        // e.g., "2025-11-08_095" -> "2025-11-08"
        const cleanedRef = tx.invoiceReceipt.split('_')[0];
        // If it looks like a date (YYYY-MM-DD format), format it
        if (cleanedRef.match(/^\d{4}-\d{2}-\d{2}$/)) {
          invoiceReceipt = this._formatDate(cleanedRef);
        } else {
          invoiceReceipt = cleanedRef;
        }
      }
    }
    invoiceReceipt = invoiceReceipt.substring(0, 14).padEnd(14);
    
    const amount = this._formatCurrency(tx.amount).padStart(10);
    const penalty = tx.penalty > 0 ? this._formatCurrency(tx.penalty).padStart(12) : ''.padStart(12);
    const payments = tx.payments > 0 ? this._formatCurrency(tx.payments).padStart(10) : ''.padStart(10);
    const balance = this._formatCurrency(tx.balance || 0).padStart(10);
    
    return `${date} | ${description} | ${invoiceReceipt} | ${amount} | ${penalty} | ${payments} | ${balance}`;
  }

  /**
   * Format date as MM/DD/YYYY
   * @param {Date|string} date - Date to format
   * @returns {string} Formatted date string
   * @private
   */
  _formatDate(date) {
    if (!date) return 'N/A';
    
    const dt = date instanceof Date 
      ? DateTime.fromJSDate(date).setZone('America/Cancun')
      : DateTime.fromISO(date).setZone('America/Cancun');
    
    if (!dt.isValid) {
      return 'N/A';
    }
    
    return dt.toFormat('MM/dd/yyyy');
  }

  /**
   * Format currency amount
   * Note: Amounts are already in pesos (converted by DataAggregator)
   * @param {number} amount - Amount in pesos
   * @returns {string} Formatted currency string ($X,XXX.XX)
   * @private
   */
  _formatCurrency(amount) {
    if (amount === null || amount === undefined) {
      return '$0.00';
    }
    
    // Convert pesos to centavos for formatCurrency utility
    const centavos = Math.round(amount * 100);
    
    // formatCurrency expects centavos and returns formatted string
    return formatCurrency(centavos, 'MXN', true);
  }
}

