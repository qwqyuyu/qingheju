/* ==========================================
   config/auth.js — JWT 鉴权中间件
   ========================================== */

const jwt = require('jsonwebtoken');
const pool = require('./db');

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

/* 生成 token：放不可变的用户 id 和 token 版本号。
   用户名等可变信息用到时再查库，避免改名后 token 里还是旧名；
   版本号与 users.token_version 不一致时（改过密码），旧 token 立即失效。 */
function generateToken(user) {
    return jwt.sign(
        { id: user.id, v: Number(user.token_version) || 0 },
        SECRET,
        { expiresIn: '7d', algorithm: 'HS256' }
    );
}

/* 鉴权中间件：校验签名后，再从数据库确认用户仍然存在、token 版本未被改密作废。
   每个需要登录的请求多一次主键查询，换来「改密即下线、删号即失效」的确定性。 */
async function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: '请先登录' });
    }

    let decoded;
    try {
        decoded = jwt.verify(header.split(' ')[1], SECRET, { algorithms: ['HS256'] });
    } catch (err) {
        return res.status(401).json({ success: false, message: '登录已过期，请重新登录' });
    }

    let row;
    try {
        const [rows] = await pool.query(
            'SELECT token_version FROM users WHERE id = ?',
            [decoded.id]
        );
        row = rows[0];
    } catch (err) {
        /* 数据库故障交给统一错误处理，不要伪装成 401 */
        return next(err);
    }

    if (!row) {
        return res.status(401).json({ success: false, message: '账号不存在，请重新登录' });
    }
    if ((Number(decoded.v) || 0) !== (Number(row.token_version) || 0)) {
        return res.status(401).json({ success: false, message: '登录已过期，请重新登录' });
    }

    req.user = decoded;
    next();
}

/* 可选鉴权（不强制登录）：只校验签名，不查库。
   这里的信息仅用于「是否点过赞」这类公开态展示，不需要承担失效语义。 */
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
