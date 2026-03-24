/**
 * api.js — InsightSphere API client
 */

const API_BASE = '/api/v1';

// Platform color map
const PLATFORM_COLORS = {
  Instagram: { primary: '#e1306c', light: 'rgba(225,48,108,.15)' },
  YouTube:   { primary: "#ff0000", light: "rgba(255,0,0,.15)" },
  LinkedIn:  { primary: '#0077b5', light: 'rgba(0,119,181,.15)' },
  Twitter:   { primary: '#1da1f2', light: 'rgba(29,161,242,.15)' },
  Facebook:  { primary: '#1877f2', light: 'rgba(24,119,242,.15)' },
};

async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(API_BASE + path, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (e) {
    console.error(`API error [${path}]:`, e.message);
    throw e;
  }
}

const api = {
  // Analytics
  summary:         () => apiFetch('/analytics/summary'),
  platforms:       () => apiFetch('/analytics/platforms'),
  timeseries:      (platform = 'all') => apiFetch(`/analytics/timeseries?platform=${encodeURIComponent(platform)}`),
  heatmap:         () => apiFetch('/analytics/heatmap'),
  content:         () => apiFetch('/analytics/content'),
  raw:             (limit = 50, offset = 0, platform = '') => apiFetch(`/analytics/raw?limit=${limit}&offset=${offset}${platform ? '&platform=' + encodeURIComponent(platform) : ''}`),

  // AI
  insights:        () => apiFetch('/ai/insights'),
  report:          () => apiFetch('/ai/report'),
  chat:            (query, history = []) => apiFetch('/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ query, conversation_history: history }),
  }),

  // Forecast
  forecast:        (platform, metric, horizon, model = 'holt_winters') => apiFetch('/forecast/', {
    method: 'POST',
    body: JSON.stringify({ platform, metric, horizon_days: parseInt(horizon), model }),
  }),
  forecastAI:      (platform, metric, horizon) => apiFetch('/forecast/ai-enhanced', {
    method: 'POST',
    body: JSON.stringify({ platform, metric, horizon_days: parseInt(horizon), model: 'holt_winters' }),
  }),
  allForecasts:    (horizon = 30) => apiFetch(`/forecast/all-platforms?horizon=${horizon}`),

  // Data
  dataStatus:      () => apiFetch('/data/status'),
  resetData:       () => apiFetch('/data/reset', { method: 'POST' }),
  uploadCSV:       (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return fetch(API_BASE + '/data/upload', { method: 'POST', body: fd }).then(r => r.json());
  },

  // Stream chat with SSE
  chatStream: async function*(query, history = []) {
    const res = await fetch(API_BASE + '/ai/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, conversation_history: history }),
    });
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value);
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          if (parsed.token) yield parsed.token;
        } catch {}
      }
    }
  },
};

// Toast helper
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
  };
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// Number formatting
function fmtNum(n) {
  if (n == null || isNaN(n)) return '—';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.round(n).toLocaleString();
}

function fmtPct(n) {
  if (n == null || isNaN(n)) return '—';
  return n.toFixed(2) + '%';
}

function fmtDelta(n, suffix = '%') {
  if (n == null || isNaN(n)) return '';
  const sign = n >= 0 ? '+' : '';
  const cls = n >= 0 ? 'up' : 'down';
  const icon = n >= 0 ? '↑' : '↓';
  return { html: `<span class="kpi-delta ${cls}">${icon} ${sign}${n.toFixed(1)}${suffix}</span>`, cls };
}

function mdToHtml(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^#{1,3}\s(.+)$/gm, '<h4>$1</h4>')
    .replace(/^[\-•]\s(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
}
