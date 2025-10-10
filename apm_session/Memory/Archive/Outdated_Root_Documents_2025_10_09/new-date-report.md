=== SAMS Codebase: new Date() Instance Report ===
Generated on: Thu Sep 25 19:24:14 EST 2025
================================================

## TOTAL COUNT ##
Total new Date() instances:      950

## COUNT BY MODULE ##
Backend Controllers:       92
Backend Services:       22
Backend Utils:       36
Backend Middleware:        4
Backend Routes:       53
Backend Scripts:       25
Backend Testing:       56
Backend Validation:        4
Backend Templates:        1

Frontend Components:       19
Frontend Views:       18
Frontend Utils:       18
Frontend Context:        3
Frontend Hooks:        3
Frontend API:        3
Frontend Layout:       14

Mobile App:       30
Shared Components:       11

Cloud Functions:       12
Scripts:      462
Memory/Archive:        4


## DETAILED FILE LISTING ##
================================================

### Backend Controllers ###
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/accountsController.js:214:        accounts[targetIndex].updated = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/accountsController.js:220:      accounts[accountIndex].closed = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/accountsController.js:221:      accounts[accountIndex].updated = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/accountsController.js:274:      accounts[accountIndex].updated = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/accountsController.js:340:        accounts[targetIndex].updated = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/accountsController.js:412:      accounts[accountIndex].updated = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/accountsController.js:47:    const accountId = `${accountType}-${safeName}-${new Date().getTime().toString(36)}`;
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/accountsController.js:487:      accounts[accountIndex].updated = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/accountsController.js:548:        createdAt: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/accountsController.js:751:      lastBalanceRebuild: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/associationsController.js:20:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/associationsController.js:50:      updatedAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/balancesController-enterprise.js:91:          createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/balancesController-enterprise.js:92:          lastUpdated: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/balancesController-enterprise.js:98:            timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/budgetsController.js:19:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/budgetsController.js:49:      updatedAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/categoriesController.js:113:      updated: convertToTimestamp(new Date()),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/categoriesController.js:42:      updated: convertToTimestamp(new Date()),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/clientOnboardingController.js:26:      extractedAt: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/clientsController.js:13:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/clientsController.js:42:      updatedAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/documentsController.js:39:  const now = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/emailConfigController.js:86:      updatedAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/emailService.js:300:    date: new Date().toLocaleDateString('es-MX'),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/exchangeRatesController-enterprise.js:225:        const today = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/exchangeRatesController-enterprise.js:235:            searchStartDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/exchangeRatesController-enterprise.js:434:    lastUpdated: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/exchangeRatesController.js:248:      lastUpdated: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/exchangeRatesController.js:380:    const today = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/exchangeRatesController.js:390:      startDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/exchangeRatesController.js:498:      lastUpdated: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/exchangeRatesController.js:619:      timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/exchangeRatesController.js:630:      timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/exchangeRatesController.js:674:      timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/exchangeRatesController.js:682:      timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/hoaDuesController.js:1097:      timestamp: convertToTimestamp(new Date()),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/hoaDuesController.js:1116:      updated: convertToTimestamp(new Date())
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/hoaDuesController.js:1238:      timestamp: convertToTimestamp(new Date()),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/hoaDuesController.js:125:        createdAt: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/hoaDuesController.js:1252:      updated: convertToTimestamp(new Date())
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/hoaDuesController.js:148:        createdAt: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/hoaDuesController.js:230:      updated: convertToTimestamp(new Date())
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/hoaDuesController.js:566:    const currentDateTime = new Date().toString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/hoaDuesController.js:575:          timestamp: convertToTimestamp(new Date()),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/hoaDuesController.js:597:          timestamp: convertToTimestamp(new Date()),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/hoaDuesController.js:615:          timestamp: convertToTimestamp(new Date()),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/hoaDuesController.js:632:          timestamp: convertToTimestamp(new Date()),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/hoaDuesController.js:652:        timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/hoaDuesController.js:720:        updated: convertToTimestamp(new Date())
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/hoaDuesController.js:98:          createdAt: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/importMetadataController.js:44:      importDate: new Date(), // Use Date, not serverTimestamp
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/ownersController.js:19:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/ownersController.js:49:      updatedAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/paymentMethodsController.js:27:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/paymentMethodsController.js:57:      updatedAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/projectsController.js:19:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/projectsController.js:49:      updatedAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/projectsDataController.js:198:      dataFetched: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/transactionsController-enterprise.js:112:          createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/transactionsController-enterprise.js:113:          lastUpdated: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/transactionsController-enterprise.js:119:            timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/transactionsController-enterprise.js:189:          lastUpdated: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/transactionsController-enterprise.js:196:            lastUpdateTimestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/transactionsController-enterprise.js:260:            deletedAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/transactionsController-enterprise.js:266:              deletedTimestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/transactionsController.js:1149:      timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/transactionsController.js:1262:    const currentYear = new Date().getFullYear();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/transactionsController.js:1467:        uploadedAt: documentInfo.uploadedAt || new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/transactionsController.js:455:    let transactionDate = mappedData.date || new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/transactionsController.js:728:    timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/unitsController.js:185:      updated: convertToTimestamp(new Date())
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/unitsController.js:214:      updated: convertToTimestamp(new Date())
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/unitsController.js:49:      updated: convertToTimestamp(new Date())
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/unitsController.js:95:      updated: convertToTimestamp(new Date()),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/userManagementController.js:1040:      lastModifiedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/userManagementController.js:1115:        addedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/userManagementController.js:1133:      existingAssignment.lastModifiedDate = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/userManagementController.js:1140:        addedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/userManagementController.js:1148:      lastModifiedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/userManagementController.js:1253:      lastModifiedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/userManagementController.js:455:            addedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/userManagementController.js:464:          addedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/userManagementController.js:688:        lastModifiedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/userManagementController.js:704:            lastModifiedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/userManagementController.js:762:      lastModifiedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/userManagementController.js:841:          lastModifiedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/userManagementController.js:969:        addedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/userManagementController.js:976:      lastModifiedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/vendorsController.js:146:      updated: convertToTimestamp(new Date()),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/vendorsController.js:56:      updated: convertToTimestamp(new Date()),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/controllers/waterBillsController.js:177:          'config.lastPenaltyRecalc': new Date().toISOString()

