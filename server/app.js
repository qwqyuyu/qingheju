/* ==========================================
   app.js — 清和居后端服务入口
   ========================================== */

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

/* 中间件 */
app.use(cors());
app.use(express.json({ limit: '50mb' }));

/* 静态文件托管（前端页面） */
app.use(express.static(path.join(__dirname, '..')));

/* 路由模块 */
app.use('/api', require('./routes/user'));
app.use('/api', require('./routes/post'));
app.use('/api', require('./routes/checkin'));
app.use('/api', require('./routes/solarterm'));
app.use('/api', require('./routes/ai'));

/* 启动后自动修复数据库列类型（支持图片上传） */
const pool = require('./config/db');
(async () => {
    try {
        await pool.query("ALTER TABLE posts MODIFY image MEDIUMTEXT NOT NULL");
        console.log('数据库列类型已修复: posts.image → MEDIUMTEXT');
    } catch (e) {
        // 已经是 MEDIUMTEXT 则忽略
        if (e.code !== 'ER_UNKNOWN_ERROR') console.warn('迁移 warning:', e.message);
    }
})();

app.listen(PORT, () => {
    console.log('清和居服务器已启动: http://localhost:' + PORT);
});
