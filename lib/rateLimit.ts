/**
 * Tiny in-memory token bucket. Sufficient for low-volume public
 * endpoints where we just want to keep bots from hammering us. Once
 * volume justifies it, swap for Upstash Redis without changing the
 * surface — same { allowed, retryAfter } return shape.
 *
 * On Vercel Fluid Compute, in-memory state survives within a warm
 * function instance but doesn't replicate across cold starts or
 * regional instances. That's fine for a deterrent; a determined
 * attacker bypasses it by hitting from many IPs anyway.
 */

type Bucket = { tokens: number; updatedAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number };

export function rateLimit(input: {
  key: string;
  /** Max requests per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}): RateLimitResult {
  const now = Date.now();
  const refillPerMs = input.limit / (input.windowSeconds * 1000);

  const existing = buckets.get(input.key) ?? {
    tokens: input.limit,
    updatedAt: now,
  };
  // Refill linearly since last touch, capped at the limit.
  const refilled = Math.min(
    input.limit,
    existing.tokens + (now - existing.updatedAt) * refillPerMs,
  );

  if (refilled < 1) {
    const needed = 1 - refilled;
    const retryAfterSeconds = Math.ceil(needed / refillPerMs / 1000);
    buckets.set(input.key, { tokens: refilled, updatedAt: now });
    return { allowed: false, retryAfterSeconds };
  }

  buckets.set(input.key, { tokens: refilled - 1, updatedAt: now });
  return { allowed: true, remaining: Math.floor(refilled - 1) };
}
