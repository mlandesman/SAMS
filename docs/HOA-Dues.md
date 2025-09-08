# HOA Dues Handling

## Current Layout
* Google Sheet with a table containing columns of condo units and rows of months of the current year plus a Credit row at the top
* The header is a 3 line row
    1. Unit Owners Last Name
    2. Unit Number (alphanumeric)
    3. Amount of Scheduled Monthly Dues
* Rows below that are labeled Jan-YY through Dec-YY plus a Total row at the bottoms

![Screenshot 2025-06-03 at 7.54.23 AM](assets/Screenshot%202025-06-03%20at%207.54.23%E2%80%AFAM.png)


## Data Entry and Automation
1. Receive payment in cash or bank transfer
2. In modal, collect the payment method plus any notes to be applied
3. Determine first month in which to apply this payment as the first month not fully paid based on the Scheduled Monthly Dues amount
4. Retreive the Credit balance from the data store for this unit and add that to the amount received
5. Determine how many *full* months this amount will cover
6. Apply the *full* month payments starting in first available month
7. Apply the remaining amount back to the credit balance
8. Create a Transaction for the full deposit amount with the user's notes plus text describing how the money was applied from the automation steps (how much of the credit balance was used, what months were paid and how much was placed back in to credit balance)
9. Add those same notes to each Monthly payment in the table to display via a hover or touch action
10. Create a receipt and email to the owner's known email along with their updated Unit Report (defined later)
11. Create an auditLog of all actions


## Design Options for SAMS
The current system in Google Sheets has duplicate data; the data that is in the HOA Dues sheet plus the Transaction jounal entry.  They are connected via a unique sequence number key (YYnnnnn) that is generated during input.  This method allows for connecting the Transaction to the Dues Table and visa versa.  There is a danger of getting out of sync if one month is edited or the Transaction entry is changed. This is a violation of most accounting practices and should be fixed in SAMS.

In order to avoid disconnected data, there are a few options.

## Data Storage Options

### Dues payments stored in Transactions record
Since Firestore is based on *documents* and not a rigid database schema, we could have differing structures per Transaction document.  Documents in Category *HOA Dues* could have an array added as a field like *distribution* (or a better field name) that had:
```[
    {
        "month": 0,
        "amount": 500
    },
    {
        "month": 1,
        "amount": 3500
    },
    {
        "month": 2,
        "amount": 3500
    }
    {
        "month": 3,
        "amount": 3500
    }
]
```
Where month 0 was the credit balance amount and row 1 - 12 are the months applied.

#### Pros
* Since this would be stored in the Transaction record there would be no duplicate data or disconnect when editiing. One true source.
* The Edit Transaction function for HOA Dues category specifically would allow for adjustments to the distribution with a different modal screen.
* Method would work for Projects (aka Special Assessments) and other, future transaction-related splits.
* Retains history based on financial transaction and not the Unit as the Unit owner may change over time.
#### Cons
* Requires special handling based on (Category, Special Assessment, etc)
* Display of the current year HOA Dues will require querying the large transaction file based on year and Category then selecting by Unit ID and extracting the distribution array.

The HOA Dues context would just be the display of all units in the table format shown above in the screen shot.

### Dues payments stored with Units
The collection for units is `/clients/{clientID/units/{unitID}`.  Example: Unit 2B in Marina Turquesa Condominiums is `/clients/MTC/units/2B`

Inside this document there are many fields, some of which are collections.  Collections include emai: and owners.  The Scheduled Monthly Dues Owed is stored here as `duesAmount`. 

We could create the collection there in the same format as the Transactions option above and call is `dues`.

#### Pros
* Keeps the Dues Paid with the Dues Owed in the same document
* Easier to report on the Unit's status without traversing the Transactions collection
* The Credit Balance will have to be stored here anyway as there is not way to track that inside of the Transactions record.
* Would work for Special Assessments and Projects as well.
#### Cons
* Disconnects from the Transaction record allowing for duplicate entry/editing.  Would need to be controlled by the app to ensure records could not become disconnected.
* May become combersome over time.  Either creating a new array per year or continually growing the single array (only 12 elements per year plus the credit balance). `/clients/MTC/units/2B/dues/2025-01`, `clients/MTC/units/2B/dues/2025-02`

We can mitigate the disconnect by including the Transaction docId in the Dues collection.  That would allow the App to trace back through the Transactions and even to search from the Transaction collection into the Clients to find the applied funds.

