/**
 * app.js — InsightSphere AI Pro Main Application
 */

// ── STATE ──────────────────────────────────────────────────────────
const state = {
  summary: null,
  platforms: null,
  chatHistory: [],
  rawPage: 0,
  rawPlatform: '',
  rawTotal: 0,
  currentPage: 'dashboard',
  dashboardLoaded: false,
};

// ── INIT ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupSidebarToggle();
  setupRefreshBtn();
  setupReportModal();
  setupDataPage();
  setupForecastPage();
  setupChatPage();

  // Load dashboard
  await loadDashboard();
});

// ── NAVIGATION ─────────────────────────────────────────────────────
function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      navigateTo(page);
    });
  });
}

async function navigateTo(page) {
  if (state.currentPage === page) return;

  // Update nav
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`[data-page="${page}"]`)?.classList.add('active');

  // Update pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  // Update title
  const titles = {
    dashboard: 'Dashboard', forecast: 'Forecast', platforms: 'Platforms',
    heatmap: 'Heatmap', live: 'Live Feed', ai: 'AI Assistant', data: 'Data',
  };
  document.getElementById('page-title').textContent = titles[page] || page;

  // Close sidebar on mobile
  document.getElementById('sidebar')?.classList.remove('open');

  const prev = state.currentPage;
  state.currentPage = page;

  // Page-specific loaders
  switch (page) {
    case 'platforms':  await loadPlatformsPage(); break;
    case 'heatmap':    await loadHeatmapPage(); break;
    case 'live':       onLivePageOpen(); break;
    case 'ai':         /* chat is ready */ break;
    case 'data':       await loadDataPage(); break;
    case 'forecast':   /* user triggers */ break;
  }

  if (prev === 'live' && page !== 'live') {
    onLivePageClose();
  }
}

// ── SIDEBAR TOGGLE ─────────────────────────────────────────────────
function setupSidebarToggle() {
  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });
}

// ── DASHBOARD ──────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const [summary, platforms, ts, content, insights] = await Promise.all([
      api.summary(),
      api.platforms(),
      api.timeseries('all'),
      api.content(),
      api.insights(),
    ]);

    state.summary = summary;
    state.platforms = platforms;

    renderKPIs(summary);
    renderInsights(insights?.insights || []);
    renderPlatformTable(platforms);
    createTimeseriesChart('timeseries-chart', ts);
    createContentChart('content-chart', content);
    updateDateRange(summary);

    state.dashboardLoaded = true;

    // Reload timeseries when platform changes
    document.getElementById('ts-platform-select')?.addEventListener('change', async (e) => {
      const data = await api.timeseries(e.target.value);
      createTimeseriesChart('timeseries-chart', data);
    });
  } catch (err) {
    showToast('Failed to load dashboard: ' + err.message, 'error');
    console.error(err);
  }
}

function updateDateRange(summary) {
  const el = document.getElementById('date-range-badge');
  if (el && summary?.date_range) {
    el.textContent = `${summary.date_range.from} → ${summary.date_range.to}`;
  }
}

function renderKPIs(s) {
  if (!s) return;

  const kpis = [
    { id: 'kpi-reach',      val: fmtNum(s.total_reach),           delta: null },
    { id: 'kpi-engagement', val: fmtPct(s.avg_engagement),        delta: null },
    { id: 'kpi-impressions',val: fmtNum(s.total_impressions),      delta: null },
    { id: 'kpi-viral',      val: s.viral_posts,                    delta: null },
    { id: 'kpi-growth',     val: (s.growth_rate > 0 ? '+' : '') + s.growth_rate.toFixed(1) + '%', delta: s.growth_rate },
    { id: 'kpi-score',      val: s.avg_performance_score?.toFixed(1) || '—', delta: null },
  ];

  for (const kpi of kpis) {
    const card = document.getElementById(kpi.id);
    if (!card) continue;
    card.classList.remove('skeleton');
    const valEl = card.querySelector('.kpi-value');
    if (valEl) valEl.textContent = kpi.val;
    const deltaEl = card.querySelector('.kpi-delta');
    if (deltaEl && kpi.delta != null) {
      const { html } = fmtDelta(kpi.delta);
      deltaEl.innerHTML = html;
    }
  }
}

