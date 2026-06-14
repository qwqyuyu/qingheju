/* ==========================================
   discussion.js — 分享讨论区交互逻辑
   功能：发帖、评论、点赞、帖子详情弹窗
   ========================================== */

document.addEventListener('DOMContentLoaded', async () => {

    /* 更新导航登录状态 */
    const currentUser = API.getCurrentUser();
    if (currentUser) {
        const navLink = document.getElementById('nav_user_link');
        if (navLink) { navLink.textContent = '我的'; navLink.href = 'profile.html'; }
    }

    let allPosts = [];

    /* 加载帖子 */
    async function loadPosts() {
        document.getElementById('loading_posts').style.display = 'block';
        try {
            const result = await API.getPosts();
            if (result.success) {
                allPosts = result.data || [];
                renderPostList(allPosts);
            }
        } catch (e) {
            /* 兜底数据 */
            allPosts = [];
        }
        document.getElementById('loading_posts').style.display = 'none';
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
                <div class="post_card" data-id="${p.id}">
                    <div class="post_card_header">
                        <img class="post_avatar" src="${p.avatar || 'images/ui/default_avatar.svg'}" alt="${p.username}" onerror="this.style.background='#D8CFBF'">
                        <span class="post_username">${escapeHtml(p.username)}</span>
                        <span class="post_time">${p.time}</span>
                    </div>
                    <h3 class="post_title">${escapeHtml(p.title)}</h3>
                    <p class="post_content_preview">${escapeHtml(p.content).substring(0, 150)}</p>
                    ${p.image ? `<div class="post_thumb_wrap"><img class="post_thumb_img" src="${p.image}" alt="帖子图片" loading="lazy"></div>` : ''}
                    <div class="post_card_footer">
                        <span class="post_stat ${isLiked ? 'liked' : ''}" data-action="like" data-id="${p.id}">
                            ♥ ${p.likes || 0}
                        </span>
                        <span class="post_stat" data-action="comment" data-id="${p.id}">
                            💬 ${p.commentCount || 0} 评论
                        </span>
                        ${currentUser && currentUser.username === p.username ? `<span class="post_delete_btn" data-action="delete" data-id="${p.id}">删除</span>` : ''}
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
                if (e.target.closest('[data-action="like"]') || e.target.closest('[data-action="delete"]')) return;
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
                    allPosts = allPosts.filter(p => p.id !== postId);
                    renderPostList(allPosts);
                    document.getElementById('post_modal').classList.remove('show');
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
                    if (result.data.liked) {
                        btn.classList.add('liked');
                        if (post) { post.likes = (post.likes || 0) + 1; post.liked = true; }
                    } else {
                        btn.classList.remove('liked');
                        if (post) { post.likes = Math.max(0, (post.likes || 0) - 1); post.liked = false; }
                    }
                    btn.innerHTML = `♥ ${post ? post.likes : 0}`;
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

        const modal = document.getElementById('post_modal');
        const content = document.getElementById('modal_post_content');

        const isPostOwner = currentUser && currentUser.username === post.username;

        content.innerHTML = `
            <div class="post_card_header" style="margin-bottom:14px;">
                <img class="post_avatar" src="${post.avatar || 'images/ui/default_avatar.svg'}" alt="${post.username}">
                <span class="post_username">${escapeHtml(post.username)}</span>
                <span class="post_time">${post.time}</span>
            </div>
            <h2>${escapeHtml(post.title)}</h2>
            <div class="post_full_body">${escapeHtml(post.content)}</div>
            ${post.image ? `<img src="${post.image}" style="max-width:100%;border-radius:8px;margin-bottom:16px;" alt="帖子图片">` : ''}
            ${isPostOwner ? `<div style="text-align:right;margin-bottom:16px;"><button class="modal_post_delete" id="modal_delete_post">删除帖子</button></div>` : ''}
            <div class="comments_section">
                <p class="comments_title">评论 (${comments.length})</p>
                <div class="comments_list" id="comments_list">
                    ${comments.length > 0 ? comments.map(c => {
                        const isCommentOwner = currentUser && currentUser.username === c.username;
                        return `
                        <div class="comment_item">
                            <div class="comment_header">
                                <span class="comment_user">${escapeHtml(c.username)}</span>
                                <span class="comment_time">${c.time}</span>
                                ${isCommentOwner ? `<span class="comment_delete_btn" data-comment-id="${c.id}">删除</span>` : ''}
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
                    allPosts = allPosts.filter(p => p.id !== post.id);
                    renderPostList(allPosts);
                    modal.classList.remove('show');
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
                                <span class="comment_user">${currentUser.username}</span>
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

    document.getElementById('cancel_post').addEventListener('click', () => {
        document.getElementById('post_editor').style.display = 'none';
        document.getElementById('post_error').textContent = '';
    });

    document.getElementById('submit_post').addEventListener('click', async () => {
        const title = document.getElementById('post_title').value.trim();
        const content = document.getElementById('post_content').value.trim();
        const errorEl = document.getElementById('post_error');

        if (!title) { errorEl.textContent = '请输入标题'; return; }
        if (!content) { errorEl.textContent = '请输入内容'; return; }

        /* 处理图片（base64 预览） */
        let imageData = '';
        const fileInput = document.getElementById('post_image');
        if (fileInput.files && fileInput.files[0]) {
            imageData = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = () => resolve('');
                reader.readAsDataURL(fileInput.files[0]);
            });
        }

        const result = await API.createPost(title, content, imageData);
        if (result.success) {
            document.getElementById('post_editor').style.display = 'none';
            document.getElementById('post_title').value = '';
            document.getElementById('post_content').value = '';
            document.getElementById('post_image').value = '';
            document.getElementById('post_error').textContent = '';
            document.getElementById('post_image_preview').style.display = 'none';
            /* 新帖子插入到列表最前面 */
            allPosts.unshift(result.data);
            renderPostList(allPosts);
        } else {
            errorEl.textContent = '发布失败，请稍后再试';
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

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    /* 初始化 */
    loadPosts();
});
