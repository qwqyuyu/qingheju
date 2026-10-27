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
       小清AI智能问诊（接入阿里云AI）
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

        /* AI 接口需要登录，未登录时先提示 */
        if (!user) {
            addMessage('assistant', '使用小清 AI 问诊需要先登录。\n\n请点击右上角「登录」，或打开 login.html 登录后再来。');
            return;
        }

        /* 显示用户消息 */
        addMessage('user', text);
        chatInput.value = '';
        conversationHistory.push({ role: 'user', content: text });

        /* 显示AI思考动画 */
        showTyping();
        isWaiting = true;

        /* 流式调用：先占位一个 AI 气泡，收到片段就追加 */
        const replyEl = addMessage('assistant', '');
        let streamed = '';

        API.aiChatStream(conversationHistory, function (delta) {
            if (!streamed) removeTyping();
            streamed += delta;
            setMessageText(replyEl, streamed);
        }).then(function (result) {
            removeTyping();
            isWaiting = false;

            /* token 过期或未登录：提示后跳登录页 */
            if (result && result.needLogin) {
                setMessageText(replyEl, '登录已过期，请重新登录后再使用小清。');
                setTimeout(function () { location.href = 'login.html'; }, 1200);
                return;
            }

            if (!result || !result.success) {
                if (!streamed) {
                    setMessageText(replyEl, (result && result.msg)
                        ? result.msg
                        : '抱歉，小清暂时无法回复，请稍后重试。');
                } else if (result && result.msg) {
                    setMessageText(replyEl, streamed + '\n\n（' + result.msg + '）');
                }
                return;
            }

            var reply = (result.data && result.data.reply) || streamed;
            if (!reply) {
                setMessageText(replyEl, '抱歉，小清暂时无法回复，请稍后重试。');
                return;
            }
            if (!streamed) setMessageText(replyEl, reply);

            conversationHistory.push({ role: 'assistant', content: reply });
            /* 控制上下文长度：最多保留最近 15 条（服务端另有 80000 tokens 预算） */
            if (conversationHistory.length > 15) {
                conversationHistory = conversationHistory.slice(-15);
                if (conversationHistory[0].role === 'assistant') {
                    conversationHistory = conversationHistory.slice(1);
                }
            }
        }).catch(function (err) {
            removeTyping();
            isWaiting = false;
            console.error('AI 请求失败:', err);
            if (!streamed) {
                setMessageText(replyEl, '抱歉，网络出现问题，请稍后重试。');
            }
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
        return msgDiv;
    }

    /* 更新某个消息气泡的文字（流式输出用） */
    function setMessageText(msgDiv, text) {
        if (!msgDiv) return;
        const bubble = msgDiv.querySelector('.chat_msg_bubble');
        if (bubble) bubble.innerHTML = escapeAndLinkify(text || '');
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
