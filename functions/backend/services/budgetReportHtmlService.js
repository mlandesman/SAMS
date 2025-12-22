/**
 * Budget Report HTML Service
 * Generates HTML report for Budget Entry with year-over-year comparison
 */

import { getDb } from '../firebase.js';
import { getNow } from '../../shared/services/DateService.js';
import { DateTime } from 'luxon';
import { listBudgetsByYear } from '../controllers/budgetController.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { getFiscalYear, validateFiscalYearConfig } from '../utils/fiscalYearUtils.js';


/**
 * Format currency (pesos)
 */
function formatCurrency(amount, showSign = false) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '$0.00';
  }
  
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  if (amount < 0) {
    return `-$${formatted}`;
  } else if (showSign && amount > 0) {
    return `+$${formatted}`;
  }
  return `$${formatted}`;
}

/**
 * Format percentage
 */
function formatPercent(value, showSign = true) {
  if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
    return 'N/A';
  }
  
  const formatted = Math.abs(value).toFixed(1);
  if (value < 0) {
    return `-${formatted}%`;
  } else if (showSign && value > 0) {
    return `+${formatted}%`;
  }
  return `${formatted}%`;
}

/**
 * Calculate year-over-year change
 */
function calculateChange(current, prior) {
  const change = current - prior;
  let percentChange = null;
  
  if (prior !== 0) {
    percentChange = ((current - prior) / prior) * 100;
  } else if (current !== 0) {
    percentChange = 100; // New item (from 0 to something)
  }
  
  return { change, percentChange };
}

/**
 * Translate category name for Spanish
 */
