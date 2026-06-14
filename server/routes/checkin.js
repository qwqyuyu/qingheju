/* ==========================================
   routes/checkin.js — 签到模块
   ========================================== */

const express = require('express');
const pool = require('../config/db');
const { authMiddleware } = require('../config/auth');

const router = express.Router();

/* POST /api/checkin — 签到 */
router.post('/checkin', authMiddleware, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        /* 今天是否已签到 */
        const [exists] = await pool.query(
            'SELECT id FROM checkins WHERE user_id = ? AND checkin_date = ?',
            [req.user.id, today]
        );
        if (exists.length > 0) {
            return res.json({ success: false, message: '今日已签到' });
        }
        /* 计算连续天数 */
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const ymd = yesterday.toISOString().split('T')[0];
        const [prev] = await pool.query(
            'SELECT streak FROM checkins WHERE user_id = ? AND checkin_date = ?',
            [req.user.id, ymd]
        );
        const streak = (prev.length > 0 ? prev[0].streak : 0) + 1;
        await pool.query(
            'INSERT INTO checkins (user_id, checkin_date, streak) VALUES (?, ?, ?)',
            [req.user.id, today, streak]
        );
        /* 累计天数 */
        const [total] = await pool.query(
            'SELECT COUNT(*) AS cnt FROM checkins WHERE user_id = ?',
            [req.user.id]
        );
        res.json({
            success: true,
            data: { streak, total: total[0].cnt, date: today }
        });
    } catch (err) {
        console.error('checkin error:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

/* GET /api/checkin — 签到记录 */
router.get('/checkin', authMiddleware, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT checkin_date, streak FROM checkins WHERE user_id = ? ORDER BY checkin_date DESC',
            [req.user.id]
        );
        const signDates = rows.map(r => r.checkin_date);
        const streak = rows.length > 0 ? rows[0].streak : 0;
        res.json({
            success: true,
            data: { signDates, streak, total: rows.length }
        });
    } catch (err) {
        console.error('get checkin error:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

module.exports = router;
