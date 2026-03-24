/**
 * live.js — WebSocket live data feed with auto-reconnect
 */

let ws = null;
let liveRunning = false;
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT = 5;

let liveStats = { events: 0, totalReach: 0, totalEng: 0, viral: 0 };

function getWsUrl() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const host = location.hostname || '127.0.0.1';
  const port = location.port || '8000';
  return `${proto}://${host}:${port}/ws/live`;
}

function connectLiveFeed(platform = '') {
  // Clear any pending reconnect
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws) { ws.close(); ws = null; }

  const url = getWsUrl();
  console.log('Connecting to WebSocket:', url);

  try {
    ws = new WebSocket(url);
  } catch (e) {
    console.error('WebSocket creation failed:', e);
    showToast('WebSocket not supported — try Chrome or Firefox', 'error');
    return;
  }

  liveRunning = true;
  updateLiveBtn(true);

  ws.onopen = () => {
    reconnectAttempts = 0;
    console.log('WebSocket connected');
    showToast('Live feed connected ✓', 'success');

    if (platform) {
      ws.send(JSON.stringify({ platform }));
    }

    const list = document.getElementById('live-feed-list');
    if (list) list.innerHTML = '';

    // Keep-alive ping every 15s
    ws._pingInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ ping: true })); } catch {}
      }
    }, 15000);
  };

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'data_point' && msg.payload) {
        handleLivePoint(msg.payload);
      }
    } catch (err) {
      console.warn('WS message parse error:', err);
    }
  };

  ws.onclose = (event) => {
    clearInterval(ws?._pingInterval);
    liveRunning = false;
    updateLiveBtn(false);
    console.log('WebSocket closed. Code:', event.code, 'Reason:', event.reason);

    // Auto-reconnect if we're on the live page and didn't manually stop
    const onLivePage = document.getElementById('page-live')?.classList.contains('active');
    if (onLivePage && reconnectAttempts < MAX_RECONNECT) {
      reconnectAttempts++;
      const delay = Math.min(2000 * reconnectAttempts, 10000);
      console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT})`);
      showToast(`Reconnecting... (${reconnectAttempts}/${MAX_RECONNECT})`, 'info', 2000);
      reconnectTimer = setTimeout(() => connectLiveFeed(platform), delay);
    } else if (reconnectAttempts >= MAX_RECONNECT) {
      showToast('Live feed offline — check that backend is running on port 8000', 'error', 8000);
    }
  };

  ws.onerror = (err) => {
    console.error('WebSocket error:', err);
    // onclose will fire after onerror, so reconnect is handled there
  };
}

function disconnectLiveFeed() {
  reconnectAttempts = MAX_RECONNECT; // Prevent auto-reconnect
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws) {
    clearInterval(ws._pingInterval);
    ws.close(1000, 'User stopped');
    ws = null;
  }
  liveRunning = false;
  updateLiveBtn(false);
}

function updateLiveBtn(running) {
  const btn = document.getElementById('toggle-live-btn');
  if (!btn) return;
  if (running) {
    btn.innerHTML = `<div class="pulse-dot sm"></div> Stop Live`;
    btn.style.background = 'linear-gradient(135deg, #f43f5e, #be123c)';
    btn.style.boxShadow = '0 4px 16px rgba(244,63,94,.3)';
  } else {
    btn.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor" style="width:16px"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/></svg> Start Live`;
    btn.style.background = '';
    btn.style.boxShadow = '';
  }
}

function handleLivePoint(point) {
  liveStats.events++;
  liveStats.totalReach += point.reach || 0;
  liveStats.totalEng += point.engagement || 0;
  if (point.viral) liveStats.viral++;

  const avgReach = liveStats.totalReach / liveStats.events;
  const avgEng   = liveStats.totalEng   / liveStats.events;

  const evEl = document.getElementById('live-events');
  const arEl = document.getElementById('live-avg-reach');
  const aeEl = document.getElementById('live-avg-eng');
  const vEl  = document.getElementById('live-viral');
  if (evEl) evEl.textContent = liveStats.events.toLocaleString();
  if (arEl) arEl.textContent = fmtNum(Math.round(avgReach));
  if (aeEl) aeEl.textContent = avgEng.toFixed(2) + '%';
  if (vEl)  vEl.textContent  = liveStats.viral;

  pushLivePoint(point);
  addFeedItem(point);
}

function addFeedItem(point) {
  const list = document.getElementById('live-feed-list');
  if (!list) return;

  const colors = PLATFORM_COLORS[point.platform] || { primary: '#6366f1' };
  const item = document.createElement('div');
  item.className = `feed-item${point.viral ? ' viral' : ''}`;
  item.innerHTML = `
    <div class="feed-platform-dot" style="background:${colors.primary}"></div>
    <div class="feed-platform">${point.platform}</div>
    <div class="feed-type">${point.content_type}</div>
    <div class="feed-metrics">
      <div class="feed-metric">
        <div class="feed-metric-label">Reach</div>
        <div class="feed-metric-value">${fmtNum(point.reach)}</div>
      </div>
      <div class="feed-metric">
        <div class="feed-metric-label">Engagement</div>
        <div class="feed-metric-value">${(point.engagement||0).toFixed(2)}%</div>
      </div>
      <div class="feed-metric">
        <div class="feed-metric-label">Impressions</div>
        <div class="feed-metric-value">${fmtNum(point.impressions)}</div>
      </div>
      <div class="feed-metric">
        <div class="feed-metric-label">Likes</div>
        <div class="feed-metric-value">${fmtNum(point.likes)}</div>
      </div>
    </div>
    ${point.viral ? '<span class="feed-viral-tag">VIRAL</span>' : ''}
    <div style="font-size:.7rem;color:var(--text-muted);font-family:var(--font-mono);margin-left:auto;flex-shrink:0">
      ${new Date(point.timestamp).toLocaleTimeString()}
    </div>
  `;

  list.insertBefore(item, list.firstChild);
  while (list.children.length > 50) list.removeChild(list.lastChild);
}

function onLivePageOpen() {
  // Reset stats and chart
  liveStats = { events: 0, totalReach: 0, totalEng: 0, viral: 0 };
  liveChartData.labels = [];
  liveChartData.reach  = [];
  liveChartData.engagement = [];
  initLiveChart('live-chart');

  // Reset reconnect counter so it will connect fresh
  reconnectAttempts = 0;

  if (!liveRunning) {
    const platform = document.getElementById('live-platform-filter')?.value || '';
    connectLiveFeed(platform);
  }

  // Platform filter
  const pf = document.getElementById('live-platform-filter');
  if (pf) {
    pf.onchange = () => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ platform: pf.value }));
      }
    };
  }

  // Toggle button
  const toggleBtn = document.getElementById('toggle-live-btn');
  if (toggleBtn) {
    toggleBtn.onclick = () => {
      if (liveRunning) {
        disconnectLiveFeed();
      } else {
        reconnectAttempts = 0;
        const platform = document.getElementById('live-platform-filter')?.value || '';
        connectLiveFeed(platform);
      }
    };
  }
}

function onLivePageClose() {
  // Keep WS alive in background — do nothing
}
