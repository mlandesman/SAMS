import { DateTime } from 'luxon';
import { getNow, parseDate as parseDateFromService } from '../../shared/services/DateService.js';

const DEFAULT_TIMEZONE = 'America/Cancun';

const toDateTime = (value) => {
  if (!value) return null;

  if (DateTime.isDateTime(value)) {
    return value.setZone(DEFAULT_TIMEZONE);
  }

  if (value instanceof Date) {
    const normalized = parseDateFromService(value);
    return normalized ? DateTime.fromJSDate(normalized).setZone(DEFAULT_TIMEZONE) : null;
  }

  if (typeof value === 'string') {
    const iso = DateTime.fromISO(value, { zone: DEFAULT_TIMEZONE });
    if (iso.isValid) return iso;

    const sql = DateTime.fromSQL(value, { zone: DEFAULT_TIMEZONE });
    if (sql.isValid) return sql;

    return null;
  }

  if (typeof value?.toDate === 'function') {
    return DateTime.fromJSDate(value.toDate()).setZone(DEFAULT_TIMEZONE);
  }

  if (typeof value?._seconds === 'number') {
    return DateTime.fromSeconds(value._seconds, { zone: DEFAULT_TIMEZONE });
  }

  if (typeof value?.seconds === 'number') {
    return DateTime.fromSeconds(value.seconds, { zone: DEFAULT_TIMEZONE });
  }

  return null;
};

const toCentavos = (amount, amountsInCentavos) => {
  if (typeof amount !== 'number' || Number.isNaN(amount)) {
    throw new Error('Statement rows require numeric amounts.');
  }

  return amountsInCentavos ? Math.round(amount) : Math.round(amount * 100);
};

const centavosToPesos = (centavos) => Number((centavos / 100).toFixed(2));

const buildRows = ({
  rows,
  type,
  amountsInCentavos,
  nextIndexRef
}) => {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => {
      if (!row || typeof row !== 'object') {
        throw new Error('Statement rows must be objects.');
      }

      if (!row.description) {
        throw new Error('Statement rows require a description.');
      }

      const dt = toDateTime(row.date);
      if (!dt || !dt.isValid) {
        throw new Error(`Invalid or missing date for statement row: ${row.description}`);
      }

      const rawInputCentavos = toCentavos(row.amount, amountsInCentavos);
      let amountCentavos = rawInputCentavos;
      if (type === 'payment' && amountCentavos > 0) {
        amountCentavos = -amountCentavos;
      }

      return {
        type,
        description: row.description,
        date: dt.toISODate(),
        sortDate: dt.toMillis(),
        amountCentavos,
        rawInputCentavos,
        inputIndex: nextIndexRef.value++,
        paymentDisplayUsesRawAmount: row.paymentDisplayUsesRawAmount === true,
        isAdjustment: row.isAdjustment === true,
        isPenalty: row.isPenalty === true,
        category: row.category || null,
        transactionId: row.transactionId || null,
        transactionRef: row.transactionRef || null,
        allocations: row.allocations || [],
        categoryBreakdown: row.categoryBreakdown || {},
        billRef: row.billRef || null,
        chargeRef: row.chargeRef || null,
        penaltyRef: row.penaltyRef || null,
        source: row.source || null,
        isStandaloneCredit: row.isStandaloneCredit || false,
        creditEntryId: row.creditEntryId || null
      };
    })
    .filter((row) => row.amountCentavos !== 0);
};

const buildOpeningBalanceRow = ({
  openingBalance,
  openingBalanceDescription,
  amountsInCentavos,
  nextIndexRef
}) => {
  if (openingBalance === null || openingBalance === undefined) {
    throw new Error('Opening balance is required.');
  }

  const openingAmountCentavos = toCentavos(openingBalance, amountsInCentavos);
  const isCredit = openingAmountCentavos < 0;
  const description = openingBalanceDescription
    || (isCredit ? 'Opening Balance (Credit)' : 'Opening Balance');

  return {
    type: 'opening',
    description,
    date: null,
    sortDate: null,
    amountCentavos: openingAmountCentavos,
    inputIndex: nextIndexRef.value++
  };
};

const normalizeAndSortLedger = (ledger) => {
  return ledger.slice().sort((a, b) => {
    if (a.type === 'opening' && b.type !== 'opening') return -1;
    if (b.type === 'opening' && a.type !== 'opening') return 1;

    if (a.sortDate !== b.sortDate) {
      if (a.sortDate === null) return -1;
      if (b.sortDate === null) return 1;
      return a.sortDate - b.sortDate;
    }

    if (a.type !== b.type || a.isAdjustment !== b.isAdjustment || a.isPenalty !== b.isPenalty) {
      const rank = (row) => {
        if (row.type === 'payment' && !row.isAdjustment) return 0;
        if (row.isAdjustment) return 1;
        if (row.isPenalty) return 3;
        return 2;
      };

      const rankDiff = rank(a) - rank(b);
      if (rankDiff !== 0) {
        return rankDiff;
      }
    }

    return a.inputIndex - b.inputIndex;
  });
};

