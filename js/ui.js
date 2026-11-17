/* ==========================================
   ui.js — 统一操作反馈与无障碍助手
   依赖：common.css 中的 .toast/.state_block/.btn.is_busy 等样式
   用法：在 common.js 之后、页面脚本之前引入 <script src="/js/ui.js"></script>
   ========================================== */

window.UI = (function () {

    /* ============ 短提示（非阻塞，辅助技术可播报） ============ */

    var toastWrap = null;
    var liveRegion = null;

    function ensureToastWrap() {
        if (!toastWrap || !document.body.contains(toastWrap)) {
            toastWrap = document.createElement('div');
            toastWrap.className = 'toast_wrap';
            document.body.appendChild(toastWrap);
        }
        return toastWrap;
    }

    /* 供辅助技术播报的 polite live region（与视觉 toast 分离，避免重复播报） */
    function announce(message) {
        if (!liveRegion || !document.body.contains(liveRegion)) {
            liveRegion = document.createElement('div');
            liveRegion.className = 'visually-hidden';
            liveRegion.setAttribute('aria-live', 'polite');
            liveRegion.setAttribute('role', 'status');
            document.body.appendChild(liveRegion);
        }
        /* 先清空再写入，确保相同文案也会重新播报 */
        liveRegion.textContent = '';
        window.setTimeout(function () { liveRegion.textContent = message; }, 30);
    }

    /**
     * UI.toast('已发布', 'success')
     * type: 'info' | 'success' | 'error'
     * duration: 毫秒，默认 3200；传 0 表示不自动关闭（返回的 close 可手动关闭）
     */
    function toast(message, type, duration) {
        var wrap = ensureToastWrap();
        var el = document.createElement('div');
        el.className = 'toast toast_' + (type || 'info');
        el.textContent = message;
        wrap.appendChild(el);
        requestAnimationFrame(function () { el.classList.add('show'); });
        announce(message);

        var closed = false;
        function close() {
            if (closed) return;
            closed = true;
            el.classList.remove('show');
            window.setTimeout(function () { el.remove(); }, 260);
        }

        var ttl = (duration === undefined) ? 3200 : duration;
        if (ttl > 0) window.setTimeout(close, ttl);
        el.addEventListener('click', close);
        return { close: close, el: el };
    }

    /* ============ 按钮忙碌状态（阻止重复提交） ============ */

    /**
     * UI.busy(btn, true, '发布中…')  → 禁用并显示 spinner + 文案
     * UI.busy(btn, false)            → 恢复原文案与可用状态
     * 幂等：重复调用安全。
     */
    function busy(btn, on, busyText) {
        if (!btn) return;
        if (on) {
            if (btn.classList.contains('is_busy')) return;
            if (!btn.dataset.uiLabel) {
                btn.dataset.uiLabel = btn.innerHTML;
            }
            btn.classList.add('is_busy');
            btn.setAttribute('aria-busy', 'true');
            /* 用 disabled 防止重复提交；<a> 没有 disabled，用 aria-disabled */
            if (btn.tagName === 'BUTTON' || btn.tagName === 'INPUT') {
                btn.disabled = true;
            } else {
                btn.setAttribute('aria-disabled', 'true');
            }
            var label = busyText || btn.dataset.uiBusyLabel || '处理中…';
            btn.innerHTML = '';
            var spinner = document.createElement('span');
            spinner.className = 'btn_spinner';
            spinner.setAttribute('aria-hidden', 'true');
            var labelEl = document.createElement('span');
            labelEl.textContent = label;
            btn.appendChild(spinner);
            btn.appendChild(labelEl);
        } else {
            if (!btn.classList.contains('is_busy')) return;
            btn.classList.remove('is_busy');
            btn.removeAttribute('aria-busy');
            if (btn.tagName === 'BUTTON' || btn.tagName === 'INPUT') {
                btn.disabled = false;
            } else {
                btn.removeAttribute('aria-disabled');
            }
            if (btn.dataset.uiLabel) {
                btn.innerHTML = btn.dataset.uiLabel;
                delete btn.dataset.uiLabel;
            }
        }
    }

    /**
     * 用忙碌状态包裹一个异步操作，自动恢复并阻止重入。
     *   await UI.run(btn, async function () { ... }, '保存中…');
     * 若操作正在进行中，直接返回 undefined（不重复执行）。
     */
    async function run(btn, fn, busyText) {
        if (!btn || btn.classList.contains('is_busy')) return undefined;
        busy(btn, true, busyText);
        try {
            return await fn();
        } finally {
            busy(btn, false);
        }
    }

    /* ============ 弹窗焦点管理 ============ */

    var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    /**
     * 打开弹窗时调用：焦点进入弹窗、Tab 循环、Esc 关闭、关闭后焦点返回触发点。
     *   var release = UI.trapFocus(dialogEl, { onEscape: closeDialog, initialFocus: el });
     *   // 关闭时：release();
     * 返回释放函数（幂等）。
     */
    function trapFocus(container, options) {
        options = options || {};
        var previousFocus = document.activeElement;
        var released = false;

        function focusables() {
            return Array.prototype.filter.call(
                container.querySelectorAll(FOCUSABLE),
                function (el) { return el.offsetParent !== null || el === document.activeElement; }
            );
        }

        function onKeydown(e) {
            if (e.key === 'Escape' && typeof options.onEscape === 'function') {
                e.stopPropagation();
                options.onEscape();
                return;
            }
            if (e.key !== 'Tab') return;
            var items = focusables();
            if (!items.length) {
                e.preventDefault();
                return;
            }
            var first = items[0];
            var last = items[items.length - 1];
            if (e.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }

        if (!container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1');
        document.addEventListener('keydown', onKeydown, true);

        /* 焦点进入：优先指定元素，否则第一个可聚焦元素，最后容器本身 */
        var target = options.initialFocus || focusables()[0] || container;
        /* 等入场渲染后再聚焦 */
        requestAnimationFrame(function () {
            if (!released) target.focus();
        });

        return function release() {
            if (released) return;
            released = true;
            document.removeEventListener('keydown', onKeydown, true);
            if (previousFocus && previousFocus.focus && document.contains(previousFocus)) {
                previousFocus.focus();
            }
        };
    }

    /* ============ 加载 / 空内容 / 失败 状态块 ============ */

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /**
     * 生成状态块 HTML：
     *   UI.stateHTML('loading', { text: '正在加载帖子…' })
     *   UI.stateHTML('empty',   { text: '暂无内容', hint: '调整筛选试试', actionText: '清除筛选' })
     *   UI.stateHTML('error',   { text: '加载失败，请检查网络', actionText: '重试' })
     * 有 actionText 时会带 data-ui-retry 按钮，用 UI.bindRetry 绑定。
     */
    function stateHTML(kind, opts) {
        opts = opts || {};
        var cls = kind === 'error' ? 'state_error' : (kind === 'empty' ? 'state_empty' : 'state_loading');
        var html = '<div class="state_block ' + cls + '" role="status">';
        if (kind === 'loading') {
            html += '<span class="btn_spinner" aria-hidden="true" style="width:22px;height:22px;border-color:var(--color-gold);border-top-color:transparent"></span>';
        } else if (kind === 'error') {
            html += '<span class="state_seal state_seal_error" aria-hidden="true">' + icon('warning', 24) + '</span>';
        } else if (kind === 'empty') {
            html += '<span class="state_seal" aria-hidden="true">' + icon('document', 24) + '</span>';
        }
        html += '<p>' + escapeHtml(opts.text || (kind === 'loading' ? '正在加载…' : kind === 'empty' ? '暂无内容' : '加载失败')) + '</p>';
        if (opts.hint) html += '<p class="state_hint">' + escapeHtml(opts.hint) + '</p>';
        if (opts.actionText) {
            html += '<button type="button" class="btn btn_outline" data-ui-retry>' + escapeHtml(opts.actionText) + '</button>';
        }
        html += '</div>';
        return html;
    }

    /**
     * 在容器上委托绑定状态块按钮（loading 完成后重渲染也有效）：
     *   UI.bindRetry(containerEl, function () { reload(); });
     */
    function bindRetry(container, handler) {
        if (!container || container.dataset.uiRetryBound) return;
        container.dataset.uiRetryBound = '1';
        container.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-ui-retry]');
            if (btn && container.contains(btn)) handler(e, btn);
        });
    }

    /* ============ 中文输入法 ============ */

    /** 在 keydown 里判断：确认候选词（IME 组字中）时不应触发发送等操作 */
    function isComposing(e) {
        return !!(e && (e.isComposing || e.keyCode === 229));
    }

    /* ============ 图片文件校验 ============ */

    var IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    /**
     * 校验图片格式与大小，返回 { ok: true } 或 { ok: false, message }
     * maxMB 默认 5。
     */
    function validateImageFile(file, maxMB) {
        if (!file) return { ok: false, message: '未选择图片' };
        if (IMAGE_TYPES.indexOf(file.type) < 0) {
            return { ok: false, message: '仅支持 JPG、PNG、WebP、GIF 格式的图片' };
        }
        var limit = (maxMB || 5) * 1024 * 1024;
        if (file.size > limit) {
            return { ok: false, message: '图片超过 ' + (maxMB || 5) + 'MB，请压缩后重新选择' };
        }
        return { ok: true };
    }

    /** FileReader 读取为 DataURL，失败时 reject（由调用方提示并保留用户输入） */
    function readImageFile(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(reader.result); };
            reader.onerror = function () { reject(new Error('图片读取失败，请重新选择')); };
            reader.readAsDataURL(file);
        });
    }

    /* ============ 线性图标（手绘 SVG，颜色跟随 currentColor） ============ */

    var ICONS = {
        heart: '<path d="M12 20.2 4.9 13a4.6 4.6 0 0 1 6.5-6.5l.6.6.6-.6A4.6 4.6 0 0 1 19.1 13z"/>',
        comment: '<path d="M20 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/>',
        sprout: '<path d="M12 21v-7"/><path d="M12 14c0-3.3 2.7-6 6-6 0 3.3-2.7 6-6 6z"/><path d="M12 16c0-2.8-2.2-5-5-5 0 2.8 2.2 5 5 5z"/>',
        sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
        leaf: '<path d="M20 4C12 4 5 8 5 15c0 2 1 4 2 5 7 0 13-6 13-16z"/><path d="M5 20c3-5 7-8 11-10"/>',
        snowflake: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9 4.5 12 7l3-2.5M9 19.5 12 17l3 2.5"/>',
        sunrise: '<path d="M4 19h16"/><path d="M8 19a4 4 0 0 1 8 0"/><path d="M12 4v3M6.3 7.3l2 2M17.7 7.3l-2 2M3 13h2M19 13h2"/>',
        bowl: '<path d="M3 11h18c0 5-4 8-9 8s-9-3-9-8z"/><path d="M8 8c0-1.5 1-2 1-3.5M12 8c0-1.5 1-2 1-3.5M16 8c0-1.5 1-2 1-3.5"/>',
        moon: '<path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5z"/><path d="M17 4l.7 1.6L19.3 6.3l-1.6.7L17 8.6l-.7-1.6-1.6-.7 1.6-.7z"/>',
        lotus: '<path d="M12 20c-1.8-2.2-2.6-4.6-2.6-7.2C9.4 9.6 10.5 7 12 5c1.5 2 2.6 4.6 2.6 7.8 0 2.6-.8 5-2.6 7.2z"/><path d="M12 20c-3.6 0-6.5-2.2-7.5-5.5 1.8-.6 3.4-.3 4.8.8M12 20c3.6 0 6.5-2.2 7.5-5.5-1.8-.6-3.4-.3-4.8.8"/>',
        document: '<path d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V5a1.5 1.5 0 0 1 1-1.5z"/><path d="M14 3.5V8h4.4"/><path d="M9 12.5h6M9 16h4"/>',
        warning: '<path d="M12 3 2.8 20h18.4z"/><path d="M12 9v5"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>',
        book: '<path d="M12 6c-2-1.5-4.5-2-7-2v14c2.5 0 5 .5 7 2 2-1.5 4.5-2 7-2V4c-2.5 0-5 .5-7 2z"/><path d="M12 6v14"/>',
        chat: '<path d="M3.5 4.5h9v6.5H7l-3.5 3z"/><path d="M10.5 11h10v6H17l-3 2.5V17h-3.5z"/>',
        check: '<path d="M4 12.5 9.5 18 20 6"/>',
        yinyang: '<circle cx="12" cy="12" r="9"/><path d="M12 3a4.5 4.5 0 0 0 0 9 4.5 4.5 0 0 1 0 9"/><circle cx="12" cy="7.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="16.5" r="1.1" fill="currentColor" stroke="none"/>',
        clipboard: '<rect x="4.5" y="4" width="15" height="17" rx="2"/><path d="M9 4.5V3h6v1.5"/><path d="M7.5 13h2l1.5-3 2.5 6 1.5-3h2"/>'
    };

    /**
     * UI.icon('heart', 18, { fill: true, strokeWidth: 1.7 })
     * 返回内联 SVG 字符串；颜色继承 currentColor，不发起额外请求。
     */
    function icon(name, size, options) {
        options = options || {};
        var body = ICONS[name];
        if (!body) return '';
        var s = size || 18;
        return '<svg class="ui_icon" viewBox="0 0 24 24" width="' + s + '" height="' + s + '" ' +
            'fill="' + (options.fill ? 'currentColor' : 'none') + '" stroke="currentColor" ' +
            'stroke-width="' + (options.strokeWidth || 1.6) + '" stroke-linecap="round" ' +
            'stroke-linejoin="round" aria-hidden="true" focusable="false">' + body + '</svg>';
    }

    return {
        toast: toast,
        announce: announce,
        busy: busy,
        run: run,
        trapFocus: trapFocus,
        stateHTML: stateHTML,
        bindRetry: bindRetry,
        icon: icon,
        isComposing: isComposing,
        validateImageFile: validateImageFile,
        readImageFile: readImageFile,
        escapeHtml: escapeHtml
    };
})();
