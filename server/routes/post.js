/* ==========================================
   routes/post.js — 帖子模块
   ========================================== */

const express = require('express');
const pool = require('../config/db');
const { authMiddleware, optionalAuth } = require('../config/auth');

const router = express.Router();

/* GET /api/posts — 帖子列表 */
router.get('/posts', optionalAuth, async (req, res) => {
    try {
        const [posts] = await pool.query(
            `SELECT p.id, p.title, p.content, p.image, p.likes_count AS likes,
                    p.created_at AS time,
                    u.username, u.avatar
             FROM posts p JOIN users u ON p.user_id = u.id
             ORDER BY p.created_at DESC`
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
        const data = posts.map(p => ({
            id: p.id,
            username: p.username,
            avatar: p.avatar,
            time: p.time,
            title: p.title,
            content: p.content,
            image: p.image || '',
            likes: p.likes,
            commentCount: commentsMap[p.id] || 0,
            liked: likedSet.has(p.id)
        }));
        res.json({ success: true, data });
    } catch (err) {
        console.error('get posts error:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

/* POST /api/posts — 发帖 */
router.post('/posts', authMiddleware, async (req, res) => {
    try {
        const { title, content, image } = req.body;
        if (!title || !content) {
            return res.json({ success: false, message: '标题和内容不能为空' });
        }
        const [result] = await pool.query(
            'INSERT INTO posts (user_id, title, content, image) VALUES (?, ?, ?, ?)',
            [req.user.id, title, content, image || '']
        );
        const [rows] = await pool.query(
            `SELECT p.id, p.title, p.content, p.image, p.likes_count AS likes,
                    p.created_at AS time,
                    u.username, u.avatar
             FROM posts p JOIN users u ON p.user_id = u.id
             WHERE p.id = ?`,
            [result.insertId]
        );
        const post = rows[0];
        post.commentCount = 0;
        post.liked = false;
        res.json({ success: true, data: post });
    } catch (err) {
        console.error('create post error:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

/* DELETE /api/posts/:id — 删帖 */
router.delete('/posts/:id', authMiddleware, async (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        const [rows] = await pool.query('SELECT user_id FROM posts WHERE id = ?', [postId]);
        if (rows.length === 0) {
            return res.json({ success: false, message: '帖子不存在' });
        }
        if (rows[0].user_id !== req.user.id) {
            return res.json({ success: false, message: '无权删除他人帖子' });
        }
        await pool.query('DELETE FROM posts WHERE id = ?', [postId]);
        res.json({ success: true, data: { deleted: true } });
    } catch (err) {
        console.error('delete post error:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

/* POST /api/posts/:id/like — 点赞/取消点赞 */
router.post('/posts/:id/like', authMiddleware, async (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        const [exist] = await pool.query(
            'SELECT id FROM likes WHERE user_id = ? AND post_id = ?',
            [req.user.id, postId]
        );
        if (exist.length > 0) {
            /* 已点赞则取消 */
            await pool.query('DELETE FROM likes WHERE user_id = ? AND post_id = ?', [req.user.id, postId]);
            await pool.query('UPDATE posts SET likes_count = likes_count - 1 WHERE id = ?', [postId]);
            res.json({ success: true, data: { liked: false } });
        } else {
            /* 点赞 */
            await pool.query('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [req.user.id, postId]);
            await pool.query('UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?', [postId]);
            res.json({ success: true, data: { liked: true } });
        }
    } catch (err) {
        console.error('like error:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

/* GET /api/posts/:id/comments — 评论列表 */
router.get('/posts/:id/comments', async (req, res) => {
    try {
        const postId = parseInt(req.params.id);
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
router.post('/posts/:id/comments', authMiddleware, async (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        const { content } = req.body;
        if (!content) {
            return res.json({ success: false, message: '评论内容不能为空' });
        }
        const [result] = await pool.query(
            'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)',
            [postId, req.user.id, content]
        );
        res.json({
            success: true,
            data: {
                id: result.insertId,
                username: req.user.username,
                content,
                time: new Date().toISOString().replace('T', ' ').substring(0, 16)
            }
        });
    } catch (err) {
        console.error('add comment error:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

/* DELETE /api/comments/:id — 删评论 */
router.delete('/comments/:id', authMiddleware, async (req, res) => {
    try {
        const commentId = parseInt(req.params.id);
        const [rows] = await pool.query('SELECT user_id FROM comments WHERE id = ?', [commentId]);
        if (rows.length === 0) {
            return res.json({ success: false, message: '评论不存在' });
        }
        if (rows[0].user_id !== req.user.id) {
            return res.json({ success: false, message: '无权删除他人评论' });
        }
        await pool.query('DELETE FROM comments WHERE id = ?', [commentId]);
        res.json({ success: true, data: { deleted: true } });
    } catch (err) {
        console.error('delete comment error:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

module.exports = router;
