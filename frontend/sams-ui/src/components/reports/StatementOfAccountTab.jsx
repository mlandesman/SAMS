import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useClient } from '../../context/ClientContext';
import { useAuth } from '../../context/AuthContext';
import { getUnits } from '../../api/units';
import { getOwnerInfo, sortUnitsByUnitId } from '../../utils/unitUtils';
import { getFiscalYear, getFiscalYearLabel } from '../../utils/fiscalYearUtils';
import { getMexicoDate } from '../../utils/timezone';
import LoadingSpinner from '../common/LoadingSpinner';
import reportService from '../../services/reportService';
import { bulkGenerateStatements, bulkSendStatementEmails } from '../../api/admin';
import { sendStatementEmail } from '../../api/email';
import { printReport } from '../../utils/printUtils';
import EmailPrependModal from '../modals/EmailPrependModal';
import LocalPrintshopIcon from '@mui/icons-material/LocalPrintshop';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import GetAppIcon from '@mui/icons-material/GetApp';
import EmailIcon from '@mui/icons-material/Email';
import './StatementOfAccountTab.css';

import { getAuthInstance } from '../../firebaseClient';

// Get authentication headers with Firebase ID token
const getAuthHeaders = async () => {
  const auth = getAuthInstance();
  const user = auth.currentUser;
  
  if (!user) {
    throw new Error('No authenticated user');
  }
  
  const token = await user.getIdToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};


function normalizeLanguage(lang) {
  if (!lang) return null;
  // Handle case where lang might be an object (defensive coding)
  if (typeof lang !== 'string') {
    lang = String(lang);
  }
  const lower = lang.toLowerCase().trim();
  if (lower === 'english' || lower === 'en') return 'english';
  if (lower === 'spanish' || lower === 'es') return 'spanish';
  return null;
}

function getDefaultLanguage({ selectedClient, samsUser }) {
  // 1) User preference takes precedence if available
  const userPref = normalizeLanguage(samsUser?.preferredLanguage);
  if (userPref) {
    return userPref;
  }

  // 2) Client configuration
  if (selectedClient) {
    const configLang = normalizeLanguage(selectedClient.configuration?.language);
    if (configLang) {
      return configLang;
    }
  }

  // 3) Explicit client defaults
  if (selectedClient?.id === 'AVII') {
    return 'spanish';
  }
  if (selectedClient?.id === 'MTC') {
    return 'english';
  }

  // 4) System default
  return 'english';
}

function buildFiscalYearOptions(selectedClient) {
  if (!selectedClient) {
    return [];
  }

  // Defensive: Ensure fiscalYearStartMonth is a valid number
  let fiscalYearStartMonth = selectedClient.configuration?.fiscalYearStartMonth;
  if (typeof fiscalYearStartMonth !== 'number' || isNaN(fiscalYearStartMonth)) {
    fiscalYearStartMonth = 1; // Default to calendar year
  }
  
  const todayMexico = getMexicoDate();
  const currentFiscalYear = getFiscalYear(todayMexico, fiscalYearStartMonth);

  const years = [currentFiscalYear, currentFiscalYear - 1, currentFiscalYear - 2];

  return years.map(year => ({
    value: year,
    label: getFiscalYearLabel(year, fiscalYearStartMonth)
  }));
}

