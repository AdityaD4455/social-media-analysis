/**
 * charts.js — Chart.js helpers for InsightSphere
 */

// Global Chart.js defaults
Chart.defaults.color = '#475569';
Chart.defaults.borderColor = 'rgba(99,102,241,.12)';
Chart.defaults.font.family = "'Space Grotesk', system-ui, sans-serif";

const chartInstances = {};

function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}

function createTimeseriesChart(canvasId, tsData) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx || !tsData?.length) return;

  const labels = tsData.map(d => {
    const dt = new Date(d.date);
    return dt.toLocaleDateString('en', { month: 'short', day: 'numeric' });
  });
  const reach = tsData.map(d => d.total_reach);
  const engagement = tsData.map(d => d.avg_engagement);

  chartInstances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Total Reach',
          data: reach,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,.06)',
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 5,
          fill: true,
          tension: 0.4,
          yAxisID: 'y',
        },
        {
          label: 'Avg Engagement %',
          data: engagement,
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6,182,212,.06)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          fill: true,
          tension: 0.4,
          yAxisID: 'y2',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      animation: { duration: 800, easing: 'easeInOutQuart' },
      plugins: {
        legend: {
          position: 'top',
          labels: { boxWidth: 12, padding: 20, color: '#94a3b8' },
        },
        tooltip: {
          backgroundColor: '#0d1524',
          borderColor: 'rgba(99,102,241,.3)',
          borderWidth: 1,
          padding: 12,
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
          callbacks: {
            label: (ctx) => {
              const val = ctx.raw;
              if (ctx.dataset.yAxisID === 'y2') return ` ${ctx.dataset.label}: ${val.toFixed(2)}%`;
              return ` ${ctx.dataset.label}: ${fmtNum(val)}`;
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 10, color: '#475569' } },
        y: {
          position: 'left', grid: { color: 'rgba(99,102,241,.06)' },
          ticks: { color: '#475569', callback: v => fmtNum(v) },
        },
        y2: {
          position: 'right', grid: { display: false },
          ticks: { color: '#06b6d4', callback: v => v.toFixed(1) + '%' },
        },
      },
    },
  });
}

function createContentChart(canvasId, contentData) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx || !contentData?.length) return;

  const colors = ['#6366f1', '#06b6d4', '#a855f7', '#22c55e', '#f97316', '#ec4899'];

  chartInstances[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: contentData.map(d => d.content_type),
      datasets: [{
        data: contentData.map(d => d.avg_engagement),
        backgroundColor: colors.map(c => c.replace('#', 'rgba(') + ',.7)').map(c => c),
        backgroundColor: colors,
        borderColor: '#070b14',
        borderWidth: 3,
        hoverBorderWidth: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { animateRotate: true, duration: 900 },
      plugins: {
        legend: {
          position: 'right',
          labels: { boxWidth: 10, padding: 16, color: '#94a3b8', font: { size: 12 } },
        },
        tooltip: {
          backgroundColor: '#0d1524',
          borderColor: 'rgba(99,102,241,.3)',
          borderWidth: 1,
          callbacks: {
            label: (ctx) => ` Avg: ${ctx.raw.toFixed(2)}%`,
          },
        },
      },
    },
  });
}

function createForecastChart(canvasId, forecastData) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const { historical = [], predicted = [] } = forecastData;
  const histLabels = historical.map(d => d.date);
  const histValues = historical.map(d => d.value);
  const predLabels = predicted.map(d => d.date);
  const predValues = predicted.map(d => d.value);
  const upperValues = predicted.map(d => d.upper);
  const lowerValues = predicted.map(d => d.lower);

  const allLabels = [...histLabels, ...predLabels];

  chartInstances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: allLabels,
      datasets: [
        {
          label: 'Historical',
          data: [...histValues, ...Array(predLabels.length).fill(null)],
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,.08)',
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: true,
          tension: 0.3,
        },
        {
          label: 'Predicted',
          data: [...Array(histLabels.length).fill(null), ...predValues],
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6,182,212,.08)',
          borderWidth: 2.5,
          borderDash: [6, 3],
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: true,
          tension: 0.3,
        },
        {
          label: 'Upper Bound',
          data: [...Array(histLabels.length).fill(null), ...upperValues],
          borderColor: 'rgba(6,182,212,.2)',
          borderWidth: 1,
          pointRadius: 0,
          fill: false,
          tension: 0.3,
        },
        {
          label: 'Lower Bound',
          data: [...Array(histLabels.length).fill(null), ...lowerValues],
          borderColor: 'rgba(6,182,212,.2)',
          backgroundColor: 'rgba(6,182,212,.06)',
          borderWidth: 1,
          pointRadius: 0,
          fill: '-1',
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      animation: { duration: 1000, easing: 'easeInOutQuart' },
      plugins: {
        legend: {
          position: 'top',
          labels: { boxWidth: 12, padding: 16, color: '#94a3b8',
            filter: (item) => !['Upper Bound', 'Lower Bound'].includes(item.text)
          },
        },
        tooltip: {
          backgroundColor: '#0d1524',
          borderColor: 'rgba(99,102,241,.3)',
          borderWidth: 1,
          callbacks: {
            label: (ctx) => {
              if (!ctx.raw) return null;
              return ` ${ctx.dataset.label}: ${fmtNum(ctx.raw)}`;
            },
          },
          filter: (item) => item.raw !== null,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxTicksLimit: 12, color: '#475569', font: { size: 11 } },
        },
        y: {
          grid: { color: 'rgba(99,102,241,.06)' },
          ticks: { color: '#475569', callback: v => fmtNum(v) },
        },
      },
    },
  });
}

