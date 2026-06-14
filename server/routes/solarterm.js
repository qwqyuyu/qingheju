/* ==========================================
   routes/solarterm.js — 节气模块
   ========================================== */

const express = require('express');
const pool = require('../config/db');

const router = express.Router();

/* GET /api/solarterms — 全部节气 */
router.get('/solarterms', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT name, pinyin, term_date AS date, lunar_date AS lunarDate, image, description, health_tip AS healthTip FROM solar_terms ORDER BY term_date'
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('get solarterms error:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

module.exports = router;
