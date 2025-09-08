/**
 * Custom hook for managing notification modals
 * Provides easy-to-use functions for showing success, error, warning, and info notifications
 */

import { useState } from 'react';

export const useNotification = () => {
  const [notification, setNotification] = useState({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
    details: [],
    actionButton: null
  });

  const closeNotification = () => {
    setNotification(prev => ({ ...prev, isOpen: false }));
  };

  const showNotification = (type, title, message, details = [], actionButton = null) => {
    console.log('🔔 showNotification called with:', { type, title, message, details, actionButton });
    
    const newNotification = {
      isOpen: true,
      type,
      title,
      message,
      details,
      actionButton
    };
    
    console.log('🔔 Setting notification state to:', newNotification);
    setNotification(newNotification);
  };

  // Convenience methods for common notification types
  const showSuccess = (title, message, details = [], actionButton = null) => {
    console.log('🔔 showSuccess called with:', { title, message, details });
    showNotification('success', title, message, details, actionButton);
  };

  const showError = (title, message, details = [], actionButton = null) => {
    console.log('🔔 showError called with:', { title, message, details });
    showNotification('error', title, message, details, actionButton);
  };

  const showWarning = (title, message, details = [], actionButton = null) => {
    showNotification('warning', title, message, details, actionButton);
  };

  const showInfo = (title, message, details = [], actionButton = null) => {
    showNotification('info', title, message, details, actionButton);
  };

  // Email-specific success notification
  const showEmailSuccess = (recipients = [], cc = [], unit = '', amount = '') => {
    console.log('🔔 showEmailSuccess called with:', { recipients, cc, unit, amount });
    
    const details = [
      ...(recipients.length > 0 ? [{ label: 'Sent to', value: recipients.join(', ') }] : []),
      ...(cc.length > 0 ? [{ label: 'CC', value: cc.join(', ') }] : []),
      ...(unit ? [{ label: 'Unit', value: unit }] : []),
      ...(amount ? [{ label: 'Amount', value: amount }] : [])
    ];

    console.log('🔔 Calling showSuccess with details:', details);

    showSuccess(
      'Email Sent Successfully!',
      'The receipt has been delivered to all recipients.',
      details
    );
  };

  // WhatsApp-specific success notification (for future use)
  const showWhatsAppSuccess = (phoneNumber = '', unit = '', amount = '') => {
    const details = [
      ...(phoneNumber ? [{ label: 'Sent to', value: phoneNumber }] : []),
      ...(unit ? [{ label: 'Unit', value: unit }] : []),
      ...(amount ? [{ label: 'Amount', value: amount }] : [])
    ];

    showSuccess(
      'WhatsApp Message Sent!',
      'The receipt has been sent via WhatsApp.',
      details
    );
  };

  return {
    notification,
    closeNotification,
    showNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showEmailSuccess,
    showWhatsAppSuccess
  };
};

export default useNotification;
