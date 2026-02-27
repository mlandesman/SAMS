import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider, useAuth } from './hooks/useAuthStable.jsx';
import { SelectedUnitProvider } from './context/SelectedUnitContext.jsx';
import AuthScreen from './components/AuthScreen';
import ClientSelect from './components/ClientSelect';
import ExpenseForm from './components/ExpenseForm';
import Confirmation from './components/Confirmation';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import RoleProtectedRoute from './components/RoleProtectedRoute';
import AuthTest from './components/AuthTest'; // Temporary test component
import Dashboard from './components/Dashboard';
import MobileOwnerDashboard from './components/owner/MobileOwnerDashboard';
import ExchangeRateTools from './components/ExchangeRateTools';
import UnitOwnerFinancialReport from './components/UnitOwnerFinancialReport';
import MyUnitReport from './components/MyUnitReport';
import UserDebugger from './components/UserDebugger';
import StaticTest from './components/StaticTest';
import AuthDebugMinimal from './components/AuthDebugMinimal.jsx'; // Temporary debug
import SimpleAuthTest from './components/SimpleAuthTest';
import MinimalAuthTest from './components/MinimalAuthTest';
import SuperSimpleTest from './components/SuperSimpleTest';
import UltraSimpleTest from './components/UltraSimpleTest';
import AuthDebugScreen from './components/AuthDebugScreen';
import ExpenseEntryScreen from './components/expense/ExpenseEntryScreen';
import ExchangeRatesView from './components/ExchangeRatesView.jsx';
import AboutScreen from './components/AboutScreen';
import TareasMenu from './components/TareasMenu';
import PropaneReadingEntry from './components/PropaneReadingEntry';
import WaterMeterEntryNew from './components/WaterMeterEntryNew';
import './styles/mobile.css';
import { initializeVersionCheck } from './utils/versionChecker';

// Initialize version checking
if (typeof window !== 'undefined') {
  initializeVersionCheck().then(versionInfo => {
    if (versionInfo) {
      console.log('SAMS Mobile Version Check Complete:', versionInfo);
    }
  }).catch(error => {
    console.error('Mobile version check failed:', error);
  });
}

// Mobile-optimized Material-UI theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '12px 24px',
          fontSize: '16px',
          minHeight: '48px', // Touch-friendly minimum
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiInputBase-root': {
            minHeight: '48px', // Touch-friendly inputs
            fontSize: '16px', // Prevent zoom on iOS
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        },
      },
    },
  },
});

const DashboardRouter = () => {
  const { isAdmin } = useAuth();
  return isAdmin ? <Dashboard /> : <MobileOwnerDashboard />;
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <SelectedUnitProvider>
          <Layout>
            <Routes>
              <Route path="/auth" element={<AuthScreen />} />
              <Route path="/test" element={<AuthTest />} />
              <Route path="/simple-test" element={<SimpleAuthTest />} />
              <Route path="/minimal-test" element={<MinimalAuthTest />} />
              <Route path="/super-simple" element={<SuperSimpleTest />} />
              <Route path="/ultra-simple" element={<UltraSimpleTest />} />
              <Route path="/auth-debug" element={<AuthDebugScreen />} />
              <Route path="/user-debug" element={<UserDebugger />} />
              
              {/* Protected Routes — role-based dashboard */}
              <Route 
                path="/" 
                element={
                  <ProtectedRoute>
                    <DashboardRouter />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <DashboardRouter />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/exchange-rates" 
                element={
                  <ProtectedRoute>
                    <ExchangeRatesView />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/about" 
                element={
                  <ProtectedRoute>
                    <AboutScreen />
                  </ProtectedRoute>
                } 
              />
              
              {/* Maintenance Worker Routes */}
              <Route 
                path="/tareas" 
                element={
                  <ProtectedRoute>
                    <RoleProtectedRoute requiredRole="maintenance">
                      <TareasMenu />
                    </RoleProtectedRoute>
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/propane-reading" 
                element={
                  <ProtectedRoute>
                    <RoleProtectedRoute requiredRole="maintenance">
                      <PropaneReadingEntry />
                    </RoleProtectedRoute>
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/water-reading" 
                element={
                  <ProtectedRoute>
                    <RoleProtectedRoute requiredRole="maintenance">
                      <WaterMeterEntryNew />
                    </RoleProtectedRoute>
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/tareas/agua" 
                element={
                  <ProtectedRoute>
                    <RoleProtectedRoute requiredRole="maintenance">
                      <WaterMeterEntryNew />
                    </RoleProtectedRoute>
                  </ProtectedRoute>
                } 
              />
              
              {/* Admin-only Routes */}
              <Route 
                path="/expense-entry" 
                element={
                  <ProtectedRoute>
                    <RoleProtectedRoute requiredRole="admin">
                      <ExpenseEntryScreen />
                    </RoleProtectedRoute>
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/expense-desktop" 
                element={
                  <ProtectedRoute>
                    <RoleProtectedRoute requiredRole="admin">
                      <ExpenseForm />
                    </RoleProtectedRoute>
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/clients" 
                element={
                  <ProtectedRoute>
                    <RoleProtectedRoute requiredRole="admin">
                      <ClientSelect />
                    </RoleProtectedRoute>
                  </ProtectedRoute>
                } 
              />
              
              {/* Unit Owner Routes */}
              <Route 
                path="/my-report" 
                element={
                  <ProtectedRoute>
                    <RoleProtectedRoute requiredRole="unitOwner">
                      <MyUnitReport />
                    </RoleProtectedRoute>
                  </ProtectedRoute>
                } 
              />
              
              {/* Legacy Unit Report */}
              <Route 
                path="/my-report-old" 
                element={
                  <ProtectedRoute>
                    <RoleProtectedRoute requiredRole="unitOwner">
                      <UnitOwnerFinancialReport />
                    </RoleProtectedRoute>
                  </ProtectedRoute>
                } 
              />
              
              {/* Legacy routes */}
              <Route 
                path="/expense/:clientId" 
                element={
                  <ProtectedRoute>
                    <RoleProtectedRoute requiredRole="admin">
                      <ExpenseForm />
                    </RoleProtectedRoute>
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/confirmation" 
                element={
                  <ProtectedRoute>
                    <Confirmation />
                  </ProtectedRoute>
                } 
              />
              
              <Route path="*" element={<Navigate to="/auth" replace />} />
            </Routes>
          </Layout>
          </SelectedUnitProvider>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
