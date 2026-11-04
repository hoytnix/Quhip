import { renderConsentBanner, getStoredConsent } from './banner';

(function () {
  'use strict';

  // 1. Bot check (§5)
  if (typeof navigator !== 'undefined' && navigator.webdriver) {
    return;
  }

  // 2. Discover configuration from current script tag
  const script = document.currentScript as HTMLScriptElement ||
    document.querySelector('script[data-site]') ||
    document.querySelector('script[src*="quhip.js"]');

  const siteKey = script?.getAttribute('data-site');
  if (!siteKey) {
    return; // No site key configured
  }

  const customApi = script?.getAttribute('data-api');
  let apiUrl: string = customApi || '';
  if (!apiUrl) {
    try {
      const srcAttr = script?.getAttribute('src') || '';
      const srcUrl = new URL(srcAttr, window.location.href);
      apiUrl = `${srcUrl.origin}/api/event`;
    } catch {
      apiUrl = '/api/event';
    }
  }

  const rawConsentAttr = script?.getAttribute('data-consent');
  let consentBannerSetting = rawConsentAttr === 'true';

  // 3. Ephemeral Session Management (§5)
  // Strictly sessionStorage only, dies on tab close, never cookie or localStorage
  const SESSION_KEY = 'quhip_sid';
  const LAST_ACTIVE_KEY = 'quhip_slast';
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  function getOrInitSession(): string {
    const now = Date.now();
    let sid = sessionStorage.getItem(SESSION_KEY);
    const lastActive = parseInt(sessionStorage.getItem(LAST_ACTIVE_KEY) || '0', 10);

    if (!sid || (now - lastActive > SESSION_TIMEOUT_MS)) {
      // Ephemeral random session ID
      sid = 'qs_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    sessionStorage.setItem(LAST_ACTIVE_KEY, now.toString());
    return sid;
  }

  function touchSessionActivity(): void {
    sessionStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
  }

  // 4. Batching and Transport (§8)
  let eventQueue: any[] = [];
  let isFlushing = false;
  let flushTimer: any = null;

  function queueEvent(event: any): void {
    if (consentBannerSetting) {
      const consent = getStoredConsent();
      if (!consent || !consent.analytics) {
        return; // Strictly no tracking before affirmative consent (§10)
      }
    }

    touchSessionActivity();
    eventQueue.push({
      ...event,
      session_id: getOrInitSession(),
      path: window.location.pathname || '/'
    });

    if (eventQueue.length >= 5) {
      flushEvents();
    } else if (!flushTimer) {
      flushTimer = setTimeout(flushEvents, 1000);
    }
  }

  function flushEvents(): void {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (eventQueue.length === 0 || isFlushing) return;

    if (consentBannerSetting) {
      const consent = getStoredConsent();
      if (!consent || !consent.analytics) {
        eventQueue = [];
        return;
      }
    }

    const batch = eventQueue.slice();
    eventQueue = [];

    const payload = JSON.stringify({
      site_key: siteKey,
      events: batch
    });

    let sent = false;
    try {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        // Use text/plain Blob to ensure CORS simple-request compliance without preflight blocking
        sent = navigator.sendBeacon(apiUrl, new Blob([payload], { type: 'text/plain;charset=UTF-8' }));
      }
    } catch {}

    if (!sent) {
      // Fallback to fetch with keepalive
      try {
        fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body: payload,
          keepalive: true
        }).catch(() => {
          // Degrade silently per §8
        });
      } catch {}
    }
  }

  // Periodic flush every 10s
  setInterval(flushEvents, 10000);

  // 5. Active Time Tracking (§5)
  // Only counts when tab is visible AND active within last 4s
  let pageActiveSeconds = 0;
  let lastUserActivityTimestamp = Date.now();
  let activeTimerInterval: any = null;

  function registerUserActivity(): void {
    lastUserActivityTimestamp = Date.now();
  }

  const throttledActivity = throttle(registerUserActivity, 500);
  ['mousemove', 'keydown', 'scroll', 'touchstart'].forEach(type => {
    window.addEventListener(type, throttledActivity, { passive: true });
  });

  function startActiveTimer(): void {
    if (activeTimerInterval) clearInterval(activeTimerInterval);
    activeTimerInterval = setInterval(() => {
      const isVisible = document.visibilityState === 'visible';
      const isRecentlyActive = (Date.now() - lastUserActivityTimestamp) < 4000;
      if (isVisible && isRecentlyActive) {
        pageActiveSeconds++;
      }
    }, 1000);
  }
  startActiveTimer();

  function flushActiveTime(isExit = false): void {
    if (pageActiveSeconds > 0 || isExit) {
      queueEvent({
        type: 'session_flush',
        active_time: pageActiveSeconds,
        is_exit: isExit
      });
      pageActiveSeconds = 0;
      flushEvents();
    }
  }

  // Flush on visibility change and pagehide (§5, §8)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushActiveTime(false);
    }
  });
  window.addEventListener('pagehide', () => {
    flushActiveTime(true);
  });

  // 6. Context Attribution (§9)
  function getAttributionPayload(): any {
    const params = new URLSearchParams(window.location.search);
    return {
      referrer_domain: document.referrer ? extractDomain(document.referrer) : '',
      utm_source: params.get('utm_source') || undefined,
      utm_medium: params.get('utm_medium') || undefined,
      utm_campaign: params.get('utm_campaign') || undefined,
      utm_term: params.get('utm_term') || undefined,
      utm_content: params.get('utm_content') || undefined,
      device_class: getDeviceClass(),
      browser_class: getBrowserClass(),
      viewport_bucket: `${window.innerWidth}x${window.innerHeight}`
    };
  }

  function extractDomain(url: string): string {
    try {
      const u = new URL(url);
      if (u.hostname === window.location.hostname) return '';
      return u.hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return '';
    }
  }

  function getDeviceClass(): 'desktop' | 'mobile' | 'tablet' {
    const w = window.innerWidth;
    if (w < 640) return 'mobile';
    if (w <= 1024) return 'tablet';
    return 'desktop';
  }

  function getBrowserClass(): 'Chrome' | 'Firefox' | 'Safari' | 'Edge' | 'other' {
    const ua = navigator.userAgent;
    if (/Edg([ea]|iOS)?\//i.test(ua)) return 'Edge';
    if (/Firefox|FxiOS/i.test(ua)) return 'Firefox';
    if (/Chrome|CriOS/i.test(ua)) return 'Chrome';
    if (/Safari/i.test(ua) && !/Chrome|CriOS/i.test(ua)) return 'Safari';
    return 'other';
  }

  // 7. Pageview Tracking
  function trackPageview(): void {
    const attr = getAttributionPayload();
    queueEvent({
      type: 'pageview',
      ...attr
    });
    // Restart active timer and reset scroll
    pageActiveSeconds = 0;
    resetScrollTracking();
    observeElements();
  }

  // 8. Element Identification & Delegated Click Tracking (§7)
  function identifyElement(el: HTMLElement): { id: string; label: string; tag: string } {
    const tag = el.tagName.toLowerCase();

    // Priority 1: data-quhip
    const quhipAttr = el.getAttribute('data-quhip');
    if (quhipAttr && quhipAttr.trim()) {
      return { id: `quhip:${quhipAttr.trim()}`, label: quhipAttr.trim(), tag };
    }

    // Priority 2: Element ID (not random/hashed)
    if (el.id && !isHashedId(el.id)) {
      return { id: `#${el.id}`, label: el.id, tag };
    }

    // Priority 3: aria-label
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) {
      return { id: `aria:${ariaLabel.trim()}`, label: ariaLabel.trim(), tag };
    }

    // Priority 4: Generated structural selector path
    const selector = getStructuralSelector(el);
    return { id: selector, label: selector, tag };
  }

  function isHashedId(id: string): boolean {
    return /^[:_]?[0-9a-f]{8,}/i.test(id) || /^rc-[0-9a-z]+/i.test(id) || id.length > 32;
  }

  function getStructuralSelector(el: HTMLElement): string {
    const parts: string[] = [];
    let curr: HTMLElement | null = el;
    let depth = 0;

    while (curr && curr !== document.body && depth < 3) {
      let part = curr.tagName.toLowerCase();
      if (curr.id && !isHashedId(curr.id)) {
        parts.unshift(`#${curr.id}`);
        break;
      }
      // Use stable class if available
      const stableClasses = Array.from(curr.classList)
        .filter(c => !isHashedClass(c))
        .slice(0, 2);
      if (stableClasses.length > 0) {
        part += '.' + stableClasses.join('.');
      }
      parts.unshift(part);
      curr = curr.parentElement;
      depth++;
    }
    return parts.join(' > ') || el.tagName.toLowerCase();
  }

  function isHashedClass(cls: string): boolean {
    return /^[a-z0-9_-]{8,}$/i.test(cls) && /\d/.test(cls) && /[a-z]/i.test(cls);
  }

  // Privacy Check (§4, §7): Ignore inputs, passwords, textareas, contenteditable, and data-quhip-ignore
  function isIgnoredElement(el: HTMLElement | null): boolean {
    if (!el) return true;
    if (el.closest('[data-quhip-ignore]')) return true;

    const tag = el.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (el.isContentEditable) return true;
    if (el.getAttribute('type') === 'password') return true;

    return false;
  }

  // Delegated Click Listener
  const recentClicks: { id: string; time: number }[] = [];

  document.addEventListener('click', (e: MouseEvent) => {
    let target = e.target as HTMLElement | null;
    if (!target) return;

    if (isIgnoredElement(target)) return;

    // Find clickable ancestor if clicked on inner icon/span
    const clickable = target.closest('a, button, [role="button"], input[type="submit"], [data-quhip]') as HTMLElement || target;
    if (isIgnoredElement(clickable)) return;

    const { id: elId, label: elLabel, tag: elTag } = identifyElement(clickable);

    // Rage click detection: 3+ clicks on same element within 2 seconds (§7)
    const now = Date.now();
    recentClicks.push({ id: elId, time: now });
    // Remove clicks older than 2s
    while (recentClicks.length > 0 && now - recentClicks[0].time > 2000) {
      recentClicks.shift();
    }
    const sameClicksCount = recentClicks.filter(c => c.id === elId).length;
    const isRageClick = sameClicksCount >= 3;

    // Outbound link check
    const anchor = clickable.closest('a') as HTMLAnchorElement | null;
    let isOutbound = false;
    let destDomain = '';
    if (anchor && anchor.href) {
      try {
        const u = new URL(anchor.href);
        if (u.hostname && u.hostname !== window.location.hostname) {
          isOutbound = true;
          destDomain = u.hostname.replace(/^www\./, '').toLowerCase();
        }
      } catch {}
    }

    // Normalized Heatmap click coordinates (0-99%) (§7)
    const docWidth = Math.max(document.documentElement.scrollWidth, window.innerWidth);
    const docHeight = Math.max(document.documentElement.scrollHeight, window.innerHeight);
    const clickX = Math.min(99, Math.max(0, Math.floor((e.pageX / docWidth) * 100)));
    const clickY = Math.min(99, Math.max(0, Math.floor((e.pageY / docHeight) * 100)));

    // Dead click detection (§7): Clicks producing no visible change, navigation, or goal
    const initialDomHash = document.body.childElementCount;
    const initialUrl = window.location.href;

    setTimeout(() => {
      const navigated = window.location.href !== initialUrl;
      const domChanged = document.body.childElementCount !== initialDomHash;
      const isDeadClick = !navigated && !domChanged && !isOutbound && clickable.tagName.toLowerCase() !== 'a';

      queueEvent({
        type: 'click',
        element_identity: elId,
        element_label: elLabel,
        element_tag: elTag,
        is_outbound: isOutbound,
        dest_domain: destDomain,
        is_rage_click: isRageClick,
        is_dead_click: isDeadClick,
        click_x: clickX,
        click_y: clickY
      });
    }, 400);
  }, { capture: true, passive: true });

  // 9. Element Visibility via IntersectionObserver (§7)
  // Counts sessions in which an element became at least 50% visible
  const observedElementsSet = new Set<string>();
  let intersectionObserver: IntersectionObserver | null = null;

  function observeElements(): void {
    if (typeof IntersectionObserver === 'undefined') return;
    if (intersectionObserver) intersectionObserver.disconnect();

    intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          const el = entry.target as HTMLElement;
          if (isIgnoredElement(el)) return;

          const { id: elId, label: elLabel, tag: elTag } = identifyElement(el);
          if (!observedElementsSet.has(elId)) {
            observedElementsSet.add(elId);

            const anchor = el.closest('a') as HTMLAnchorElement | null;
            let isOutbound = false;
            let destDomain = '';
            if (anchor && anchor.href) {
              try {
                const u = new URL(anchor.href);
                if (u.hostname && u.hostname !== window.location.hostname) {
                  isOutbound = true;
                  destDomain = u.hostname.replace(/^www\./, '').toLowerCase();
                }
              } catch {}
            }

            queueEvent({
              type: 'element_view',
              element_identity: elId,
              element_label: elLabel,
              element_tag: elTag,
              is_outbound: isOutbound,
              dest_domain: destDomain
            });
          }
        }
      });
    }, { threshold: [0.5] });

    // Auto-discover candidate interactive & CTA elements on page
    const candidates = document.querySelectorAll<HTMLElement>(
      'a, button, [role="button"], [data-quhip], header, footer, section, .cta, .btn'
    );
    candidates.forEach(el => {
      if (!isIgnoredElement(el)) {
        intersectionObserver?.observe(el);
      }
    });
  }

  // 10. Scroll Depth Tracking (§5, §6)
  const reachedMilestones = new Set<number>();

  function resetScrollTracking(): void {
    reachedMilestones.clear();
  }

  function checkScrollDepth(): void {
    const docHeight = Math.max(
      document.body.scrollHeight, document.documentElement.scrollHeight,
      document.body.offsetHeight, document.documentElement.offsetHeight,
      document.body.clientHeight, document.documentElement.clientHeight
    );
    const winHeight = window.innerHeight;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const depthPercent = Math.min(100, Math.round(((scrollTop + winHeight) / docHeight) * 100));

    const milestones = [25, 50, 75, 100];
    for (const m of milestones) {
      if (depthPercent >= m && !reachedMilestones.has(m)) {
        reachedMilestones.add(m);
        queueEvent({
          type: 'scroll',
          scroll_depth: m
        });
      }
    }
  }

  window.addEventListener('scroll', throttle(checkScrollDepth, 250), { passive: true });

  // 11. SPA Route Change Handling (§6, §8)
  function handleSpaNavigation(): void {
    flushActiveTime(false);
    setTimeout(trackPageview, 50);
  }

  const origPushState = history.pushState;
  history.pushState = function (...args) {
    origPushState.apply(this, args);
    handleSpaNavigation();
  };

  const origReplaceState = history.replaceState;
  history.replaceState = function (...args) {
    origReplaceState.apply(this, args);
    handleSpaNavigation();
  };

  window.addEventListener('popstate', handleSpaNavigation);

  // 12. Initialization & Optional Consent Gating (§10)
  function startTracking() {
    if (consentBannerSetting) {
      renderConsentBanner((consented) => {
        if (consented) {
          trackPageview();
        } else {
          eventQueue = []; // Drop anything queued
        }
      });
      const consent = getStoredConsent();
      if (consent && consent.analytics) {
        trackPageview();
      }
    } else {
      // Default mode: cookieless, privacy-first, zero banner needed
      trackPageview();
    }
  }

  // If data-consent attribute is not explicitly provided, check remote site setting
  if (rawConsentAttr === null || rawConsentAttr === undefined) {
    try {
      const configUrl = `${new URL(apiUrl).origin}/api/config?site=${encodeURIComponent(siteKey)}`;
      fetch(configUrl)
        .then(r => r.json())
        .then((cfg: any) => {
          if (cfg && cfg.consent_banner_enabled) {
            consentBannerSetting = true;
          }
          startTracking();
        })
        .catch(() => {
          startTracking();
        });
    } catch {
      startTracking();
    }
  } else {
    startTracking();
  }

  // Helper utility: throttle
  function throttle(fn: Function, delayMs: number): any {
    let last = 0;
    return function (...args: any[]) {
      const now = Date.now();
      if (now - last >= delayMs) {
        last = now;
        fn.apply(null, args);
      }
    };
  }

})();
