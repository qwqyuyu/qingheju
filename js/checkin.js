/* ==========================================
   checkin.js — 每日签到逻辑
   功能：签到按钮交互、3D翻转卡片动画、节气/药材知识卡片展示
   ========================================== */

document.addEventListener('DOMContentLoaded', async () => {

    /* 更新导航登录状态 */
    const user = API.getCurrentUser();
    if (user) {
        const navLink = document.getElementById('nav_user_link');
        if (navLink) { navLink.textContent = '我的'; navLink.href = 'profile.html'; }
    }

    /* 从后端同步签到数据到本地缓存 */
    if (user) {
        try {
            const historyResult = await API.getCheckinHistory();
            if (historyResult.success && historyResult.data) {
                const sd = historyResult.data.signDates || [];
                localStorage.setItem('sign_dates', JSON.stringify(sd));
                localStorage.setItem('sign_streak', (historyResult.data.streak || 0).toString());
                localStorage.setItem('total_signs', (sd.length).toString());
                if (sd.length > 0) localStorage.setItem('last_sign_date', sd[0]);
            }
        } catch (e) {}
    }

    /* 初始化日历 */
    await Calendar.init();

    /* 回填历史缺失的卡片数据 */
    await backfillMissingCards();

    /* 加载签到统计 */
    loadSignStats();

    /* 检查今日是否已签到 */
    const isChecked = window.checkSignStatus();
    const checkinBtn = document.getElementById('checkin_btn');
    const statusEl = document.getElementById('checkin_status');

    if (isChecked) {
        setSignedState();
    } else {
        statusEl.textContent = '点击按钮，获取今日养生知识卡片';
    }

    /* 签到按钮点击事件 */
    checkinBtn.addEventListener('click', async () => {
        if (window.checkSignStatus()) {
            /* 已签到 */
            showCard(); /* 仍可查看今日卡片 */
            return;
        }

        /* 调用签到接口 */
        const result = await API.checkin();
        if (result.success) {
            /* 同步签到数据到本地缓存 */
            const today = window.localDate();
            const signDates = JSON.parse(localStorage.getItem('sign_dates') || '[]');
            if (!signDates.includes(today)) signDates.unshift(today);
            localStorage.setItem('sign_dates', JSON.stringify(signDates));
            localStorage.setItem('last_sign_date', today);
            localStorage.setItem('sign_streak', (result.data.streak || 1).toString());
            localStorage.setItem('total_signs', (signDates.length).toString());

            setSignedState();
            loadSignStats();
            Calendar.refreshSignDates();

            /* 显示卡片动画 */
            showCard();
        } else {
            statusEl.textContent = result.message || '签到失败，请稍后重试';
        }
    });

    /* 设置为已签到状态 */
    function setSignedState() {
        checkinBtn.querySelector('.checkin_btn_text').textContent = '已签到';
        checkinBtn.querySelector('.checkin_btn_icon').textContent = '✓';
        statusEl.textContent = '再次点击按钮查看今日卡片';
    }

    /* 加载签到统计数据 */
    async function loadSignStats() {
        const streak = window.getSignStreak();
        const total = window.getTotalSigns();
        document.getElementById('stat_streak').textContent = streak;
        document.getElementById('stat_total').textContent = total;
    }

    /* 生成今日卡片内容（仅当天首次签到调用） */
    async function generateCardContent(dateStr) {
        const termsResult = await API.getSolarTerms();
        const solarTerms = termsResult.data || [];
        const term = solarTerms.find(t => t.date === dateStr);

        var cardTitle, cardText, cardTip, cardImgPath, cardIsTerm;
        let herbs = [];

        if (term) {
            cardTitle = term.name;
            cardText = term.description;
            cardTip = '养生建议：' + (term.healthTip || '顺应自然，调和阴阳');
            cardImgPath = term.image || ('/images/solarterms/' + term.pinyin + '.svg');
            cardIsTerm = true;
        } else {
            try {
                const herbsResult = await API.getHerbs();
                herbs = herbsResult.data || [];
            } catch (e) {
                herbs = getFallbackHerbs();
            }

            if (herbs.length > 0) {
                const randomHerb = herbs[Math.floor(Math.random() * herbs.length)];
                const season = getCurrentSeason(dateStr);
                const seasonTip = randomHerb.seasonalTips ? randomHerb.seasonalTips[season] || '' : '';
                cardTitle = randomHerb.name;
                cardText = randomHerb.effect;
                cardTip = seasonTip ? `时令建议：${seasonTip}` : `性味归经：${randomHerb.nature} · ${randomHerb.meridian}`;
                cardImgPath = (randomHerb.image) ? randomHerb.image : '/images/herbs/gouqi.png';
            } else {
                cardTitle = '枸杞';
                cardText = '滋补肝肾，益精明目。';
                cardTip = '养生建议：可与菊花泡茶，养肝明目';
                cardImgPath = '/images/herbs/gouqi.png';
            }
            cardIsTerm = false;
        }

        return { title: cardTitle, text: cardText, tip: cardTip, image: cardImgPath, isTerm: cardIsTerm };
    }

    /* 获取当天卡片背景编号 */
    function getTodayBgIndex() {
        const today = window.localDate();
        const storedDate = localStorage.getItem('card_bg_date');
        const storedIndex = parseInt(localStorage.getItem('card_bg_index') || '0');
        if (storedDate === today && storedIndex > 0) {
            return storedIndex;
        }
        var bgIndex;
        do {
            bgIndex = Math.floor(Math.random() * 4) + 1;
        } while (bgIndex === storedIndex);
        localStorage.setItem('card_bg_date', today);
        localStorage.setItem('card_bg_index', bgIndex.toString());
        return bgIndex;
    }

    /* 保存卡片数据到 localStorage */
    function saveCardData(dateStr, cardData) {
        localStorage.setItem('card_data_' + dateStr, JSON.stringify(cardData));
    }

    /* 获取已存储的卡片数据 */
    function getStoredCardData(dateStr) {
        const raw = localStorage.getItem('card_data_' + dateStr);
        return raw ? JSON.parse(raw) : null;
    }

    /* 展示卡片（3D翻转动画）dateStr 可选，默认今天 */
    async function showCard(dateStr) {
        dateStr = dateStr || window.localDate();
        const todayStr = window.localDate();
        const isToday = (dateStr === todayStr);

        const overlay = document.getElementById('card_overlay');
        const flipCard = document.getElementById('flip_card');
        const cardBack = flipCard.querySelector('.flip_card_back');

        /* 获取或生成卡片数据 */
        var cardData = getStoredCardData(dateStr);
        if (!cardData && isToday) {
            /* 今天首次签到，生成并保存 */
            cardData = await generateCardContent(dateStr);
            cardData.bgIndex = getTodayBgIndex();
            saveCardData(dateStr, cardData);
        } else if (!cardData) {
            /* 历史日期无数据（一般不会发生） */
            return;
        }

        /* 应用卡片背景 */
        var bgIndex = isToday ? getTodayBgIndex() : (cardData.bgIndex || 1);
        cardBack.style.background = "url('/images/card_bg_" + bgIndex + ".png') center/cover no-repeat";

        /* 设置卡片内容 */
        document.getElementById('card_title').textContent = cardData.title;
        document.getElementById('card_text').textContent = cardData.text;
        document.getElementById('card_tip').textContent = cardData.tip;
        const cardImage = document.getElementById('card_image');
        cardImage.src = cardData.image;
        cardImage.style.display = 'block';
        cardImage.style.objectFit = 'cover';

        /* 动画流程 */
        overlay.style.display = 'flex';
        flipCard.classList.remove('flipped', 'flyout', 'dropping');

        requestAnimationFrame(() => {
            flipCard.classList.add('popped');
        });

        setTimeout(() => {
            flipCard.classList.add('flipped');
        }, 900);
    }

    /* 暴露到全局，供日历点击调用 */
    window.showCheckinCard = showCard;

    /* 关闭卡片 */
    document.getElementById('card_close').addEventListener('click', () => {
        const flipCard = document.getElementById('flip_card');
        const overlay = document.getElementById('card_overlay');

        /* 翻转回去 */
        flipCard.classList.add('flyout');

        setTimeout(() => {
            /* 下落消失 */
            flipCard.classList.add('dropping');
        }, 500);

        setTimeout(() => {
            overlay.style.display = 'none';
            flipCard.classList.remove('popped', 'flipped', 'flyout', 'dropping');
        }, 1200);
    });

    /* 回填历史缺失的卡片数据 */
    async function backfillMissingCards() {
        const signDates = JSON.parse(localStorage.getItem('sign_dates') || '[]');
        for (var i = 0; i < signDates.length; i++) {
            const dateStr = signDates[i];
            if (!getStoredCardData(dateStr)) {
                const cardData = await generateCardContent(dateStr);
                cardData.bgIndex = Math.floor(Math.random() * 4) + 1;
                saveCardData(dateStr, cardData);
            }
        }
    }

    /* 帮助函数 */
    function getCurrentSeason(dateStr) {
        const m = (dateStr ? new Date(dateStr) : new Date()).getMonth() + 1;
        if (m >= 3 && m <= 5) return 'spring';
        if (m >= 6 && m <= 8) return 'summer';
        if (m >= 9 && m <= 11) return 'autumn';
        return 'winter';
    }

    function getTermEmoji(name) {
        const map = { '立春':'🌱', '雨水':'🌧', '惊蛰':'⚡', '春分':'🌸', '清明':'🌿', '谷雨':'🌾', '立夏':'☀️', '小满':'🌾', '芒种':'🌾', '夏至':'🔥', '小暑':'🌡', '大暑':'🥵', '立秋':'🍂', '处暑':'🌤', '白露':'💧', '秋分':'🍁', '寒露':'❄', '霜降':'🌫', '立冬':'🥶', '小雪':'🌨', '大雪':'❄', '冬至':'☃️', '小寒':'🧊', '大寒':'🥶' };
        return map[name] || '🌿';
    }

    function getHerbEmoji(name) {
        const map = { '枸杞':'🔴', '当归':'🟤', '黄芪':'🟡', '菊花':'🌼', '金银花':'🌸', '山药':'🥔', '茯苓':'⬜', '薏苡仁':'⚪', '桂圆':'🟤', '百合':'🤍', '麦冬':'🌿', '莲子':'⚪', '陈皮':'🟠', '红枣':'🔴', '生姜':'🟡', '山楂':'🔴', '肉桂':'🟤', '银耳':'⚪', '党参':'🟡', '杜仲':'🟤' };
        return map[name] || '🌿';
    }

    function getFallbackHerbs() {
        return [
            { name: '枸杞', effect: '滋补肝肾，益精明目。', seasonalTips: { spring:'与菊花泡茶养肝', summer:'与银耳煲汤滋阴', autumn:'与雪梨炖食润肺', winter:'与羊肉炖汤温补' }, nature: '性平，味甘', meridian: '归肝、肾经' },
            { name: '当归', effect: '补血活血，调经止痛。', seasonalTips: { spring:'与黄芪炖鸡', summer:'配红枣煮水', autumn:'与党参炖汤', winter:'当归生姜羊肉汤' }, nature: '性温，味甘辛', meridian: '归肝、心、脾经' },
            { name: '菊花', effect: '散风清热，平肝明目。', seasonalTips: { spring:'与枸杞泡茶养肝', summer:'与金银花泡茶解暑', autumn:'搭配蜂蜜润燥', winter:'少量搭配红枣饮用' }, nature: '性微寒，味甘苦', meridian: '归肺、肝经' }
        ];
    }
});
