import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ClientProvider } from './context/ClientContext';
import './index.css';
import { logFrontendError } from './api/systemErrors.js';

// Global unhandled error handler (EM-3)
window.addEventListener('error', (event) => {
  logFrontendError({
    module: 'window',
    message: `Unhandled error: ${event.message}`,
    details: `File: ${event.filename}:${event.lineno}:${event.colno}\nStack: ${event.error?.stack || 'No stack'}`
  }).catch(() => {});
});

// Global unhandled promise rejection handler (EM-3)
// Skip AbortError — normal during navigation when fetch is cancelled
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  if (reason?.name === 'AbortError' || reason?.message?.includes?.('aborted')) return;
  logFrontendError({
    module: 'promise',
    message: `Unhandled rejection: ${reason?.message || String(reason)}`,
    details: reason?.stack || String(reason)
  }).catch(() => {});
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClientProvider>
      <App />
    </ClientProvider>
  </React.StrictMode>
);
