// Bot filtering service (§5)
// Non-JS crawlers never hit snippet. Server-side checks ignore known bots, headless signatures, and search engine crawlers.

const BOT_PATTERNS = [
  /bot\b/i,
  /crawl/i,
  /spider/i,
  /slurp/i,
  /headless/i,
  /googlebot/i,
  /bingbot/i,
  /yandex/i,
  /duckduckbot/i,
  /baiduspider/i,
  /sogou/i,
  /exabot/i,
  /facebot/i,
  /facebookexternalhit/i,
  /ia_archiver/i,
  /archive\.org_bot/i,
  /curl/i,
  /wget/i,
  /python-requests/i,
  /aiohttp/i,
  /httpx/i,
  /postman/i,
  /insomnia/i,
  /node-fetch/i,
  /axios/i,
  /lighthouse/i,
  /pagespeed/i,
  /chrome-lighthouse/i,
  /ptst/i, // WebPageTest
  /pingdom/i,
  /uptimerobot/i,
  /datadog/i,
  /newrelic/i,
  /browserless/i,
  /playwright/i,
  /puppeteer/i,
  /selenium/i,
  /webdriver/i
];

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.trim() === '') return true;
  for (const pattern of BOT_PATTERNS) {
    if (pattern.test(userAgent)) {
      return true;
    }
  }
  return false;
}

export function isBotSession(activeTimeSeconds: number, hasInteraction: boolean): boolean {
  // Ignore sessions under 1 second of active time with no interaction (§5)
  if (activeTimeSeconds < 1 && !hasInteraction) {
    return true;
  }
  return false;
}
