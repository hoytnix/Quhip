// Pre-check test script executing §4 checklist against live local Quhip Worker

async function runPreCheck() {
  const API_BASE = 'http://localhost:8787';
  const SITE_KEY = 'qhp_local_test_key';
  const SITE_ID = 'site_local_test';

  console.log('--- Step 0: Reset local test database ---');
  // First login to get token
  const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'michael', password: 'Password123!' })
  }).then(r => r.json());

  const token = loginRes.token;
  console.log('Logged in with token:', token ? 'OK' : 'FAILED');

  console.log('\n--- Step 1: Simulating Session 1 (Home -> About -> Contact -> Home) ---');
  const sess1 = 'sess_live_test_1';

  // 1. Visit Home
  await sendEvents([
    { type: 'pageview', path: '/', session_id: sess1, is_entry: true },
    { type: 'session_flush', path: '/', session_id: sess1, active_time: 8 }
  ]);

  // 2. Visit About
  await sendEvents([
    { type: 'pageview', path: '/about', session_id: sess1 },
    { type: 'session_flush', path: '/about', session_id: sess1, active_time: 5 }
  ]);

  // 3. Visit Contact (triggers Contact Goal)
  await sendEvents([
    { type: 'pageview', path: '/contact', session_id: sess1 },
    { type: 'session_flush', path: '/contact', session_id: sess1, active_time: 6 }
  ]);

  // 4. Back to Home
  await sendEvents([
    { type: 'pageview', path: '/', session_id: sess1 },
    // Clicks on Home
    { type: 'element_view', path: '/', session_id: sess1, element_identity: 'quhip:signup-btn', element_label: 'signup-btn' },
    { type: 'click', path: '/', session_id: sess1, element_identity: 'quhip:signup-btn', element_label: 'signup-btn', click_x: 25, click_y: 15 },
    { type: 'element_view', path: '/', session_id: sess1, element_identity: '#learn-more-btn', element_label: 'learn-more-btn' },
    { type: 'click', path: '/', session_id: sess1, element_identity: '#learn-more-btn', element_label: 'learn-more-btn', click_x: 45, click_y: 15 },
    { type: 'click', path: '/', session_id: sess1, element_identity: '#outbound-link', element_label: 'outbound-link', is_outbound: true, dest_domain: 'github.com' },
    // Scroll milestones reaching 100%
    { type: 'scroll', path: '/', session_id: sess1, scroll_depth: 25 },
    { type: 'scroll', path: '/', session_id: sess1, scroll_depth: 50 },
    { type: 'scroll', path: '/', session_id: sess1, scroll_depth: 75 },
    { type: 'scroll', path: '/', session_id: sess1, scroll_depth: 100 },
    // Dead button click
    { type: 'click', path: '/', session_id: sess1, element_identity: '#broken-dead-btn', element_label: 'broken-dead-btn', is_dead_click: true },
    // Rage click (4 clicks in 1s -> 1 rage click event, 4 total clicks, 1 sessions_clicked)
    { type: 'click', path: '/', session_id: sess1, element_identity: '#rage-click-btn', element_label: 'rage-click-btn' },
    { type: 'click', path: '/', session_id: sess1, element_identity: '#rage-click-btn', element_label: 'rage-click-btn' },
    { type: 'click', path: '/', session_id: sess1, element_identity: '#rage-click-btn', element_label: 'rage-click-btn', is_rage_click: true },
    { type: 'click', path: '/', session_id: sess1, element_identity: '#rage-click-btn', element_label: 'rage-click-btn', is_rage_click: true },
    // Below-the-fold button view + click
    { type: 'element_view', path: '/', session_id: sess1, element_identity: 'quhip:footer-newsletter-btn', element_label: 'footer-newsletter-btn' },
    { type: 'click', path: '/', session_id: sess1, element_identity: 'quhip:footer-newsletter-btn', element_label: 'footer-newsletter-btn', click_x: 50, click_y: 90 },
    { type: 'session_flush', path: '/', session_id: sess1, active_time: 12, is_exit: true }
  ]);

  console.log('\n--- Step 2: Simulating Session 2 (UTM + gclid test) ---');
  const sess2 = 'sess_live_test_2';
  await sendEvents([
    {
      type: 'pageview',
      path: '/',
      session_id: sess2,
      is_entry: true,
      utm_source: 'test',
      utm_medium: 'test',
      utm_campaign: 'hello-test',
      // gclid must be completely omitted / stripped per §4, §9
    },
    { type: 'session_flush', path: '/', session_id: sess2, active_time: 15 },
    // Navigates internally to /about (first-touch attribution must remain)
    { type: 'pageview', path: '/about', session_id: sess2 },
    { type: 'session_flush', path: '/about', session_id: sess2, active_time: 10, is_exit: true }
  ]);

  console.log('\n--- Step 3: Querying Dashboard API to verify Pass Criteria (§5) ---');
  const today = new Date().toISOString().slice(0, 10);
  const overview = await fetch(`${API_BASE}/api/dashboard/overview?site_id=${SITE_ID}&from=${today}&to=${today}`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json());

  console.log('\n[Dashboard Overview Summary]:');
  console.log('Total Pageviews:', overview.summary?.total_pageviews, '(Expected: 6 = 4 in sess1 + 2 in sess2)');
  console.log('Total Sessions:', overview.summary?.total_sessions, '(Expected: 2)');
  console.log('Bounce Rate:', overview.summary?.bounce_rate + '%', '(Expected: 0% because both sessions were multi-page & engaged)');
  console.log('Pages Per Session:', overview.summary?.pages_per_session, '(Expected: 3.0)');
  console.log('Avg Active Time:', overview.summary?.avg_active_time + 's');
  console.log('Median Active Time:', overview.summary?.median_active_time + 's');

  console.log('\n[Top Pages]:');
  console.table(overview.top_pages?.map(p => ({
    path: p.path,
    pageviews: p.pageviews,
    sessions: p.sessions,
    entries: p.entries,
    exits: p.exits
  })));

  const elements = await fetch(`${API_BASE}/api/dashboard/elements?site_id=${SITE_ID}&from=${today}&to=${today}`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json());

  console.log('\n[Element CTR Table]:');
  console.table(elements.elements?.map(e => ({
    label: e.element_label,
    views: e.views,
    sessions_clicked: e.sessions_clicked,
    total_clicks: e.total_clicks,
    rage_clicks: e.rage_clicks,
    dead: e.is_dead_click,
    outbound: e.is_outbound ? e.dest_domain : 'no'
  })));

  const attribution = await fetch(`${API_BASE}/api/dashboard/attribution?site_id=${SITE_ID}&from=${today}&to=${today}`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json());

  console.log('\n[Attribution Views]:');
  console.log('Campaigns:', attribution.campaigns);
  console.log('Sources:', attribution.sources);

  const goals = await fetch(`${API_BASE}/api/dashboard/goals?site_id=${SITE_ID}&from=${today}&to=${today}`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json());

  console.log('\n[Goals]:');
  console.table(goals.goals?.map(g => ({
    name: g.name,
    type: g.type,
    target: g.target,
    conversions: g.conversions
  })));

  async function sendEvents(events) {
    const res = await fetch(`${API_BASE}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site_key: SITE_KEY, events })
    });
    const json = await res.json();
    if (!res.ok) console.error('Error sending events:', json);
  }
}

runPreCheck().catch(console.error);
