import { IngestPayload, TrackerEvent, SiteRecord, GoalRecord, ActiveSessionBuffer } from '../types';
import { sanitizePath, sanitizeReferrerDomain, sanitizeUtm, computeChannelGroup } from './attribution';
import { isBotSession } from './bot-filter';

export interface IngestContext {
  country: string; // coarse 2-letter country code only, never IP
  userAgent?: string;
}

export async function processIngestBatch(
  db: D1Database,
  site: SiteRecord,
  payload: IngestPayload,
  ctx: IngestContext
): Promise<{ success: boolean; eventsProcessed: number }> {
  const events = payload.events;
  if (!events || !Array.isArray(events) || events.length === 0) {
    return { success: true, eventsProcessed: 0 };
  }

  const now = Date.now();
  const todayUtc = new Date(now).toISOString().slice(0, 10); // YYYY-MM-DD
  const siteId = site.id;

  // Query site goals to evaluate on events
  const goalsResult = await db.prepare(
    `SELECT id, site_id, name, type, target, created_at FROM goals WHERE site_id = ?`
  ).bind(siteId).all<GoalRecord>();
  const siteGoals = goalsResult.results || [];

  // Group events by session_id
  const sessionMap = new Map<string, TrackerEvent[]>();
  for (const ev of events) {
    if (!ev.session_id) continue;
    const list = sessionMap.get(ev.session_id) || [];
    list.push(ev);
    sessionMap.set(ev.session_id, list);
  }

  // Periodic cleanup of expired session buffers (TTL = 30 minutes inactivity)
  try {
    await db.prepare(`DELETE FROM active_sessions_buffer WHERE expires_at < ?`).bind(now).run();
  } catch (e) {
    // Non-fatal cleanup
  }

  let totalProcessed = 0;

  for (const [sessionId, sessionEvents] of sessionMap.entries()) {
    // Fetch or create ephemeral session state
    const existingBuffer = await db.prepare(
      `SELECT * FROM active_sessions_buffer WHERE site_id = ? AND session_id = ?`
    ).bind(siteId, sessionId).first<any>();

    const isNewSession = !existingBuffer;

    let elementsSeen: Set<string> = new Set();
    let elementsClicked: Set<string> = new Set();
    let goalsCompleted: Set<string> = new Set();
    let pathHistory: string[] = [];
    let landingPath = '/';
    let currentPath = '/';
    let pageCount = 1;
    let totalActiveTime = 0;
    let hasInteraction = 0;
    let hasGoal = 0;
    let maxScroll = 0;
    let channel = 'direct';
    let source = '';
    let medium = '';
    let campaign = '';
    let term = '';
    let content = '';
    let deviceClass = 'desktop';
    let browserClass = 'other';
    const country = ctx.country || 'XX';

    if (existingBuffer) {
      try {
        elementsSeen = new Set(JSON.parse(existingBuffer.elements_seen || '[]'));
        elementsClicked = new Set(JSON.parse(existingBuffer.elements_clicked || '[]'));
        goalsCompleted = new Set(JSON.parse(existingBuffer.goals_completed || '[]'));
        pathHistory = JSON.parse(existingBuffer.path_history || '[]');
      } catch {}
      landingPath = existingBuffer.landing_path;
      currentPath = existingBuffer.current_path;
      pageCount = existingBuffer.page_count;
      totalActiveTime = existingBuffer.total_active_time;
      hasInteraction = existingBuffer.has_interaction;
      hasGoal = existingBuffer.has_goal;
      maxScroll = existingBuffer.max_scroll;
      channel = existingBuffer.channel;
      source = existingBuffer.source;
      medium = existingBuffer.medium;
      campaign = existingBuffer.campaign;
      deviceClass = existingBuffer.device_class;
      browserClass = existingBuffer.browser_class;
    } else {
      // First event for this session: initialize first-touch attribution
      const firstEvent = sessionEvents[0];
      const referrerDomain = sanitizeReferrerDomain(firstEvent.referrer_domain);
      const utm = sanitizeUtm(
        firstEvent.utm_source,
        firstEvent.utm_medium,
        firstEvent.utm_campaign,
        firstEvent.utm_term,
        firstEvent.utm_content
      );
      channel = computeChannelGroup(referrerDomain, utm);
      source = utm.source || referrerDomain || '(direct)';
      medium = utm.medium || (channel === 'direct' ? '(none)' : 'referral');
      campaign = utm.campaign || '(none)';
      term = utm.term;
      content = utm.content;
      landingPath = sanitizePath(firstEvent.path);
      currentPath = landingPath;
      pathHistory = [landingPath];
      deviceClass = firstEvent.device_class || 'desktop';
      browserClass = firstEvent.browser_class || 'other';

      // Increment site-level new daily session & initial bounce
      await db.prepare(
        `INSERT INTO agg_daily_site (site_id, date, sessions, pageviews, bounces, total_active_time, active_times_json)
         VALUES (?, ?, 1, 0, 1, 0, '[]')
         ON CONFLICT(site_id, date) DO UPDATE SET
           sessions = sessions + 1,
           bounces = bounces + 1`
      ).bind(siteId, todayUtc).run();

      // Record attribution
      await db.prepare(
        `INSERT INTO agg_daily_attribution (site_id, date, channel, source, medium, campaign, term, content, sessions, pageviews, bounces)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 1)
         ON CONFLICT(site_id, date, channel, source, medium, campaign, term, content) DO UPDATE SET
           sessions = sessions + 1,
           bounces = bounces + 1`
      ).bind(siteId, todayUtc, channel, source, medium, campaign, term, content).run();

      // Record context metrics
      await db.batch([
        db.prepare(
          `INSERT INTO agg_daily_context (site_id, date, type, value, sessions)
           VALUES (?, ?, 'device', ?, 1)
           ON CONFLICT(site_id, date, type, value) DO UPDATE SET sessions = sessions + 1`
        ).bind(siteId, todayUtc, deviceClass),
        db.prepare(
          `INSERT INTO agg_daily_context (site_id, date, type, value, sessions)
           VALUES (?, ?, 'browser', ?, 1)
           ON CONFLICT(site_id, date, type, value) DO UPDATE SET sessions = sessions + 1`
        ).bind(siteId, todayUtc, browserClass),
        db.prepare(
          `INSERT INTO agg_daily_context (site_id, date, type, value, sessions)
           VALUES (?, ?, 'country', ?, 1)
           ON CONFLICT(site_id, date, type, value) DO UPDATE SET sessions = sessions + 1`
        ).bind(siteId, todayUtc, country)
      ]);
    }

    let newlyCompletedInteractions = false;
    let newlyCompletedGoal = false;

    for (const ev of sessionEvents) {
      const path = sanitizePath(ev.path || currentPath);

      // Check automated goals
      for (const g of siteGoals) {
        if (goalsCompleted.has(g.id)) continue;
        let matched = false;
        if (g.type === 'path' && path === sanitizePath(g.target)) {
          matched = true;
        } else if (g.type === 'click' && ev.type === 'click') {
          if (ev.element_identity === g.target || ev.element_label === g.target) {
            matched = true;
          }
        } else if (g.type === 'outbound' && ev.type === 'click' && ev.is_outbound) {
          if (ev.dest_domain && ev.dest_domain.toLowerCase().includes(g.target.toLowerCase())) {
            matched = true;
          }
        }

        if (matched) {
          goalsCompleted.add(g.id);
          newlyCompletedGoal = true;
          hasGoal = 1;
          await db.prepare(
            `INSERT INTO agg_daily_goals (site_id, date, goal_id, source, campaign, conversions)
             VALUES (?, ?, ?, ?, ?, 1)
             ON CONFLICT(site_id, date, goal_id, source, campaign) DO UPDATE SET
               conversions = conversions + 1`
          ).bind(siteId, todayUtc, g.id, source, campaign).run();
        }
      }

      switch (ev.type) {
        case 'pageview': {
          currentPath = path;
          const isEntry = isNewSession && pageCount === 1;
          if (!isNewSession && path !== pathHistory[pathHistory.length - 1]) {
            pageCount++;
            pathHistory.push(path);

            // Record 2-page path sequence
            if (pathHistory.length >= 2) {
              const seq2 = `${pathHistory[pathHistory.length - 2]} -> ${path}`;
              await db.prepare(
                `INSERT INTO agg_daily_paths (site_id, date, path_length, path_sequence, sessions)
                 VALUES (?, ?, 2, ?, 1)
                 ON CONFLICT(site_id, date, path_sequence) DO UPDATE SET sessions = sessions + 1`
              ).bind(siteId, todayUtc, seq2).run();
            }

            // Record 3-page path sequence
            if (pathHistory.length >= 3) {
              const seq3 = `${pathHistory[pathHistory.length - 3]} -> ${pathHistory[pathHistory.length - 2]} -> ${path}`;
              await db.prepare(
                `INSERT INTO agg_daily_paths (site_id, date, path_length, path_sequence, sessions)
                 VALUES (?, ?, 3, ?, 1)
                 ON CONFLICT(site_id, date, path_sequence) DO UPDATE SET sessions = sessions + 1`
              ).bind(siteId, todayUtc, seq3).run();
            }
          }

          // Update page-level & site-level pageviews
          await db.batch([
            db.prepare(
              `INSERT INTO agg_daily_site (site_id, date, pageviews)
               VALUES (?, ?, 1)
               ON CONFLICT(site_id, date) DO UPDATE SET pageviews = pageviews + 1`
            ).bind(siteId, todayUtc),
            db.prepare(
              `INSERT INTO agg_daily_page (site_id, date, path, pageviews, sessions, entries, bounces)
               VALUES (?, ?, ?, 1, 1, ?, ?)
               ON CONFLICT(site_id, date, path) DO UPDATE SET
                 pageviews = pageviews + 1,
                 sessions = sessions + 1,
                 entries = entries + ?`
            ).bind(siteId, todayUtc, path, isEntry ? 1 : 0, isEntry ? 1 : 0, isEntry ? 1 : 0),
            db.prepare(
              `UPDATE agg_daily_attribution SET pageviews = pageviews + 1
               WHERE site_id = ? AND date = ? AND channel = ? AND source = ? AND medium = ? AND campaign = ?`
            ).bind(siteId, todayUtc, channel, source, medium, campaign)
          ]);
          break;
        }

        case 'element_view': {
          const elIdentity = ev.element_identity || 'unknown';
          const elLabel = ev.element_label || elIdentity;
          const elTag = ev.element_tag || 'div';
          const isOutbound = ev.is_outbound ? 1 : 0;
          const destDomain = ev.dest_domain || '';

          if (!elementsSeen.has(elIdentity)) {
            elementsSeen.add(elIdentity);
            // Increment element view count (sessions that saw element)
            await db.prepare(
              `INSERT INTO agg_daily_element (site_id, date, path, element_identity, element_label, element_tag, views, is_outbound, dest_domain)
               VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
               ON CONFLICT(site_id, date, path, element_identity) DO UPDATE SET
                 views = views + 1`
            ).bind(siteId, todayUtc, path, elIdentity, elLabel, elTag, isOutbound, destDomain).run();
          }
          break;
        }

        case 'click': {
          newlyCompletedInteractions = true;
          hasInteraction = 1;
          const elIdentity = ev.element_identity || 'unknown';
          const elLabel = ev.element_label || elIdentity;
          const elTag = ev.element_tag || 'div';
          const isOutbound = ev.is_outbound ? 1 : 0;
          const destDomain = ev.dest_domain || '';
          const isRage = ev.is_rage_click ? 1 : 0;
          const isDead = ev.is_dead_click ? 1 : 0;

          const isFirstClickInSession = !elementsClicked.has(elIdentity);
          if (isFirstClickInSession) {
            elementsClicked.add(elIdentity);
          }

          // Update element click stats
          await db.prepare(
            `INSERT INTO agg_daily_element (site_id, date, path, element_identity, element_label, element_tag, views, total_clicks, sessions_clicked, rage_clicks, dead_clicks, is_outbound, dest_domain)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
             ON CONFLICT(site_id, date, path, element_identity) DO UPDATE SET
               total_clicks = total_clicks + 1,
               sessions_clicked = sessions_clicked + ?,
               rage_clicks = rage_clicks + ?,
               dead_clicks = dead_clicks + ?`
          ).bind(
            siteId, todayUtc, path, elIdentity, elLabel, elTag,
            elementsSeen.has(elIdentity) ? 1 : 0,
            isFirstClickInSession ? 1 : 0,
            isRage, isDead, isOutbound, destDomain,
            isFirstClickInSession ? 1 : 0,
            isRage, isDead
          ).run();

          // Heatmap click aggregation
          if (typeof ev.click_x === 'number' && typeof ev.click_y === 'number') {
            const xBucket = Math.min(99, Math.max(0, Math.floor(ev.click_x)));
            const yBucket = Math.min(99, Math.max(0, Math.floor(ev.click_y)));
            await db.prepare(
              `INSERT INTO agg_daily_heatmap (site_id, date, path, x_bucket, y_bucket, clicks)
               VALUES (?, ?, ?, ?, ?, 1)
               ON CONFLICT(site_id, date, path, x_bucket, y_bucket) DO UPDATE SET clicks = clicks + 1`
            ).bind(siteId, todayUtc, path, xBucket, yBucket).run();
          }
          break;
        }

        case 'scroll': {
          const depth = Math.min(100, Math.max(0, Math.floor(ev.scroll_depth || 0)));
          if (depth > maxScroll) {
            maxScroll = depth;
          }
          if (depth >= 25) {
            newlyCompletedInteractions = true;
            hasInteraction = 1;
          }

          const r25 = depth >= 25 ? 1 : 0;
          const r50 = depth >= 50 ? 1 : 0;
          const r75 = depth >= 75 ? 1 : 0;
          const r100 = depth >= 100 ? 1 : 0;

          await db.prepare(
            `INSERT INTO agg_daily_scroll (site_id, date, path, reached_25, reached_50, reached_75, reached_100, total_max_depth, session_count)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
             ON CONFLICT(site_id, date, path) DO UPDATE SET
               reached_25 = MAX(reached_25, reached_25 + ?),
               reached_50 = MAX(reached_50, reached_50 + ?),
               reached_75 = MAX(reached_75, reached_75 + ?),
               reached_100 = MAX(reached_100, reached_100 + ?),
               total_max_depth = total_max_depth + ?,
               session_count = session_count + 1`
          ).bind(siteId, todayUtc, path, r25, r50, r75, r100, depth, r25, r50, r75, r100, depth).run();
          break;
        }

        case 'goal': {
          newlyCompletedGoal = true;
          hasGoal = 1;
          if (ev.goal_name && !goalsCompleted.has(ev.goal_name)) {
            goalsCompleted.add(ev.goal_name);
            await db.prepare(
              `INSERT INTO agg_daily_goals (site_id, date, goal_id, source, campaign, conversions)
               VALUES (?, ?, ?, ?, ?, 1)
               ON CONFLICT(site_id, date, goal_id, source, campaign) DO UPDATE SET
                 conversions = conversions + 1`
            ).bind(siteId, todayUtc, ev.goal_name, source, campaign).run();
          }
          break;
        }

        case 'session_flush': {
          const activeSec = Math.max(0, Math.floor(ev.active_time || 0));
          if (activeSec > 0) {
            totalActiveTime += activeSec;

            // Fetch current active_times_json for site & page to append sample duration
            const pageRecord = await db.prepare(
              `SELECT active_times_json FROM agg_daily_page WHERE site_id = ? AND date = ? AND path = ?`
            ).bind(siteId, todayUtc, path).first<{ active_times_json: string }>();

            let pageTimes: number[] = [];
            try {
              pageTimes = JSON.parse(pageRecord?.active_times_json || '[]');
            } catch {}
            if (pageTimes.length < 500) {
              pageTimes.push(activeSec);
            }

            const siteRecord = await db.prepare(
              `SELECT active_times_json FROM agg_daily_site WHERE site_id = ? AND date = ?`
            ).bind(siteId, todayUtc).first<{ active_times_json: string }>();

            let siteTimes: number[] = [];
            try {
              siteTimes = JSON.parse(siteRecord?.active_times_json || '[]');
            } catch {}
            if (siteTimes.length < 500) {
              siteTimes.push(activeSec);
            }

            await db.batch([
              db.prepare(
                `INSERT INTO agg_daily_page (site_id, date, path, total_active_time, active_times_json)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(site_id, date, path) DO UPDATE SET
                   total_active_time = total_active_time + ?,
                   active_times_json = ?`
              ).bind(siteId, todayUtc, path, activeSec, JSON.stringify(pageTimes), activeSec, JSON.stringify(pageTimes)),
              db.prepare(
                `INSERT INTO agg_daily_site (site_id, date, total_active_time, active_times_json)
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT(site_id, date) DO UPDATE SET
                   total_active_time = total_active_time + ?,
                   active_times_json = ?`
              ).bind(siteId, todayUtc, activeSec, JSON.stringify(siteTimes), activeSec, JSON.stringify(siteTimes))
            ]);
          }

          if (ev.is_exit) {
            await db.prepare(
              `INSERT INTO agg_daily_page (site_id, date, path, exits)
               VALUES (?, ?, ?, 1)
               ON CONFLICT(site_id, date, path) DO UPDATE SET exits = exits + 1`
            ).bind(siteId, todayUtc, path).run();
          }
          break;
        }
      }
      totalProcessed++;
    }

    // Evaluate Bounce (§5 definition):
    // Bounce = exactly one pageview AND no meaningful interaction (no click, no scroll past 25%, no goal) AND under 10s active time.
    // If the session was previously recorded as bounce, but now has >1 pageviews OR interaction OR goal OR >= 10s active time:
    const wasBounce = !existingBuffer || existingBuffer.page_count === 1 && !existingBuffer.has_interaction && !existingBuffer.has_goal && existingBuffer.total_active_time < 10;
    const isNowBounce = pageCount === 1 && !hasInteraction && !hasGoal && totalActiveTime < 10;

    if (wasBounce && !isNowBounce) {
      // Un-bounce! Decrement bounces count from site, landing page, and attribution
      await db.batch([
        db.prepare(
          `UPDATE agg_daily_site SET bounces = MAX(0, bounces - 1) WHERE site_id = ? AND date = ?`
        ).bind(siteId, todayUtc),
        db.prepare(
          `UPDATE agg_daily_page SET bounces = MAX(0, bounces - 1) WHERE site_id = ? AND date = ? AND path = ?`
        ).bind(siteId, todayUtc, landingPath),
        db.prepare(
          `UPDATE agg_daily_attribution SET bounces = MAX(0, bounces - 1)
           WHERE site_id = ? AND date = ? AND channel = ? AND source = ? AND medium = ? AND campaign = ?`
        ).bind(siteId, todayUtc, channel, source, medium, campaign)
      ]);
    }

    // Upsert ephemeral active_sessions_buffer (expires in 30 minutes of inactivity)
    const expiresAt = now + 30 * 60 * 1000;
    await db.prepare(
      `INSERT INTO active_sessions_buffer (
         site_id, session_id, first_seen_at, last_seen_at, landing_path, current_path,
         page_count, path_history, total_active_time, has_interaction, has_goal, max_scroll,
         elements_seen, elements_clicked, goals_completed, source, medium, campaign, channel,
         device_class, browser_class, country, expires_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(site_id, session_id) DO UPDATE SET
         last_seen_at = ?,
         current_path = ?,
         page_count = ?,
         path_history = ?,
         total_active_time = ?,
         has_interaction = ?,
         has_goal = ?,
         max_scroll = ?,
         elements_seen = ?,
         elements_clicked = ?,
         goals_completed = ?,
         expires_at = ?`
    ).bind(
      siteId, sessionId, isNewSession ? now : existingBuffer.first_seen_at, now, landingPath, currentPath,
      pageCount, JSON.stringify(pathHistory), totalActiveTime, hasInteraction, hasGoal, maxScroll,
      JSON.stringify(Array.from(elementsSeen)), JSON.stringify(Array.from(elementsClicked)),
      JSON.stringify(Array.from(goalsCompleted)), source, medium, campaign, channel,
      deviceClass, browserClass, country, expiresAt,
      // Update values:
      now, currentPath, pageCount, JSON.stringify(pathHistory), totalActiveTime,
      hasInteraction, hasGoal, maxScroll,
      JSON.stringify(Array.from(elementsSeen)), JSON.stringify(Array.from(elementsClicked)),
      JSON.stringify(Array.from(goalsCompleted)), expiresAt
    ).run();
  }

  return { success: true, eventsProcessed: totalProcessed };
}
