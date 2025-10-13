# Centralized Data Management Pattern for SAMS

## Overview

This document defines the standard pattern for managing cached data in SAMS to prevent excessive API calls and ensure consistent data across components.

## Problem Statement

When multiple React components independently call the same API endpoint, it results in:
- **Excessive API calls** (e.g., 20+ calls for a simple page load)
- **Inconsistent data** across components
- **Poor performance** due to redundant network requests
- **Increased server load** from duplicate requests

## Solution: Centralized Data Management

### Pattern Structure

```
Context Provider (Single Source of Truth)
├── Makes ONE API call when data is needed
├── Caches data in React state
├── Provides data to all child components
└── Handles cache invalidation and refresh

Child Components
├── Read data from context (no direct API calls)
├── Trigger refresh actions through context
└── React to context data changes
```

### Implementation Steps

#### 1. Create/Enhance Context Provider
```javascript
// Example: WaterBillsContext.jsx
export function WaterBillsProvider({ children }) {
  const [waterData, setWaterData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Single data fetch function
  const fetchWaterData = async (year) => {
    if (!selectedClient || !year) return;
    
    setLoading(true);
    try {
      const response = await waterAPI.getAggregatedData(selectedClient.id, year);
      setWaterData(response?.data || {});
    } catch (error) {
      setError('Failed to load water data');
      setWaterData({});
    } finally {
      setLoading(false);
    }
  };

  // Cache invalidation
  const refreshData = async () => {
    await fetchWaterData(selectedYear);
  };

  return (
    <WaterBillsContext.Provider value={{
      waterData,
      loading,
      error,
      refreshData,
      fetchWaterData
    }}>
      {children}
    </WaterBillsContext.Provider>
  );
}
```

#### 2. Remove Direct API Calls from Components
```javascript
// ❌ BEFORE: Component makes direct API call
const WaterBillsList = () => {
  const [yearData, setYearData] = useState({});
  
  useEffect(() => {
    const fetchData = async () => {
      const response = await waterAPI.getAggregatedData(clientId, 2026);
      setYearData(response.data);
    };
    fetchData();
  }, []);

  return <div>{/* render data */}</div>;
};

// ✅ AFTER: Component reads from context
const WaterBillsList = () => {
  const { waterData, loading } = useWaterBills();
  
  if (loading) return <div>Loading...</div>;
  
  return <div>{/* render waterData */}</div>;
};
```

#### 3. Provide Specialized Data Accessors
```javascript
// Context provides computed/derived data
const WaterBillsContext = createContext();

export const useWaterBills = () => {
  const context = useContext(WaterBillsContext);
  if (!context) {
    throw new Error('useWaterBills must be used within WaterBillsProvider');
  }
  return context;
};

// Specialized hooks for specific data needs
export const useWaterBillsForYear = (year) => {
  const { waterData, loading, fetchWaterData } = useWaterBills();
  
  useEffect(() => {
    if (year && !loading) {
      fetchWaterData(year);
    }
  }, [year]);
  
  return { data: waterData, loading };
};

export const useWaterBillsConfig = () => {
  const { waterData } = useWaterBills();
  return {
    carWashRate: waterData?.carWashRate,
    boatWashRate: waterData?.boatWashRate,
    units: waterData?.months?.[0]?.units ? Object.keys(waterData.months[0].units) : []
  };
};
```

## Data Types That Should Use This Pattern

### Currently Implemented
- ✅ **HOA Dues**: `HoaDuesContext` - manages dues data and transactions
- ✅ **Water Bills**: `WaterBillsContext` - manages aggregated water data

### Should Be Implemented
- 🔄 **Exchange Rates**: `ExchangeRatesContext` - current rates, historical data
- 🔄 **Unit/Owner Data**: `UnitsContext` - unit configurations, owner information  
- 🔄 **Client Configuration**: `ClientConfigContext` - billing configs, settings
- 🔄 **Transaction History**: `TransactionsContext` - payment history, transaction data

## Benefits

### Performance
- **Reduced API calls**: From 20+ calls to 1-2 calls per page load
- **Faster loading**: Data fetched once, shared across components
- **Better caching**: Centralized cache management

### Consistency
- **Single source of truth**: All components read same data
- **Synchronized updates**: Changes propagate to all components
- **Predictable state**: Clear data flow and state management

### Maintainability
- **Centralized logic**: API calls and error handling in one place
- **Easier debugging**: Single point of data fetching
- **Consistent patterns**: Same approach across all data types

## Migration Checklist

When implementing this pattern for new data types:

### Context Setup
- [ ] Create context provider with state management
- [ ] Implement single data fetch function
- [ ] Add loading and error states
- [ ] Provide cache invalidation methods

### Component Updates
- [ ] Remove direct API calls from components
- [ ] Update components to use context data
- [ ] Add loading states where needed
- [ ] Test data consistency across components

### Testing
- [ ] Verify reduced API calls in network tab
- [ ] Test data consistency across components
- [ ] Verify proper loading states
- [ ] Test cache invalidation and refresh

## Implementation Priority

### Phase 1: Water Bills (Current)
- [ ] Refactor existing components to use centralized data
- [ ] Document the pattern with Water Bills as example
- [ ] Measure API call reduction

### Phase 2: Exchange Rates
- [ ] Create `ExchangeRatesContext`
- [ ] Migrate exchange rate components
- [ ] Implement automatic refresh for current rates

### Phase 3: Unit/Owner Data
- [ ] Create `UnitsContext`
- [ ] Migrate unit management components
- [ ] Implement owner data caching

### Phase 4: Other Data Types
- [ ] Apply pattern to remaining data types
- [ ] Create reusable context patterns
- [ ] Implement cross-context data dependencies

## Code Standards

### Context Naming
- Context: `{DataType}Context` (e.g., `WaterBillsContext`)
- Provider: `{DataType}Provider` (e.g., `WaterBillsProvider`)
- Hook: `use{DataType}` (e.g., `useWaterBills`)

### File Structure
```
src/context/
├── {DataType}Context.jsx     # Main context definition
├── use{DataType}.js          # Custom hooks
└── {DataType}Provider.jsx    # Provider component (if separate)
```

### Error Handling
- Always provide error states in context
- Implement retry mechanisms for failed requests
- Log errors for debugging
- Provide user-friendly error messages

## Examples

See existing implementations:
- `frontend/sams-ui/src/context/WaterBillsContext.jsx`
- `frontend/sams-ui/src/context/HoaDuesContext.jsx` (if exists)

---

**This pattern should be the standard for all cached data in SAMS to ensure optimal performance and maintainable code.**
