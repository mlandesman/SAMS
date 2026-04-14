/**
 * Budget vs Actual Text Service
 * 
 * Generates plain text table output for Budget vs Actual report
 * Follows statementTextTableService.js pattern for consistency
 */

import { DateTime } from 'luxon';

/**
 * Format date as dd-MMM-yy (unambiguous for international clients)
 * @param {string|Date} dateValue - Date to format
 * @returns {string} Formatted date
 */
function formatDate(dateValue) {
  if (!dateValue) return '';
  const dt = typeof dateValue === 'string'
    ? DateTime.fromISO(dateValue, { zone: 'America/Cancun' })
    : DateTime.fromJSDate(new Date(dateValue)).setZone('America/Cancun');
  return dt.isValid ? dt.toFormat('dd-MMM-yy') : '';
}

/**
 * Format centavos to pesos with commas
 * @param {number} centavos - Amount in centavos
 * @returns {string} Formatted amount in pesos
 */
function formatPesos(centavos) {
  if (!centavos || isNaN(centavos)) return '0.00';
  const pesos = centavos / 100;
  return pesos.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const EM_DASH = '\u2014';

/**
 * Format percentage
 * @param {number|null|undefined} percent - Percentage value
 * @returns {string} Formatted percentage or em dash
 */
function formatPercent(percent) {
  if (percent === null || percent === undefined || Number.isNaN(percent)) {
    return EM_DASH;
  }
  return `${percent.toFixed(2)}%`;
}

/**
 * Generate a single table section
 * @param {string} title - Table title
 * @param {Array} categories - Category data array
 * @param {Object} totals - Totals object
 * @returns {string} Formatted table section
 */
function generateTableSection(title, categories, totals) {
  if (categories.length === 0) {
    return `${title}\nNo data available\n\n`;
  }

  let output = '';
  output += title + '\n';
  output += '='.repeat(80) + '\n';
  
  // Table header
  output += 'Category Name'.padEnd(30);
  output += 'Annual Budget'.padStart(15);
  output += 'YTD Budget'.padStart(15);
  output += 'YTD Actual'.padStart(15);
  output += 'Variance ($)'.padStart(15);
  output += 'Variance (%)'.padStart(15);
  output += '\n';
  output += '-'.repeat(80) + '\n';

  // Category rows
  categories.forEach(category => {
    const name = (category.name || category.id).substring(0, 28).padEnd(30);
    const annualBudget = formatPesos(category.annualBudget).padStart(15);
    const ytdBudget = formatPesos(category.ytdBudget).padStart(15);
    // ytdActual is already converted to positive for expenses in data service
    const ytdActual = formatPesos(category.ytdActual).padStart(15);
    
    const variance =
      category.variance === null || category.variance === undefined || Number.isNaN(category.variance)
        ? EM_DASH.padStart(15)
        : `${category.variance >= 0 ? '+' : ''}${formatPesos(category.variance)}`.padStart(15);
    const variancePercent =
      category.variancePercent === null ||
      category.variancePercent === undefined ||
      Number.isNaN(category.variancePercent)
        ? EM_DASH.padStart(15)
        : `${category.variancePercent >= 0 ? '+' : ''}${formatPercent(category.variancePercent)}`.padStart(15);
    
    output += `${name}${annualBudget}${ytdBudget}${ytdActual}${variance}${variancePercent}\n`;
  });

  // Totals row
  output += '-'.repeat(80) + '\n';
  output += 'TOTALS'.padEnd(30);
  output += formatPesos(totals.totalAnnualBudget).padStart(15);
  output += formatPesos(totals.totalYtdBudget).padStart(15);
  output += formatPesos(totals.totalYtdActual).padStart(15);
  
  const totalVariance =
    totals.totalVariance === null || totals.totalVariance === undefined || Number.isNaN(totals.totalVariance)
      ? EM_DASH.padStart(15)
      : `${totals.totalVariance >= 0 ? '+' : ''}${formatPesos(totals.totalVariance)}`.padStart(15);
  const totalVariancePercent =
    totals.totalVariancePercent === null ||
    totals.totalVariancePercent === undefined ||
    Number.isNaN(totals.totalVariancePercent)
      ? EM_DASH.padStart(15)
      : `${totals.totalVariancePercent >= 0 ? '+' : ''}${formatPercent(totals.totalVariancePercent)}`.padStart(15);
  output += totalVariance;
  output += totalVariancePercent;
  output += '\n';
  output += '='.repeat(80) + '\n\n';

  return output;
}

/**
 * Generate Special Assessments fund accounting section
 * @param {Object} specialAssessments - Special Assessments data object
 * @returns {string} Formatted fund accounting section
 */
function generateSpecialAssessmentsSection(specialAssessments) {
  let output = '';
  output += 'SPECIAL ASSESSMENTS FUND\n';
  output += '='.repeat(80) + '\n\n';
  
  // Collections section (income from unit owners) - PM8B: per-project breakdown
  output += 'COLLECTIONS (from Unit Owners)\n';
  output += '-'.repeat(80) + '\n';
  const collections = specialAssessments.collections;
  if (collections && collections.projects && collections.projects.length > 0) {
    collections.projects.forEach(project => {
      const projectName = (project.projectName || project.projectId).padEnd(60);
      const projectAmount = formatPesos(project.collected || 0).padStart(20);
      output += `  ${projectName}${projectAmount}\n`;
    });
    if (collections.projects.length > 1) {
      const totalLabel = 'TOTAL COLLECTIONS'.padEnd(60);
      const totalAmount = formatPesos(collections.amount || 0).padStart(20);
      output += '-'.repeat(80) + '\n';
      output += `  ${totalLabel}${totalAmount}\n`;
    }
  } else {
    output += '  No collections recorded\n';
  }
  output += '\n';
  
  // Expenditures section (project costs)
  output += 'EXPENDITURES (Project Costs)\n';
  output += '-'.repeat(80) + '\n';
  if (specialAssessments.expenditures && specialAssessments.expenditures.length > 0) {
    specialAssessments.expenditures.forEach(expenditure => {
      const projectName = expenditure.name.padEnd(60);
      const projectAmount = formatPesos(expenditure.amount).padStart(20);
      output += `  ${projectName}${projectAmount}\n`;
    });
    output += '-'.repeat(80) + '\n';
    const totalExpendituresLabel = 'TOTAL EXPENDITURES'.padEnd(60);
    const totalExpendituresAmount = formatPesos(specialAssessments.totalExpenditures).padStart(20);
    output += `  ${totalExpendituresLabel}${totalExpendituresAmount}\n`;
  } else {
    output += '  No expenditures recorded\n';
  }
  output += '\n';
  
  // Net Fund Balance
  output += '='.repeat(80) + '\n';
  const netBalanceLabel = 'NET FUND BALANCE'.padEnd(60);
  const netBalanceSign = specialAssessments.netBalance >= 0 ? '+' : '';
  const netBalanceAmount = `${netBalanceSign}${formatPesos(specialAssessments.netBalance)}`.padStart(20);
  output += `${netBalanceLabel}${netBalanceAmount}\n`;
  output += '='.repeat(80) + '\n\n';
  
  return output;
}

/**
 * Generate Unit Credit Accounts section
 * @param {Object} unitCreditAccounts - Unit Credit Accounts data object
 * @returns {string} Formatted Unit Credit Accounts section
 */
function generateUnitCreditAccountsSection(unitCreditAccounts) {
  let output = '';
  output += 'UNIT CREDIT ACCOUNTS\n';
  output += '='.repeat(80) + '\n\n';
  
  // Credit Added section
  output += 'CREDIT ADDED\n';
  output += '-'.repeat(80) + '\n';
  const creditAddedLabel = 'Account Credit'.padEnd(60);
  const creditAddedAmount = formatPesos(unitCreditAccounts?.added || 0).padStart(20);
  output += `  ${creditAddedLabel}${creditAddedAmount}\n`;
  output += '\n';
  
  // Credit Used section
  output += 'CREDIT USED\n';
  output += '-'.repeat(80) + '\n';
  const creditUsedLabel = 'Account Credit Used'.padEnd(60);
  const creditUsedAmount = formatPesos(unitCreditAccounts?.used || 0).padStart(20);
  output += `  ${creditUsedLabel}${creditUsedAmount}\n`;
  output += '\n';
  
  // Credit Balance
  output += '='.repeat(80) + '\n';
  const creditBalanceLabel = 'CREDIT BALANCE'.padEnd(60);
  const creditBalanceSign = (unitCreditAccounts?.balance || 0) >= 0 ? '+' : '';
  const creditBalanceAmount = `${creditBalanceSign}${formatPesos(unitCreditAccounts?.balance || 0)}`.padStart(20);
  output += `${creditBalanceLabel}${creditBalanceAmount}\n`;
  output += '='.repeat(80) + '\n\n';
  
  return output;
}

/**
 * Generate text table output for Budget vs Actual report
 * @param {Object} data - Data object from getBudgetActualData service
 * @returns {string} Plain text table output with three separate tables
 */
export function generateBudgetActualText(data) {
  if (!data) {
    return 'No budget data available';
  }

  const { clientInfo, reportInfo, income, specialAssessments, unitCreditAccounts, expenses } = data;
  
  let output = '';
  
  // Header
  output += '='.repeat(80) + '\n';
  output += `BUDGET VS ACTUAL REPORT\n`;
  output += `Client: ${clientInfo.name}\n`;
  output += `Fiscal Year: ${reportInfo.fiscalYear}\n`;
  output += `Report Date: ${formatDate(reportInfo.reportDate)}\n`;
  output += `% of Year Elapsed: ${reportInfo.percentOfYearElapsed.toFixed(1)}%\n`;
  const basis =
    reportInfo.reportMode === 'projected'
      ? 'Projected fiscal year-end (run-rate vs annual budget)'
      : 'Year-to-date (vs prorated budget)';
  output += `Variance basis: ${basis}\n`;
  output += '='.repeat(80) + '\n\n';

  // Generate three separate tables
  output += generateTableSection('INCOME TABLE', income.categories, income.totals);
  output += generateSpecialAssessmentsSection(specialAssessments);
  output += generateUnitCreditAccountsSection(unitCreditAccounts);
  output += generateTableSection('EXPENSE TABLE', expenses.categories, expenses.totals);
  
  // Footer
  output += '='.repeat(80) + '\n';
  output += `Report ID: ${reportInfo.reportId}\n`;
  output += `Generated: ${formatDate(reportInfo.reportDate)}\n`;

  return output;
}

