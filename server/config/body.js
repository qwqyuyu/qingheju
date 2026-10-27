/* ==========================================
   config/body.js — JSON 请求体解析与大小上限
   ------------------------------------------
   以前全站统一 50MB，未登录请求也能让服务器缓存 50MB。现在：
     · 默认上限 JSON_BODY_LIMIT（默认 2mb）：登录、头像、AI 对话等都够用
       （头像 ≤ 30 万字符；AI 最多 15 条 × 2 万字符，约 0.9MB）
     · 只有 POST /api/posts（带 base64 图片）用 POST_BODY_LIMIT（默认 12mb），
       并且挂在鉴权和限流之后，未登录请求读不到这 12MB
       （图片 ≤ 1000 万字符 + 缩略图 ≤ 100 万字符 + 正文，约 11.1MB）
   超出上限时由 app.js 的统一错误处理返回 413 JSON。
   注意：本模块在加载时读取环境变量，需在 env 加载之后再 require。
   ========================================== */

const express = require('express');

const DEFAULT_LIMIT = process.env.JSON_BODY_LIMIT || '2mb';
const POST_LIMIT = process.env.POST_BODY_LIMIT || '12mb';

const defaultParser = express.json({ limit: DEFAULT_LIMIT });

/* 发帖接口专用解析器：路由里放在 authMiddleware 与限流之后 */
const postBodyParser = express.json({ limit: POST_LIMIT });

const POST_CREATE_PATH = /^\/api\/posts\/?$/;

/* 全站默认解析器：发帖接口交给它自己的大上限解析器，其余按默认上限 */
function defaultJsonParser(req, res, next) {
    if (req.method === 'POST' && POST_CREATE_PATH.test(req.path)) return next();
    return defaultParser(req, res, next);
}

module.exports = { defaultJsonParser, postBodyParser, DEFAULT_LIMIT, POST_LIMIT };