function renderInsights(insights) {
  const list = document.getElementById('insights-list');
  if (!list) return;
  if (!insights.length) {
    list.innerHTML = '<div class="insight-item" style="color:var(--text-muted)">No insights available</div>';
    return;
  }
  list.innerHTML = insights.map(i => `<div class="insight-item">${i}</div>`).join('');
}

function renderPlatformTable(platforms) {
  const tbody = document.getElementById('platform-table-body');
  if (!tbody || !platforms) return;

  const platColors = {
    Instagram: '#e1306c', YouTube: '#ff0000',
    LinkedIn: '#0077b5', Twitter: '#1da1f2', Facebook: '#1877f2',
  };

  tbody.innerHTML = platforms.map((p, i) => {
    const color = platColors[p.platform] || '#6366f1';
    const score = (p.avg_score || 0).toFixed(1);
    const pct = Math.min(100, parseFloat(score));
    return `
      <tr style="animation-delay:${i * .05}s">
        <td style="color:var(--text-muted);font-family:var(--font-mono)">${i + 1}</td>
        <td>
          <div class="platform-badge">
            <div class="plat-dot" style="background:${color}"></div>
            ${p.platform}
          </div>
        </td>
        <td style="font-family:var(--font-mono)">${fmtNum(p.avg_reach)}</td>
        <td style="color:var(--accent-cyan);font-family:var(--font-mono);font-weight:600">${fmtPct(p.avg_engagement)}</td>
        <td>${p.post_count.toLocaleString()}</td>
        <td><span class="viral-badge ${p.viral_count > 0 ? 'yes' : 'no'}">${p.viral_count > 0 ? '🔥 ' + p.viral_count : '—'}</span></td>
        <td>
          <div class="score-bar">
            <div class="score-track">
              <div class="score-fill" style="width:${pct}%;background:${color}"></div>
            </div>
            <span style="font-size:.8rem;font-family:var(--font-mono);color:var(--text-secondary)">${score}</span>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ── REFRESH BTN ────────────────────────────────────────────────────
function setupRefreshBtn() {
  document.getElementById('refresh-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('refresh-btn');
    btn?.querySelector('svg')?.classList.add('spin');
    await loadDashboard();
    setTimeout(() => btn?.querySelector('svg')?.classList.remove('spin'), 600);
    showToast('Data refreshed', 'success');
  });

  document.getElementById('refresh-insights-btn')?.addEventListener('click', async () => {
    const list = document.getElementById('insights-list');
    if (list) list.innerHTML = '<div class="insight-item skeleton-text"></div><div class="insight-item skeleton-text"></div><div class="insight-item skeleton-text"></div>';
    try {
      const data = await api.insights();
      renderInsights(data?.insights || []);
    } catch {
      showToast('Failed to load insights', 'error');
    }
  });
}

// ── PLATFORMS PAGE ─────────────────────────────────────────────────
async function loadPlatformsPage() {
  try {
    const platforms = state.platforms || await api.platforms();
    renderPlatformCards(platforms);
    createPlatformBarChart('platform-reach-chart', platforms, 'avg_reach');
    createPlatformBarChart('platform-eng-chart', platforms, 'avg_engagement');
  } catch (err) {
    showToast('Failed to load platforms: ' + err.message, 'error');
  }
}

function renderPlatformCards(platforms) {
  const grid = document.getElementById('platform-cards-grid');
  if (!grid) return;

  grid.innerHTML = platforms.map((p, i) => `
    <div class="plat-card plat-${p.platform} fade-in" style="animation-delay:${i * .08}s">
      <div class="plat-card-top">
        <div class="plat-name">${p.platform}</div>
        <div class="plat-rank">#${i + 1}</div>
      </div>
      <div class="plat-metrics">
        <div>
          <div class="plat-metric-label">Avg Reach</div>
          <div class="plat-metric-value">${fmtNum(p.avg_reach)}</div>
        </div>
        <div>
          <div class="plat-metric-label">Engagement</div>
          <div class="plat-metric-value" style="color:var(--accent-cyan)">${fmtPct(p.avg_engagement)}</div>
        </div>
        <div>
          <div class="plat-metric-label">Posts</div>
          <div class="plat-metric-value">${p.post_count.toLocaleString()}</div>
        </div>
        <div>
          <div class="plat-metric-label">Viral</div>
          <div class="plat-metric-value" style="color:var(--accent-orange)">${p.viral_count}</div>
        </div>
      </div>
    </div>
  `).join('');
}

// ── HEATMAP PAGE ───────────────────────────────────────────────────
async function loadHeatmapPage() {
  try {
    const data = await api.heatmap();
    renderHeatmap(data);
  } catch (err) {
    showToast('Failed to load heatmap: ' + err.message, 'error');
  }
}

// ── FORECAST PAGE ──────────────────────────────────────────────────
function setupForecastPage() {
  document.getElementById('run-forecast-btn')?.addEventListener('click', runForecast);
}

async function runForecast() {
  const platform = document.getElementById('forecast-platform').value;
  const metric   = document.getElementById('forecast-metric').value;
  const horizon  = document.getElementById('forecast-horizon').value;
  const btn      = document.getElementById('run-forecast-btn');

  btn.textContent = 'Running...';
  btn.disabled = true;

  try {
    const data = await api.forecastAI(platform, metric, horizon);

    // Stats
    const statsEl = document.getElementById('forecast-stats');
    if (statsEl) statsEl.style.display = 'grid';
    document.getElementById('fstat-accuracy').textContent = data.accuracy_score + '%';
    document.getElementById('fstat-trend').textContent = data.trend_direction === 'up' ? '↑ Upward' : data.trend_direction === 'down' ? '↓ Downward' : '→ Flat';
    const growthEl = document.getElementById('fstat-growth');
    growthEl.textContent = (data.growth_pct > 0 ? '+' : '') + data.growth_pct.toFixed(1) + '%';
    growthEl.className = 'fstat-value ' + (data.growth_pct > 0 ? 'positive' : data.growth_pct < 0 ? 'negative' : '');
    document.getElementById('fstat-momentum').textContent = data.momentum?.toFixed(2) || '—';
    document.getElementById('fstat-volatility').textContent = data.volatility?.toFixed(1) + '%' || '—';
    document.getElementById('fstat-datapoints').textContent = data.data_points || '—';

    // AI narrative
    if (data.ai_narrative) {
      const narrativeEl = document.getElementById('ai-narrative');
      if (narrativeEl) narrativeEl.style.display = 'block';
      document.getElementById('narrative-text').textContent = data.ai_narrative;
    }

    // Chart
    const title = `${platform === 'all' ? 'All Platforms' : platform} — ${metric} forecast (${horizon} days)`;
    document.getElementById('forecast-chart-title').textContent = title;
    createForecastChart('forecast-chart', data);

    showToast('Forecast complete!', 'success');
  } catch (err) {
    showToast('Forecast failed: ' + err.message, 'error');
  } finally {
    btn.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor" style="width:16px"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/></svg> Run AI Forecast`;
    btn.disabled = false;
  }
}

// ── AI CHAT ────────────────────────────────────────────────────────
function setupChatPage() {
  const input = document.getElementById('chat-input');
  const btn = document.getElementById('send-chat-btn');

  btn?.addEventListener('click', sendChat);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  });

  // Auto-resize textarea
  input?.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 140) + 'px';
  });

  // Quick questions
  document.querySelectorAll('.quick-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = btn.dataset.q;
      document.getElementById('chat-input').value = q;
      sendChat();
    });
  });
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const query = input?.value?.trim();
  if (!query) return;

  input.value = '';
  input.style.height = 'auto';

  // Add user message
  addChatMessage(query, 'user');

  // Add AI typing indicator
  const aiMsgEl = addChatMessage('', 'ai', true);

  try {
    let fullText = '';
    const stream = api.chatStream(query, state.chatHistory);
    for await (const token of stream) {
      fullText += token;
      const bubble = aiMsgEl.querySelector('.msg-bubble');
      if (bubble) bubble.innerHTML = mdToHtml(fullText);
      // Scroll to bottom
      const win = document.getElementById('chat-window');
      if (win) win.scrollTop = win.scrollHeight;
    }

    // Update history
    state.chatHistory.push({ role: 'user', content: query });
    state.chatHistory.push({ role: 'assistant', content: fullText });
    if (state.chatHistory.length > 20) state.chatHistory = state.chatHistory.slice(-20);

    // Remove typing indicator, update with final
    const bubble = aiMsgEl.querySelector('.msg-bubble');
    if (bubble) {
      bubble.innerHTML = mdToHtml(fullText || '⚠️ No response received.');
      const typer = bubble.querySelector('.typing-indicator');
      if (typer) typer.remove();
    }
  } catch (err) {
    const bubble = aiMsgEl.querySelector('.msg-bubble');
    if (bubble) bubble.innerHTML = `<span style="color:#f43f5e">Error: ${err.message}</span>`;
  }

  const win = document.getElementById('chat-window');
  if (win) win.scrollTop = win.scrollHeight;
}

