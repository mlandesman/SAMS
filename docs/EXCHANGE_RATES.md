# Exchange Rates System Documentation

## Overview
The SAMS exchange rates system fetches and stores daily exchange rates for MXN to USD, CAD, EUR, and COP. The system has been modernized to use on-demand fetching with backend API integration to resolve CORS issues.

## Architecture

### Backend API (NEW - CORS Resolution)
- **Backend Controller**: `backend/controllers/exchangeRatesController.js`
- **Backend Routes**: `backend/routes/exchangeRates.js`
- **Endpoints**:
  - `GET /api/exchange-rates/check` - Check if today's rates exist
  - `POST /api/exchange-rates/fetch` - Fetch and store rates from external APIs

### Frontend Integration
- **Service**: `frontend/sams-ui/src/utils/exchangeRates.js` - Calls backend API (no external calls)
- **Hook**: `frontend/sams-ui/src/hooks/useExchangeRates.js` - Manages modal state
- **Modal**: `frontend/sams-ui/src/components/ExchangeRateModal.jsx` - User feedback

## CORS Resolution
**Critical Fix**: The system was redesigned to resolve CORS issues when calling external APIs directly from the browser. External API calls (Banxico and Colombian government) are now handled by the backend, which has no CORS restrictions. The frontend only communicates with the local backend API.

Location: `/frontend/sams-ui/src/components/ExchangeRateModal.jsx`

The modal component:
- Shows updating, success, or error states
- Provides user feedback during rate fetching
- Auto-closes after 2 seconds on success, 5 seconds on error

## Triggering Exchange Rate Checks

The system performs frequent lightweight checks at these trigger points:

1. **User Login**: When authentication completes and a client is selected
2. **Client Change**: When switching between clients  
3. **Transactions Load**: When the transactions view loads data

These checks only fetch new rates if:
- Today is a business day (Monday-Friday)
- No exchange rates exist for today's date
- The check hasn't failed (to avoid repeated API calls)

## Development Setup

No special setup is required. The exchange rate system works entirely within the frontend application and directly connects to external APIs and Firestore.

## Data Structure

Exchange rates are stored in Firestore with the following structure:

```
/exchangeRates/{YYYY-MM-DD} = {
  USD: 17.3456,  // MXN to USD rate
  CAD: 12.8901,  // MXN to CAD rate  
  EUR: 18.7234,  // MXN to EUR rate
  COP: 0.00456,  // MXN to COP rate
  timestamp: Timestamp,
  lastUpdated: "2025-06-11T14:30:00.000Z"
}
```

## API Sources

### Banxico API
- **Endpoint**: `https://www.banxico.org.mx/SieAPIRest/service/v1/series/`
- **Series IDs**: 
  - USD: SF43718 (USD to MXN)
  - CAD: SF60632 (CAD to MXN)
  - EUR: SF46410 (EUR to MXN)
- **Authentication**: Token-based (stored in service)

### Colombian Government API
- **Endpoint**: `https://www.dian.gov.co/descargas/KitContribuyente/ContenidoXML/`
- **Format**: XML TRM data
- **Rate**: USD to COP (converted to MXN to COP using USD rate)

## Testing 

To test the exchange rate system:

1. **Manual trigger**: Call `checkAndUpdateRates()` from the React hook
2. **Clear existing rates**: Delete today's document from Firestore to force a fetch
3. **Monitor console**: Watch for exchange rate check and fetch logs
4. **Check modal**: Verify the modal appears during updates

## Troubleshooting

If exchange rates are not being fetched:

1. **Check console logs**: Look for exchange rate check messages
2. **Verify business day**: System only fetches on weekdays
3. **Check Firestore**: Verify today's document doesn't already exist
4. **API connectivity**: Ensure Banxico and Colombian APIs are accessible
5. **Modal visibility**: Check if modal appears during attempted updates

1. Check if the DOF website structure has changed
2. Verify the emulators are running
3. Check the function logs in the emulator UI
4. Ensure the proper ports (8001, 8080, 4000) are available

## Future Extensions

The system is designed to be extensible to other currencies in the future.