### Backend Services ###
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/services/__tests__/waterCalculations.test.js:145:      const dueDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/services/DateService.js:230:    return mexicoService.formatForFrontend(new Date());
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/services/DateService.js:235:   * This replaces new Date() throughout the system to ensure all timestamps are in Cancun time
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/services/DateService.js:292:// Standalone function to replace new Date() system-wide
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/services/penaltyRecalculationService.js:270:      const currentDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/services/penaltyRecalculationService.js:371:        lastCalculated: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/services/penaltyRecalculationService.js:50:  async recalculatePenaltiesForClient(clientId, currentDate = new Date()) {
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/services/waterBillsService.js:137:          lastPenaltyUpdate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/services/waterBillsService.js:50:    const billDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/services/waterDataService.js:23:      year = getFiscalYear(new Date(), this.fiscalYearStartMonth);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/services/waterDataService.js:783:    if (dueDate && dueDate < new Date()) return 'overdue';
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/services/waterDataService.js:796:    const today = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/services/waterMeterService.js:191:  calculateDaysLate(dueDate, currentDate = new Date()) {
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/services/waterMeterService.js:369:        createdAt: this.dateService.formatForFrontend(new Date())
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/services/waterMeterService.js:631:      readingDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/services/waterMeterService.js:751:    const currentYear = getFiscalYear(new Date(), fiscalYearStartMonth);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/services/waterMeterService.js:894:    const currentYear = getFiscalYear(new Date(), fiscalYearStartMonth);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/services/waterPaymentsService.js:437:    const currentFiscalYear = new Date().getFullYear() + 1; // AVII uses FY 2026 for 2025 calendar year
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/services/waterPaymentsService.js:44:      paymentDate = new Date().toISOString().split('T')[0], 
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/services/waterPaymentsService.js:481:          recordedAt: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/services/waterPaymentsService.js:66:    const fiscalYear = getFiscalYear(new Date(), 7); // AVII uses July start
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/services/waterPaymentsService.js:726:      const fiscalYear = getFiscalYear(new Date(), 7); // AVII uses July start

### Backend Utils ###
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/auditLogger.js:6:  const now = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/batchOperations.js:166:      timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/batchOperations.js:202:      timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/batchOperations.js:272:        createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/batchOperations.js:321:        createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/batchOperations.js:322:        processedAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/batchOperations.js:328:          timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/databaseFieldMappings.js:112:  getStartOfDayCancun: (date = new Date()) => {
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/databaseFieldMappings.js:124:  getEndOfDayCancun: (date = new Date()) => {
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/databaseFieldMappings.js:227:    const now = isoDateString ? new Date(isoDateString) : new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/dataValidation-enterprise.js:446:          timestamp: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/dataValidation-enterprise.js:64:    this.errors.push({ field, message, severity, timestamp: new Date().toISOString() });
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/dataValidation-enterprise.js:68:    this.warnings.push({ field, message, timestamp: new Date().toISOString() });
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/dataValidation-enterprise.js:77:      timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/dateNormalization.js:69:  return new Date(); // Fallback to current date
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/fiscalYearUtils.js:170:function getCurrentFiscalMonth(clientConfig, date = new Date()) {
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/fiscalYearUtils.js:172:    date = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/health-diagnostics.js:460:        timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/health-diagnostics.js:500:        timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/health-diagnostics.js:68:    this.timestamp = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/health-diagnostics.js:689:      timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/hoaCalculations.js:174:      date: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/hoaCalculations.js:189:      year: hoaDuesDoc?.year || new Date().getFullYear(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/hoaCalculations.js:234:  const currentDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/hoaCalculations.js:28:  const currentDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/hoaCalculations.js:290:  const currentDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/hoaCalculations.js:314:  const currentDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/penaltyCalculator.js:97:    currentDate = new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/performance-monitor.js:246:        await testRef.set({ timestamp: new Date(), test: true });
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/performance-monitor.js:325:      timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/performance-monitor.js:428:          timestamp: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/performance-monitor.js:684:      lastAggregation: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/securityUtils.js:221:    timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/timezone.js:14:  const now = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/timezone.js:37:  const now = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/utils/userPreferences.js:95:    updatedAt: new Date()

### Backend Middleware ###
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/middleware/auditContext.js:19:      timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/middleware/clientAuth.js:351:      timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/middleware/criticalErrorNotifier.js:39:      timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/middleware/waterValidation.js:89:  const currentYear = new Date().getFullYear();

### Backend Routes ###
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/admin.js:170:            updatedAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/admin.js:185:            createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/admin.js:314:          lastUpdated: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/auth.js:83:      lastPasswordResetDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/auth.js:86:      lastModifiedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/balances.js:230:      const today = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/clientManagement.js:441:          uploadedAt: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/clientManagement.js:481:        uploadedAt: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/clientManagement.js:536:          uploadedAt: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/clientManagement.js:577:        uploadedAt: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/exchangeRates-enterprise.js:54:      timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/exchangeRates-enterprise.js:70:      timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/hoaDues.js:40:          timestamp: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/monitoring-enterprise.js:113:      timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/monitoring-enterprise.js:138:      timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/monitoring-enterprise.js:165:      timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/monitoring-enterprise.js:190:      timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/monitoring-enterprise.js:235:      timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/monitoring-enterprise.js:279:        timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/monitoring-enterprise.js:340:      timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/monitoring-enterprise.js:35:      timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/reports.js:109:      const futureDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/reports.js:76:    const currentDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/user-email-docid.js:117:      lastLogin: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/user-email-docid.js:54:          createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/user-email-docid.js:55:          lastLogin: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/user-email-docid.js:79:            at: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/user-email-docid.js:95:      lastLogin: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/user-uid-based-backup.js:144:      lastProfileUpdate: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/user-uid-based-backup.js:206:      lastProfileUpdate: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/user-uid-based-backup.js:253:      lastProfileUpdate: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/user-uid-based-backup.js:377:      lastClientChange: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/user-uid-based-backup.js:455:        lastModifiedDate: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/user-uid-based-backup.js:50:          lastLogin: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/user-uid-based-backup.js:75:        createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/user-uid-based-backup.js:76:        lastLogin: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/user-uid-based-backup.js:93:      lastLogin: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/user-uid-based.js:43:        createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/user-uid-based.js:44:        lastLogin: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/user-uid-based.js:61:      lastLogin: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/user-uid-based.js:82:      lastLogin: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/user.js:234:      lastClientSelection: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/user.js:243:      timestamp: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/user.js:54:        createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/user.js:55:        lastLogin: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/user.js:72:      lastLogin: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/user.js:93:      lastLogin: formatDateField(new Date())
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/version.js:15:      buildDate: process.env.VITE_APP_BUILD_DATE || new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/version.js:21:      deploymentTime: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/version.js:42:      timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/version.js:58:      buildDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/version.js:60:      timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/routes/version.js:67:      timestamp: new Date().toISOString()

### Backend Scripts ###
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/scripts/addAVIIAccessToMichael.js:86:          addedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/scripts/addAVIIAccessToMichael.js:94:        lastModifiedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/scripts/backup-transactions.js:18:  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/scripts/backup-transactions.js:38:        backupDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/scripts/backup-transactions.js:74:        backupTimestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/scripts/cleanup-hoa-payment-links.js:162:      date: new Date(), // Use current date for the reapplication
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/scripts/cleanup-hoa-payment-links.js:294:    console.log(`✅ Cleanup completed at: ${new Date().toISOString()}`);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/scripts/cleanup-hoa-payment-links.js:30:console.log(`⏰ Started at: ${new Date().toISOString()}`);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/scripts/cleanup-hoa-payment-links.js:37:  const endDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/scripts/cleanup-hoa-payment-links.js:38:  const startDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/scripts/convert-all-pesos.js:132:              convertedAt: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/scripts/diagnose-import-issue.js:20:console.log(`⏰ Started at: ${new Date().toISOString()}`);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/scripts/diagnose-import-issue.js:33:    await testRef.set({ timestamp: new Date(), test: true });
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/scripts/enable-unit-management.js:54:            updatedAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/scripts/enable-unit-management.js:69:            createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/scripts/fix-transaction-cents.js:210:            convertedAt: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/scripts/fixAVIIAccess.js:74:        addedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/scripts/fixAVIIAccess.js:82:      lastModifiedDate: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/scripts/migrateClientAccessToPropertyAccess.js:101:            lastModifiedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/scripts/migrateClientAccessToPropertyAccess.js:78:            lastModifiedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/scripts/simple-backup.js:20:      backupDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/scripts/simple-backup.js:38:    const filename = `./backups/mtc_transactions_backup_${new Date().toISOString().split('T')[0]}.json`;
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/scripts/simple-peso-conversion.js:102:            convertedAt: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/scripts/validateSecurity.js:30:      timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/scripts/validateSecurity.js:65:      timestamp: new Date().toISOString()

### Backend Testing ###
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/execute_test_plan.js:242:  results.endTime = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/execute_test_plan.js:48:  startTime: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/executeComprehensiveSecurityTests.js:19:  startTime: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/executeComprehensiveSecurityTests.js:215:  phase.startTime = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/executeComprehensiveSecurityTests.js:261:  phase.endTime = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/executeComprehensiveSecurityTests.js:305:  executionResults.endTime = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/executeComprehensiveSecurityTests.js:357:Generated: ${new Date().toISOString()}
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/executeComprehensiveSecurityTests.js:424:- Execution Date: ${new Date().toISOString()}
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/executeComprehensiveTests.js:144:  result.endTime = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/executeComprehensiveTests.js:173:  phase.startTime = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/executeComprehensiveTests.js:18:  startTime: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/executeComprehensiveTests.js:210:  phase.endTime = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/executeComprehensiveTests.js:252:  executionResults.endTime = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/executeComprehensiveTests.js:298:Generated: ${new Date().toISOString()}
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/executeComprehensiveTests.js:82:    startTime: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/executeFullSecuritySuite.js:186:  const phaseStartTime = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/executeFullSecuritySuite.js:210:    endTime: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/executeFullSecuritySuite.js:252:  results.endTime = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/executeFullSecuritySuite.js:42:  startTime: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/executeFullSecuritySuite.js:75:    timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/quickWaterMeterTest.js:12:const YEAR = new Date().getFullYear();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/quickWaterMeterTest.js:13:const MONTH = new Date().getMonth() + 1;
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/quickWaterMeterTest.js:142:          paymentDate: new Date().toISOString().split('T')[0],
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/quickWaterMeterTest.js:34:        readingDate: new Date().toISOString().split('T')[0]
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/quickWaterMeterTest.js:66:          billingDate: new Date().toISOString().split('T')[0],
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/runSecurityTests.js:21:  startTime: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/runSecurityTests.js:223:  phase1.startTime = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/runSecurityTests.js:229:  phase1.endTime = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/runSecurityTests.js:235:  phase2.startTime = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/runSecurityTests.js:240:  phase2.endTime = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/runSecurityTests.js:246:  phase3.startTime = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/runSecurityTests.js:252:  phase3.endTime = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/runSecurityTests.js:257:  executionResults.endTime = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/runSecurityTests.js:307:Generated: ${new Date().toISOString()}
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/runSecurityTests.js:476:- **Execution Date**: ${new Date().toISOString()}
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/runSecurityTests.js:72:    timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/testHarness.js:112:          timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/testHarness.js:240:        timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/testHarness.js:276:        timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/testHarness.js:39:      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/testHarness.js:40:                       new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('Z')[0];
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/testHarness.js:87:        timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/testHOADashboardEndpoint.js:16:      const currentYear = new Date().getFullYear();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/testHOADashboardEndpoint.js:40:      const currentYear = new Date().getFullYear();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/testWaterMeterAPIs.js:14:const TEST_YEAR = new Date().getFullYear();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/testWaterMeterAPIs.js:142:        const billingDate = new Date().toISOString().split('T')[0];
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/testWaterMeterAPIs.js:15:const TEST_MONTH = new Date().getMonth() + 1;
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/testWaterMeterAPIs.js:338:            paymentDate: new Date().toISOString().split('T')[0],
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/testWaterMeterAPIs.js:35:        const readingDate = new Date().toISOString().split('T')[0];
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/testWaterMeterCorrected.js:77:        readingDate: new Date().toISOString().split('T')[0]
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/testWaterMeterUIIntegration.js:143:    readingDate: new Date().toISOString().split('T')[0]
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/testWaterMeterUIIntegration.js:197:  const currentMonth = new Date().toISOString().slice(0, 7);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/testWaterMeterWithHarness.js:119:        const currentMonth = new Date().toISOString().slice(0, 7);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/testWaterMeterWithHarness.js:199:          readingDate: new Date().toISOString().split('T')[0]
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/testWaterMeterWithHarness.js:236:          readingDate: new Date().toISOString().split('T')[0]
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/testing/testWaterMeterWithHarness.js:84:          readingDate: new Date().toISOString().split('T')[0]

### Backend Validation ###
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/validation/backend-validation-script.js:206:      'new Date().toISOString()',
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/validation/backend-validation-script.js:287:      timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/validation/migrate-backend-fields.js:20:    this.backupDir = path.join(__dirname, 'backups', new Date().toISOString().replace(/:/g, '-'));
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/validation/migrate-backend-fields.js:207:      timestamp: new Date().toISOString(),

### Backend Templates ###
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/backend/templates/waterBills/templateVariables.js:27:    return new Date();

### Frontend Components ###
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/components/admin/UserManagement.jsx:294:    const now = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/components/DateRangeDropdown.jsx:18:  const currentDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/components/DateRangeDropdown.jsx:74:    const now = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/components/DateTimeDisplay.jsx:4:  const [currentDateTime, setCurrentDateTime] = useState(new Date());
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/components/DateTimeDisplay.jsx:8:      setCurrentDateTime(new Date());
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/components/documents/DocumentUploader.jsx:97:            uploadedAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/components/DuesPaymentModal-old.jsx:218:    const currentDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/components/FirestoreAuthTest.jsx:21:        timestamp: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/components/FirestoreAuthTest.jsx:57:          date: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/components/lists/ExchangeRatesList.jsx:78:        endDate: new Date().toISOString().split('T')[0] // Today
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/components/reports/UnitReport.jsx:141:    const currentMonth = new Date().getMonth();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/components/reports/UnitReport.jsx:142:    const currentYear = new Date().getFullYear();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/components/reports/UnitReport.jsx:166:        const today = new Date().getDate();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/components/TransactionsRoute.jsx:123:        const startOf3Months = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/components/TransactionsRoute.jsx:81:    const now = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/components/TransactionTestComponent.jsx:30:    const timestamp = new Date().toLocaleTimeString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/components/TransactionTestComponent.jsx:46:        date: Timestamp.fromDate(new Date()),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/components/water/WashModal.jsx:174:      date: new Date().toISOString().split('T')[0]
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/components/water/WaterPaymentModal.jsx:20:  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

### Frontend Views ###
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/views/AddExpenseView.jsx:110:        date: new Date().toISOString().split('T')[0],
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/views/AddExpenseView.jsx:37:    date: new Date().toISOString().split('T')[0],
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/views/DigitalReceiptDemo.jsx:45:      date: new Date().toLocaleDateString('en-US', { 
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/views/ExchangeRatesView.jsx:25:  const effectiveDate = exchangeRate?.date || new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/views/HOADuesView.jsx:210:    const currentFiscalMonth = getCurrentFiscalMonth(new Date(), fiscalYearStartMonth);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/views/HOADuesView.jsx:211:    const currentFiscalYear = getFiscalYear(new Date(), fiscalYearStartMonth);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/views/HOADuesView.jsx:434:              const currentFiscalMonth = getCurrentFiscalMonth(new Date(), fiscalYearStartMonth);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/views/HOADuesView.jsx:435:              const currentFiscalYear = getFiscalYear(new Date(), fiscalYearStartMonth);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/views/ListManagementView.jsx:412:              const now = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/views/SettingsView.jsx:58:        endDate: new Date().toISOString().split('T')[0] // Today
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/views/TransactionsView.jsx:1160:            const currentDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/views/TransactionsView.jsx:546:      const currentDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/views/WaterBillsSimple.jsx:12:  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/views/WaterBillsSimple.jsx:13:  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/views/WaterBillsSimple.jsx:134:      const fiscalYear = getFiscalYear(new Date(), fiscalYearStartMonth);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/views/WaterBillsSimple.jsx:248:            History - FY {historyData?.year || new Date().getFullYear()}
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/views/WaterBillsSimple.jsx:267:                    const shortYear = String(historyData?.year || new Date().getFullYear()).slice(-2);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/views/WaterBillsViewV3.jsx:23:  console.log('🔍 WaterBillsViewV3 RENDERING - VERSION 3.0 WITH TABS - ' + new Date().toISOString());

### Frontend Utils ###
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/utils/__tests__/fiscalYearUtils.test.js:147:        expect(() => getFiscalYear(new Date(), 0)).toThrow();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/utils/__tests__/fiscalYearUtils.test.js:148:        expect(() => getFiscalYear(new Date(), 13)).toThrow();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/utils/__tests__/fiscalYearUtils.test.js:262:      const today = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/utils/dateFiltering.js:13:  const now = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/utils/fiscalYearUtils.js:248:export function getCurrentFiscalMonth(date = new Date(), fiscalYearStartMonth) {
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/utils/fiscalYearUtils.js:250:    date = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/utils/hoaDuesUtils.js:170:  const now = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/utils/hoaDuesUtils.js:99:  const date = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/utils/receiptUtils.js:156:        formattedDate = new Date().toLocaleDateString('en-US', {
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/utils/receiptUtils.js:163:      formattedDate = new Date().toLocaleDateString('en-US', {
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/utils/receiptUtils.js:199:      generatedAt: new Date().toISOString() // Convert to string
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/utils/timezone.js:16:  const now = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/utils/timezone.js:39:  const now = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/utils/timezone.js:96:    // This is already correct since new Date() gives current moment
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/utils/timezone.js:97:    return new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/utils/userRoles.js:412:  const now = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/utils/userRoles.js:445:    addedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/utils/versionChecker.js:19:    const buildDate = import.meta.env.VITE_APP_BUILD_DATE || new Date().toISOString();

### Frontend Context ###
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/context/HOADuesContext.jsx:119:      const currentFiscalYear = getFiscalYear(new Date(), fiscalYearStartMonth);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/context/HOADuesContext.jsx:140:      const newFiscalYear = getFiscalYear(new Date(), clientFiscalStartMonth);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/context/WaterBillsContext.jsx:38:      const currentFiscalYear = getFiscalYear(new Date(), fiscalYearStartMonth);

### Frontend Hooks ###
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/hooks/useDashboardData.js:168:        const currentDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/hooks/useDashboardData.js:603:        const currentDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/hooks/useDashboardData.js:762:      const currentYear = new Date().getFullYear() + 1; // AVII uses FY 2026 for 2025 calendar year

### Frontend API ###
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/api/enhancedApiClient.js:111:        'X-Request-Time': new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/api/enhancedApiClient.js:410:      timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/api/waterMeterService.js:201:export const fetchWaterBills = async (clientId, year = new Date().getFullYear()) => {

### Frontend Layout ###
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/layout/admin/UserManagement.jsx:284:    const now = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/layout/DateRangeDropdown.jsx:50:    const now = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/layout/DateTimeDisplay.jsx:4:  const [currentDateTime, setCurrentDateTime] = useState(new Date());
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/layout/DateTimeDisplay.jsx:8:      setCurrentDateTime(new Date());
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/layout/documents/DocumentUploader.jsx:97:            uploadedAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/layout/DuesPaymentModal-old.jsx:202:    const currentDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/layout/DuesPaymentModal.jsx:209:    const currentDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/layout/FirestoreAuthTest.jsx:21:        timestamp: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/layout/FirestoreAuthTest.jsx:57:          date: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/layout/lists/ExchangeRatesList.jsx:78:        endDate: new Date().toISOString().split('T')[0] // Today
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/layout/TransactionsRoute.jsx:123:        const startOf3Months = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/layout/TransactionsRoute.jsx:81:    const now = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/layout/TransactionTestComponent.jsx:30:    const timestamp = new Date().toLocaleTimeString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/sams-ui/src/layout/TransactionTestComponent.jsx:46:        date: Timestamp.fromDate(new Date()),

### Mobile App ###
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/mobile-app/src/components/AuthDebugger.jsx:10:    const timestamp = new Date().toLocaleTimeString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/mobile-app/src/components/AuthDebugMinimal.jsx:16:      timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/mobile-app/src/components/AuthDebugScreen.jsx:22:    setLogs(prev => [...prev.slice(-8), `${new Date().toLocaleTimeString()}: ${message}`]);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/mobile-app/src/components/AuthDebugScreen.jsx:35:    setLogs(prev => [...prev.slice(-8), `${new Date().toLocaleTimeString()}: ${message}`]);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/mobile-app/src/components/ExchangeRateTools.jsx:23:  const [lastUpdated, setLastUpdated] = useState(new Date());
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/mobile-app/src/components/ExchangeRateTools.jsx:30:    setLastUpdated(new Date());
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/mobile-app/src/components/expense/ExpenseConfirmation.jsx:167:                    {formatDate(transaction.date || new Date())}
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/mobile-app/src/components/MinimalAuthTest.jsx:21:    setLogs(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`]);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/mobile-app/src/components/StaticTest.jsx:46:          Current Time: {new Date().toLocaleString()}
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/mobile-app/src/components/SuperSimpleTest.jsx:21:    const log = `Render #${newRenderCount} at ${new Date().toLocaleTimeString()}`;
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/mobile-app/src/components/UnitReport.jsx:207:    const currentMonth = new Date().getMonth();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/mobile-app/src/components/UnitReport.jsx:208:    const currentYear = new Date().getFullYear();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/mobile-app/src/components/UnitReport.jsx:225:          const today = new Date().getDate();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/mobile-app/src/components/UnitReport.jsx:235:          const today = new Date().getDate();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/mobile-app/src/components/UnitReport.jsx:318:                const today = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/mobile-app/src/components/WashEntryModal.jsx:82:        timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/mobile-app/src/hooks/useDashboardData.js:117:        const currentDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/mobile-app/src/hooks/useExpenseForm.js:198:      date: new Date().toISOString().split('T')[0],
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/mobile-app/src/hooks/useExpenseForm.js:6:    date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/mobile-app/src/hooks/useExpenseForm.jsx:204:      date: new Date().toISOString().split('T')[0],
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/mobile-app/src/hooks/useExpenseForm.jsx:7:    date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/mobile-app/src/services/enhancedApiClient.js:168:    mobileError.timestamp = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/mobile-app/src/services/waterReadingService.js:317:    currentReadings.timestamp = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/mobile-app/src/services/waterReadingServiceV2.js:379:    currentReadings.timestamp = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/mobile-app/src/utils/timezone.js:20:    const now = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/mobile-app/src/utils/timezone.js:59:  const now = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/mobile-app/src/utils/versionChecker.js:19:    const buildDate = import.meta.env.VITE_APP_BUILD_DATE || new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/mobile-app/src/utils/versionUtils.js:5:    buildDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/mobile-app/src/utils/waterReadingHelpers.js:104:  return new Date().toLocaleDateString('es-MX', {
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/mobile-app/src/utils/waterReadingHelpers.js:113:export const formatWashDate = (date = new Date()) => {

### Shared Components ###
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/shared-components/src/ErrorHandling/EnhancedErrorBoundary.tsx:114:        timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/shared-components/src/ErrorHandling/index.ts:179:export const BUILD_DATE = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/shared-components/src/ErrorHandling/StandardizedError.tsx:54:      timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/shared-components/src/ErrorHandling/StandardizedError.tsx:65:    this.timestamp = this.details.timestamp || new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/shared-components/src/ErrorHandling/useApiErrorHandler.ts:138:      lastAttempt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/shared-components/src/ErrorHandling/useApiErrorHandler.ts:196:          lastAttempt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/shared-components/src/Performance/index.ts:135:      timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/shared-components/src/Performance/index.ts:144:export const PERFORMANCE_BUILD_DATE = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/shared-components/src/UX/EnterpriseShowcase.tsx:76:              Build: {new Date().toISOString().split('T')[0]}
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/shared-components/src/UX/index.ts:171:      timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/frontend/shared-components/src/UX/index.ts:180:export const UX_BUILD_DATE = new Date().toISOString();

### Cloud Functions ###
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/functions/index.js:107:      const today = new Date().toISOString().split('T')[0];
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/functions/populate-historical-data.js:80:    const today = new Date().toISOString().split('T')[0];
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/functions/src/bulkHistoricalLoader.js:101:  const today = new Date().toISOString().split('T')[0];
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/functions/src/bulkHistoricalLoader.js:11:  const today = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/functions/src/syncToDevDatabase.js:27:    const endDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/functions/src/syncToDevDatabase.js:28:    const startDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/functions/src/utils/dateHelpers.js:22:  const endDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/functions/src/utils/dateHelpers.js:23:  const startDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/functions/src/utils/timezone.js:14:  const now = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/functions/src/utils/timezone.js:37:  const now = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/functions/trigger-manual-update.js:27:    const endDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/functions/trigger-manual-update.js:28:    const startDate = new Date();

### Scripts ###
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/account-id-migration.js:62:        updated: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/account-id-migration.js:69:        created: cashAccount.created || new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/account-id-migration.js:70:        updated: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/account-id-migration.js:79:        updated: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/account-id-migration.js:86:        created: bankAccount.created || new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/account-id-migration.js:87:        updated: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/backup-scripts/backup-mtc-data.js:110:      timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/backup-scripts/backup-mtc-data.js:148:      timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/backup-scripts/backup-mtc-data.js:166:      createdAt: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/backup-scripts/backup-mtc-data.js:20:  timestamp: new Date().toISOString().replace(/[:.]/g, '-'),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/backup-scripts/backup-mtc-data.js:72:      timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/backup-scripts/backup-mtc-simple.js:11:const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/backup-scripts/backup-production-complete.js:126:  console.log(`⏰ Timestamp: ${new Date().toISOString()}\n`);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/backup-scripts/backup-production-complete.js:133:    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/backup-scripts/backup-production-complete.js:144:        timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/backup-scripts/backup-production-complete.js:191:Timestamp: ${new Date().toISOString()}
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/backup-scripts/backup-production-exchangerates.js:33:  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/backup-scripts/backup-production-exchangerates.js:40:    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/backup-scripts/backup-production-exchangerates.js:68:        timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/backup-scripts/fix-prod-michael-auth.js:54:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/backup-scripts/fix-prod-michael-auth.js:55:      lastLogin: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/backup-scripts/fix-prod-michael-auth.js:59:        at: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/backup-scripts/fix-superadmin-account.js:49:        addedDate: userData.clientAccess?.MTC?.addedDate || new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/backup-scripts/fix-superadmin-account.js:61:    lastUpdated: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/backup-scripts/fix-superadmin-account.js:69:      adminFixedAt: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/backup-scripts/fix-superadmin-permissions.js:128:      lastUpdated: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/backup-scripts/fix-superadmin-permissions.js:79:        addedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/backup-scripts/fix-superadmin-permissions.js:93:    lastUpdated: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/backup-scripts/fix-user-role.js:23:      lastModifiedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/backup-scripts/fix-user-structure.js:121:      lastModifiedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/backup-scripts/fixNullVendorIds.js:45:          updatedAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/debug-scripts/quick-cleanup-check.js:16:  console.log(`${new Date().toISOString()}: ${collections.length} ghost collections remaining`);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/duplicate-purge/purge-mtc-data.js:163:      timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/duplicate-purge/purge-mtc-data.js:188:    timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/legacy-import-scripts/importHOADues.js:87:    const today = new Date(); // Fallback date
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/legacy-import-scripts/importHOADuesFixed.js:128:  const today = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/legacy-import-scripts/importHOADuesFixed2.js:78:  const today = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/legacy-import-scripts/importHOADuesFixed3.js:260:    console.log(`${colors.cyan}⏱️  Script finished at: ${new Date().toISOString()}${colors.reset}`);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/legacy-import-scripts/importHOADuesFixed3.js:27:console.log(`${colors.cyan}⏱️  Script started at: ${new Date().toISOString()}${colors.reset}`);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/legacy-import-scripts/importHOADuesSimple.js:45:    const today = new Date(); // Use today's date for all payments
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/migration-scripts/account-id-migration.js:62:        updated: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/migration-scripts/account-id-migration.js:69:        created: cashAccount.created || new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/migration-scripts/account-id-migration.js:70:        updated: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/migration-scripts/account-id-migration.js:79:        updated: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/migration-scripts/account-id-migration.js:86:        created: bankAccount.created || new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/migration-scripts/account-id-migration.js:87:        updated: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/migration-scripts/balance-migration.js:52:        updated: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/migration-scripts/balance-migration.js:59:        updated: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/migration-scripts/fix-account-ids.js:111:        lastUpdated: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/migration-scripts/fix-account-ids.js:46:    accountsLastUpdated: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/migration-scripts/fix-account-ids.js:64:      updatedAt: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/migration-scripts/fix-account-ids.js:89:  const currentYear = new Date().getFullYear().toString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/migration-scripts/fix-unit-unitid-fields.js:59:          fixedAt: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/migration-scripts/fix-unit-unitid-fields.js:69:          fixedAt: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/migration-scripts/fix-unit-unitid-fields.js:82:            fixedAt: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/migration-scripts/match-original-user-format.js:37:          addedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/migration-scripts/match-original-user-format.js:48:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/migration-scripts/match-original-user-format.js:49:      lastLogin: new Date(),  // Add lastLogin like original
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/migration-scripts/match-original-user-format.js:50:      lastModifiedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/migration-scripts/revert-to-uid-docids.js:70:            at: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/migration-scripts/standardize-transaction-units.js:96:          updatedAt: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/migration-scripts/standardize-unit-fields.js:96:          updatedAt: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/create-test-data.js:61:  return new Date().toISOString().replace('Z', '-05:00'); // America/Cancun
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/test-accounts.js:26:    date: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/test-categories-vendors-scripts.js:232:    timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/test-client-isolation.js:112:      timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/test-import-users.js:83:            importBatch: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/test-transaction-filter.js:127:      const currentMonth = new Date().getMonth() + 1;
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/test-transaction-filter.js:128:      const currentYear = new Date().getFullYear();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/testAllCRUD.js:165:    date: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/testCreateTransaction.js:38:      date: Timestamp.fromDate(new Date()),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/testDirectWrite.js:27:      timestamp: Timestamp.fromDate(new Date())
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/testDuesPayment.js:16:      date: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/testDuesRecord.js:38:          date: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/testEmailAuthTransaction.js:45:      date: Timestamp.fromDate(new Date()),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/testEmailAuthTransaction.js:52:      createdAt: Timestamp.fromDate(new Date()),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/testFinalAuth.js:38:      date: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/testFinalAuth.js:45:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/testFirebaseTransaction.js:37:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/testFirebaseTransaction.js:67:      date: Timestamp.fromDate(new Date()),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/testFrontendTransaction.js:36:      date: Timestamp.fromDate(new Date()),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/testFrontendTransaction.js:42:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/testHoaDuesDataStructure.js:43:        created: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/testHoaDuesDataStructure.js:68:    const now = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/testHoaOverpaymentNotes.js:110:      date: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/testHoaOverpaymentNotes.js:17:      date: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/testHoaOverpaymentNotes.js:63:      date: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/testNewNotesFormat.js:16:      date: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/testNewNotesFormat.js:50:      date: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/testNewNotesFormat.js:86:      date: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/testSimpleAuth.js:35:      date: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/testSimpleAuth.js:42:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/testTransactionManagement.js:28:  const testDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/testUiAuthFlow.js:140:      date: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/testUiAuthFlow.js:147:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/testUpdatedAuth.js:60:      date: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/archive/test-scripts/testUpdatedAuth.js:67:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/audit-logs-cleanup.js:18:const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/backup-mtc-data.js:110:      timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/backup-mtc-data.js:148:      timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/backup-mtc-data.js:166:      createdAt: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/backup-mtc-data.js:20:  timestamp: new Date().toISOString().replace(/[:.]/g, '-'),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/backup-mtc-data.js:72:      timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/backup-mtc-simple.js:11:const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/backup-production-complete.js:126:  console.log(`⏰ Timestamp: ${new Date().toISOString()}\n`);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/backup-production-complete.js:133:    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/backup-production-complete.js:144:        timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/backup-production-complete.js:191:Timestamp: ${new Date().toISOString()}
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/backup-production-exchangerates.js:33:  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/backup-production-exchangerates.js:40:    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/backup-production-exchangerates.js:68:        timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/balance-migration.js:52:        updated: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/balance-migration.js:59:        updated: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/bulkImportExchangeRates.js:281:        lastUpdated: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/bulkImportExchangeRates.js:365:      lastUpdated: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/bulkImportExchangeRates.js:510:      endDate = new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/bulkImportExchangeRates.js:698:    const endDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/clear-production-data.js:92:  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/analyze-client-dynamic.js:113:    analyzed: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/analyze-client-dynamic.js:295:          timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/analyze-client-dynamic.js:335:          timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/analyze-client-dynamic.js:388:            timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/analyze-client-dynamic.js:81:  const timestamp = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/archive-old-scripts/backup-production-complete.js:126:  console.log(`⏰ Timestamp: ${new Date().toISOString()}\n`);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/archive-old-scripts/backup-production-complete.js:133:    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/archive-old-scripts/backup-production-complete.js:144:        timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/archive-old-scripts/backup-production-complete.js:191:Timestamp: ${new Date().toISOString()}
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/archive-old-scripts/complete-client-deletion.js:24:const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/archive-old-scripts/complete-client-deletion.js:90:    createdAt: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/archive-old-scripts/fix-vendor-categories.js:38:          updated: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/archive-old-scripts/importHOADuesFixed.js:78:  const today = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/archive-old-scripts/scripts-2025-08-06/compare-client-structures.js:119:      timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/backup-prod-client.js:154:      backedUpAt: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/backup-prod-client.js:279:          timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/backup-prod-client.js:315:          timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/backup-prod-client.js:351:            timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/backup-prod-client.js:84:  const timestamp = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/create-firebase-users.js:204:      timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/create-firebase-users.js:216:        timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/export-client-complete.js:165:      exportedAt: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/export-client-complete.js:343:          timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/export-client-complete.js:392:          timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/export-client-complete.js:445:            timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/export-client-complete.js:83:  const timestamp = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/export-client.js:163:      exportedAt: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/export-client.js:290:          timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/export-client.js:327:          timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/export-client.js:366:            timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/export-client.js:88:  const timestamp = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/init-migration.js:108:  const timestamp = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/init-migration.js:193:Started: ${new Date().toISOString()}
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/init-migration.js:36:  const now = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/init-migration.js:52:    started: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/init-migration.js:58:        timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/prepare-user-mapping.js:165:        timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/prepare-user-mapping.js:185:          timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/prepare-user-mapping.js:200:      timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/prepare-user-mapping.js:262:          timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/prepare-user-mapping.js:298:            timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/prepare-user-mapping.js:85:  const timestamp = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/purge-prod-client.js:291:          timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/purge-prod-client.js:312:            timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/purge-prod-client.js:355:              timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/purge-prod-client.js:377:          timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/purge-prod-client.js:407:            timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/purge-prod-client.js:92:  const timestamp = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/utils/auditLogger.js:9:  const now = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/utils/migration-dir.js:82:  const timestamp = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/utils/timestamp-converter.js:82:function generateTransactionDocId(date = new Date(), sequenceNumber = 1) {
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/verify-migration.js:101:    analyzed: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/verify-migration.js:223:    timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/verify-migration.js:388:          timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/verify-migration.js:435:          timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/verify-migration.js:441:      completed: report.success ? new Date().toISOString() : null
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/verify-migration.js:467:            timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/client-onboarding/verify-migration.js:87:  const timestamp = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/complete-client-deletion.js:24:const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/complete-client-deletion.js:90:    createdAt: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/create-avii-yearend-snapshot.js:75:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/create-avii-yearend-snapshot.js:93:        updatedAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/create-balance-snapshot.js:33:    const snapshotDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/create-balance-snapshot.js:45:        lastUpdated: account.lastUpdated || account.updated || new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/create-empty-collections.js:27:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/create-empty-collections.js:37:      startDate: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/create-empty-collections.js:40:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/create-empty-collections.js:48:      year: new Date().getFullYear(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/create-empty-collections.js:53:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/create-empty-collections.js:65:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/create-empty-collections.js:76:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/create-empty-collections.js:88:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/create-missing-firebase-auth.js:51:        'migrationData.firebaseAuthCreated': new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/create-missing-firebase-auth.js:52:        lastModifiedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/create-new-superadmin.js:80:          addedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/create-new-superadmin.js:86:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/create-new-superadmin.js:87:      lastModifiedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/create-production-michael.js:54:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/create-production-michael.js:55:      lastLogin: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/create-standardized-user.js:112:        addedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/create-standardized-user.js:118:        addedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/create-standardized-user.js:83:    createdAt: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/create-standardized-user.js:84:    updatedAt: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/create-superadmin-profile.js:34:          addedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/create-superadmin-profile.js:40:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/create-superadmin-profile.js:41:      lastModifiedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/createMTC.js:16:    createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/createMTC.js:17:    updatedAt: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/data-augmentation-utils.js:130:        addedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/data-augmentation-utils.js:147:      migratedAt: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/data-augmentation-utils.js:176:    date: mtcTransaction.Date || new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/data-augmentation-utils.js:193:      migratedAt: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/data-augmentation-utils.js:229:    createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/data-augmentation-utils.js:235:      migratedAt: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/data-augmentation-utils.js:249:    createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/data-augmentation-utils.js:252:      migratedAt: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/data-augmentation-utils.js:265:    createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/data-augmentation-utils.js:268:      migratedAt: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/data-augmentation-utils.js:297:        migratedAt: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/data-augmentation-utils.js:304:    year: new Date().getFullYear(), // Current year
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/data-augmentation-utils.js:312:      migratedAt: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/enhanced-client-purge-with-audit.js:21:const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/export-dev-to-production.js:106:  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/export-dev-to-production.js:114:    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/export-dev-to-production.js:125:        timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/export-dev-to-production.js:168:Timestamp: ${new Date().toISOString()}
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/export-transactions-with-balances.js:153:    const filename = `MTC_Transactions_Balance_Debug_${new Date().toISOString().split('T')[0]}.csv`;
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/fetch-mtc-client.js:46:    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/fetchDOF.js:103:  const end = endDate ? new Date(endDate) : new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/fetchDOF.js:137:  const sevenDaysAgo = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/fix-account-ids.js:111:        lastUpdated: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/fix-account-ids.js:46:    accountsLastUpdated: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/fix-account-ids.js:64:      updatedAt: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/fix-account-ids.js:89:  const currentYear = new Date().getFullYear().toString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/fix-hoa-dues-sequence-linking.js:131:        lastUpdated: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/fix-missing-firebase-auth-users.js:63:                'migrationData.firebaseAuthCreated': new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/fix-missing-firebase-auth-users.js:65:                lastModifiedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/fix-prod-michael-auth.js:54:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/fix-prod-michael-auth.js:55:      lastLogin: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/fix-prod-michael-auth.js:59:        at: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/fix-superadmin-account.js:49:        addedDate: userData.clientAccess?.MTC?.addedDate || new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/fix-superadmin-account.js:61:    lastUpdated: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/fix-superadmin-account.js:69:      adminFixedAt: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/fix-superadmin-permissions.js:128:      lastUpdated: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/fix-superadmin-permissions.js:79:        addedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/fix-superadmin-permissions.js:93:    lastUpdated: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/fix-total-paid.js:48:          updated: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/fix-user-role.js:23:      lastModifiedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/fix-user-structure.js:121:      lastModifiedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/fixNullVendorIds.js:45:          updatedAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/force-clear-mobile-cache.js:73:      timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/force-clear-mobile-cache.js:81:      timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/force-fix-firestore-data.js:104:        updated: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/get-user-data-dev.js:199:    fetchedAt: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/get-user-data-enhanced.js:206:    fetchedAt: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/importHOADues.js:87:    const today = new Date(); // Fallback date
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/importHOADuesCommonJS.js:78:  const today = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/importHOADuesFixed.js:78:  const today = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/importHOADuesFixed2.js:78:  const today = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/importHOADuesFixed3.js:260:    console.log(`${colors.cyan}⏱️  Script finished at: ${new Date().toISOString()}${colors.reset}`);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/importHOADuesFixed3.js:27:console.log(`${colors.cyan}⏱️  Script started at: ${new Date().toISOString()}${colors.reset}`);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/importHOADuesSimple.js:35:    const today = new Date(); // Use today's date for all payments
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/importHOADuesWithDates.js:70:    const today = new Date(); // Fallback date
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/importMTCLists-updated.js:258:    timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/interactive-client-onboarding.js:403:  console.log(`⏰ Completed: ${new Date().toISOString()}`);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/interactive-client-setup.js:367:      const filename = `${clientIdUpper}_client_config_${new Date().toISOString().split('T')[0]}.json`;
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/link-hoa-dues.js:171:        updatedAt: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/match-original-user-format.js:37:          addedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/match-original-user-format.js:48:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/match-original-user-format.js:49:      lastLogin: new Date(),  // Add lastLogin like original
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/match-original-user-format.js:50:      lastModifiedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/monitor-auth-status.js:106:  console.log('\n🔄 Status as of:', new Date().toLocaleTimeString());
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/monitor-auto-cleanup.js:107:  console.log(\`\${new Date().toISOString()}: \${collections.length} ghost collections remaining\`);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/monitor-auto-cleanup.js:22:    console.log(`📊 Current State (${new Date().toISOString()}):`);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/purge-mtc-data.js:163:      timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/purge-mtc-data.js:188:    timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/purge-transactions.js:58:      lastUpdated: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/purge-transactions.js:64:      accountsLastUpdated: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/quick-cleanup-check.js:16:  console.log(`${new Date().toISOString()}: ${collections.length} ghost collections remaining`);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/rebuild-balances.js:180:      lastBalanceRebuild: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/restore-simple-superadmin.js:43:        addedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/restore-simple-superadmin.js:54:    lastModifiedDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/restore-simple-superadmin.js:58:    createdAt: userData.createdAt || new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/revert-to-uid-docids.js:70:            at: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/deployers/base.js:189:            endTime: state === 'ready' || state === 'error' || state === 'cancelled' ? new Date() : undefined
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/deployers/base.js:334:                    timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/deployers/base.js:376:                        timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/deployers/base.js:66:            startTime: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/deployers/base.js:68:        this.startTime = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/deployers/firebase.js:50:        this.rulesBackupPath = path.join(path.dirname(this.projectPath), '.firebase-rules-backup', this.environment, new Date().toISOString().replace(/:/g, '-'));
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/deployers/mobile.js:317:            manifest.last_updated = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/deployers/mobile.js:81:                    VITE_CACHE_BUST: new Date().getTime().toString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/monitors/deployment-tracker.js:134:            deployment.metadata.rolledBackAt = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/monitors/deployment-tracker.js:136:        history.lastUpdated = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/monitors/deployment-tracker.js:142:        const cutoffDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/monitors/deployment-tracker.js:168:        const cutoffDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/monitors/deployment-tracker.js:174:            history.lastUpdated = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/monitors/deployment-tracker.js:189:                    lastUpdated: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/monitors/deployment-tracker.js:58:                    lastUpdated: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/monitors/deployment-tracker.js:78:            timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/monitors/deployment-tracker.js:91:        history.lastUpdated = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/rollback/deployment-history.js:117:        data.lastUpdated = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/rollback/deployment-history.js:139:        data.lastUpdated = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/rollback/deployment-history.js:193:        const cutoffDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/rollback/deployment-history.js:256:                partial?.timestamp || (0, process_1.executeCommand)('git', ['log', '-1', '--pretty=%aI']).then(r => r.stdout.trim()).catch(() => new Date().toISOString()),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/rollback/deployment-history.js:277:                timestamp: partial?.timestamp || new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/rollback/deployment-history.js:287:                timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/rollback/deployment-history.js:295:            auditData.lastUpdated = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/rollback/deployment-history.js:334:        const endDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/rollback/deployment-history.js:412:                return { deployments: [], rollbacks: [], backups: [], events: [], lastUpdated: new Date().toISOString() };
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/rollback/deployment-history.js:59:                { path: this.deploymentsFile, data: { deployments: [], lastUpdated: new Date().toISOString() } },
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/rollback/deployment-history.js:60:                { path: this.rollbacksFile, data: { rollbacks: [], lastUpdated: new Date().toISOString() } },
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/rollback/deployment-history.js:61:                { path: this.backupsFile, data: { backups: [], lastUpdated: new Date().toISOString() } },
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/rollback/deployment-history.js:62:                { path: this.auditFile, data: { events: [], lastUpdated: new Date().toISOString() } }
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/rollback/deployment-history.js:83:            timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/rollback/deployment-history.js:95:        data.lastUpdated = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/rollback/rollback-manager.js:367:            timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/rollback/rollback-manager.js:404:            timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/rollback/rollback-manager.js:425:            timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/utils/build-scripts.js:202:  timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/utils/cache-buster.js:18:        this.timestamp = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/utils/cache-buster.js:312:  const BUILD_ID = '${new Date().getTime()}';
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/utils/deployment-wrapper.js:184:            `📅 Timestamp: ${new Date().toISOString()}`,
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/utils/git.js:75:        const message = `Deployment to ${environment} at ${new Date().toISOString()}`;
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/utils/version-manager.js:26:                timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/utils/version-manager.js:308:                rollbackDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/utils/version-manager.js:356:            return new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/utils/version-manager.js:63:                copyright: new Date().getFullYear().toString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/utils/version-manager.js:66:                buildTimestamp: new Date().getTime(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/utils/version.js:107:    const now = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/utils/version.js:17:            timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/utils/version.js:28:            timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/utils/version.js:58:            timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/verifiers/deployment-verifier.js:31:        this.startTime = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/dist/verifiers/health-checker.js:486:            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/__tests__/deployment-tracker.test.ts:104:        lastUpdated: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/__tests__/deployment-tracker.test.ts:134:        lastUpdated: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/__tests__/deployment-tracker.test.ts:153:        lastUpdated: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/__tests__/deployment-tracker.test.ts:172:        lastUpdated: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/__tests__/deployment-tracker.test.ts:189:        lastUpdated: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/__tests__/deployment-tracker.test.ts:204:        lastUpdated: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/__tests__/deployment-tracker.test.ts:217:      const now = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/__tests__/deployment-tracker.test.ts:24:      lastUpdated: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/__tests__/deployment-tracker.test.ts:242:      const now = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/__tests__/deployment-tracker.test.ts:243:      const old = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/__tests__/rollback-manager.test.ts:142:        timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/__tests__/rollback-manager.test.ts:183:        timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/__tests__/rollback-manager.test.ts:240:        timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/__tests__/rollback-manager.test.ts:347:        timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/__tests__/rollback-manager.test.ts:95:        timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/deployers/base.ts:291:      endTime: state === 'ready' || state === 'error' || state === 'cancelled' ? new Date() : undefined
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/deployers/base.ts:518:            timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/deployers/base.ts:574:              timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/deployers/base.ts:62:      startTime: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/deployers/base.ts:64:    this.startTime = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/deployers/desktop.ts:195:    const now = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/deployers/firebase.ts:25:      new Date().toISOString().replace(/:/g, '-')
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/deployers/mobile.ts:429:      manifest.last_updated = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/deployers/mobile.ts:65:          VITE_CACHE_BUST: new Date().getTime().toString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/monitors/deployment-tracker.ts:100:      timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/monitors/deployment-tracker.ts:118:    history.lastUpdated = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/monitors/deployment-tracker.ts:219:      deployment.metadata.rolledBackAt = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/monitors/deployment-tracker.ts:222:    history.lastUpdated = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/monitors/deployment-tracker.ts:243:    const cutoffDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/monitors/deployment-tracker.ts:283:    const cutoffDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/monitors/deployment-tracker.ts:295:      history.lastUpdated = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/monitors/deployment-tracker.ts:314:          lastUpdated: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/monitors/deployment-tracker.ts:62:          lastUpdated: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/rollback/deployment-history.ts:162:        { path: this.deploymentsFile, data: { deployments: [], lastUpdated: new Date().toISOString() } },
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/rollback/deployment-history.ts:163:        { path: this.rollbacksFile, data: { rollbacks: [], lastUpdated: new Date().toISOString() } },
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/rollback/deployment-history.ts:164:        { path: this.backupsFile, data: { backups: [], lastUpdated: new Date().toISOString() } },
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/rollback/deployment-history.ts:165:        { path: this.auditFile, data: { events: [], lastUpdated: new Date().toISOString() } }
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/rollback/deployment-history.ts:199:      timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/rollback/deployment-history.ts:216:    data.lastUpdated = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/rollback/deployment-history.ts:250:    data.lastUpdated = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/rollback/deployment-history.ts:284:    data.lastUpdated = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/rollback/deployment-history.ts:378:    const cutoffDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/rollback/deployment-history.ts:488:        partial?.timestamp || executeCommand('git', ['log', '-1', '--pretty=%aI']).then(r => r.stdout.trim()).catch(() => new Date().toISOString()),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/rollback/deployment-history.ts:511:        timestamp: partial?.timestamp || new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/rollback/deployment-history.ts:526:        timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/rollback/deployment-history.ts:537:      auditData.lastUpdated = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/rollback/deployment-history.ts:603:    const endDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/rollback/deployment-history.ts:704:        return { deployments: [], rollbacks: [], backups: [], events: [], lastUpdated: new Date().toISOString() };
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/rollback/rollback-manager.ts:557:      timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/rollback/rollback-manager.ts:620:      timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/rollback/rollback-manager.ts:654:      timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/utils/build-scripts.ts:242:  timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/utils/cache-buster.ts:36:    this.timestamp = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/utils/cache-buster.ts:434:  const BUILD_ID = '${new Date().getTime()}';
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/utils/deployment-wrapper.ts:251:      `📅 Timestamp: ${new Date().toISOString()}`,
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/utils/git.ts:82:    const message = `Deployment to ${environment} at ${new Date().toISOString()}`;
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/utils/version-manager.ts:118:        copyright: new Date().getFullYear().toString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/utils/version-manager.ts:121:        buildTimestamp: new Date().getTime(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/utils/version-manager.ts:408:        rollbackDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/utils/version-manager.ts:461:      return new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/utils/version-manager.ts:65:        timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/utils/version.ts:122:  const now = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/utils/version.ts:24:      timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/utils/version.ts:35:      timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/utils/version.ts:70:      timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/verifiers/deployment-verifier.ts:46:    this.startTime = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/sams-deploy/src/verifiers/health-checker.ts:636:      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/set-manual-balances.js:56:        lastUpdated: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/set-manual-balances.js:68:    accountsLastUpdated: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/setup-accounts.js:191:  const currentYear = new Date().getFullYear();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/setup-accounts.js:204:    lastUpdated: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/setup-accounts.js:207:      migratedAt: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/setup-accounts.js:218:      lastUpdated: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/setup-accounts.js:237:    timestamp: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/setup-accounts.js:58:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/setup-accounts.js:62:        migratedAt: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/setup-accounts.js:73:    accountsLastUpdated: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/setup-menu-configuration.js:52:      updatedAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/show-prior-year-balances.js:61:    const today = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/simpleSingleTests/test1_unauthenticated_write.js:27:      timestamp: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/simpleSingleTests/test2_authenticated_write.js:40:      timestamp: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/simpleTransactionTest.js:37:      date: Timestamp.fromDate(new Date()),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/simpleTransactionTest.js:43:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/standardize-transaction-units.js:96:          updatedAt: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/standardize-unit-fields.js:96:          updatedAt: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/storage-and-firestore-cleanup.js:20:const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/test-accounts.js:26:    date: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/test-client-isolation.js:112:      timestamp: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/test-id-generation-timezone.js:23:    new Date().toISOString()     // Current time
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/test-transaction-filter.js:127:      const currentMonth = new Date().getMonth() + 1;
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/test-transaction-filter.js:128:      const currentYear = new Date().getFullYear();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/testAllCRUD.js:165:    date: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/testCreateTransaction.js:38:      date: Timestamp.fromDate(new Date()),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/testDirectWrite.js:27:      timestamp: Timestamp.fromDate(new Date())
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/testDuesPayment.js:16:      date: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/testDuesRecord.js:38:          date: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/testEmailAuthTransaction.js:45:      date: Timestamp.fromDate(new Date()),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/testEmailAuthTransaction.js:52:      createdAt: Timestamp.fromDate(new Date()),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/testFinalAuth.js:38:      date: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/testFinalAuth.js:45:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/testFirebaseTransaction.js:37:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/testFirebaseTransaction.js:67:      date: Timestamp.fromDate(new Date()),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/testFrontendTransaction.js:36:      date: Timestamp.fromDate(new Date()),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/testFrontendTransaction.js:42:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/testHoaDuesDataStructure.js:43:        created: new Date()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/testHoaDuesDataStructure.js:68:    const now = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/testHoaOverpaymentNotes.js:110:      date: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/testHoaOverpaymentNotes.js:17:      date: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/testHoaOverpaymentNotes.js:63:      date: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/testNewNotesFormat.js:16:      date: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/testNewNotesFormat.js:50:      date: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/testNewNotesFormat.js:86:      date: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/testSimpleAuth.js:35:      date: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/testSimpleAuth.js:42:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/testTransactionManagement.js:28:  const testDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/testUiAuthFlow.js:140:      date: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/testUiAuthFlow.js:147:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/testUpdatedAuth.js:60:      date: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/testUpdatedAuth.js:67:      createdAt: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/update-version-staging.js:18:    buildDate: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/updateExchangeRates.js:28:    console.log(`📅 ${new Date().toISOString()}`);
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/updateExchangeRates.js:45:      const endDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/updateExchangeRates.js:46:      const startDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/updateVersion.js:109:      const buildTimestamp = new Date().toISOString();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/utils/auditLogger.js:9:  const now = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/utils/timestamp-converter.js:82:function generateTransactionDocId(date = new Date(), sequenceNumber = 1) {
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/verify-data.js:56:    let earliestDate = new Date();
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/verify-environment-health.js:54:      timestamp: new Date(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/scripts/verify-import.js:34:  timestamp: new Date(),

### Memory/Archive ###
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/Memory/Archive/Split_Transactions_Project_2025/Implementation_Scripts/hoaAllocationsTest.js:190:          createdAt: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/Memory/Archive/Split_Transactions_Project_2025/Implementation_Scripts/hoaAllocationsTest.js:28:    date: new Date().toISOString(),
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/Memory/Archive/Split_Transactions_Project_2025/Implementation_Scripts/migrateHOAAllocations.js:77:      migrationDate: new Date().toISOString()
/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/Memory/Archive/Split_Transactions_Project_2025/Implementation_Scripts/validateHOABehavior.js:466:      testYear = new Date().getFullYear(),


## PATTERN ANALYSIS ##
================================================

### Used with convertToTimestamp() ###
