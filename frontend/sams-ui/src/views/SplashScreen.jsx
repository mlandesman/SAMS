import React from 'react';
import PropTypes from 'prop-types';
import './SplashScreen.css';

function SplashScreen({ onSelectClient }) {
  return (
    <div className="splash-screen-container">
        <img
        src="https://firebasestorage.googleapis.com/v0/b/sandyland-management-system.firebasestorage.app/o/logos%2Fsandyland-properties-high-resolution-logo-transparent.png?alt=media&token=a39645c7-aa81-41a0-9b20-35086de026d0"
        alt="Sandyland Properties"
        className="splash-logo"
        />
      <h2>Welcome to Sandyland Property Management System</h2>
      <p>Please select a client to continue</p>
      {onSelectClient && (
        <button 
          className="select-client-button" 
          onClick={onSelectClient}
          style={{
            marginTop: '2rem',
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Select Client
        </button>
      )}
    </div>
  );
}

SplashScreen.propTypes = {
  onSelectClient: PropTypes.func
};

export default SplashScreen;