/**
 * Generate Statement of Account ledger and summary.
 *
 * Required inputs:
 * - openingBalance (from creditBalances.history[0] starting_balance)
 * - category-specific rows with { date, description, amount }
 *
 * The function only merges, sorts, and computes running balances.
 * It does not invent rows or derive charges/payments beyond inputs.
 */
export function generateStatementData({
  openingBalance,
  openingBalanceDescription,
  hoaDuesCharges = [],
  waterBillCharges = [],
  cashPayments = [],
  adminCreditAdjustments = [],
  postedPenalties = [],
  unpostedPenaltiesDueNow = [],
  upcomingBills = [],
  amountsInCentavos = false
} = {}) {
  const now = getNow();
  if (!now) {
    throw new Error('Statement generation requires DateService.getNow().');
  }

  const nextIndexRef = { value: 0 };
  const ledger = [
    buildOpeningBalanceRow({
      openingBalance,
      openingBalanceDescription,
      amountsInCentavos,
      nextIndexRef
    }),
    ...buildRows({
      rows: hoaDuesCharges,
      type: 'charge',
      amountsInCentavos,
      nextIndexRef
    }),
    ...buildRows({
      rows: waterBillCharges,
      type: 'charge',
      amountsInCentavos,
      nextIndexRef
    }),
    ...buildRows({
      rows: postedPenalties.map((row) => {
        if (!row || typeof row !== 'object') {
          return row;
        }

        return {
          ...row,
          isPenalty: true
        };
      }),
      type: 'charge',
      amountsInCentavos,
      nextIndexRef
    }),
    ...buildRows({
      rows: cashPayments,
      type: 'payment',
      amountsInCentavos,
      nextIndexRef
    }),
    ...buildRows({
      rows: adminCreditAdjustments.map((row) => {
        if (!row || typeof row !== 'object') {
          return row;
        }

        return {
          ...row,
          paymentDisplayUsesRawAmount: true,
          isAdjustment: true
        };
      }),
      type: 'payment',
      amountsInCentavos,
      nextIndexRef
    }),
    ...buildRows({
      rows: unpostedPenaltiesDueNow.map((row) => {
        if (!row || typeof row !== 'object') {
          return row;
        }

        return {
          ...row,
          isPenalty: true
        };
      }),
      type: 'charge',
      amountsInCentavos,
      nextIndexRef
    }),
    ...buildRows({
      rows: upcomingBills,
      type: 'charge',
      amountsInCentavos,
      nextIndexRef
    })
  ];

  const sortedLedger = normalizeAndSortLedger(ledger);

  let balanceCentavos = 0;
  const rows = sortedLedger.map((row) => {
    balanceCentavos += row.amountCentavos;

    if (row.type === 'opening') {
      return {
        ...row,
        amount: centavosToPesos(row.amountCentavos),
        charge: null,
        payment: null,
        balance: centavosToPesos(balanceCentavos)
      };
    }

    if (row.type === 'payment') {
      const paymentCentavos = row.paymentDisplayUsesRawAmount
        ? row.rawInputCentavos
        : Math.abs(row.amountCentavos);
      return {
        ...row,
        amount: centavosToPesos(row.amountCentavos),
        charge: 0,
        payment: centavosToPesos(paymentCentavos),
        balance: centavosToPesos(balanceCentavos)
      };
    }

    return {
      ...row,
      amount: centavosToPesos(row.amountCentavos),
      charge: centavosToPesos(row.amountCentavos),
      payment: 0,
      balance: centavosToPesos(balanceCentavos)
    };
  });

  const finalBalance = centavosToPesos(balanceCentavos);
  const totals = sortedLedger.reduce(
    (acc, row) => {
      if (row.type === 'opening') {
        return acc;
      }
      if (row.type === 'payment') {
        acc.totalPaymentsCentavos += Math.abs(row.amountCentavos);
      } else {
        acc.totalChargesCentavos += row.amountCentavos;
      }
      return acc;
    },
    { totalChargesCentavos: 0, totalPaymentsCentavos: 0 }
  );

  return {
    rows,
    summary: {
      openingBalance: centavosToPesos(sortedLedger[0]?.amountCentavos || 0),
      finalBalance,
      amountDue: finalBalance > 0 ? finalBalance : 0,
      totalCharges: centavosToPesos(totals.totalChargesCentavos),
      totalPayments: centavosToPesos(totals.totalPaymentsCentavos)
    }
  };
}
