/* ==========================================
   routes/checkin.js — 签到模块
   ========================================== */

const express = require('express');
const pool = require('../config/db');
const { today, addDays } = require('../config/time');
const { authMiddleware } = require('../config/auth');
const { activeStreak } = require('../config/streak');

const router = express.Router();

/* POST /api/checkin — 签到 */
router.post('/checkin', authMiddleware, async (req, res) => {
    try {
        const todayStr = today();
        /* 今天是否已签到 */
        const [exists] = await pool.query(
            'SELECT id FROM checkins WHERE user_id = ? AND checkin_date = ?',
            [req.user.id, todayStr]
        );
        if (exists.length > 0) {
            return res.status(409).json({ success: false, message: '今日已签到' });
        }
        /* 计算连续天数 */
        const ymd = addDays(todayStr, -1);
        const [prev] = await pool.query(
            'SELECT streak FROM checkins WHERE user_id = ? AND checkin_date = ?',
            [req.user.id, ymd]
        );
        const streak = (prev.length > 0 ? prev[0].streak : 0) + 1;
        try {
            await pool.query(
                'INSERT INTO checkins (user_id, checkin_date, streak) VALUES (?, ?, ?)',
                [req.user.id, todayStr, streak]
            );
        } catch (err) {
            /* 并发请求同时通过“今日已签到”检查时，唯一索引会兜底 */
            if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
                return res.status(409).json({ success: false, message: '今日已签到' });
            }
            throw err;
        }
        /* 累计天数 */
        const [total] = await pool.query(
            'SELECT COUNT(*) AS cnt FROM checkins WHERE user_id = ?',
            [req.user.id]
        );
        res.json({
            success: true,
            data: { streak, total: total[0].cnt, date: todayStr }
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
        /* 记录里的 streak 是“签到当天”的值；断签后必须归零，否则会一直显示旧的连续天数 */
        const streak = rows.length > 0
            ? activeStreak(rows[0].checkin_date, rows[0].streak, today())
            : 0;
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
