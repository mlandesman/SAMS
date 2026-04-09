#!/usr/bin/env node
/**
 * Dry-run bank reconciliation matching (no UI, no Firestore "session").
 * Reads Scotia CSV or BBVA XLSX + live Firestore transactions only; nothing is written to reconciliations/*.
 *
 * Usage (from repo root):
 *   node scripts/recon-match-dry-run.mjs <path-to-file> [clientId] [accountId] [--from=YYYY-MM-DD] [--format=scotiabank|bbva] [--report] [--full-report]
 *
 * Bank file: `.csv` → Scotia (default); `.xlsx` / `.xls` → BBVA unless `--format=` overrides.
 *
 * --report (default content): **misses only** — summary match counts, then unmatched bank lines
 *   (nearest SAMS among *remaining* unmatched txns: **≤30 days** date shift and **≤100000¢** amount gap), then unmatched SAMS detail. No duplicate
 *   listings of matched rows across sections.
 * --full-report: legacy A–E listing (all bank rows, all SAMS pool, every match detail).
 *
 * Writes: ../test-results/recon_<misses|dry_run>_...
 *
 * Default --from=2025-07-01: AVII fiscal year start (May–Jun 2025 not in SAMS). Override with
 * --from=YYYY-MM-DD for wider exports. Upper bound is always bank file / query window through latest bank date.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { DateTime } from 'luxon';
import { centavosToPesos } from '../shared/utils/currencyUtils.js';
import { parseScotiabankCSV } from '../backend/services/bankParsers/scotiabankParser.js';
import { parseBBVAXLSX } from '../backend/services/bankParsers/bbvaParser.js';
import { normalizeRowsForSession } from '../backend/services/reconciliationNormalizer.js';
import { fetchTransactionsForMatching } from '../backend/services/reconciliationMatchingPool.js';
import {
  runMatchingAlgorithm,
  attachAccountForMatching
} from '../backend/services/reconciliationMatcher.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_TEST_RESULTS = join(__dirname, '..', 'test-results');

/** Nearest-by-amount hints only include SAMS rows at most this many calendar days from the bank line. */
const MAX_NEAREST_CANDIDATE_DAY_SHIFT = 30;

/** Max |bank − SAMS cash| in centavos for nearest-candidate hints (100000¢ = $1,000 MXN). */
const MAX_NEAREST_CANDIDATE_CENTAVOS_DIFF = 100000;

function bankDateRange(bankRows) {
  let min = null;
  let max = null;
  for (const r of bankRows) {
    const d = String(r.date || '');
    if (!d) continue;
    if (!min || d < min) min = d;
    if (!max || d > max) max = d;
  }
  return { min, max };
}

function txnDateIsoCancun(txn) {
  const d = txn.date;
  if (d && typeof d.toDate === 'function') {
    return DateTime.fromJSDate(d.toDate(), { zone: 'America/Cancun' }).toISODate();
  }
  if (d instanceof Date) {
    return DateTime.fromJSDate(d, { zone: 'America/Cancun' }).toISODate();
  }
  if (typeof d === 'string') {
    return DateTime.fromISO(d, { zone: 'America/Cancun' }).toISODate();
  }
  return '';
}

/** Same as matcher: cash txn.amount only; allocations are internal, not bank total. */
function txnMatchCentavos(txn) {
  return Math.round(txn.amount || 0);
}

function typeMatchesBank(bankType, txn) {
  const t = txn.type;
  const amt = txn.amount || 0;
  if (bankType === 'ABONO') {
    if (t === 'income') return amt > 0;
    if (t === 'adjustment') return amt > 0;
    return false;
  }
  if (bankType === 'CARGO') {
    if (t === 'expense') return amt < 0;
    if (t === 'adjustment') return amt < 0;
    return false;
  }
  return false;
}

function amountDiffBankVsTxn(nrType, bankCentavos, txnCentavos) {
  if (nrType === 'CARGO') return Math.abs(Math.abs(txnCentavos) - bankCentavos);
  return Math.abs(txnCentavos - bankCentavos);
}