function translateCategoryName(categoryName, language) {
  if (language !== 'spanish' || !categoryName) {
    return categoryName;
  }
  
  let translated = categoryName;
  
  // Common patterns to translate (order matters - do longer phrases first)
  const translations = {
    // Income categories
    'Account Credit': 'Crédito de Cuenta',
    'HOA Dues': 'Cuotas de Mantenimiento',
    'Special Assessments': 'Cuotas Especiales',
    
    // Maintenance categories
    'Maintenance: Elevator': 'Mantenimiento: Ascensor',
    'Maintenance: General': 'Mantenimiento: General',
    'Maintenance: Landscaping': 'Mantenimiento: Jardinería',
    'Maintenance: Paint & Repairs': 'Mantenimiento: Pintura y Reparaciones',
    'Maintenance: Plumbing & Electrical': 'Mantenimiento: Plomería y Eléctrico',
    'Maintenance: Pool': 'Mantenimiento: Piscina',
    'Maintenance: Security': 'Mantenimiento: Seguridad',
    'Maintenance: Supplies': 'Mantenimiento: Suministros',
    'Maintenance': 'Mantenimiento',
    
    // Staff categories
    'Staff: Administrators': 'Personal: Administradores',
    'Staff: Maintenance Staff': 'Personal: Mantenimiento',
    'Staff': 'Personal',
    
    // Utilities categories
    'Utilities: CFE': 'Servicios: CFE',
    'Utilities: Water': 'Servicios: Agua',
    'Utilities': 'Servicios',
    
    // Services categories
    'Services: Fumigation': 'Servicios: Fumigación',
    'Services': 'Servicios',
    
    // Project categories
    'Projects: Column Repairs': 'Proyectos: Reparación de Columnas',
    'Projects: Elevator Refurb 20': 'Proyectos: Refacción de Ascensor 20',
    'Projects: Meters & Wiring': 'Proyectos: Medidores y Cableado',
    'Projects: Parking Lot Expansion': 'Proyectos: Expansión de Estacionamiento',
    'Projects: Propane Lines': 'Proyectos: Líneas de Propano',
    'Projects: Roof Sealing': 'Proyectos: Sellado de Techo',
    'Projects': 'Proyectos',
    
    // Other categories
    'Bank Adjustments': 'Ajustes Bancarios',
    'Colonos Fee': 'Cuota de Colonos',
    'Other': 'Otros',
    'Transfers': 'Transferencias'
  };
  
  // Replace each pattern (order matters - do longer phrases first)
  for (const [english, spanish] of Object.entries(translations)) {
    const regex = new RegExp(english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    translated = translated.replace(regex, spanish);
  }
  
  return translated;
}

/**
 * Find all years that have budget entries for a client
 * Returns array of years sorted descending (highest first)
 */
export async function findAvailableBudgetYears(clientId) {
  const db = await getDb();
  const categoriesSnapshot = await db.collection('clients').doc(clientId)
    .collection('categories').get();
  
  const yearsSet = new Set();
  
  // Check each category for budget years
  for (const categoryDoc of categoriesSnapshot.docs) {
    const budgetCollection = categoryDoc.ref.collection('budget');
    const budgetDocs = await budgetCollection.get();
    
    budgetDocs.forEach(budgetDoc => {
      const year = parseInt(budgetDoc.id);
      if (!isNaN(year)) {
        const budgetData = budgetDoc.data();
        // Only include years that have actual budget entries (amount > 0)
        if (budgetData.amount && budgetData.amount > 0) {
          yearsSet.add(year);
        }
      }
    });
  }
  
  return Array.from(yearsSet).sort((a, b) => b - a); // Sort descending
}

/**
 * Find all years that have budget entries for a client (internal helper)
 */
async function findAvailableBudgetYearsInternal(db, clientId) {
  const categoriesSnapshot = await db.collection('clients').doc(clientId)
    .collection('categories').get();
  
  const yearsSet = new Set();
  
  // Check each category for budget years
  for (const categoryDoc of categoriesSnapshot.docs) {
    const budgetCollection = categoryDoc.ref.collection('budget');
    const budgetDocs = await budgetCollection.get();
    
    budgetDocs.forEach(budgetDoc => {
      const year = parseInt(budgetDoc.id);
      if (!isNaN(year)) {
        const budgetData = budgetDoc.data();
        // Only include years that have actual budget entries (amount > 0)
        if (budgetData.amount && budgetData.amount > 0) {
          yearsSet.add(year);
        }
      }
    });
  }
  
  return Array.from(yearsSet).sort((a, b) => b - a); // Sort descending
}

/**
 * Get budgets for a fiscal year
 */
async function getBudgetsForYear(db, clientId, year, user) {
  const budgets = await listBudgetsByYear(clientId, year, user);
  const budgetMap = new Map();
  budgets.forEach(budget => {
    budgetMap.set(budget.categoryId, {
      amount: budget.amount || 0, // amount in centavos
      notes: budget.notes || ''
    });
  });
  return budgetMap;
}

/**
 * Generate Budget Report HTML
 */
export async function generateBudgetReportHtml(clientId, fiscalYear, language = 'english', user) {
  const db = await getDb();
  const isSpanish = language === 'spanish' || language === 'es';
  
  // Get client info
  const clientDoc = await db.collection('clients').doc(clientId).get();
  if (!clientDoc.exists) {
    throw new Error(`Client ${clientId} not found`);
  }
  
  // Read responsive CSS file
  const cssPath = path.join(__dirname, '../templates/reports/reportCommon.css');
  const reportCommonCss = fs.readFileSync(cssPath, 'utf8');

  const clientData = clientDoc.data();
  const clientName = clientData.basicInfo?.fullName || clientData.basicInfo?.displayName || clientData.name || clientData.displayName || clientId;
  const logoUrl = clientData.branding?.logoUrl;
  const normalizedLogoUrl = logoUrl && logoUrl.trim() !== '' ? logoUrl : null;
  
  // Validate the requested fiscal year
  // If no fiscalYear provided, default to highest available year
  const availableYears = await findAvailableBudgetYearsInternal(db, clientId);
  
  if (availableYears.length === 0) {
    throw new Error(`No budget entries found for client ${clientId}`);
  }
  
  // Use the requested fiscal year, or default to highest available
  const currentYear = fiscalYear || availableYears[0];
  const priorYear = currentYear - 1;
  
  // Warn if requested year has no budget data (still generate with zeros)
  if (fiscalYear && !availableYears.includes(fiscalYear)) {
    console.warn(`Budget report requested for FY ${fiscalYear} but no budget data exists. Report will show zeros.`);
  }
  
  // Get categories
  const categoriesSnapshot = await db.collection('clients').doc(clientId)
    .collection('categories').get();
  
  const allCategories = [];
  categoriesSnapshot.forEach(doc => {
    allCategories.push({ id: doc.id, ...doc.data() });
  });
  
  // Filter out categories marked as notBudgeted
  // These include projects, special assessments, transfers, etc.
  const categories = allCategories.filter(cat => !cat.notBudgeted);
  
  const currentBudgets = await getBudgetsForYear(db, clientId, currentYear, user);
  const priorBudgets = await getBudgetsForYear(db, clientId, priorYear, user);
  
  // Separate income and expense categories
  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');
  
  // Calculate totals (convert centavos to pesos)
  const toPesos = (centavos) => centavos / 100;
  
  let totalIncomeCurrent = 0, totalIncomePrior = 0;
  let totalExpenseCurrent = 0, totalExpensePrior = 0;
  
  incomeCategories.forEach(cat => {
    const currentData = currentBudgets.get(cat.id) || { amount: 0 };
    const priorData = priorBudgets.get(cat.id) || { amount: 0 };
    totalIncomeCurrent += currentData.amount || 0;
    totalIncomePrior += priorData.amount || 0;
  });
  
  expenseCategories.forEach(cat => {
    const currentData = currentBudgets.get(cat.id) || { amount: 0 };
    const priorData = priorBudgets.get(cat.id) || { amount: 0 };
    totalExpenseCurrent += currentData.amount || 0;
    totalExpensePrior += priorData.amount || 0;
  });
  
  // Labels
  const labels = {
    title: isSpanish ? 'Informe de Presupuesto' : 'Budget Report',
    fiscalYear: isSpanish ? 'Año Fiscal' : 'Fiscal Year',
    category: isSpanish ? 'Categoría' : 'Category',
    priorYear: isSpanish ? `Año ${priorYear}` : `FY ${priorYear}`,
    currentYear: isSpanish ? `Año ${currentYear}` : `FY ${currentYear}`,
    change: isSpanish ? 'Cambio' : 'Change',
    percentChange: isSpanish ? '% Cambio' : '% Change',
    notes: isSpanish ? 'Notas' : 'Notes',
    income: isSpanish ? 'Ingresos' : 'Income',
    expenses: isSpanish ? 'Gastos' : 'Expenses',
    totalIncome: isSpanish ? 'Total Ingresos' : 'Total Income',
    totalExpenses: isSpanish ? 'Total Gastos' : 'Total Expenses',
    reserve: isSpanish ? 'Reserva' : 'Reserve',
    summary: isSpanish ? 'Resumen' : 'Summary',
    generated: isSpanish ? 'Generado' : 'Generated',
    noData: isSpanish ? 'Sin datos' : 'No data',
  };
  
  // Generate category rows
  const generateCategoryRows = (cats, budgetsCurrent, budgetsPrior) => {
    return cats.map(cat => {
      const currentData = budgetsCurrent.get(cat.id) || { amount: 0, notes: '' };
      const priorData = budgetsPrior.get(cat.id) || { amount: 0, notes: '' };
      const currentCentavos = currentData.amount;
      const priorCentavos = priorData.amount;
      const current = toPesos(currentCentavos);
      const prior = toPesos(priorCentavos);
      const notes = currentData.notes || '';
      const { change, percentChange } = calculateChange(current, prior);
      
      const changeClass = change > 0 ? 'positive' : change < 0 ? 'negative' : '';
      const categoryName = translateCategoryName(cat.name || cat.id, language);
      
      // Escape HTML special characters in notes
      const escapedNotes = notes
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
      
      return `
        <tr>
          <td class="category-name">${categoryName}</td>
          <td class="amount">${formatCurrency(prior)}</td>
          <td class="amount">${formatCurrency(current)}</td>
          <td class="amount ${changeClass}">${formatCurrency(change, true)}</td>
          <td class="amount ${changeClass}">${formatPercent(percentChange)}</td>
          <td class="notes">${escapedNotes}</td>
        </tr>
      `;
    }).join('');
  };
  
  // Calculate summary
  const reserveCurrent = toPesos(totalIncomeCurrent - totalExpenseCurrent);
  const reservePrior = toPesos(totalIncomePrior - totalExpensePrior);
  const { change: reserveChange, percentChange: reservePercentChange } = calculateChange(reserveCurrent, reservePrior);
  
  const incomeChange = calculateChange(toPesos(totalIncomeCurrent), toPesos(totalIncomePrior));
  const expenseChange = calculateChange(toPesos(totalExpenseCurrent), toPesos(totalExpensePrior));
  
  const generatedDate = getNow();
  const generatedTimestamp = DateTime.fromJSDate(generatedDate).setZone('America/Cancun');
  const formattedDate = generatedTimestamp.toLocaleString(isSpanish ? DateTime.DATE_FULL : DateTime.DATE_FULL, { locale: isSpanish ? 'es' : 'en' });
  
  // TODO: Currency selection stub
  // When implementing currency selection:
  // 1. Add currency parameter to function signature
  // 2. Fetch exchange rate from exchangeRates collection
  // 3. Convert all amounts using rate
  // 4. Update formatCurrency to show selected currency symbol
  // Example: const rate = await getExchangeRate(db, 'MXN', 'USD');
  
  const html = `
<!DOCTYPE html>
<html lang="${isSpanish ? 'es' : 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="format-detection" content="telephone=no">
  <title>${labels.title} - FY ${fiscalYear}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      color: #333;
      margin: 0;
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    }
    
    .header {
      text-align: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #007bff;
    }
    
    .logo {
      max-width: 120px;
      max-height: 80px;
      margin-bottom: 12px;
    }
    
    .header h1 {
      margin: 0 0 8px 0;
      font-size: 20px;
      color: #007bff;
    }
    
    .header .client-name {
      font-size: 16px;
      color: #666;
      margin: 0 0 4px 0;
    }
    
    .header .fiscal-year {
      font-size: 14px;
      color: #888;
    }
    
    h2 {
      font-size: 14px;
      color: #333;
      margin: 20px 0 12px 0;
      padding-bottom: 4px;
      border-bottom: 1px solid #ddd;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    
    th, td {
      padding: 6px 8px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }
    
    th {
      background: #f8f9fa;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      color: #666;
    }
    
    td.category-name, th:first-child {
      max-width: 180px;
      min-width: 120px;
      width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    td.amount, th.amount {
      text-align: right;
      white-space: nowrap;
      min-width: 70px;
      width: 90px;
    }
    
    td.notes {
      font-size: 11px;
      max-width: 200px;
      min-width: 150px;
      width: 200px;
      word-wrap: break-word;
      color: #666;
      white-space: normal;
    }
    
    .total-row {
      font-weight: bold;
      background: #f0f0f0;
    }
    
    .total-row td {
      border-top: 2px solid #ddd;
    }
    
    .positive { color: #28a745; }
    .negative { color: #dc3545; }
    
    .summary {
      background: #f8f9fa;
      padding: 16px;
      border-radius: 8px;
      margin-top: 24px;
    }
    
    .summary h2 {
      margin-top: 0;
      border: none;
    }
    
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    
    .summary-item {
      text-align: center;
    }
    
    .summary-item .label {
      font-size: 11px;
      color: #666;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    
    .summary-item .value {
      font-size: 18px;
      font-weight: bold;
    }
    
    .summary-item .change {
      font-size: 12px;
      margin-top: 4px;
    }
    
    .footer {
      text-align: center;
      color: #888;
      font-size: 10px;
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #eee;
    }
    
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
    /* =====================================================
       Responsive Report Common CSS (from reportCommon.css)
       ===================================================== */
    ${reportCommonCss}
  </style>
</head>
<body>
  <div class="report-container header">
    ${normalizedLogoUrl ? `<img src="${normalizedLogoUrl}" alt="${clientName}" class="logo" />` : ''}
    <h1>${labels.title}</h1>
    <div class="report-container client-name">${clientName}</div>
    <div class="report-container fiscal-year">${labels.fiscalYear}: ${currentYear}</div>
  </div>
  
  <h2>${labels.income}</h2>
  <table>
    <thead>
      <tr>
        <th>${labels.category}</th>
        <th class="amount">${labels.priorYear}</th>
        <th class="amount">${labels.currentYear}</th>
        <th class="amount">${labels.change}</th>
        <th class="amount">${labels.percentChange}</th>
        <th>${labels.notes}</th>
      </tr>
    </thead>
    <tbody>
      ${generateCategoryRows(incomeCategories, currentBudgets, priorBudgets)}
      <tr class="total-row">
        <td>${labels.totalIncome}</td>
        <td class="amount">${formatCurrency(toPesos(totalIncomePrior))}</td>
        <td class="amount">${formatCurrency(toPesos(totalIncomeCurrent))}</td>
        <td class="amount ${incomeChange.change > 0 ? 'positive' : incomeChange.change < 0 ? 'negative' : ''}">${formatCurrency(incomeChange.change, true)}</td>
        <td class="amount ${incomeChange.change > 0 ? 'positive' : incomeChange.change < 0 ? 'negative' : ''}">${formatPercent(incomeChange.percentChange)}</td>
        <td></td>
      </tr>
    </tbody>
  </table>
  
  <h2>${labels.expenses}</h2>
  <table>
    <thead>
      <tr>
        <th>${labels.category}</th>
        <th class="amount">${labels.priorYear}</th>
        <th class="amount">${labels.currentYear}</th>
        <th class="amount">${labels.change}</th>
        <th class="amount">${labels.percentChange}</th>
        <th>${labels.notes}</th>
      </tr>
    </thead>
    <tbody>
      ${generateCategoryRows(expenseCategories, currentBudgets, priorBudgets)}
      <tr class="total-row">
        <td>${labels.totalExpenses}</td>
        <td class="amount">${formatCurrency(toPesos(totalExpensePrior))}</td>
        <td class="amount">${formatCurrency(toPesos(totalExpenseCurrent))}</td>
        <td class="amount ${expenseChange.change > 0 ? 'positive' : expenseChange.change < 0 ? 'negative' : ''}">${formatCurrency(expenseChange.change, true)}</td>
        <td class="amount ${expenseChange.change > 0 ? 'positive' : expenseChange.change < 0 ? 'negative' : ''}">${formatPercent(expenseChange.percentChange)}</td>
        <td></td>
      </tr>
    </tbody>
  </table>
  
  <div class="report-container summary">
    <h2>${labels.summary}</h2>
    <div class="report-container summary-grid">
      <div class="report-container summary-item">
        <div class="report-container label">${labels.reserve}</div>
        <div class="report-container value">${formatCurrency(reserveCurrent)}</div>
        <div class="report-container change ${reserveChange > 0 ? 'positive' : reserveChange < 0 ? 'negative' : ''}">
          ${formatCurrency(reserveChange, true)} (${formatPercent(reservePercentChange)})
        </div>
      </div>
    </div>
  </div>
  
  <div class="report-container footer">
    <p>${labels.generated}: ${formattedDate}</p>
  </div>
</body>
</html>
  `;
  
  return {
    html,
    meta: {
      reportId: `BUDGET-${clientId}-${fiscalYear}`,
      generatedAt: formattedDate,
      language,
      fiscalYear,
      clientId,
      clientName
    }
  };
}
