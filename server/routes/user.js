/* ==========================================
   routes/user.js — 用户模块
   ========================================== */

const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');
const pool = require('../config/db');
const { generateToken, authMiddleware } = require('../config/auth');
const { createRateLimiter } = require('../config/ratelimit');
const { isValidUsername, isValidEmail, isStrongEnoughPassword } = require('../config/validate');
const { avatarUrl, AVATAR_DATA_RE, AVATAR_PATH_RE } = require('../config/avatar');

const router = express.Router();
const ROOT = path.join(__dirname, '..', '..');

/* 注册：同一 IP 每小时最多 10 次（可用 REGISTER_RATE_LIMIT_MAX 调整） */
const registerLimiter = createRateLimiter({
    windowMs: Number(process.env.REGISTER_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000,
    max: Number(process.env.REGISTER_RATE_LIMIT_MAX) || 10,
    message: '注册过于频繁，请稍后再试'
});

/* 登录：同一 IP 10 分钟最多 30 次；同一用户名 10 分钟最多 10 次 */
const loginIpLimiter = createRateLimiter({
    windowMs: Number(process.env.LOGIN_IP_RATE_LIMIT_WINDOW_MS) || 10 * 60 * 1000,
    max: Number(process.env.LOGIN_IP_RATE_LIMIT_MAX) || 30,
    message: '登录尝试过于频繁，请稍后再试'
});

const loginUserLimiter = createRateLimiter({
    windowMs: Number(process.env.LOGIN_USER_RATE_LIMIT_WINDOW_MS) || 10 * 60 * 1000,
    max: Number(process.env.LOGIN_USER_RATE_LIMIT_MAX) || 10,
    message: '该账号尝试次数过多，请稍后再试',
    keyGenerator: (req) => {
        const name = req.body && typeof req.body.username === 'string'
            ? req.body.username.slice(0, 64)
            : '';
        return 'login:' + name.toLowerCase();
    }
});

/* POST /api/register — 注册 */
router.post('/register', registerLimiter, async (req, res) => {
    try {
        const { username, email, password } = req.body || {};

        if (!isValidUsername(username)) {
            return res.status(400).json({
                success: false,
                message: '用户名需为 2-20 位中文、字母、数字、下划线或短横线'
            });
        }
        if (!isStrongEnoughPassword(password)) {
            return res.status(400).json({
                success: false,
                message: '密码需为 6-64 位（且不超过 72 字节）'
            });
        }
        if (email !== undefined && email !== null && email !== '' && !isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                message: '邮箱格式不正确（最多 100 字符）'
            });
        }

        /* 检查用户名唯一性 */
        const [rows] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
        if (rows.length > 0) {
            return res.json({ success: false, message: '用户名已被注册' });
        }

        const hashed = await bcrypt.hash(password, 10);
        /* 预检查只是为了更快的提示，真正防并发冲突的是唯一索引：
           两个请求同时通过预检查时，后插入的那个会撞 ER_DUP_ENTRY */
        let result;
        try {
            const [insertResult] = await pool.query(
                'INSERT INTO users (username, email, password, avatar) VALUES (?, ?, ?, ?)',
                [username, email || '', hashed, 'images/ui/default_avatar.svg']
            );
            result = insertResult;
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
                return res.json({ success: false, message: '用户名已被注册' });
            }
            throw err;
        }
        const user = { id: result.insertId, username };
        const token = generateToken(user);
        res.json({
            success: true,
            data: {
                id: user.id,
                username: user.username,
                avatar: avatarUrl(user.id, 0),
                is_admin: false,
                token
            }
        });
    } catch (err) {
        console.error('register error:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

/* POST /api/login — 登录 */
router.post('/login', loginIpLimiter, loginUserLimiter, async (req, res) => {
    try {
        const { username, password } = req.body || {};

        if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
            return res.status(400).json({ success: false, message: '请输入用户名和密码' });
        }
        /* 超长输入直接拒绝，避免无意义的 bcrypt 计算 */
        if (username.length > 100 || password.length > 200) {
            return res.json({ success: false, message: '用户名或密码错误' });
        }

        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) {
            return res.json({ success: false, message: '用户名或密码错误' });
        }
        const user = rows[0];
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.json({ success: false, message: '用户名或密码错误' });
        }
        const token = generateToken(user);
        res.json({
            success: true,
            data: {
                id: user.id,
                username: user.username,
                avatar: avatarUrl(user.id, user.avatar_version),
                is_admin: !!user.is_admin,
                token
            }
        });
    } catch (err) {
        console.error('login error:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

/* GET /api/user — 获取当前用户信息 */
router.get('/user', authMiddleware, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, username, email, avatar_version, is_admin, created_at FROM users WHERE id = ?',
            [req.user.id]
        );
        if (rows.length === 0) {
            return res.json({ success: false, message: '用户不存在' });
        }
        const user = rows[0];
        res.json({
            success: true,
            data: { ...user, avatar: avatarUrl(user.id, user.avatar_version) }
        });
    } catch (err) {
        console.error('get user error:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

/* GET /api/users/:id/avatar — 头像文件（公开；带版本号，可长期缓存） */
router.get('/users/:id/avatar', async (req, res) => {
    const userId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ success: false, message: '用户 ID 不合法' });
    }

    try {
        const [rows] = await pool.query(
            'SELECT avatar, avatar_version FROM users WHERE id = ?',
            [userId]
        );
        if (rows.length === 0) return res.status(404).end();

        const avatar = rows[0].avatar || '';
        const version = rows[0].avatar_version;

        /* 旧版本地址（例如 localStorage 里缓存的 URL）重定向到当前版本 */
        const requested = Number.parseInt(req.query.v, 10);
        if (Number.isInteger(requested) && requested !== version) {
            res.setHeader('Cache-Control', 'no-store');
            return res.redirect(302, avatarUrl(userId, version));
        }

        const dataMatch = AVATAR_DATA_RE.exec(avatar);
        if (dataMatch) {
            const buffer = Buffer.from(dataMatch[2], 'base64');
            if (buffer.length === 0) return res.status(404).end();
            const subtype = dataMatch[1].toLowerCase() === 'jpg'
                ? 'jpeg'
                : dataMatch[1].toLowerCase();
            res.setHeader('Content-Type', 'image/' + subtype);
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            res.setHeader('ETag', '"' + userId + '-' + version + '"');
            return res.send(buffer);
        }

        if (AVATAR_PATH_RE.test(avatar) && !avatar.includes('..')) {
            return res.sendFile(path.join(ROOT, avatar), {
                maxAge: '365d',
                immutable: true
            }, (err) => {
                if (err && !res.headersSent) res.status(404).end();
            });
        }

        return res.status(404).end();
    } catch (err) {
        console.error('get avatar error:', err);
        if (!res.headersSent) res.status(500).end();
    }
});

/* PUT /api/user/avatar — 修改头像（base64 图片或站内相对路径） */
router.put('/user/avatar', authMiddleware, async (req, res) => {
    try {
        const { avatar } = req.body || {};
        if (!avatar || typeof avatar !== 'string') {
            return res.status(400).json({ success: false, message: '头像数据为空' });
        }
        if (avatar.length > 300000) {
            return res.status(400).json({ success: false, message: '头像过大，请重新选择' });
        }

        /* 只接受图片 data URL 或站内 images/ 路径，避免任意字符串进入 src（XSS） */
        const isDataImage = /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(avatar);
        const isSafePath = /^images\/[\w./-]+\.(?:png|jpe?g|svg|webp)$/i.test(avatar) && !avatar.includes('..');

        if (!isDataImage && !isSafePath) {
            return res.status(400).json({ success: false, message: '头像格式不支持，请上传图片文件' });
        }

        const [result] = await pool.query(
            'UPDATE users SET avatar = ?, avatar_version = avatar_version + 1 WHERE id = ?',
            [avatar, req.user.id]
        );
        if (result.affectedRows === 0) {
            return res.status(401).json({ success: false, message: '用户不存在，请重新登录' });
        }
        const [[row]] = await pool.query(
            'SELECT avatar_version FROM users WHERE id = ?',
            [req.user.id]
        );
        const version = row ? row.avatar_version : 0;
        res.json({ success: true, data: { avatar: avatarUrl(req.user.id, version) } });
    } catch (err) {
        console.error('update avatar error:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

/* PUT /api/user/username — 修改用户名 */
router.put('/user/username', authMiddleware, async (req, res) => {
    try {
        const { username } = req.body || {};

        if (!isValidUsername(username)) {
            return res.status(400).json({
                success: false,
                message: '用户名需为 2-20 位中文、字母、数字、下划线或短横线'
            });
        }

        /* 查重 */
        const [conflict] = await pool.query(
            'SELECT id FROM users WHERE username = ? AND id != ?',
            [username, req.user.id]
        );
        if (conflict.length > 0) {
            return res.json({ success: false, message: '用户名已被占用' });
        }

        try {
            await pool.query('UPDATE users SET username = ? WHERE id = ?', [username, req.user.id]);
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
                return res.json({ success: false, message: '用户名已被占用' });
            }
            throw err;
        }
        res.json({ success: true, data: { username } });
    } catch (err) {
        console.error('update username error:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

/* PUT /api/user/password — 修改密码 */
router.put('/user/password', authMiddleware, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body || {};

        if (typeof oldPassword !== 'string' || typeof newPassword !== 'string') {
            return res.status(400).json({ success: false, message: '密码不能为空' });
        }
        if (oldPassword.length > 200) {
            return res.status(400).json({ success: false, message: '当前密码错误' });
        }
        if (!isStrongEnoughPassword(newPassword)) {
            return res.status(400).json({
                success: false,
                message: '新密码需为 6-64 位（且不超过 72 字节）'
            });
        }

        const [rows] = await pool.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: '用户不存在，请重新登录' });
        }
        const valid = await bcrypt.compare(oldPassword, rows[0].password);
        if (!valid) {
            return res.json({ success: false, message: '当前密码错误' });
        }
        const hashed = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);
        res.json({ success: true, data: { updated: true } });
    } catch (err) {
        console.error('update password error:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

module.exports = router;
