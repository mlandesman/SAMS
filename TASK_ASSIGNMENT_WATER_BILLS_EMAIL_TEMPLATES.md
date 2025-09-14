# Task Assignment: Water Bills Email Templates Implementation

**Date:** January 14, 2025  
**Assigned To:** Implementation Agent  
**Manager:** Manager Agent  
**Priority:** High  
**Phase:** 2B - Water Bills Payment Requests  

---

## Task Overview

Implement professional, bilingual water bills email templates for monthly payment requests. These templates will be significantly more complex than receipt emails, requiring conditional sections, detailed consumption breakdowns, and bilingual support.

## Acceptance Criteria ✅

### **Primary Deliverables**
1. **Enhanced emailConfigController.js** - Support bilingual templates with language parameter
2. **Water Bills HTML Templates** - Professional, mobile-responsive email templates (English & Spanish)
3. **Template Variable System** - Support for complex water bill data structures
4. **Conditional Logic** - Smart sections that appear/disappear based on bill content
5. **Integration Testing** - Verify templates work with existing email service

### **Quality Standards**
- Templates must match existing receipt email branding and styling
- Mobile-responsive design for all major email clients
- Clean, printable layout
- Professional business language appropriate for property management

---

## Technical Requirements

### **1. Bilingual Template Structure**
Update Firebase `emailTemplates` to support language-specific templates:

```
/clients/{clientId}/config/emailTemplates/
├── waterBills/
│   ├── body_en (English HTML template)
│   ├── body_es (Spanish HTML template)  
│   ├── subject_en (English subject line)
│   └── subject_es (Spanish subject line)
```

### **2. Enhanced Email Controller**
Modify `backend/controllers/emailConfigController.js`:

**New Function Signature:**
```javascript
async function getEmailConfig(clientId, templateType = 'receipt', language = 'en')
```

**Requirements:**
- Add language parameter support
- Fallback logic: Try `body_{language}` first, then `body_en`, then `body`
- Return appropriate template based on user's `preferredLanguage` setting
- Maintain backward compatibility with existing receipt templates

### **3. Template Variable System**
Support these water bill variables:

**Basic Information:**
- `__ClientLogoUrl__` - Client branding (already implemented)
- `__ClientName__` - Marina Turquesa, Aventuras Villas II, etc.
- `__UnitNumber__` - Unit identifier (B-105, etc.)
- `__BillingMonth__` - "July 2025" or "Julio 2025"
- `__DueDate__` - Properly formatted due date using Luxon
- `__ReadingDate__` - When meters were read

**Financial Data:**
- `__TotalAmountDue__` - Main amount with Mexican peso formatting
- `__CurrentMonthTotal__` - Current month charges only
- `__AdditionalChargesTotal__` - Past due + penalties + credit applied

**Consumption Details:**
- `__WaterConsumption__` - m³ consumed this month
- `__PriorMonthConsumption__` - m³ consumed last month (for comparison)
- `__ConsumptionDifference__` - Difference with + or - sign
- `__MeterStart__` - Prior reading with comma formatting
- `__MeterEnd__` - Current reading with comma formatting
- `__WaterCharge__` - Water consumption charge
- `__CarWashCount__` - Number of car washes (conditional)
- `__CarWashCharge__` - Car wash total charge (conditional)
- `__BoatWashCount__` - Number of boat washes (conditional)
- `__BoatWashCharge__` - Boat wash total charge (conditional)

**Additional Charges:**
- `__PastDueBalance__` - Outstanding balance (conditional)
- `__Penalties__` - Penalty charges (conditional)
- `__CreditApplied__` - Credit balance applied (conditional, negative number)

**Conditional Section Variables:**
- `__ShowCarWash__` - Boolean for car wash section visibility
- `__ShowBoatWash__` - Boolean for boat wash section visibility
- `__ShowAdditionalCharges__` - Boolean for additional charges section
- `__GracePeriodMessage__` - "Pay by due date to avoid penalties"

---

## Design Specifications

### **Email Layout Structure**

#### **Header Section (Always Visible)**
- Client logo and branding (reuse existing system)
- Professional title: "MARINA TURQUESA WATER BILL" / "FACTURA DE AGUA MARINA TURQUESA"
- Unit number and billing month
- **Prominent Total Amount Due** and Due Date
- Grace period messaging (static, no countdown)

#### **Current Month Charges Box**
- Water consumption details (meter readings, m³, charge)
- **Usage comparison**: "Last month: 15 m³, This month: 18 m³ (+3 m³)" 
- **Conditional sections** for car wash and boat wash (only if > 0)
- Current month total

#### **Additional Charges Box (Conditional)**
- Past due balance (only if > 0)
- Penalties (only if > 0) 
- Credit applied (only if negative balance exists, show as negative)
- Additional charges total
- **Entire section disappears if all values are 0**

#### **Action Buttons**
- [VIEW ACCOUNT STATEMENT] - Links to authenticated SAMS portal
- [BANK INFO] - Links to static `/bank-info` page (no authentication)

### **Styling Requirements**
- **Consistent with existing receipt emails** - Same fonts, colors, spacing
- **Ocean-to-sand gradient** for header/footer
- **Mobile-responsive** - Single column layout, touch-friendly buttons
- **Professional table styling** - Clean borders, good spacing
- **Amount prominence** - Total due should be highly visible

### **Conditional Logic Implementation**
```javascript
// Pseudocode for template processing
if (carWashCount > 0) {
  showCarWashSection = true;
  processVariable('__CarWashCount__', carWashCount);
  processVariable('__CarWashCharge__', carWashCharge);
}

if (boatWashCount > 0) {
  showBoatWashSection = true;
  // Similar processing
}

if (pastDueBalance > 0 || penalties > 0 || creditApplied < 0) {
  showAdditionalChargesSection = true;
}
```