/**
 * Top N SAMS rows by type+amount closeness among txns within {@link MAX_NEAREST_CANDIDATE_DAY_SHIFT} days
 * and {@link MAX_NEAREST_CANDIDATE_CENTAVOS_DIFF} centavos of the bank line (same diff metric as matcher).
 * Pass only the txn pool you want (e.g. unmatched only).
 */
function nearestSamsForBank(nr, txns, n = 5) {
  const scored = [];
  for (const t of txns) {
    if (!typeMatchesBank(nr.type, t)) continue;
    const tc = txnMatchCentavos(t);
    const diff = amountDiffBankVsTxn(nr.type, nr.amount, tc);
    if (diff > MAX_NEAREST_CANDIDATE_CENTAVOS_DIFF) continue;
    const dBank = nr.date;
    const dTxn = txnDateIsoCancun(t);
    const dayDiff =
      dBank && dTxn
        ? Math.abs(
            DateTime.fromISO(dBank).diff(DateTime.fromISO(dTxn), 'days').days
          )
        : 999;
    if (dayDiff > MAX_NEAREST_CANDIDATE_DAY_SHIFT) continue;
    scored.push({ t, diff, dayDiff, tc });
  }
  scored.sort((a, b) => a.diff - b.diff || a.dayDiff - b.dayDiff);
  return scored.slice(0, n);
}

function inferBankFormatFromPath(filePath, explicit) {
  const e = String(explicit || '').toLowerCase();
  if (e === 'bbva' || e === 'scotiabank') return e;
  const lower = String(filePath || '').toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'bbva';
  return 'scotiabank';
}

function parseArgs(argv) {
  const fromArg = argv.find((a) => a.startsWith('--from='));
  const matchFrom = fromArg ? fromArg.replace(/^--from=/, '').trim() : '2025-07-01';
  const formatArg = argv.find((a) => a.startsWith('--format='));
  const formatExplicit = formatArg ? formatArg.replace(/^--format=/, '').trim() : '';
  const positional = argv.slice(2).filter((a) => !a.startsWith('--'));
  const writeReport = argv.includes('--report');
  const fullReport = argv.includes('--full-report');
  return { matchFrom, positional, writeReport, fullReport, formatExplicit };
}

