/* ==========================================
   app.js — 清和居后端服务入口
   ========================================== */

/* 本地开发：先加载 server/.env，再初始化数据库连接 */
require('./config/env')();

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const { defaultJsonParser } = require('./config/body');

const app = express();
const PORT = process.env.PORT || 3112;

/* 不暴露 Express 版本 */
app.disable('x-powered-by');

/* 基础安全响应头（不引入 helmet 依赖） */
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'"
    ].join('; '));
    next();
});

/* CORS：默认只允许同源；需要跨域时用 CORS_ORIGINS（逗号分隔）显式配置 */
const corsOrigins = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

/* 中间件：压缩放在最前面，HTML/CSS/JS/JSON 都会走 gzip */
app.use(compression());
app.use(cors({
    origin(origin, callback) {
        if (!origin) return callback(null, true);          /* 同源请求 / 非浏览器请求 */
        if (corsOrigins.includes(origin)) return callback(null, true);
        return callback(null, false);                      /* 不返回 CORS 头，由浏览器拦截 */
    }
}));
app.use(defaultJsonParser);   /* 默认 2mb；发帖接口在路由里用自己的上限 */

/* 没有 JSON 请求体时给 req.body 一个空对象，避免处理函数解构时报 500 */
app.use((req, res, next) => {
    if (req.body === undefined) req.body = {};
    next();
});

/* 静态资源白名单：只暴露 css/、js/、images/ 与根目录的 HTML 页面。
   server/ 源码、.env、数据库导出、package.json 等不再通过 HTTP 访问。 */
const ROOT = path.join(__dirname, '..');
const staticOptions = {
    maxAge: '1h',
    index: false,
    dotfiles: 'ignore',
    setHeaders: (res, filePath) => {
        if (/\.(?:html|js|css)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
};

app.use('/css', express.static(path.join(ROOT, 'css'), staticOptions));
app.use('/js', express.static(path.join(ROOT, 'js'), staticOptions));
app.use('/images', express.static(path.join(ROOT, 'images'), staticOptions));

/* 根目录只提供真实存在的 .html 页面；启动时扫描一次，新增页面自动生效 */
const pageFiles = new Set(
    fs.readdirSync(ROOT).filter(name => name.toLowerCase().endsWith('.html'))
);

app.get('/', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(ROOT, 'index.html'));
});

app.get('/:page', (req, res, next) => {
    if (!pageFiles.has(req.params.page)) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(ROOT, req.params.page));
});

/* 路由模块 */
app.use('/api', require('./routes/user'));
app.use('/api', require('./routes/post'));
app.use('/api', require('./routes/checkin'));
app.use('/api', require('./routes/solarterm'));
app.use('/api', require('./routes/ai'));

/* 未知接口统一返回 JSON，避免前端 res.json() 解析到 HTML 后误报“网络错误” */
app.use('/api', (req, res) => {
    res.status(404).json({ success: false, message: '接口不存在' });
});

/* 统一错误处理（如 JSON 解析失败），同样返回 JSON */
app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status = err.status || err.statusCode || 500;
    /* 4xx 是客户端问题，不刷错误日志；5xx 才记录 */
    if (status >= 500) console.error('unhandled error:', err);
    let message = '服务器错误';
    if (status === 400) message = '请求格式错误';
    else if (status === 413) message = '请求体过大';
    else if (status < 500) message = '请求不合法';
    res.status(status).json({ success: false, message });
});

/* 启动迁移：posts.image 与 users.avatar 需要 MEDIUMTEXT。
   先查 information_schema，已经是目标类型就什么都不做；数据库不可用也不阻塞启动。 */
const pool = require('./config/db');

async function columnType(table, column) {
    const [[row]] = await pool.query(
        `SELECT DATA_TYPE FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
    );
    return row ? String(row.DATA_TYPE).toLowerCase() : null;
}

async function migrate() {
    try {
        const imageType = await columnType('posts', 'image');
        if (!imageType) {
            console.warn('迁移跳过：posts.image 不存在，请先导入 server/schema.sql');
        } else {
            if (imageType !== 'mediumtext') {
                await pool.query('ALTER TABLE posts MODIFY image MEDIUMTEXT NOT NULL');
                console.log('数据库迁移完成: posts.image → MEDIUMTEXT');
            }
            const thumbType = await columnType('posts', 'image_thumb');
            if (!thumbType) {
                await pool.query('ALTER TABLE posts ADD COLUMN image_thumb MEDIUMTEXT NULL AFTER image');
                console.log('数据库迁移完成: posts.image_thumb 已添加');
            }
            const featuredType = await columnType('posts', 'is_featured');
            if (!featuredType) {
                await pool.query('ALTER TABLE posts ADD COLUMN is_featured TINYINT(1) NOT NULL DEFAULT 0 AFTER image_thumb');
                console.log('数据库迁移完成: posts.is_featured 已添加');
            }
        }

        const avatarType = await columnType('users', 'avatar');
        if (!avatarType) {
            console.warn('迁移跳过：users.avatar 不存在，请先导入 server/schema.sql');
        } else if (avatarType !== 'mediumtext') {
            await pool.query('ALTER TABLE users MODIFY avatar MEDIUMTEXT NOT NULL');
            console.log('数据库迁移完成: users.avatar → MEDIUMTEXT');
        }
        const avatarVersionType = await columnType('users', 'avatar_version');
        if (!avatarVersionType) {
            await pool.query('ALTER TABLE users ADD COLUMN avatar_version INT NOT NULL DEFAULT 0 AFTER avatar');
            console.log('数据库迁移完成: users.avatar_version 已添加');
        }
        const adminType = await columnType('users', 'is_admin');
        if (!adminType) {
            await pool.query('ALTER TABLE users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER avatar');
            console.log('数据库迁移完成: users.is_admin 已添加');
        }
    } catch (e) {
        console.warn('数据库迁移检查失败（服务仍会启动）:', e.code || e.message);
    }
}

/* 被 require（如 test/routes.test.mjs）时只导出 app，不迁移数据库、不监听端口；
   直接 node app.js / npm start 运行时才执行迁移并启动服务 */
module.exports = app;

if (require.main === module) {
    migrate();
    app.listen(PORT, () => {
        console.log('清和居服务器已启动: http://localhost:' + PORT);
    });
}
