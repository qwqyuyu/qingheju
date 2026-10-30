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

    /* ──────────────────────────────────────
       会话持久化
       --------------------------------------
       之前对话只存在内存数组里，离开页面就全丢。
       这里按用户 id 存进 localStorage（服务端不落库），
       带版本号与 TTL，切换账号不会串。
       ────────────────────────────────────── */
    const CHAT_STORE_VERSION = 1;
    const CHAT_LOG_LIMIT = 60;            /* 本地最多保留的消息条数 */
    const CONTEXT_LIMIT = 15;             /* 单次请求最多带上的上下文条数 */
    const CHAT_STORE_TTL = 7 * 86400000;  /* 7 天没有新消息则自动清理 */

    const WELCOME_TEXT = '你好！我是小清，你的AI智能养生助手。\n\n你可以根据自身情况向我提出问题，比如：\n· 最近失眠多梦怎么办？\n· 胃胀不消化有什么办法？\n· 总感觉乏力没精神是什么原因？\n· 我是什么体质？\n\n温馨提示：AI建议仅供参考，不能替代专业医师诊断。如有健康问题请及时就医。';

    /* 极简 Markdown 用到的行匹配规则。
       必须放在「恢复历史对话」之前，否则首屏渲染时会撞上 const 的暂时性死区。 */
    const LIST_UNORDERED = /^\s*[-*·•]\s+(.*)$/;
    const LIST_ORDERED = /^\s*\d+[.、)]\s+(.*)$/;
    const HEADING = /^\s*#{1,6}\s+(.*)$/;

    /* 与界面一致的消息列表（含已超出上下文的旧消息），用于持久化 */
    var chatLog = [];
    var isWaiting = false;  /* 防止重复发送 */

    /* 会话存储键：按用户隔离；未登录时不持久化 */
    function chatStoreKey() {
        return (user && user.id) ? ('ai_chat_' + user.id) : '';
    }

    function loadChatLog() {
        const key = chatStoreKey();
        if (!key) return [];
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return [];
            const saved = JSON.parse(raw);
            if (!saved || saved.v !== CHAT_STORE_VERSION) { localStorage.removeItem(key); return []; }
            if (!saved.at || Date.now() - saved.at > CHAT_STORE_TTL) { localStorage.removeItem(key); return []; }
            if (!Array.isArray(saved.messages)) return [];
            return saved.messages.filter(function (m) {
                return m && (m.role === 'user' || m.role === 'assistant')
                    && typeof m.content === 'string' && m.content.trim();
            }).slice(-CHAT_LOG_LIMIT);
        } catch (e) {
            return [];
        }
    }

    function saveChatLog() {
        const key = chatStoreKey();
        if (!key) return;
        const payload = function (list) {
            return JSON.stringify({ v: CHAT_STORE_VERSION, at: Date.now(), messages: list });
        };
        try {
            localStorage.setItem(key, payload(chatLog));
        } catch (e) {
            /* 超出浏览器配额：丢掉一半最旧的消息再试一次，失败就放弃持久化，不影响聊天 */
            chatLog = chatLog.slice(-20);
            try { localStorage.setItem(key, payload(chatLog)); } catch (e2) {}
        }
    }

    function pushLog(message) {
        chatLog.push(message);
        if (chatLog.length > CHAT_LOG_LIMIT) chatLog = chatLog.slice(-CHAT_LOG_LIMIT);
    }

    /* 组装发给服务端的上下文：最近 N 条，且以 user 开头（服务端还会再裁一次） */
    function messagesForRequest() {
        const list = chatLog.slice(-CONTEXT_LIMIT);
        while (list.length > 1 && list[0].role !== 'user') list.shift();
        return list;
    }

    /* 恢复历史对话；没有历史时才显示欢迎语 */
    chatLog = loadChatLog();
    if (chatLog.length === 0) {
        addMessage('assistant', WELCOME_TEXT);
    } else {
        chatLog.forEach(function (m) { addMessage(m.role, m.content); });
    }

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

        /* 显示用户消息（先落盘，中途离开页面也不会丢这条提问） */
        addMessage('user', text);
        chatInput.value = '';
        pushLog({ role: 'user', content: text });
        saveChatLog();

        /* 显示AI思考动画 */
        showTyping();
        isWaiting = true;

        /* 流式调用：先占位一个 AI 气泡，收到片段就追加 */
        const replyEl = addMessage('assistant', '');
        let streamed = '';

        API.aiChatStream(messagesForRequest(), function (delta) {
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

            pushLog({ role: 'assistant', content: reply });
            saveChatLog();
        }).catch(function (err) {
            removeTyping();
            isWaiting = false;
            console.error('AI 请求失败:', err);
            if (!streamed) {
                setMessageText(replyEl, '抱歉，网络出现问题，请稍后重试。');
            }
        });
    }

    /* ──────────────────────────────────────
       消息渲染（极简 Markdown）
       --------------------------------------
       只还原 AI 回复里最常见的几种标记：
         **粗体**、- / · / * 无序列表、1. 有序列表、### 小标题
       关键顺序：先整体做 HTML 转义，再替换成我们自己生成的标签，
       所以模型输出任何内容都不可能变成可执行 HTML。
       用户消息不做 Markdown，原样显示。
       （行匹配规则定义在文件上方，避免首屏渲染命中 const 死区）
       ────────────────────────────────────── */
    function escapeHtml(text) {
        return String(text == null ? '' : text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    /* 行内只处理 **粗体**（入参已转义，里面不可能出现裸标签） */
    function renderInline(text) {
        return text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    }

    function renderMarkdown(text) {
        const lines = escapeHtml(text).split('\n');
        const html = [];
        let list = null;

        function closeList() {
            if (!list) return;
            html.push('<' + list.tag + '>' + list.items.join('') + '</' + list.tag + '>');
            list = null;
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) { closeList(); continue; }

            let m = LIST_UNORDERED.exec(line);
            let tag = 'ul';
            if (!m) { m = LIST_ORDERED.exec(line); tag = 'ol'; }
            if (m) {
                if (!list || list.tag !== tag) { closeList(); list = { tag: tag, items: [] }; }
                list.items.push('<li>' + renderInline(m[1]) + '</li>');
                continue;
            }

            closeList();
            const heading = HEADING.exec(line);
            if (heading) {
                html.push('<p><strong>' + renderInline(heading[1]) + '</strong></p>');
            } else {
                html.push('<p>' + renderInline(line) + '</p>');
            }
        }

        closeList();
        return html.join('');
    }

    /* 统一入口：AI 消息走 Markdown，用户消息保持纯文本（只转义 + 换行） */
    function formatMessage(text, withMarkdown) {
        if (!withMarkdown) return escapeHtml(text).replace(/\n/g, '<br>');
        return renderMarkdown(text);
    }

    /* 添加消息 */
    function addMessage(type, text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat_msg ' + type;

        const avatarSrc = type === 'assistant'
            ? '/images/constitution/ai_avatar.png'
            : (user ? (user.avatar || '/images/ui/default_avatar.svg') : '/images/ui/default_avatar.svg');

        msgDiv.innerHTML = ''
            + '<img class="chat_msg_avatar" src="' + avatarSrc + '" alt="">'
            + '<div class="chat_msg_bubble">' + formatMessage(text, type === 'assistant') + '</div>';

        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return msgDiv;
    }

    /* 更新某个消息气泡的文字（流式输出用） */
    function setMessageText(msgDiv, text) {
        if (!msgDiv) return;
        const bubble = msgDiv.querySelector('.chat_msg_bubble');
        const isAssistant = String(msgDiv.className || '').indexOf('assistant') >= 0;
        if (bubble) bubble.innerHTML = formatMessage(text || '', isAssistant);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    /* 显示输入中动画 */
    function showTyping() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'chat_msg assistant';
        typingDiv.id = 'typing_indicator';
        typingDiv.innerHTML = ''
            + '<img class="chat_msg_avatar" src="/images/constitution/ai_avatar.png" alt="">'
            + '<div class="chat_typing"><span></span><span></span><span></span></div>';
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function removeTyping() {
        const el = document.getElementById('typing_indicator');
        if (el) el.remove();
    }

    /* 供将来接入“清空对话”按钮使用 */
    window.clearAiChat = function () {
        const key = chatStoreKey();
        if (key) localStorage.removeItem(key);
        chatLog = [];
    };
});
