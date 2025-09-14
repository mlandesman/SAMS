# SAMS Troubleshooting Guide
*Solutions to common problems and errors*

## 🔴 Emergency Contacts

- **Production Down**: Contact Michael immediately
- **Data Loss Risk**: STOP and create backup first
- **Security Breach**: Isolate system, contact Michael
- **Can't Solve**: Check this guide, then ask for help

---

## Common Errors and Solutions

### 1. Module/Import Errors

#### Error: "Cannot find module" or "require is not defined"
```
Error: Cannot find module '../controllers/userController'
ReferenceError: require is not defined
```

**Cause**: Using CommonJS instead of ES6 modules

**Solution**:
```javascript
// ❌ WRONG - CommonJS
const controller = require('../controllers/userController');
module.exports = { myFunction };

// ✅ CORRECT - ES6 Modules
import controller from '../controllers/userController.js';
export const myFunction = () => {};
```

#### Error: "Module not found: Can't resolve"
```
Module not found: Error: Can't resolve './utils/timezone'
```

**Cause**: Missing .js extension in import

**Solution**:
```javascript
// ❌ WRONG
import { normalizeDate } from './utils/timezone';

// ✅ CORRECT - Include .js extension
import { normalizeDate } from './utils/timezone.js';
```

---

### 2. Authentication/Authorization Errors

#### Error: "401 Unauthorized"
```json
{
  "error": "No valid authorization token provided"
}
```

**Cause**: Missing or invalid authentication token

**Solution**:
1. For testing, use testHarness.js:
```javascript
// Don't make direct API calls
// Use the test harness which handles auth
await testHarness.runTests(tests);
```

2. For frontend, ensure token is included:
```javascript
const response = await fetch(url, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

#### Error: "403 Forbidden - Access denied to this client"
```json
{
  "error": "Access denied to this client",
  "code": "CLIENT_ACCESS_DENIED"
}
```

**Cause**: User doesn't have access to the specified client

**Solution**:
1. Check user's clientAccess in Firebase Console
2. Grant access if needed:
```javascript
// In users collection, add clientAccess
clientAccess: {
  "AVII": {
    role: "admin",
    active: true
  }
}
```

---

### 3. Date/Time Issues

#### Problem: Date saves as previous day
**Symptom**: Enter "January 1, 2025" but it saves as "December 31, 2024"

**Cause**: Timezone not normalized to America/Cancun

**Solution**:
```javascript
// ❌ WRONG - Raw date
const date = new Date(userInput);

// ✅ CORRECT - Always normalize
import { normalizeDate } from '../utils/timestampUtils.js';
const date = normalizeDate(userInput);
```

#### Problem: "This Month" filter shows wrong dates
**Cause**: Filter not using normalized dates

**Solution**:
```javascript
import { getMexicoDate } from '../utils/timezone.js';

const today = getMexicoDate();
const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
```

---

### 4. Water Bills Issues

#### Error: "testHarness.runSuite is not a function"
```
TypeError: testHarness.runSuite is not a function
```

**Cause**: Wrong method name

**Solution**:
```javascript
// ❌ WRONG - This method doesn't exist
await testHarness.runSuite(tests);

// ✅ CORRECT - Use runTests
await testHarness.runTests(tests);
```

#### Problem: Water bills not calculating correctly
**Cause**: Not using correct rate or penalty calculation

**Solution**:
```javascript
// Rate is 50 MXN per cubic meter (stored as 5000 cents)
const rate = 5000; // cents
const consumption = currentReading - previousReading;
const charge = consumption * rate;

// Penalties are 5% compound monthly
const monthsLate = calculateMonthsLate(dueDate);
const penalty = charge * (Math.pow(1.05, monthsLate) - 1);
```

---

### 5. Database/Firebase Issues

#### Error: "permission-denied" from Firestore
```
Error: Missing or insufficient permissions
```

**Cause**: Firestore security rules blocking access

**Solution**:
1. Check if user is authenticated
2. Verify client access permissions
3. Check Firestore rules in Firebase Console

#### Problem: Data not saving to database
**Cause**: Often missing required fields or wrong data types

**Solution**:
```javascript
// Check all required fields
const requiredFields = ['amount', 'date', 'type', 'vendorId'];
const missingFields = requiredFields.filter(field => !data[field]);

if (missingFields.length > 0) {
  throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
}

// Ensure correct data types
data.amount = parseInt(data.amount); // Must be integer (cents)
data.date = Timestamp.fromDate(normalizeDate(data.date)); // Must be Timestamp
```

---

### 6. UI/Frontend Issues

#### Problem: List Management not highlighting selected row
**Cause**: Known issue in HIGH-001

**Current Status**: Open issue, needs fix

**Workaround**: Check Firebase Console to verify which record you're editing

#### Problem: Payment methods showing inactive options
**Cause**: Not filtering by status

**Solution**:
```javascript
// Filter for active payment methods only
const activePaymentMethods = paymentMethods.filter(pm => pm.status === 'active');
```

#### Problem: Client logos not appearing
**Cause**: Upload successful but URL not connected to display

**Solution**: Check that the logo URL is being retrieved and rendered:
```javascript
// In client selector component
const logoUrl = client.logo || '/default-logo.png';
<img src={logoUrl} alt={client.name} />
```

---

### 7. Deployment Issues

#### Error: "sams-deploy: command not found"
**Status**: ❌ CLI is BROKEN - DO NOT USE

**Solution**: Deploy manually:
```bash
# Frontend deployment (Vercel)
npm run build:prod
vercel --prod

