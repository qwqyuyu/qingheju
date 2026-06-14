/* ==========================================
   common.js — 全局通用脚本
   功能：导航栏交互、移动端菜单、页面状态管理
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {

    /* === 移动端汉堡菜单 === */
    const navToggle = document.querySelector('.nav_toggle');
    const navLinks = document.querySelector('.nav_links');

    if (navToggle && navLinks) {
        navToggle.addEventListener('click', () => {
            navLinks.classList.toggle('open');
        });

        /* 点击菜单项后关闭 */
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('open');
            });
        });

        /* 点击页面其他区域关闭菜单 */
        document.addEventListener('click', (e) => {
            if (!navToggle.contains(e.target) && !navLinks.contains(e.target)) {
                navLinks.classList.remove('open');
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

    /* === 滚动时导航栏阴影效果 === */
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 10) {
                navbar.style.boxShadow = '0 2px 20px rgba(0,0,0,0.2)';
            } else {
                navbar.style.boxShadow = 'none';
            }
        });
    }

    /* === 签到状态检查（通用） === */
    window.checkSignStatus = function() {
        const today = new Date().toISOString().split('T')[0];
        const lastSignDate = localStorage.getItem('last_sign_date');
        return lastSignDate === today;
    };

    /* === 自定义确认弹窗（Promise化，替代原生confirm） === */
    window.showConfirm = function(message) {
        return new Promise(function(resolve) {
            /* 移除可能残留的旧弹窗 */
            var existing = document.querySelector('.confirm_overlay');
            if (existing) existing.remove();

            var overlay = document.createElement('div');
            overlay.className = 'confirm_overlay';
            overlay.innerHTML =
                '<div class="confirm_box">' +
                '<h3 class="confirm_title">提示</h3>' +
                '<p class="confirm_body">' + message + '</p>' +
                '<div class="confirm_actions">' +
                '<button class="confirm_btn_cancel">取消</button>' +
                '<button class="confirm_btn_danger">确认删除</button>' +
                '</div>' +
                '</div>';
            document.body.appendChild(overlay);

            /* 触发入场动画 */
            requestAnimationFrame(function() { overlay.classList.add('show'); });

            function cleanup(result) {
                overlay.classList.remove('show');
                overlay.addEventListener('transitionend', function() { overlay.remove(); });
                resolve(result);
            }

            overlay.querySelector('.confirm_btn_cancel').addEventListener('click', function() { cleanup(false); });
            overlay.querySelector('.confirm_btn_danger').addEventListener('click', function() { cleanup(true); });
            overlay.addEventListener('click', function(e) {
                if (e.target === overlay) cleanup(false);
            });
        });
    };

    /* === 获取连续签到天数 === */
    window.getSignStreak = function() {
        const streak = parseInt(localStorage.getItem('sign_streak') || '0');
        const lastDate = localStorage.getItem('last_sign_date');
        if (!lastDate) return 0;

        const last = new Date(lastDate);
        const today = new Date();
        const diffDays = Math.floor((today - last) / (1000 * 60 * 60 * 24));

        /* 如果最后签到是昨天或今天，保持连续；否则重置 */
        if (diffDays <= 1) {
            return streak;
        } else {
            localStorage.setItem('sign_streak', '0');
            return 0;
        }
    };

    /* === 获取累计签到天数 === */
    window.getTotalSigns = function() {
        return parseInt(localStorage.getItem('total_signs') || '0');
    };
});
