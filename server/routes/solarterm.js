/* ==========================================
   routes/solarterm.js — 节气模块
   ------------------------------------------
   日期与农历由 config/solarterm.js 按年计算，
   数据库只提供名称、图片、描述、养生建议等文案。
   ========================================== */

const express = require('express');
const pool = require('../config/db');
const { termsOfYear, currentTermYear, MIN_YEAR, MAX_YEAR } = require('../config/solarterm');
const { today } = require('../config/time');

const router = express.Router();

/* 数据库里存的是 images/solarterms/xxx.jpg 这类不带前导斜杠的相对路径。
   页面位于 /pages/ 下，相对路径会被浏览器解析成 /pages/images/... 而 404，
   因此统一转成站内绝对路径；外链 / data: 等原样返回。 */
function resolveImagePath(value) {
    const src = String(value || '').trim();
    if (!src) return '';
    if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(src) || /^(?:data|blob):/i.test(src)) return src;
    return src.startsWith('/') ? src : '/' + src;
}

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
                image: resolveImagePath(content.image),
                description: content.description || '',
                healthTip: content.healthTip || ''
            };
        });

        /* today 是服务端的“今天”（APP_TIMEZONE）。
           前端用它判断“当前节气 / 今日推荐”，避免跨时区时用浏览器时钟偏差一天。 */
        res.json({ success: true, year, today: today(), data });
    } catch (err) {
        console.error('get solarterms error:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

module.exports = router;
