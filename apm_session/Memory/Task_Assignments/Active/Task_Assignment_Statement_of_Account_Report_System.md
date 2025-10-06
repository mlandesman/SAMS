# Task Assignment: Statement of Account Report System

**Agent Assignment:** Implementation Agent - Report System Development  
**Priority:** Priority 8a - Statement of Account Report (Foundation for Complete Reporting System)  
**Estimated Effort:** 8-10 Implementation Agent sessions  
**Branch:** `feature/statement-account-report-system` (create new branch)

---

## 🎯 **PROJECT OVERVIEW**

Build a comprehensive Statement of Account Report system that serves as the foundation for SAMS' complete reporting platform. This system will generate professional, client-branded reports with payment status tracking, penalty visibility, and bilingual support.

### **Strategic Value**
- **First Report in Complete Reporting System** - Establishes architecture for all future reports
- **Client Branding Integration** - Professional representation of client properties
- **Google Sheets Replacement** - Eliminates manual report generation
- **Production-Ready** - Works for both MTC and AVII clients

---

## 📋 **REQUIREMENTS ANALYSIS**

### **Sample Report Analysis**
Based on analysis of two existing report formats:

**Prior Admin Report (AVII):**
- ✅ Clear separation of Maintenance vs Water Bills
- ✅ Dedicated penalty column
- ✅ Running balances per section
- ❌ Poor visual layout, cramped design
- ❌ Disconnected from daily accounting flow

**Current Google Sheets Report:**
- ✅ Clean, professional layout
- ✅ Consolidated chronological flow
- ✅ Single running balance
- ❌ Missing penalty visibility
- ❌ No subtotals for major categories
- ❌ Unnecessary charts for comprehensive reports

**Optimal Solution:** Hybrid approach combining best elements with enhanced payment status tracking.

---

## 🏗️ **SYSTEM ARCHITECTURE**

### **Reporting System Foundation**
Design a scalable architecture supporting multiple report types:

```
/reports/
├── /system/
│   ├── ReportEngine.js          # Core reporting engine
│   ├── ReportTemplates.js       # Template management
│   ├── ClientBranding.js        # Client branding system
│   └── PDFGenerator.js          # PDF generation service
├── /templates/
│   ├── StatementOfAccount.html  # Statement template
│   ├── base-template.html       # Base template with branding
│   └── styles/
│       ├── client-styles.css    # Client-specific styling
│       └── report-styles.css    # Report layout styles
└── /services/
    ├── StatementService.js      # Statement-specific logic
    ├── DataAggregator.js        # Data collection service
    └── EmailService.js          # Report delivery service
```

### **Client Branding System**
- **Logo Integration:** Retrieve client logos from Firebase Storage
- **Branding Consistency:** Apply client colors, fonts, and styling
- **Professional Representation:** Reports branded for client, emails from Sandyland
- **Template System:** Reusable branding components for all future reports

---

## 📊 **STATEMENT OF ACCOUNT SPECIFICATIONS**

### **Report Structure**

#### **1. Header Section**
```
┌─────────────────────────────────────────────────────────────┐
│ [CLIENT LOGO]                    STATEMENT OF ACCOUNT       │
│                                                             │
│ Unit Owner: [Name]                                         │
│ Unit: [Unit ID]                                            │
│ Statement Period: [Date Range]                             │
│ Generated: [Current Date]                                  │
└─────────────────────────────────────────────────────────────┘
```

#### **2. Payment Status Overview**
```
┌─────────────────────────────────────────────────────────────┐
│                    PAYMENT STATUS SUMMARY                   │
│                                                             │
│ Current Balance: $[Amount]                                 │
│ Credit Balance:  $[Credit Amount]                          │
│                                                             │
│ Status Summary:                                             │
│ • Paid: [Count] items, $[Total]                           │
│ • Past Due: [Count] items, $[Total] (Penalty: $[Amount])  │
│ • Coming Due: [Count] items, $[Total]                     │
└─────────────────────────────────────────────────────────────┘
```

#### **3. Detailed Transaction List**
```
┌─────────────────────────────────────────────────────────────┐
│                    TRANSACTION HISTORY                      │
│                                                             │
│ Date        Category              Notes           Due    Balance │
│ 07/01/2025  HOA Dues             Jul-Sep 2025   $1,200   $1,200 │
│ 07/15/2025  Water Consumption    July Usage     $150     $1,350 │
│ 08/01/2025  Late Fee Penalty     HOA Overdue    $60      $1,410 │
│ 08/15/2025  Payment Received     BBVA Transfer  -$1,200   $210  │
│ 08/20/2025  Payment Received     Cash Payment   -$210     $0    │
└─────────────────────────────────────────────────────────────┘
```

