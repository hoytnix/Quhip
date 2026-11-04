import { Hono } from 'hono';
import { Env, SiteRecord, GoalRecord } from '../types';
import { authenticateToken } from '../services/auth';

export const dashboardRouter = new Hono<{ Bindings: Env; Variables: { ownerId: string } }>();

// Auth middleware for all dashboard routes
dashboardRouter.use('/api/dashboard/*', async (c, next) => {
  const authHeader = c.req.header('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  const ownerId = await authenticateToken(c.env.DB, token);
  if (!ownerId) {
    return c.json({ error: 'Unauthorized. Owner authentication required.' }, 401);
  }
  c.set('ownerId', ownerId);
  await next();
});

// Sites list
dashboardRouter.get('/api/dashboard/sites', async (c) => {
  const ownerId = c.get('ownerId');
  const result = await c.env.DB.prepare(
    `SELECT id, name, domain, site_key, timezone, consent_banner_enabled, created_at
     FROM sites WHERE owner_id = ? ORDER BY created_at DESC`
  ).bind(ownerId).all<SiteRecord>();

  return c.json({ sites: result.results || [] });
});

// Create site
dashboardRouter.post('/api/dashboard/sites', async (c) => {
  const ownerId = c.get('ownerId');
  let body: { name?: string; domain?: string; timezone?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const name = body.name?.trim();
  const domain = body.domain?.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const timezone = body.timezone?.trim() || 'UTC';

  if (!name || !domain) {
    return c.json({ error: 'Name and domain are required' }, 400);
  }

  const id = crypto.randomUUID();
  // Generate secure site key (ingest-only credential)
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  const keyHex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const siteKey = `qhp_${keyHex}`;
  const nowIso = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO sites (id, name, domain, site_key, owner_id, timezone, consent_banner_enabled, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
  ).bind(id, name, domain, siteKey, ownerId, timezone, nowIso).run();

  return c.json({
    ok: true,
    site: {
      id,
      name,
      domain,
      site_key: siteKey,
      timezone,
      consent_banner_enabled: 0,
      created_at: nowIso
    }
  });
});

// Update site settings
dashboardRouter.patch('/api/dashboard/sites/:id', async (c) => {
  const ownerId = c.get('ownerId');
  const siteId = c.req.param('id');

  const site = await c.env.DB.prepare(
    `SELECT id FROM sites WHERE id = ? AND owner_id = ?`
  ).bind(siteId, ownerId).first();

  if (!site) {
    return c.json({ error: 'Site not found' }, 404);
  }

  let body: { name?: string; timezone?: string; consent_banner_enabled?: number | boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const updates: string[] = [];
  const bindings: any[] = [];

  if (body.name !== undefined) {
    updates.push('name = ?');
    bindings.push(body.name.trim());
  }
  if (body.timezone !== undefined) {
    updates.push('timezone = ?');
    bindings.push(body.timezone.trim());
  }
  if (body.consent_banner_enabled !== undefined) {
    updates.push('consent_banner_enabled = ?');
    bindings.push(body.consent_banner_enabled ? 1 : 0);
  }

  if (updates.length > 0) {
    bindings.push(siteId);
    await c.env.DB.prepare(
      `UPDATE sites SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...bindings).run();
  }

  const updated = await c.env.DB.prepare(
    `SELECT id, name, domain, site_key, timezone, consent_banner_enabled, created_at
     FROM sites WHERE id = ?`
  ).bind(siteId).first<SiteRecord>();

  return c.json({ ok: true, site: updated });
});

// Delete site
dashboardRouter.delete('/api/dashboard/sites/:id', async (c) => {
  const ownerId = c.get('ownerId');
  const siteId = c.req.param('id');

  await c.env.DB.prepare(
    `DELETE FROM sites WHERE id = ? AND owner_id = ?`
  ).bind(siteId, ownerId).run();

  return c.json({ ok: true });
});

// Overview metrics (§6)
dashboardRouter.get('/api/dashboard/overview', async (c) => {
  const ownerId = c.get('ownerId');
  const siteId = c.req.query('site_id');
  const from = c.req.query('from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const to = c.req.query('to') || new Date().toISOString().slice(0, 10);

  if (!siteId) return c.json({ error: 'site_id is required' }, 400);

  // Validate site ownership
  const site = await c.env.DB.prepare(
    `SELECT id, name, domain, timezone FROM sites WHERE id = ? AND owner_id = ?`
  ).bind(siteId, ownerId).first<any>();
  if (!site) return c.json({ error: 'Site not found' }, 404);

  // Aggregated site overview
  const siteDailyRows = await c.env.DB.prepare(
    `SELECT date, sessions, pageviews, bounces, total_active_time, active_times_json
     FROM agg_daily_site
     WHERE site_id = ? AND date >= ? AND date <= ?
     ORDER BY date ASC`
  ).bind(siteId, from, to).all<any>();

  const rows = siteDailyRows.results || [];
  let totalSessions = 0;
  let totalPageviews = 0;
  let totalBounces = 0;
  let totalActiveTime = 0;
  let allActiveTimes: number[] = [];

  for (const r of rows) {
    totalSessions += r.sessions || 0;
    totalPageviews += r.pageviews || 0;
    totalBounces += r.bounces || 0;
    totalActiveTime += r.total_active_time || 0;
    try {
      const times = JSON.parse(r.active_times_json || '[]');
      allActiveTimes.push(...times);
    } catch {}
  }

  // Median active time calculation
  allActiveTimes.sort((a, b) => a - b);
  let medianActiveTime = 0;
  if (allActiveTimes.length > 0) {
    const mid = Math.floor(allActiveTimes.length / 2);
    medianActiveTime = allActiveTimes.length % 2 !== 0
      ? allActiveTimes[mid]
      : Math.round((allActiveTimes[mid - 1] + allActiveTimes[mid]) / 2);
  }

  const avgActiveTime = totalSessions > 0 ? Math.round(totalActiveTime / totalSessions) : 0;
  const bounceRate = totalSessions > 0 ? Math.round((totalBounces / totalSessions) * 100) : 0;
  const pagesPerSession = totalSessions > 0 ? Number((totalPageviews / totalSessions).toFixed(2)) : 0;

  // Pages breakdown
  const pagesRows = await c.env.DB.prepare(
    `SELECT path,
            SUM(pageviews) as pageviews,
            SUM(sessions) as sessions,
            SUM(entries) as entries,
            SUM(exits) as exits,
            SUM(bounces) as bounces,
            SUM(total_active_time) as total_active_time,
            GROUP_CONCAT(active_times_json) as combined_times
     FROM agg_daily_page
     WHERE site_id = ? AND date >= ? AND date <= ?
     GROUP BY path
     ORDER BY pageviews DESC`
  ).bind(siteId, from, to).all<any>();

  const pages = (pagesRows.results || []).map(p => {
    const pSessions = p.sessions || 0;
    const isSuppressed = pSessions < 5; // §8 small-count suppression

    let pTimes: number[] = [];
    try {
      const chunks = (p.combined_times || '').split('][').join(',');
      pTimes = JSON.parse(`[${chunks.replace(/^\[+|\]+$/g, '')}]`);
      pTimes.sort((a: number, b: number) => a - b);
    } catch {}

    let pMedian = 0;
    if (pTimes.length > 0) {
      const mid = Math.floor(pTimes.length / 2);
      pMedian = pTimes.length % 2 !== 0 ? pTimes[mid] : Math.round((pTimes[mid - 1] + pTimes[mid]) / 2);
    }

    return {
      path: p.path,
      pageviews: p.pageviews,
      sessions: isSuppressed ? 'not enough data' : pSessions,
      entries: isSuppressed ? 'not enough data' : p.entries,
      exits: isSuppressed ? 'not enough data' : p.exits,
      bounce_rate: isSuppressed ? 'not enough data' : (pSessions > 0 ? Math.round((p.bounces / pSessions) * 100) : 0),
      avg_active_time: isSuppressed ? 'not enough data' : (pSessions > 0 ? Math.round(p.total_active_time / pSessions) : 0),
      median_active_time: isSuppressed ? 'not enough data' : pMedian
    };
  });

  return c.json({
    site: { id: site.id, name: site.name, domain: site.domain, timezone: site.timezone },
    date_range: { from, to },
    summary: {
      total_pageviews: totalPageviews,
      total_sessions: totalSessions,
      daily_sessions: totalSessions, // approximate uniques (§6: distinct session IDs per day)
      bounce_rate: bounceRate,
      avg_active_time: avgActiveTime,
      median_active_time: medianActiveTime,
      pages_per_session: pagesPerSession,
      has_enough_data: totalSessions >= 5
    },
    daily_trend: rows.map(r => ({
      date: r.date,
      pageviews: r.pageviews,
      sessions: r.sessions,
      bounces: r.bounces
    })),
    top_pages: pages
  });
});

// Element CTR Table (§7)
dashboardRouter.get('/api/dashboard/elements', async (c) => {
  const ownerId = c.get('ownerId');
  const siteId = c.req.query('site_id');
  const path = c.req.query('path');
  const from = c.req.query('from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const to = c.req.query('to') || new Date().toISOString().slice(0, 10);

  if (!siteId) return c.json({ error: 'site_id is required' }, 400);

  // Validate site ownership
  const site = await c.env.DB.prepare(
    `SELECT id FROM sites WHERE id = ? AND owner_id = ?`
  ).bind(siteId, ownerId).first();
  if (!site) return c.json({ error: 'Site not found' }, 404);

  // Calculate total pageviews for secondary CTR if path specified
  let pageTotalViews = 0;
  if (path) {
    const pvRes = await c.env.DB.prepare(
      `SELECT SUM(pageviews) as pv FROM agg_daily_page WHERE site_id = ? AND path = ? AND date >= ? AND date <= ?`
    ).bind(siteId, path, from, to).first<{ pv: number }>();
    pageTotalViews = pvRes?.pv || 0;
  }

  let query = `
    SELECT path, element_identity, element_label, element_tag, is_outbound, dest_domain,
           SUM(views) as views,
           SUM(total_clicks) as total_clicks,
           SUM(sessions_clicked) as sessions_clicked,
           SUM(rage_clicks) as rage_clicks,
           SUM(dead_clicks) as dead_clicks
    FROM agg_daily_element
    WHERE site_id = ? AND date >= ? AND date <= ?
  `;
  const bindings: any[] = [siteId, from, to];

  if (path) {
    query += ` AND path = ?`;
    bindings.push(path);
  }

  query += ` GROUP BY path, element_identity ORDER BY sessions_clicked DESC`;

  const rows = await c.env.DB.prepare(query).bind(...bindings).all<any>();

  const elements = (rows.results || []).map(el => {
    const views = el.views || 0;
    const clicked = el.sessions_clicked || 0;
    const totalClicks = el.total_clicks || 0;
    const isSuppressed = views < 5; // §8 small-count suppression

    // Primary CTR (§7: sessions-that-clicked-the-element / sessions-that-saw-the-element)
    const primaryCtr = views > 0 ? Number(((clicked / views) * 100).toFixed(1)) : 0;
    // Secondary CTR (clicks / pageviews)
    const secondaryCtr = pageTotalViews > 0 ? Number(((totalClicks / pageTotalViews) * 100).toFixed(1)) : 0;

    return {
      path: el.path,
      element_identity: el.element_identity,
      element_label: el.element_label,
      element_tag: el.element_tag,
      is_outbound: Boolean(el.is_outbound),
      dest_domain: el.dest_domain || '',
      views: isSuppressed ? 'not enough data' : views,
      sessions_clicked: isSuppressed ? 'not enough data' : clicked,
      ctr: isSuppressed ? 'not enough data' : primaryCtr,
      secondary_ctr: isSuppressed ? 'not enough data' : secondaryCtr,
      total_clicks: isSuppressed ? 'not enough data' : totalClicks,
      rage_clicks: el.rage_clicks || 0,
      is_dead_click: (el.dead_clicks || 0) > 0
    };
  });

  return c.json({ elements });
});

// Heatmaps (§7)
dashboardRouter.get('/api/dashboard/heatmaps', async (c) => {
  const ownerId = c.get('ownerId');
  const siteId = c.req.query('site_id');
  const path = c.req.query('path') || '/';
  const from = c.req.query('from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const to = c.req.query('to') || new Date().toISOString().slice(0, 10);

  if (!siteId) return c.json({ error: 'site_id is required' }, 400);

  // Validate site ownership
  const site = await c.env.DB.prepare(
    `SELECT id FROM sites WHERE id = ? AND owner_id = ?`
  ).bind(siteId, ownerId).first();
  if (!site) return c.json({ error: 'Site not found' }, 404);

  // Minimum-count check (§7: do not render heatmap from fewer than 5 sessions — show "not enough data")
  const sessionCheck = await c.env.DB.prepare(
    `SELECT SUM(sessions) as total_sessions FROM agg_daily_page
     WHERE site_id = ? AND path = ? AND date >= ? AND date <= ?`
  ).bind(siteId, path, from, to).first<{ total_sessions: number }>();

  const totalSessions = sessionCheck?.total_sessions || 0;
  if (totalSessions < 5) {
    return c.json({
      has_enough_data: false,
      message: 'not enough data',
      sessions: totalSessions,
      min_sessions: 5
    });
  }

  // Clicks heatmap (normalized 0-99 x/y buckets)
  const clickRows = await c.env.DB.prepare(
    `SELECT x_bucket, y_bucket, SUM(clicks) as clicks
     FROM agg_daily_heatmap
     WHERE site_id = ? AND path = ? AND date >= ? AND date <= ?
     GROUP BY x_bucket, y_bucket`
  ).bind(siteId, path, from, to).all<any>();

  // Scroll heatmap distribution
  const scrollRows = await c.env.DB.prepare(
    `SELECT SUM(reached_25) as r25,
            SUM(reached_50) as r50,
            SUM(reached_75) as r75,
            SUM(reached_100) as r100,
            SUM(total_max_depth) as total_depth,
            SUM(session_count) as count
     FROM agg_daily_scroll
     WHERE site_id = ? AND path = ? AND date >= ? AND date <= ?`
  ).bind(siteId, path, from, to).first<any>();

  const sCount = scrollRows?.count || totalSessions;
  const scrollDepth = {
    avg_max_scroll: sCount > 0 ? Math.round((scrollRows?.total_depth || 0) / sCount) : 0,
    pct_reached_25: sCount > 0 ? Math.round(((scrollRows?.r25 || 0) / sCount) * 100) : 0,
    pct_reached_50: sCount > 0 ? Math.round(((scrollRows?.r50 || 0) / sCount) * 100) : 0,
    pct_reached_75: sCount > 0 ? Math.round(((scrollRows?.r75 || 0) / sCount) * 100) : 0,
    pct_reached_100: sCount > 0 ? Math.round(((scrollRows?.r100 || 0) / sCount) * 100) : 0
  };

  return c.json({
    has_enough_data: true,
    sessions: totalSessions,
    click_points: clickRows.results || [],
    scroll_depth: scrollDepth
  });
});

// Attribution Views (§9)
dashboardRouter.get('/api/dashboard/attribution', async (c) => {
  const ownerId = c.get('ownerId');
  const siteId = c.req.query('site_id');
  const from = c.req.query('from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const to = c.req.query('to') || new Date().toISOString().slice(0, 10);

  if (!siteId) return c.json({ error: 'site_id is required' }, 400);

  // Validate site ownership
  const site = await c.env.DB.prepare(
    `SELECT id FROM sites WHERE id = ? AND owner_id = ?`
  ).bind(siteId, ownerId).first();
  if (!site) return c.json({ error: 'Site not found' }, 404);

  // By Channel
  const channels = await c.env.DB.prepare(
    `SELECT channel, SUM(sessions) as sessions, SUM(pageviews) as pageviews, SUM(bounces) as bounces
     FROM agg_daily_attribution
     WHERE site_id = ? AND date >= ? AND date <= ?
     GROUP BY channel ORDER BY sessions DESC`
  ).bind(siteId, from, to).all<any>();

  // By Source
  const sources = await c.env.DB.prepare(
    `SELECT source, SUM(sessions) as sessions, SUM(pageviews) as pageviews
     FROM agg_daily_attribution
     WHERE site_id = ? AND date >= ? AND date <= ? AND source != ''
     GROUP BY source ORDER BY sessions DESC LIMIT 50`
  ).bind(siteId, from, to).all<any>();

  // By Source / Medium
  const sourceMediums = await c.env.DB.prepare(
    `SELECT source, medium, SUM(sessions) as sessions
     FROM agg_daily_attribution
     WHERE site_id = ? AND date >= ? AND date <= ? AND (source != '' OR medium != '')
     GROUP BY source, medium ORDER BY sessions DESC LIMIT 50`
  ).bind(siteId, from, to).all<any>();

  // By Campaign
  const campaigns = await c.env.DB.prepare(
    `SELECT campaign, SUM(sessions) as sessions
     FROM agg_daily_attribution
     WHERE site_id = ? AND date >= ? AND date <= ? AND campaign != '' AND campaign != '(none)'
     GROUP BY campaign ORDER BY sessions DESC LIMIT 50`
  ).bind(siteId, from, to).all<any>();

  // Device & Browser & Country
  const contextRows = await c.env.DB.prepare(
    `SELECT type, value, SUM(sessions) as sessions
     FROM agg_daily_context
     WHERE site_id = ? AND date >= ? AND date <= ?
     GROUP BY type, value ORDER BY sessions DESC`
  ).bind(siteId, from, to).all<any>();

  const suppress = (items: any[]) => items.map(i => ({
    ...i,
    sessions: (i.sessions < 5) ? 'not enough data' : i.sessions
  }));

  return c.json({
    channels: suppress(channels.results || []),
    sources: suppress(sources.results || []),
    source_mediums: suppress(sourceMediums.results || []),
    campaigns: suppress(campaigns.results || []),
    context: suppress(contextRows.results || [])
  });
});

// Top Paths (§6: 2- and 3-page sequences, suppressed under 5 sessions)
dashboardRouter.get('/api/dashboard/paths', async (c) => {
  const ownerId = c.get('ownerId');
  const siteId = c.req.query('site_id');
  const from = c.req.query('from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const to = c.req.query('to') || new Date().toISOString().slice(0, 10);

  if (!siteId) return c.json({ error: 'site_id is required' }, 400);

  // Validate site ownership
  const site = await c.env.DB.prepare(
    `SELECT id FROM sites WHERE id = ? AND owner_id = ?`
  ).bind(siteId, ownerId).first();
  if (!site) return c.json({ error: 'Site not found' }, 404);

  const paths = await c.env.DB.prepare(
    `SELECT path_length, path_sequence, SUM(sessions) as sessions
     FROM agg_daily_paths
     WHERE site_id = ? AND date >= ? AND date <= ?
     GROUP BY path_sequence
     HAVING sessions >= 5
     ORDER BY sessions DESC LIMIT 50`
  ).bind(siteId, from, to).all<any>();

  return c.json({
    paths: paths.results || []
  });
});

// Goals endpoints (§6, §7)
dashboardRouter.get('/api/dashboard/goals', async (c) => {
  const ownerId = c.get('ownerId');
  const siteId = c.req.query('site_id');
  const from = c.req.query('from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const to = c.req.query('to') || new Date().toISOString().slice(0, 10);

  if (!siteId) return c.json({ error: 'site_id is required' }, 400);

  // Validate site ownership
  const site = await c.env.DB.prepare(
    `SELECT id FROM sites WHERE id = ? AND owner_id = ?`
  ).bind(siteId, ownerId).first();
  if (!site) return c.json({ error: 'Site not found' }, 404);

  // Total sessions for conversion rate calculation
  const totalSessionsRes = await c.env.DB.prepare(
    `SELECT SUM(sessions) as s FROM agg_daily_site WHERE site_id = ? AND date >= ? AND date <= ?`
  ).bind(siteId, from, to).first<{ s: number }>();
  const totalSessions = totalSessionsRes?.s || 0;

  const goalsList = await c.env.DB.prepare(
    `SELECT id, site_id, name, type, target, created_at FROM goals WHERE site_id = ? ORDER BY created_at DESC`
  ).bind(siteId).all<GoalRecord>();

  const goalConversions = await c.env.DB.prepare(
    `SELECT goal_id, SUM(conversions) as conversions
     FROM agg_daily_goals
     WHERE site_id = ? AND date >= ? AND date <= ?
     GROUP BY goal_id`
  ).bind(siteId, from, to).all<any>();

  const conversionMap = new Map<string, number>();
  for (const c of goalConversions.results || []) {
    conversionMap.set(c.goal_id, c.conversions || 0);
  }

  const goalsWithStats = (goalsList.results || []).map(g => {
    const conv = conversionMap.get(g.id) || 0;
    const isSuppressed = conv > 0 && conv < 5;
    const rate = totalSessions > 0 ? Number(((conv / totalSessions) * 100).toFixed(1)) : 0;
    return {
      ...g,
      conversions: isSuppressed ? 'not enough data' : conv,
      conversion_rate: isSuppressed ? 'not enough data' : rate
    };
  });

  return c.json({ goals: goalsWithStats, total_sessions: totalSessions });
});

// Create goal
dashboardRouter.post('/api/dashboard/goals', async (c) => {
  const ownerId = c.get('ownerId');
  let body: { site_id?: string; name?: string; type?: 'click' | 'path' | 'outbound'; target?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const { site_id, name, type, target } = body;
  if (!site_id || !name || !type || !target) {
    return c.json({ error: 'site_id, name, type, and target are required' }, 400);
  }

  // Validate site ownership
  const site = await c.env.DB.prepare(
    `SELECT id FROM sites WHERE id = ? AND owner_id = ?`
  ).bind(site_id, ownerId).first();
  if (!site) return c.json({ error: 'Site not found' }, 404);

  const id = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO goals (id, site_id, name, type, target, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, site_id, name.trim(), type, target.trim(), nowIso).run();

  return c.json({
    ok: true,
    goal: { id, site_id, name: name.trim(), type, target: target.trim(), created_at: nowIso }
  });
});

// Delete goal
dashboardRouter.delete('/api/dashboard/goals/:id', async (c) => {
  const ownerId = c.get('ownerId');
  const goalId = c.req.param('id');

  const goal = await c.env.DB.prepare(
    `SELECT g.id FROM goals g JOIN sites s ON g.site_id = s.id WHERE g.id = ? AND s.owner_id = ?`
  ).bind(goalId, ownerId).first();

  if (!goal) return c.json({ error: 'Goal not found' }, 404);

  await c.env.DB.prepare(`DELETE FROM goals WHERE id = ?`).bind(goalId).run();
  return c.json({ ok: true });
});
