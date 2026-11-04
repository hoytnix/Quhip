// Referrer and UTM attribution service (§9)

const SEARCH_DOMAINS = new Set([
  'google.com', 'www.google.com',
  'bing.com', 'www.bing.com',
  'duckduckgo.com', 'www.duckduckgo.com',
  'yahoo.com', 'search.yahoo.com',
  'baidu.com', 'www.baidu.com',
  'yandex.com', 'yandex.ru',
  'ecosia.org', 'www.ecosia.org',
  'qwant.com', 'www.qwant.com',
  'ask.com', 'www.ask.com',
  'brave.com', 'search.brave.com'
]);

const SOCIAL_DOMAINS = new Set([
  't.co', 'twitter.com', 'x.com',
  'facebook.com', 'm.facebook.com', 'l.facebook.com', 'lm.facebook.com',
  'instagram.com', 'l.instagram.com',
  'linkedin.com', 'lnkd.in',
  'reddit.com', 'old.reddit.com',
  'pinterest.com',
  'tiktok.com',
  'youtube.com', 'youtu.be',
  'threads.net',
  'bsky.app', 'bluesky.ms',
  'mastodon.social',
  'whatsapp.com',
  'telegram.org', 't.me'
]);

const PAID_MEDIUM_REGEX = /^(cpc|ppc|paid|paid-search|paid-social|display|cpm|cpv|cpa)$/i;
const EMAIL_MEDIUM_REGEX = /^(email|newsletter|e-mail)$/i;
const SOCIAL_MEDIUM_REGEX = /^(social|social-network|social-media)$/i;

export interface SanitizedAttribution {
  channel: 'direct' | 'search' | 'social' | 'referral' | 'email' | 'paid';
  source: string;
  medium: string;
  campaign: string;
  term: string;
  content: string;
}

/**
 * Extracts and sanitizes referrer domain (strictly domain only, no paths, no search queries)
 */
export function sanitizeReferrerDomain(referrerUrl?: string | null): string {
  if (!referrerUrl || referrerUrl.trim() === '') return '';
  try {
    const parsed = new URL(referrerUrl.startsWith('http') ? referrerUrl : `https://${referrerUrl}`);
    // Return hostname in lowercase, strip leading www if preferred or normalize
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    return hostname;
  } catch {
    return '';
  }
}

/**
 * Sanitizes page path: strictly path only, no query string or hashes
 */
export function sanitizePath(rawPath?: string | null): string {
  if (!rawPath || rawPath.trim() === '') return '/';
  try {
    // If passed a full URL, parse path
    if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) {
      const parsed = new URL(rawPath);
      return parsed.pathname || '/';
    }
    // Remove query params and hashes
    const clean = rawPath.split('?')[0].split('#')[0].trim();
    return clean.startsWith('/') ? clean : `/${clean}`;
  } catch {
    return '/';
  }
}

/**
 * Strips all ad click identifiers (gclid, fbclid, msclkid, twclid, etc.)
 * and keeps only sanitized UTM parameters.
 */
export function sanitizeUtm(
  rawUtmSource?: string | null,
  rawUtmMedium?: string | null,
  rawUtmCampaign?: string | null,
  rawUtmTerm?: string | null,
  rawUtmContent?: string | null
): { source: string; medium: string; campaign: string; term: string; content: string } {
  const clean = (val?: string | null) => (val ? val.trim().slice(0, 100) : '');
  return {
    source: clean(rawUtmSource),
    medium: clean(rawUtmMedium),
    campaign: clean(rawUtmCampaign),
    term: clean(rawUtmTerm),
    content: clean(rawUtmContent)
  };
}

/**
 * Computes channel grouping per §9:
 * direct/none, search, social, referral, email, paid
 */
export function computeChannelGroup(
  referrerDomain: string,
  utm: { source: string; medium: string; campaign: string }
): 'direct' | 'search' | 'social' | 'referral' | 'email' | 'paid' {
  const medium = utm.medium.toLowerCase();
  const source = utm.source.toLowerCase();

  // Paid media takes priority
  if (PAID_MEDIUM_REGEX.test(medium)) {
    return 'paid';
  }

  // Email
  if (EMAIL_MEDIUM_REGEX.test(medium) || source === 'email' || source === 'newsletter') {
    return 'email';
  }

  // Social
  if (SOCIAL_MEDIUM_REGEX.test(medium) || SOCIAL_DOMAINS.has(referrerDomain) || SOCIAL_DOMAINS.has(`www.${referrerDomain}`)) {
    return 'social';
  }

  // Search
  if (medium === 'organic' || SEARCH_DOMAINS.has(referrerDomain) || SEARCH_DOMAINS.has(`www.${referrerDomain}`)) {
    return 'search';
  }

  // Referral
  if (referrerDomain && referrerDomain !== '') {
    return 'referral';
  }

  // Direct
  return 'direct';
}

/**
 * Coarse browser family classifier (no version fingerprinting) (§6)
 */
export function classifyBrowser(ua: string | null | undefined): 'Chrome' | 'Firefox' | 'Safari' | 'Edge' | 'other' {
  if (!ua) return 'other';
  if (/Edg([ea]|iOS)?\//i.test(ua)) return 'Edge';
  if (/Firefox|FxiOS/i.test(ua)) return 'Firefox';
  if (/Chrome|CriOS/i.test(ua)) return 'Chrome';
  if (/Safari/i.test(ua) && !/Chrome|CriOS/i.test(ua)) return 'Safari';
  return 'other';
}

/**
 * Coarse device class classifier (§6)
 */
export function classifyDevice(
  ua: string | null | undefined,
  viewportWidth?: number
): 'desktop' | 'mobile' | 'tablet' {
  if (viewportWidth !== undefined) {
    if (viewportWidth < 640) return 'mobile';
    if (viewportWidth <= 1024) return 'tablet';
    return 'desktop';
  }

  if (!ua) return 'desktop';
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android.*mobile|blackberry|iemobile|opera mini/i.test(ua)) return 'mobile';
  return 'desktop';
}
