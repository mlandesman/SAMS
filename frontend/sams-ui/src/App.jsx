import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ClientProvider, useClient } from './context/ClientContext';
import { TransactionsProvider } from './context/TransactionsContext';
import TransactionFiltersProvider from './context/TransactionFiltersContext.jsx';
import { StatusBarProvider } from './context/StatusBarContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ExchangeRateProvider } from './context/ExchangeRateContext';
import { useExchangeRates } from './hooks/useExchangeRates';
import MainLayout from './layout/MainLayout';
import SplashScreen from './views/SplashScreen';
import ClientSwitchModal from './components/ClientSwitchModal';
import ExchangeRateModal from './components/ExchangeRateModal';
import DashboardView from './views/DashboardView';
import TransactionsView from './views/TransactionsView';
import ActivityView from './views/ActivityView';
import ListManagementView from './views/ListManagementView';
import DigitalReceiptDemo from './views/DigitalReceiptDemo';
import TestRoute from './components/TestRoute';
import UnitReportView from './views/UnitReportView';
import MaintenanceGuard from './components/MaintenanceGuard';
import PasswordSetupView from './views/PasswordSetupView';
import ClientProtectedRoute from './components/security/ClientProtectedRoute';
import AuthGuard from './components/guards/AuthGuard';
import ExchangeRatesView from './views/ExchangeRatesView';
import AddExpenseView from './views/AddExpenseView';
import WaterBillsViewV3 from './views/WaterBillsViewV3';
import PropaneView from './components/propane/PropaneView';

import './App.css';
import { forceProductionMobileMode } from './utils/mobileDetection';
import './styles/force-mobile-overrides.css';
import { initializeVersionCheck } from './utils/versionChecker';

// Initialize mobile detection
if (typeof window !== 'undefined') {
  forceProductionMobileMode();
}

// Initialize version checking
if (typeof window !== 'undefined') {
  initializeVersionCheck().then(versionInfo => {
    if (versionInfo) {
      console.log('SAMS Version Check Complete:', versionInfo);
    }
  }).catch(error => {
    console.error('Version check failed:', error);
  });
}