function addChatMessage(text, role, typing = false) {
  const win = document.getElementById('chat-window');
  if (!win) return;

  // Hide welcome on first message
  const welcome = win.querySelector('.chat-welcome');
  if (welcome) welcome.style.display = 'none';

  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-message ${role}`;

  const avatarDiv = document.createElement('div');
  avatarDiv.className = `msg-avatar ${role === 'ai' ? 'ai-av' : 'user-av'}`;
  avatarDiv.textContent = role === 'ai' ? 'AI' : '👤';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';

  if (typing) {
    bubble.innerHTML = `<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
  } else {
    bubble.innerHTML = mdToHtml(text);
  }

  msgDiv.appendChild(avatarDiv);
  msgDiv.appendChild(bubble);

  const messagesDiv = document.getElementById('chat-messages');
  if (messagesDiv) {
    messagesDiv.appendChild(msgDiv);
    win.scrollTop = win.scrollHeight;
  }

  return msgDiv;
}

// ── REPORT MODAL ───────────────────────────────────────────────────
function setupReportModal() {
  const modal = document.getElementById('report-modal');
  const openBtn = document.getElementById('generate-report-btn');
  const closeBtn = document.getElementById('close-report-modal');

  openBtn?.addEventListener('click', async () => {
    modal.style.display = 'flex';
    document.getElementById('report-content').innerHTML = `
      <div class="report-loading">
        <div class="spinner"></div>
        <p>Claude is generating your report...</p>
      </div>`;
    try {
      const data = await api.report();
      document.getElementById('report-content').innerHTML =
        `<div class="report-content-rendered">${mdToHtml(data.report || 'No report generated.')}</div>`;
    } catch (err) {
      document.getElementById('report-content').innerHTML =
        `<div style="color:#f43f5e;padding:20px">Failed to generate report: ${err.message}</div>`;
    }
  });

  closeBtn?.addEventListener('click', () => { modal.style.display = 'none'; });
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });
}