#### **4. Subtotals Section**
```
┌─────────────────────────────────────────────────────────────┐
│                         SUBTOTALS                           │
│                                                             │
│ HOA Dues/Maintenance Fees:        $[Amount]                │
│ Water Bills:                      $[Amount]                │
│ Other Charges:                    $[Amount]                │
│ Penalties Applied:                $[Amount]                │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│ GRAND TOTAL:                    $[Total Amount]            │
└─────────────────────────────────────────────────────────────┘
```

#### **5. Footer Section**
```
┌─────────────────────────────────────────────────────────────┐
│                         PAYMENT TERMS                       │
│                                                             │
│ • HOA Dues: Due within first month of quarter              │
│ • Water Bills: Due within 10 days of billing               │
│ • Late fees: 5% per month after grace period               │
│ • Payments applied first to penalties, then oldest charges │
│                                                             │
│ Questions? Contact: [Client Contact Info]                  │
└─────────────────────────────────────────────────────────────┘
```

### **Payment Status Indicators**
Replace charts with clear status indicators:

- **🟢 Paid** - Green indicator for completed payments
- **🔴 Past Due** - Red indicator for overdue amounts
- **🟡 Coming Due** - Yellow indicator for upcoming due dates
- **⚫ Overdue with Penalty** - Black indicator with penalty amount
- **💳 Credit Available** - Blue indicator for available credit balance

---

## 🔧 **TECHNICAL IMPLEMENTATION**

### **Data Sources**
- **HOA Dues:** `/hoadues/{clientId}/unit/{unitId}/{year}`
- **Water Bills:** `/water/clients/{clientId}/data/{year}`
- **Transactions:** `/transactions/{clientId}`
- **Client Info:** `/clients/{clientId}`
- **Client Logo:** Firebase Storage `/{clientId}/logo.png`

### **Key Functions Required**

#### **1. ReportEngine.js**
```javascript
class ReportEngine {
  constructor(clientId, reportType) {
    this.clientId = clientId;
    this.reportType = reportType;
    this.branding = new ClientBranding(clientId);
  }
  
  async generateReport(unitId, dateRange, options = {}) {
    // Core report generation logic
  }
  
  async applyBranding(template) {
    // Apply client-specific branding
  }
  
  async generatePDF(htmlContent) {
    // Convert HTML to PDF with branding
  }
}
```

#### **2. StatementService.js**
```javascript
class StatementService extends ReportEngine {
  async generateStatement(unitId, dateRange) {
    const data = await this.aggregateStatementData(unitId, dateRange);
    const template = await this.loadTemplate('StatementOfAccount');
    const brandedTemplate = await this.applyBranding(template);
    const html = await this.renderTemplate(brandedTemplate, data);
    return await this.generatePDF(html);
  }
  
  async aggregateStatementData(unitId, dateRange) {
    // Collect and organize all statement data
  }
  
  calculatePaymentStatus(transactions, currentDate) {
    // Determine payment status for each transaction
  }
}
```

#### **3. ClientBranding.js**
```javascript
class ClientBranding {
  constructor(clientId) {
    this.clientId = clientId;
  }
  
  async getClientLogo() {
    // Retrieve logo from Firebase Storage
  }
  
  async getClientBranding() {
    // Get client colors, fonts, styling preferences
  }
  
  applyBranding(template, brandingData) {
    // Apply client-specific styling
  }
}
```

### **API Endpoints Required**

#### **Statement Generation**
```
POST /reports/statement/{clientId}/generate
Body: {
  unitId: string,
  dateRange: {
    start: string,
    end: string
  },
  options: {
    language: 'en' | 'es',
    includeWaterBills: boolean,
    includeHoaDues: boolean
  }
}
Response: {
  success: boolean,
  reportId: string,
  downloadUrl: string,
  emailSent: boolean
}
```

#### **Email Delivery**
```
POST /reports/statement/{clientId}/email
Body: {
  reportId: string,
  recipientEmail: string,
  unitId: string
}
Response: {
  success: boolean,
  messageId: string
}
```

---

## 🌐 **BILINGUAL SUPPORT**

### **Language Implementation**
- **Template System:** Separate templates for English/Spanish
- **Dynamic Content:** All user-facing text in both languages
- **Data Localization:** Dates, currency, numbers in local format
- **User Preference:** Respect user's language preference

### **Translation Requirements**
- Report headers and labels
- Payment status indicators
- Payment terms and conditions
- Category names and descriptions
- Error messages and notifications

---

## 📧 **EMAIL INTEGRATION**

### **Email System Integration**
- **From Address:** Sandyland Properties (representing client)
- **Subject Line:** "Statement of Account - [Client Name] - Unit [Unit ID]"
- **Attachment:** PDF report with client branding
- **Body:** Professional email template with client branding

