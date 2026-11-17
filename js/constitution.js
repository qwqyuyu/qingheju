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

    const chatMessages = document.getElementById('chat_messages');
    const chatInput = document.getElementById('chat_input');
    const sendBtn = document.getElementById('chat_send_btn');
    const stopBtn = document.getElementById('chat_stop_btn');
    const newReplyBtn = document.getElementById('chat_new_reply');
    const quickButtons = Array.prototype.slice.call(document.querySelectorAll('[data-quick-question]'));

    /* 会话持久化：沿用 ai_chat_<id>、版本号和七天 TTL。 */
    const CHAT_STORE_VERSION = 1;
    const CHAT_LOG_LIMIT = 60;
    const CONTEXT_LIMIT = 15;
    const CHAT_STORE_TTL = 7 * 86400000;
    const NEAR_BOTTOM_PX = 80;
    const RECOVERABLE_STATES = ['interrupted', 'stopped', 'error'];

    const WELCOME_TEXT = '你好！我是小清，你的AI智能养生助手。\n\n你可以根据自身情况向我提出问题，比如：\n· 最近失眠多梦怎么办？\n· 胃胀不消化有什么办法？\n· 总感觉乏力没精神是什么原因？\n· 我是什么体质？\n\n温馨提示：AI建议仅供参考，不能替代专业医师诊断。如有健康问题请及时就医。';

    const LIST_UNORDERED = /^\s*[-*·•]\s+(.*)$/;
    const LIST_ORDERED = /^\s*\d+[.、)]\s+(.*)$/;
    const HEADING = /^\s*#{1,6}\s+(.*)$/;

    var chatLog = [];
    var activeRequest = null;
    var requestSerial = 0;
    var isRestoring = false;

    function chatStoreKey() {
        return (user && user.id) ? ('ai_chat_' + user.id) : '';
    }

    function isRecoverable(message) {
        return !!(message && message.role === 'assistant'
            && RECOVERABLE_STATES.indexOf(message.status) >= 0);
    }

    /* 请求体只含 role/content；未完成回复不当作正常上下文再次提交。 */
    function requestMessagesFrom(list) {
        const clean = (Array.isArray(list) ? list : []).filter(function (m) {
            return m && (m.role === 'user' || m.role === 'assistant')
                && typeof m.content === 'string' && m.content.trim()
                && (m.role !== 'assistant' || !isRecoverable(m));
        }).map(function (m) {
            return { role: m.role, content: m.content };
        }).slice(-CONTEXT_LIMIT);
        while (clean.length > 1 && clean[0].role !== 'user') clean.shift();
        return clean;
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
                if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') return false;
                /* 空内容的失败气泡也可恢复，用户刷新后仍能按原上下文重试。 */
                return m.content.trim() || (m.role === 'assistant' && isRecoverable(m));
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
            chatLog = chatLog.slice(-20);
            try { localStorage.setItem(key, payload(chatLog)); } catch (e2) {}
        }
    }

    function pushLog(message) {
        chatLog.push(message);
        if (chatLog.length > CHAT_LOG_LIMIT) chatLog = chatLog.slice(-CHAT_LOG_LIMIT);
    }

    function messagesForRequest() {
        return requestMessagesFrom(chatLog);
    }

    /* ──────────────────────────────────────
       滚动：用户上翻时不抢滚动位置；仅贴近底部时跟随流式内容。
       ────────────────────────────────────── */
    function isNearBottom() {
        return chatMessages.scrollHeight - chatMessages.clientHeight - chatMessages.scrollTop <= NEAR_BOTTOM_PX;
    }

    function scrollToBottom(smooth) {
        const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (smooth && !reduceMotion && typeof chatMessages.scrollTo === 'function') {
            chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
        } else {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    function afterContentChange(stickToBottom, hasNewContent) {
        if (stickToBottom) {
            scrollToBottom(false);
        } else if (hasNewContent && newReplyBtn) {
            newReplyBtn.hidden = false;
        }
    }

    chatMessages.addEventListener('scroll', function () {
        if (isNearBottom() && newReplyBtn) newReplyBtn.hidden = true;
    });
    if (newReplyBtn) {
        newReplyBtn.addEventListener('click', function () {
            newReplyBtn.hidden = true;
            scrollToBottom(true);
        });
    }

    /* ──────────────────────────────────────
       消息渲染（极简 Markdown，先转义再生成有限标签）
       ────────────────────────────────────── */
    function escapeHtml(text) {
        return String(text == null ? '' : text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

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
            if (heading) html.push('<p><strong>' + renderInline(heading[1]) + '</strong></p>');
            else html.push('<p>' + renderInline(line) + '</p>');
        }

        closeList();
        return html.join('');
    }

    function formatMessage(text, withMarkdown) {
        if (!withMarkdown) return escapeHtml(text).replace(/\n/g, '<br>');
        return renderMarkdown(text);
    }

    function addMessage(type, text, options) {
        options = options || {};
        const stickToBottom = isRestoring || options.forceScroll || isNearBottom();
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat_msg ' + type;
        msgDiv._messageText = String(text == null ? '' : text);
        if (options.message) msgDiv._chatMessage = options.message;

        const avatar = document.createElement('img');
        avatar.className = 'chat_msg_avatar';
        avatar.alt = '';
        avatar.src = type === 'assistant'
            ? '/images/constitution/ai_avatar.png'
            : (user ? (user.avatar || '/images/ui/default_avatar.svg') : '/images/ui/default_avatar.svg');

        const bubble = document.createElement('div');
        bubble.className = 'chat_msg_bubble';
        const textEl = document.createElement('div');
        textEl.className = 'chat_msg_text';
        textEl.innerHTML = formatMessage(msgDiv._messageText, type === 'assistant');
        const feedback = document.createElement('div');
        feedback.className = 'chat_msg_feedback';
        feedback.setAttribute('aria-live', 'polite');
        bubble.appendChild(textEl);
        bubble.appendChild(feedback);
        msgDiv.appendChild(avatar);
        msgDiv.appendChild(bubble);
        chatMessages.appendChild(msgDiv);

        if (options.message && isRecoverable(options.message)) {
            setMessageState(msgDiv, options.message.status, options.message.reason || '这条回复可以重试。');
        }
        afterContentChange(stickToBottom, !!msgDiv._messageText);
        return msgDiv;
    }

    function setMessageText(msgDiv, text) {
        if (!msgDiv) return;
        const stickToBottom = isNearBottom();
        const value = String(text == null ? '' : text);
        const textEl = msgDiv.querySelector('.chat_msg_text');
        const isAssistant = msgDiv.classList.contains('assistant');
        msgDiv._messageText = value;
        if (textEl) textEl.innerHTML = formatMessage(value, isAssistant);
        afterContentChange(stickToBottom, !!value);
    }

    function addStateText(feedback, className, text) {
        const el = document.createElement('span');
        el.className = className;
        el.textContent = text;
        feedback.appendChild(el);
        return el;
    }

    function setMessageState(msgDiv, state, reason) {
        if (!msgDiv) return;
        const stickToBottom = isRestoring || isNearBottom();
        const feedback = msgDiv.querySelector('.chat_msg_feedback');
        if (!feedback) return;
        feedback.innerHTML = '';
        feedback.className = 'chat_msg_feedback' + (state && state !== 'completed' ? ' is_' + state : '');

        if (state === 'waiting') {
            const typing = document.createElement('span');
            typing.className = 'chat_typing';
            typing.setAttribute('aria-hidden', 'true');
            typing.innerHTML = '<span></span><span></span><span></span>';
            feedback.appendChild(typing);
            addStateText(feedback, 'chat_phase_text', '等待回复…');
        } else if (state === 'streaming') {
            const dot = document.createElement('span');
            dot.className = 'chat_streaming_dot';
            dot.setAttribute('aria-hidden', 'true');
            feedback.appendChild(dot);
            addStateText(feedback, 'chat_phase_text', '正在回复…');
        } else if (state === 'interrupted' || state === 'stopped' || state === 'error') {
            addStateText(feedback, 'chat_reply_state', state === 'stopped' ? '已停止 · 回复未完成' : '回复未完成');
            if (reason) addStateText(feedback, 'chat_reply_reason', reason);
            const retry = document.createElement('button');
            retry.type = 'button';
            retry.className = 'chat_retry_btn';
            retry.setAttribute('data-chat-retry', '');
            retry.textContent = '重试';
            feedback.appendChild(retry);
        }
        afterContentChange(stickToBottom, false);
    }

    /* ──────────────────────────────────────
       流式请求、主动停止与原气泡重试
       ────────────────────────────────────── */
    function refreshBusy(btn, text) {
        UI.busy(btn, false);
        UI.busy(btn, true, text);
    }

    function setComposerBusy(on, phase, sourceBtn) {
        if (on) {
            refreshBusy(sendBtn, phase === 'streaming' ? '正在回复…' : '等待回复…');
            quickButtons.forEach(function (btn) {
                if (btn === sourceBtn) refreshBusy(btn, phase === 'streaming' ? '正在回复…' : '等待回复…');
                else btn.disabled = true;
                btn.setAttribute('aria-disabled', 'true');
            });
            if (stopBtn) {
                UI.busy(stopBtn, false);
                stopBtn.hidden = false;
                stopBtn.disabled = false;
            }
            chatInput.setAttribute('aria-busy', 'true');
        } else {
            UI.busy(sendBtn, false);
            quickButtons.forEach(function (btn) {
                UI.busy(btn, false);
                btn.disabled = false;
                btn.removeAttribute('aria-disabled');
            });
            if (stopBtn) {
                UI.busy(stopBtn, false);
                stopBtn.hidden = true;
            }
            chatInput.removeAttribute('aria-busy');
        }
    }

    function persistAssistant(msgDiv, content, status, messages, reason) {
        let record = msgDiv._chatMessage;
        if (!record || chatLog.indexOf(record) < 0) {
            record = { role: 'assistant', content: '' };
            msgDiv._chatMessage = record;
            pushLog(record);
        }
        record.content = String(content || '');
        if (status) {
            record.status = status;
            record.reason = reason || '';
            record.retryMessages = requestMessagesFrom(messages);
        } else {
            delete record.status;
            delete record.reason;
            delete record.retryMessages;
        }
        saveChatLog();
    }

    function retryContext(msgDiv) {
        const record = msgDiv && msgDiv._chatMessage;
        if (!record) return [];
        if (Array.isArray(record.retryMessages)) {
            const saved = requestMessagesFrom(record.retryMessages);
            if (saved.length) return saved;
        }
        const index = chatLog.indexOf(record);
        return requestMessagesFrom(chatLog.slice(0, index < 0 ? chatLog.length : index));
    }

    function promptForRecord(record) {
        const index = chatLog.indexOf(record);
        for (let i = Math.min(index, chatLog.length - 1); i >= 0; i--) {
            if (chatLog[i] && chatLog[i].role === 'user') return chatLog[i].content;
        }
        return '';
    }

    async function startRequest(msgDiv, messages, sourceBtn, inputText) {
        if (activeRequest || !msgDiv || !messages.length) return;
        const controller = new AbortController();
        const id = ++requestSerial;
        const previousText = msgDiv._messageText || '';
        const request = { id, controller, msgDiv, sourceBtn, inputText: inputText || '' };
        activeRequest = request;
        let streamed = '';

        setComposerBusy(true, 'waiting', sourceBtn);
        setMessageState(msgDiv, 'waiting');

        try {
            const result = await API.aiChatStream(messages, function (delta) {
                if (!activeRequest || activeRequest.id !== id) return;
                if (!streamed) {
                    setComposerBusy(true, 'streaming', sourceBtn);
                    setMessageState(msgDiv, 'streaming');
                }
                streamed += delta;
                /* 重试复用原气泡：首段新内容到达后才替换旧半截文字。 */
                setMessageText(msgDiv, streamed);
            }, { signal: controller.signal });

            if (!activeRequest || activeRequest.id !== id) return;
            const reply = (result && result.data && result.data.reply) || streamed;
            if (reply && reply !== streamed) setMessageText(msgDiv, reply);

            if (result && result.success && result.completed === true && reply.trim()) {
                setMessageState(msgDiv, 'completed');
                persistAssistant(msgDiv, reply, null, messages, '');
                if (chatInput.value === request.inputText) chatInput.value = '';
                return;
            }

            const stopped = !!(result && result.stopped);
            const status = stopped ? 'stopped' : 'interrupted';
            const finalText = reply || previousText;
            if (!reply && previousText) setMessageText(msgDiv, previousText);
            const reason = (result && (result.msg || result.message))
                || (stopped ? '你停止了本次回复，已保留收到的文字。' : '连接中断，已保留收到的文字。');
            setMessageState(msgDiv, status, reason);
            persistAssistant(msgDiv, finalText, status, messages, reason);

            /* 请求失败且没有任何回复时，把原文放回输入框；用户消息仍保留在会话中。 */
            if (!stopped && !finalText && request.inputText && !chatInput.value) {
                chatInput.value = request.inputText;
            }
        } catch (err) {
            if (!activeRequest || activeRequest.id !== id) return;
            console.error('AI 请求失败:', err);
            const finalText = streamed || previousText;
            const reason = '网络出现问题，回复未完成，请重试。';
            setMessageState(msgDiv, 'interrupted', reason);
            persistAssistant(msgDiv, finalText, 'interrupted', messages, reason);
            if (!finalText && request.inputText && !chatInput.value) chatInput.value = request.inputText;
        } finally {
            if (activeRequest && activeRequest.id === id) {
                activeRequest = null;
                setComposerBusy(false);
            }
        }
    }

    function findMessageElement(record) {
        const nodes = chatMessages.querySelectorAll('.chat_msg');
        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i]._chatMessage === record) return nodes[i];
        }
        return null;
    }

    function handleSend(sourceBtn, presetText) {
        if (activeRequest) return;
        const text = String(presetText == null ? chatInput.value : presetText).trim();
        if (!text) return;

        if (!user) {
            addMessage('assistant', '使用小清 AI 问诊需要先登录。\n\n请点击右上角「登录」，或打开 login.html 登录后再来。');
            return;
        }

        /* 失败后输入框中仍可能有同一提问：重试原气泡，不重复追加用户消息。 */
        const last = chatLog[chatLog.length - 1];
        const previousUser = chatLog[chatLog.length - 2];
        if (isRecoverable(last) && previousUser && previousUser.role === 'user' && previousUser.content === text) {
            const lastEl = findMessageElement(last);
            if (lastEl) {
                startRequest(lastEl, retryContext(lastEl), sourceBtn, text);
                return;
            }
        }

        const userMessage = { role: 'user', content: text };
        addMessage('user', text, { message: userMessage });
        pushLog(userMessage);
        saveChatLog();
        if (presetText == null || chatInput.value.trim() === text) chatInput.value = '';

        const replyEl = addMessage('assistant', '');
        startRequest(replyEl, messagesForRequest(), sourceBtn, text);
    }

    sendBtn.addEventListener('click', function () { handleSend(null); });
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !UI.isComposing(e)) {
            e.preventDefault();
            handleSend(null);
        }
    });
    quickButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
            handleSend(btn, btn.getAttribute('data-quick-question') || btn.textContent);
        });
    });

    if (stopBtn) {
        stopBtn.addEventListener('click', function () {
            if (!activeRequest) return;
            UI.busy(stopBtn, true, '停止中…');
            activeRequest.controller.abort();
        });
    }

    chatMessages.addEventListener('click', function (e) {
        const retry = e.target.closest('[data-chat-retry]');
        if (!retry || activeRequest) return;
        const msgDiv = retry.closest('.chat_msg');
        const record = msgDiv && msgDiv._chatMessage;
        if (!record) return;
        startRequest(msgDiv, retryContext(msgDiv), null, promptForRecord(record));
    });

    /* 恢复历史；没有历史时才显示欢迎语。 */
    isRestoring = true;
    chatLog = loadChatLog();
    if (chatLog.length === 0) {
        addMessage('assistant', WELCOME_TEXT, { forceScroll: true });
    } else {
        chatLog.forEach(function (m) { addMessage(m.role, m.content, { message: m, forceScroll: true }); });
    }
    isRestoring = false;
    scrollToBottom(false);

    window.clearAiChat = function () {
        requestSerial++;
        if (activeRequest) activeRequest.controller.abort();
        activeRequest = null;
        setComposerBusy(false);
        const key = chatStoreKey();
        if (key) localStorage.removeItem(key);
        chatLog = [];
        chatMessages.innerHTML = '';
        if (newReplyBtn) newReplyBtn.hidden = true;
        addMessage('assistant', WELCOME_TEXT, { forceScroll: true });
    };
});
