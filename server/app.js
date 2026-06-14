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
app.use(express.json({ limit: '10mb' }));

/* 静态文件托管（前端页面） */
app.use(express.static(path.join(__dirname, '..')));

/* 路由模块 */
app.use('/api', require('./routes/user'));
app.use('/api', require('./routes/post'));
app.use('/api', require('./routes/checkin'));
app.use('/api', require('./routes/solarterm'));
app.use('/api', require('./routes/ai'));

/* 启动 */
app.listen(PORT, () => {
    console.log('清和居服务器已启动: http://localhost:' + PORT);
});
