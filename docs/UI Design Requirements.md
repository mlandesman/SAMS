# **UI Design Elements**

# **Users**

1. Admin/Management/Staff  
   1. Access Control through Google Domain Log In (landesman.com/sandyland.com.mx)  
   2. Primarily focused on desktop, larger screens with more content and full keyboard  
   3. Data Entry focused on mobile devices  
   4. No need to make detailed outputs available on smaller screens  
2. External Users  
   1. Primarily mobile, smaller screen access  
   2. Limited output of specific screens for personal use  
   3. No data entry or modification (must request that from Admin)

# **Inputs**

1. All existing collections CRUD  
   1. Unit management  
   2. Vendor management  
   3. Category management  
   4. Users management (external access control for client access)  
2. New Contacts (not yet Clients)  
   1. CRM-style details  
3. Deposits  
   1. Associations  
      1. HOA Dues  
      2. Special Assessment Fees  
   2. Owners  
      1. Expense Reimbursement  
      2. Prepay/Future Funding on deposit  
4. Expenses  
   1. Associations  
      1. All Categories collection under that Association  
   2. Owners  
      1. All Categories collection under that Owner  
5. Cash and Bank Adjustments  
6. Budgets  
   1. Plan for each Category per year or per month by Association and Owner  
7. Projects  
   1. Proposed/Future Projects  
   2. Current Project (moved from Proposed status)  
   3. Completed Projects (moved from Current status)  
   4. Project Payments made

# **Outputs (ALWAYS filtered by {clientId})**

1. On Screen  
   1. Dashboard  
      1. Account balances (cash and bank, if available)  
      2. High-level status summary of past-due payments from owners  
      3. Status of Current Project(s)  
      4. Status of Actuals vs Budget  
      5. Current DOF rate (from DOF website or Google Sheet via API)  
      6. Upcoming Expenses Due or past-due  
      7. YTD Graphs (Expenses only in a pie chart with clickable labels)  
   2. HOA Dues grid (see Sheets image when ready)  
   3. Special Assessments grid (see Sheets image when ready)  
   4. Current Projects Payments made by Project with balance due  
   5. Transaction Journal with filters and searching  
      1. current month  
      2. prior month  
      3. prior 3 months  
      4. prior year  
      5. YTD  
      6. ALL  
   6. Budget vs Actual for % of the current year  
   7. Unit Report (see Sheets image when ready)  
2. Report  
   1. Data-ranged Cash report for balancing  
   2. Data-ranged Bank report for balancing  
3. Audit  
   1. Audit log filtered by fields (data range, module, action, etc)  
4. Electronic (email/WhatsApp)  
   1. Unit Reports (from Admin and External User log ins, ie; push or pull)  
   2. Digital Receipt (from Admin following all Deposits)  
   3. Monthly Status report data sent to a Google Docs or Gmail template with placeholders

# **UI Layout Standards (Updated June 2025)**

## **List Management Interface Standard**
All list management screens (Vendors, Categories, Payment Methods, Units, etc.) follow this standardized layout:

### **Layout Structure**
1. **ActionBar (Top)**: Dark green header with action buttons
   - Add New (plus icon)
   - Edit (pencil icon) - requires selection
   - Delete (trash icon) - requires selection  
   - View Details (eye icon) - requires selection
2. **Tabs (Below ActionBar)**: Different list types when multiple lists available
3. **Data Table (Center)**: Clean table with no row-level action buttons
4. **StatusBar (Bottom)**: Consistent across all views
   - Date/time (left)
   - Module-specific status (center) - e.g., "🔍 Entries (n)" for lists
   - Connection status (right)

### **Interaction Model**
- **Single-click**: Select row (highlights row)
- **Double-click**: Open detail view modal
- **No row-level buttons**: All actions through ActionBar
- **Real-time search**: Via magnifying glass icon in status bar
- **Real-time count**: Shows filtered item count in status bar

### **StatusBar Architecture**
- **Modular Design**: Each module publishes its own status information
- **Context Isolation**: Module contexts stay scoped, status shared via StatusBarContext
- **Future-Ready**: New modules (Budgets, Projects) follow same pattern
- **Example**: `setStatusInfo({ type: 'budgets', budgetCount: 12, currentBudget: 'Q4 2025' })`

## **Design Consistency Rules**
1. **All list screens** must follow the ActionBar → Tabs → Table → StatusBar layout
2. **No row-level action buttons** - actions only in ActionBar
3. **Double-click for details** - consistent interaction model
4. **StatusBar integration** - every module should publish appropriate status info
5. **Search integration** - GlobalSearch component filters list data in real-time