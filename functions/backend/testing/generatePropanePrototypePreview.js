#!/usr/bin/env node
/**
 * Generate a standalone propane SVG prototype preview for all units in a client.
 *
 * Uses testHarness authentication + backend propane prototype endpoints:
 *   - /propane/clients/:clientId/graph/:unitId/data
 *   - /propane/clients/:clientId/graph/:unitId/svg
 *
 * Usage examples:
 *   node functions/backend/testing/generatePropanePrototypePreview.js
 *   node functions/backend/testing/generatePropanePrototypePreview.js --client=MTC --months=6
 *   node functions/backend/testing/generatePropanePrototypePreview.js --client=MTC --months=6 --asOfYear=2026 --asOfMonth=3
 *   node functions/backend/testing/generatePropanePrototypePreview.js --png
 */

import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { testHarness } from './testHarness.js';

function parseArgs(argv) {
  const args = {
    clientId: 'MTC',
    months: 6,
    asOfYear: null,
    asOfMonth: null,
    htmlOut: path.resolve(process.cwd(), 'test-results/propane-prototype-preview.html'),
    pngOut: path.resolve(process.cwd(), 'test-results/propane-prototype-preview.png'),
    generatePng: false,
  };

  argv.slice(2).forEach((arg) => {
    if (arg === '--png') {
      args.generatePng = true;
      return;
    }

    if (arg.startsWith('--client=')) {
      args.clientId = arg.split('=')[1] || args.clientId;
      return;
    }

    if (arg.startsWith('--months=')) {
      args.months = Number.parseInt(arg.split('=')[1], 10) || args.months;
      return;
    }

    if (arg.startsWith('--asOfYear=')) {
      const value = Number.parseInt(arg.split('=')[1], 10);
      args.asOfYear = Number.isFinite(value) ? value : null;
      return;
    }

    if (arg.startsWith('--asOfMonth=')) {
      const value = Number.parseInt(arg.split('=')[1], 10);
      args.asOfMonth = Number.isFinite(value) ? value : null;
      return;
    }

    if (arg.startsWith('--htmlOut=')) {
      args.htmlOut = path.resolve(process.cwd(), arg.split('=').slice(1).join('='));
      return;
    }

    if (arg.startsWith('--pngOut=')) {
      args.pngOut = path.resolve(process.cwd(), arg.split('=').slice(1).join('='));
    }
  });

  return args;
}

function resolveUnitOrder(configData) {
  const units = Array.isArray(configData?.units) ? configData.units : [];
  const unitIds = units.map((unit) => unit.id).filter(Boolean);
  const routeOrder = Array.isArray(configData?.workerRouteOrder) ? configData.workerRouteOrder : [];
  const ordered = routeOrder.filter((unitId) => unitIds.includes(unitId));
  const remainder = unitIds.filter((unitId) => !ordered.includes(unitId));
  return [...ordered, ...remainder];
}

function formatPoint(point) {
  return `${point.year}-${String(point.month).padStart(2, '0')}: ${point.level}%`;
}

function buildHtmlDocument({ clientId, months, asOfYear, asOfMonth, generatedAt, cards }) {
  const asOfText = Number.isFinite(asOfYear) && Number.isFinite(asOfMonth)
    ? `${asOfYear}-${String(asOfMonth).padStart(2, '0')}`
    : 'latest available';

  const cardsHtml = cards.map((card) => `
    <section class="card">
      <h2>${card.unitId}</h2>
      <div class="svg-wrap">${card.svg}</div>
      <p class="points">${card.points.length ? card.points.map(formatPoint).join(' | ') : 'No points returned'}</p>
    </section>
  `).join('\n');

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Propane Prototype Preview - ${clientId}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; color: #1f2937; }
      h1 { margin: 0 0 8px 0; }
      .meta { margin-bottom: 20px; color: #4b5563; font-size: 13px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; background: #fff; }
      .card h2 { margin: 0 0 8px 0; font-size: 16px; }
      .svg-wrap { border: 1px solid #f3f4f6; padding: 8px; background: #fafafa; overflow-x: auto; }
      .points { margin: 10px 0 0 0; font-size: 12px; color: #374151; line-height: 1.4; }
      @media print { .grid { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <h1>Propane SVG Prototype Preview (${clientId})</h1>
    <div class="meta">
      Generated: ${generatedAt}<br/>
      Window: last ${months} readings (as-of ${asOfText})<br/>
      Units rendered: ${cards.length}
    </div>
    <div class="grid">
      ${cardsHtml}
    </div>
  </body>
</html>`.trim();
}

async function exportPngFromHtml(htmlPath, pngPath) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1700, height: 2200, deviceScaleFactor: 2 });
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
    await page.screenshot({ path: pngPath, fullPage: true });
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = parseArgs(process.argv);

  const testResult = await testHarness.runTest({
    name: `Generate propane prototype preview (${args.clientId})`,
    async test({ api }) {
      const queryParams = { months: args.months };
      if (Number.isFinite(args.asOfYear)) queryParams.asOfYear = args.asOfYear;
      if (Number.isFinite(args.asOfMonth)) queryParams.asOfMonth = args.asOfMonth;

      const configResponse = await api.get(`/propane/clients/${args.clientId}/config`);
      const unitOrder = resolveUnitOrder(configResponse?.data?.data || {});
      if (unitOrder.length === 0) {
        return { passed: false, reason: 'No propane units found in config' };
      }

      const cards = [];
      for (const unitId of unitOrder) {
        const [dataResponse, svgResponse] = await Promise.all([
          api.get(`/propane/clients/${args.clientId}/graph/${encodeURIComponent(unitId)}/data`, { params: queryParams }),
          api.get(`/propane/clients/${args.clientId}/graph/${encodeURIComponent(unitId)}/svg`, {
            params: queryParams,
            responseType: 'text',
            transformResponse: [(value) => value],
          }),
        ]);

        cards.push({
          unitId,
          points: dataResponse?.data?.data?.levels || [],
          svg: typeof svgResponse.data === 'string' ? svgResponse.data : '',
        });
      }

      const html = buildHtmlDocument({
        clientId: args.clientId,
        months: args.months,
        asOfYear: args.asOfYear,
        asOfMonth: args.asOfMonth,
        generatedAt: new Date().toISOString(),
        cards,
      });

      fs.mkdirSync(path.dirname(args.htmlOut), { recursive: true });
      fs.writeFileSync(args.htmlOut, `${html}\n`, 'utf8');

      if (args.generatePng) {
        fs.mkdirSync(path.dirname(args.pngOut), { recursive: true });
        await exportPngFromHtml(args.htmlOut, args.pngOut);
      }

      return {
        passed: true,
        message: `Generated ${cards.length} unit previews`,
        data: {
          htmlOut: args.htmlOut,
          pngOut: args.generatePng ? args.pngOut : null,
          units: cards.length,
          unitIds: cards.map((card) => card.unitId),
        },
      };
    },
  });

  if (!testResult.passed) {
    process.exit(1);
  }

  console.log('\n✅ Propane prototype preview generated');
  console.log(`   HTML: ${args.htmlOut}`);
  if (args.generatePng) {
    console.log(`   PNG:  ${args.pngOut}`);
  }
}

main().catch((error) => {
  console.error('Fatal error generating prototype preview:', error);
  process.exit(1);
});

