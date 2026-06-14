/* ==========================================
   solarterms.js — 二十四节气养生页逻辑
   ========================================== */

document.addEventListener('DOMContentLoaded', async () => {

    /* 更新导航登录状态 */
    const currentUser = API.getCurrentUser();
    if (currentUser) {
        const navLink = document.getElementById('nav_user_link');
        if (navLink) { navLink.textContent = '我的'; navLink.href = 'profile.html'; }
    }

    /* 加载数据 */
    const result = await API.getSolarTerms();
    if (!result.success || !result.data || result.data.length === 0) {
        document.getElementById('term_hero').innerHTML = '<p class="no_data">节气数据加载失败</p>';
        return;
    }

    const terms = result.data;
    const today = new Date().toISOString().split('T')[0];

    /* 找到当前节气（最近一个日期 <= 今天的节气） */
    let currentTerm = null;
    for (let i = terms.length - 1; i >= 0; i--) {
        if (terms[i].date <= today) { currentTerm = terms[i]; break; }
    }
    /* 兜底：如果没有（比如年初），取第一个 */
    if (!currentTerm) currentTerm = terms[0];

    /* 渲染 Hero 区 */
    renderHero(currentTerm);

    /* 渲染全部节气网格 */
    renderGrid(terms, currentTerm);

    /* 卡片点击 → 放大详情 */
    document.getElementById('term_grid').addEventListener('click', (e) => {
        const card = e.target.closest('.term_card');
        if (!card) return;
        const termName = card.dataset.term;
        const term = terms.find(t => t.name === termName);
        if (term) showTermModal(term);
    });
});

function renderHero(term) {
    const hero = document.getElementById('term_hero');
    hero.innerHTML = `
        <img class="term_hero_img" src="${term.image}" alt="${term.name}" onerror="this.style.opacity='0.4'">
        <div class="term_hero_body">
            <span class="term_hero_tag">当前节气</span>
            <h2 class="term_hero_name">${term.name}</h2>
            <p class="term_hero_date">公历 ${term.date.replace(/-/g, '/')}　农历 ${term.lunarDate}</p>
            <p class="term_hero_desc">${term.description}</p>
            <div class="term_hero_tip">
                <span class="term_hero_tip_label">养生建议</span>${term.healthTip}
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
            <div class="term_card${isCurrent ? ' current' : ''}" data-term="${t.name}">
                <img class="term_card_img" src="${t.image}" alt="${t.name}" onerror="this.style.opacity='0.3'">
                <h3 class="term_card_name">${t.name}</h3>
                <p class="term_card_date">${t.date.replace(/-/g, '/')}</p>
                <p class="term_card_desc">${t.description.substring(0, 40)}...</p>
            </div>
        `;
    }).join('');

    /* 滚动到当前节气 */
    const currentCard = grid.querySelector('.term_card.current');
    if (currentCard) {
        setTimeout(() => {
            currentCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 400);
    }
}

function showTermModal(term) {
    /* 移除可能残留的旧弹窗 */
    const existing = document.querySelector('.term_modal_overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'term_modal_overlay';
    overlay.innerHTML =
        '<div class="term_modal_box">' +
        '<button class="term_modal_close">&times;</button>' +
        '<img class="term_modal_img" src="' + term.image + '" alt="' + term.name + '">' +
        '<h2 class="term_modal_name">' + term.name + '</h2>' +
        '<p class="term_modal_date">公历 ' + term.date.replace(/-/g, '/') + '　农历 ' + term.lunarDate + '</p>' +
        '<p class="term_modal_desc">' + term.description + '</p>' +
        '<div class="term_modal_tip"><span class="term_modal_tip_label">养生建议</span>' + term.healthTip + '</div>' +
        '</div>';
    document.body.appendChild(overlay);

    /* 触发入场动画 */
    requestAnimationFrame(function() { overlay.classList.add('show'); });

    /* 关闭 */
    function close() {
        overlay.classList.remove('show');
        overlay.addEventListener('transitionend', function() { overlay.remove(); });
    }
    overlay.querySelector('.term_modal_close').addEventListener('click', close);
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) close();
    });
}
