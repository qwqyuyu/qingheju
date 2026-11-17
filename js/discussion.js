/* ==========================================
   discussion.js — 分享讨论区交互逻辑
   功能：发帖、评论、点赞、帖子详情弹窗
   ========================================== */

document.addEventListener('DOMContentLoaded', async () => {

    const postList = document.getElementById('post_list');
    const loadMoreWrap = document.getElementById('load_more_wrap');
    const loadMoreBtn = document.getElementById('load_more_btn');
    const loadMoreHint = document.getElementById('load_more_hint');
    const postEditor = document.getElementById('post_editor');
    const postError = document.getElementById('post_error');
    const imageInput = document.getElementById('post_image');
    const imagePreview = document.getElementById('post_image_preview');
    const imageError = document.getElementById('post_image_error');
    const imageStatus = document.getElementById('post_image_status');
    const removeImageBtn = document.getElementById('remove_post_image');
    const submitPostBtn = document.getElementById('submit_post');
    const modal = document.getElementById('post_modal');
    const modalDialog = modal.querySelector('[role="dialog"]');
    const modalContent = document.getElementById('modal_post_content');
    const modalCloseBtn = document.getElementById('modal_post_close');

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

    function canDelete(authorName) {
        return !!currentUser && (!!currentUser.is_admin || currentUser.username === authorName);
    }

    function escapeHtml(text) {
        return UI.escapeHtml(text == null ? '' : String(text));
    }

    function errorMessage(result, fallback) {
        return (result && (result.message || result.msg)) || fallback;
    }

    let allPosts = [];
    let currentPage = 0;
    let totalPosts = 0;
    let loadingPosts = false;
    let postsRequestToken = 0;
    let reloadAfterPending = false;
    let loadMoreError = '';
    const PAGE_SIZE = 10;

    /* 点赞按帖子串行：请求期间忽略重复点击，并保存乐观更新前的快照。 */
    const likePending = new Map();
    const likeConfirmed = new Map();
    const likeVersions = new Map();

    /* 详情 token 防止 A/B 快速切换串位；评论另有每帖版本，防止旧列表覆盖新评论。 */
    let detailToken = 0;
    let activePostId = null;
    let activePost = null;
    let releaseModalFocus = null;
    const commentsCache = new Map();
    const commentRequestVersions = new Map();
    const commentPending = new Set();

    function findPost(postId) {
        return allPosts.find(p => Number(p.id) === Number(postId));
    }

    function mergeLikeState(post) {
        const id = Number(post.id);
        const pending = likePending.get(id);
        const confirmed = likeConfirmed.get(id);
        if (confirmed) {
            post.liked = confirmed.liked;
            post.likes = confirmed.likes;
        }
        if (pending) {
            post.liked = pending.optimistic.liked;
            post.likes = pending.optimistic.likes;
        }
        return post;
    }

    function likeButtonContent(post) {
        const liked = !!post.liked;
        const likes = Number(post.likes) || 0;
        const heart = UI.icon('heart', 17, { fill: liked });
        return `<span class="like_icon">${heart}</span>` +
            `<span class="like_text">${liked ? '已赞' : '点赞'}</span>` +
            `<span class="like_count">${likes}</span>`;
    }

    function commentIcon() {
        return '<span class="post_stat_icon">' + UI.icon('comment', 17) + '</span>';
    }

    function updateLikeModel(postId, state) {
        const post = findPost(postId);
        if (post) {
            post.liked = state.liked;
            post.likes = state.likes;
        }
        if (activePost && Number(activePost.id) === Number(postId)) {
            activePost.liked = state.liked;
            activePost.likes = state.likes;
        }
    }

    function syncLikeButtons(postId) {
        const post = findPost(postId) || (activePost && Number(activePost.id) === Number(postId) ? activePost : null);
        if (!post) return;
        const pending = likePending.get(Number(postId));
        document.querySelectorAll(`[data-action="like"][data-id="${Number(postId)}"]`).forEach(btn => {
            const liked = !!post.liked;
            const likes = Number(post.likes) || 0;
            btn.classList.toggle('liked', liked);
            btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
            btn.setAttribute('aria-label', `${liked ? '已点赞，点击取消' : '点赞'}，当前 ${likes} 个赞`);
            if (pending) {
                btn.disabled = true;
                btn.classList.add('is_busy');
                btn.setAttribute('aria-busy', 'true');
                /* UI.run 正在管理的按钮保留其原始标签快照，其它重渲染按钮直接同步。 */
                if (!btn.dataset.uiLabel) {
                    btn.innerHTML = `<span class="btn_spinner" aria-hidden="true"></span><span>${pending.optimistic.liked ? '点赞中…' : '取消中…'}</span>`;
                }
            } else {
                btn.disabled = false;
                btn.classList.remove('is_busy');
                btn.removeAttribute('aria-busy');
                btn.innerHTML = likeButtonContent(post);
            }
        });
    }

    function syncCommentCount(postId) {
        const post = findPost(postId) || (activePost && Number(activePost.id) === Number(postId) ? activePost : null);
        if (!post) return;
        const count = Math.max(0, Number(post.commentCount) || 0);
        document.querySelectorAll(`[data-action="comment"][data-id="${Number(postId)}"]`).forEach(btn => {
            btn.innerHTML = `${commentIcon()}<span>${count} 评论</span>`;
            btn.setAttribute('aria-label', `查看 ${count} 条评论`);
        });
        if (Number(activePostId) === Number(postId)) {
            const title = document.getElementById('comments_title');
            if (title) title.textContent = `评论 (${count})`;
        }
    }

    function setCommentCount(postId, count) {
        const next = Math.max(0, Number(count) || 0);
        const post = findPost(postId);
        if (post) post.commentCount = next;
        if (activePost && Number(activePost.id) === Number(postId)) activePost.commentCount = next;
        syncCommentCount(postId);
    }

    function updateLoadMore() {
        const hasMore = allPosts.length < totalPosts;
        loadMoreWrap.style.display = hasMore ? 'block' : 'none';
        loadMoreHint.textContent = loadMoreError || `已显示 ${allPosts.length} / 共 ${totalPosts} 条`;
        loadMoreHint.classList.toggle('is_error', !!loadMoreError);
    }

    function renderPostList(posts) {
        if (!posts || posts.length === 0) {
            postList.innerHTML = UI.stateHTML('empty', {
                text: '暂无讨论，快来发布第一条帖子吧！',
                hint: '分享养生心得，从第一条帖子开始。',
                actionText: '发布新帖'
            });
            return;
        }

        postList.innerHTML = posts.map(p => {
            const id = Number(p.id);
            const pending = likePending.get(id);
            const liked = !!p.liked;
            const likes = Number(p.likes) || 0;
            const comments = Number(p.commentCount) || 0;
            const likeLabel = pending
                ? `<span class="btn_spinner" aria-hidden="true"></span><span>${pending.optimistic.liked ? '点赞中…' : '取消中…'}</span>`
                : likeButtonContent(p);
            return `
                <article class="post_card card_interactive${p.featured ? ' featured' : ''}" data-id="${id}">
                    <div class="post_card_header">
                        <img class="post_avatar" src="${escapeHtml(p.avatar || '/images/ui/default_avatar.svg')}" alt="${escapeHtml(p.username)}的头像" onerror="this.style.background='#D8CFBF'">
                        <span class="post_username">${escapeHtml(p.username)}</span>
                        <span class="post_time">${escapeHtml(p.time)}</span>
                    </div>
                    <h3 class="post_title">
                        ${p.featured ? '<span class="post_featured_badge">精选</span>' : ''}<a class="post_title_link" href="#post-${id}" data-action="open" data-id="${id}" aria-label="查看帖子：${escapeHtml(p.title)}">${escapeHtml(p.title)}</a>
                    </h3>
                    <p class="post_content_preview">${escapeHtml(String(p.preview || p.content || '').substring(0, 150))}</p>
                    ${p.image ? `<div class="post_thumb_wrap"><img class="post_thumb_img" src="${escapeHtml(p.image)}" alt="帖子图片" loading="lazy"></div>` : ''}
                    <div class="post_card_footer">
                        <button type="button" class="post_stat post_like_btn${liked ? ' liked' : ''}${pending ? ' is_busy' : ''}" data-action="like" data-id="${id}" aria-pressed="${liked ? 'true' : 'false'}" aria-label="${liked ? '已点赞，点击取消' : '点赞'}，当前 ${likes} 个赞"${pending ? ' disabled aria-busy="true"' : ''}>${likeLabel}</button>
                        <button type="button" class="post_stat" data-action="comment" data-id="${id}" aria-label="查看 ${comments} 条评论">${commentIcon()}<span>${comments} 评论</span></button>
                        ${currentUser && currentUser.is_admin ? `<button type="button" class="post_feature_btn" data-action="feature" data-id="${id}" data-featured="${p.featured ? 1 : 0}">${p.featured ? '取消精选' : '设为精选'}</button>` : ''}
                        ${canDelete(p.username) ? `<button type="button" class="post_delete_btn" data-action="delete" data-id="${id}">删除</button>` : ''}
                    </div>
                </article>
            `;
        }).join('');
    }

    /* 加载帖子（reset=true 重新从第一页加载）；失败时保留已有列表。 */
    async function loadPosts(reset) {
        if (loadingPosts) {
            if (reset) reloadAfterPending = true;
            return;
        }
        loadingPosts = true;
        const requestToken = ++postsRequestToken;
        const page = reset ? 1 : currentPage + 1;
        loadMoreError = '';
        postList.setAttribute('aria-busy', 'true');

        if (reset) {
            loadMoreWrap.style.display = 'none';
            if (allPosts.length === 0) {
                postList.innerHTML = UI.stateHTML('loading', { text: '正在加载帖子…' });
            } else {
                UI.announce('正在刷新帖子…');
            }
        } else {
            UI.busy(loadMoreBtn, true, '加载中…');
        }

        try {
            const result = await API.getPosts({ page, pageSize: PAGE_SIZE });
            if (requestToken !== postsRequestToken) return;
            if (!result || !result.success || !result.data) {
                throw new Error(errorMessage(result, '帖子加载失败，请稍后重试'));
            }
            const items = (result.data.items || []).map(mergeLikeState);
            allPosts = reset ? items : allPosts.concat(items);
            currentPage = page;
            totalPosts = Number(result.data.total) || 0;
            renderPostList(allPosts);
        } catch (error) {
            if (requestToken !== postsRequestToken) return;
            const message = error.message || '帖子加载失败，请稍后重试';
            if (allPosts.length === 0) {
                postList.innerHTML = UI.stateHTML('error', {
                    text: message,
                    hint: '请检查网络连接后重试。',
                    actionText: '重试'
                });
            } else {
                renderPostList(allPosts);
                loadMoreError = reset ? '刷新失败，可再次操作刷新' : '加载失败，请再次点击“加载更多”';
                UI.toast(message, 'error');
            }
        } finally {
            if (requestToken === postsRequestToken) {
                loadingPosts = false;
                postList.removeAttribute('aria-busy');
                UI.busy(loadMoreBtn, false);
                updateLoadMore();
                if (reloadAfterPending) {
                    reloadAfterPending = false;
                    loadPosts(true);
                }
            }
        }
    }

    function refreshPosts() {
        if (loadingPosts) {
            reloadAfterPending = true;
            return;
        }
        loadPosts(true);
    }

    async function handleLike(btn) {
        const postId = Number(btn.dataset.id);
        if (likePending.has(postId)) return;
        const post = findPost(postId);
        if (!post) return;
        if (!currentUser) {
            UI.toast('请先登录后再点赞', 'info');
            window.location.href = 'login.html?redirect=discussion.html';
            return;
        }

        const previous = { liked: !!post.liked, likes: Math.max(0, Number(post.likes) || 0) };
        const optimistic = {
            liked: !previous.liked,
            likes: Math.max(0, previous.likes + (previous.liked ? -1 : 1))
        };
        const version = (likeVersions.get(postId) || 0) + 1;
        likeVersions.set(postId, version);

        await UI.run(btn, async () => {
            likePending.set(postId, { version, previous, optimistic });
            updateLikeModel(postId, optimistic);
            syncLikeButtons(postId);
            try {
                const result = await API.likePost(postId);
                if (likeVersions.get(postId) !== version) return;
                if (result && result.success && result.data) {
                    const confirmed = {
                        liked: !!result.data.liked,
                        likes: typeof result.data.likes === 'number'
                            ? result.data.likes
                            : (findPost(postId) ? findPost(postId).likes : optimistic.likes)
                    };
                    likeConfirmed.set(postId, confirmed);
                    updateLikeModel(postId, confirmed);
                } else {
                    updateLikeModel(postId, previous);
                    UI.toast(errorMessage(result, '点赞失败，已恢复原状态'), 'error');
                }
            } catch (error) {
                if (likeVersions.get(postId) === version) {
                    updateLikeModel(postId, previous);
                    UI.toast('网络错误，点赞已恢复原状态', 'error');
                }
            } finally {
                if (likeVersions.get(postId) === version) likePending.delete(postId);
            }
        }, optimistic.liked ? '点赞中…' : '取消中…');

        /* UI.busy 恢复的是点击前标签，这里再以最终模型覆盖，杜绝视觉回退。 */
        syncLikeButtons(postId);
    }

    async function deletePost(postId, btn) {
        if (!await confirmDestructive('确定要删除这篇帖子吗？删除后无法恢复。')) return;
        await UI.run(btn, async () => {
            try {
                const result = await API.deletePost(postId);
                if (result && result.success) {
                    if (Number(activePostId) === Number(postId)) closePostDetail();
                    allPosts = allPosts.filter(p => Number(p.id) !== Number(postId));
                    UI.toast('帖子已删除', 'success');
                    refreshPosts();
                } else {
                    UI.toast(errorMessage(result, '删除失败，请稍后再试'), 'error');
                }
            } catch (error) {
                UI.toast('网络错误，删除失败', 'error');
            }
        }, '删除中…');
    }

    async function setFeatured(btn) {
        const postId = Number(btn.dataset.id);
        const next = btn.dataset.featured !== '1';
        await UI.run(btn, async () => {
            try {
                const result = await API.setFeatured(postId, next);
                if (result && result.success) {
                    const post = findPost(postId);
                    if (post) post.featured = next;
                    UI.toast(next ? '已设为精选' : '已取消精选', 'success');
                    refreshPosts();
                } else {
                    UI.toast(errorMessage(result, '操作失败'), 'error');
                }
            } catch (error) {
                UI.toast('网络错误，操作失败', 'error');
            }
        }, next ? '精选中…' : '取消中…');
    }

    function openPostById(postId) {
        const post = findPost(postId);
        if (post) showPostDetail(post);
    }

    /* 列表事件委托：重渲染后无需重新绑定，也能跨按钮执行每帖锁。 */
    postList.addEventListener('click', (event) => {
        const actionBtn = event.target.closest('[data-action]');
        if (actionBtn) {
            const action = actionBtn.dataset.action;
            const postId = Number(actionBtn.dataset.id);
            if (action === 'open') {
                event.preventDefault();
                openPostById(postId);
            } else if (action === 'comment') {
                openPostById(postId);
            } else if (action === 'like') {
                handleLike(actionBtn);
            } else if (action === 'delete') {
                deletePost(postId, actionBtn);
            } else if (action === 'feature') {
                setFeatured(actionBtn);
            }
            return;
        }
        const card = event.target.closest('.post_card');
        if (card) openPostById(Number(card.dataset.id));
    });

    UI.bindRetry(postList, (event, btn) => {
        if (btn.closest('.state_empty')) openPostEditor();
        else loadPosts(true);
    });

    /* ============ 帖子详情：正文与评论独立加载、独立重试 ============ */

    function isCurrentDetail(postId, token) {
        return modal.classList.contains('show') && Number(activePostId) === Number(postId) && detailToken === token;
    }

    function renderModalShell(post) {
        const postId = Number(post.id);
        const commenting = commentPending.has(postId);
        modalContent.innerHTML = `
            <div class="post_card_header modal_author">
                <img class="post_avatar" src="${escapeHtml(post.avatar || '/images/ui/default_avatar.svg')}" alt="${escapeHtml(post.username)}的头像">
                <span class="post_username">${escapeHtml(post.username)}</span>
                <span class="post_time">${escapeHtml(post.time)}</span>
            </div>
            <h2 id="modal_post_title">${escapeHtml(post.title)}</h2>
            <div class="post_detail_body" id="post_detail_body">${UI.stateHTML('loading', { text: '正在加载正文…' })}</div>
            <div class="post_detail_image_wrap" id="post_detail_image"></div>
            ${canDelete(post.username) ? `<div class="modal_post_actions"><button type="button" class="modal_post_delete" id="modal_delete_post" data-post-id="${postId}">删除帖子</button></div>` : ''}
            <section class="comments_section" aria-labelledby="comments_title">
                <p class="comments_title" id="comments_title">评论 (${Math.max(0, Number(post.commentCount) || 0)})</p>
                <div class="comments_list" id="comments_list" data-post-id="${postId}">${UI.stateHTML('loading', { text: '正在加载评论…' })}</div>
                ${currentUser ? `
                <div class="comment_input_area">
                    <label class="visually-hidden" for="comment_input">评论内容</label>
                    <input type="text" id="comment_input" class="form_input" placeholder="写下你的评论..." maxlength="500" aria-describedby="comment_error">
                    <button type="button" class="btn btn_primary${commenting ? ' is_busy' : ''}" id="submit_comment" data-post-id="${postId}"${commenting ? ' disabled aria-busy="true"' : ''}>${commenting ? '<span class="btn_spinner" aria-hidden="true"></span><span>评论中…</span>' : '发送'}</button>
                </div>
                <p class="form_field_error" id="comment_error" role="alert"></p>
                ` : '<p class="comment_login_hint">请<a href="login.html?redirect=discussion.html">登录</a>后发表评论</p>'}
            </section>
        `;
    }

    function showPostDetail(post) {
        const postId = Number(post.id);
        const token = ++detailToken;
        activePostId = postId;
        activePost = post;
        const alreadyOpen = modal.classList.contains('show');

        /* 先渲染当前帖子的独立容器，再发请求；旧响应只能按 token + ID 回写。 */
        renderModalShell(post);
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal_open');
        if (!alreadyOpen) {
            releaseModalFocus = UI.trapFocus(modalDialog, {
                onEscape: closePostDetail,
                initialFocus: modalCloseBtn
            });
        }

        loadPostBody(postId, token);
        loadComments(postId, token);
    }

    function closePostDetail() {
        if (!modal.classList.contains('show')) return;
        ++detailToken;
        activePostId = null;
        activePost = null;
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal_open');
        if (releaseModalFocus) {
            releaseModalFocus();
            releaseModalFocus = null;
        }
    }

    async function loadPostBody(postId, token) {
        if (!isCurrentDetail(postId, token)) return;
        const body = document.getElementById('post_detail_body');
        const imageWrap = document.getElementById('post_detail_image');
        body.setAttribute('aria-busy', 'true');
        body.innerHTML = UI.stateHTML('loading', { text: '正在加载正文…' });
        imageWrap.innerHTML = '';
        try {
            const detail = await API.getPost(postId);
            if (!isCurrentDetail(postId, token)) return;
            if (!detail || !detail.success || !detail.data || Number(detail.data.id) !== Number(postId)) {
                throw new Error(errorMessage(detail, '正文加载失败，请重试'));
            }
            const data = detail.data;
            body.innerHTML = `<div class="post_full_body">${escapeHtml(data.content || '')}</div>`;
            imageWrap.innerHTML = data.image
                ? `<img class="post_detail_image" src="${escapeHtml(data.image)}" alt="帖子原图">`
                : '';
            const listPost = findPost(postId);
            if (listPost) {
                listPost.content = data.content || '';
                /* 列表模型继续保存缩略图，原图只用于当前详情区域。 */
                listPost.fullImage = data.image || '';
            }
            if (activePost && Number(activePost.id) === Number(postId)) {
                activePost.content = data.content || '';
                activePost.fullImage = data.image || '';
            }
        } catch (error) {
            if (!isCurrentDetail(postId, token)) return;
            body.innerHTML = UI.stateHTML('error', {
                text: error.message || '正文加载失败，请重试',
                hint: '评论区域不受影响，可继续查看或发表评论。',
                actionText: '重试正文'
            });
            imageWrap.innerHTML = '';
        } finally {
            if (isCurrentDetail(postId, token)) body.removeAttribute('aria-busy');
        }
    }

    function renderComments(postId, comments) {
        if (Number(activePostId) !== Number(postId)) return;
        const list = document.getElementById('comments_list');
        if (!list || Number(list.dataset.postId) !== Number(postId)) return;
        if (!comments.length) {
            list.innerHTML = UI.stateHTML('empty', {
                text: '暂无评论',
                hint: '来说两句吧。'
            });
        } else {
            list.innerHTML = comments.map(c => `
                <article class="comment_item" data-comment-id="${Number(c.id)}">
                    <div class="comment_header">
                        <span class="comment_user">${escapeHtml(c.username)}</span>
                        <span class="comment_time">${escapeHtml(c.time)}</span>
                        ${canDelete(c.username) ? `<button type="button" class="comment_delete_btn" data-comment-id="${Number(c.id)}" aria-label="删除这条评论">删除</button>` : ''}
                    </div>
                    <p class="comment_content">${escapeHtml(c.content)}</p>
                </article>
            `).join('');
        }
        setCommentCount(postId, comments.length);
    }

    async function loadComments(postId, token) {
        if (!isCurrentDetail(postId, token)) return;
        const version = (commentRequestVersions.get(postId) || 0) + 1;
        commentRequestVersions.set(postId, version);
        const list = document.getElementById('comments_list');
        if (!list || Number(list.dataset.postId) !== Number(postId)) return;
        list.setAttribute('aria-busy', 'true');
        list.innerHTML = UI.stateHTML('loading', { text: '正在加载评论…' });
        try {
            const result = await API.getComments(postId);
            if (commentRequestVersions.get(postId) !== version) return;
            if (!result || !result.success || !Array.isArray(result.data)) {
                throw new Error(errorMessage(result, '评论加载失败，请重试'));
            }
            commentsCache.set(postId, result.data.slice());
            if (!isCurrentDetail(postId, token)) return;
            renderComments(postId, result.data);
        } catch (error) {
            if (commentRequestVersions.get(postId) !== version || !isCurrentDetail(postId, token)) return;
            list.innerHTML = UI.stateHTML('error', {
                text: error.message || '评论加载失败，请重试',
                hint: '正文仍可阅读，评论输入会在重试成功后保留。',
                actionText: '重试评论'
            });
        } finally {
            if (commentRequestVersions.get(postId) === version && isCurrentDetail(postId, token)) {
                list.removeAttribute('aria-busy');
            }
        }
    }

    function invalidateCommentRequests(postId) {
        commentRequestVersions.set(postId, (commentRequestVersions.get(postId) || 0) + 1);
    }

    function syncCommentComposer(postId) {
        if (Number(activePostId) !== Number(postId)) return;
        const btn = document.getElementById('submit_comment');
        if (!btn || Number(btn.dataset.postId) !== Number(postId)) return;
        const pending = commentPending.has(postId);
        btn.disabled = pending;
        btn.classList.toggle('is_busy', pending);
        if (pending) {
            btn.setAttribute('aria-busy', 'true');
            btn.innerHTML = '<span class="btn_spinner" aria-hidden="true"></span><span>评论中…</span>';
        } else {
            btn.removeAttribute('aria-busy');
            btn.innerHTML = '发送';
        }
    }

    async function submitComment() {
        const btn = document.getElementById('submit_comment');
        const input = document.getElementById('comment_input');
        if (!btn || !input) return;
        const postId = Number(btn.dataset.postId);
        if (Number(activePostId) !== Number(postId) || commentPending.has(postId)) return;
        const rawValue = input.value;
        const text = rawValue.trim();
        const errorEl = document.getElementById('comment_error');
        if (!text) {
            errorEl.textContent = '请输入评论内容';
            input.focus();
            return;
        }
        errorEl.textContent = '';
        commentPending.add(postId);
        try {
            await UI.run(btn, async () => {
                try {
                    const result = await API.addComment(postId, text);
                    if (!result || !result.success) {
                        const message = errorMessage(result, '评论失败，请稍后再试');
                        if (Number(activePostId) === Number(postId) && document.getElementById('comment_error')) {
                            document.getElementById('comment_error').textContent = message;
                        }
                        UI.toast(message, 'error');
                        return;
                    }

                    invalidateCommentRequests(postId);
                    const saved = result.data || { id: Date.now(), username: currentUser.username, content: text, time: '刚刚' };
                    if (commentsCache.has(postId)) {
                        const next = commentsCache.get(postId).slice();
                        if (!next.some(c => Number(c.id) === Number(saved.id))) next.push(saved);
                        commentsCache.set(postId, next);
                        setCommentCount(postId, next.length);
                        if (isCurrentDetail(postId, detailToken)) renderComments(postId, next);
                    } else {
                        const post = findPost(postId) || activePost;
                        setCommentCount(postId, Math.max(0, Number(post && post.commentCount) || 0) + 1);
                        if (isCurrentDetail(postId, detailToken)) loadComments(postId, detailToken);
                    }

                    /* 请求期间若用户继续输入，只清空已提交的原文，保留后续输入。 */
                    if (input.value === rawValue) input.value = '';
                    if (Number(activePostId) === Number(postId) && document.getElementById('comment_error')) {
                        document.getElementById('comment_error').textContent = '';
                    }
                    UI.toast('评论已发布', 'success');
                } catch (error) {
                    if (Number(activePostId) === Number(postId) && document.getElementById('comment_error')) {
                        document.getElementById('comment_error').textContent = '网络错误，评论内容已保留，请重试';
                    }
                    UI.toast('网络错误，评论内容已保留', 'error');
                }
            }, '评论中…');
        } finally {
            commentPending.delete(postId);
            syncCommentComposer(postId);
        }
    }

    async function deleteComment(btn) {
        const commentId = Number(btn.dataset.commentId);
        const list = document.getElementById('comments_list');
        if (!list) return;
        const postId = Number(list.dataset.postId);
        if (!await confirmDestructive('确定要删除这条评论吗？删除后无法恢复。')) return;
        await UI.run(btn, async () => {
            try {
                const result = await API.deleteComment(postId, commentId);
                if (!result || !result.success) {
                    UI.toast(errorMessage(result, '删除失败，请稍后再试'), 'error');
                    return;
                }
                invalidateCommentRequests(postId);
                if (commentsCache.has(postId)) {
                    const next = commentsCache.get(postId).filter(c => Number(c.id) !== commentId);
                    commentsCache.set(postId, next);
                    setCommentCount(postId, next.length);
                    if (Number(activePostId) === Number(postId)) renderComments(postId, next);
                } else {
                    const post = findPost(postId) || activePost;
                    setCommentCount(postId, Math.max(0, (Number(post && post.commentCount) || 0) - 1));
                    if (Number(activePostId) === Number(postId)) loadComments(postId, detailToken);
                }
                UI.toast('评论已删除', 'success');
            } catch (error) {
                UI.toast('网络错误，删除失败', 'error');
            }
        }, '删除中…');
    }

    UI.bindRetry(modalContent, (event, btn) => {
        const postId = Number(activePostId);
        const token = detailToken;
        if (!postId) return;
        if (btn.closest('#post_detail_body')) loadPostBody(postId, token);
        else if (btn.closest('#comments_list')) loadComments(postId, token);
    });

    modalContent.addEventListener('click', (event) => {
        const commentDelete = event.target.closest('.comment_delete_btn');
        if (commentDelete) {
            deleteComment(commentDelete);
            return;
        }
        if (event.target.closest('#submit_comment')) {
            submitComment();
            return;
        }
        const postDelete = event.target.closest('#modal_delete_post');
        if (postDelete) deletePost(Number(postDelete.dataset.postId), postDelete);
    });

    modalContent.addEventListener('keydown', (event) => {
        if (event.target.id !== 'comment_input' || event.key !== 'Enter') return;
        if (UI.isComposing(event)) return;
        event.preventDefault();
        submitComment();
    });

    modalContent.addEventListener('input', (event) => {
        if (event.target.id === 'comment_input') {
            const errorEl = document.getElementById('comment_error');
            if (errorEl) errorEl.textContent = '';
        }
    });

    modalCloseBtn.addEventListener('click', closePostDetail);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) closePostDetail();
    });

    /* 避免详情与确认弹窗的两个焦点陷阱同时响应 Esc/Tab。 */
    async function confirmDestructive(message) {
        const modalWasOpen = modal.classList.contains('show');
        if (modalWasOpen && releaseModalFocus) {
            releaseModalFocus();
            releaseModalFocus = null;
        }
        const confirmed = await showConfirm(message);
        if (modalWasOpen && modal.classList.contains('show')) {
            releaseModalFocus = UI.trapFocus(modalDialog, {
                onEscape: closePostDetail,
                initialFocus: modalCloseBtn
            });
        }
        return confirmed;
    }

    /* ============ 发帖与文本草稿 ============ */

    function openPostEditor() {
        if (!currentUser) {
            UI.toast('请先登录后再发帖', 'info');
            window.location.href = 'login.html?redirect=discussion.html';
            return;
        }
        postEditor.style.display = 'block';
        const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        postEditor.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
        document.getElementById('post_title').focus({ preventScroll: true });
    }

    document.getElementById('new_post_btn').addEventListener('click', openPostEditor);

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

    document.getElementById('post_title').addEventListener('input', event => {
        event.target.removeAttribute('aria-invalid');
        postError.textContent = '';
        scheduleSaveDraft();
    });
    document.getElementById('post_content').addEventListener('input', event => {
        event.target.removeAttribute('aria-invalid');
        postError.textContent = '';
        scheduleSaveDraft();
    });

    (function restoreDraft() {
        if (!currentUser) return;
        const draft = readDraft();
        if (!draft) return;
        document.getElementById('post_title').value = draft.title;
        document.getElementById('post_content').value = draft.content;
        postEditor.style.display = 'block';
    })();

    document.getElementById('cancel_post').addEventListener('click', () => {
        /* 取消只收起编辑器，文本草稿与已选图片都保留。 */
        postEditor.style.display = 'none';
        postError.textContent = '';
    });

    /* ============ 图片选择：校验、读取状态、明确移除 ============ */

    let imageReadToken = 0;
    let imageState = { status: 'idle', file: null, dataUrl: '', thumbData: '' };

    function clearImagePreview() {
        imagePreview.style.display = 'none';
        imagePreview.removeAttribute('src');
    }

    function updateImageControls() {
        removeImageBtn.hidden = imageState.status === 'idle';
        submitPostBtn.disabled = imageState.status === 'reading' || submitPostBtn.classList.contains('is_busy');
    }

    function resetImageSelection() {
        ++imageReadToken;
        imageState = { status: 'idle', file: null, dataUrl: '', thumbData: '' };
        imageInput.value = '';
        imageError.textContent = '';
        imageStatus.textContent = '';
        clearImagePreview();
        updateImageControls();
    }

    imageInput.addEventListener('change', async event => {
        const file = event.target.files && event.target.files[0];
        if (!file) return; /* 取消文件选择器不清空之前已选图片 */
        const token = ++imageReadToken;
        imageError.textContent = '';
        imageStatus.textContent = '';
        clearImagePreview();

        const validation = UI.validateImageFile(file);
        if (!validation.ok) {
            imageState = { status: 'error', file, dataUrl: '', thumbData: '' };
            imageError.textContent = `${validation.message}。请重新选择，或点击“移除图片”后再按无图发布。`;
            UI.toast(validation.message, 'error');
            updateImageControls();
            return;
        }

        imageState = { status: 'reading', file, dataUrl: '', thumbData: '' };
        imageStatus.textContent = `正在读取图片：${file.name}`;
        updateImageControls();
        try {
            const dataUrl = await UI.readImageFile(file);
            if (token !== imageReadToken) return;
            if (typeof dataUrl !== 'string' || !dataUrl) throw new Error('图片读取失败，请重新选择');
            imageState = { status: 'ready', file, dataUrl, thumbData: '' };
            imagePreview.src = dataUrl;
            imagePreview.style.display = 'block';
            imageStatus.textContent = `已选择：${file.name}，发布时将包含此图片。`;
        } catch (error) {
            if (token !== imageReadToken) return;
            imageState = { status: 'error', file, dataUrl: '', thumbData: '' };
            clearImagePreview();
            imageStatus.textContent = '';
            imageError.textContent = '图片读取失败。请重新选择，或点击“移除图片”；未处理前不会发布为无图帖子。';
            UI.toast('图片读取失败，请重新选择或明确移除', 'error');
        } finally {
            if (token === imageReadToken) updateImageControls();
        }
    });

    removeImageBtn.addEventListener('click', () => {
        resetImageSelection();
        imageStatus.textContent = '已明确移除图片，本次发布将不带图片。';
        imageInput.focus();
    });

    function setPostEditorLocked(locked) {
        ['post_title', 'post_content', 'post_image', 'cancel_post', 'remove_post_image'].forEach(id => {
            document.getElementById(id).disabled = locked;
        });
    }

    submitPostBtn.addEventListener('click', async () => {
        const titleInput = document.getElementById('post_title');
        const contentInput = document.getElementById('post_content');
        const title = titleInput.value.trim();
        const content = contentInput.value.trim();
        postError.textContent = '';
        titleInput.removeAttribute('aria-invalid');
        contentInput.removeAttribute('aria-invalid');

        if (!title) {
            postError.textContent = '请输入标题';
            titleInput.setAttribute('aria-invalid', 'true');
            titleInput.focus();
            return;
        }
        if (!content) {
            postError.textContent = '请输入内容';
            contentInput.setAttribute('aria-invalid', 'true');
            contentInput.focus();
            return;
        }
        if (imageState.status === 'reading') {
            postError.textContent = '图片仍在读取，请稍候再发布';
            return;
        }
        if (imageState.status === 'error') {
            postError.textContent = '所选图片尚未成功读取，请重新选择或明确移除图片后再发布';
            imageInput.focus();
            return;
        }

        writeDraft(); /* 立即落一次草稿，发布失败也不受防抖影响。 */
        await UI.run(submitPostBtn, async () => {
            setPostEditorLocked(true);
            try {
                let imageData = '';
                let thumbData = '';
                const snapshot = imageState;
                if (snapshot.status === 'ready') {
                    const validation = UI.validateImageFile(snapshot.file);
                    if (!validation.ok) {
                        imageError.textContent = `${validation.message}，请重新选择或移除图片`;
                        return;
                    }
                    imageData = snapshot.dataUrl;
                    if (!imageData) {
                        imageError.textContent = '图片数据不可用，请重新选择或明确移除图片';
                        return;
                    }
                    try {
                        thumbData = snapshot.thumbData || await makePostThumb(snapshot.file);
                        snapshot.thumbData = thumbData;
                    } catch (error) {
                        imageError.textContent = '缩略图生成失败，请重新选择图片，或明确移除后再发布';
                        UI.toast('图片处理失败，未提交帖子', 'error');
                        return;
                    }
                }

                const result = await API.createPost(title, content, imageData, thumbData);
                if (result && result.success) {
                    clearDraft();
                    postEditor.style.display = 'none';
                    titleInput.value = '';
                    contentInput.value = '';
                    postError.textContent = '';
                    resetImageSelection();
                    UI.toast('帖子发布成功', 'success');
                    refreshPosts();
                } else {
                    const message = result && result.needLogin
                        ? '登录已过期，请重新登录；标题、正文和草稿已保留'
                        : errorMessage(result, '发布失败，请稍后再试；标题、正文、图片和草稿已保留');
                    postError.textContent = message;
                    UI.toast(message, 'error');
                }
            } catch (error) {
                postError.textContent = '网络错误，发布失败；标题、正文、图片和草稿已保留';
                UI.toast(postError.textContent, 'error');
            } finally {
                setPostEditorLocked(false);
            }
        }, '发布中…');
    });

    /* 列表缩略图：最长边 800px，原图保持不动。 */
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
                    if (!ctx) throw new Error('当前浏览器无法生成缩略图');
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

    loadMoreBtn.addEventListener('click', () => loadPosts(false));

    /* 初始化 */
    loadPosts(true);
});
