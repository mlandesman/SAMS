/**
 * CSV Export Utility Functions
 * 
 * Provides reusable functions for generating and downloading CSV files
 * Extracted from StatementOfAccountTab for reuse across SAMS
 */

/**
 * Escapes a cell value for CSV format
 * @param {*} value - The cell value
 * @returns {string} - CSV-safe escaped string
 */
export function escapeCSVCell(value) {
  if (value === null || value === undefined || value === '') {
    return '""';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  const str = String(value);
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Generates CSV content from data
 * @param {string[]} headers - Column headers
 * @param {Array<Array<*>>} rows - 2D array of row data
 * @returns {string} - Complete CSV content
 */
export function generateCSVContent(headers, rows) {
  const allRows = [headers, ...rows];
  const csvLines = allRows.map(row =>
    row.map(escapeCSVCell).join(',')
  );
  return csvLines.join('\r\n');
}

/**
 * Triggers a CSV file download
 * @param {string} csvContent - The CSV content string
 * @param {string} filename - The filename (without extension)
 */
export function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}

/**
 * Complete export helper - generates and downloads CSV
 * @param {Object} options
 * @param {string[]} options.headers - Column headers
 * @param {Array<Array<*>>} options.rows - 2D array of row data
 * @param {string} options.filename - Filename without extension
 */
export function exportToCSV({ headers, rows, filename }) {
  const csvContent = generateCSVContent(headers, rows);
  downloadCSV(csvContent, filename);
}
