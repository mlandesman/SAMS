const MONTH_NAMES_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function clampPercentage(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function getThresholdStroke(level) {
  if (level <= 10) return '#dc2626'; // Critical red
  if (level <= 30) return '#d97706'; // Low yellow/amber
  return '#059669'; // OK green
}

function formatMonthYearLabel(year, month) {
  const monthName = MONTH_NAMES_EN[month] || `M${month + 1}`;
  return `${monthName} ${year}`;
}

function toPoint(levelData, index, chart) {
  const { chartX, chartY, chartW, chartH, count } = chart;
  const x = count === 1
    ? chartX + (chartW / 2)
    : chartX + (index * (chartW / (count - 1)));
  const y = chartY + chartH - ((clampPercentage(levelData.level) / 100) * chartH);
  return { x, y, level: clampPercentage(levelData.level), year: levelData.year, month: levelData.month };
}

export function generatePropaneTrendSvg(levels = []) {
  const width = 390;
  const height = 195;
  const chartX = 44;
  const chartY = 20;
  const chartW = 320;
  const chartH = 122;
  const ticks = [25, 50, 75, 100];

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

  const firstLabel = formatMonthYearLabel(points[0].year, points[0].month);
  const lastLabel = formatMonthYearLabel(points[points.length - 1].year, points[points.length - 1].month);

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

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />
  ${gridLines}
  <line x1="${chartX}" y1="${chartY}" x2="${chartX}" y2="${chartY + chartH}" stroke="#9ca3af" stroke-width="1.2" />
  <line x1="${chartX}" y1="${chartY + chartH}" x2="${chartX + chartW}" y2="${chartY + chartH}" stroke="#9ca3af" stroke-width="1.2" />
  ${segmentLines.join('')}
  ${markers}
  <text x="${chartX}" y="${chartY + chartH + 16}" text-anchor="start" font-family="Arial, sans-serif" font-size="10.5" fill="#374151">${firstLabel}</text>
  <text x="${chartX + chartW}" y="${chartY + chartH + 16}" text-anchor="end" font-family="Arial, sans-serif" font-size="10.5" fill="#374151">${lastLabel}</text>
  <text x="${firstPoint.x}" y="${firstPoint.y - 8}" text-anchor="middle" font-family="Arial, sans-serif" font-size="9.5" fill="#374151">${firstPoint.level}%</text>
  <text x="${lastPoint.x}" y="${lastPoint.y - 8}" text-anchor="middle" font-family="Arial, sans-serif" font-size="9.5" fill="#374151">${lastPoint.level}%</text>
</svg>`.trim();
}

