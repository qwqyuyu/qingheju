/* ==========================================
   路由行为测试（不连真实数据库、不访问真实 AI）
   运行：node test/routes.test.mjs

   做法：加载真实的 app.js，把 config/db 换成假连接池，
   AI 上游换成本机的假服务。覆盖：
     1. 请求体上限（默认小上限；发帖先鉴权再放大）
     2. 发帖 / 评论 / 点赞限流（按用户隔离）
     3. 管理员可删他人帖子、评论；普通用户不行
     4. GET /api/checkin 断签后连续天数归零
     5. AI 错误不泄露上游信息；客户端断开会取消上游请求
   ========================================== */

import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/* ---------- 假 AI 上游（先起，才能知道端口） ---------- */

let upstreamMode = 'error';
let upstreamClosed = null;           /* hang 模式下，上游连接被关闭时 resolve */
const upstream = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => {
        if (upstreamMode === 'error') {
            res.writeHead(400, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: { message: 'LEAK internal-gateway.example key=sk-secret' } }));
            return;
        }
        /* hang：先给一个片段，然后一直挂着，等服务端取消 */
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.write('data: ' + JSON.stringify({
            id: '1', object: 'chat.completion.chunk', model: 'm',
            choices: [{ index: 0, delta: { content: '你好' } }]
        }) + '\n\n');
        res.on('close', () => {
            if (!res.writableEnded && upstreamClosed) upstreamClosed.resolve();
        });
    });
});
await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));

/* ---------- 环境变量（必须在 require 项目模块之前；已设置的不会被 .env 覆盖） ---------- */

Object.assign(process.env, {
    JWT_SECRET: 'test-secret-'.padEnd(48, 'x'),
    APP_TIMEZONE: 'Asia/Shanghai',
    JSON_BODY_LIMIT: '50kb',
    POST_BODY_LIMIT: '300kb',
    POST_RATE_LIMIT_MAX: '2',
    COMMENT_RATE_LIMIT_MAX: '2',
    LIKE_RATE_LIMIT_MAX: '2',
    AI_BASE_URL: `http://127.0.0.1:${upstream.address().port}/v1`,
    AI_FORMAT: 'chat',
    AI_API_KEY: 'test-key',
    AI_MODEL: 'test-model',
    AI_STREAM: 'true',
    AI_TEMPERATURE: 'default',
    AI_MAX_TOKENS: '100',
    AI_RATE_LIMIT_MAX: '1000'
});

/* ---------- 假数据库 ---------- */

const rules = [];
const queries = [];
const norm = (sql) => String(sql).replace(/\s+/g, ' ').trim();
function when(re, fn) { rules.push([re, fn]); }
function resetDb() { rules.length = 0; queries.length = 0; }

async function fakeQuery(sql, params) {
    const s = norm(sql);
    queries.push(s);
    for (const [re, fn] of rules) {
        if (re.test(s)) return fn(params || [], s);
    }
    throw new Error('测试里没有为这条 SQL 准备假数据: ' + s);
}
const fakePool = {
    query: fakeQuery,
    async getConnection() {
        return {
            query: fakeQuery,
            async beginTransaction() {},
            async commit() {},
            async rollback() {},
            release() {}
        };
    }
};
const dbPath = require.resolve('../config/db.js');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakePool, children: [], paths: [] };

/* ---------- 加载真实应用 ---------- */

const app = require('../app.js');
const { generateToken } = require('../config/auth.js');
const { activeStreak } = require('../config/streak.js');
const { today, addDays } = require('../config/time.js');

const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const tokenOf = (id) => generateToken({ id });

async function call(method, path, { token, body } = {}) {
    const headers = {};
    if (token) headers.authorization = 'Bearer ' + token;
    let payload;
    if (body !== undefined) {
        headers['content-type'] = 'application/json';
        payload = typeof body === 'string' ? body : JSON.stringify(body);
    }
    const res = await fetch(base + path, { method, headers, body: payload });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) { /* 非 JSON（如 SSE） */ }
    return { status: res.status, json, text, headers: res.headers };
}

const ok = (name) => console.log('  ✓ ' + name);
const pad = (n) => 'A'.repeat(n);

/* ========== 1. 请求体上限 ========== */

{
    const r = await call('POST', '/api/login', { body: { username: 'u', password: pad(60000) } });
    assert.equal(r.status, 413, '普通接口超过默认上限应返回 413');
    assert.equal(r.json.message, '请求体过大');
    ok('普通接口：超过默认上限（50kb）返回 413');
}