# Backend deployment
firebase deploy --only functions
```

#### Problem: Changes not appearing in production
**Cause**: CDN caching (1-hour cache)

**Solution**:
1. Wait for cache to expire
2. Or force cache clear in Vercel dashboard
3. Add cache-busting query parameter for testing

---

### 8. Development Environment Issues

#### Error: "EADDRINUSE: address already in use :::5001"
**Cause**: Port already in use by another process

**Solution**:
```bash
# Find and kill the process
lsof -i :5001
kill -9 [PID]

# Or use a different port
PORT=5002 npm run dev:backend
```

#### Problem: Environment variables not loading
**Cause**: Missing or incorrectly named .env file

**Solution**:
```bash
# Ensure file is named correctly
.env.local          # for frontend (Vite)
.env                # for backend

# Check file location (should be in root directories)
/frontend/sams-ui/.env.local
/backend/.env
```

---

## Reserved Words to Avoid

These JavaScript reserved words CANNOT be used as function names:

```javascript
// NEVER use these as function names:
delete, class, const, export, import, return, 
function, var, let, if, else, switch, case, 
default, break, continue, for, while, do, 
try, catch, finally, throw, new, this, super
```

**Example of catastrophic failure**:
```javascript
// ❌ This crashed production on July 5-6
export const delete = async (req, res) => { };

// ✅ Use descriptive names instead
export const deleteTransaction = async (req, res) => { };
export const removeItem = async (req, res) => { };
```

---

## Performance Issues

### Problem: Slow page load
**Common Causes**:
1. Too many Firestore reads
2. Missing indexes
3. Large bundles

**Solutions**:
```javascript
// 1. Batch reads where possible
const batch = await Promise.all([
  getTransactions(clientId),
  getUnits(clientId),
  getVendors(clientId)
]);

// 2. Add composite indexes in Firebase Console
// Check console for index creation links

// 3. Implement pagination
const pageSize = 50;
const query = collection.limit(pageSize).startAfter(lastDoc);
```

### Problem: Memory leaks
**Common Cause**: Unsubscribed Firestore listeners

**Solution**:
```javascript
// Always unsubscribe from listeners
useEffect(() => {
  const unsubscribe = firestore
    .collection('transactions')
    .onSnapshot(handleUpdate);
  
  return () => unsubscribe(); // Clean up
}, []);
```

---

## Data Integrity Issues

### Problem: Balances don't match
**Cause**: Transactions not properly updating account balances

**Solution**:
```javascript
// Recalculate balances from transaction history
const recalculateBalance = async (accountId) => {
  const transactions = await getAccountTransactions(accountId);
  const balance = transactions.reduce((sum, tx) => {
    return tx.type === 'income' 
      ? sum + tx.amount 
      : sum - tx.amount;
  }, 0);
  
  await updateAccountBalance(accountId, balance);
};
```

### Problem: HOA dues payments not reflected
**Cause**: Payment not properly linked to dues record

**Solution**: Ensure transactionId is stored in dues record:
```javascript
// When recording HOA payment
const duesPath = `units/${unitId}/dues/${year}`;
await updateDoc(duesPath, {
  [`months.${month}.paidAmount`]: amount,
  [`months.${month}.paidDate`]: new Date(),
  [`months.${month}.transactionId`]: transactionId,
  [`months.${month}.status`]: 'paid'
});
```

---

## When All Else Fails

### Debugging Checklist
1. ✓ Check browser console for errors
2. ✓ Check network tab for failed requests
3. ✓ Verify authentication token is valid
4. ✓ Check Firebase Console for data
5. ✓ Review recent code changes
6. ✓ Test in isolation with testHarness.js
7. ✓ Check if issue exists in production
8. ✓ Review similar working code

### Getting More Help
1. **Search** existing code for similar patterns
2. **Read** the lessons learned document
3. **Check** if it's a known issue in 08_OPEN_ISSUES
4. **Test** with minimal reproduction case
5. **Document** the exact error and steps to reproduce
6. **Ask** with full context and error details

### Emergency Rollback
```bash
# If you broke production
git log --oneline -10          # Find last working commit
git checkout [commit-hash]      # Go to working version
npm run build:prod              # Rebuild
vercel --prod                   # Deploy rollback

# Then fix the issue in a new branch
git checkout main
git checkout -b fix/emergency-fix
```

---

## Prevention Tips

1. **Always test with testHarness.js** before deploying
2. **Use utility functions** for dates, money, fiscal year
3. **Follow the patterns** in existing code
4. **Make small changes** and test frequently
5. **Read error messages carefully** - they usually tell you exactly what's wrong
6. **Check the data in Firebase Console** to understand what's actually happening
7. **Don't assume** - verify your assumptions with console.log or debugger

Remember: Most issues have been encountered before. Check the Lessons Learned document and this troubleshooting guide first!