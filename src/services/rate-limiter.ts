// Rate limiting service (§8)
// Sliding window per site key to prevent abuse and runaway bills.

const memoryLimitMap = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 600; // 600 requests / minute per site key (10 req/s avg)

export async function checkRateLimit(
  db: D1Database,
  siteKey: string,
  maxRequests: number = MAX_REQUESTS_PER_WINDOW
): Promise<{ allowed: boolean; remaining: number }> {
  const now = Date.now();
  const currentWindow = Math.floor(now / WINDOW_MS);
  const cacheKey = `${siteKey}:${currentWindow}`;

  // Check in-memory first for fast-path
  const cached = memoryLimitMap.get(cacheKey);
  if (cached) {
    if (cached.count >= maxRequests) {
      return { allowed: false, remaining: 0 };
    }
    cached.count++;
    return { allowed: true, remaining: maxRequests - cached.count };
  }

  // Prune older windows in memory
  if (memoryLimitMap.size > 2000) {
    for (const [k, v] of memoryLimitMap.entries()) {
      if (now - v.windowStart > WINDOW_MS * 2) {
        memoryLimitMap.delete(k);
      }
    }
  }

  // D1 check/upsert for persistence across isolates
  try {
    const expiresAt = now + WINDOW_MS * 2;
    const res = await db.prepare(
      `INSERT INTO rate_limits (key, count, expires_at)
       VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET count = count + 1
       RETURNING count`
    ).bind(cacheKey, expiresAt).first<{ count: number }>();

    const count = res?.count ?? 1;
    memoryLimitMap.set(cacheKey, { count, windowStart: now });

    if (count > maxRequests) {
      return { allowed: false, remaining: 0 };
    }
    return { allowed: true, remaining: maxRequests - count };
  } catch {
    // If D1 fails or is busy, fallback to in-memory rate limiting
    memoryLimitMap.set(cacheKey, { count: 1, windowStart: now });
    return { allowed: true, remaining: maxRequests - 1 };
  }
}