// ── DATA PAGE ──────────────────────────────────────────────────────
async function loadDataPage() {
  await loadDataStatus();
  await loadRawData(0);
}

async function loadDataStatus() {
  try {
    const data = await api.dataStatus();
    const el = document.getElementById('data-status-info');
    if (!el) return;
    if (!data.loaded) {
      el.innerHTML = '<div class="data-info-item"><span class="data-info-key">Status</span><span class="data-info-val">No data loaded</span></div>';
      return;
    }
    el.innerHTML = `
      <div class="data-info-item"><span class="data-info-key">Status</span><span class="data-info-val" style="color:var(--accent-green)">✓ Loaded</span></div>
      <div class="data-info-item"><span class="data-info-key">Records</span><span class="data-info-val">${data.records?.toLocaleString()}</span></div>
      <div class="data-info-item"><span class="data-info-key">Platforms</span><span class="data-info-val">${(data.platforms || []).join(', ')}</span></div>
      <div class="data-info-item"><span class="data-info-key">Columns</span><span class="data-info-val">${(data.columns || []).length}</span></div>
    `;
  } catch {}
}

async function loadRawData(offset = 0, platform = '') {
  const limit = 50;
  try {
    const data = await api.raw(limit, offset, platform);
    state.rawTotal = data.total;
    state.rawPage = Math.floor(offset / limit);

    document.getElementById('raw-count').textContent = `${data.total.toLocaleString()} total records`;

    const tbody = document.getElementById('raw-data-body');
    if (!tbody) return;

    if (!data.records?.length) {
      tbody.innerHTML = '<tr><td colspan="11" class="loading-cell">No records found</td></tr>';
      return;
    }

    tbody.innerHTML = data.records.map(r => `
      <tr>
        <td style="font-family:var(--font-mono);font-size:.75rem;color:var(--text-muted)">${r.timestamp.replace('T', ' ')}</td>
        <td><span style="color:${PLATFORM_COLORS[r.platform]?.primary || '#6366f1'};font-weight:600">${r.platform}</span></td>
        <td style="color:var(--text-muted)">${r.content_type}</td>
        <td style="font-family:var(--font-mono)">${fmtNum(r.reach)}</td>
        <td style="font-family:var(--font-mono)">${fmtNum(r.impressions)}</td>
        <td style="color:var(--accent-cyan);font-family:var(--font-mono)">${r.engagement.toFixed(2)}%</td>
        <td style="font-family:var(--font-mono)">${fmtNum(r.likes)}</td>
        <td style="font-family:var(--font-mono)">${fmtNum(r.comments)}</td>
        <td style="font-family:var(--font-mono)">${fmtNum(r.shares)}</td>
        <td style="font-family:var(--font-mono)">${r.performance_score.toFixed(1)}</td>
        <td>${r.viral ? '<span class="viral-badge yes">🔥 Yes</span>' : '<span class="viral-badge no">—</span>'}</td>
      </tr>
    `).join('');

    renderPagination(data.total, limit, offset);
  } catch (err) {
    console.error('Raw data error:', err);
  }
}

