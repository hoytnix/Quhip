import { Hono } from 'hono';
import { Env, IngestPayload } from '../types';
import { isBotUserAgent } from '../services/bot-filter';
import { checkRateLimit } from '../services/rate-limiter';
import { processIngestBatch } from '../services/aggregator';

export const ingestRouter = new Hono<{ Bindings: Env }>();

// Public site configuration endpoint (for tracking snippet to discover consent banner setting)
ingestRouter.get('/api/config', async (c) => {
  const siteKey = c.req.query('site') || c.req.query('key') || c.req.query('site_key');
  if (!siteKey) {
    return c.json({ error: 'Missing site key' }, 400);
  }

  const site = await c.env.DB.prepare(
    `SELECT consent_banner_enabled FROM sites WHERE site_key = ?`
  ).bind(siteKey).first<{ consent_banner_enabled: number }>();

  if (!site) {
    return c.json({ consent_banner_enabled: false }, 404);
  }

  return c.json({
    consent_banner_enabled: Boolean(site.consent_banner_enabled)
  });
});

// Ingest endpoint (§8)
// Accepts batch of events, requires valid site key, validates shape, rejects unknown sites with 4xx.
// Strictly no IP storage, no cookies, no user profile tracking.
ingestRouter.post('/api/event', async (c) => {
  const ua = c.req.header('user-agent') || '';

  // Bot filtering (§5)
  if (isBotUserAgent(ua)) {
    // Drop silently or return 200 without storing bot traffic
    return c.json({ ok: true, dropped: 'bot' }, 200);
  }

  let body: IngestPayload;
  try {
    body = await c.req.json<IngestPayload>();
  } catch {
    try {
      const rawText = await c.req.text();
      body = JSON.parse(rawText);
    } catch {
      return c.json({ error: 'Invalid JSON payload' }, 400);
    }
  }

  const { site_key, events } = body;
  if (!site_key || typeof site_key !== 'string' || site_key.trim() === '') {
    return c.json({ error: 'Missing or invalid site_key' }, 400);
  }

  if (!events || !Array.isArray(events)) {
    return c.json({ error: 'Invalid events array' }, 400);
  }

  // Rate limiting per site key (§8)
  const rate = await checkRateLimit(c.env.DB, site_key);
  if (!rate.allowed) {
    return c.json({ error: 'Rate limit exceeded for site key' }, 429);
  }

  // Validate site key in database
  const site = await c.env.DB.prepare(
    `SELECT id, name, domain, site_key, owner_id, timezone, consent_banner_enabled, created_at
     FROM sites WHERE site_key = ?`
  ).bind(site_key).first<any>();

  if (!site) {
    return c.json({ error: 'Unknown or inactive site key' }, 404);
  }

  // Coarse country from Cloudflare headers (§4: never IP, country only)
  // Cloudflare provides 'cf-ipcountry' header or cf object
  const country = c.req.header('cf-ipcountry') || (c.req.raw as any).cf?.country || 'XX';

  const result = await processIngestBatch(c.env.DB, site, body, {
    country,
    userAgent: ua
  });

  return c.json({ ok: true, processed: result.eventsProcessed });
});