function createPlatformBarChart(canvasId, platformData, metric = 'avg_reach') {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx || !platformData?.length) return;

  const platforms = platformData.map(p => p.platform);
  const values = platformData.map(p => p[metric] || 0);
  const colors = platforms.map(p => PLATFORM_COLORS[p]?.primary || '#6366f1');

  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: platforms,
      datasets: [{
        label: metric === 'avg_reach' ? 'Avg Reach' : 'Avg Engagement %',
        data: values,
        backgroundColor: colors.map(c => c + '99'),
        borderColor: colors,
        borderWidth: 1.5,
        borderRadius: 8,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 700, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0d1524',
          borderColor: 'rgba(99,102,241,.3)',
          borderWidth: 1,
          callbacks: {
            label: (ctx) => metric === 'avg_engagement' ? ` ${ctx.raw.toFixed(2)}%` : ` ${fmtNum(ctx.raw)}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#475569' } },
        y: {
          grid: { color: 'rgba(99,102,241,.06)' },
          ticks: { color: '#475569', callback: v => metric === 'avg_engagement' ? v.toFixed(1) + '%' : fmtNum(v) },
        },
      },
    },
  });
}

let liveChartInstance = null;
const liveChartData = { labels: [], reach: [], engagement: [] };

function initLiveChart(canvasId) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  if (liveChartInstance) { liveChartInstance.destroy(); }

  liveChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: liveChartData.labels,
      datasets: [
        {
          label: 'Reach',
          data: liveChartData.reach,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,.08)',
          fill: true, tension: 0.4,
          pointRadius: 0, borderWidth: 2,
          yAxisID: 'y',
        },
        {
          label: 'Engagement %',
          data: liveChartData.engagement,
          borderColor: '#22c55e',
          borderWidth: 2, fill: false,
          tension: 0.4, pointRadius: 0,
          yAxisID: 'y2',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: { legend: { position: 'top', labels: { boxWidth: 10, color: '#94a3b8' } } },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 8, color: '#475569', font: { size: 10 } } },
        y: { position: 'left', grid: { color: 'rgba(99,102,241,.06)' }, ticks: { color: '#475569', callback: v => fmtNum(v) } },
        y2: { position: 'right', grid: { display: false }, ticks: { color: '#22c55e', callback: v => v.toFixed(1) + '%' } },
      },
    },
  });
}

function pushLivePoint(point) {
  const maxPoints = 40;
  const label = new Date(point.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  liveChartData.labels.push(label);
  liveChartData.reach.push(point.reach);
  liveChartData.engagement.push(point.engagement);

  if (liveChartData.labels.length > maxPoints) {
    liveChartData.labels.shift();
    liveChartData.reach.shift();
    liveChartData.engagement.shift();
  }

  if (liveChartInstance) {
    liveChartInstance.update('none');
  }
}

function renderHeatmap(heatmapData) {
  const container = document.getElementById('heatmap-container');
  if (!container || !heatmapData) return;

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Compute min/max for color scale
  let min = Infinity, max = -Infinity;
  for (const day of days) {
    for (const h of hours) {
      const v = heatmapData[day]?.[h] || 0;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }

  function cellColor(val) {
    const norm = max > min ? (val - min) / (max - min) : 0;
    // Blue → Indigo → Cyan gradient
    const r = Math.round(16 + norm * (99 - 16));
    const g = Math.round(27 + norm * (102 - 27));
    const b = Math.round(36 + norm * (241 - 36));
    const a = 0.1 + norm * 0.8;
    return `rgba(${r},${g},${b},${a})`;
  }

  let html = '<div class="heatmap-hour-labels">';
  for (const h of hours) {
    const label = h === 0 ? '12am' : h === 12 ? '12pm' : h < 12 ? `${h}` : `${h - 12}`;
    html += `<div class="hour-label">${h % 3 === 0 ? label : ''}</div>`;
  }
  html += '</div><div class="heatmap-grid">';

  for (const day of days) {
    html += `<div class="heatmap-row">`;
    html += `<div class="heatmap-label">${day}</div>`;
    html += `<div class="heatmap-hours">`;
    for (const h of hours) {
      const val = heatmapData[day]?.[h] || 0;
      const bg = cellColor(val);
      const tip = `${day} ${h}:00 — ${val.toFixed(2)}% eng`;
      html += `<div class="heatmap-cell" style="background:${bg}" data-tip="${tip}"></div>`;
    }
    html += `</div></div>`;
  }

  html += '</div>';
  container.innerHTML = html;

  // Find top 3 peak times
  const peaks = [];
  for (const day of days) {
    for (const h of hours) {
      peaks.push({ day, hour: h, val: heatmapData[day]?.[h] || 0 });
    }
  }
  peaks.sort((a, b) => b.val - a.val);

  const peakGrid = document.getElementById('peak-times-grid');
  if (peakGrid) {
    const top = peaks.slice(0, 6);
    peakGrid.innerHTML = top.map((p, i) => `
      <div class="peak-time-card">
        <div class="peak-time-title">#${i + 1} Peak Time</div>
        <div class="peak-time-value">${p.day} at ${p.hour}:00</div>
        <div style="font-size:.8rem;color:var(--text-muted);margin-top:4px">${p.val.toFixed(2)}% avg engagement</div>
      </div>
    `).join('');
  }
}