function renderPagination(total, limit, offset) {
  const container = document.getElementById('raw-pagination');
  if (!container) return;

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit);

  if (totalPages <= 1) { container.innerHTML = ''; return; }

  let html = '';
  html += `<button class="page-btn" onclick="loadRawData(${Math.max(0, offset - limit)}, '${state.rawPlatform}')" ${offset === 0 ? 'disabled' : ''}>← Prev</button>`;

  const start = Math.max(0, currentPage - 2);
  const end = Math.min(totalPages - 1, currentPage + 2);
  for (let i = start; i <= end; i++) {
    html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="loadRawData(${i * limit}, '${state.rawPlatform}')">${i + 1}</button>`;
  }

  html += `<button class="page-btn" onclick="loadRawData(${Math.min((totalPages - 1) * limit, offset + limit)}, '${state.rawPlatform}')" ${offset + limit >= total ? 'disabled' : ''}>Next →</button>`;
  container.innerHTML = html;
}

function setupDataPage() {
  // CSV Upload
  const csvInput = document.getElementById('csv-upload');
  const uploadZone = document.getElementById('upload-zone');
  const statusEl = document.getElementById('upload-status');

  csvInput?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    statusEl.textContent = 'Uploading...';
    statusEl.className = 'upload-status';
    try {
      const res = await api.uploadCSV(file);
      if (res.success) {
        statusEl.textContent = `✓ Loaded ${res.records.toLocaleString()} records`;
        statusEl.className = 'upload-status success';
        showToast(res.message, 'success');
        await loadDataStatus();
        await loadRawData(0);
        // Reload dashboard
        state.dashboardLoaded = false;
        await loadDashboard();
      } else {
        statusEl.textContent = '✗ ' + (res.detail || 'Upload failed');
        statusEl.className = 'upload-status error';
      }
    } catch (err) {
      statusEl.textContent = '✗ ' + err.message;
      statusEl.className = 'upload-status error';
    }
  });

  // Drag and drop
  uploadZone?.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
  uploadZone?.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) {
      csvInput.files = e.dataTransfer.files;
      csvInput.dispatchEvent(new Event('change'));
    }
  });

  // Reset
  document.getElementById('reset-data-btn')?.addEventListener('click', async () => {
    try {
      await api.resetData();
      showToast('Reset to demo dataset', 'success');
      await loadDataStatus();
      await loadRawData(0);
      state.dashboardLoaded = false;
      await loadDashboard();
    } catch (err) {
      showToast('Reset failed: ' + err.message, 'error');
    }
  });

  // Raw data platform filter
  document.getElementById('raw-platform-filter')?.addEventListener('change', (e) => {
    state.rawPlatform = e.target.value;
    loadRawData(0, state.rawPlatform);
  });
}

// ── HEALTH CHECK ───────────────────────────────────────────────────
async function checkHealth() {
  try {
    const res = await fetch('/health');
    const data = await res.json();
    const dot = document.querySelector('.status-dot');
    const text = document.querySelector('.status-text');
    if (dot && text) {
      dot.style.background = data.ai_enabled ? 'var(--accent-green)' : 'var(--accent-orange)';
      text.textContent = data.ai_enabled ? 'AI Connected' : 'AI: Local Mode';
    }
  } catch {
    const dot = document.querySelector('.status-dot');
    if (dot) dot.style.background = '#f43f5e';
    document.querySelector('.status-text').textContent = 'Backend Offline';
  }
}

checkHealth();
setInterval(checkHealth, 30000);
