import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Slide,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuthStable.jsx';
import ClientSelector from './ClientSelector.jsx';
import ExpenseForm from './ExpenseForm.jsx';
import ExpenseConfirmation from './ExpenseConfirmation.jsx';
import './ExpenseEntry.css';

const ExpenseEntryScreen = () => {
  const { samsUser, currentClient, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [selectedClient, setSelectedClient] = useState(currentClient);
  const [showForm, setShowForm] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [error, setError] = useState(null);

  // Sync with auth client selection
  useEffect(() => {
    if (currentClient && currentClient !== selectedClient) {
      setSelectedClient(currentClient);
    }
  }, [currentClient, selectedClient]);

  // Auto-select client if user only has one (unit owners, single-client admins)
  useEffect(() => {
    if (!selectedClient && samsUser?.clientAccess) {
      const accessibleClients = Object.keys(samsUser.clientAccess);
      console.log('🔍 Auto-selection check:', { 
        selectedClient, 
        accessibleClients, 
        clientAccess: samsUser.clientAccess 
      });
      if (accessibleClients.length === 1) {
        console.log('🚀 Auto-selecting single client:', accessibleClients[0]);
        setSelectedClient(accessibleClients[0]);
        // Always auto-show the form - this is "Add Expense", not "Select Client"
        setShowForm(true);
      }
    }
  }, [selectedClient, samsUser]);

  // For multi-client users, show form immediately after client selection
  useEffect(() => {
    if (selectedClient && !showForm && !submitResult) {
      setShowForm(true);
    }
  }, [selectedClient, showForm, submitResult]);

  const handleClientSelect = (clientId) => {
    setSelectedClient(clientId);
    setError(null);
    // Auto-show form immediately - no intermediate state
    setShowForm(true);
  };

  const handleExpenseSubmit = (result) => {
    console.log('🎯 ExpenseEntryScreen: Expense submitted for client:', selectedClient, 'Result:', result);
    setSubmitResult(result);
    setShowForm(false);
    
    // Remove auto-navigation - let user control when to leave
  };

  const handleAddAnother = () => {
    setSubmitResult(null);
    setShowForm(true);
  };

  const handleChangeClient = () => {
    setSubmitResult(null);
    setShowForm(false);
    setSelectedClient(null);
  };

  const handleDone = () => {
    // Return to dashboard/home screen
    navigate('/');
  };

  const clearError = () => setError(null);

  if (authLoading) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="calc(100vh - 140px)"
        p={3}
      >
        <CircularProgress size={48} sx={{ mb: 2 }} />
        <Typography variant="body1" color="text.secondary">
          Loading your account...
        </Typography>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return (
      <Box p={3}>
        <Alert severity="error">
          Please log in to add expenses.
        </Alert>
      </Box>
    );
  }

  // Get user's accessible clients
  const accessibleClients = samsUser?.clientAccess 
    ? Object.keys(samsUser.clientAccess) 
    : [];

  if (accessibleClients.length === 0) {
    return (
      <Box p={3}>
        <Alert severity="warning">
          You don't have access to any clients. Please contact your administrator.
        </Alert>
      </Box>
    );
  }

  return (
    <Box className="expense-entry-screen">
      {error && (
        <Alert 
          severity="error" 
          sx={{ m: 2 }}
          onClose={clearError}
        >
          {error}
        </Alert>
      )}

      {/* Success State - Show confirmation */}
      {submitResult && (
        <Slide direction="up" in={!!submitResult}>
          <Box>
            <ExpenseConfirmation
              result={submitResult}
              clientId={selectedClient}
              onAddAnother={handleAddAnother}
              onDone={handleDone}
            />
          </Box>
        </Slide>
      )}

      {/* Client Selection State - only show if no client selected AND multiple clients available */}
      {!selectedClient && !submitResult && accessibleClients.length > 1 && (
        <Slide direction="right" in={!selectedClient}>
          <Box>
            <Box p={3}>
              <Box className="sandyland-header" mb={3}>
                <Typography variant="h4" className="gradient-text">
                  Add Expense
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Select a client to add an expense
                </Typography>
              </Box>
              
              <ClientSelector
                clients={accessibleClients}
                selected={selectedClient}
                onSelect={handleClientSelect}
                samsUser={samsUser}
              />
            </Box>
          </Box>
        </Slide>
      )}

      {/* Expense Form State */}
      {selectedClient && showForm && !submitResult && (
        <Slide direction="left" in={showForm}>
          <Box>
            <ExpenseForm
              clientId={selectedClient}
              onSubmit={handleExpenseSubmit}
              onCancel={handleChangeClient}
              samsUser={samsUser}
            />
          </Box>
        </Slide>
      )}
    </Box>
  );
};

export default ExpenseEntryScreen;
