/* ==========================================
   routes/user.js — 用户模块
   ========================================== */

const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { generateToken, authMiddleware } = require('../config/auth');

const router = express.Router();

/* POST /api/register — 注册 */
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !password) {
            return res.json({ success: false, message: '用户名和密码不能为空' });
        }
        if (username.length < 2 || username.length > 20) {
            return res.json({ success: false, message: '用户名长度为2-20个字符' });
        }
        if (password.length < 6) {
            return res.json({ success: false, message: '密码至少6位' });
        }
        /* 检查用户名唯一性 */
        const [rows] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
        if (rows.length > 0) {
            return res.json({ success: false, message: '用户名已被注册' });
        }
        const hashed = await bcrypt.hash(password, 10);
        const [result] = await pool.query(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email || '', hashed]
        );
        const user = { id: result.insertId, username };
        const token = generateToken(user);
        res.json({ success: true, data: { id: user.id, username: user.username, token } });
    } catch (err) {
        console.error('register error:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

/* POST /api/login — 登录 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.json({ success: false, message: '请输入用户名和密码' });
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
            data: { id: user.id, username: user.username, avatar: user.avatar, token }
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
            'SELECT id, username, email, avatar, created_at FROM users WHERE id = ?',
            [req.user.id]
        );
        if (rows.length === 0) {
            return res.json({ success: false, message: '用户不存在' });
        }
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('get user error:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

/* PUT /api/user/avatar — 修改头像 */
router.put('/user/avatar', authMiddleware, async (req, res) => {
    try {
        const { avatar } = req.body;
        if (!avatar) return res.json({ success: false, message: '头像数据为空' });
        await pool.query('UPDATE users SET avatar = ? WHERE id = ?', [avatar, req.user.id]);
        res.json({ success: true, data: { avatar } });
    } catch (err) {
        console.error('update avatar error:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

/* PUT /api/user/username — 修改用户名 */
router.put('/user/username', authMiddleware, async (req, res) => {
    try {
        const { username } = req.body;
        if (!username || username.length < 2) {
            return res.json({ success: false, message: '用户名至少2个字符' });
        }
        /* 查重 */
        const [conflict] = await pool.query(
            'SELECT id FROM users WHERE username = ? AND id != ?',
            [username, req.user.id]
        );
        if (conflict.length > 0) {
            return res.json({ success: false, message: '用户名已被占用' });
        }
        await pool.query('UPDATE users SET username = ? WHERE id = ?', [username, req.user.id]);
        res.json({ success: true, data: { username } });
    } catch (err) {
        console.error('update username error:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

/* PUT /api/user/password — 修改密码 */
router.put('/user/password', authMiddleware, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        if (!oldPassword || !newPassword) {
            return res.json({ success: false, message: '密码不能为空' });
        }
        if (newPassword.length < 6) {
            return res.json({ success: false, message: '新密码至少6位' });
        }
        const [rows] = await pool.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
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
