// Embedded Quhip Dashboard UI
// Edge-native single page app served directly by Hono

export function renderDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quhip — Cookieless Privacy-First Web Analytics</title>
  <style>
    :root {
      --bg: #09090b;
      --card-bg: #18181b;
      --card-border: #27272a;
      --text: #f4f4f5;
      --text-muted: #a1a1aa;
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --danger: #ef4444;
      --success: #10b981;
      --warning: #f59e0b;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: var(--font); line-height: 1.5; min-height: 100vh; }
    .container { max-width: 1200px; margin: 0 auto; padding: 24px 20px; }
    header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 20px; border-bottom: 1px solid var(--card-border); margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
    .brand { display: flex; align-items: center; gap: 12px; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
    .brand-badge { background: rgba(59, 130, 246, 0.15); color: var(--primary); font-size: 11px; padding: 3px 8px; border-radius: 999px; border: 1px solid rgba(59, 130, 246, 0.3); font-weight: 600; }
    .header-controls { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    select, button, input { font-family: inherit; font-size: 13px; }
    select, input[type="text"], input[type="password"], input[type="date"] {
      background: var(--card-bg); color: var(--text); border: 1px solid var(--card-border); border-radius: 6px; padding: 7px 12px; outline: none;
    }
    select:focus, input:focus { border-color: var(--primary); }
    button {
      background: var(--primary); color: white; border: none; border-radius: 6px; padding: 7px 14px; font-weight: 500; cursor: pointer; transition: background 0.15s;
    }
    button:hover { background: var(--primary-hover); }
    button.btn-secondary { background: var(--card-bg); color: var(--text); border: 1px solid var(--card-border); }
    button.btn-secondary:hover { background: #27272a; }
    button.btn-danger { background: var(--danger); }
    
    .grid-4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 10px; padding: 18px 20px; }
    .stat-title { font-size: 12px; color: var(--text-muted); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 6px; }
    .stat-value { font-size: 26px; font-weight: 700; letter-spacing: -0.5px; color: #fff; }
    .stat-subtitle { font-size: 12px; color: var(--text-muted); margin-top: 4px; }

    .nav-tabs { display: flex; gap: 8px; border-bottom: 1px solid var(--card-border); margin-bottom: 20px; overflow-x: auto; }
    .nav-tab { padding: 10px 16px; cursor: pointer; border-bottom: 2px solid transparent; font-weight: 500; font-size: 14px; color: var(--text-muted); white-space: nowrap; }
    .nav-tab.active { color: var(--primary); border-bottom-color: var(--primary); }
    .tab-content { display: none; }
    .tab-content.active { display: block; }

    .card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 10px; padding: 20px; margin-bottom: 20px; }
    .card-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }

    table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }
    th { padding: 10px 12px; border-bottom: 1px solid var(--card-border); color: var(--text-muted); font-weight: 600; }
    td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); }
    tr:hover td { background: rgba(255,255,255,0.02); }

    .badge { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .badge-outbound { background: rgba(245, 158, 11, 0.15); color: var(--warning); border: 1px solid rgba(245, 158, 11, 0.3); }
    .badge-rage { background: rgba(239, 68, 68, 0.15); color: var(--danger); border: 1px solid rgba(239, 68, 68, 0.3); }
    .badge-dead { background: rgba(161, 161, 170, 0.15); color: var(--text-muted); border: 1px solid rgba(161, 161, 170, 0.3); }
    .suppressed-badge { color: #71717a; font-style: italic; font-size: 12px; }

    .heatmap-canvas-container { position: relative; width: 100%; max-width: 800px; height: 500px; background: #000; border-radius: 8px; border: 1px solid var(--card-border); overflow: hidden; margin: 0 auto; }
    canvas#heatmapCanvas { width: 100%; height: 100%; display: block; }
    .depth-bar-container { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
    .depth-bar-row { display: flex; align-items: center; gap: 12px; font-size: 13px; }
    .depth-bar-label { width: 70px; color: var(--text-muted); }
    .depth-bar-track { flex: 1; height: 12px; background: #27272a; border-radius: 6px; overflow: hidden; }
    .depth-bar-fill { height: 100%; background: var(--primary); border-radius: 6px; }
    .depth-bar-val { width: 50px; text-align: right; font-weight: 600; }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: none; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
    .modal { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; width: 100%; max-width: 500px; padding: 24px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
    .modal-title { font-size: 18px; font-weight: 700; margin-bottom: 16px; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 6px; font-weight: 500; }
    .form-group input, .form-group select { width: 100%; }

    pre.code-snippet { background: #000; border: 1px solid var(--card-border); border-radius: 6px; padding: 12px; font-family: monospace; font-size: 12px; color: #38bdf8; overflow-x: auto; white-space: pre-wrap; word-break: break-all; margin: 12px 0; }

    /* Auth screen */
    .auth-container { max-width: 400px; margin: 100px auto; padding: 32px; background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; text-align: center; }
    .auth-container h2 { font-size: 22px; margin-bottom: 8px; }
    .auth-container p { font-size: 13px; color: var(--text-muted); margin-bottom: 20px; }
  </style>
</head>
<body>

  <!-- Auth Screen -->
  <div id="authScreen" class="auth-container" style="display: none;">
    <div class="brand" style="justify-content: center; margin-bottom: 12px;">
      <span>Quhip</span>
      <span class="brand-badge">V1</span>
    </div>
    <h2 id="authHeading">Owner Login</h2>
    <p id="authSubheading">Enter credentials to manage your sites and analytics</p>
    <div class="form-group" style="text-align: left;">
      <label>Username</label>
      <input type="text" id="authUsername" placeholder="e.g. admin" autocomplete="username">
    </div>
    <div class="form-group" style="text-align: left;">
      <label>Password</label>
      <input type="password" id="authPassword" placeholder="••••••••" autocomplete="current-password">
    </div>
    <button id="authBtn" style="width: 100%; padding: 10px; margin-top: 8px;">Login</button>
    <div id="authError" style="color: var(--danger); font-size: 12px; margin-top: 12px; display: none;"></div>
  </div>

  <!-- Main Dashboard App -->
  <div id="appScreen" class="container" style="display: none;">
    <header>
      <div class="brand">
        <span>Quhip</span>
        <span class="brand-badge">Privacy Analytics</span>
      </div>
      <div class="header-controls">
        <select id="siteSelect"></select>
        <button id="newSiteBtn" class="btn-secondary">+ New Site</button>
        <select id="dateRangeSelect">
          <option value="7">Last 7 days</option>
          <option value="30" selected>Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
        <button id="logoutBtn" class="btn-secondary">Logout</button>
      </div>
    </header>

    <!-- Top Key Metrics -->
    <div class="grid-4">
      <div class="stat-card">
        <div class="stat-title">Pageviews</div>
        <div class="stat-value" id="statPageviews">-</div>
        <div class="stat-subtitle" id="statPagesPerSession">- pages / session</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Daily Sessions</div>
        <div class="stat-value" id="statSessions">-</div>
        <div class="stat-subtitle">Approximate uniques</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Bounce Rate</div>
        <div class="stat-value" id="statBounceRate">-</div>
        <div class="stat-subtitle">&lt; 10s & no interaction</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Active Time on Page</div>
        <div class="stat-value" id="statActiveTime">-</div>
        <div class="stat-subtitle" id="statMedianTime">Median: -</div>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="nav-tabs">
      <div class="nav-tab active" data-tab="pagesTab">Pages & Overview</div>
      <div class="nav-tab" data-tab="elementsTab">Element CTR Table</div>
      <div class="nav-tab" data-tab="heatmapsTab">Heatmaps & Scroll</div>
      <div class="nav-tab" data-tab="attributionTab">Attribution & UTM</div>
      <div class="nav-tab" data-tab="pathsTab">Top Paths</div>
      <div class="nav-tab" data-tab="goalsTab">Goals</div>
      <div class="nav-tab" data-tab="settingsTab">Site Settings & Snippet</div>
    </div>

    <!-- Tab 1: Pages & Overview -->
    <div id="pagesTab" class="tab-content active">
      <div class="card">
        <div class="card-title">Top Pages</div>
        <div style="overflow-x: auto;">
          <table>
            <thead>
              <tr>
                <th>Page Path</th>
                <th>Pageviews</th>
                <th>Sessions</th>
                <th>Entries</th>
                <th>Exits</th>
                <th>Bounce Rate</th>
                <th>Avg Active Time</th>
                <th>Median Active Time</th>
              </tr>
            </thead>
            <tbody id="pagesTableBody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Tab 2: Element CTR Table (§7 Epic CTR data) -->
    <div id="elementsTab" class="tab-content">
      <div class="card">
        <div class="card-title">
          <span>Automatic Element CTR</span>
          <span style="font-size: 12px; color: var(--text-muted); font-weight: 400;">
            Primary CTR = Sessions Clicked / Sessions Saw Element (IntersectionObserver)
          </span>
        </div>
        <div style="overflow-x: auto;">
          <table>
            <thead>
              <tr>
                <th>Path</th>
                <th>Element Label / Selector</th>
                <th>Element Views</th>
                <th>Sessions Clicked</th>
                <th>CTR (Seen)</th>
                <th>CTR (Pageviews)</th>
                <th>Total Clicks</th>
                <th>Rage Clicks</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="elementsTableBody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Tab 3: Heatmaps & Scroll -->
    <div id="heatmapsTab" class="tab-content">
      <div class="card">
        <div class="card-title">
          <span>Click Heatmap Overlay</span>
          <span id="heatmapStatus" style="font-size: 12px; color: var(--text-muted); font-weight: 400;"></span>
        </div>
        <div class="heatmap-canvas-container">
          <canvas id="heatmapCanvas" width="800" height="500"></canvas>
        </div>
        <div style="margin-top: 24px;">
          <h4 style="font-size: 14px; margin-bottom: 12px;">Scroll Depth Distribution</h4>
          <div class="depth-bar-container">
            <div class="depth-bar-row">
              <div class="depth-bar-label">25% Depth</div>
              <div class="depth-bar-track"><div id="depthFill25" class="depth-bar-fill" style="width: 0%;"></div></div>
              <div id="depthVal25" class="depth-bar-val">0%</div>
            </div>
            <div class="depth-bar-row">
              <div class="depth-bar-label">50% Depth</div>
              <div class="depth-bar-track"><div id="depthFill50" class="depth-bar-fill" style="width: 0%;"></div></div>
              <div id="depthVal50" class="depth-bar-val">0%</div>
            </div>
            <div class="depth-bar-row">
              <div class="depth-bar-label">75% Depth</div>
              <div class="depth-bar-track"><div id="depthFill75" class="depth-bar-fill" style="width: 0%;"></div></div>
              <div id="depthVal75" class="depth-bar-val">0%</div>
            </div>
            <div class="depth-bar-row">
              <div class="depth-bar-label">100% Depth</div>
              <div class="depth-bar-track"><div id="depthFill100" class="depth-bar-fill" style="width: 0%;"></div></div>
              <div id="depthVal100" class="depth-bar-val">0%</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab 4: Attribution & UTM -->
    <div id="attributionTab" class="tab-content">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 20px;">
        <div class="card">
          <div class="card-title">Channel Grouping</div>
          <table>
            <thead><tr><th>Channel</th><th>Sessions</th><th>Pageviews</th></tr></thead>
            <tbody id="channelsTableBody"></tbody>
          </table>
        </div>
        <div class="card">
          <div class="card-title">Top Referrer Sources</div>
          <table>
            <thead><tr><th>Source</th><th>Sessions</th></tr></thead>
            <tbody id="sourcesTableBody"></tbody>
          </table>
        </div>
        <div class="card">
          <div class="card-title">Top Campaigns (UTM)</div>
          <table>
            <thead><tr><th>Campaign</th><th>Sessions</th></tr></thead>
            <tbody id="campaignsTableBody"></tbody>
          </table>
        </div>
        <div class="card">
          <div class="card-title">Device & Browser Context</div>
          <table>
            <thead><tr><th>Type</th><th>Value</th><th>Sessions</th></tr></thead>
            <tbody id="contextTableBody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Tab 5: Top Paths (§6) -->
    <div id="pathsTab" class="tab-content">
      <div class="card">
        <div class="card-title">Top Aggregated 2- & 3-Page Paths (>= 5 sessions)</div>
        <table>
          <thead><tr><th>Length</th><th>Path Sequence</th><th>Sessions</th></tr></thead>
          <tbody id="pathsTableBody"></tbody>
        </table>
      </div>
    </div>

    <!-- Tab 6: Goals -->
    <div id="goalsTab" class="tab-content">
      <div class="card">
        <div class="card-title">
          <span>Site Goals & Conversions</span>
          <button id="addGoalBtn" class="btn-secondary">+ Add Goal</button>
        </div>
        <table>
          <thead><tr><th>Goal Name</th><th>Type</th><th>Target</th><th>Conversions</th><th>Conversion Rate</th><th>Action</th></tr></thead>
          <tbody id="goalsTableBody"></tbody>
        </table>
      </div>
    </div>

    <!-- Tab 7: Site Settings & Snippet -->
    <div id="settingsTab" class="tab-content">
      <div class="card">
        <div class="card-title">Integration Code</div>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">
          Paste this script tag into the <code>&lt;head&gt;</code> of your website. Cookieless, tiny (< 10 KB gzipped), non-blocking.
        </p>
        <pre id="snippetCode" class="code-snippet"></pre>
        <div style="margin-top: 16px;">
          <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;">
            <input type="checkbox" id="consentBannerToggle" style="accent-color: var(--primary);">
            <span>Enable Optional Consent Banner (Off by default, §10)</span>
          </label>
        </div>
        <button id="saveSiteSettingsBtn" style="margin-top: 14px;">Save Settings</button>
      </div>
    </div>
  </div>

  <!-- Modal: New Site -->
  <div id="newSiteModal" class="modal-overlay">
    <div class="modal">
      <div class="modal-title">Create New Site</div>
      <div class="form-group">
        <label>Site Name</label>
        <input type="text" id="newSiteName" placeholder="e.g. TehWiz Portfolio">
      </div>
      <div class="form-group">
        <label>Domain</label>
        <input type="text" id="newSiteDomain" placeholder="e.g. tehwiz.com">
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
        <button id="cancelSiteBtn" class="btn-secondary">Cancel</button>
        <button id="createSiteBtn">Create Site</button>
      </div>
    </div>
  </div>

  <!-- Modal: Add Goal -->
  <div id="addGoalModal" class="modal-overlay">
    <div class="modal">
      <div class="modal-title">Create Site Goal</div>
      <div class="form-group">
        <label>Goal Name</label>
        <input type="text" id="newGoalName" placeholder="e.g. Signup Button Click">
      </div>
      <div class="form-group">
        <label>Goal Type</label>
        <select id="newGoalType">
          <option value="click">Element Click</option>
          <option value="path">Page Path Visit</option>
          <option value="outbound">Outbound Link Domain</option>
        </select>
      </div>
      <div class="form-group">
        <label>Target</label>
        <input type="text" id="newGoalTarget" placeholder="e.g. signup-btn or /thank-you or github.com">
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
        <button id="cancelGoalBtn" class="btn-secondary">Cancel</button>
        <button id="saveGoalBtn">Save Goal</button>
      </div>
    </div>
  </div>

  <script>
    (function() {
      let authToken = sessionStorage.getItem('quhip_token');
      let currentSites = [];
      let selectedSiteId = null;

      // DOM Elements
      const authScreen = document.getElementById('authScreen');
      const appScreen = document.getElementById('appScreen');
      const authHeading = document.getElementById('authHeading');
      const authSubheading = document.getElementById('authSubheading');
      const authBtn = document.getElementById('authBtn');
      const authUsername = document.getElementById('authUsername');
      const authPassword = document.getElementById('authPassword');
      const authError = document.getElementById('authError');
      const siteSelect = document.getElementById('siteSelect');
      const dateRangeSelect = document.getElementById('dateRangeSelect');
      const logoutBtn = document.getElementById('logoutBtn');
      const newSiteBtn = document.getElementById('newSiteBtn');
      const newSiteModal = document.getElementById('newSiteModal');
      const createSiteBtn = document.getElementById('createSiteBtn');
      const cancelSiteBtn = document.getElementById('cancelSiteBtn');
      const addGoalBtn = document.getElementById('addGoalBtn');
      const addGoalModal = document.getElementById('addGoalModal');
      const saveGoalBtn = document.getElementById('saveGoalBtn');
      const cancelGoalBtn = document.getElementById('cancelGoalBtn');

      let isSetupMode = false;

      async function api(path, opts = {}) {
        opts.headers = opts.headers || {};
        if (authToken) {
          opts.headers['Authorization'] = 'Bearer ' + authToken;
        }
        if (opts.body && typeof opts.body === 'object') {
          opts.headers['Content-Type'] = 'application/json';
          opts.body = JSON.stringify(opts.body);
        }
        const res = await fetch(path, opts);
        if (res.status === 401) {
          sessionStorage.removeItem('quhip_token');
          authToken = null;
          showAuthScreen();
          throw new Error('Unauthorized');
        }
        let data;
        try {
          data = await res.json();
        } catch {
          data = { error: 'Server error (' + res.status + ')' };
        }
        if (!res.ok) {
          throw new Error(data.error || ('Request failed (' + res.status + ')'));
        }
        return data;
      }

      async function init() {
        try {
          const res = await fetch('/api/auth/status');
          let status;
          try {
            status = await res.json();
          } catch {
            throw new Error('Server returned invalid response (' + res.status + ')');
          }
          if (!res.ok) {
            throw new Error(status.error || 'Server error checking status');
          }
          if (!status.hasOwner) {
            isSetupMode = true;
            authHeading.textContent = 'Setup Quhip Owner Account';
            authSubheading.textContent = 'Create your initial administrator account';
            authBtn.textContent = 'Create Account';
            showAuthScreen();
            return;
          }

          if (!authToken) {
            showAuthScreen();
            return;
          }

          try {
            const me = await api('/api/auth/me');
            if (me.ok) {
              showApp();
            } else {
              showAuthScreen();
            }
          } catch {
            showAuthScreen();
          }
        } catch (err) {
          showAuthScreen();
          authError.textContent = 'Connection error: ' + err.message + '. Please ensure Quhip server is running and refresh.';
          authError.style.display = 'block';
        }
      }

      function showAuthScreen() {
        authScreen.style.display = 'block';
        appScreen.style.display = 'none';
      }

      function showApp() {
        authScreen.style.display = 'none';
        appScreen.style.display = 'block';
        loadSites();
      }

      authBtn.onclick = async () => {
        authError.style.display = 'none';
        const username = authUsername.value.trim();
        const password = authPassword.value;
        const endpoint = isSetupMode ? '/api/auth/setup' : '/api/auth/login';

        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Authentication failed');

          authToken = data.token;
          sessionStorage.setItem('quhip_token', authToken);
          showApp();
        } catch (err) {
          authError.textContent = err.message;
          authError.style.display = 'block';
        }
      };

      logoutBtn.onclick = async () => {
        try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
        sessionStorage.removeItem('quhip_token');
        authToken = null;
        showAuthScreen();
      };

      // Sites
      async function loadSites() {
        const res = await api('/api/dashboard/sites');
        currentSites = res.sites || [];
        siteSelect.innerHTML = '';
        if (currentSites.length === 0) {
          newSiteModal.style.display = 'flex';
          return;
        }
        currentSites.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.id;
          opt.textContent = s.name + ' (' + s.domain + ')';
          siteSelect.appendChild(opt);
        });
        selectedSiteId = currentSites[0].id;
        loadDashboardData();
      }

      siteSelect.onchange = () => {
        selectedSiteId = siteSelect.value;
        loadDashboardData();
      };

      dateRangeSelect.onchange = () => {
        loadDashboardData();
      };

      newSiteBtn.onclick = () => { newSiteModal.style.display = 'flex'; };
      cancelSiteBtn.onclick = () => { newSiteModal.style.display = 'none'; };
      createSiteBtn.onclick = async () => {
        const name = document.getElementById('newSiteName').value.trim();
        const domain = document.getElementById('newSiteDomain').value.trim();
        if (!name || !domain) return alert('Name and domain required');
        await api('/api/dashboard/sites', {
          method: 'POST',
          body: { name, domain }
        });
        newSiteModal.style.display = 'none';
        loadSites();
      };

      // Tab switching
      document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.onclick = () => {
          document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
          tab.classList.add('active');
          document.getElementById(tab.getAttribute('data-tab')).classList.add('active');
        };
      });

      // Load all dashboard metrics
      async function loadDashboardData() {
        if (!selectedSiteId) return;
        const site = currentSites.find(s => s.id === selectedSiteId);
        const days = parseInt(dateRangeSelect.value, 10);
        const to = new Date().toISOString().slice(0, 10);
        const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

        // Update Snippet
        const origin = window.location.origin;
        const bannerAttr = site.consent_banner_enabled ? ' data-consent="true"' : '';
        document.getElementById('snippetCode').textContent =
          '<script defer src="' + origin + '/quhip.js" data-site="' + site.site_key + '"' + bannerAttr + '><\\/script>';
        document.getElementById('consentBannerToggle').checked = Boolean(site.consent_banner_enabled);

        // Overview
        const overview = await api('/api/dashboard/overview?site_id=' + selectedSiteId + '&from=' + from + '&to=' + to);
        const s = overview.summary || {};
        document.getElementById('statPageviews').textContent = s.total_pageviews?.toLocaleString() || '0';
        document.getElementById('statSessions').textContent = s.total_sessions?.toLocaleString() || '0';
        document.getElementById('statBounceRate').textContent = s.bounce_rate + '%';
        document.getElementById('statActiveTime').textContent = s.avg_active_time + 's';
        document.getElementById('statMedianTime').textContent = 'Median: ' + s.median_active_time + 's';
        document.getElementById('statPagesPerSession').textContent = s.pages_per_session + ' pages / session';

        // Pages Table
        const pagesTbody = document.getElementById('pagesTableBody');
        pagesTbody.innerHTML = '';
        (overview.top_pages || []).forEach(p => {
          const tr = document.createElement('tr');
          tr.innerHTML = '<td><strong>' + p.path + '</strong></td>' +
            '<td>' + p.pageviews.toLocaleString() + '</td>' +
            '<td>' + formatSuppressed(p.sessions) + '</td>' +
            '<td>' + formatSuppressed(p.entries) + '</td>' +
            '<td>' + formatSuppressed(p.exits) + '</td>' +
            '<td>' + formatSuppressedPct(p.bounce_rate) + '</td>' +
            '<td>' + formatSuppressedSec(p.avg_active_time) + '</td>' +
            '<td>' + formatSuppressedSec(p.median_active_time) + '</td>';
          pagesTbody.appendChild(tr);
        });

        // Elements Table
        const elemRes = await api('/api/dashboard/elements?site_id=' + selectedSiteId + '&from=' + from + '&to=' + to);
        const elemTbody = document.getElementById('elementsTableBody');
        elemTbody.innerHTML = '';
        (elemRes.elements || []).forEach(el => {
          const tr = document.createElement('tr');
          let badges = '';
          if (el.is_outbound) badges += '<span class="badge badge-outbound">Outbound: ' + el.dest_domain + '</span> ';
          if (el.rage_clicks > 0) badges += '<span class="badge badge-rage">Rage Clicks: ' + el.rage_clicks + '</span> ';
          if (el.is_dead_click) badges += '<span class="badge badge-dead">Dead Clicks</span> ';

          tr.innerHTML = '<td>' + el.path + '</td>' +
            '<td><code>' + el.element_label + '</code></td>' +
            '<td>' + formatSuppressed(el.views) + '</td>' +
            '<td>' + formatSuppressed(el.sessions_clicked) + '</td>' +
            '<td><strong style="color: var(--primary);">' + formatSuppressedPct(el.ctr) + '</strong></td>' +
            '<td>' + formatSuppressedPct(el.secondary_ctr) + '</td>' +
            '<td>' + formatSuppressed(el.total_clicks) + '</td>' +
            '<td>' + el.rage_clicks + '</td>' +
            '<td>' + (badges || '-') + '</td>';
          elemTbody.appendChild(tr);
        });

        // Heatmaps
        const heatRes = await api('/api/dashboard/heatmaps?site_id=' + selectedSiteId + '&from=' + from + '&to=' + to);
        const canvas = document.getElementById('heatmapCanvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!heatRes.has_enough_data) {
          document.getElementById('heatmapStatus').textContent = '(not enough data: < 5 sessions)';
          ctx.fillStyle = '#27272a';
          ctx.font = '14px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText('Not enough data to render heatmap (min 5 sessions required)', canvas.width / 2, canvas.height / 2);
        } else {
          document.getElementById('heatmapStatus').textContent = '(' + heatRes.sessions + ' sessions in range)';
          // Render Click overlay points
          (heatRes.click_points || []).forEach(pt => {
            const x = (pt.x_bucket / 100) * canvas.width;
            const y = (pt.y_bucket / 100) * canvas.height;
            const radius = Math.min(30, 8 + pt.clicks * 3);
            const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
            grad.addColorStop(0, 'rgba(239, 68, 68, 0.8)');
            grad.addColorStop(0.5, 'rgba(245, 158, 11, 0.4)');
            grad.addColorStop(1, 'rgba(59, 130, 246, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
          });

          // Scroll depth
          const sd = heatRes.scroll_depth || {};
          document.getElementById('depthFill25').style.width = sd.pct_reached_25 + '%';
          document.getElementById('depthVal25').textContent = sd.pct_reached_25 + '%';
          document.getElementById('depthFill50').style.width = sd.pct_reached_50 + '%';
          document.getElementById('depthVal50').textContent = sd.pct_reached_50 + '%';
          document.getElementById('depthFill75').style.width = sd.pct_reached_75 + '%';
          document.getElementById('depthVal75').textContent = sd.pct_reached_75 + '%';
          document.getElementById('depthFill100').style.width = sd.pct_reached_100 + '%';
          document.getElementById('depthVal100').textContent = sd.pct_reached_100 + '%';
        }

        // Attribution
        const attrRes = await api('/api/dashboard/attribution?site_id=' + selectedSiteId + '&from=' + from + '&to=' + to);
        renderSimpleTable('channelsTableBody', attrRes.channels, ['channel', 'sessions', 'pageviews']);
        renderSimpleTable('sourcesTableBody', attrRes.sources, ['source', 'sessions']);
        renderSimpleTable('campaignsTableBody', attrRes.campaigns, ['campaign', 'sessions']);
        renderSimpleTable('contextTableBody', attrRes.context, ['type', 'value', 'sessions']);

        // Paths
        const pathRes = await api('/api/dashboard/paths?site_id=' + selectedSiteId + '&from=' + from + '&to=' + to);
        const pathTbody = document.getElementById('pathsTableBody');
        pathTbody.innerHTML = '';
        (pathRes.paths || []).forEach(p => {
          const tr = document.createElement('tr');
          tr.innerHTML = '<td>' + p.path_length + '-page</td><td><code>' + p.path_sequence + '</code></td><td>' + p.sessions + '</td>';
          pathTbody.appendChild(tr);
        });

        // Goals
        loadGoals();
      }

      async function loadGoals() {
        const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
        const to = new Date().toISOString().slice(0, 10);
        const res = await api('/api/dashboard/goals?site_id=' + selectedSiteId + '&from=' + from + '&to=' + to);
        const tbody = document.getElementById('goalsTableBody');
        tbody.innerHTML = '';
        (res.goals || []).forEach(g => {
          const tr = document.createElement('tr');
          tr.innerHTML = '<td><strong>' + g.name + '</strong></td>' +
            '<td><span class="badge" style="background:#27272a;">' + g.type + '</span></td>' +
            '<td><code>' + g.target + '</code></td>' +
            '<td>' + formatSuppressed(g.conversions) + '</td>' +
            '<td>' + formatSuppressedPct(g.conversion_rate) + '</td>' +
            '<td><button class="btn-secondary btn-delete-goal" data-id="' + g.id + '" style="padding: 4px 8px; font-size: 11px;">Delete</button></td>';
          tbody.appendChild(tr);
        });
        document.querySelectorAll('.btn-delete-goal').forEach(btn => {
          btn.onclick = async () => {
            if (confirm('Delete this goal?')) {
              await api('/api/dashboard/goals/' + btn.getAttribute('data-id'), { method: 'DELETE' });
              loadGoals();
            }
          };
        });
      }

      addGoalBtn.onclick = () => { addGoalModal.style.display = 'flex'; };
      cancelGoalBtn.onclick = () => { addGoalModal.style.display = 'none'; };
      saveGoalBtn.onclick = async () => {
        const name = document.getElementById('newGoalName').value.trim();
        const type = document.getElementById('newGoalType').value;
        const target = document.getElementById('newGoalTarget').value.trim();
        if (!name || !target) return alert('Name and target required');
        await api('/api/dashboard/goals', {
          method: 'POST',
          body: { site_id: selectedSiteId, name, type, target }
        });
        addGoalModal.style.display = 'none';
        loadGoals();
      };

      document.getElementById('saveSiteSettingsBtn').onclick = async () => {
        const enabled = document.getElementById('consentBannerToggle').checked;
        await api('/api/dashboard/sites/' + selectedSiteId, {
          method: 'PATCH',
          body: { consent_banner_enabled: enabled }
        });
        alert('Settings updated!');
        loadSites();
      };

      function formatSuppressed(val) {
        if (val === 'not enough data') return '<span class="suppressed-badge">not enough data</span>';
        return val !== undefined && val !== null ? val.toLocaleString() : '-';
      }
      function formatSuppressedPct(val) {
        if (val === 'not enough data') return '<span class="suppressed-badge">not enough data</span>';
        return val !== undefined && val !== null ? val + '%' : '-';
      }
      function formatSuppressedSec(val) {
        if (val === 'not enough data') return '<span class="suppressed-badge">not enough data</span>';
        return val !== undefined && val !== null ? val + 's' : '-';
      }

      function renderSimpleTable(tbodyId, rows, keys) {
        const tbody = document.getElementById(tbodyId);
        tbody.innerHTML = '';
        (rows || []).forEach(r => {
          const tr = document.createElement('tr');
          let tds = '';
          keys.forEach(k => {
            tds += '<td>' + formatSuppressed(r[k]) + '</td>';
          });
          tr.innerHTML = tds;
          tbody.appendChild(tr);
        });
      }

      init();
    })();
  </script>
</body>
</html>`;
}
