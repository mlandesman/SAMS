# Exchange Rates Management System

This system provides automated and manual management of historical exchange rates data in the SAMS application.

## 🚀 **NEW: Web App Integration (June 2025)**

The exchange rates system now includes full web application integration with:

- **✅ Automated Daily Updates**: Triggered automatically when users log into the web app
- **✅ Admin UI**: Exchange Rates tab in List Management Activity for manual control
- **✅ Backend API Endpoints**: RESTful endpoints for update triggers and status checks
- **✅ Real-time Status Monitoring**: Check current exchange rate availability and last update times
- **✅ Multiple Update Modes**: Quick update, gap filling, bulk replacement, and dry-run testing

## Web App Features

### Automated Daily Updates
- Triggered automatically when any user logs into SAMS web app
- Uses gap-filling logic to ensure no missing dates
- Runs silently in background without user interaction
- Provides console logging for troubleshooting

### Admin UI (List Management → Exchange Rates)
The Exchange Rates tab provides admin controls for:

1. **Current Status Check**
   - View today's exchange rate availability
   - See last update time and data source
   - Display available currencies and current rates

2. **Quick Update**
   - Fill gaps from last known date to today
   - Safe and fast operation
   - Recommended for regular maintenance

3. **Fill Recent Gaps**
   - Fill missing dates in the last month
   - Good for fixing recent issues or after downtime

4. **Dry Run Test**
   - Test what would be updated without making changes
   - Safe way to preview operations

5. **Full Bulk Replace**
   - Delete all data and rebuild from 2020+
   - Nuclear option for complete refresh
   - Takes several minutes to complete

### Backend API Endpoints

- `POST /api/exchange-rates/daily-update` - Automated daily update (called on login)
- `POST /api/exchange-rates/manual-update` - Manual admin updates with options
- `GET /api/exchange-rates/check` - Check current exchange rate status

## Scripts Overview

### 1. `bulkImportExchangeRates.js` - Core Import Engine

The primary script for importing exchange rates with multiple operating modes. Now also powers the web app backend endpoints.

#### Features:
- **Full Replacement**: Delete all existing data and import from scratch using Banxico bulk data
- **Gap Filling**: Only import missing dates (preserves existing data)  
- **Quick Update**: Automatically update from last known date to today
- **Custom Date Ranges**: Import specific date ranges
- **Dry Run Mode**: Test operations without making changes
- **Bulk Historical Data**: Uses Banxico's bulk endpoint for efficient full replacements
- **API Rate Limiting**: Built-in delays to respect API limits
- **Multi-Currency Support**: USD, CAD, EUR, COP exchange rates vs MXN
- **Weekdays Only**: Automatically excludes weekends and processes only business days
- **2020+ Filter**: Filters out pre-2020 data for better performance

#### Usage Examples:

```bash
# Full replacement using Banxico bulk data (delete all and reimport from 2020)
node bulkImportExchangeRates.js --full-replacement

# Fill gaps only (preserve existing data, import missing dates)
node bulkImportExchangeRates.js --fill-gaps

# Quick update (from last known date to today)
node bulkImportExchangeRates.js --quick-update

# Dry run test (see what would be updated without making changes)
node bulkImportExchangeRates.js --fill-gaps --dry-run

# Custom date range
node bulkImportExchangeRates.js --start-date 2024-06-01 --end-date 2024-06-30

# Get help
node bulkImportExchangeRates.js --help
```

### 2. `updateExchangeRates.js` - Legacy Daily Update Script

**⚠️ DEPRECATED**: This script is now replaced by web app integration.

The old daily automation script. Consider using the web app's automated daily updates instead.

### 3. Web App Integration Files

#### Backend Components:
- `/backend/controllers/exchangeRatesController.js` - API endpoint handlers
- `/backend/routes/exchangeRates.js` - Route definitions
- `/backend/utils/exchangeRates.js` - Utility functions

#### Frontend Components:
- `/frontend/sams-ui/src/api/exchangeRates.js` - API service layer
- `/frontend/sams-ui/src/components/lists/ExchangeRatesList.jsx` - Admin UI component
- `/frontend/sams-ui/src/context/AuthContext.jsx` - Auto-trigger on login
- `/frontend/sams-ui/src/views/ListManagementView.jsx` - Tab integration

## Data Sources

- **Primary**: Banxico (Bank of Mexico) API for USD, CAD, EUR rates
- **Secondary**: Colombian Government API for COP rates
- **Fallback**: Hardcoded approximate rates if APIs fail

## Data Structure

Exchange rates are stored in Firestore with the following structure:

```json
{
  "date": "2024-03-15",
  "lastUpdated": "2024-03-15T10:30:00Z",
  "source": "Historical Import",
  "rates": {
    "MXN_USD": {
      "rate": 0.058324,
      "source": "Banxico",
      "seriesId": "SF43718",
      "originalRate": 17.1456,
      "title": "Mexican peso per US dollar"
    },
    "MXN_CAD": {
      "rate": 0.043127,
      "source": "Banxico", 
      "seriesId": "SF60632",
      "originalRate": 23.1890,
      "title": "Mexican peso per Canadian dollar"
    },
    "MXN_EUR": {
      "rate": 0.053891,
      "source": "Banxico",
      "seriesId": "SF46410", 
      "originalRate": 18.5567,
      "title": "Mexican peso per Euro"
    },
    "MXN_COP": {
      "rate": 0.000146,
      "source": "Colombian Government (current rate applied)",
      "calculatedFrom": "USD/COP rate via MXN/USD",
      "usdToCopRate": 4000
    }
  }
}
```

## API Rate Limits

The scripts include built-in rate limiting:
- **1 second delay** between API requests
- **Progress updates** every 10 dates processed
- **Error handling** with retry logic for failed requests

## Error Handling

- API failures are logged but don't stop the entire process
- Missing currency data (CAD/EUR) is handled gracefully
- Network timeouts are caught and reported
- Invalid dates are skipped with warnings

## Recommended Usage Patterns

### ✅ **Recommended: Web App Integration (Current)**
```
1. Users log into SAMS web app → Automated daily update triggers
2. Admins use List Management → Exchange Rates tab for manual control
3. All operations happen through the web interface
```

### Initial Setup:
```bash
# First time setup - Use web app admin UI "Full Bulk Replace" button
# OR via command line:
node bulkImportExchangeRates.js --full-replacement
```

### Daily Maintenance:
```
✅ AUTOMATIC: Daily updates happen when users log into web app
✅ MANUAL: Use "Quick Update" button in Exchange Rates tab
```

### Gap Filling:
```
✅ WEB UI: Use "Fill Recent Gaps" button in Exchange Rates tab
✅ CLI: node bulkImportExchangeRates.js --fill-gaps
```

### Testing:
```
✅ WEB UI: Use "Dry Run Test" button in Exchange Rates tab
✅ CLI: node bulkImportExchangeRates.js --fill-gaps --dry-run
```

### ⚠️ **Legacy: Command Line Only (Backup/Development)**
```bash
# Only use these for development or emergency situations
node updateExchangeRates.js  # Deprecated - use web app instead
```

## Monitoring

The scripts provide detailed logging:
- ✅ Successful operations
- ⚠️ Warnings for missing data
- ❌ Errors with details
- 📊 Progress and statistics
- 🔄 API operations

## Dependencies

- Node.js with ES modules support
- Firebase Admin SDK
- Internet connection for API access
- Valid Firebase service account credentials
