import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tab, Tabs, Box, Typography, Alert, CircularProgress, Button } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCoins,
  faChartPie,
  faFileAlt,
  faVoteYea,
  faComments,
  faSpinner,
  faChartLine
} from '@fortawesome/free-solid-svg-icons';
import { useClient } from '../context/ClientContext';
import { useStatusBar } from '../context/StatusBarContext';
import ActivityActionBar from '../components/common/ActivityActionBar';
import BudgetEntryTab from '../components/budget/BudgetEntryTab';
import BudgetReportTab from '../components/budget/BudgetReportTab';
import { getPolls, getPoll, createPoll } from '../api/polls';
import { getFiscalYear } from '../utils/fiscalYearUtils';
import PollCreationWizard from '../components/polls/PollCreationWizard';
import reportService from '../services/reportService';
import '../layout/ActionBar.css';
import './BudgetView.css';

// TabPanel component to handle tab content
function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`budget-tabpanel-${index}`}
      aria-labelledby={`budget-tab-${index}`}
      className="budget-tabpanel"
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {children}
        </Box>
      )}
    </div>
  );
}

// Main Budget View component
function BudgetView() {
  const navigate = useNavigate();
  const { selectedClient } = useClient();
  const [tabIndex, setTabIndex] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [zoomMode, setZoomMode] = useState('custom');
  const { setCenterContent, clearCenterContent } = useStatusBar();
  const [budgetPoll, setBudgetPoll] = useState(null);
  const [budgetPollSummary, setBudgetPollSummary] = useState(null);
  const [pollError, setPollError] = useState('');
  const [pollWizardOpen, setPollWizardOpen] = useState(false);
  const [pollWizardIntent, setPollWizardIntent] = useState('vote'); // 'vote' | 'poll'
  const [generatedDocuments, setGeneratedDocuments] = useState([]);
  const [generatingDocs, setGeneratingDocs] = useState(false);

  const handleZoomChange = useCallback((event) => {
    const value = event.target.value;
    
    if (value === 'page-width' || value === 'single-page') {
      setZoomMode(value);
      if (value === 'page-width') {
        setZoom(0.8);
      } else if (value === 'single-page') {
        setZoom(0.5);
      }
    } else {
      setZoomMode('custom');
      setZoom(Number(value));
    }
  }, []);

  // Register zoom control in the StatusBar center when on Budget Report tab
  useEffect(() => {
    if (tabIndex !== 1) {
      clearCenterContent();
      return;
    }

    const zoomControl = (
      <div className="status-zoom-control">
        <span className="status-zoom-label">Zoom</span>
        <select
          className="status-zoom-select"
          value={zoomMode === 'custom' ? zoom : zoomMode}
          onChange={handleZoomChange}
        >
          <optgroup label="Fit">
            <option value="page-width">Page Width</option>
            <option value="single-page">Single Page</option>
          </optgroup>
          <optgroup label="Percentage">
            <option value={0.75}>75%</option>
            <option value={1.0}>100%</option>
            <option value={1.25}>125%</option>
            <option value={1.5}>150%</option>
            <option value={2.0}>200%</option>
          </optgroup>
        </select>
      </div>
    );

    setCenterContent(zoomControl);

    return () => {
      clearCenterContent();
    };
  }, [zoom, zoomMode, tabIndex, setCenterContent, clearCenterContent, handleZoomChange]);

  useEffect(() => {
    const loadBudgetPoll = async () => {
      if (!selectedClient?.id) {
        setBudgetPoll(null);
        setBudgetPollSummary(null);
        return;
      }
      try {
        const pollsResult = await getPolls(selectedClient.id);
        const polls = (pollsResult.data || []).filter((poll) => poll.category === 'budget_approval');
        if (polls.length === 0) {
          setBudgetPoll(null);
          setBudgetPollSummary(null);
          return;
        }
        const openPoll = polls.find((poll) => poll.status === 'open');
        const parseDateValue = (field) => {
          if (!field) return 0;
          const value = field.iso || field.ISO_8601 || field;
          return value ? Date.parse(value) : 0;
        };
        const target = openPoll || polls.sort((a, b) => parseDateValue(b.closesAt) - parseDateValue(a.closesAt))[0];
        const pollDetail = await getPoll(selectedClient.id, target.pollId || target.id);
        setBudgetPoll(pollDetail.data);
        setBudgetPollSummary(pollDetail.data?.summary || pollDetail.data?.results || null);
      } catch (error) {
        setPollError(error.message || 'Failed to load budget vote');
      }
    };

    loadBudgetPoll();
  }, [selectedClient?.id]);

  const currentFiscalYear = selectedClient?.configuration?.fiscalYearStartMonth != null
    ? getFiscalYear(new Date(), selectedClient.configuration.fiscalYearStartMonth)
    : new Date().getFullYear();

  const handleBudgetPollCreated = useCallback(() => {
    setPollWizardOpen(false);
    setPollError('');
    if (!selectedClient?.id) return;
    const loadBudgetPoll = async () => {
      try {
        const pollsResult = await getPolls(selectedClient.id);
        const polls = (pollsResult.data || []).filter((p) => p.category === 'budget_approval');
        if (polls.length === 0) return;
        const openPoll = polls.find((p) => p.status === 'open');
        const parseDateValue = (field) => {
          if (!field) return 0;
          const value = field.iso || field.ISO_8601 || field;
          return value ? Date.parse(value) : 0;
        };
        const target = openPoll || polls.sort((a, b) => parseDateValue(b.closesAt) - parseDateValue(a.closesAt))[0];
        const pollDetail = await getPoll(selectedClient.id, target.pollId || target.id);
        setBudgetPoll(pollDetail.data);
        setBudgetPollSummary(pollDetail.data?.summary || pollDetail.data?.results || null);
      } catch (error) {
        setPollError(error.message || 'Failed to load budget vote');
      }
    };
    loadBudgetPoll();
  }, [selectedClient?.id]);

  const handleCreateVoteOrPoll = useCallback(async (intent) => {
    if (!selectedClient?.id) return;
    
    setPollWizardIntent(intent);
    setGeneratingDocs(true);
    setPollError('');
    
    try {
      // Generate both English and Spanish PDFs
      const [enDoc, esDoc] = await Promise.all([
        reportService.generateBudgetPdfForPoll(selectedClient.id, currentFiscalYear, 'english'),
        reportService.generateBudgetPdfForPoll(selectedClient.id, currentFiscalYear, 'spanish')
      ]);
      
      const docs = [
        {
          id: `budget-${currentFiscalYear}-en`,
          name: `Budget Report FY${enDoc.fiscalYear} (English)`,
          url: enDoc.url,
          type: 'budget_report',
          uploadedAt: new Date().toISOString(),
          uploadedBy: 'system'
        },
        {
          id: `budget-${currentFiscalYear}-es`,
          name: `Presupuesto FY${esDoc.fiscalYear} (Español)`,
          url: esDoc.url,
          type: 'budget_report',
          uploadedAt: new Date().toISOString(),
          uploadedBy: 'system'
        }
      ];
      
      setGeneratedDocuments(docs);
      setPollWizardOpen(true);
    } catch (error) {
      console.error('Failed to generate budget PDFs:', error);
      setPollError(`Failed to generate budget documents: ${error.message}`);
      // Still open wizard without documents if generation fails
      setGeneratedDocuments([]);
      setPollWizardOpen(true);
    } finally {
      setGeneratingDocs(false);
    }
  }, [selectedClient?.id, currentFiscalYear]);

  if (!selectedClient) {
    return (
      <div className="view-container">
        <Alert severity="info" sx={{ mt: 2, mx: 2 }}>
          Please select a client to manage budgets
        </Alert>
      </div>
    );
  }

  return (
    <div className="view-container">
      {/* ACTION BAR */}
      <ActivityActionBar>
        <button 
          className="action-item" 
          onClick={() => navigate('/reports', { state: { activeTab: 'budget-actual' } })}
          title="View Budget vs Actual report"
        >
          <FontAwesomeIcon icon={faChartLine} />
          <span>Budget vs Actual</span>
        </button>
        <button 
          className="action-item" 
          onClick={() => handleCreateVoteOrPoll('vote')}
          disabled={generatingDocs}
          title="Create budget approval vote"
        >
          <FontAwesomeIcon icon={generatingDocs ? faSpinner : faVoteYea} spin={generatingDocs} />
          <span>{generatingDocs ? 'Generating...' : 'Create Vote'}</span>
        </button>
        <button 
          className="action-item" 
          onClick={() => handleCreateVoteOrPoll('poll')}
          disabled={generatingDocs}
          title="Create budget discussion poll"
        >
          <FontAwesomeIcon icon={generatingDocs ? faSpinner : faComments} spin={generatingDocs} />
          <span>{generatingDocs ? 'Generating...' : 'Create Poll'}</span>
        </button>
      </ActivityActionBar>
      
      {pollError && (
        <Alert severity="warning" sx={{ mb: 2, mx: 2 }}>
          {pollError}
        </Alert>
      )}
      {budgetPoll && (
        <Alert severity="info" sx={{ mb: 2, mx: 2 }}>
          Budget Vote: {budgetPoll.title} • {budgetPoll.status} • {budgetPollSummary?.totalResponses || 0}/{budgetPollSummary?.totalUnits || 0} responses
        </Alert>
      )}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={tabIndex} 
          onChange={(_, newValue) => setTabIndex(newValue)} 
          aria-label="budget tabs"
          className="budget-tabs"
        >
          <Tab 
            label="Budget Entry" 
            icon={<FontAwesomeIcon icon={faCoins} />}
            iconPosition="start"
          />
          <Tab 
            label="Budget Report" 
            icon={<FontAwesomeIcon icon={faFileAlt} />}
            iconPosition="start"
          />
        </Tabs>
      </Box>
      
      <TabPanel value={tabIndex} index={0}>
        <BudgetEntryTab />
      </TabPanel>
      
      <TabPanel value={tabIndex} index={1}>
        <BudgetReportTab zoom={zoom} zoomMode={zoomMode} />
      </TabPanel>

      <PollCreationWizard
        isOpen={pollWizardOpen}
        onClose={() => { setPollWizardOpen(false); setGeneratedDocuments([]); }}
        onSave={async (payload) => {
          if (!selectedClient?.id) return;
          await createPoll(selectedClient.id, payload);
          setGeneratedDocuments([]);
          handleBudgetPollCreated();
        }}
        poll={null}
        isEdit={false}
        context={{
          type: pollWizardIntent,
          category: 'budget_approval',
          fiscalYear: String(currentFiscalYear),
          responseType: 'approve_deny',
          documents: generatedDocuments,
        }}
      />
    </div>
  );
}

export default BudgetView;

