/* ==========================================
   冒烟测试：node test/smoke.mjs（在 server 目录下）
   ------------------------------------------
   会自动启动一个临时服务（默认 3199 端口），跑完注册/登录/发帖/
   点赞/评论/签到/分页 等主流程，然后删除测试账号并关闭服务。
   前提：本地 MariaDB/MySQL 已启动，server/.env 可连接。
   ========================================== */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
require('../config/env.js')();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(__dirname, '..');
const PORT = Number(process.env.SMOKE_PORT || 3199);
const base = `http://127.0.0.1:${PORT}`;
const username = 'smoke_' + Date.now().toString(36);
const password = 'smoke1234';

let child = null;
let token = '';
let postId = 0;

function ok(name) { console.log('  ✓ ' + name); }

async function api(method, urlPath, body, useToken = true) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (useToken && token) headers.Authorization = 'Bearer ' + token;

    const res = await fetch(base + urlPath, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
    });

    let json = null;
    try { json = await res.json(); } catch (e) { /* 非 JSON 响应 */ }
    return { status: res.status, body: json };
}

async function waitReady(timeoutMs = 20000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (child && child.exitCode !== null) {
            throw new Error('服务提前退出（请检查数据库是否可连接、端口是否被占用）');
        }
        try {
            const res = await fetch(base + '/api/solarterms');
            if (res.ok) return;
        } catch (e) { /* 还没起来 */ }
        await new Promise(r => setTimeout(r, 300));
    }
    throw new Error('服务启动超时（请检查数据库是否可连接、端口是否被占用）');
}

async function cleanupUser() {
    const mysql = require('mysql2/promise');
    const conn = await mysql.createConnection({
        host: process.env.MYSQLHOST || process.env.MYSQL_HOST || 'localhost',
        port: Number(process.env.MYSQLPORT || process.env.MYSQL_PORT || 3306),
        user: process.env.MYSQLUSER || process.env.MYSQL_USER || 'root',
        password: process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'qingheju'
    });
    await conn.query('DELETE FROM users WHERE username = ?', [username]);
    await conn.end();
}

async function stopServer() {
    if (!child || child.exitCode !== null) return;
    await new Promise(resolve => {
        const timer = setTimeout(resolve, 3000);
        child.once('exit', () => { clearTimeout(timer); resolve(); });
        child.kill();
    });
}