// This component will contain the main logic after context is available
function AppContent() {
  const { selectedClient, setClient } = useClient();
  const { loading, isAuthenticated, showLogin } = useAuth();
  const { isModalVisible, modalStatus, closeModal, checkAndUpdateWithGapFill } = useExchangeRates();
  const [showClientModal, setShowClientModal] = useState(false);
  const [currentActivity, setCurrentActivity] = useState('dashboard'); // Track current activity
  
  // Clear client selection from localStorage on app start
  useEffect(() => {
    console.log('App initialized. Clearing stored client selection for security.');
    localStorage.removeItem('selectedClient');
  }, []);
  
  // Check authentication on component mount and trigger exchange rate check on login
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      console.log('User not authenticated, showing login form');
      showLogin();
    } else if (isAuthenticated && !selectedClient) {
      console.log('User is authenticated but no client selected, showing client selection');
      setShowClientModal(true);
    } else if (isAuthenticated && selectedClient) {
      console.log('🔄 User authenticated and client selected - checking exchange rates with gap fill');
      checkAndUpdateWithGapFill();
    }
  }, [loading, isAuthenticated, showLogin, selectedClient, checkAndUpdateWithGapFill]);

  const handleClientSelected = (client) => {
    setClient(client);
    setShowClientModal(false);
    setCurrentActivity('dashboard');
    // Check exchange rates when client is selected (includes gap fill)
    console.log('🔄 Client selected - checking exchange rates with gap fill');
    checkAndUpdateWithGapFill();
  };

  const openClientModal = () => {
    setShowClientModal(true);
  };

  const closeClientModal = () => {
    setShowClientModal(false);
  };

  // This function will be passed to the Sidebar to handle "Change Client"
  const handleChangeClient = () => {
    setClient(null);
    openClientModal();
    // Note: Exchange rate check will happen when new client is selected
  };

  // Function to update the current activity
  const handleActivityChange = (activity) => {
    setCurrentActivity(activity);
  };
  
  // Listen for custom activity change events (from deep components)
  useEffect(() => {
    const handleActivityChangeEvent = (event) => {
      const { activity } = event.detail;
      console.log(`Activity change event received: ${activity}`);
      setCurrentActivity(activity);
    };
    
    window.addEventListener('activityChange', handleActivityChangeEvent);
    
    return () => {
      window.removeEventListener('activityChange', handleActivityChangeEvent);
    };
  }, []);
  
  // Debug effect to log client changes
  useEffect(() => {
    console.log('App.jsx: Client changed to:', selectedClient);
  }, [selectedClient]);

  // Only show content if authenticated
  if (!isAuthenticated) {
    // Show only the SplashScreen while not authenticated
    return (
      <div className="splash-container">
        <SplashScreen />
      </div>
    );
  }

  // User is authenticated.
  // Handle standalone demo/test routes first.
  // Then, handle the main application layout and routes.
  return (
    <Routes>
      {/* Standalone routes accessible after auth, before client selection, outside MainLayout */}
      <Route path="/receipt-demo" element={
        <AuthGuard>
          <DigitalReceiptDemo />
        </AuthGuard>
      } />
      <Route path="/test" element={
        <AuthGuard>
          <TestRoute />
        </AuthGuard>
      } />

      {/* Main application layout and routes */}
      <Route path="/*" element={
        <>
          <StatusBarProvider>
            {!selectedClient ? (
              // Show only SplashScreen when no client selected - no sidebar/layout
              <SplashScreen onSelectClient={openClientModal} />
            ) : (
              <MainLayout
                onChangeClientClick={handleChangeClient}
                showStatusBar={true}
                onActivityChange={handleActivityChange}
                activity={currentActivity}
              >
                <Routes>
                  <Route path="/" element={
                    <ClientProtectedRoute requiredPermission="dashboard.view">
                      <DashboardView />
                    </ClientProtectedRoute>
                  } />
                  <Route path="/dashboard" element={
                    <ClientProtectedRoute requiredPermission="dashboard.view">
                      <DashboardView />
                    </ClientProtectedRoute>
                  } />
                  <Route path="/transactions" element={
                    <ClientProtectedRoute requiredPermission="transactions.view">
                      <TransactionsView />
                    </ClientProtectedRoute>
                  } />
                  <Route path="/lists" element={
                    <ClientProtectedRoute requiredPermission="client.manage">
                      <ListManagementView />
                    </ClientProtectedRoute>
                  } />
                  <Route path="/unit-report" element={
                    <ClientProtectedRoute requiredPermission="unit.view">
                      <UnitReportView />
                    </ClientProtectedRoute>
                  } />
                  <Route path="/exchange-rates" element={
                    <ClientProtectedRoute>
                      <ExchangeRatesView />
                    </ClientProtectedRoute>
                  } />
                  <Route path="/waterbills" element={
                    <ClientProtectedRoute>
                      <WaterBillsViewV3 />
                    </ClientProtectedRoute>
                  } />
                  {/* Also keep water-bills route for backwards compatibility */}
                  <Route path="/water-bills" element={
                    <ClientProtectedRoute>
                      <WaterBillsViewV3 />
                    </ClientProtectedRoute>
                  } />
                  <Route path="/propane" element={
                    <ClientProtectedRoute>
                      <PropaneView />
                    </ClientProtectedRoute>
                  } />
                  <Route path="/add-expense" element={
                    <ClientProtectedRoute requiredPermission="transactions.create">
                      <AddExpenseView />
                    </ClientProtectedRoute>
                  } />
                  {/* Dynamic route for activities from the client configuration */}
                  <Route path="/:activity" element={
                    <ClientProtectedRoute>
                      <ActivityView />
                    </ClientProtectedRoute>
                  } />
                  {/* Fallback route within MainLayout */}
                  <Route path="*" element={<DashboardView />} />
                </Routes>
              </MainLayout>
            )}
          </StatusBarProvider>
          {showClientModal && (
            <ClientSwitchModal
              onClose={closeClientModal}
              onClientSelected={handleClientSelected}
            />
          )}
          <ExchangeRateModal
            isVisible={isModalVisible}
            status={modalStatus}
            onClose={closeModal}
          />
        </>
      } />
    </Routes>
  );
}

function App() {
  return (
    <MaintenanceGuard>
      <Router>
        <Routes>
          {/* Public routes that don't require authentication */}
          <Route path="/setup-password" element={<PasswordSetupView />} />
          
          {/* Protected routes that require authentication */}
          <Route path="/*" element={
            <AuthProvider>
              <ExchangeRateProvider>
                <ClientProvider>
                  <TransactionsProvider>
                    <TransactionFiltersProvider>
                      <AppContent />
                    </TransactionFiltersProvider>
                  </TransactionsProvider>
                </ClientProvider>
              </ExchangeRateProvider>
            </AuthProvider>
          } />
        </Routes>
      </Router>
    </MaintenanceGuard>
  );
}

export default App;