function StatementOfAccountTab({ zoom = 1.0 }) {
  const { selectedClient } = useClient();
  const { samsUser } = useAuth();

  const [units, setUnits] = useState([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsError, setUnitsError] = useState(null);

  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [unitFilter, setUnitFilter] = useState('');

  const [fiscalYear, setFiscalYear] = useState(null);
  const [language, setLanguage] = useState('english');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [htmlPreview, setHtmlPreview] = useState(null);
  const [statementData, setStatementData] = useState(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState(null);

  // Bulk generation state
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(null);
  const [bulkResults, setBulkResults] = useState(null);
  const [bulkError, setBulkError] = useState(null);

  // Bulk email state
  const [bulkEmailing, setBulkEmailing] = useState(false);
  const [bulkEmailProgress, setBulkEmailProgress] = useState(null);
  const [bulkEmailResults, setBulkEmailResults] = useState(null);
  const [bulkEmailError, setBulkEmailError] = useState(null);

  // Email prepend modal state
  const [showEmailPrependModal, setShowEmailPrependModal] = useState(false);
  const [pendingEmailAction, setPendingEmailAction] = useState(null); // 'single' or 'bulk'

  // Initialise language and fiscal year when client or user changes
  useEffect(() => {
    if (!selectedClient) {
      return;
    }

    setLanguage(getDefaultLanguage({ selectedClient, samsUser }));

    const options = buildFiscalYearOptions(selectedClient);
    if (options.length > 0) {
      setFiscalYear(options[0].value);
    }
  }, [selectedClient, samsUser]);

  // Load units for the selected client
  useEffect(() => {
    const loadUnits = async () => {
      if (!selectedClient) {
        setUnits([]);
        return;
      }

      setUnitsLoading(true);
      setUnitsError(null);

      try {
        const result = await getUnits(selectedClient.id);
        const unitsList = Array.isArray(result.data) ? result.data : [];
        setUnits(sortUnitsByUnitId(unitsList));
      } catch (err) {
        console.error('Failed to load units for Statement of Account:', err);
        setUnitsError('Failed to load units. Please try again.');
      } finally {
        setUnitsLoading(false);
      }
    };

    loadUnits();
  }, [selectedClient]);

  const filteredUnits = useMemo(() => {
    if (!unitFilter) {
      return units;
    }

    const filterLower = unitFilter.toLowerCase();
    return units.filter(unit => {
      const ownerInfo = getOwnerInfo(unit || {});
      const parts = [
        unit.unitId || '',
        ownerInfo.firstName || '',
        ownerInfo.lastName || ''
      ]
        .join(' ')
        .toLowerCase();

      return parts.includes(filterLower);
    });
  }, [units, unitFilter]);

  const unitOptions = useMemo(
    () =>
      filteredUnits.map(unit => {
        const ownerInfo = getOwnerInfo(unit || {});
        const lastName = ownerInfo.lastName || '';
        const unitId = unit.unitId || '';
        const label = lastName ? `${unitId} - ${lastName}` : unitId;
        return {
          value: unitId,
          label
        };
      }),
    [filteredUnits]
  );

  const fiscalYearOptions = useMemo(
    () => buildFiscalYearOptions(selectedClient),
    [selectedClient]
  );

  // Handle bulk generation (defined before handleGenerate so it can be called)
  const handleBulkGenerate = useCallback(async () => {
    if (!selectedClient) {
      return;
    }

    setBulkGenerating(true);
    setBulkError(null);
    setBulkProgress(null);
    setBulkResults(null);

    try {
      const result = await bulkGenerateStatements(
        selectedClient.id,
        fiscalYear,
        language,
        (progress) => {
          // Update progress as we receive updates
          setBulkProgress({
            current: progress.current,
            total: progress.total,
            generated: progress.generated,
            failed: progress.failed,
            message: progress.message,
            status: progress.status
          });
        }
      );

      if (result.success && result.data) {
        setBulkResults(result.data);
        setBulkProgress({
          total: result.data.totalUnits,
          generated: result.data.generated,
          failed: result.data.failed,
          current: result.data.totalUnits
        });
      } else {
        throw new Error(result.error || 'Bulk generation failed');
      }
    } catch (err) {
      console.error('Bulk generation error:', err);
      setBulkError(err.message || 'Failed to generate bulk statements. Please try again.');
    } finally {
      setBulkGenerating(false);
    }
  }, [selectedClient, fiscalYear, language]);

  const handleGenerate = useCallback(
    async event => {
      if (event) {
        event.preventDefault();
      }

      if (!selectedClient) {
        return;
      }

      // If no unit selected, trigger bulk generation instead
      if (!selectedUnitId) {
        await handleBulkGenerate();
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Request both languages to optimize email generation (avoids recalculation)
        const data = await reportService.getStatementData(
          selectedClient.id,
          selectedUnitId,
          fiscalYear,
          { language, generateBothLanguages: true }
        );

        // Select HTML based on current language preference (saves 1/3 data transfer)
        // Handle both dual-language (htmlEn/htmlEs) and single-language (html) responses
        const selectedHtml = data.htmlEn && data.htmlEs 
          ? (language === 'spanish' ? data.htmlEs : data.htmlEn)
          : data.html;  // Fallback to single-language html if dual-language not available
        const selectedMeta = data.metaEn && data.metaEs
          ? (language === 'spanish' ? data.metaEs : data.metaEn)
          : data.meta;  // Fallback to single-language meta if dual-language not available

        // Debug: inspect the raw HTML returned from the backend
        try {
          const snippet = selectedHtml?.slice(0, 800) || '';
          console.log(
            '🧾 [StatementOfAccountTab] HTML response length:',
            selectedHtml?.length || 0
          );
          console.log('🧾 [StatementOfAccountTab] Dual-language HTML lengths:', {
            htmlEn: data.htmlEn?.length || 0,
            htmlEs: data.htmlEs?.length || 0,
            selected: selectedHtml?.length || 0
          });
          console.log('🧾 [StatementOfAccountTab] HTML snippet:\n', snippet);
        } catch (logError) {
          console.warn(
            '⚠️ [StatementOfAccountTab] Failed to log HTML snippet:',
            logError
          );
        }

        // Debug: Check data before storing
        console.log('💾 Before storing - data object:', {
          hasHtmlEn: !!data.htmlEn,
          htmlEnLength: data.htmlEn?.length || 0,
          hasHtmlEs: !!data.htmlEs,
          htmlEsLength: data.htmlEs?.length || 0,
          dataKeys: Object.keys(data).join(', ')
        });
        
        // Store data with selected language HTML for backward compatibility
        // Preserve both htmlEn and htmlEs for email PDF generation
        const dataToStore = {
          ...data,
          html: selectedHtml,  // Selected language HTML (for backward compatibility)
          meta: selectedMeta,  // Selected language meta (for backward compatibility)
          // Ensure htmlEn and htmlEs are preserved (they should already be in data)
          htmlEn: data.htmlEn || null,
          htmlEs: data.htmlEs || null,
          metaEn: data.metaEn || null,
          metaEs: data.metaEs || null
        };
        
        // Debug: Verify what we're storing
        console.log('💾 Storing statementData:', {
          hasHtmlEn: !!dataToStore.htmlEn,
          htmlEnLength: dataToStore.htmlEn?.length || 0,
          hasHtmlEs: !!dataToStore.htmlEs,
          htmlEsLength: dataToStore.htmlEs?.length || 0,
          keys: Object.keys(dataToStore).join(', ')
        });
        
        setStatementData(dataToStore);
        setHtmlPreview(selectedHtml);
        setHasGenerated(true);

        // NOTE: PDF generation is NOT automatic for single-unit preview
        // PDFs are only generated when:
        // 1. User clicks the "PDF" button (on-demand)
        // 2. Bulk generation via "GenerateAll" option
        // This prevents unnecessary preview calculations (which take ~90 seconds when PDFs are auto-generated)

      } catch (err) {
        console.error('Statement generation error:', err);
        setError('Failed to generate statement. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [selectedClient, selectedUnitId, language, fiscalYear]
  );

  const handleDownloadPdf = useCallback(
    async event => {
      if (event) {
        event.preventDefault();
      }

      if (!selectedClient || !selectedUnitId || !htmlPreview) {
        return;
      }

      setDownloadingPdf(true);
      try {
        await reportService.exportStatementPdfFromHtml(selectedClient.id, {
          unitId: selectedUnitId,
          fiscalYear,
          language,
          html: htmlPreview,
          // We don't yet have structured meta on the frontend; allow backend to
          // accept minimal/default footer metadata for interactive exports.
          meta: {}
        });
      } catch (err) {
        console.error('PDF download failed:', err);
        setError('Failed to download PDF. Please try again.');
      } finally {
        setDownloadingPdf(false);
      }
    },
    [selectedClient, selectedUnitId, htmlPreview, fiscalYear, language]
  );

  // Handle bulk email (defined before handleSendEmail so it can be called)
  const handleBulkEmail = useCallback(async () => {
    if (!selectedClient) {
      return;
    }

    setBulkEmailing(true);
    setBulkEmailError(null);
    setBulkEmailProgress(null);
    setBulkEmailResults(null);

    try {
      const result = await bulkSendStatementEmails(
        selectedClient.id,
        fiscalYear,
        (progress) => {
          // Update progress as we receive updates
          setBulkEmailProgress({
            current: progress.current,
            total: progress.total,
            sent: progress.sent,
            skipped: progress.skipped,
            failed: progress.failed,
            message: progress.message,
            status: progress.status
          });
        }
      );

      if (result.success && result.data) {
        setBulkEmailResults(result.data);
        setBulkEmailProgress({
          total: result.data.totalUnits,
          sent: result.data.sent,
          skipped: result.data.skipped,
          failed: result.data.failed,
          current: result.data.totalUnits
        });
      } else {
        throw new Error(result.error || 'Bulk email failed');
      }
    } catch (err) {
      console.error('Bulk email error:', err);
      setBulkEmailError(err.message || 'Failed to send bulk emails. Please try again.');
    } finally {
      setBulkEmailing(false);
    }
  }, [selectedClient, fiscalYear]);

  // Open prepend modal before sending email
  const handleEmailButtonClick = useCallback(() => {
    if (!selectedUnitId) {
      // Bulk email
      setPendingEmailAction('bulk');
    } else {
      // Single email
      setPendingEmailAction('single');
    }
    setShowEmailPrependModal(true);
  }, [selectedUnitId]);

  // Handle prepend modal confirmation
  const handlePrependConfirm = useCallback(async (prependData) => {
    setShowEmailPrependModal(false);
    
    if (pendingEmailAction === 'bulk') {
      await handleBulkEmailWithPrepend(prependData);
    } else {
      await handleSingleEmailWithPrepend(prependData);
    }
    
    setPendingEmailAction(null);
  }, [pendingEmailAction]);

  // Single email with prepend text
  const handleSingleEmailWithPrepend = async (prependData) => {
    if (!selectedClient) {
      setEmailResult({ success: false, message: 'Please select a client first' });
      return;
    }
    
    setEmailSending(true);
    setEmailResult(null);
    
    try {
      const emailContent = statementData?.emailContent || null;
      const statementHtml = htmlPreview || (language === 'spanish' ? statementData?.htmlEs : statementData?.htmlEn) || null;
      const statementMeta = statementData?.meta || (language === 'spanish' ? statementData?.metaEs : statementData?.metaEn) || null;
      const statementHtmlEn = statementData?.htmlEn || null;
      const statementMetaEn = statementData?.metaEn || null;
      const statementHtmlEs = statementData?.htmlEs || null;
      const statementMetaEs = statementData?.metaEs || null;
      
      const result = await sendStatementEmail(
        selectedClient.id, 
        selectedUnitId, 
        fiscalYear, 
        language, 
        emailContent, 
        statementHtml, 
        statementMeta,
        statementHtmlEn,
        statementHtmlEs,
        statementMetaEn,
        statementMetaEs,
        prependData.prependEn,
        prependData.prependEs
      );
      setEmailResult({ 
        success: true, 
        message: `Email sent to ${result.to.join(', ')}${result.cc?.length ? ` (CC: ${result.cc.join(', ')})` : ''} (${language})` 
      });
    } catch (error) {
      console.error('Failed to send statement email:', error);
      setEmailResult({ success: false, message: error.message });
    } finally {
      setEmailSending(false);
    }
  };

  // Bulk email with prepend text
  const handleBulkEmailWithPrepend = async (prependData) => {
    if (!selectedClient) {
      return;
    }

    setBulkEmailing(true);
    setBulkEmailError(null);
    setBulkEmailProgress(null);
    setBulkEmailResults(null);

    try {
      const result = await bulkSendStatementEmails(
        selectedClient.id,
        fiscalYear,
        (progress) => {
          setBulkEmailProgress({
            current: progress.current,
            total: progress.total,
            sent: progress.sent,
            skipped: progress.skipped,
            failed: progress.failed,
            message: progress.message,
            status: progress.status
          });
        },
        prependData.prependEn,
        prependData.prependEs
      );

      if (result.success && result.data) {
        setBulkEmailResults(result.data);
        setBulkEmailProgress({
          total: result.data.totalUnits,
          sent: result.data.sent,
          skipped: result.data.skipped,
          failed: result.data.failed,
          current: result.data.totalUnits
        });
      } else {
        throw new Error(result.error || 'Bulk email failed');
      }
    } catch (err) {
      console.error('Bulk email error:', err);
      setBulkEmailError(err.message || 'Failed to send bulk emails. Please try again.');
    } finally {
      setBulkEmailing(false);
    }
  };

  // Legacy handler - now delegates to prepend modal
  const handleSendEmail = async () => {
    if (!selectedClient) {
      setEmailResult({ success: false, message: 'Please select a client first' });
      return;
    }

    // If no unit selected, trigger bulk email instead
    if (!selectedUnitId) {
      await handleBulkEmail();
      return;
    }
    
    setEmailSending(true);
    setEmailResult(null);
    
    try {
      // Pass current display language and pre-calculated data if available
      // This allows backend to skip expensive recalculation (90% faster)
      const emailContent = statementData?.emailContent || null;
      // Use selected language HTML (from htmlPreview) or fall back to language-specific HTMLs
      const statementHtml = htmlPreview || (language === 'spanish' ? statementData?.htmlEs : statementData?.htmlEn) || null;
      const statementMeta = statementData?.meta || (language === 'spanish' ? statementData?.metaEs : statementData?.metaEn) || null;
      
      // Debug: Check statementData before extraction
      console.log('🔍 statementData check:', {
        exists: !!statementData,
        keys: statementData ? Object.keys(statementData).join(',') : 'none',
        hasHtmlEn: !!statementData?.htmlEn,
        htmlEnLength: statementData?.htmlEn?.length || 0,
        hasHtmlEs: !!statementData?.htmlEs,
        htmlEsLength: statementData?.htmlEs?.length || 0,
        hasMetaEn: !!statementData?.metaEn,
        hasMetaEs: !!statementData?.metaEs
      });
      
      // Extract dual-language HTMLs and metadata (if available from generateBothLanguages)
      const statementHtmlEn = statementData?.htmlEn || null;  // English HTML
      const statementMetaEn = statementData?.metaEn || null;  // English metadata
      const statementHtmlEs = statementData?.htmlEs || null;  // Spanish HTML
      const statementMetaEs = statementData?.metaEs || null;  // Spanish metadata
      
      // Debug logging
      console.log('📧 Frontend sending email:', {
        hasEmailContent: !!emailContent,
        hasStatementHtml: !!statementHtml,
        hasStatementMeta: !!statementMeta,
        hasStatementHtmlEn: !!statementHtmlEn,
        hasStatementMetaEn: !!statementMetaEn,
        hasStatementHtmlEs: !!statementHtmlEs,
        hasStatementMetaEs: !!statementMetaEs,
        statementHtmlEsType: typeof statementHtmlEs,
        statementHtmlEsLength: statementHtmlEs?.length || 0,
        statementMetaKeys: statementMeta ? Object.keys(statementMeta).join(',') : 'none',
        statementMetaValue: statementMeta
      });
      
      const result = await sendStatementEmail(
        selectedClient.id, 
        selectedUnitId, 
        fiscalYear, 
        language, 
        emailContent, 
        statementHtml, 
        statementMeta,
        statementHtmlEn,
        statementHtmlEs,  // Fixed: htmlEs comes before metaEn
        statementMetaEn,
        statementMetaEs
      );
      setEmailResult({ 
        success: true, 
        message: `Email sent to ${result.to.join(', ')}${result.cc?.length ? ` (CC: ${result.cc.join(', ')})` : ''} (${language})` 
      });
    } catch (error) {
      console.error('Failed to send statement email:', error);
      setEmailResult({ success: false, message: error.message });
    } finally {
      setEmailSending(false);
    }
  };

  const handleRetry = useCallback(() => {
    handleGenerate();
  }, [handleGenerate]);

  const handlePrint = useCallback(() => {
    printReport('.statement-preview-frame');
  }, []);

  const isGenerateDisabled =
    loading || unitsLoading || !!unitsError || bulkGenerating || bulkEmailing;

  const hasStatement = !!statementData && !!statementData.html;
  const isPdfDisabled = !hasStatement || loading || downloadingPdf;
  const isCsvDisabled =
    !hasStatement ||
    !statementData.lineItems ||
    statementData.lineItems.length === 0 ||
    loading ||
    downloadingCsv;
  const isPrintDisabled = !hasStatement || loading;

  const handleDownloadCsv = useCallback(
    async event => {
      if (event) {
        event.preventDefault();
      }

      if (!selectedClient || !selectedUnitId || !statementData) {
        return;
      }

      setDownloadingCsv(true);
      try {
        const openingBalance =
          typeof statementData.summary?.openingBalance === 'number'
            ? statementData.summary.openingBalance
            : 0;

        const header = [
          'Date',
          'Description',
          'Charge',
          'Payment',
          'Balance Due',
          'Type'
        ];

        const rows = [];

        // Opening balance row
        rows.push([
          '',
          'Opening Balance',
          '',
          '',
          openingBalance.toFixed(2),
          'opening'
        ]);

        // Transaction rows (lineItems already exclude future items)
        for (const item of statementData.lineItems || []) {
          rows.push([
            item.date || '',
            item.description || '',
            typeof item.charge === 'number' ? item.charge.toFixed(2) : '',
            typeof item.payment === 'number' ? item.payment.toFixed(2) : '',
            typeof item.balance === 'number' ? item.balance.toFixed(2) : '',
            item.type || ''
          ]);
        }

        // Summary row (Balance Due only)
        const closingBalance =
          typeof statementData.summary?.closingBalance === 'number'
            ? statementData.summary.closingBalance
            : 0;

        // Add blank row before summary
        rows.push(['', '', '', '', '', '']);
        
        rows.push(['', 'BALANCE DUE', '', '', closingBalance.toFixed(2), 'summary']);

        const escapeCell = value => {
          if (value === null || value === undefined || value === '') {
            return '""';
          }
          if (typeof value === 'number') {
            return String(value);
          }
          const str = String(value);
          const escaped = str.replace(/"/g, '""');
          return `"${escaped}"`;
        };

        const csvLines = [header, ...rows].map(row =>
          row.map(escapeCell).join(',')
        );
        const csvContent = csvLines.join('\r\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const yearPart = fiscalYear || 'current';
        a.download = `statement-${selectedClient.id}-${selectedUnitId}-${yearPart}-transactions.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } catch (err) {
        console.error('CSV download failed:', err);
        setError('Failed to download CSV. Please try again.');
      } finally {
        setDownloadingCsv(false);
      }
    },
    [selectedClient, selectedUnitId, fiscalYear, statementData]
  );
  // Automatically generate statement whenever unit, year, or language changes
  // Only auto-generate if a unit is selected (not for bulk generation)
  // If we already have both language HTMLs, just switch the preview without regenerating
  useEffect(() => {
    if (!selectedClient || !selectedUnitId || !fiscalYear) {
      return;
    }
    
    // If we have both htmlEn and htmlEs, just switch the preview (no regeneration needed)
    // NOTE: Do NOT call setStatementData here - it would cause an infinite loop
    // since statementData is in the dependency array
    if (statementData?.htmlEn && statementData?.htmlEs) {
      const selectedHtml = language === 'spanish' ? statementData.htmlEs : statementData.htmlEn;
      
      setHtmlPreview(selectedHtml);
      console.log(`🔄 Language switched to ${language} - using pre-generated HTML (${selectedHtml.length} chars)`);
      return;
    }
    
    // Otherwise, regenerate (first time or single-language data)
    handleGenerate();
  }, [handleGenerate, selectedClient, selectedUnitId, fiscalYear, language, statementData]);

  const showUnitFilter = units.length > 20;

  // Check if user is Admin or SuperAdmin
  const isAdminOrSuperAdmin = useMemo(() => {
    if (!samsUser) return false;
    // SuperAdmin check
    if (samsUser.globalRole === 'superAdmin' || samsUser.email === 'michael@landesman.com') {
      return true;
    }
    // Admin check (client-specific)
    if (selectedClient) {
      const propertyAccess = samsUser.propertyAccess?.[selectedClient.id];
      return propertyAccess?.role === 'admin' || propertyAccess?.role === 'superAdmin';
    }
    return false;
  }, [samsUser, selectedClient]);

  if (!selectedClient) {
    return (
      <div className="reports-tab-content">
        <div className="reports-placeholder">
          <p>Please select a client to generate Statement of Account reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="reports-tab-content statement-of-account-tab">
      <div className="statement-header-row">
        <h2 className="statement-title">Statement of Account</h2>
      </div>

      <div className="statement-controls">
        <div className="control-group unit-group">
          <label htmlFor="statement-unit-select">Unit:</label>
          <div className="unit-select-container">
            {showUnitFilter && (
              <input
                type="text"
                className="unit-filter-input"
                placeholder="Search units..."
                value={unitFilter}
                onChange={e => setUnitFilter(e.target.value)}
              />
            )}
            <select
              id="statement-unit-select"
              className="statement-select"
              value={selectedUnitId}
              onChange={e => setSelectedUnitId(e.target.value)}
              disabled={unitsLoading || !!unitsError}
            >
              <option value="">Select a unit...</option>
              {unitOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {unitsLoading && (
              <span className="inline-status">Loading units...</span>
            )}
            {unitsError && (
              <span className="inline-status error-text">{unitsError}</span>
            )}
            {!unitsLoading && !unitsError && units.length === 0 && (
              <span className="inline-status">No units available</span>
            )}
          </div>
        </div>

        <div className="control-group">
          <label htmlFor="statement-fiscal-year">Year:</label>
          <select
            id="statement-fiscal-year"
            className="statement-select"
            value={fiscalYear ?? ''}
            onChange={e => setFiscalYear(e.target.value ? Number(e.target.value) : null)}
          >
            {fiscalYearOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <div className="language-toggle" aria-label="Language selection">
            <button
              type="button"
              className={language === 'english' ? 'active' : ''}
              onClick={() => setLanguage('english')}
            >
              EN
            </button>
            <button
              type="button"
              className={language === 'spanish' ? 'active' : ''}
              onClick={() => setLanguage('spanish')}
            >
              ES
            </button>
          </div>
        </div>

        <button
          type="button"
          className="statement-generate-button"
          onClick={handleGenerate}
          disabled={isGenerateDisabled}
        >
          {loading ? 'Generating...' : selectedUnitId ? 'Generate' : 'Generate All'}
        </button>

        <div className="action-buttons">
          <button
            type="button"
            className="secondary-button"
            onClick={handlePrint}
            disabled={isPrintDisabled}
            title="Print report"
          >
            <LocalPrintshopIcon style={{ fontSize: 16, marginRight: 4 }} />
            Print
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={handleDownloadCsv}
            disabled={isCsvDisabled}
          >
            <GetAppIcon style={{ fontSize: 16, marginRight: 4 }} />
            {downloadingCsv ? 'CSV…' : 'CSV'}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={handleDownloadPdf}
            disabled={isPdfDisabled}
          >
            <PictureAsPdfIcon style={{ fontSize: 16, marginRight: 4 }} />
            PDF
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={handleEmailButtonClick}
            disabled={(selectedUnitId && !htmlPreview) || emailSending || bulkEmailing}
          >
            <EmailIcon style={{ fontSize: 16, marginRight: 4 }} />
            {emailSending || bulkEmailing ? 'Sending...' : selectedUnitId ? 'Email' : 'Email All'}
          </button>
        </div>
        
        {emailSending && (
          <div className="statement-preview-overlay">
            <LoadingSpinner
              show={true}
              variant="logo"
              size="large"
              message="Generating and sending statement email... This may take several seconds."
              fullScreen={false}
            />
          </div>
        )}
        
        {emailResult && (
          <div style={{ marginTop: '8px', padding: '8px', borderRadius: '4px', backgroundColor: emailResult.success ? '#d4edda' : '#f8d7da', color: emailResult.success ? '#155724' : '#721c24', fontSize: '14px' }}>
            {emailResult.message}
            <button onClick={() => setEmailResult(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>×</button>
          </div>
        )}
      </div>


      <div className="statement-preview">
        {(downloadingPdf || downloadingCsv) && (
          <div className="statement-preview-overlay">
            <LoadingSpinner
              show={true}
              variant="logo"
              size="large"
              message={downloadingPdf ? 'Preparing PDF...' : 'Preparing CSV...'}
              fullScreen={false}
            />
          </div>
        )}
        {/* Bulk generation loading */}
        {bulkGenerating && (
          <div className="statement-preview-loading">
            <LoadingSpinner
              show={true}
              variant="logo"
              size="large"
              message={
                bulkProgress?.message 
                  ? `${bulkProgress.message}...`
                  : "Generating statements for all units... This may take several minutes."
              }
              fullScreen={false}
            />
            {bulkProgress && (
              <div style={{ marginTop: '1rem', textAlign: 'center', color: '#666' }}>
                <p style={{ fontSize: '0.9rem', color: '#888' }}>
                  Completed: {bulkProgress.generated || 0} | Failed: {bulkProgress.failed || 0} | Remaining: {(bulkProgress.total || 0) - (bulkProgress.current || 0)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Bulk email loading */}
        {bulkEmailing && (
          <div className="statement-preview-loading">
            <LoadingSpinner
              show={true}
              variant="logo"
              size="large"
              message={
                bulkEmailProgress?.message 
                  ? `${bulkEmailProgress.message}...`
                  : "Sending statement emails to all units... This may take several minutes."
              }
              fullScreen={false}
            />
            {bulkEmailProgress && (
              <div style={{ marginTop: '1rem', textAlign: 'center', color: '#666' }}>
                <p style={{ fontSize: '0.9rem', color: '#888' }}>
                  Sent: {bulkEmailProgress.sent || 0} | Skipped: {bulkEmailProgress.skipped || 0} | Failed: {bulkEmailProgress.failed || 0} | Remaining: {(bulkEmailProgress.total || 0) - (bulkEmailProgress.current || 0)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Individual statement loading */}
        {loading && !bulkGenerating && (
          <div className="statement-preview-loading">
            <LoadingSpinner
              show={true}
              variant="logo"
              size="large"
              message={
                selectedUnitId
                  ? `Generating statement for Unit ${selectedUnitId}...`
                  : 'Generating statement...'
              }
              fullScreen={false}
            />
          </div>
        )}

        {/* Bulk generation error */}
        {bulkError && !bulkGenerating && (
          <div className="statement-preview-error">
            <p>{bulkError}</p>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setBulkError(null);
                setBulkResults(null);
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Bulk email error */}
        {bulkEmailError && !bulkEmailing && (
          <div className="statement-preview-error">
            <p>{bulkEmailError}</p>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setBulkEmailError(null);
                setBulkEmailResults(null);
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Individual statement error */}
        {!loading && !bulkGenerating && error && !bulkError && (
          <div className="statement-preview-error">
            <p>{error}</p>
            <button
              type="button"
              className="secondary-button"
              onClick={handleRetry}
            >
              Retry
            </button>
          </div>
        )}

        {/* Bulk generation results */}
        {!loading && !bulkGenerating && !bulkEmailing && !error && !bulkError && bulkResults && !bulkEmailResults && (
          <div className="statement-preview-empty">
            <h3>✅ Bulk Generation Complete</h3>
            <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', marginBottom: '1rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>Total Units</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>{bulkResults.totalUnits}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>Successful</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#28a745' }}>{bulkResults.generated}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>Failed</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#dc3545' }}>{bulkResults.failed}</div>
                </div>
              </div>
              {bulkResults.failed > 0 && bulkResults.statements && (
                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f8d7da', borderRadius: '4px', textAlign: 'left' }}>
                  <h5 style={{ margin: '0 0 0.5rem 0', color: '#721c24' }}>Failed Units:</h5>
                  <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem', color: '#721c24' }}>
                    {bulkResults.statements
                      .filter(s => s.status === 'failed' || s.status === 'error')
                      .map((statement, idx) => (
                        <li key={idx} style={{ margin: '0.25rem 0' }}>
                          {statement.unitId || statement.unitNumber}: {statement.error || 'Unknown error'}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setBulkResults(null);
                  setBulkProgress(null);
                }}
                style={{ marginTop: '1rem' }}
              >
                Clear Results
              </button>
            </div>
            <p style={{ marginTop: '1rem', color: '#666', fontSize: '0.9rem' }}>
              Statements have been saved to Firebase Storage with metadata for easy retrieval.
            </p>
          </div>
        )}

        {/* Bulk email results */}
        {!loading && !bulkGenerating && !bulkEmailing && !error && !bulkEmailError && bulkEmailResults && (
          <div className="statement-preview-empty">
            <h3>📧 Bulk Email Complete</h3>
            <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', marginBottom: '1rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>Total Units</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>{bulkEmailResults.totalUnits}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>Sent</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#28a745' }}>{bulkEmailResults.sent}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>Skipped</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#ffc107' }}>{bulkEmailResults.skipped}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>Failed</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#dc3545' }}>{bulkEmailResults.failed}</div>
                </div>
              </div>
              {bulkEmailResults.skipped > 0 && bulkEmailResults.emails && (
                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#fff3cd', borderRadius: '4px', textAlign: 'left' }}>
                  <h5 style={{ margin: '0 0 0.5rem 0', color: '#856404' }}>Skipped (no email address):</h5>
                  <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem', color: '#856404' }}>
                    {bulkEmailResults.emails
                      .filter(e => e.status === 'skipped')
                      .map((email, idx) => (
                        <li key={idx} style={{ margin: '0.25rem 0' }}>
                          {email.unitId || email.unitNumber}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
              {bulkEmailResults.failed > 0 && bulkEmailResults.emails && (
                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f8d7da', borderRadius: '4px', textAlign: 'left' }}>
                  <h5 style={{ margin: '0 0 0.5rem 0', color: '#721c24' }}>Failed:</h5>
                  <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem', color: '#721c24' }}>
                    {bulkEmailResults.emails
                      .filter(e => e.status === 'failed' || e.status === 'error')
                      .map((email, idx) => (
                        <li key={idx} style={{ margin: '0.25rem 0' }}>
                          {email.unitId || email.unitNumber}: {email.error || 'Unknown error'}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setBulkEmailResults(null);
                  setBulkEmailProgress(null);
                }}
                style={{ marginTop: '1rem' }}
              >
                Clear Results
              </button>
            </div>
            <p style={{ marginTop: '1rem', color: '#666', fontSize: '0.9rem' }}>
              Statement emails have been sent to unit owners with PDF attachments.
            </p>
          </div>
        )}

        {/* Empty state - show when no unit selected and no bulk generation */}
        {!loading && !bulkGenerating && !bulkEmailing && !error && !bulkError && !hasGenerated && !bulkResults && !bulkEmailResults && (
          <div className="statement-preview-empty">
            <h3>📋 {selectedUnitId ? 'Generating statement...' : 'Select a unit above to generate statement'}</h3>
            {!selectedUnitId && isAdminOrSuperAdmin && (
              <p style={{ marginTop: '0.5rem', marginBottom: '1rem', color: '#666', fontSize: '0.9rem' }}>
                Or click "Generate All" to generate statements for all units in this client.
              </p>
            )}
            <p>
              The statement will show:
            </p>
            <ul>
              <li>HOA dues and payments</li>
              <li>Water bills and payments</li>
              <li>Penalties applied</li>
              <li>Current balance</li>
            </ul>
          </div>
        )}

        {!loading && !error && hasGenerated && htmlPreview && (
          <div className="statement-preview-frame-container">
            <iframe
              title="Statement of Account Preview"
              srcDoc={htmlPreview}
              className="statement-preview-frame"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
                width: `${100 / zoom}%`,
                height: `${100 / zoom}%`
              }}
            />
          </div>
        )}
      </div>

      {/* Email Prepend Modal */}
      <EmailPrependModal
        isOpen={showEmailPrependModal}
        onClose={() => {
          setShowEmailPrependModal(false);
          setPendingEmailAction(null);
        }}
        onConfirm={handlePrependConfirm}
        isBulkEmail={pendingEmailAction === 'bulk'}
        reportType="Statement of Account"
      />
      </div>
  );
}

export default StatementOfAccountTab;