function esc(s) {
  return String(s ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ');
}

function formatReport({
  clientId,
  accountId,
  matchFrom,
  csvPath,
  parsedCount,
  bankRowCount,
  startDate,
  endDate,
  normalizedRows,
  uncleared,
  stats,
  matches,
  unmatchedBankRows,
  unmatchedTransactions,
  normById,
  txnById
}) {
  const lines = [];
  lines.push(`# Bank recon dry-run (no Firestore session)`);
  lines.push(``);
  lines.push(
    `This file is generated by \`scripts/recon-match-dry-run.mjs\`. It does **not** create or update \`clients/*/reconciliations/*\`. It only reads your bank file and live \`transactions\` for comparison. Normalized bank amounts are **integer centavos**, same as SAMS.`
  );
  lines.push(``);
  lines.push(`| Field | Value |`);
  lines.push(`| --- | --- |`);
  lines.push(`| Client | ${clientId} |`);
  lines.push(`| Bank account | ${accountId} |`);
  lines.push(`| Bank file | ${csvPath} |`);
  lines.push(`| --from | ${matchFrom} (bank lines + SAMS Cancun date filter) |`);
  lines.push(`| Parsed bank rows (in window) | ${bankRowCount} (of ${parsedCount} total parsed) |`);
  lines.push(`| Bank date span | ${startDate} .. ${endDate} |`);
  lines.push(`| Normalized bank groups | ${normalizedRows.length} |`);
  lines.push(`| SAMS uncleared in pool | ${uncleared.length} |`);
  lines.push(`| Stats | ${JSON.stringify(stats)} |`);
  lines.push(``);

  lines.push(`## A — All normalized bank rows (${normalizedRows.length})`);
  lines.push(``);
  lines.push(
    `| # | date | type | centavos | MXN | description |`
  );
  lines.push(`| ---: | --- | --- | ---: | ---: | --- |`);
  let i = 1;
  for (const r of [...normalizedRows].sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  )) {
    lines.push(
      `| ${i++} | ${r.date} | ${r.type} | ${r.amount} | ${centavosToPesos(r.amount).toFixed(2)} | ${esc(r.description)} |`
    );
  }
  lines.push(``);

  lines.push(`## B — All SAMS uncleared transactions in pool (${uncleared.length})`);
  lines.push(``);
  lines.push(`| # | id | Cancun date | type | centavos | MXN | note |`);
  lines.push(`| ---: | --- | --- | --- | ---: | ---: | --- |`);
  i = 1;
  for (const t of [...uncleared].sort((a, b) =>
    txnDateIsoCancun(a).localeCompare(txnDateIsoCancun(b))
  )) {
    const note = (t.notes || t.description || '').slice(0, 120);
    lines.push(
      `| ${i++} | ${t.id} | ${txnDateIsoCancun(t)} | ${t.type} | ${t.amount} | ${centavosToPesos(t.amount).toFixed(2)} | ${esc(note)} |`
    );
  }
  lines.push(``);

  lines.push(`## C — Automatic matches (${matches.length})`);
  lines.push(``);
  if (matches.length === 0) lines.push(`(none)`);
  for (const m of matches) {
    const nr = normById[m.normalizedRowId];
    const tx = txnById[m.transactionId];
    lines.push(`- **${m.matchType}**`);
    lines.push(
      `  - Bank: ${nr?.date} ${nr?.type} ${nr?.amount} centavos ($${centavosToPesos(nr?.amount || 0).toFixed(2)}) — ${esc(nr?.description)}`
    );
    if (tx) {
      lines.push(
        `  - SAMS: \`${tx.id}\` ${txnDateIsoCancun(tx)} ${tx.type} ${txnMatchCentavos(tx)} centavos`
      );
    }
    if (m.feeGroupTransactionIds?.length) {
      lines.push(`  - Fee group tx ids: ${m.feeGroupTransactionIds.join(', ')}`);
    }
    if (m.speiFeeGapCentavos != null) {
      lines.push(
        `  - SPEI fee+IVA gap (bank vs |SAMS|): ${m.speiFeeGapCentavos} centavos`
      );
    }
    if (m.roundingDeltaCentavos != null) {
      lines.push(
        `  - Rounding delta (bank − SAMS cash): ${m.roundingDeltaCentavos} centavos (adjust to bank in UI)`
      );
    }
    lines.push(``);
  }

  lines.push(
    `## D — Unmatched bank rows (${unmatchedBankRows.length}) + nearest SAMS by amount (same sign rules as matcher; candidates ≤${MAX_NEAREST_CANDIDATE_DAY_SHIFT} days and ≤${MAX_NEAREST_CANDIDATE_CENTAVOS_DIFF}¢ / $${centavosToPesos(MAX_NEAREST_CANDIDATE_CENTAVOS_DIFF).toFixed(2)} MXN apart)`
  );
  lines.push(``);
  for (const nid of unmatchedBankRows.sort()) {
    const nr = normById[nid];
    if (!nr) continue;
    lines.push(`### ${nr.date} ${nr.type} ${nr.amount}¢ ($${centavosToPesos(nr.amount).toFixed(2)})`);
    lines.push(``);
    lines.push(esc(nr.description || ''));
    lines.push(``);
    const near = nearestSamsForBank(nr, uncleared, 5);
    if (near.length === 0) {
      lines.push(
        `*No SAMS row with matching direction within **${MAX_NEAREST_CANDIDATE_DAY_SHIFT}** days and **${MAX_NEAREST_CANDIDATE_CENTAVOS_DIFF}¢** ($${centavosToPesos(MAX_NEAREST_CANDIDATE_CENTAVOS_DIFF).toFixed(2)}) amount gap (or none with matching direction).*`
      );
    } else {
      lines.push(`| rank | Δcentavos | days apart | SAMS id | SAMS ¢ | note |`);
      lines.push(`| ---: | ---: | ---: | --- | ---: | --- |`);
      let rnk = 1;
      for (const { t, diff, dayDiff, tc } of near) {
        lines.push(
          `| ${rnk++} | ${diff} | ${dayDiff.toFixed(0)} | \`${t.id}\` | ${tc} | ${esc((t.notes || '').slice(0, 80))} |`
        );
      }
    }
    lines.push(``);
  }

  lines.push(`## E — Unmatched SAMS transaction ids (${unmatchedTransactions.length})`);
  lines.push(``);
  lines.push(unmatchedTransactions.map((id) => `- \`${id}\``).join('\n'));
  lines.push(``);

  return lines.join('\n');
}

