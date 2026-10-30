/* ==========================================
   discussion.js — 分享讨论区交互逻辑
   功能：发帖、评论、点赞、帖子详情弹窗
   ========================================== */

document.addEventListener('DOMContentLoaded', async () => {

    /* 更新导航登录状态；同时刷新一次资料，拿到 is_admin（旧会话里可能没有） */
    let currentUser = API.getCurrentUser();
    if (currentUser) {
        const navLink = document.getElementById('nav_user_link');
        if (navLink) { navLink.textContent = '我的'; navLink.href = 'profile.html'; }
        try {
            const me = await API.getUser();
            if (me.success && me.data) {
                currentUser = {
                    ...currentUser,
                    username: me.data.username,
                    avatar: me.data.avatar,
                    is_admin: !!me.data.is_admin
                };
                localStorage.setItem('current_user', JSON.stringify(currentUser));
            }
        } catch (e) { /* 忽略，保留本地缓存 */ }
    }

    /* 能否删除某个用户的内容：本人或管理员（服务端会再次校验，这里只决定是否显示按钮） */
    function canDelete(authorName) {
        return !!currentUser && (!!currentUser.is_admin || currentUser.username === authorName);
    }

    let allPosts = [];
    let currentPage = 0;
    let totalPosts = 0;
    let loadingPosts = false;
    const PAGE_SIZE = 10;

    /* 加载帖子（reset=true 重新从第一页加载） */
    async function loadPosts(reset) {
        if (loadingPosts) return;
        loadingPosts = true;
        const page = reset ? 1 : currentPage + 1;
        document.getElementById('loading_posts').style.display = 'block';
        try {
            const result = await API.getPosts({ page: page, pageSize: PAGE_SIZE });
            if (result.success && result.data) {
                const items = result.data.items || [];
                allPosts = reset ? items : allPosts.concat(items);
                currentPage = page;
                totalPosts = result.data.total || 0;
                renderPostList(allPosts);
                updateLoadMore();
            }
        } catch (e) {
            if (reset) allPosts = [];
        }
        document.getElementById('loading_posts').style.display = 'none';
        loadingPosts = false;
    }

    /* 更新“加载更多”按钮和计数 */
    function updateLoadMore() {
        const wrap = document.getElementById('load_more_wrap');
        if (!wrap) return;
        const hasMore = allPosts.length < totalPosts;
        wrap.style.display = hasMore ? 'block' : 'none';
        const hint = document.getElementById('load_more_hint');
        if (hint) hint.textContent = '已显示 ' + allPosts.length + ' / 共 ' + totalPosts + ' 条';
    }

    /* 渲染帖子列表 */
    function renderPostList(posts) {
        const container = document.getElementById('post_list');
        if (!posts || posts.length === 0) {
            container.innerHTML = '<p class="no_data">暂无讨论，快来发布第一条帖子吧！</p>';
            return;
        }

        container.innerHTML = posts.map(p => {
            const isLiked = p.liked;
            return `
                <div class="post_card${p.featured ? ' featured' : ''}" data-id="${p.id}">
                    <div class="post_card_header">
                        <img class="post_avatar" src="${escapeHtml(p.avatar || '/images/ui/default_avatar.svg')}" alt="${escapeHtml(p.username)}" onerror="this.style.background='#D8CFBF'">
                        <span class="post_username">${escapeHtml(p.username)}</span>
                        <span class="post_time">${escapeHtml(p.time)}</span>
                    </div>
                    <h3 class="post_title">${p.featured ? '<span class="post_featured_badge">精选</span>' : ''}${escapeHtml(p.title)}</h3>
                    <p class="post_content_preview">${escapeHtml(String(p.preview || p.content || '').substring(0, 150))}</p>
                    ${p.image ? `<div class="post_thumb_wrap"><img class="post_thumb_img" src="${escapeHtml(p.image)}" alt="帖子图片" loading="lazy"></div>` : ''}
                    <div class="post_card_footer">
                        <span class="post_stat ${isLiked ? 'liked' : ''}" data-action="like" data-id="${p.id}">
                            ♥ ${p.likes || 0}
                        </span>
                        <span class="post_stat" data-action="comment" data-id="${p.id}">
                            💬 ${p.commentCount || 0} 评论
                        </span>
                        ${currentUser && currentUser.is_admin ? `<span class="post_feature_btn" data-action="feature" data-id="${p.id}" data-featured="${p.featured ? 1 : 0}">${p.featured ? '取消精选' : '设为精选'}</span>` : ''}
                        ${canDelete(p.username) ? `<span class="post_delete_btn" data-action="delete" data-id="${p.id}">删除</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        /* 绑定帖子事件 */
        bindPostEvents();
    }

    function bindPostEvents() {
        /* 点击帖子查看详情 */
        document.querySelectorAll('.post_card').forEach(card => {
            card.addEventListener('click', (e) => {
                /* 如果点击了点赞按钮则不弹出详情 */
                if (e.target.closest('[data-action="like"]') || e.target.closest('[data-action="delete"]') || e.target.closest('[data-action="feature"]')) return;
                const id = parseInt(card.dataset.id);
                const post = allPosts.find(p => p.id === id);
                if (post) showPostDetail(post);
            });
        });

        /* 删除帖子 */
        document.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!await showConfirm('确定要删除这篇帖子吗？删除后无法恢复。')) return;
                const postId = parseInt(btn.dataset.id);
                const result = await API.deletePost(postId);
                if (result.success) {
                    /* 删除后重置到第一页，避免 offset 分页错位 */
                    loadPosts(true);
                    document.getElementById('post_modal').classList.remove('show');
                } else {
                    alert(result.message || '删除失败，请稍后再试');
                }
            });
        });

        /* 精选（仅管理员可见按钮） */
        document.querySelectorAll('[data-action="feature"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const postId = parseInt(btn.dataset.id);
                const next = btn.dataset.featured !== '1';
                const result = await API.setFeatured(postId, next);
                if (result.success) {
                    loadPosts(true);
                } else {
                    alert(result.message || '操作失败');
                }
            });
        });

        /* 点赞功能（支持点赞/取消点赞） */
        document.querySelectorAll('[data-action="like"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const postId = parseInt(btn.dataset.id);
                const result = await API.likePost(postId);
                if (result.success && result.data) {
                    const post = allPosts.find(p => p.id === postId);
                    const liked = !!result.data.liked;
                    const likes = (typeof result.data.likes === 'number')
                        ? result.data.likes
                        : (post ? post.likes : 0);

                    btn.classList.toggle('liked', liked);
                    if (post) { post.likes = likes; post.liked = liked; }
                    btn.innerHTML = `♥ ${likes}`;
                } else if (result && result.code === 429) {
                    /* 被限流时给个提示；其它失败（如未登录）保持原来的静默行为 */
                    alert(result.message || '操作过于频繁，请稍后再试');
                }
            });
        });
    }

    /* 显示帖子详情弹窗 */
    async function showPostDetail(post) {
        /* 从后端加载评论 */
        let comments = [];
        try {
            const result = await API.getComments(post.id);
            if (result.success && result.data) {
                comments = result.data;
            }
        } catch (e) {}

        /* 列表接口只返回缩略图和正文预览；详情弹窗再取原图与全文 */
        let originalImage = post.image || '';
        let fullContent = post.preview || post.content || '';
        try {
            const detail = await API.getPost(post.id);
            if (detail.success && detail.data) {
                if (detail.data.image) originalImage = detail.data.image;
                if (typeof detail.data.content === 'string' && detail.data.content) {
                    fullContent = detail.data.content;
                }
            }
        } catch (e) { /* 取不到就回退到缩略图和预览 */ }

        const modal = document.getElementById('post_modal');
        const content = document.getElementById('modal_post_content');

        const canDeletePost = canDelete(post.username);

        content.innerHTML = `
            <div class="post_card_header" style="margin-bottom:14px;">
                <img class="post_avatar" src="${escapeHtml(post.avatar || '/images/ui/default_avatar.svg')}" alt="${escapeHtml(post.username)}">
                <span class="post_username">${escapeHtml(post.username)}</span>
                <span class="post_time">${escapeHtml(post.time)}</span>
            </div>
            <h2>${escapeHtml(post.title)}</h2>
            <div class="post_full_body">${escapeHtml(fullContent)}</div>
            ${originalImage ? `<img src="${escapeHtml(originalImage)}" style="max-width:100%;border-radius:8px;margin-bottom:16px;" alt="帖子图片">` : ''}
            ${canDeletePost ? `<div style="text-align:right;margin-bottom:16px;"><button class="modal_post_delete" id="modal_delete_post">删除帖子</button></div>` : ''}
            <div class="comments_section">
                <p class="comments_title">评论 (${comments.length})</p>
                <div class="comments_list" id="comments_list">
                    ${comments.length > 0 ? comments.map(c => {
                        const canDeleteComment = canDelete(c.username);
                        return `
                        <div class="comment_item">
                            <div class="comment_header">
                                <span class="comment_user">${escapeHtml(c.username)}</span>
                                <span class="comment_time">${escapeHtml(c.time)}</span>
                                ${canDeleteComment ? `<span class="comment_delete_btn" data-comment-id="${c.id}">删除</span>` : ''}
                            </div>
                            <p class="comment_content">${escapeHtml(c.content)}</p>
                        </div>
                    `;}).join('') : '<p class="no_comment">暂无评论，来说两句吧</p>'}
                </div>
                ${currentUser ? `
                <div class="comment_input_area">
                    <input type="text" id="comment_input" class="form_input" placeholder="写下你的评论...">
                    <button class="btn btn_primary" id="submit_comment" data-post-id="${post.id}">发送</button>
                </div>
                ` : '<p style="text-align:center;color:#999;font-size:13px;">请<a href="login.html">登录</a>后发表评论</p>'}
            </div>
        `;

        modal.classList.add('show');

        /* 弹窗内删除帖子 */
        const modalDeleteBtn = document.getElementById('modal_delete_post');
        if (modalDeleteBtn) {
            modalDeleteBtn.addEventListener('click', async () => {
                if (!await showConfirm('确定要删除这篇帖子吗？删除后无法恢复。')) return;
                const result = await API.deletePost(post.id);
                if (result.success) {
                    loadPosts(true);
                    modal.classList.remove('show');
                } else {
                    alert(result.message || '删除失败，请稍后再试');
                }
            });
        }

        /* 弹窗内删除评论 */
        document.querySelectorAll('.comment_delete_btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!await showConfirm('确定要删除这条评论吗？')) return;
                const commentId = parseInt(btn.dataset.commentId);
                const result = await API.deleteComment(post.id, commentId);
                if (result.success) {
                    btn.closest('.comment_item').remove();
                    /* 更新帖子评论数 */
                    post.commentCount = Math.max(0, (post.commentCount || 0) - 1);
                    const postCard = document.querySelector(`.post_card[data-id="${post.id}"]`);
                    if (postCard) {
                        const commentStat = postCard.querySelector('[data-action="comment"]');
                        if (commentStat) commentStat.textContent = `💬 ${post.commentCount} 评论`;
                    }
                    /* 更新弹窗评论数 */
                    const commentsTitle = document.querySelector('.comments_title');
                    const count = document.querySelectorAll('#comments_list .comment_item').length;
                    if (commentsTitle) commentsTitle.textContent = `评论 (${count})`;
                    if (count === 0) {
                        document.getElementById('comments_list').innerHTML = '<p class="no_comment">暂无评论，来说两句吧</p>';
                    }
                } else {
                    alert(result.message || '删除失败，请稍后再试');
                }
            });
        });

        /* 评论提交 */
        const submitBtn = document.getElementById('submit_comment');
        if (submitBtn) {
            submitBtn.addEventListener('click', async () => {
                const input = document.getElementById('comment_input');
                const commentText = input.value.trim();
                if (!commentText) return;

                const result = await API.addComment(post.id, commentText);
                if (result.success) {
                    /* 直接在当前UI中添加评论 */
                    const commentsList = document.getElementById('comments_list');
                    const noComment = commentsList.querySelector('.no_comment');
                    if (noComment) noComment.remove();
                    commentsList.insertAdjacentHTML('beforeend', `
                        <div class="comment_item">
                            <div class="comment_header">
                                <span class="comment_user">${escapeHtml(currentUser.username)}</span>
                                <span class="comment_time">刚刚</span>
                                <span class="comment_delete_btn" data-comment-id="${result.data.id}">删除</span>
                            </div>
                            <p class="comment_content">${escapeHtml(commentText)}</p>
                        </div>
                    `);
                    /* 绑定新评论的删除事件 */
                    const newComment = commentsList.lastElementChild;
                    const newDeleteBtn = newComment.querySelector('.comment_delete_btn');
                    if (newDeleteBtn) {
                        newDeleteBtn.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            if (!await showConfirm('确定要删除这条评论吗？')) return;
                            const cid = parseInt(newDeleteBtn.dataset.commentId);
                            const r = await API.deleteComment(post.id, cid);
                            if (r.success) {
                                newComment.remove();
                                post.commentCount = Math.max(0, (post.commentCount || 0) - 1);
                                const pc = document.querySelector(`.post_card[data-id="${post.id}"]`);
                                if (pc) {
                                    const cs = pc.querySelector('[data-action="comment"]');
                                    if (cs) cs.textContent = `💬 ${post.commentCount} 评论`;
                                }
                                const ct = document.querySelector('.comments_title');
                                const cnt = document.querySelectorAll('#comments_list .comment_item').length;
                                if (ct) ct.textContent = `评论 (${cnt})`;
                                if (cnt === 0) {
                                    document.getElementById('comments_list').innerHTML = '<p class="no_comment">暂无评论，来说两句吧</p>';
                                }
                            } else {
                                alert(r.message || '删除失败，请稍后再试');
                            }
                        });
                    }
                    /* 更新评论数 */
                    post.commentCount = (post.commentCount || 0) + 1;
                    const postCard = document.querySelector(`.post_card[data-id="${post.id}"]`);
                    if (postCard) {
                        const commentStat = postCard.querySelector('[data-action="comment"]');
                        if (commentStat) commentStat.textContent = `💬 ${post.commentCount} 评论`;
                    }
                    const commentsTitle = document.querySelector('.comments_title');
                    const count = document.querySelectorAll('#comments_list .comment_item').length;
                    if (commentsTitle) commentsTitle.textContent = `评论 (${count})`;
                    input.value = '';
                } else {
                    /* 之前失败时没有任何提示；被限流（429）或评论不合法时要让用户看见 */
                    alert(result.message || '评论失败，请稍后再试');
                }
            });
        }

        /* 关闭弹窗 */
        document.getElementById('modal_post_close').addEventListener('click', () => {
            modal.classList.remove('show');
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('show');
        });
    }

    /* 发布新帖 */
    document.getElementById('new_post_btn').addEventListener('click', () => {
        if (!currentUser) {
            alert('请先登录后再发帖');
            window.location.href = 'login.html';
            return;
        }
        document.getElementById('post_editor').style.display = 'block';
        document.getElementById('post_editor').scrollIntoView({ behavior: 'smooth' });
    });

    /* ──────────────────────────────────────
       发帖草稿：离开页面/刷新后不丢已写的标题与正文
       --------------------------------------
       只存文本，不存图片（base64 太大，容易撞 localStorage 配额）。
       按用户隔离，发布成功后清空。
       ────────────────────────────────────── */
    const DRAFT_TTL = 7 * 86400000;
    const DRAFT_SAVE_DELAY = 400;
    let draftTimer = null;

    function draftKey() {
        return window.userKey('post_draft');
    }

    function readDraft() {
        try {
            const raw = localStorage.getItem(draftKey());
            if (!raw) return null;
            const saved = JSON.parse(raw);
            if (!saved || typeof saved !== 'object') return null;
            if (!saved.at || Date.now() - saved.at > DRAFT_TTL) {
                localStorage.removeItem(draftKey());
                return null;
            }
            const title = typeof saved.title === 'string' ? saved.title : '';
            const content = typeof saved.content === 'string' ? saved.content : '';
            if (!title.trim() && !content.trim()) return null;
            return { title, content };
        } catch (e) {
            return null;
        }
    }

    function writeDraft() {
        try {
            const title = document.getElementById('post_title').value || '';
            const content = document.getElementById('post_content').value || '';
            if (!title.trim() && !content.trim()) {
                localStorage.removeItem(draftKey());
                return;
            }
            localStorage.setItem(draftKey(), JSON.stringify({ v: 1, at: Date.now(), title, content }));
        } catch (e) {
            /* 配额写满 / 隐私模式：草稿存不下不影响发帖 */
        }
    }

    function scheduleSaveDraft() {
        if (draftTimer) clearTimeout(draftTimer);
        draftTimer = setTimeout(function () {
            draftTimer = null;
            writeDraft();
        }, DRAFT_SAVE_DELAY);
    }

    function clearDraft() {
        if (draftTimer) { clearTimeout(draftTimer); draftTimer = null; }
        try { localStorage.removeItem(draftKey()); } catch (e) { /* ignore */ }
    }

    document.getElementById('post_title').addEventListener('input', scheduleSaveDraft);
    document.getElementById('post_content').addEventListener('input', scheduleSaveDraft);

    /* 恢复上次没发出去的草稿（有草稿就直接把编辑器打开） */
    (function restoreDraft() {
        if (!currentUser) return;
        const draft = readDraft();
        if (!draft) return;
        document.getElementById('post_title').value = draft.title;
        document.getElementById('post_content').value = draft.content;
        document.getElementById('post_editor').style.display = 'block';
    })();

    document.getElementById('cancel_post').addEventListener('click', () => {
        /* 取消只是收起编辑器，草稿保留，下次进来还在 */
        document.getElementById('post_editor').style.display = 'none';
        document.getElementById('post_error').textContent = '';
    });

    document.getElementById('submit_post').addEventListener('click', async () => {
        const title = document.getElementById('post_title').value.trim();
        const content = document.getElementById('post_content').value.trim();
        const errorEl = document.getElementById('post_error');

        if (!title) { errorEl.textContent = '请输入标题'; return; }
        if (!content) { errorEl.textContent = '请输入内容'; return; }

        /* 处理图片：原图原样上传，另生成一张缩略图给列表用 */
        let imageData = '';
        let thumbData = '';
        const fileInput = document.getElementById('post_image');
        if (fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            imageData = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = () => resolve('');
                reader.readAsDataURL(file);
            });
            try {
                thumbData = await makePostThumb(file);
            } catch (e) {
                thumbData = '';
            }
        }

        const result = await API.createPost(title, content, imageData, thumbData);
        if (result.success) {
            /* 已经发布成功，草稿没用了 */
            clearDraft();
            document.getElementById('post_editor').style.display = 'none';
            document.getElementById('post_title').value = '';
            document.getElementById('post_content').value = '';
            document.getElementById('post_image').value = '';
            document.getElementById('post_error').textContent = '';
            document.getElementById('post_image_preview').style.display = 'none';
            /* 新帖子在最前面：重置列表以便第一页能看到 */
            loadPosts(true);
        } else {
            /* 401 已由 api.js 统一处理（清理登录态 + 跳登录并带回跳参数），
               这里只提示，不再重复跳转，免得丢掉回跳参数 */
            if (result.needLogin) {
                errorEl.textContent = '登录已过期，请重新登录';
                return;
            }
            const msg = result.message || '';
            if (msg.includes('登录') || msg.includes('过期')) {
                alert('登录已过期，请重新登录');
                API.logout();
                window.location.href = 'login.html';
                return;
            }
            errorEl.textContent = msg || '发布失败，请稍后再试';
        }
    });

    /* 图片预览 */
    document.getElementById('post_image').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const preview = document.getElementById('post_image_preview');
                preview.src = ev.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });

    /* 列表缩略图：最长边 800px，原图保持不动 */
    function makePostThumb(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                try {
                    const max = 800;
                    const scale = Math.min(max / img.width, max / img.height, 1);
                    const w = Math.max(1, Math.round(img.width * scale));
                    const h = Math.max(1, Math.round(img.height * scale));
                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(0, 0, w, h);
                    ctx.drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', 0.82));
                } catch (err) {
                    reject(err);
                } finally {
                    URL.revokeObjectURL(url);
                }
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('缩略图生成失败'));
            };
            img.src = url;
        });
    }

    function escapeHtml(text) {
        return String(text == null ? '' : text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /* 加载更多 */
    const loadMoreBtn = document.getElementById('load_more_btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => loadPosts(false));
    }

    /* 初始化 */
    loadPosts(true);
});