### **Email Template Structure**
```html
<div class="email-container" style="client-branding">
  <div class="header">
    <img src="[CLIENT_LOGO]" alt="[CLIENT_NAME]">
    <h1>Statement of Account</h1>
  </div>
  
  <div class="content">
    <p>Dear [OWNER_NAME],</p>
    <p>Please find attached your Statement of Account for Unit [UNIT_ID].</p>
    <p>Current Balance: $[BALANCE]</p>
    <p>Questions? Contact us at [CONTACT_INFO]</p>
  </div>
  
  <div class="footer">
    <p>Sandyland Properties<br>Managing [CLIENT_NAME]</p>
  </div>
</div>
```

---

## 🧪 **TESTING REQUIREMENTS**

### **Test Cases**
1. **MTC Client Statement Generation**
   - Generate statement for various units
   - Verify HOA Dues data accuracy
   - Test payment status indicators
   - Validate subtotals and totals

2. **AVII Client Statement Generation** (when data available)
   - Generate statement with Water Bills
   - Test penalty calculations
   - Verify bilingual support
   - Test email delivery

3. **Client Branding**
   - Test logo integration
   - Verify client-specific styling
   - Test email branding
   - Validate PDF generation

4. **Edge Cases**
   - Units with no transactions
   - Units with credit balances
   - Units with multiple penalties
   - Large transaction histories

### **Chrome DevTools Testing**
- Use MCP Chrome DevTools for UI testing
- Verify PDF generation quality
- Test email rendering
- Validate responsive design

---

## 📁 **FILE STRUCTURE**

### **New Files to Create**
```
backend/
├── routes/reports.js                    # Report API endpoints
├── services/
│   ├── ReportEngine.js                  # Core reporting engine
│   ├── StatementService.js              # Statement-specific logic
│   ├── ClientBranding.js                # Client branding system
│   └── PDFGenerator.js                  # PDF generation service
└── templates/
    ├── StatementOfAccount.html          # Statement template
    ├── base-template.html               # Base template
    └── styles/
        ├── client-styles.css            # Client-specific CSS
        └── report-styles.css            # Report layout CSS

frontend/sams-ui/src/
├── components/reports/
│   ├── StatementGenerator.jsx           # Statement generation UI
│   ├── ReportPreview.jsx                # Report preview component
│   └── EmailDelivery.jsx                # Email delivery interface
├── services/
│   ├── reportService.js                 # Frontend report service
│   └── statementAPI.js                  # Statement API calls
└── views/
    └── ReportsView.jsx                  # Reports management view
```

---

## 🎯 **SUCCESS CRITERIA**

### **Functional Requirements**
- ✅ Generate professional Statement of Account reports
- ✅ Apply client-specific branding and logos
- ✅ Display payment status indicators clearly
- ✅ Show penalties and subtotals accurately
- ✅ Support bilingual (English/Spanish) output
- ✅ Send branded emails with PDF attachments
- ✅ Work for both MTC and AVII clients

### **Technical Requirements**
- ✅ Scalable architecture for future reports
- ✅ Reusable branding system
- ✅ PDF generation with client styling
- ✅ Email integration with proper branding
- ✅ Chrome DevTools testing completed
- ✅ All tests passing

### **Quality Requirements**
- ✅ Professional appearance matching client branding
- ✅ Accurate financial calculations
- ✅ Clear payment status visibility
- ✅ Proper penalty tracking and display
- ✅ Responsive design for various screen sizes

---

## 🚀 **IMPLEMENTATION PHASES**

### **Phase 1: Foundation (Sessions 1-2)**
- Create reporting system architecture
- Implement ClientBranding system
- Set up PDF generation infrastructure
- Create base templates

### **Phase 2: Statement Logic (Sessions 3-5)**
- Implement StatementService
- Create data aggregation logic
- Build payment status indicators
- Implement subtotal calculations

### **Phase 3: UI and Integration (Sessions 6-7)**
- Create frontend report generation interface
- Implement email delivery system
- Add bilingual support
- Integrate with existing SAMS UI

### **Phase 4: Testing and Polish (Sessions 8-10)**
- Comprehensive testing with Chrome DevTools
- Client branding validation
- Edge case handling
- Performance optimization

---

## 📝 **DELIVERABLES**

1. **Complete Reporting System Foundation**
2. **Statement of Account Report Generator**
3. **Client Branding Integration**
4. **Email Delivery System**
5. **Bilingual Support**
6. **PDF Generation Service**
7. **Frontend UI Components**
8. **Comprehensive Test Suite**
9. **Documentation and User Guide**

---

## 🔗 **INTEGRATION POINTS**

### **Existing Systems**
- **Communications System:** Email delivery integration
- **Client Management:** Logo and branding data
- **HOA Dues System:** Transaction and payment data
- **Water Bills System:** Consumption and billing data
- **Authentication System:** User permissions and access

### **Future Reports**
- Monthly Transaction History Reports
- HOA Dues Update Reports
- Special Projects Reports
- Budget vs Actual Reports

---

**This task establishes the foundation for SAMS' complete reporting platform while delivering the critical Statement of Account Report functionality. The system will be production-ready, professionally branded, and extensible for all future reporting needs.**
