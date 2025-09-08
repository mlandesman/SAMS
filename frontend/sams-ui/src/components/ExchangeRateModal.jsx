import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faCheckCircle, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import './ExchangeRateModal.css';

const ExchangeRateModal = ({ isVisible, status, onClose }) => {
  if (!isVisible) return null;

  const getContent = () => {
    switch (status) {
      case 'updating':
        return {
          icon: faSpinner,
          iconClass: 'spinning',
          title: 'Updating Exchange Rates',
          message: 'Fetching the latest exchange rates from Banxico and government sources...',
          showCloseButton: false
        };
      case 'success':
        return {
          icon: faCheckCircle,
          iconClass: 'success',
          title: 'Exchange Rates Updated',
          message: 'Successfully retrieved the latest exchange rates for USD, CAD, EUR, and COP.',
          showCloseButton: true
        };
      case 'error':
        return {
          icon: faExclamationTriangle,
          iconClass: 'error',
          title: 'Exchange Rate Update Failed',
          message: 'Unable to fetch the latest exchange rates. The system will continue with cached rates.',
          showCloseButton: true
        };
      default:
        return null;
    }
  };

  const content = getContent();
  if (!content) return null;

  return (
    <div className="exchange-rate-modal-overlay">
      <div className="exchange-rate-modal">
        <div className="exchange-rate-modal-content">
          <div className={`exchange-rate-icon ${content.iconClass}`}>
            <FontAwesomeIcon icon={content.icon} />
          </div>
          <h3 className="exchange-rate-title">{content.title}</h3>
          <p className="exchange-rate-message">{content.message}</p>
          {content.showCloseButton && (
            <button 
              className="exchange-rate-close-btn"
              onClick={onClose}
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExchangeRateModal;
