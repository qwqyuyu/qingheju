/* ==========================================
   routes/post.js — 帖子模块
   ========================================== */

const express = require('express');
const pool = require('../config/db');
const { authMiddleware, optionalAuth } = require('../config/auth');
const { now } = require('../config/time');
const { charLength, isNonEmptyString, LIMITS } = require('../config/validate');
const { avatarUrl } = require('../config/avatar');
const { createRateLimiter } = require('../config/ratelimit');
const { postBodyParser } = require('../config/body');

const router = express.Router();

/* 写操作限流（按登录用户计数，窗口/上限可用环境变量调整；非法值回退默认）：
   发帖默认 10 分钟 10 次、评论 10 分钟 30 次、点赞/取消 10 分钟 120 次 */
const postLimiter = createRateLimiter({
    windowMs: process.env.POST_RATE_LIMIT_WINDOW_MS,
    max: process.env.POST_RATE_LIMIT_MAX || 10,
    message: '发帖过于频繁，请稍后再试'
});
const commentLimiter = createRateLimiter({
    windowMs: process.env.COMMENT_RATE_LIMIT_WINDOW_MS,
    max: process.env.COMMENT_RATE_LIMIT_MAX || 30,
    message: '评论过于频繁，请稍后再试'
});
const likeLimiter = createRateLimiter({
    windowMs: process.env.LIKE_RATE_LIMIT_WINDOW_MS,
    max: process.env.LIKE_RATE_LIMIT_MAX || 120,
    message: '操作过于频繁，请稍后再试'
});

/* 当前登录用户是否管理员（以数据库为准，不信任 token） */
async function isAdminUser(userId) {
    const [rows] = await pool.query('SELECT is_admin FROM users WHERE id = ?', [userId]);
    return rows.length > 0 && !!rows[0].is_admin;
}

/* 图片 data URL 白名单：只允许图片格式，避免任意字符串进入前端 src（XSS） */
const IMAGE_DATA_RE = /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;
function isValidImageData(value, maxLen) {
    return typeof value === 'string' && value.length <= maxLen && IMAGE_DATA_RE.test(value);
}

/* 路径参数 ID：只接受正整数，非法值交给路由返回 400 */
function parseId(value) {
    const id = Number.parseInt(value, 10);
    return Number.isInteger(id) && id > 0 ? id : null;
}

/* GET /api/posts — 帖子列表（分页）
   查询参数：page（默认 1）、pageSize（默认 10，最大 50）、username（可选，按作者筛选） */
