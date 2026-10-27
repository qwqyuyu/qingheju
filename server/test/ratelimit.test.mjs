/* ==========================================
   限流器单测（不依赖数据库、不发网络请求）
   运行：node test/ratelimit.test.mjs
   ========================================== */

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createRateLimiter } = require('../config/ratelimit.js');

const limiter = createRateLimiter({ windowMs: 60000, max: 2, message: 'too many' });
function call(userId) {
    return new Promise(resolve => {
        const res = {
            headers: {},
            setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
            status(code) { this.code = code; return this; },
            json(body) { resolve({ status: this.code, body, headers: this.headers }); }
        };
        limiter({ user: { id: userId }, ip: '127.0.0.1' }, res, () => {
            resolve({ status: 200, headers: res.headers });
        });
    });
}

const first = await call(7);
const second = await call(7);
const third = await call(7);

assert.equal(first.status, 200);
assert.equal(second.status, 200);
assert.equal(third.status, 429, '第 3 次应被限流');
assert.equal(third.body.code, 429);
assert.equal(third.body.msg, 'too many');
assert.ok(Number(third.headers['retry-after']) > 0, '应返回 Retry-After');
assert.equal(second.headers['x-ratelimit-remaining'], '0');

/* 不同用户互不影响 */
const other = await call(8);
assert.equal(other.status, 200, '另一个用户不应受影响');

console.log('  ✓ 超过上限返回 429，且按用户隔离');
console.log('\n限流测试全部通过。');
