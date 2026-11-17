/* ==========================================
   common.js — 全局通用脚本
   功能：导航栏交互、移动端菜单、页面状态管理
   ========================================== */

/* 本地日期 YYYY-MM-DD（用浏览器本地时区，不经过 UTC） */
window.localDate = function (date) {
    const d = date instanceof Date ? date : new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
};

/* ==========================================
   按用户隔离的本地缓存
   ------------------------------------------
   签到数据原先直接写在 sign_dates / last_sign_date 这类全局键上，
   同一台设备换账号后会把上一个账号的状态读出来，表现为
   “没签到的账号也显示已签到、而且点不动签到按钮”。
   这里统一加 u<id>_ 前缀，并且接口数据只通过 syncSignCache 写入。
   ========================================== */

/* 当前登录用户 id：直接读 localStorage，不依赖 api.js 的加载顺序 */
window.currentUserId = function () {
    try {
        const raw = localStorage.getItem('current_user');
        const u = raw ? JSON.parse(raw) : null;
        return (u && u.id) ? String(u.id) : '';
    } catch (e) {
        return '';
    }
};

/* 生成按用户隔离的缓存键：u12_sign_dates / guest_sign_dates */
window.userKey = function (name) {
    const id = window.currentUserId();
    return (id ? 'u' + id + '_' : 'guest_') + name;
};

/* 把服务端返回的签到数据写进本地缓存（全站唯一写入口）。
   ★ signDates 为空时必须显式删除 last_sign_date：
     只“写有数据的情况”会让上一个账号的“今天已签到”一直残留。 */
window.syncSignCache = function (data) {
    const sd = (data && Array.isArray(data.signDates)) ? data.signDates : [];
    const streak = (data && typeof data.streak === 'number') ? data.streak : 0;

    /* 无痕模式/存储被禁用/配额写满时 setItem 会抛异常，
       缓存失败不能让整页初始化中断（旧代码是在 try 里写的）。 */
    try {
        localStorage.setItem(window.userKey('sign_dates'), JSON.stringify(sd));
        localStorage.setItem(window.userKey('sign_streak'), String(streak));
        localStorage.setItem(window.userKey('total_signs'), String(sd.length));

        if (sd.length > 0) {
            localStorage.setItem(window.userKey('last_sign_date'), sd[0]);
        } else {
            localStorage.removeItem(window.userKey('last_sign_date'));
        }
    } catch (e) {
        console.warn('签到缓存写入失败（已忽略）：', e && e.message);
    }
};

/* 退出登录时清掉本设备上与账号绑定的缓存（新旧两种键名都清）。
   注意：AI 会话缓存 ai_chat_<id> 与发帖草稿 u<id>_post_draft 不在这里清理 ——
   它们没有服务端副本，按用户 id 隔离已经足够，清掉就真的找不回来了。 */
window.clearUserCaches = function () {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
    keys.forEach(function (k) {
        if (!k) return;
        if (/^(u\d+_|guest_)?(sign_dates|sign_streak|total_signs|last_sign_date|card_data_|card_bg_|wellness_done_)/.test(k)) {
            localStorage.removeItem(k);
        }
    });
};

/* ==========================================
   签到状态（本地缓存视图）
   ------------------------------------------
   只用于首屏渲染与统计展示。**能不能签到必须问服务端**：
   checkin.js 以 GET /api/checkin 返回的 checkedInToday 为准。
   ========================================== */

/* 本地缓存里“今天是否已签到” */
window.checkSignStatus = function () {
    const today = window.localDate();
    const lastSignDate = localStorage.getItem(window.userKey('last_sign_date'));
    return lastSignDate === today;
};

/* 获取连续签到天数 */
window.getSignStreak = function () {
    const streak = parseInt(localStorage.getItem(window.userKey('sign_streak')) || '0');
    const lastDate = localStorage.getItem(window.userKey('last_sign_date'));
    if (!lastDate) return 0;

    /* 按本地日期字符串计算相差天数，避免时区/时分秒干扰 */
    const diffDays = Math.round((Date.parse(window.localDate()) - Date.parse(lastDate)) / 86400000);

    /* 如果最后签到是昨天或今天，保持连续；否则重置 */
    if (!isNaN(diffDays) && diffDays <= 1) {
        return streak;
    } else {
        localStorage.setItem(window.userKey('sign_streak'), '0');
        return 0;
    }
};

/* 获取累计签到天数 */
window.getTotalSigns = function () {
    return parseInt(localStorage.getItem(window.userKey('total_signs')) || '0');
};