async function main() {
    console.log('启动测试服务 http://127.0.0.1:' + PORT + ' …');
    child = spawn(process.execPath, ['app.js'], {
        cwd: serverDir,
        env: { ...process.env, PORT: String(PORT), LOGIN_IP_RATE_LIMIT_MAX: '5', CORS_ORIGINS: 'https://allowed.example' },
        stdio: 'inherit'
    });

    await waitReady();
    console.log('服务已就绪，开始测试：');

    /* 1. 基础接口 */
    let r = await api('GET', '/api/solarterms', undefined, false);
    assert.equal(r.status, 200);
    assert.equal(r.body.success, true);
    assert.equal(r.body.data.length, 24);
    ok('节气接口返回 24 条');

    /* 2. 注册 */
    r = await api('POST', '/api/register', { username, email: username + '@test.com', password }, false);
    assert.equal(r.body.success, true, JSON.stringify(r.body));
    token = r.body.data.token;
    assert.ok(token);
    const userId = r.body.data.id;
    assert.equal(r.body.data.avatar, `/api/users/${userId}/avatar?v=0`);
    ok('注册并拿到 token');

    /* 3. 重复注册 */
    r = await api('POST', '/api/register', { username, email: 'x@test.com', password }, false);
    assert.equal(r.body.success, false);
    assert.match(r.body.message, /已被注册/);
    ok('重复注册被拒绝');

    /* 4. 登录 */
    r = await api('POST', '/api/login', { username, password }, false);
    assert.equal(r.body.success, true);
    assert.ok(r.body.data.token);
    assert.equal(r.body.data.avatar, `/api/users/${userId}/avatar?v=0`);
    ok('登录成功');

    /* 5. 发帖 */
    r = await api('POST', '/api/posts', { title: '冒烟测试帖', content: 'automated smoke test', image: '' });
    assert.equal(r.body.success, true, JSON.stringify(r.body));
    postId = r.body.data.id;
    assert.ok(postId);
    ok('发帖成功（id=' + postId + '）');

    /* 6. 点赞 / 取消 */
    r = await api('POST', `/api/posts/${postId}/like`, {});
    assert.equal(r.body.data.liked, true);
    assert.equal(r.body.data.likes, 1);
    r = await api('POST', `/api/posts/${postId}/like`, {});
    assert.equal(r.body.data.liked, false);
    assert.equal(r.body.data.likes, 0);
    ok('点赞 / 取消计数正确');

    /* 7. 评论 */
    r = await api('POST', `/api/posts/${postId}/comments`, { content: '冒烟测试评论' });
    assert.equal(r.body.success, true, JSON.stringify(r.body));
    assert.equal(r.body.data.username, username);
    r = await api('GET', `/api/posts/${postId}/comments`, undefined, false);
    assert.equal(r.body.data.length, 1);
    assert.equal(r.body.data[0].content, '冒烟测试评论');
    ok('评论写入与读取一致');

    /* 8. 签到 */
    r = await api('POST', '/api/checkin', {});
    assert.equal(r.body.success, true, JSON.stringify(r.body));
    assert.match(r.body.data.date, /^\d{4}-\d{2}-\d{2}$/);
    r = await api('POST', '/api/checkin', {});
    assert.equal(r.body.success, false);
    assert.match(r.body.message, /已签到/);
    ok('签到与重复签到判断正确');

    /* 9. 分页 */
    r = await api('GET', '/api/posts?page=1&pageSize=5', undefined, false);
    assert.equal(r.body.data.page, 1);
    assert.equal(r.body.data.pageSize, 5);
    assert.ok(Array.isArray(r.body.data.items));
    assert.ok(r.body.data.items.length <= 5);
    assert.ok(r.body.data.total >= 1);
    assert.equal(typeof r.body.data.items[0].featured, 'boolean');
    assert.match(r.body.data.items[0].avatar, /^\/api\/users\/\d+\/avatar\?v=\d+$/);
    assert.ok(r.body.data.items.every(p => !/^data:image\//.test(p.avatar)));
    ok('分页结构正确（total=' + r.body.data.total + '）');

    /* 10. 帖子图片：列表返回缩略图，详情返回原图 */
    const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const thumbPng = 'data:image/png;base64,AAAA';
    r = await api('POST', '/api/posts', {
        title: '带图帖子', content: 'image test', image: tinyPng, imageThumb: thumbPng
    });
    assert.equal(r.body.success, true, JSON.stringify(r.body));
    const imagePostId = r.body.data.id;
    assert.equal(r.body.data.image, thumbPng);
    assert.equal(r.body.data.hasImage, true);

    r = await api('GET', '/api/posts/' + imagePostId, undefined, false);
    assert.equal(r.body.data.image, tinyPng);

    r = await api('GET', '/api/posts?page=1&pageSize=50', undefined, false);
    const imagePost = r.body.data.items.find(p => p.id === imagePostId);
    assert.ok(imagePost, '带图帖子应在列表里');
    assert.equal(imagePost.image, thumbPng);
    assert.equal(imagePost.hasImage, true);

    r = await api('POST', '/api/posts', { title: 'bad', content: 'bad', image: 'x" onerror="alert(1)' });
    assert.equal(r.status, 400);
    ok('帖子图片：列表缩略图、详情原图、非法值 400');

    /* 10.5 头像独立 URL / 缓存 / 版本重定向 */
    let avatarRes = await fetch(base + `/api/users/${userId}/avatar?v=0`);
    assert.equal(avatarRes.status, 200);
    assert.match(avatarRes.headers.get('content-type'), /^image\/svg\+xml/);
    assert.match(avatarRes.headers.get('cache-control'), /immutable/);

    r = await api('PUT', '/api/user/avatar', { avatar: tinyPng });
    assert.equal(r.body.success, true, JSON.stringify(r.body));
    const newAvatarUrl = r.body.data.avatar;
    assert.equal(newAvatarUrl, `/api/users/${userId}/avatar?v=1`);

    avatarRes = await fetch(base + newAvatarUrl);
    assert.equal(avatarRes.status, 200);
    assert.match(avatarRes.headers.get('content-type'), /^image\/png/);
    assert.match(avatarRes.headers.get('cache-control'), /immutable/);

    const staleAvatar = await fetch(base + `/api/users/${userId}/avatar?v=0`, { redirect: 'manual' });
    assert.equal(staleAvatar.status, 302);
    assert.match(staleAvatar.headers.get('location'), /\/avatar\?v=1$/);
    ok('头像走独立 URL，带缓存与版本重定向');

    /* 11. 精选权限 */
    r = await api('PUT', `/api/posts/${postId}/feature`, { featured: true });
    assert.equal(r.status, 403);
    ok('非管理员不能设置精选');

    /* 12. 非法点赞 */
    r = await api('POST', '/api/posts/abc/like', {});
    assert.equal(r.status, 400);
    r = await api('POST', '/api/posts/999999/like', {});
    assert.equal(r.status, 404);
    ok('非法帖子 ID 返回 400 / 404');

    /* 11. 未知接口返回 JSON 404 */
    r = await api('GET', '/api/does-not-exist', undefined, false);
    assert.equal(r.status, 404);
    assert.equal(r.body.message, '接口不存在');
    ok('未知接口返回 JSON 404');

    /* 12. 请求体格式错误返回 JSON 400 */
    const bad = await fetch(base + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{bad json'
    });
    assert.equal(bad.status, 400);
    const badJson = await bad.json();
    assert.equal(badJson.message, '请求格式错误');
    ok('非法 JSON 返回 JSON 400');

    /* 13. 输入校验：非法数据返回 4xx 而不是 500 */
    r = await api('POST', '/api/register', { username: 'bad"name', password: 'smoke1234' }, false);
    assert.equal(r.status, 400);
    r = await api('POST', '/api/register', {
        username: 'okname_' + Date.now().toString(36),
        password: '123'
    }, false);
    assert.equal(r.status, 400);
    r = await api('POST', '/api/posts', { title: '长'.repeat(101), content: 'x' });
    assert.equal(r.status, 400);
    r = await api('POST', `/api/posts/${postId}/comments`, { content: '评'.repeat(501) });
    assert.equal(r.status, 400);
    r = await api('POST', '/api/posts/999999/comments', { content: '评论' });
    assert.equal(r.status, 404);
    r = await api('GET', '/api/posts/abc/comments', undefined, false);
    assert.equal(r.status, 400);
    r = await api('PUT', '/api/user/username', { username: 'a'.repeat(21) });
    assert.equal(r.status, 400);
    r = await api('PUT', '/api/user/password', { oldPassword: password, newPassword: '123' });
    assert.equal(r.status, 400);
    ok('非法用户名/密码/标题/评论/ID 均返回 4xx');

    const noBodyLogin = await fetch(base + '/api/login', { method: 'POST' });
    assert.equal(noBodyLogin.status, 400);
    ok('无请求体登录返回 400 而不是 500');

    /* 14. 安全响应头与 CORS */
    const homePage = await fetch(base + '/home.html');
    assert.ok(homePage.headers.get('content-security-policy'), '应有 CSP');
    assert.equal(homePage.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(homePage.headers.get('x-frame-options'), 'DENY');
    assert.equal(homePage.headers.get('x-powered-by'), null);
    ok('安全响应头已生效');

    const crossOrigin = await fetch(base + '/api/solarterms', {
        headers: { Origin: 'https://evil.example' }
    });
    assert.equal(crossOrigin.headers.get('access-control-allow-origin'), null);

    const allowedOrigin = await fetch(base + '/api/solarterms', {
        headers: { Origin: 'https://allowed.example' }
    });
    assert.equal(allowedOrigin.headers.get('access-control-allow-origin'), 'https://allowed.example');
    ok('CORS 只放行显式配置的来源');

    /* 15. 静态资源白名单：源码/配置/导出不可下载，前端资源正常 */
    for (const p of ['/server/config/auth.js', '/server/.env', '/server/qingheju_dump.sql', '/package.json', '/README.md']) {
        r = await api('GET', p, undefined, false);
        assert.equal(r.status, 404, p + ' 应不可访问');
    }
    ok('server/、.env、dump、package.json、README 均不可通过 HTTP 访问');

    for (const p of ['/home.html', '/css/common.css', '/js/api.js', '/images/ui/default_avatar.svg']) {
        const res = await fetch(base + p);
        assert.equal(res.status, 200, p + ' 应可访问');
    }
    assert.equal((await fetch(base + '/')).status, 200);
    ok('HTML/CSS/JS/图片/首页正常访问');

    /* 16. AI 接口需要登录（不触发真实 AI 调用） */
    r = await api('POST', '/api/ai/chat', { messages: [{ role: 'user', content: '你好' }] }, false);
    assert.equal(r.status, 401);
    assert.equal(r.body.success, false);
    ok('未登录调用 AI 返回 401');

    /* 17. 用错误密钥签发的 token 被拒绝 */
    const jwt = require('jsonwebtoken');
    const forged = jwt.sign({ id: 1 }, 'wrong-secret-for-test', { expiresIn: '1h' });
    const forgedRes = await fetch(base + '/api/user', {
        headers: { Authorization: 'Bearer ' + forged }
    });
    assert.equal(forgedRes.status, 401);
    ok('错误密钥签发的 token 被拒绝');

    /* 18. 登录失败限流（smoke 里把 IP 上限设为 5，前面已用掉 2 次） */
    for (let i = 0; i < 3; i++) {
        r = await api('POST', '/api/login', { username: 'no_such_user', password: 'wrongpass' }, false);
        assert.equal(r.status, 200);
    }
    r = await api('POST', '/api/login', { username: 'no_such_user', password: 'wrongpass' }, false);
    assert.equal(r.status, 429);
    assert.match(r.body.message, /频繁/);
    ok('登录失败次数过多触发 429');

    console.log('\n全部通过。');
}

try {
    await main();
} catch (err) {
    console.error('\n测试失败：', err && err.message ? err.message : err);
    process.exitCode = 1;
} finally {
    try { await cleanupUser(); } catch (e) { console.error('清理测试账号失败：', e.message); }
    await stopServer();
}
