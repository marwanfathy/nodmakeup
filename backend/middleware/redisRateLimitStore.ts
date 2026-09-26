import type { Store } from 'express-rate-limit';
import { redis } from '../config/redisClient';

/**
 * Redis-backed store for express-rate-limit.
 *
 * The default MemoryStore keeps its counters in the Node process, which makes
 * two guarantees that matter here both false:
 *
 *  1. It is per-instance. The limiter was mounted with a single global budget of
 *     1000 requests / 15 min for all of `/api/`. With more than one instance
 *     behind the load balancer, the effective ceiling is 1000 x instances, and
 *     restarting any pod silently hands its customers a fresh allowance — so a
 *     crash loop is also a rate-limit bypass.
 *  2. It never evicts. Keys accumulate for the lifetime of the process, so the
 *     map grows without bound and every expired entry keeps costing memory.
 *
 * Moving to Redis makes the budget global and shared, and gives the counters a
 * TTL so Redis does the eviction.
 *
 * Implemented here rather than pulled in as `rate-limit-redis` because the whole
 * store is one atomic INCR + EXPIRE, and a dependency plus a lockfile change is
 * a poor trade for that.
 */

/**
 * Increment and set the TTL in one round trip.
 *
 * The naive `INCR` then `EXPIRE` has a hole: if the process dies between the
 * two, the key exists with no TTL, and that client's allowance is never
 * restored — a permanent ban rather than a temporary one. A Lua script is
 * atomic in Redis, so the window is always set. `EXPIRE ... NX` also means a
 * refresh mid-window does not slide the window forward, which would let a
 * client keep its allowance alive indefinitely by making one request per
 * window.
 */
const INCREMENT_WITH_TTL = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { current, ttl }
`;

export interface RedisRateLimitOptions {
    /** Prefix for the keys this store owns, so limiters cannot collide. */
    prefix?: string;
}

export class RedisRateLimitStore implements Store {
    /**
     * Namespace for this store's keys. Public because `Store` declares an
     * optional `prefix?: string`; each limiter in server.ts gets its own so the
     * four limiters cannot read or reset each other's counters.
     */
    prefix: string;

    /** Set once redis reports it is usable; until then the store fails open. */
    private healthy = false;
    /** Undefined until `init` hands us the configured window. */
    private windowMs?: number;

    constructor(options: RedisRateLimitOptions = {}) {
        this.prefix = options.prefix ?? 'rl:';

        redis.on('ready', () => {
            this.healthy = true;
        });
        redis.on('end', () => {
            this.healthy = false;
        });
        if (redis.isReady) this.healthy = true;
    }

    /** Pass the configured window to the store, which needs it for the TTL. */
    init(options: { windowMs: number }): void {
        this.windowMs = options.windowMs;
    }

    private keyFor(key: string): string {
        return `${this.prefix}${key}`;
    }

    /**
     * Returns the current count for this key.
     *
     * When redis is unavailable this reports a count of 0, which the middleware
     * compares against `max` and therefore never blocks. That is a deliberate
     * fail-open: a redis outage must not take the storefront offline, and the
     * endpoints that genuinely need hard protection (admin auth, checkout) are
     * guarded by application-level rules that do not depend on this store —
     * the stock reservation is a conditional UPDATE, admin login is not the only
     * barrier. The cost is that a redis outage removes this layer, so the
     * tradeoff is logged loudly rather than hidden.
     */
    async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
        if (!this.healthy || !this.windowMs) return this.unlimited();

        try {
            const [total, ttl] = (await redis.eval(INCREMENT_WITH_TTL, {
                keys: [this.keyFor(key)],
                arguments: [String(this.windowMs)],
            })) as [number, number];

            // A negative PTTL means the key has no expiry, which can only
            // happen if it predates this store. Force one so the key is
            // eventually collected instead of living forever.
            if (ttl < 0) {
                await redis.pExpire(this.keyFor(key), this.windowMs);
            }

            return {
                totalHits: total,
                resetTime: new Date(Date.now() + (ttl > 0 ? ttl : this.windowMs)),
            };
        } catch (err) {
            console.error('[rate-limit] redis increment failed, failing open:', (err as Error).message);
            this.healthy = false;
            return this.unlimited();
        }
    }

    /** The fail-open response: a count no configured `max` will ever exceed. */
    private unlimited(): { totalHits: number; resetTime: Date } {
        return {
            totalHits: 0,
            resetTime: new Date(Date.now() + (this.windowMs ?? 60_000)),
        };
    }

    async decrement(key: string): Promise<void> {
        if (!this.healthy) return;
        try {
            const current = await redis.get(this.keyFor(key));
            if (current && Number(current) <= 1) {
                await redis.del(this.keyFor(key));
            } else if (current) {
                await redis.decr(this.keyFor(key));
            }
        } catch (err) {
            console.error('[rate-limit] redis decrement failed:', (err as Error).message);
        }
    }

    async resetKey(key: string): Promise<void> {
        if (!this.healthy) return;
        try {
            await redis.del(this.keyFor(key));
        } catch (err) {
            console.error('[rate-limit] redis resetKey failed:', (err as Error).message);
        }
    }

    /** Not backed by a Map, so nothing to reset. Present for Store compliance. */
    resetAll(): void {
        /* no-op */
    }
}
