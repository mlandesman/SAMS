const MONTH_NAMES_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MONTH_NAMES_ES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

function isSpanishLanguage(language) {
  return language === 'spanish' || language === 'es';
}

function clampPercentage(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function getThresholdStroke(level) {
  if (level <= 10) return '#dc2626'; // Critical red
  if (level <= 30) return '#d97706'; // Low yellow/amber
  return '#059669'; // OK green
}

function formatMonthLabel(month, language) {
  const monthNames = isSpanishLanguage(language) ? MONTH_NAMES_ES : MONTH_NAMES_EN;
  return monthNames[month] || `M${month + 1}`;
}

function toPoint(levelData, index, chart) {
  const { chartX, chartY, chartW, chartH, count } = chart;
  const x = count === 1
    ? chartX + (chartW / 2)
    : chartX + (index * (chartW / (count - 1)));
  const y = chartY + chartH - ((clampPercentage(levelData.level) / 100) * chartH);
  return { x, y, level: clampPercentage(levelData.level), year: levelData.year, month: levelData.month };
}

export function generatePropaneTrendSvg(levels = [], language = 'english', options = {}) {
  const includeHeader = options.includeHeader !== false;
  const includeFrame = options.includeFrame === true;
  const width = 390;
  const height = 195;
  const chartX = 44;
  const chartY = includeHeader ? 30 : 12;
  const chartW = 320;
  const chartH = 100;
  const chartBottomY = chartY + chartH;
  const frameY = 0;
  const frameH = chartBottomY + 24;
  const ticks = [25, 50, 75, 100];
  const title = isSpanishLanguage(language) ? 'ESTATUS DE GAS' : 'PROPANE STATUS';

  if (!Array.isArray(levels) || levels.length === 0) {
    return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />
  <text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" fill="#6b7280">
    No propane readings available
  </text>
</svg>`.trim();
  }

  const points = levels.map((row, index) => toPoint(row, index, {
    chartX,
    chartY,
    chartW,
    chartH,
    count: levels.length,
  }));

  const gridLines = ticks.map((tick) => {
    const y = chartY + chartH - ((tick / 100) * chartH);
    return `
  <line x1="${chartX}" y1="${y}" x2="${chartX + chartW}" y2="${y}" stroke="#e5e7eb" stroke-width="1" />
  <text x="${chartX - 8}" y="${y + 4}" text-anchor="end" font-family="Arial, sans-serif" font-size="10" fill="#4b5563">${tick}%</text>`;
  }).join('');

  const segmentLines = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    const segmentColor = getThresholdStroke(end.level);
    segmentLines.push(`
  <line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${segmentColor}" stroke-width="2.5" stroke-linecap="round" />`);
  }

  const markers = points.map((point) => `
  <circle cx="${point.x}" cy="${point.y}" r="3.5" fill="${getThresholdStroke(point.level)}" stroke="#ffffff" stroke-width="1.25" />
`).join('');

  const monthLabels = points.map((point, index) => {
    const anchor = index === 0 ? 'start' : (index === points.length - 1 ? 'end' : 'middle');
    return `
  <text x="${point.x}" y="${chartY + chartH + 20}" text-anchor="${anchor}" font-family="Arial, sans-serif" font-size="10.5" fill="#374151">${formatMonthLabel(point.month, language)}</text>`;
  }).join('');

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />
  <defs>
    <linearGradient id="sandyland-sea-sand" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0863BF" />
      <stop offset="72%" stop-color="#83C4F2" />
      <stop offset="100%" stop-color="#F7E4C2" />
    </linearGradient>
  </defs>
  ${includeFrame
    ? `<rect x="${chartX}" y="${frameY}" width="${chartW}" height="${frameH}" fill="none" stroke="#ddd" stroke-width="1" />`
    : ''}
  ${includeHeader
    ? `<text x="${chartX + (chartW / 2)}" y="20" text-anchor="middle" font-family="Arial, sans-serif" font-size="10pt" font-weight="700" fill="#333">${title}</text>`
    : ''}
  <rect x="${chartX}" y="${chartY}" width="${chartW}" height="${chartH}" fill="url(#sandyland-sea-sand)" opacity="0.20" />
  ${gridLines}
  <line x1="${chartX}" y1="${chartY}" x2="${chartX}" y2="${chartY + chartH}" stroke="#9ca3af" stroke-width="1.2" />
  <line x1="${chartX}" y1="${chartY + chartH}" x2="${chartX + chartW}" y2="${chartY + chartH}" stroke="#9ca3af" stroke-width="1.2" />
  ${segmentLines.join('')}
  ${markers}
  ${monthLabels}
  <text x="${firstPoint.x}" y="${firstPoint.y - 8}" text-anchor="middle" font-family="Arial, sans-serif" font-size="9.5" fill="#374151">${firstPoint.level}%</text>
  <text x="${lastPoint.x}" y="${lastPoint.y - 8}" text-anchor="middle" font-family="Arial, sans-serif" font-size="9.5" fill="#374151">${lastPoint.level}%</text>
</svg>`.trim();
}