document.addEventListener('DOMContentLoaded', () => {

    /* === 移动端汉堡菜单 === */
    const navToggle = document.querySelector('.nav_toggle');
    const navLinks = document.querySelector('.nav_links');

    if (navToggle && navLinks) {
        /* 移动菜单同步展开状态给辅助技术 */
        if (!navLinks.id) navLinks.id = 'nav_links';
        navToggle.setAttribute('aria-controls', navLinks.id);
        navToggle.setAttribute('aria-expanded', 'false');

        function setMenu(open) {
            navLinks.classList.toggle('open', open);
            navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        }

        navToggle.addEventListener('click', () => {
            setMenu(!navLinks.classList.contains('open'));
        });

        /* 点击菜单项后关闭 */
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                setMenu(false);
            });
        });

        /* 点击页面其他区域关闭菜单 */
        document.addEventListener('click', (e) => {
            if (!navToggle.contains(e.target) && !navLinks.contains(e.target)) {
                setMenu(false);
            }
        });

        /* Esc 关闭并把焦点还给汉堡按钮 */
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && navLinks.classList.contains('open')) {
                setMenu(false);
                navToggle.focus();
            }
        });
    }

    /* === 导航栏当前页面高亮 === */
    const currentPath = window.location.pathname;
    const navAnchors = document.querySelectorAll('.nav_links a');

    navAnchors.forEach(anchor => {
        const href = anchor.getAttribute('href');
        if (href && currentPath.endsWith(href)) {
            anchor.classList.add('active');
        }
        /* 首页特殊处理 */
        if ((currentPath.endsWith('index.html') || currentPath.endsWith('/')) && href === 'index.html') {
            anchor.classList.add('active');
        }
    });

    /* === 滚动时导航栏阴影效果（用类切换，避免内联样式覆盖材质阴影） === */
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            navbar.classList.toggle('is_scrolled', window.scrollY > 10);
        }, { passive: true });
    }

    /* === 自定义确认弹窗（Promise化，替代原生confirm） === */
    window.showConfirm = function(message) {
        return new Promise(function(resolve) {
            /* 移除可能残留的旧弹窗 */
            var existing = document.querySelector('.confirm_overlay');
            if (existing) existing.remove();

            var previousFocus = document.activeElement;
            var overlay = document.createElement('div');
            overlay.className = 'confirm_overlay';
            overlay.innerHTML =
                '<div class="confirm_box" role="dialog" aria-modal="true" aria-labelledby="confirm_title_text">' +
                '<h3 class="confirm_title" id="confirm_title_text">提示</h3>' +
                '<p class="confirm_body">' + message + '</p>' +
                '<div class="confirm_actions">' +
                '<button class="confirm_btn_cancel">取消</button>' +
                '<button class="confirm_btn_danger">确认删除</button>' +
                '</div>' +
                '</div>';
            document.body.appendChild(overlay);

            /* 触发入场动画 */
            requestAnimationFrame(function() { overlay.classList.add('show'); });

            var releaseFocus = null;
            var box = overlay.querySelector('.confirm_box');
            var cancelBtn = overlay.querySelector('.confirm_btn_cancel');
            var dangerBtn = overlay.querySelector('.confirm_btn_danger');

            /* 焦点进入弹窗、Tab 循环、关闭后焦点返回触发点 */
            if (window.UI && typeof window.UI.trapFocus === 'function') {
                releaseFocus = window.UI.trapFocus(box, {
                    onEscape: function() { cleanup(false); },
                    initialFocus: cancelBtn
                });
            } else {
                cancelBtn.focus();
            }

            function cleanup(result) {
                if (releaseFocus) releaseFocus();
                overlay.classList.remove('show');
                overlay.addEventListener('transitionend', function() { overlay.remove(); });
                /* 减少动态效果时 transitionend 可能不触发，兜底移除 */
                setTimeout(function() { if (overlay.parentNode) overlay.remove(); }, 320);
                if (previousFocus && previousFocus.focus && document.contains(previousFocus)) {
                    previousFocus.focus();
                }
                resolve(result);
            }

            cancelBtn.addEventListener('click', function() { cleanup(false); });
            dangerBtn.addEventListener('click', function() { cleanup(true); });
            overlay.addEventListener('click', function(e) {
                if (e.target === overlay) cleanup(false);
            });
            /* 无 UI.trapFocus 时的 Esc 兜底 */
            if (!releaseFocus) {
                overlay.addEventListener('keydown', function(e) {
                    if (e.key === 'Escape') cleanup(false);
                });
            }
        });
    };
});