/** Misses-only: no full A/B/C tables; matched rows appear only as aggregate counts. */
function formatMissesReport({
  clientId,
  accountId,
  matchFrom,
  csvPath,
  parsedCount,
  bankRowCount,
  startDate,
  endDate,
  normalizedRows,
  uncleared,
  stats,
  matches,
  unmatchedBankRows,
  unmatchedTransactions,
  normById,
  txnById
}) {
  const lines = [];
  lines.push(`# Bank recon — **misses only** (dry-run)`);
  lines.push(``);
  lines.push(
    `Generated by \`scripts/recon-match-dry-run.mjs\`. **Matched** bank/SAMS pairs are counted below but not listed again. Detail focuses on **why** remaining lines did not match.`
  );
  lines.push(``);
  lines.push(`| Field | Value |`);
  lines.push(`| --- | --- |`);
  lines.push(`| Client | ${clientId} |`);
  lines.push(`| Bank account | ${accountId} |`);
  lines.push(`| Bank file | ${csvPath} |`);
  lines.push(`| --from | ${matchFrom} |`);
  lines.push(`| Parsed bank rows (in window) | ${bankRowCount} (of ${parsedCount} total parsed) |`);
  lines.push(`| Bank date span | ${startDate} .. ${endDate} |`);
  lines.push(`| Normalized bank groups | ${normalizedRows.length} |`);
  lines.push(`| SAMS uncleared in pool | ${uncleared.length} |`);
  lines.push(``);

  lines.push(`## Matched (counts only — all auto match types)`);
  lines.push(``);
  lines.push(`| Match type | Count |`);
  lines.push(`| --- | ---: |`);
  lines.push(`| auto-exact | ${stats.exact} |`);
  lines.push(`| auto-date-drift (≤7d) | ${stats.dateDrift} |`);
  lines.push(`| auto-rounding (≤2¢, ≤1d) | ${stats.roundingExact ?? 0} |`);
  lines.push(`| auto-rounding (≤2¢, ≤7d) | ${stats.roundingDrift ?? 0} |`);
  lines.push(`| auto-spei-fee-gap (580¢, ≤1d) | ${stats.speiFeeGapExact ?? 0} |`);
  lines.push(`| auto-spei-fee-gap (580¢, ≤7d) | ${stats.speiFeeGapDrift ?? 0} |`);
  lines.push(`| auto-fee-adjusted (2–5 txns sum) | ${stats.feeAdjusted} |`);
  lines.push(`| **Total matched bank lines** | **${matches.length}** |`);
  lines.push(`| Unmatched bank lines | ${unmatchedBankRows.length} |`);
  lines.push(`| Unmatched SAMS in pool | ${unmatchedTransactions.length} |`);
  lines.push(``);

  const unmatchedTxnList = unmatchedTransactions
    .map((id) => txnById[id])
    .filter(Boolean);

  lines.push(`## Unmatched bank lines (${unmatchedBankRows.length})`);
  lines.push(``);
  lines.push(
    `Nearest SAMS candidates use **only transactions still unmatched** (so a row here is not “near” a txn already paired to another bank line). Only txns **≤${MAX_NEAREST_CANDIDATE_DAY_SHIFT} days** and **≤${MAX_NEAREST_CANDIDATE_CENTAVOS_DIFF}¢** ($${centavosToPesos(MAX_NEAREST_CANDIDATE_CENTAVOS_DIFF).toFixed(2)}) **|bank − SAMS|** from the bank line are considered.`
  );
  lines.push(``);

  for (const nid of unmatchedBankRows.sort()) {
    const nr = normById[nid];
    if (!nr) continue;
    lines.push(`### ${nr.date} · ${nr.type} · ${nr.amount}¢ ($${centavosToPesos(nr.amount).toFixed(2)})`);
    lines.push(``);
    lines.push(esc(nr.description || ''));
    lines.push(``);
    const near = nearestSamsForBank(nr, unmatchedTxnList, 5);
    if (near.length === 0) {
      lines.push(
        `*No candidate in the **unmatched** SAMS set with the same direction within **${MAX_NEAREST_CANDIDATE_DAY_SHIFT}** days and **${MAX_NEAREST_CANDIDATE_CENTAVOS_DIFF}¢** amount gap (or none with matching direction).*`
      );
    } else {
      lines.push(`| rank | Δcentavos | days apart | SAMS id | SAMS ¢ | note |`);
      lines.push(`| ---: | ---: | ---: | --- | ---: | --- |`);
      let rnk = 1;
      for (const { t, diff, dayDiff, tc } of near) {
        lines.push(
          `| ${rnk++} | ${diff} | ${dayDiff.toFixed(0)} | \`${t.id}\` | ${tc} | ${esc((t.notes || '').slice(0, 80))} |`
        );
      }
    }
    lines.push(``);
  }

  lines.push(`## Unmatched SAMS transactions (${unmatchedTransactions.length})`);
  lines.push(``);
  lines.push(`| id | Cancun date | type | centavos | MXN | note |`);
  lines.push(`| --- | --- | --- | ---: | ---: | --- |`);
  for (const t of [...unmatchedTxnList].sort((a, b) =>
    txnDateIsoCancun(a).localeCompare(txnDateIsoCancun(b))
  )) {
    const note = (t.notes || t.description || '').slice(0, 120);
    lines.push(
      `| ${t.id} | ${txnDateIsoCancun(t)} | ${t.type} | ${t.amount} | ${centavosToPesos(t.amount).toFixed(2)} | ${esc(note)} |`
    );
  }
  lines.push(``);

  return lines.join('\n');
}

