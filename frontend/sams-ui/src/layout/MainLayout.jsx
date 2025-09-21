import React from 'react';
import Sidebar from './Sidebar';
import StatusBar from './StatusBar';
import PWANavigation from '../components/PWANavigation';
import './Layout.css';
import { useClient } from '../context/ClientContext';
import { useAuth } from '../context/AuthContext';

function MainLayout({ children, onChangeClientClick, showStatusBar, onActivityChange }) {
  const { selectedClient, setClient } = useClient();
  const { currentUser, logout } = useAuth();
  
  const handleLogout = async () => {
    const success = await logout();
    if (success) {
      console.log('Successfully logged out');
      // Clear client selection on logout for security
      setClient(null);
    } else {
      console.error('Failed to log out');
    }
  };
  
  return (
    <div className="layout-container">
      <Sidebar 
        onChangeClientClick={onChangeClientClick} 
        onActivityChange={onActivityChange} 
        selectedClient={selectedClient} // Pass to Sidebar if needed
      />
      <div className="main-content">
        {currentUser && (
          <div className="user-info">
            <span>Logged in as: {currentUser.email}</span>
            <button onClick={handleLogout} className="logout-button">Logout</button>
          </div>
        )}
        <div className="content">
          {children}
        </div>
        {showStatusBar && <StatusBar />}
      </div>
      {/* PWA Navigation - Only render on mobile PWA (port 5174), not desktop (port 5173) */}
      {window.location.port === '5174' && (
        <div className="pwa-navigation">
          <PWANavigation />
        </div>
      )}
    </div>
  );
}

export default MainLayout;