---

## Integration Requirements

### **1. Email Service Integration**
Update `backend/controllers/emailService.js`:
- Support `templateType = 'waterBills'`
- Pass user's `preferredLanguage` to `getEmailConfig()`
- Process conditional variables properly
- Handle complex data structures from water bills system

### **2. Data Source Integration**
Templates must work with data from:
- **Water bills system** - `/scripts/bills.json` structure
- **User preferences** - `profile.preferredLanguage` field
- **Client configuration** - Existing logo/branding system

### **3. Date/Currency Formatting**
- **Use existing DateService.js** and Luxon for date formatting
- **Mexican peso formatting** - Standard currency format with commas
- **Bilingual dates** - "July 20, 2025" vs "20 de Julio, 2025"

---

## Testing Requirements

### **Test Cases to Implement**
1. **Simple bill** - Water only, no additional services or charges
2. **Complex bill** - Water + car wash + boat wash + past due + penalties
3. **Credit balance** - Bill with credit applied reducing total
4. **Zero additional services** - Verify car/boat wash sections disappear
5. **Bilingual testing** - Verify both English and Spanish templates
6. **Mobile responsiveness** - Test in Gmail mobile, Outlook mobile

### **Sample Data for Testing**
Use existing data from:
- `/scripts/bills.json` - Real bill structure
- `/AVIIdata/waterBills-config.json` - Configuration settings
- Test with both MTC and AVII client configurations

---

## File Modifications Required

### **Backend Files**
- `backend/controllers/emailConfigController.js` - Add bilingual support
- `backend/controllers/emailService.js` - Update for water bills processing

### **New Template Files** (Firebase Configuration)
- `/clients/MTC/config/emailTemplates/waterBills/body_en`
- `/clients/MTC/config/emailTemplates/waterBills/body_es`
- `/clients/MTC/config/emailTemplates/waterBills/subject_en`
- `/clients/MTC/config/emailTemplates/waterBills/subject_es`
- `/clients/AVII/config/emailTemplates/waterBills/` (same structure)

### **Testing Files**
- Create test script to verify template processing
- Email preview functionality for admin review

---

## Dependencies and Context

### **Existing Systems to Leverage**
1. **Email infrastructure** - Gmail SMTP, existing `emailService.js`
2. **Template processing** - Variable replacement system from receipts
3. **Branding system** - Logo integration, signature system
4. **Date services** - `DateService.js` and Luxon integration
5. **User preferences** - `preferredLanguage` field in user profiles

### **Key Files for Reference**
- `frontend/sams-ui/src/components/DigitalReceipt.jsx` - Current professional styling
- `frontend/sams-ui/src/components/DigitalReceipt.css` - Sandyland branding CSS
- `scripts/bills.json` - Water bill data structure
- `backend/controllers/emailService.js` - Current email processing

---

## Delivery Timeline

### **Phase 1: Foundation (Days 1-2)**
- Enhance `emailConfigController.js` for bilingual support
- Create basic template structure in Firebase
- Test bilingual template retrieval

### **Phase 2: Template Development (Days 3-4)**
- Create English HTML template with conditional sections
- Create Spanish HTML template
- Implement variable replacement for complex data

### **Phase 3: Integration & Testing (Day 5)**
- Update `emailService.js` for water bills support
- Create test scripts with sample data
- Cross-email-client testing

### **Phase 4: Review & Polish (Day 6)**
- Manager review and feedback incorporation
- Final testing and validation
- Documentation updates

---

## Future Integration Notes

### **User Dashboard Integration (Future Phase)**
These water bills templates will integrate with a future user dashboard featuring:
- **Water usage graphs** over time (monthly trends, seasonal patterns)
- **Wash service patterns** (car wash frequency, boat wash usage)
- **Payment behavior analytics** (typical days to pay, payment timing patterns)
- **Cost analysis** (monthly spending trends, conservation opportunities)
- **Comparative metrics** (usage vs. other similar units, efficiency ratings)

**Template Considerations for Dashboard:**
- Usage comparison data from templates will feed dashboard historical analysis
- Template variables should align with dashboard data structure
- Consider adding "View Usage History" button linking to future dashboard
- Ensure data collected supports future analytics requirements

---

## Success Metrics

### **Functional Success**
- ✅ Templates render correctly in Gmail, Outlook, Apple Mail
- ✅ Conditional sections show/hide based on bill content
- ✅ Bilingual support works for both languages
- ✅ Mobile responsiveness verified
- ✅ Integration with existing email system

### **Business Success**
- ✅ Professional appearance matching existing brand standards
- ✅ Clear, easy-to-read payment information
- ✅ Actionable buttons for account access and bank information
- ✅ Manager approval for production deployment

---

## Questions for Implementation Agent

1. **Template Storage Approach**: Should bilingual templates be stored as separate Firebase documents or as nested objects within a single document?

2. **Conditional Logic**: Prefer client-side (JavaScript in template) or server-side (processed before sending) conditional rendering?

3. **Testing Strategy**: Create dedicated test endpoint or integrate with existing email testing infrastructure?

4. **Error Handling**: How should system handle missing translations or malformed bill data?

5. **Performance Considerations**: Any concerns about template size or processing time for complex bills?

---

**Task Assignment Complete**  
**Next Step:** Implementation Agent should acknowledge task and begin Phase 1 development  
**Manager Available For:** Questions, clarifications, intermediate reviews, and final approval