{
    /* 400KB 超过发帖上限(300kb)：如果先解析请求体会得到 413；先鉴权则是 401 */
    const r = await call('POST', '/api/posts', { body: { title: 't', content: 'c', image: pad(400000) } });
    assert.equal(r.status, 401, '未登录的大请求应在鉴权处被拒绝，而不是被读取');
    ok('发帖：未登录的大请求先被 401 拒绝，不会被读进内存');
}

{
    resetDb();
    when(/^SELECT id FROM users WHERE id = \?/, ([id]) => [[{ id }]]);
    when(/^INSERT INTO posts/, () => [{ insertId: 5 }]);
    when(/FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = \?/, () => [[
        { id: 5, title: 't', content: 'c', image: '', hasImage: 0, likes: 0, time: '2026-01-01 00:00', user_id: 1, username: 'u1', avatar_version: 0 }
    ]]);

    const image = 'data:image/png;base64,' + pad(100000);   /* ~100KB：超过默认 50kb，不超过发帖 300kb */
    const r = await call('POST', '/api/posts', { token: tokenOf(1), body: { title: 't', content: 'c', image } });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.success, true);
    ok('发帖：登录后可使用更大的上限（100KB 图片通过）');

    const big = 'data:image/png;base64,' + pad(400000);
    const r2 = await call('POST', '/api/posts', { token: tokenOf(2), body: { title: 't', content: 'c', image: big } });
    assert.equal(r2.status, 413, '超过发帖上限也要 413');
    ok('发帖：超过发帖上限（300kb）返回 413');
}

/* ========== 2. 写操作限流 ========== */

{
    resetDb();
    when(/^SELECT id FROM users WHERE id = \?/, ([id]) => [[{ id }]]);
    when(/^INSERT INTO posts/, () => [{ insertId: 6 }]);
    when(/FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = \?/, () => [[
        { id: 6, title: 't', content: 'c', image: '', hasImage: 0, likes: 0, time: '2026-01-01 00:00', user_id: 11, username: 'u11', avatar_version: 0 }
    ]]);

    const send = (id) => call('POST', '/api/posts', { token: tokenOf(id), body: { title: 't', content: 'c' } });
    assert.equal((await send(11)).status, 200);
    assert.equal((await send(11)).status, 200);
    const limited = await send(11);
    assert.equal(limited.status, 429, '第 3 次发帖应被限流');
    assert.equal(limited.json.message, '发帖过于频繁，请稍后再试');
    assert.ok(Number(limited.headers.get('retry-after')) > 0);
    assert.equal((await send(13)).status, 200, '另一个用户不受影响');
    ok('发帖限流：同一用户第 3 次返回 429，其他用户不受影响');
}

{
    resetDb();
    when(/^SELECT id FROM posts WHERE id = \?/, () => [[{ id: 1 }]]);
    when(/^SELECT username FROM users WHERE id = \?/, () => [[{ username: 'u12' }]]);
    when(/^INSERT INTO comments/, () => [{ insertId: 9 }]);

    const send = () => call('POST', '/api/posts/1/comments', { token: tokenOf(12), body: { content: 'hi' } });
    assert.equal((await send()).status, 200);
    assert.equal((await send()).status, 200);
    const limited = await send();
    assert.equal(limited.status, 429);
    assert.equal(limited.json.message, '评论过于频繁，请稍后再试');
    ok('评论限流：第 3 次返回 429');
}

{
    resetDb();
    when(/^SELECT likes_count FROM posts WHERE id = \? FOR UPDATE$/, () => [[{ likes_count: 0 }]]);
    when(/^SELECT id FROM likes WHERE user_id = \? AND post_id = \?/, () => [[]]);
    when(/^INSERT INTO likes/, () => [{ insertId: 1 }]);
    when(/^UPDATE posts SET likes_count = likes_count \+ 1/, () => [{}]);
    when(/^SELECT likes_count FROM posts WHERE id = \?$/, () => [[{ likes_count: 1 }]]);

    const send = () => call('POST', '/api/posts/1/like', { token: tokenOf(14) });
    assert.equal((await send()).status, 200);
    assert.equal((await send()).status, 200);
    const limited = await send();
    assert.equal(limited.status, 429);
    assert.equal(limited.json.code, 429);
    ok('点赞限流：第 3 次返回 429（带 code=429，前端据此提示）');
}

/* ========== 3. 管理员删除他人帖子 / 评论 ========== */

const ADMIN = 1, STRANGER = 2, AUTHOR = 100;
function setupDelete() {
    resetDb();
    when(/^SELECT user_id FROM posts WHERE id = \?/, () => [[{ user_id: AUTHOR }]]);
    when(/^SELECT user_id FROM comments WHERE id = \?/, () => [[{ user_id: AUTHOR }]]);
    when(/^SELECT is_admin FROM users WHERE id = \?/, ([id]) => [[{ is_admin: id === ADMIN ? 1 : 0 }]]);
    when(/^DELETE FROM (posts|comments) WHERE id = \?/, () => [{ affectedRows: 1 }]);
}
const deleted = () => queries.some(q => q.startsWith('DELETE FROM'));

