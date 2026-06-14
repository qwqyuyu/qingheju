/* ==========================================
   config/auth.js — JWT 鉴权中间件
   ========================================== */

const jwt = require('jsonwebtoken');
const SECRET = 'qingheju_jwt_secret_2026';

/* 生成 token */
function generateToken(user) {
    return jwt.sign({ id: user.id, username: user.username }, SECRET, { expiresIn: '7d' });
}

/* 鉴权中间件 */
function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: '请先登录' });
    }
    try {
        const token = header.split(' ')[1];
        const decoded = jwt.verify(token, SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: '登录已过期，请重新登录' });
    }
}

/* 可选鉴权（不强制登录） */
function optionalAuth(req, res, next) {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
        try {
            const token = header.split(' ')[1];
            req.user = jwt.verify(token, SECRET);
        } catch (e) { /* 忽略无效 token */ }
    }
    next();
}

module.exports = { generateToken, authMiddleware, optionalAuth };
