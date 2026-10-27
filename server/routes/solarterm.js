/* ==========================================
   routes/solarterm.js — 节气模块
   ------------------------------------------
   日期与农历由 config/solarterm.js 按年计算，
   数据库只提供名称、图片、描述、养生建议等文案。
   ========================================== */

const express = require('express');
const pool = require('../config/db');
const { termsOfYear, currentTermYear, MIN_YEAR, MAX_YEAR } = require('../config/solarterm');

const router = express.Router();

/* GET /api/solarterms?year=2026 — 某个节气年的 24 个节气 */
router.get('/solarterms', async (req, res) => {
    try {
        let year = currentTermYear();

        if (req.query.year !== undefined) {
            const requested = Number.parseInt(req.query.year, 10);
            if (!Number.isInteger(requested) || requested < MIN_YEAR || requested > MAX_YEAR) {
                return res.status(400).json({
                    success: false,
                    message: `year 需为 ${MIN_YEAR}-${MAX_YEAR} 之间的整数`
                });
            }
            year = requested;
        }

        const dates = termsOfYear(year);
        const [rows] = await pool.query(
            'SELECT name, pinyin, image, description, health_tip AS healthTip FROM solar_terms'
        );
        const byName = new Map(rows.map(row => [row.name, row]));

        const data = dates.map(term => {
            const content = byName.get(term.name) || {};
            return {
                name: term.name,
                pinyin: content.pinyin || '',
                date: term.date,
                lunarDate: term.lunarDate,
                image: content.image || '',
                description: content.description || '',
                healthTip: content.healthTip || ''
            };
        });

        res.json({ success: true, year, data });
    } catch (err) {
        console.error('get solarterms error:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

module.exports = router;
