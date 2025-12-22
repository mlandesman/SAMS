import React, { useState, useEffect } from 'react';
import { useClient } from '../../context/ClientContext';
import { getCategories } from '../../api/categories';
import { fetchBudgetsByYear, saveBudget, fetchPriorYearData } from '../../api/budget';
import { getFiscalYear } from '../../utils/fiscalYearUtils';
import { getMexicoDate } from '../../utils/timezone';
import { CircularProgress, Alert, TextField, Button, Select, MenuItem, FormControl, InputLabel, IconButton, Tooltip } from '@mui/material';
import { Refresh, SystemUpdateAlt } from '@mui/icons-material';
import { centavosToPesos, pesosToCentavos } from '../../utils/currencyUtils';
import './BudgetEntryTab.css';


function BudgetEntryTab() {
  const { selectedClient } = useClient();
  const [categories, setCategories] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [editingAmounts, setEditingAmounts] = useState({}); // { categoryId: amountInPesos }
  const [editingNotes, setEditingNotes] = useState({}); // { categoryId: notesString }
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copyingBudget, setCopyingBudget] = useState({}); // { categoryId: true/false }
  const [copyingActual, setCopyingActual] = useState({}); // { categoryId: true/false }

  // Get fiscal year configuration
  const fiscalYearStartMonth = selectedClient?.configuration?.fiscalYearStartMonth || 1;

  // Initialize selected year to current fiscal year
  useEffect(() => {
    if (selectedClient && selectedYear === null) {
      const today = getMexicoDate();
      const currentFiscalYear = getFiscalYear(today, fiscalYearStartMonth);
      setSelectedYear(currentFiscalYear);
    }
  }, [selectedClient, fiscalYearStartMonth, selectedYear]);

  // Fetch categories and budgets when client or year changes
  useEffect(() => {
    if (!selectedClient || !selectedYear) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch categories
        const categoriesResult = await getCategories(selectedClient.id);
        const allCategories = categoriesResult.data || [];
        
        // Filter out categories marked as notBudgeted
        // These include projects, special assessments, transfers, etc.
        const categoriesList = allCategories.filter(cat => !cat.notBudgeted);
        setCategories(categoriesList);

        // Fetch budgets for selected year
        const budgetsResult = await fetchBudgetsByYear(selectedClient.id, selectedYear);
        const budgetsList = budgetsResult.data || [];
        
        // Convert to map for easy lookup
        const budgetsMap = {};
        budgetsList.forEach(budget => {
          budgetsMap[budget.categoryId] = budget;
        });
        setBudgets(budgetsMap);

        // Initialize editing amounts (convert centavos to pesos for display)
        const editingMap = {};
        const notesMap = {};
        categoriesList.forEach(category => {
          const budget = budgetsMap[category.id];
          editingMap[category.id] = budget && budget.amount > 0 
            ? centavosToPesos(budget.amount) 
            : '';
          notesMap[category.id] = budget?.notes || '';
        });
        setEditingAmounts(editingMap);
        setEditingNotes(notesMap);

      } catch (err) {
        console.error('Error fetching budget data:', err);
        setError(err.message || 'Failed to load budget data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedClient, selectedYear]);

  // Generate year options (current fiscal year and next year)
  const getYearOptions = () => {
    if (!selectedClient) return [];
    
    const today = getMexicoDate();
    const currentFiscalYear = getFiscalYear(today, fiscalYearStartMonth);
    const nextFiscalYear = currentFiscalYear + 1;
    
    return [
      { value: currentFiscalYear, label: `FY ${currentFiscalYear}` },
      { value: nextFiscalYear, label: `FY ${nextFiscalYear}` }
    ];
  };

  // Handle amount input change
  const handleAmountChange = (categoryId, value) => {
    // Allow empty string or valid number (non-negative, reasonable max)
    const numValue = parseFloat(value);
    if (value === '' || (!isNaN(numValue) && numValue >= 0 && numValue <= 999999999)) {
      setEditingAmounts(prev => ({
        ...prev,
        [categoryId]: value
      }));
      setSaveSuccess(false);
      setError(null); // Clear any previous errors
    }
  };

  // Handle notes input change
  const handleNotesChange = (categoryId, value) => {
    setEditingNotes(prev => ({
      ...prev,
      [categoryId]: value
    }));
    setSaveSuccess(false);
  };

  // Save single budget entry
  const handleSaveSingle = async (categoryId) => {
    if (!selectedClient || !selectedYear) return;

    const amountInPesos = editingAmounts[categoryId];
    if (amountInPesos === '' || amountInPesos === undefined) {
      // Save as 0 if amount is empty
      setSaving(true);
      setError(null);
      
      try {
        await saveBudget(selectedClient.id, categoryId, selectedYear, 0, editingNotes[categoryId] || '');
        
        // Refresh budgets
        const budgetsResult = await fetchBudgetsByYear(selectedClient.id, selectedYear);
        const budgetsList = budgetsResult.data || [];
        const budgetsMap = {};
        budgetsList.forEach(budget => {
          budgetsMap[budget.categoryId] = budget;
        });
        setBudgets(budgetsMap);
        
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } catch (err) {
        console.error('Error saving budget:', err);
        setError(err.message || 'Failed to save budget');
      } finally {
        setSaving(false);
      }
      return;
    }

    // Validate amount
    const numValue = parseFloat(amountInPesos);
    if (isNaN(numValue) || numValue < 0) {
      setError('Please enter a valid non-negative amount');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const amountInCentavos = pesosToCentavos(numValue);
      await saveBudget(selectedClient.id, categoryId, selectedYear, amountInCentavos, editingNotes[categoryId] || '');
      
      // Refresh budgets
      const budgetsResult = await fetchBudgetsByYear(selectedClient.id, selectedYear);
      const budgetsList = budgetsResult.data || [];
      const budgetsMap = {};
      budgetsList.forEach(budget => {
        budgetsMap[budget.categoryId] = budget;
      });
      setBudgets(budgetsMap);
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving budget:', err);
      const errorMessage = err.message || 'Failed to save budget';
      // Handle network errors gracefully
      if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setSaving(false);
    }
  };

  // Save all budgets
  const handleSaveAll = async () => {
    if (!selectedClient || !selectedYear) return;

    // Validate all amounts before saving
    const invalidEntries = Object.entries(editingAmounts).filter(([categoryId, amount]) => {
      if (amount === '' || amount === undefined) return false; // Empty is OK (will save as 0)
      const numValue = parseFloat(amount);
      return isNaN(numValue) || numValue < 0 || numValue > 999999999;
    });

    if (invalidEntries.length > 0) {
      setError('Please fix invalid amounts before saving. Amounts must be non-negative numbers.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Save all budgets (including empty ones as 0)
      const savePromises = Object.entries(editingAmounts).map(([categoryId, amount]) => {
        const amountInCentavos = amount === '' || amount === undefined 
          ? 0 
          : pesosToCentavos(parseFloat(amount));
        return saveBudget(selectedClient.id, categoryId, selectedYear, amountInCentavos, editingNotes[categoryId] || '');
      });

      await Promise.all(savePromises);
      
      // Refresh budgets
      const budgetsResult = await fetchBudgetsByYear(selectedClient.id, selectedYear);
      const budgetsList = budgetsResult.data || [];
      const budgetsMap = {};
      budgetsList.forEach(budget => {
        budgetsMap[budget.categoryId] = budget;
      });
      setBudgets(budgetsMap);
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving budgets:', err);
      const errorMessage = err.message || 'Failed to save budgets';
      // Handle network errors gracefully
      if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="budget-loading-container">
        <CircularProgress size={40} />
        <p>Loading budget data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  const yearOptions = getYearOptions();

  // Calculate totals for income and expenses
  const calculateTotals = () => {
    let totalIncome = 0;
    let totalExpenses = 0;

    categories.forEach(category => {
      const amountInPesos = editingAmounts[category.id];
      if (amountInPesos !== '' && amountInPesos !== undefined) {
        const amount = parseFloat(amountInPesos) || 0;
        if (category.type === 'income') {
          totalIncome += amount;
        } else {
          totalExpenses += amount;
        }
      }
    });

    return { totalIncome, totalExpenses };
  };

  const { totalIncome, totalExpenses } = calculateTotals();
  const reserve = totalIncome - totalExpenses;

  // Separate categories by type for grouped display
  const incomeCategories = categories.filter(cat => cat.type === 'income');
  const expenseCategories = categories.filter(cat => cat.type === 'expense');

  // Format currency for display
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Handle copying prior year budget
  const handleCopyPriorBudget = async (categoryId) => {
    if (!selectedClient || !selectedYear) return;

    const priorYear = selectedYear - 1;
    setCopyingBudget(prev => ({ ...prev, [categoryId]: true }));
    setError(null);

    try {
      const result = await fetchPriorYearData(selectedClient.id, categoryId, selectedYear);
      const data = result.data;

      if (data.budget && data.budget.amount > 0) {
        // Populate amount (convert centavos to pesos)
        const amountInPesos = centavosToPesos(data.budget.amount);
        setEditingAmounts(prev => ({
          ...prev,
          [categoryId]: amountInPesos
        }));

        // Populate notes only if currently empty
        const currentNotes = editingNotes[categoryId] || '';
        if (!currentNotes || currentNotes.trim() === '') {
          setEditingNotes(prev => ({
            ...prev,
            [categoryId]: `Copied from FY ${priorYear} Budget`
          }));
        }
      } else {
        setError(`No FY ${priorYear} budget found for ${categories.find(c => c.id === categoryId)?.name || 'this category'}`);
      }
    } catch (err) {
      console.error('Error copying prior budget:', err);
      setError(err.message || 'Failed to copy prior year budget');
    } finally {
      setCopyingBudget(prev => ({ ...prev, [categoryId]: false }));
    }
  };

  // Handle copying prior year actual spending
  const handleCopyPriorActual = async (categoryId) => {
    if (!selectedClient || !selectedYear) return;

    const priorYear = selectedYear - 1;
    setCopyingActual(prev => ({ ...prev, [categoryId]: true }));
    setError(null);

    try {
      const result = await fetchPriorYearData(selectedClient.id, categoryId, selectedYear);
      const data = result.data;

      if (data.actual && data.actual.amount > 0) {
        // Populate amount (convert centavos to pesos)
        const amountInPesos = centavosToPesos(data.actual.amount);
        setEditingAmounts(prev => ({
          ...prev,
          [categoryId]: amountInPesos
        }));

        // Populate notes only if currently empty
        const currentNotes = editingNotes[categoryId] || '';
        if (!currentNotes || currentNotes.trim() === '') {
          const formattedAmount = formatCurrency(amountInPesos);
          setEditingNotes(prev => ({
            ...prev,
            [categoryId]: `Based on FY ${priorYear} Actual ($${formattedAmount})`
          }));
        }
      } else {
        // No spending in prior year - set to 0 with note
        setEditingAmounts(prev => ({
          ...prev,
          [categoryId]: 0
        }));

        const currentNotes = editingNotes[categoryId] || '';
        if (!currentNotes || currentNotes.trim() === '') {
          setEditingNotes(prev => ({
            ...prev,
            [categoryId]: `No spending in FY ${priorYear}`
          }));
        }
      }
    } catch (err) {
      console.error('Error copying prior actual:', err);
      setError(err.message || 'Failed to copy prior year actual spending');
    } finally {
      setCopyingActual(prev => ({ ...prev, [categoryId]: false }));
    }
  };

  return (
    <div className="budget-entry-tab">
      <div className="budget-entry-header">
        <FormControl sx={{ minWidth: 200, mr: 2 }}>
          <InputLabel>Fiscal Year</InputLabel>
          <Select
            value={selectedYear || ''}
            onChange={(e) => setSelectedYear(e.target.value)}
            label="Fiscal Year"
          >
            {yearOptions.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <div className="budget-totals" style={{ display: 'flex', gap: '24px', alignItems: 'center', fontSize: '24px' }}>
          <div>
            <strong>Total Income:</strong> ${formatCurrency(totalIncome)}
          </div>
          <div>
            <strong>Total Expenses:</strong> ${formatCurrency(totalExpenses)}
          </div>
          <div>
            <strong>Reserve:</strong> ${formatCurrency(reserve)}
          </div>
        </div>
        
        <Button
          variant="contained"
          color="primary"
          onClick={handleSaveAll}
          disabled={saving}
          sx={{ ml: 'auto' }}
        >
          {saving ? 'Saving...' : 'Save All'}
        </Button>
      </div>

      {saveSuccess && (
        <Alert severity="success" sx={{ mt: 2, mb: 2 }}>
          Budgets saved successfully!
        </Alert>
      )}

      {/* Single scrollable wrapper for both tables */}
      <div className="budget-tables-wrapper">
        {/* Income Categories Table */}
        <h2 style={{ marginTop: '16px', marginBottom: '12px', color: '#2e7d32', borderBottom: '2px solid #2e7d32', paddingBottom: '8px' }}>
          Income
        </h2>
        <table className="budget-table">
          <thead>
            <tr>
              <th>Category Name</th>
              <th>Budget Amount (MXN)</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {incomeCategories.map(category => {
              const amountInPesos = editingAmounts[category.id] || '';
              
              return (
                <tr key={category.id}>
                  <td>{category.name}</td>
                  <td>
                    <TextField
                      type="number"
                      value={amountInPesos}
                      onChange={(e) => handleAmountChange(category.id, e.target.value)}
                      placeholder="0.00"
                      inputProps={{ 
                        min: 0,
                        step: 0.01
                      }}
                      sx={{ width: '150px' }}
                      size="small"
                    />
                  </td>
                  <td>
                    <TextField
                      value={editingNotes[category.id] || ''}
                      onChange={(e) => handleNotesChange(category.id, e.target.value)}
                      placeholder="Budget notes..."
                      multiline
                      minRows={1}
                      maxRows={3}
                      sx={{ width: '250px' }}
                      size="small"
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <Tooltip title={`Copy FY ${selectedYear - 1} Budget`}>
                        <IconButton
                          size="small"
                          onClick={() => handleCopyPriorBudget(category.id)}
                          disabled={saving || copyingBudget[category.id] || copyingActual[category.id]}
                          color="primary"
                        >
                          {copyingBudget[category.id] ? <CircularProgress size={16} /> : <Refresh />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={`Copy FY ${selectedYear - 1} Actual`}>
                        <IconButton
                          size="small"
                          onClick={() => handleCopyPriorActual(category.id)}
                          disabled={saving || copyingBudget[category.id] || copyingActual[category.id]}
                          color="success"
                        >
                          {copyingActual[category.id] ? <CircularProgress size={16} /> : <SystemUpdateAlt />}
                        </IconButton>
                      </Tooltip>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleSaveSingle(category.id)}
                        disabled={saving || copyingBudget[category.id] || copyingActual[category.id]}
                      >
                        Save
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Expense Categories Table */}
        <h2 style={{ marginTop: '32px', marginBottom: '12px', color: '#616161', borderBottom: '2px solid #616161', paddingBottom: '8px' }}>
          Expenses
        </h2>
        <table className="budget-table">
          <thead>
            <tr>
              <th>Category Name</th>
              <th>Budget Amount (MXN)</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenseCategories.map(category => {
              const amountInPesos = editingAmounts[category.id] || '';
              
              return (
                <tr key={category.id}>
                  <td>{category.name}</td>
                  <td>
                    <TextField
                      type="number"
                      value={amountInPesos}
                      onChange={(e) => handleAmountChange(category.id, e.target.value)}
                      placeholder="0.00"
                      inputProps={{ 
                        min: 0,
                        step: 0.01
                      }}
                      sx={{ width: '150px' }}
                      size="small"
                    />
                  </td>
                  <td>
                    <TextField
                      value={editingNotes[category.id] || ''}
                      onChange={(e) => handleNotesChange(category.id, e.target.value)}
                      placeholder="Budget notes..."
                      multiline
                      minRows={1}
                      maxRows={3}
                      sx={{ width: '250px' }}
                      size="small"
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <Tooltip title={`Copy FY ${selectedYear - 1} Budget`}>
                        <IconButton
                          size="small"
                          onClick={() => handleCopyPriorBudget(category.id)}
                          disabled={saving || copyingBudget[category.id] || copyingActual[category.id]}
                          color="primary"
                        >
                          {copyingBudget[category.id] ? <CircularProgress size={16} /> : <Refresh />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={`Copy FY ${selectedYear - 1} Actual`}>
                        <IconButton
                          size="small"
                          onClick={() => handleCopyPriorActual(category.id)}
                          disabled={saving || copyingBudget[category.id] || copyingActual[category.id]}
                          color="success"
                        >
                          {copyingActual[category.id] ? <CircularProgress size={16} /> : <SystemUpdateAlt />}
                        </IconButton>
                      </Tooltip>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleSaveSingle(category.id)}
                        disabled={saving || copyingBudget[category.id] || copyingActual[category.id]}
                      >
                        Save
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>{/* End budget-tables-wrapper */}
    </div>
  );
}

export default BudgetEntryTab;

