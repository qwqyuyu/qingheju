/* ==========================================
   constitution.js — 体质自测交互逻辑
   功能：小清AI智能问诊（接入阿里云AI）
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {

    /* 更新导航登录状态 */
    const user = API.getCurrentUser();
    if (user) {
        const navLink = document.getElementById('nav_user_link');
        if (navLink) { navLink.textContent = '我的'; navLink.href = 'profile.html'; }
    }

    /* ──────────────────────────────────────
       板块一：穴位图点击交互（动态定位）
       ────────────────────────────────────── */
    const viewport = document.getElementById('acupoint_viewport');
    const acupointImg = document.getElementById('acupoint_img');
    const acupointPanel = document.getElementById('acupoint_panel');

    /* 仅当穴位图元素存在时才初始化 */
    if (viewport && acupointImg && acupointPanel) {
    const placeholder = acupointPanel.querySelector('.acupoint_panel_placeholder');
    const infoDiv = document.getElementById('acupoint_info');

    /* 穴位在原始图片上的位置（百分比，相对于图片自身尺寸）
       正面人体位于图片左侧约 x:3%~38%，中线约 x:20.5%
       背面人体位于图片右侧约 x:63%~93%，中线约 x:78% */
    var POINT_POSITIONS = {
        /* ── 正面腧穴（前正中线 x≈20.5%）── */
        baihui:       { x: 20.5, y: 2.5 },   /* 督脉 · 头顶正中，两耳尖连线中点 */
        shanzhong:    { x: 20.5, y: 25.5 },  /* 任脉 · 胸部正中，平第4肋间（两乳头连线中点） */
        zhongwan:     { x: 20.5, y: 34 },    /* 任脉 · 上腹部正中，脐上4寸（胸剑联合与脐中点） */
        shenque:      { x: 20.5, y: 38.5 },  /* 任脉 · 肚脐正中 */
        /* ── 上肢腧穴 ── */
        hegu_l:       { x: 9, y: 48 },       /* 手阳明大肠经 · 左手第1、2掌骨之间 */
        hegu_r:       { x: 32, y: 48 },      /* 手阳明大肠经 · 右手第1、2掌骨之间 */
        /* ── 下肢腧穴 ── */
        zusanli_l:    { x: 14, y: 69 },      /* 足阳明胃经 · 左小腿外侧，犊鼻下3寸 */
        zusanli_r:    { x: 27, y: 69 },      /* 足阳明胃经 · 右小腿外侧，犊鼻下3寸 */
        sanyinjiao_l: { x: 15, y: 78 },      /* 足太阴脾经 · 左小腿内侧，内踝尖上3寸 */
        sanyinjiao_r: { x: 26, y: 78 },      /* 足太阴脾经 · 右小腿内侧，内踝尖上3寸 */
        /* ── 足底腧穴 ── */
        yongquan_l:   { x: 14, y: 94 },      /* 足少阴肾经 · 左足底前1/3凹陷处 */
        yongquan_r:   { x: 27, y: 94 },      /* 足少阴肾经 · 右足底前1/3凹陷处 */
        /* ── 背面腧穴（后正中线/肩背 x≈78%）── */
        fengchi:      { x: 78, y: 8.5 },     /* 足少阳胆经 · 后颈枕骨下，斜方肌与胸锁乳突肌之间 */
        jianshi:      { x: 78, y: 17.5 }     /* 足少阳胆经 · 大椎与肩峰连线中点 */
    };

    /* 图片加载完成后创建并定位穴位点 */
    function buildAcupointDots() {
        /* 清除旧标记 */
        viewport.querySelectorAll('.acupoint_dot').forEach(d => d.remove());

        const imgRect = acupointImg.getBoundingClientRect();
        const vpRect = viewport.getBoundingClientRect();
        const offsetX = imgRect.left - vpRect.left;
        const offsetY = imgRect.top - vpRect.top;
        const imgW = imgRect.width;
        const imgH = imgRect.height;

        Object.keys(POINT_POSITIONS).forEach(key => {
            const pos = POINT_POSITIONS[key];
            const leftPct = (offsetX + pos.x / 100 * imgW) / vpRect.width * 100;
            const topPct  = (offsetY + pos.y / 100 * imgH) / vpRect.height * 100;

            const dot = document.createElement('div');
            dot.className = 'acupoint_dot';
            dot.setAttribute('data-point', key);
            dot.title = ACUPOINTS[key] ? ACUPOINTS[key].name : key;
            dot.style.cssText = 'top:' + topPct + '%;left:' + leftPct + '%;';
            dot.innerHTML = '<span class="acupoint_dot_core"></span>';

            dot.addEventListener('click', (e) => {
                e.stopPropagation();
                const data = ACUPOINTS[key];
                if (!data) return;

                viewport.querySelectorAll('.acupoint_dot').forEach(d => d.classList.remove('active'));
                dot.classList.add('active');

                placeholder.style.display = 'none';
                infoDiv.style.display = 'block';
                document.getElementById('acupoint_name').textContent = data.name;
                document.getElementById('acupoint_meridian').textContent = '所属经络：' + data.meridian;
                document.getElementById('acupoint_location').textContent = '定位：' + data.location;
                document.getElementById('acupoint_effect').textContent = data.effect;
            });

            viewport.appendChild(dot);
        });
    }

    acupointImg.addEventListener('load', () => requestAnimationFrame(buildAcupointDots));

    var resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(buildAcupointDots, 150);
    });

    /* 如果图片已缓存，等布局完成再执行 */
    if (acupointImg.complete) {
        requestAnimationFrame(() => requestAnimationFrame(buildAcupointDots));
    }

    } /* end if viewport */

    /* ──────────────────────────────────────
       板块二：小清AI智能问诊（接入阿里云AI）
       ────────────────────────────────────── */
    const chatMessages = document.getElementById('chat_messages');
    const chatInput = document.getElementById('chat_input');
    const sendBtn = document.getElementById('chat_send_btn');

    /* 对话历史（保留上下文，不含 system prompt，由服务端注入） */
    var conversationHistory = [];
    var isWaiting = false;  /* 防止重复发送 */

    /* 初始化欢迎消息 */
    addMessage('assistant', '你好！我是小清，你的AI智能养生助手。\n\n你可以根据自身情况向我提出问题，比如：\n· 最近失眠多梦怎么办？\n· 胃胀不消化有什么办法？\n· 总感觉乏力没精神是什么原因？\n· 我是什么体质？\n\n温馨提示：AI建议仅供参考，不能替代专业医师诊断。如有健康问题请及时就医。');

    /* 发送按钮 */
    sendBtn.addEventListener('click', handleSend);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSend();
    });

    function handleSend() {
        if (isWaiting) return;
        const text = chatInput.value.trim();
        if (!text) return;

        /* 显示用户消息 */
        addMessage('user', text);
        chatInput.value = '';
        conversationHistory.push({ role: 'user', content: text });

        /* 显示AI思考动画 */
        showTyping();
        isWaiting = true;

        /* 调用后端 AI 接口 */
        API.aiChat(conversationHistory).then(function(result) {
            removeTyping();
            isWaiting = false;
            if (result && result.code === 200) {
                var reply = result.data.reply;
                conversationHistory.push({ role: 'assistant', content: reply });
                /* 控制上下文长度，最多保留最近10轮（20条） */
                if (conversationHistory.length > 20) {
                    conversationHistory = conversationHistory.slice(-20);
                }
                addMessage('assistant', reply);
            } else {
                addMessage('assistant', '抱歉，小清暂时无法回复，请稍后重试。');
            }
        }).catch(function(err) {
            removeTyping();
            isWaiting = false;
            console.error('AI 请求失败:', err);
            addMessage('assistant', '抱歉，网络出现问题，请稍后重试。');
        });
    }

    /* 添加消息 */
    function addMessage(type, text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat_msg ' + type;

        const avatarSrc = type === 'assistant'
            ? 'images/constitution/ai_avatar.png'
            : (user ? (user.avatar || 'images/ui/default_avatar.svg') : 'images/ui/default_avatar.svg');

        msgDiv.innerHTML = ''
            + '<img class="chat_msg_avatar" src="' + avatarSrc + '" alt="">'
            + '<div class="chat_msg_bubble">' + escapeAndLinkify(text) + '</div>';

        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    /* 显示输入中动画 */
    function showTyping() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'chat_msg assistant';
        typingDiv.id = 'typing_indicator';
        typingDiv.innerHTML = ''
            + '<img class="chat_msg_avatar" src="images/constitution/ai_avatar.png" alt="">'
            + '<div class="chat_typing"><span></span><span></span><span></span></div>';
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function removeTyping() {
        const el = document.getElementById('typing_indicator');
        if (el) el.remove();
    }

    function escapeAndLinkify(text) {
        return text
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');
    }
});