router.get('/posts', optionalAuth, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 10));
        const offset = (page - 1) * pageSize;
        const username = typeof req.query.username === 'string' ? req.query.username.trim() : '';

        const where = username ? ' WHERE u.username = ?' : '';
        const whereParams = username ? [username] : [];

        const [countRows] = await pool.query(
            `SELECT COUNT(*) AS total FROM posts p JOIN users u ON p.user_id = u.id${where}`,
            whereParams
        );
        const total = countRows[0].total;

        const [posts] = await pool.query(
            `SELECT p.id, p.title, p.content, COALESCE(p.image_thumb, '') AS image,
                    (p.image <> '') AS hasImage, p.is_featured AS featured,
                    p.likes_count AS likes,
                    p.created_at AS time,
                    u.id AS user_id, u.username, u.avatar_version
             FROM posts p JOIN users u ON p.user_id = u.id${where}
             ORDER BY p.is_featured DESC, p.created_at DESC, p.id DESC
             LIMIT ? OFFSET ?`,
            [...whereParams, pageSize, offset]
        );
        /* 查每条帖子的评论数 */
        const postIds = posts.map(p => p.id);
        let commentsMap = {};
        if (postIds.length > 0) {
            const [comments] = await pool.query(
                `SELECT post_id, COUNT(*) AS cnt FROM comments
                 WHERE post_id IN (?) GROUP BY post_id`,
                [postIds]
            );
            comments.forEach(c => { commentsMap[c.post_id] = c.cnt; });
        }
        /* 如果用户已登录，查点赞状态 */
        let likedSet = new Set();
        if (req.user && postIds.length > 0) {
            const [likes] = await pool.query(
                'SELECT post_id FROM likes WHERE user_id = ? AND post_id IN (?)',
                [req.user.id, postIds]
            );
            likes.forEach(l => likedSet.add(l.post_id));
        }
        const items = posts.map(p => ({
            id: p.id,
            username: p.username,
            avatar: avatarUrl(p.user_id, p.avatar_version),
            time: p.time,
            title: p.title,
            content: p.content,
            image: p.image || '',
            hasImage: !!p.hasImage,
            featured: !!p.featured,
            likes: p.likes,
            commentCount: commentsMap[p.id] || 0,
            liked: likedSet.has(p.id)
        }));
        res.json({ success: true, data: { items, total, page, pageSize } });
    } catch (err) {
        console.error('get posts error:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

/* POST /api/posts — 发帖（原图 + 缩略图，原图不进列表接口） */
router.post('/posts', authMiddleware, postLimiter, postBodyParser, async (req, res) => {
    try {
        const { title, content, image, imageThumb } = req.body || {};
        if (!isNonEmptyString(title) || !isNonEmptyString(content)) {
            return res.status(400).json({ success: false, message: '标题和内容不能为空' });
        }
        if (charLength(title) > LIMITS.title) {
            return res.status(400).json({ success: false, message: '标题不能超过 ' + LIMITS.title + ' 个字符' });
        }
        if (charLength(content) > LIMITS.content) {
            return res.status(400).json({ success: false, message: '内容不能超过 ' + LIMITS.content + ' 个字符' });
        }

        const imageValue = typeof image === 'string' ? image : '';
        const thumbValue = typeof imageThumb === 'string' ? imageThumb : '';
        if (imageValue && !isValidImageData(imageValue, 10000000)) {
            return res.status(400).json({ success: false, message: '图片格式不支持或超过 10MB' });
        }
        if (thumbValue && !isValidImageData(thumbValue, 1000000)) {
            return res.status(400).json({ success: false, message: '缩略图格式不支持或过大' });
        }

        /* 验证用户是否存在于数据库 */
        const [userCheck] = await pool.query('SELECT id FROM users WHERE id = ?', [req.user.id]);
        if (userCheck.length === 0) {
            return res.status(401).json({ success: false, message: '账号不存在，请重新注册' });
        }

        const [result] = await pool.query(
            'INSERT INTO posts (user_id, title, content, image, image_thumb) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, title, content, imageValue, thumbValue || null]
        );
        const [rows] = await pool.query(
            `SELECT p.id, p.title, p.content, COALESCE(p.image_thumb, '') AS image,
                    (p.image <> '') AS hasImage, p.likes_count AS likes,
                    p.created_at AS time,
                    u.id AS user_id, u.username, u.avatar_version
             FROM posts p JOIN users u ON p.user_id = u.id
             WHERE p.id = ?`,
            [result.insertId]
        );
        const post = rows[0];
        post.avatar = avatarUrl(post.user_id, post.avatar_version);
        delete post.user_id;
        delete post.avatar_version;
        post.image = post.image || '';
        post.hasImage = !!post.hasImage;
        post.commentCount = 0;
        post.liked = false;
        res.json({ success: true, data: post });
    } catch (err) {
        console.error('create post error:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

/* GET /api/posts/:id — 帖子详情（返回原图，列表接口只给缩略图） */
router.get('/posts/:id', optionalAuth, async (req, res) => {
    const postId = parseId(req.params.id);
    if (!postId) {
        return res.status(400).json({ success: false, message: '帖子 ID 不合法' });
    }
    try {
        const [rows] = await pool.query(
            `SELECT p.id, p.title, p.content, p.image, COALESCE(p.image_thumb, '') AS imageThumb,
                    (p.image <> '') AS hasImage, p.is_featured AS featured,
                    p.likes_count AS likes, p.created_at AS time,
                    u.id AS user_id, u.username, u.avatar_version
             FROM posts p JOIN users u ON p.user_id = u.id
             WHERE p.id = ?`,
            [postId]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: '帖子不存在' });
        }
        const post = rows[0];
        post.avatar = avatarUrl(post.user_id, post.avatar_version);
        delete post.user_id;
        delete post.avatar_version;
        post.image = post.image || '';
        post.imageThumb = post.imageThumb || '';
        post.hasImage = !!post.hasImage;
        post.featured = !!post.featured;

        const [cnt] = await pool.query('SELECT COUNT(*) AS c FROM comments WHERE post_id = ?', [postId]);
        post.commentCount = cnt[0].c;
        post.liked = false;
        if (req.user) {
            const [liked] = await pool.query(
                'SELECT id FROM likes WHERE user_id = ? AND post_id = ?',
                [req.user.id, postId]
            );
            post.liked = liked.length > 0;
        }
        res.json({ success: true, data: post });
    } catch (err) {
        console.error('get post detail error:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

/* DELETE /api/posts/:id — 删帖（作者本人，或管理员） */
router.delete('/posts/:id', authMiddleware, async (req, res) => {
    try {
        const postId = parseId(req.params.id);
        if (!postId) {
            return res.status(400).json({ success: false, message: '帖子 ID 不合法' });
        }
        const [rows] = await pool.query('SELECT user_id FROM posts WHERE id = ?', [postId]);
        if (rows.length === 0) {
            return res.json({ success: false, message: '帖子不存在' });
        }
        const isOwner = rows[0].user_id === req.user.id;
        if (!isOwner && !(await isAdminUser(req.user.id))) {
            return res.json({ success: false, message: '无权删除他人帖子' });
        }
        await pool.query('DELETE FROM posts WHERE id = ?', [postId]);
        if (!isOwner) {
            console.log(`[审计] 管理员 #${req.user.id} 删除了用户 #${rows[0].user_id} 的帖子 #${postId}`);
        }
        res.json({ success: true, data: { deleted: true } });
    } catch (err) {
        console.error('delete post error:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

/* POST /api/posts/:id/like — 点赞/取消点赞 */
router.post('/posts/:id/like', authMiddleware, likeLimiter, async (req, res) => {
    const postId = parseId(req.params.id);
    if (!postId) {
        return res.status(400).json({ success: false, message: '帖子 ID 不合法' });
    }

    let conn;
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();

        /* 锁“帖子”这一行（一定存在），把同一帖子的点赞串行化。
           不要锁 likes 里可能不存在的行，否则并发时容易产生间隙锁死锁 */
        const [postRows] = await conn.query(
            'SELECT likes_count FROM posts WHERE id = ? FOR UPDATE',
            [postId]
        );
        if (postRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: '帖子不存在' });
        }

        const [exist] = await conn.query(
            'SELECT id FROM likes WHERE user_id = ? AND post_id = ?',
            [req.user.id, postId]
        );

        let liked;
        if (exist.length > 0) {
            /* 已点赞则取消 */
            await conn.query('DELETE FROM likes WHERE user_id = ? AND post_id = ?', [req.user.id, postId]);
            await conn.query(
                'UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = ?',
                [postId]
            );
            liked = false;
        } else {
            /* 点赞 */
            await conn.query('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [req.user.id, postId]);
            await conn.query('UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?', [postId]);
            liked = true;
        }

        const [rows] = await conn.query('SELECT likes_count FROM posts WHERE id = ?', [postId]);
        await conn.commit();

        res.json({ success: true, data: { liked, likes: rows[0].likes_count } });
    } catch (err) {
        if (conn) {
            try { await conn.rollback(); } catch (e) { /* ignore */ }
        }
        console.error('like error:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    } finally {
        if (conn) conn.release();
    }
});

/* PUT /api/posts/:id/feature — 设为 / 取消精选（仅管理员） */
router.put('/posts/:id/feature', authMiddleware, async (req, res) => {
    const postId = parseId(req.params.id);
    if (!postId) {
        return res.status(400).json({ success: false, message: '帖子 ID 不合法' });
    }
    const { featured } = req.body || {};
    if (typeof featured !== 'boolean') {
        return res.status(400).json({ success: false, message: '参数 featured 必须是布尔值' });
    }
    try {
        if (!(await isAdminUser(req.user.id))) {
            return res.status(403).json({ success: false, message: '只有管理员可以设置精选' });
        }
        const [result] = await pool.query(
            'UPDATE posts SET is_featured = ? WHERE id = ?',
            [featured ? 1 : 0, postId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: '帖子不存在' });
        }
        res.json({ success: true, data: { featured } });
    } catch (err) {
        console.error('feature post error:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

/* GET /api/posts/:id/comments — 评论列表 */
router.get('/posts/:id/comments', async (req, res) => {
    try {
        const postId = parseId(req.params.id);
        if (!postId) {
            return res.status(400).json({ success: false, message: '帖子 ID 不合法' });
        }
        const [comments] = await pool.query(
            `SELECT c.id, c.content, c.created_at AS time, u.username
             FROM comments c JOIN users u ON c.user_id = u.id
             WHERE c.post_id = ? ORDER BY c.created_at ASC`,
            [postId]
        );
        res.json({ success: true, data: comments });
    } catch (err) {
        console.error('get comments error:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

/* POST /api/posts/:id/comments — 发评论 */
router.post('/posts/:id/comments', authMiddleware, commentLimiter, async (req, res) => {
    try {
        const postId = parseId(req.params.id);
        if (!postId) {
            return res.status(400).json({ success: false, message: '帖子 ID 不合法' });
        }
        const { content } = req.body || {};
        if (!isNonEmptyString(content)) {
            return res.status(400).json({ success: false, message: '评论内容不能为空' });
        }
        if (charLength(content) > LIMITS.comment) {
            return res.status(400).json({ success: false, message: '评论不能超过 ' + LIMITS.comment + ' 个字符' });
        }
        const [postRows] = await pool.query('SELECT id FROM posts WHERE id = ?', [postId]);
        if (postRows.length === 0) {
            return res.status(404).json({ success: false, message: '帖子不存在' });
        }
        /* 用户名以数据库为准（token 里只存 id，改名后不会拿到旧名） */
        const [userRows] = await pool.query('SELECT username FROM users WHERE id = ?', [req.user.id]);
        if (userRows.length === 0) {
            return res.status(401).json({ success: false, message: '账号不存在，请重新登录' });
        }
        const [result] = await pool.query(
            'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)',
            [postId, req.user.id, content]
        );
        res.json({
            success: true,
            data: {
                id: result.insertId,
                username: userRows[0].username,
                content,
                time: now()
            }
        });
    } catch (err) {
        console.error('add comment error:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

/* DELETE /api/comments/:id — 删评论（作者本人，或管理员） */
router.delete('/comments/:id', authMiddleware, async (req, res) => {
    try {
        const commentId = parseId(req.params.id);
        if (!commentId) {
            return res.status(400).json({ success: false, message: '评论 ID 不合法' });
        }
        const [rows] = await pool.query('SELECT user_id FROM comments WHERE id = ?', [commentId]);
        if (rows.length === 0) {
            return res.json({ success: false, message: '评论不存在' });
        }
        const isOwner = rows[0].user_id === req.user.id;
        if (!isOwner && !(await isAdminUser(req.user.id))) {
            return res.json({ success: false, message: '无权删除他人评论' });
        }
        await pool.query('DELETE FROM comments WHERE id = ?', [commentId]);
        if (!isOwner) {
            console.log(`[审计] 管理员 #${req.user.id} 删除了用户 #${rows[0].user_id} 的评论 #${commentId}`);
        }
        res.json({ success: true, data: { deleted: true } });
    } catch (err) {
        console.error('delete comment error:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

module.exports = router;
