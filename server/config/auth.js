/* ==========================================
   config/auth.js — JWT 鉴权中间件
   ========================================== */

const jwt = require('jsonwebtoken');

/* 密钥只从环境变量读取；没有配置或太短时直接拒绝启动。
   生成方式：
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   轮换密钥后，所有已签发的 token 会立即失效。 */
const SECRET = process.env.JWT_SECRET || '';
if (SECRET.length < 32) {
    throw new Error(
        'JWT_SECRET 未配置或长度不足 32 位：请在 server/.env 或部署环境变量中设置一个随机字符串'
    );
}

/* 生成 token：只放不可变的用户 id，
   用户名等可变信息用到时再查库，避免改名后 token 里还是旧名 */
function generateToken(user) {
    return jwt.sign({ id: user.id }, SECRET, { expiresIn: '7d', algorithm: 'HS256' });
}

/* 鉴权中间件 */
function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: '请先登录' });
    }
    try {
        const token = header.split(' ')[1];
        const decoded = jwt.verify(token, SECRET, { algorithms: ['HS256'] });
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
            req.user = jwt.verify(token, SECRET, { algorithms: ['HS256'] });
        } catch (e) { /* 忽略无效 token */ }
    }
    next();
}

module.exports = { generateToken, authMiddleware, optionalAuth };