async function main() {
  const { matchFrom, positional, writeReport, fullReport, formatExplicit } = parseArgs(process.argv);
  const bankFilePath =
    positional[0] ||
    join(REPO_TEST_RESULTS, 'MovimientosCTACHEQ6670_31MAR2026.csv');
  const clientId = positional[1] || 'AVII';
  const accountId = positional[2] || 'bank-001';
  const bankFormat = inferBankFormatFromPath(bankFilePath, formatExplicit);

  const buf = readFileSync(bankFilePath);
  let parsedRows;
  let errors = [];
  if (bankFormat === 'bbva') {
    const out = await parseBBVAXLSX(buf);
    parsedRows = out.bankRows;
    errors = out.errors || [];
  } else {
    const out = await parseScotiabankCSV(buf);
    parsedRows = out.bankRows;
    errors = out.errors || [];
  }
  if (errors.length) {
    console.error('Parse errors:', errors.slice(0, 20));
    if (errors.length > 20) console.error(`... and ${errors.length - 20} more`);
  }

  const bankRows = parsedRows.filter((r) => String(r.date || '') >= matchFrom);
  const { min: startDate, max: endDate } = bankDateRange(bankRows);
  if (!startDate) {
    console.error(`No bank rows on or after --from=${matchFrom}`);
    process.exit(1);
  }

  console.log(
    `Bank (${bankFormat}): ${parsedRows.length} parsed rows → ${bankRows.length} rows from ${matchFrom} onward | span ${startDate} .. ${endDate}`
  );
  console.log(`Client: ${clientId} | account: ${accountId}\n`);

  const rawNorm = normalizeRowsForSession(bankFormat, bankRows);
  const normalizedRows = rawNorm.map((nr, i) => ({
    id: `dry-norm-${i}`,
    ...nr
  }));

  console.log(
    `Normalized: ${normalizedRows.length} rows (${bankFormat === 'bbva' ? 'BBVA 1:1' : 'Scotia ref groups'})\n`
  );

  const allTxns = await fetchTransactionsForMatching(clientId, accountId, matchFrom, endDate);
  const poolTxns = allTxns.filter(
    (t) => t && (t.amount || 0) !== 0 && t.accountId === accountId
  );
  const unclearedAll = poolTxns.filter((t) => !t.clearedDate);
  const cleared = poolTxns.filter((t) => t.clearedDate);
  const uncleared = unclearedAll.filter((t) => (txnDateIsoCancun(t) || '') >= matchFrom);

  console.log(
    `Firestore (query ${matchFrom}..${endDate} ±7d): ${allTxns.length} rows on account; uncleared ${unclearedAll.length} → ${uncleared.length} on/after ${matchFrom} (Cancun); cleared ${cleared.length}\n`
  );

  const normById = Object.fromEntries(normalizedRows.map((r) => [r.id, r]));
  const txnById = Object.fromEntries(uncleared.map((t) => [t.id, t]));

  const withAccount = attachAccountForMatching(normalizedRows, accountId);
  const result = runMatchingAlgorithm(withAccount, uncleared, {
    bankFormat
  });

  const { stats, matches, unmatchedBankRows, unmatchedTransactions } = result;

  console.log('--- Match stats (same algorithm as POST match) ---');
  console.log(JSON.stringify(stats, null, 2));
  console.log(`\nMatches: ${matches.length}`);
  console.log(`Unmatched bank normalized rows: ${unmatchedBankRows.length}`);
  console.log(`Unmatched SAMS transactions (uncleared in pool): ${unmatchedTransactions.length}`);

  if (writeReport) {
    mkdirSync(REPO_TEST_RESULTS, { recursive: true });
    const safeFrom = matchFrom.replace(/[^0-9-]/g, '');
    const baseName = fullReport
      ? `recon_dry_run_${clientId}_${accountId}_${safeFrom}.md`
      : `recon_misses_${clientId}_${accountId}_${safeFrom}.md`;
    const outPath = join(REPO_TEST_RESULTS, baseName);
    const md = fullReport
      ? formatReport({
          clientId,
          accountId,
          matchFrom,
          csvPath: bankFilePath,
          parsedCount: parsedRows.length,
          bankRowCount: bankRows.length,
          startDate,
          endDate,
          normalizedRows,
          uncleared,
          stats,
          matches,
          unmatchedBankRows,
          unmatchedTransactions,
          normById,
          txnById
        })
      : formatMissesReport({
          clientId,
          accountId,
          matchFrom,
          csvPath: bankFilePath,
          parsedCount: parsedRows.length,
          bankRowCount: bankRows.length,
          startDate,
          endDate,
          normalizedRows,
          uncleared,
          stats,
          matches,
          unmatchedBankRows,
          unmatchedTransactions,
          normById,
          txnById
        });
    writeFileSync(outPath, md, 'utf8');
    console.log(
      `\nWrote ${fullReport ? 'full' : 'misses-only'} report: ${outPath}`
    );
  } else {
    console.log(
      `\nTip: add --report (misses-only) or --report --full-report → ${REPO_TEST_RESULTS}/`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
