/* Google AppsScript code to handle HOA Dues payments.
        This code is called via an onEdit that ensures we are on the HOA Dues sheet first
        and then that we are in the table area based on a predefined range.

        If then takes the amount entered into that cell and processes it
        according to the specific instructions for money distribution.
        See "HOA_Dues_Implementation.md"

        Functions called here that are not included inthis document are:

        addDuesPaidRowFromParams() // takes the data passed and write it to the transaction log
        SLPutils.numberToMXN() // takes in a number and returns currency formatted string with MXN as the suffix
        generateSeqNum() // equivalent to a transaction ID in SAMS (a unique identifier between HOA and Transactions)
        makeReceipt() // passes data to a sheet that creates a digital receipt to be emailed.  This will be created later in SAMS
        alertPopUp() // utility wrapper for toast command

        The key to this whole thing is the calculatePayments() function that figures out how
        much credit to add, how many months can be paid in full and how much credit to put
        back into the Unit's account.
*/


/**
 * Unified handler to post HOA Dues from manual edit or Google Form submission.
 * Locates the correct unit column and first unpaid row, applies payments, updates
 * credit, posts transactions, and generates a receipt.
 *
 * @param {string} unitHOA - Unit ID (e.g., "PH4D")
 * @param {number} amtPaid - Total payment received
 * @param {string} [paymentMethod] - Payment method ("MTC Bank" or "Cash")
 * @param {string} [note] - Optional free-text note
 * @param {GoogleAppsScript.Spreadsheet.Range} [editCell] - Cell edited (only for onEdit)
 */
function addDuesPaidRowFromParams(unitHOA, amtPaid, paymentMethod, note, editCell) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("HOA Dues");
  const firstMonthRow = 5;
  const unitRow = 2;

  Logger.log('--- addDuesPaidRowFromParams ---');
  Logger.log(`Unit: ${unitHOA}, Amount: ${amtPaid}, Method: ${paymentMethod}, Note: ${note}`);

  let cell = editCell;
  if (!cell) {
    const unitRange = sheet.getRange(unitRow, 3, 1, 10); // C2:L2
    const unitValues = unitRange.getValues()[0];
    const colOffset = unitValues.findIndex(id => id == unitHOA);
    if (colOffset === -1) throw new Error(`Unit ID ${unitHOA} not found.`);
    const colIndex = 3 + colOffset;

    const duesCol = sheet.getRange(firstMonthRow, colIndex, sheet.getLastRow() - firstMonthRow + 1);
    const duesValues = duesCol.getValues();
    const firstEmptyOffset = duesValues.findIndex(row => !row[0]);
    if (firstEmptyOffset === -1) throw new Error(`No unpaid row found for unit ${unitHOA}.`);
    cell = sheet.getRange(firstMonthRow + firstEmptyOffset, colIndex);

    Logger.log(`Found column ${colIndex} for unit ${unitHOA}, first empty row: ${firstMonthRow + firstEmptyOffset}`);
  } else {
    Logger.log(`Using editCell row ${cell.getRow()} col ${cell.getColumn()}`);
  }

  const creditCol = cell.getColumn();
  const currentCredit = getAvailableCredit(creditCol);
  const amtDue = getHOADues(unitHOA);
  const unitName = getHOAUnitAndName(unitHOA);
  const startDate = getHOADateFromCell(cell);
  

  const arPayments = calculatePayments(amtPaid, amtDue, currentCredit);
  const amtCredit = arPayments.shift();
  const amtOverpayment = arPayments.shift();

  Logger.log(`amtDue: ${amtDue}, currentCredit: ${currentCredit}`);
  Logger.log(`amtCredit after: ${amtCredit}, amtOverpayment: ${amtOverpayment}`);
  Logger.log(`${arPayments.length} months paid for $${arPayments.length * amtDue} starting ${startDate}`);

  const mnth = startDate.getMonth();
  let strDate = "";
  for (let i = 1; i <= arPayments.length; i++) {
    strDate += getMonthName(mnth + i) + ", ";
  }
  strDate = strDate.slice(0, -2) + Utilities.formatDate(startDate, 'America/Cancun', " yyyy");

  Logger.log(`strDate: ${strDate}`);

  let customNoteText = note || '';
  let account = '';
  let bBank = false;

  if (!paymentMethod && editCell) {
    const ui = SpreadsheetApp.getUi();
    const customNote = ui.prompt('Add any notes you wish to make here\nand click [Yes] for bank transfer or [No] if cash', ui.ButtonSet.YES_NO);
    customNoteText = customNote.getResponseText();
    bBank = customNote.getSelectedButton() === ui.Button.YES;
    account = bBank ? 'MTC Bank' : 'Cash Account';
  } else {
    bBank = (paymentMethod === "MTC Bank");
    account = bBank ? 'MTC Bank' : 'Cash Account';
  }

  Logger.log(`Account: ${account}, Bank Transfer: ${bBank}, Note: ${customNoteText}`);

  let postNote = strDate;
  if (amtOverpayment < 0) {
    postNote += " using " + SLPutils.numberToMXN(Math.abs(amtOverpayment)) + " from Credit Balance " + customNoteText;
  } else if (amtOverpayment > 0) {
    postNote += " + " + SLPutils.numberToMXN(amtOverpayment) + " Credit " + customNoteText;
  } else {
    postNote += " " + customNoteText;
  }

  let creditNote = '';
  if (amtOverpayment !== 0) {
    const creditMsg = amtOverpayment > 0 ? 'Overpayment of ' : 'Underpayment of ';
    creditNote = '------\nCredit Adjusted to ' + SLPutils.numberToMXN(amtCredit) +
                 ' on ' + new Date() + ' from Deposit of ' + 
                 SLPutils.numberToMXN(amtPaid) + ' with an ' + creditMsg +
                 SLPutils.numberToMXN(Math.abs(amtOverpayment)) + '\n' + customNoteText;
  }

  if (arPayments.length === 0) {
    Logger.log("No full months can be paid — clearing cell.");
    cell.setValue(null);
    return;
  }

  const newSeq = generateSeqNum();
  const cellNote = 'Posted: ' + SLPutils.numberToMXN(amtPaid) + ' on ' + new Date() +
                   '\n' + postNote + '\nSeq: ' + newSeq;

  Logger.log('Starting row loop to post values:');
  for (let i = 0; i < arPayments.length; i++) {
    Logger.log(`Row ${cell.getRow()} - posting ${arPayments[i]}`);
    cell.setValue(arPayments[i]);
    cell.setNote(cellNote);
    cell = cell.offset(1, 0);
  }

  setAvailableCredit(amtCredit, creditNote, creditCol);
  const amountDue = arPayments.reduce((sum, val) => sum + val, 0);
  addTransaction(newSeq, new Date(), "Deposit", "HOA Dues", postNote, unitName, amtPaid, account);
  makeReceipt(new Date(), "HOA Dues " + strDate, postNote, unitHOA, amtPaid, amountDue, bBank, newSeq, true);
  alertPopUp(unitHOA + " paid " + amtPaid + " via " + account + " for " + strDate, "Success");

  Logger.log("Posted transaction #" + newSeq + " and generated receipt.");

  sortSheet();
  changeUnitReport(unitHOA);
  SLPutils.hideExtraRows('unitReportDetail');
  SLPutils.activate(sheetTransactions);

  Logger.log('Function Complete.');
}

