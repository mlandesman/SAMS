/**
 * Print utility functions for reports
 * Provides helper functions to print report content from iframes
 */

/**
 * Print the content of an iframe element
 * @param {string} iframeSelector - CSS selector for the iframe (default: 'iframe')
 * @param {Function} onError - Optional error callback
 */
export function printReport(iframeSelector = 'iframe', onError = null) {
  const iframe = document.querySelector(iframeSelector);
  
  if (iframe?.contentWindow) {
    iframe.contentWindow.print();
  } else if (onError) {
    onError('No printable content found');
  } else {
    // Fallback to printing current window
    window.print();
  }
}

