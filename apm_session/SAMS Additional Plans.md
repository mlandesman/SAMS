# SAMS (Sandyland Association Management System) – Implementation Plan Expansion Notes

**Last Modification:** Michael Landesman 21 September 2026
**Project Overview:** Expansion to and Enhancement of the existing SAMS Implementation Plan

## ✅ CURRENT STATUS

### Existing Features of SAMS
    * User Authentication 
    * Multiclient support 
    * Transactions with full CRUD
    * Split Transactions
    * HOA Dues / Maintenance Fees working for Monthly billing
    * Water Bills desktop UI
    * Water Bills Penalty Calculations and Past Due code
    * Water Bills module for PWA (not integrated into app)
    * Email services working
    * Digital Receipt code working but not integrated
    * List Management working for all by Clients


## 🧑🏻‍💻 ENHANCEMENTS NEEDED
**Feature**: Late Fee Penalties for HOA Dues/Maintenance Fees
**Status:** Penalty Calculator module is build for Water Bills but need to be extended to other modules
**Scope:** Some clients have Penalties for late payments based on a grace period, a due date and a penalty percentage to apply in a compound method. The penalty fee calculations used in Water Bills will be used to calculate the penalties for HOA Dues (Maintenance Fees) with a different grace period.

**Feature**: Mobile App for Workers
**Status:** PWA app built but need refactor to match updated DB structure and endpoints
**Scope:** Small PWA app that is only available to uses of role "maintenance" and assigned to the specific client. The Water Meter Reading screen has been developed and tested successfully but not integrated into a PWA app yet.  The Propane Tank Meter Reading module can be modeled on the Water Meter Reading module.  The Propane Tank system has not been built and will require client/config settings for tanks, a collection into which to store the readings (projects/propaneTanks) and all of the related code.  There is no billing for propane tanks so just the Readings (% of tank remaining) and history tabs are needed, not Bills.

**Feature**: Digital Receipts for Payments
**Status:** Digital Receipts were coded and complete in some modules but not moved from "demo" to production mode.
**Scope:** Receipts to be sent by email for payments made

**Feature**: Integration of WhatsApp Business to the Comm Module
**Status:** Not Started but information from WhatsApp Business and Twilio is available.
**Scope:** Add the communucations module the ability to send bilingual text messages with attachments to owners/managers.

**Feature**: 
**Status:** 
**Scope:**


## 🇲🇽 NEW FEATURES REQUESTED
**Feature**: 
**Scope:**

**Feature**: Report Generator (pre-defined)
**Scope:** To move to production we have to replace several reports that are currently run on Google Sheets with heavy automation.
*     1. State of Account Unit Report (for unit owners/managers)
* *         1. Balance Due/Credit Balance
* *         2. YTD Transactions
* *         3. Water Trend Report (clients with Water Bills)
* *         4. Propane Tank Status Report (clients with Propane Tanks)
*     2. Budget vs Actual Graph
*     3. HOA Dues Report
*     4. Monthly Account Report
*     5. Past Due Notice
*     6. Monthly Status Report
*     7. Report for Accountants (monthly)

**Feature**: Budgets
**Scope:** Need a structure and data entry system to add budget values for each Category

**Feature**: Task Manager / Calendar Service
**Scope:** Assign repetetive tasks to users of type "maintenance" with dates and URLs to PWA data entry screens.  System needs push communications to inform the user of the take and a receipt once the data has been received into SAMS.  Integrating into a Calendar function will help visualize and assign tasks per client, per user.

**Feature**: Mobile PWA App for Users
**Scope:**

**Feature**: Voting/Polling
**Scope:** Ability to submit to the board, owners and/or managers options for voting on.  Will track who has received the poll and the responses.  Options for anonymous voting is helpful but not necessary.  Available via PWA and Desktop with results stored and reviewable/reportable. Document attachments is a requirement for quotes/bids and images.

**Feature**: General Configuration Editor
**Scope:** We have many configuration collections, documents and fields that do not need individual, domain-based editing screens.  A generic tool to edit list all collections that have config data, select a document and edit whatever contents it holds is needed if possible.


## 🛠️ TECHNICAL DEBT
**MODULE/FEATURE:** Client Selector
**DEBT:** Logo does not appear
**Scope:** The modal is supposed to read the client's logo and description from the clients document and display on the selector.  It worked before but does not work now.  May be a link to the documents ID in Firestore or a code issue.

**MODULE/FEATURE:** ExchangeRate in Dev
**DEBT:** ExchangeRates in Dev need data from Prod
**Scope:** The production system runs a cloud script at night to download the currency exchange rates but the Dev system cannot run nightly scripts.  Desired workaround is to have the Production nightly function push the data to the Dev Firebase db.
**Impact** The Dev system posts console log errors every time it looks for an exchange rate which is very frequently cluttering the logs.

**MODULE/FEATURE:** Water Bills Dashboard and Cache
**DEBT:** We had the Water Bills loading data at the Dashboard and initializing the cache from there but during maintenance of the Water Bills code we turned off the cache.
**Scope:** Re-enable cache and update the Water Bills dashboard card to use the new structure.

**MODULE/FEATURE:** Year-End Processing
**DEBT:** No method for closing a fiscal year and opening a new year.
**Scope:** 
1. Build new fiscal year files
2. Create Year-End Balance Report
3. Create Year-End Report for owners and accountants
4. Carrry over balances including unit credit balances and past due amounts with penalties

**MODULE/FEATURE:** Special Projects
**DEBT:** Extra Activity Item not needed
**Scope:** Each special project will get it's own Activity (Water Bills, Propane Tanks, etc) so we can remove this Activity option

**MODULE/FEATURE:** 
**DEBT:**
**Scope:** 

**MODULE/FEATURE:** 
**DEBT:**
**Scope:** 

**MODULE/FEATURE:** 
**DEBT:**
**Scope:** 