/**
 * Calculates the remaining credit and as many full months of payments that can be made.
 * 
 * @param {number} amtPaid - The amount paid in dollars.
 * @param {number} amtMonthly - The monthly due amount in dollars.
 * @param {number} amtCredit - The current credit in dollars.
 * @return {Array} An array with the remaining credit as the first element, 
 *                 the overpayment amount in the second position, then followed 
 *                 by as many full monthly payments as possible.
 */
function calculatePayments(amtPaid, amtMonthly, amtCredit) {
  // Coerce the inputs to numbers to ensure they are numeric
  amtPaid = Number(amtPaid);
  amtMonthly = Number(amtMonthly);
  amtCredit = Number(amtCredit);

  Logger.log("--- calculatePayments ---");

  // Calculate the total funds available (amtPaid + amtCredit)
  let totalFunds = amtPaid + amtCredit;

  // Calculate how many full months can be paid
  let monthsPaid = Math.floor(totalFunds / amtMonthly);
  let totalForMonths = monthsPaid * amtMonthly;

  // Calculate remaining funds after paying full months
  let remainingFunds = totalFunds - totalForMonths;

  // Determine the overpayment or credit usage
  let amtOverpayment;
  let remainingCredit;

  if (remainingFunds >= amtCredit) {
    // Overpayment scenario
    amtOverpayment = remainingFunds - amtCredit;
    remainingCredit = amtCredit + amtOverpayment;
  } else {
    // Credit usage scenario
    amtOverpayment = amtPaid - totalForMonths; // Negative: amount taken from credit
    remainingCredit = amtCredit + amtOverpayment; // Deduct used credit
  }

  Logger.log("Remaining credit: " + remainingCredit);
  Logger.log("Overpayment or credit usage: " + amtOverpayment);

  // Construct the result array
  let result = [remainingCredit, amtOverpayment];
  for (let i = 0; i < monthsPaid; i++) {
    result.push(amtMonthly);
  }

  return result;
}