for (const [kind, path, denied] of [
    ['帖子', '/api/posts/7', '无权删除他人帖子'],
    ['评论', '/api/comments/7', '无权删除他人评论']
]) {
    setupDelete();
    let r = await call('DELETE', path, { token: tokenOf(STRANGER) });
    assert.equal(r.json.success, false);
    assert.equal(r.json.message, denied);
    assert.equal(deleted(), false, '普通用户不能删他人' + kind);

    setupDelete();
    r = await call('DELETE', path, { token: tokenOf(ADMIN) });
    assert.equal(r.json.success, true, JSON.stringify(r.json));
    assert.equal(deleted(), true, '管理员应能删他人' + kind);

    setupDelete();
    r = await call('DELETE', path, { token: tokenOf(AUTHOR) });
    assert.equal(r.json.success, true, '作者本人仍可删除自己的' + kind);
    ok(`删除${kind}：普通用户被拒，管理员和作者本人可以`);
}

/* ========== 4. 连续签到天数 ========== */

{
    const t = '2026-10-27';
    assert.equal(activeStreak('2026-10-27', 5, t), 5, '今天签到');
    assert.equal(activeStreak('2026-10-26', 5, t), 5, '昨天签到，仍连续');
    assert.equal(activeStreak('2026-10-25', 5, t), 0, '前天签到，已断签');
    assert.equal(activeStreak('2026-09-01', 30, t), 0, '很久以前');
    assert.equal(activeStreak('2026-10-26 00:00:00', 3, t), 3, '兼容带时间的日期字符串');
    assert.equal(activeStreak(null, 5, t), 0);
    assert.equal(activeStreak('2026-10-27', 0, t), 0);
    assert.equal(activeStreak('2026-12-31', 4, '2027-01-01'), 4, '跨年');
    ok('activeStreak：今天/昨天有效，更早归零，跨年正确');

    const todayStr = today();
    for (const [label, date, expected] of [
        ['今天', todayStr, 5],
        ['昨天', addDays(todayStr, -1), 5],
        ['一周前', addDays(todayStr, -7), 0]
    ]) {
        resetDb();
        when(/^SELECT checkin_date, streak FROM checkins/, () => [[{ checkin_date: date, streak: 5 }]]);
        const r = await call('GET', '/api/checkin', { token: tokenOf(20) });
        assert.equal(r.json.data.streak, expected, `最近签到在${label}：连续天数应为 ${expected}`);
        assert.equal(r.json.data.total, 1);
    }
    ok('GET /api/checkin：断签后 streak 返回 0，今天/昨天保持原值');
}

/* ========== 5. AI：错误脱敏、断开即取消 ========== */

const PUBLIC_ERROR = 'AI 服务暂时不可用，请稍后重试';
const aiBody = { messages: [{ role: 'user', content: '你好' }] };

{
    upstreamMode = 'error';
    const r = await call('POST', '/api/ai/chat', { token: tokenOf(30), body: aiBody });
    assert.equal(r.status, 200);
    assert.ok(r.text.includes(PUBLIC_ERROR), '应返回统一错误文案：' + r.text);
    assert.ok(!r.text.includes('LEAK'), '不能把上游错误原文发给浏览器');
    assert.ok(!r.text.includes('internal-gateway'), '不能泄露上游地址');
    assert.ok(!r.text.includes('sk-secret'), '不能泄露上游密钥');
    ok('AI 流式出错：只返回统一文案，不泄露上游信息');
}

{
    upstreamMode = 'hang';
    let resolve;
    const closed = new Promise(r => { resolve = r; });
    upstreamClosed = { resolve };

    const controller = new AbortController();
    const res = await fetch(base + '/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tokenOf(31) },
        body: JSON.stringify(aiBody),
        signal: controller.signal
    });
    assert.equal(res.status, 200);

    /* 读到第一个片段，说明服务端已经连上上游并开始转发 */
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let seen = '';
    while (!seen.includes('你好')) {
        const { done, value } = await reader.read();
        assert.ok(!done, '流提前结束');
        seen += decoder.decode(value, { stream: true });
    }

    controller.abort();                       /* 模拟用户关掉页面 */
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('3 秒内上游连接没有被关闭')), 3000));
    await Promise.race([closed, timeout]);
    ok('AI 流式：客户端断开后，服务端取消了上游请求');
}

/* ---------- 收尾 ---------- */

console.log('\n路由行为测试全部通过。');
server.close();
upstream.close();
process.exit(0);
