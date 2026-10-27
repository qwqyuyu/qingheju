/* ==========================================
   config/ratelimit.js — 轻量内存限流
   ------------------------------------------
   不引入额外依赖；按用户 id（未登录时按 IP）计数。
   适用于单进程部署；多实例部署需要换成 Redis 等共享存储。

   用法：
     const limiter = createRateLimiter({ windowMs: 600000, max: 30 });
     router.post('/x', authMiddleware, limiter, handler);
   ========================================== */

function positiveInt(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function createRateLimiter(options) {
    const opts = options || {};
    const windowMs = positiveInt(opts.windowMs, 10 * 60 * 1000);
    const max = positiveInt(opts.max, 30);
    const message = opts.message || '请求过于频繁，请稍后再试';
    const keyGenerator = typeof opts.keyGenerator === 'function'
        ? opts.keyGenerator
        : (req) => (req.user && req.user.id ? 'user:' + req.user.id : 'ip:' + req.ip);

    /* key -> { count, resetAt } */
    const buckets = new Map();

    /* 定期清理过期桶，避免内存无限增长 */
    const cleanup = setInterval(() => {
        const now = Date.now();
        for (const [key, bucket] of buckets) {
            if (bucket.resetAt <= now) buckets.delete(key);
        }
    }, Math.min(windowMs, 60 * 1000));
    if (typeof cleanup.unref === 'function') cleanup.unref();

    return function rateLimit(req, res, next) {
        const id = keyGenerator(req) || ('ip:' + req.ip);
        const now = Date.now();

        let bucket = buckets.get(id);
        if (!bucket || bucket.resetAt <= now) {
            bucket = { count: 0, resetAt: now + windowMs };
            buckets.set(id, bucket);
        }
        bucket.count += 1;

        res.setHeader('X-RateLimit-Limit', String(max));
        res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
        res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

        if (bucket.count > max) {
            const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
            res.setHeader('Retry-After', String(retryAfter));
            return res.status(429).json({
                success: false,
                code: 429,
                message,
                msg: message
            });
        }

        next();
    };
}

module.exports = { createRateLimiter };
