/* ==========================================
   solarterms.js — 二十四节气养生页逻辑
   ========================================== */

let activeTermModal = null;

/* 长卷与卡片共用的选中/当前索引（页面级状态） */
let currentIndex = 0;
let selectedIndex = 0;

document.addEventListener('DOMContentLoaded', () => {

    /* 更新导航登录状态 */
    const currentUser = API.getCurrentUser();
    if (currentUser) {
        const navLink = document.getElementById('nav_user_link');
        if (navLink) { navLink.textContent = '我的'; navLink.href = 'profile.html'; }
    }

    const hero = document.getElementById('term_hero');
    const grid = document.getElementById('term_grid');
    const scene = window.SolarTermScene;
    let terms = [];
    let loading = false;

    /* 画卷索引切换：同步纸卡与下方卡片选中态 */
    if (scene && typeof scene.setOnChange === 'function') {
        scene.setOnChange((index) => {
            if (!terms.length) return;
            selectedIndex = index;
            renderPanel(terms[index], index === currentIndex);
            syncCards();
        });
    }

    /* 两个区域各自保留状态块与重试入口，重渲染后委托仍然有效。 */
    UI.bindRetry(hero, loadSolarTerms);
    UI.bindRetry(grid, loadSolarTerms);

    async function loadSolarTerms() {
        if (loading) return;
        loading = true;
        hero.setAttribute('aria-busy', 'true');
        grid.setAttribute('aria-busy', 'true');
        hero.innerHTML = UI.stateHTML('loading', { text: '正在加载当前节气…' });
        grid.innerHTML = UI.stateHTML('loading', { text: '正在加载二十四节气…' });

        try {
            const result = await API.getSolarTerms();
            if (!result || !result.success || !Array.isArray(result.data)) {
                throw new Error((result && (result.message || result.msg)) || '节气数据加载失败');
            }

            terms = result.data.filter(term => term && term.name && term.date);
            if (terms.length === 0) {
                const isEmpty = result.data.length === 0;
                if (isEmpty) {
                    hero.innerHTML = UI.stateHTML('empty', {
                        text: '暂无当前节气',
                        hint: '节气数据暂为空，可稍后重新加载。',
                        actionText: '重新加载'
                    });
                    grid.innerHTML = UI.stateHTML('empty', {
                        text: '暂无节气内容',
                        actionText: '重新加载'
                    });
                } else {
                    showLoadError('节气数据格式异常，请重试');
                }
                return;
            }

            /* 优先用服务端的“今天”（APP_TIMEZONE），跨时区时不会把当前节气认错一天 */
            const today = (result && result.today) || window.localDate();

            /* 找到当前节气（最近一个日期 <= 今天的节气） */
            let currentTerm = null;
            currentIndex = 0;
            for (let i = terms.length - 1; i >= 0; i--) {
                if (terms[i].date <= today) { currentTerm = terms[i]; currentIndex = i; break; }
            }
            /* 兜底：如果没有（比如年初），取第一个 */
            if (!currentTerm) { currentTerm = terms[0]; currentIndex = 0; }
            selectedIndex = currentIndex;

            /* 长卷与纸卡、网格共用同一份接口数据 */
            const meta = {};
            terms.forEach((term) => {
                meta[term.name] = {
                    date: termDate(term),
                    lunarDate: term.lunarDate || ''
                };
            });
            if (scene && typeof scene.setMeta === 'function') scene.setMeta(meta);

            renderGrid(terms, currentTerm);
            renderPanel(currentTerm, true);
            syncCards();

            /* 长卷默认停在当前节气（不再自动轮播） */
            if (scene && typeof scene.setIndex === 'function') scene.setIndex(currentIndex);
        } catch (e) {
            showLoadError(e && e.message ? e.message : '节气数据加载失败，请检查网络');
        } finally {
            loading = false;
            hero.removeAttribute('aria-busy');
            grid.removeAttribute('aria-busy');
        }
    }

    function showLoadError(message) {
        hero.innerHTML = UI.stateHTML('error', {
            text: '当前节气加载失败',
            hint: message,
            actionText: '重试'
        });
        grid.innerHTML = UI.stateHTML('error', {
            text: '节气列表加载失败',
            hint: message,
            actionText: '重试'
        });
    }

    /* 卡片点击 → 同步长卷 + 纸卡，然后打开详情弹窗。 */
    grid.addEventListener('click', (e) => {
        const card = e.target.closest('.term_card');
        if (!card) return;
        const termName = card.dataset.term;
        const index = terms.findIndex(t => t.name === termName);
        if (index < 0) return;
        const term = terms[index];
        selectedIndex = index;
        if (scene && typeof scene.setIndex === 'function') scene.setIndex(index);
        renderPanel(term, index === currentIndex);
        syncCards();
        card.focus();
        showTermModal(term);
    });

    loadSolarTerms();
});

function esc(value) {
    return UI.escapeHtml(value == null ? '' : String(value));
}

function termDate(term) {
    return String(term.date || '').replace(/-/g, '/');
}

/* 图片地址兜底：数据库没给图片时退回同名矢量图，避免出现破图 */
function termImage(term) {
    return term.image || (term.pinyin ? '/images/solarterms/' + term.pinyin + '.svg' : '');
}

/* 画卷下方的纸卡：展示当前或选读节气的完整说明 */
function renderPanel(term, isCurrent) {
    const hero = document.getElementById('term_hero');
    hero.innerHTML = `
        <div class="term_hero_body">
            <span class="term_hero_tag">${isCurrent ? '当前节气' : '长卷选读'}</span>
            <h2 class="term_hero_name">${esc(term.name)}</h2>
            <p class="term_hero_date">公历 ${esc(termDate(term))}　农历 ${esc(term.lunarDate || '暂缺')}</p>
            <p class="term_hero_desc">${esc(term.description || '暂无节气介绍')}</p>
            <div class="term_hero_tip">
                <span class="term_hero_tip_label">养生建议</span>${esc(term.healthTip || '顺应自然，调和阴阳')}
            </div>
        </div>
    `;
    hero.style.display = 'flex';
}

function renderGrid(terms, currentTerm) {
    const grid = document.getElementById('term_grid');

    grid.innerHTML = terms.map(t => {
        const isCurrent = t.name === (currentTerm && currentTerm.name);
        return `
            <button type="button" class="term_card card_interactive${isCurrent ? ' current' : ''}" data-term="${esc(t.name)}" title="查看${esc(t.name)}详情" aria-label="查看${esc(t.name)}节气详情${isCurrent ? '，当前节气' : ''}" aria-pressed="false">
                ${isCurrent ? '<span class="term_current_tag">当前</span>' : ''}
                <span class="term_selected_tag" aria-hidden="true">已选</span>
                <img class="term_card_img" src="${esc(termImage(t))}" alt="${esc(t.name)}" onerror="this.style.opacity='0.3';this.removeAttribute('onerror')">
                <span class="term_card_date">${esc(termDate(t))}</span>
                <span class="term_card_desc">${esc(t.description || '暂无节气介绍')}</span>
            </button>
        `;
    }).join('');
}

/* 卡片选中态与长卷索引保持一致 */
function syncCards() {
    const grid = document.getElementById('term_grid');
    if (!grid) return;
    grid.querySelectorAll('.term_card').forEach((card, index) => {
        const active = index === selectedIndex;
        card.classList.toggle('selected', active);
        card.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
}

function showTermModal(term) {
    /* 关闭可能残留的旧弹窗，同时释放旧焦点陷阱。 */
    if (activeTermModal && typeof activeTermModal._close === 'function') {
        activeTermModal._close(true);
    } else if (activeTermModal) {
        activeTermModal.remove();
    }

    const overlay = document.createElement('div');
    overlay.className = 'term_modal_overlay';
    overlay.innerHTML =
        '<div class="term_modal_box paper_dialog" role="dialog" aria-modal="true" aria-labelledby="term_modal_title" tabindex="-1">' +
        '<button type="button" class="term_modal_close" aria-label="关闭节气详情">&times;</button>' +
        '<img class="term_modal_img" src="' + esc(termImage(term)) + '" alt="' + esc(term.name) + '">' +
        '<h2 class="term_modal_name" id="term_modal_title">' + esc(term.name) + '</h2>' +
        '<p class="term_modal_date">公历 ' + esc(termDate(term)) + '　农历 ' + esc(term.lunarDate || '暂缺') + '</p>' +
        '<p class="term_modal_desc">' + esc(term.description || '暂无节气介绍') + '</p>' +
        '<div class="term_modal_tip"><span class="term_modal_tip_label">养生建议</span>' + esc(term.healthTip || '顺应自然，调和阴阳') + '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    activeTermModal = overlay;

    const box = overlay.querySelector('.term_modal_box');
    const closeButton = overlay.querySelector('.term_modal_close');
    let closed = false;
    let releaseFocus = null;
    let removeTimer = null;

    function removeOverlay() {
        if (removeTimer) clearTimeout(removeTimer);
        if (overlay.parentNode) overlay.remove();
        if (activeTermModal === overlay) activeTermModal = null;
    }

    function close(immediate) {
        if (closed) return;
        closed = true;
        if (releaseFocus) releaseFocus();
        overlay.classList.remove('show');

        const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (immediate || reduced) {
            removeOverlay();
            return;
        }
        overlay.addEventListener('transitionend', function onTransitionEnd(e) {
            if (e.target !== overlay) return;
            overlay.removeEventListener('transitionend', onTransitionEnd);
            removeOverlay();
        });
        /* 禁用动画或 transitionend 被浏览器省略时也能完成清理。 */
        removeTimer = setTimeout(removeOverlay, 320);
    }

    overlay._close = close;
    closeButton.addEventListener('click', () => close(false));
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) close(false);
    });

    /* 焦点进入、Tab 循环、Esc 关闭、关闭后返回触发卡片。 */
    releaseFocus = UI.trapFocus(box, {
        onEscape: function() { close(false); },
        initialFocus: closeButton
    });

    /* 触发入场动画 */
    requestAnimationFrame(function() {
        if (!closed) overlay.classList.add('show');
    });
}
