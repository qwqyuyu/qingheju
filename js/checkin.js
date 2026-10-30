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

    const checkinBtn = document.getElementById('checkin_btn');
    const statusEl = document.getElementById('checkin_status');

    /* ──────────────────────────────────────
       签到状态以服务端为准
       --------------------------------------
       本地缓存只用于首屏渲染和统计展示，绝不拿它判断
       “今天能不能签”。否则同一台设备切换账号后，缓存里
       上一个账号的“今天已签到”会把新账号的按钮锁死。
       ────────────────────────────────────── */
    var signedToday = false;               /* 服务端认定的“今天是否已签到” */
    var serverToday = window.localDate();  /* 服务端时区下的今天 */
    var historyFailed = false;             /* 签到记录没取到（断网/登录过期） */
    var busy = false;                       /* 防止连点 */

    /* 只拉一次签到记录：按钮状态、统计、日历三处共用 */
    var history = user ? await fetchCheckinHistory() : null;
    if (user && !applyHistory(history)) {
        historyFailed = true;
    }

    /* 节气表只取一次：卡片按日期匹配节气，回填历史卡片时不再逐日请求接口 */
    var solarTermsCache = null;

    /* 回填历史卡片只做最近 30 天，更早的日期点开时再按需生成 */
    const BACKFILL_LIMIT = 30;

    /* 卡片缓存：结构版本 + 每个账号最多保留的张数 */
    const CARD_STORE_VERSION = 2;
    const CARD_STORE_LIMIT = 120;

    async function getSolarTermsOnce() {
        if (solarTermsCache) return solarTermsCache;
        try {
            const result = await API.getSolarTerms();
            solarTermsCache = (result && result.success && Array.isArray(result.data)) ? result.data : [];
        } catch (e) {
            solarTermsCache = [];
        }
        return solarTermsCache;
    }

    /* 初始化日历：把已经拉到的结果传进去，不再重复请求接口 */
    await Calendar.init({ history: history || { success: false }, today: serverToday });

    /* 回填历史缺失的卡片数据 */
    await backfillMissingCards();

    /* 卡片缓存只保留最近一段，长期用户不至于无限增长 */
    pruneCardData();

    /* 加载签到统计 */
    loadSignStats();

    /* 渲染签到按钮的初始状态 */
    updateCheckinButton();

    /* 签到按钮点击事件 */
    checkinBtn.addEventListener('click', async () => {
        if (busy) return;

        /* 已签到：再点只是查看今日卡片（依据来自服务端，不是本地缓存） */
        if (signedToday) {
            await showCard(serverToday);
            return;
        }

        busy = true;
        try {
            const result = await API.checkin();

            if (result && result.success) {
                signedToday = true;
                const dateStr = (result.data && result.data.date) || serverToday;
                serverToday = dateStr;

                /* 合并写入本地缓存：加上今天，连续天数用服务端返回值 */
                const signDates = readSignDates();
                if (signDates.indexOf(dateStr) < 0) signDates.unshift(dateStr);
                window.syncSignCache({
                    signDates: signDates,
                    streak: (result.data && result.data.streak) || 1
                });

                setSignedState();
                loadSignStats();
                Calendar.refreshSignDates(signDates);

                /* 显示卡片动画 */
                await showCard(dateStr);
                return;
            }

            if (isAlreadyChecked(result)) {
                /* 服务端说今天已经签过（另一台设备签的 / 时区差异 / 本地缓存脏）：
                   以服务端记录纠正本地状态，避免按钮“可点但一点就报错”的死循环 */
                await resyncHistory();
                signedToday = true;
                updateCheckinButton();
                Calendar.refreshSignDates();
                await showCard(serverToday);
                return;
            }

            statusEl.textContent = (result && result.message) || '签到失败，请稍后重试';
        } catch (e) {
            statusEl.textContent = '网络错误，请稍后重试';
        } finally {
            busy = false;
        }
    });

    /* ---------- 签到状态相关工具 ---------- */

    /* 拉签到记录，异常统一成 null */
    async function fetchCheckinHistory() {
        try {
            return await API.getCheckinHistory();
        } catch (e) {
            return null;
        }
    }

    /* 用接口结果刷新页面状态，返回是否成功 */
    function applyHistory(result) {
        if (!result || !result.success || !result.data) return false;

        window.syncSignCache(result.data);
        serverToday = result.data.serverToday || window.localDate();
        signedToday = (typeof result.data.checkedInToday === 'boolean')
            ? result.data.checkedInToday
            : (result.data.signDates || []).indexOf(serverToday) >= 0;
        return true;
    }

    /* 重新拉一次签到记录（409 之后用来纠正本地状态） */
    async function resyncHistory() {
        const latest = await fetchCheckinHistory();
        if (applyHistory(latest)) {
            historyFailed = false;
            loadSignStats();
            return true;
        }
        return false;
    }

    /* 服务端“今日已签到”的判定：409 或对应文案 */
    function isAlreadyChecked(result) {
        if (!result) return false;
        if (result.code === 409) return true;
        return /已签到/.test(result.message || result.msg || '');
    }

    /* 读本账号的签到日期缓存（只用于点击成功后拼接，不做状态判定） */
    function readSignDates() {
        try {
            const raw = localStorage.getItem(window.userKey('sign_dates'));
            const list = raw ? JSON.parse(raw) : [];
            return Array.isArray(list) ? list : [];
        } catch (e) {
            return [];
        }
    }

    /* 渲染签到按钮的初始状态 */
    function updateCheckinButton() {
        if (signedToday) {
            setSignedState();
            return;
        }
        resetUnsignedState();
        statusEl.textContent = historyFailed
            ? '签到状态加载失败，点击按钮即可签到'
            : '点击按钮，获取今日养生知识卡片';
    }

    /* 设置为已签到状态 */
    function setSignedState() {
        checkinBtn.querySelector('.checkin_btn_text').textContent = '已签到';
        checkinBtn.querySelector('.checkin_btn_icon').textContent = '✓';
        statusEl.textContent = '再次点击按钮查看今日卡片';
    }

    /* 恢复为未签到状态 */
    function resetUnsignedState() {
        checkinBtn.querySelector('.checkin_btn_text').textContent = '今日签到';
        checkinBtn.querySelector('.checkin_btn_icon').textContent = '☯';
    }

    /* 加载签到统计数据 */
    function loadSignStats() {
        document.getElementById('stat_streak').textContent = window.getSignStreak();
        document.getElementById('stat_total').textContent = window.getTotalSigns();
    }

    /* 生成今日卡片内容（仅当天首次签到调用） */
    async function generateCardContent(dateStr) {
        const solarTerms = await getSolarTermsOnce();
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
        const today = serverToday || window.localDate();
        const storedDate = localStorage.getItem(window.userKey('card_bg_date'));
        const storedIndex = parseInt(localStorage.getItem(window.userKey('card_bg_index')) || '0');
        if (storedDate === today && storedIndex > 0) {
            return storedIndex;
        }
        var bgIndex;
        do {
            bgIndex = Math.floor(Math.random() * 4) + 1;
        } while (bgIndex === storedIndex);
        localStorage.setItem(window.userKey('card_bg_date'), today);
        localStorage.setItem(window.userKey('card_bg_index'), bgIndex.toString());
        return bgIndex;
    }

    /* 保存卡片数据到 localStorage（按用户隔离，避免换账号后串卡片）。
       带版本号：卡片字段结构变更时递增 CARD_STORE_VERSION，旧缓存自动失效重生成。 */
    function saveCardData(dateStr, cardData) {
        try {
            localStorage.setItem(
                window.userKey('card_data_' + dateStr),
                JSON.stringify({ v: CARD_STORE_VERSION, at: Date.now(), data: cardData })
            );
        } catch (e) {
            /* 配额写满 / 隐私模式：卡片缓存失败不影响签到本身 */
        }
    }

    /* 获取已存储的卡片数据（兼容旧版本直接存卡片对象的格式） */
    function getStoredCardData(dateStr) {
        try {
            const raw = localStorage.getItem(window.userKey('card_data_' + dateStr));
            if (!raw) return null;
            const saved = JSON.parse(raw);
            if (!saved || typeof saved !== 'object') return null;
            if (saved.v === CARD_STORE_VERSION && saved.data && typeof saved.data === 'object') {
                return saved.data;
            }
            /* 旧格式：直接是 { title, text, tip, image } */
            if (saved.title && saved.text) return saved;
            return null;
        } catch (e) {
            return null;
        }
    }

    /* 只保留最近 CARD_STORE_LIMIT 张卡片：键名后缀是 YYYY-MM-DD，按字典序即时间序 */
    function pruneCardData() {
        try {
            const prefix = window.userKey('card_data_');
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.indexOf(prefix) === 0) keys.push(k);
            }
            if (keys.length <= CARD_STORE_LIMIT) return;
            keys.sort();
            const drop = keys.length - CARD_STORE_LIMIT;
            for (let i = 0; i < drop; i++) localStorage.removeItem(keys[i]);
        } catch (e) {
            /* ignore */
        }
    }

    /* 展示卡片（3D翻转动画）dateStr 可选，默认今天 */
    async function showCard(dateStr) {
        const todayStr = serverToday || window.localDate();
        dateStr = dateStr || todayStr;
        const isToday = (dateStr === todayStr);

        const overlay = document.getElementById('card_overlay');
        const flipCard = document.getElementById('flip_card');
        const cardBack = flipCard.querySelector('.flip_card_back');

        /* 获取或生成卡片数据：今天首次签到、或历史卡片还没回填时按需生成 */
        var cardData = getStoredCardData(dateStr);
        if (!cardData) {
            cardData = await generateCardContent(dateStr);
            cardData.bgIndex = isToday ? getTodayBgIndex() : (Math.floor(Math.random() * 4) + 1);
            saveCardData(dateStr, cardData);
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

    /* 回填历史缺失的卡片数据：只回填最近 BACKFILL_LIMIT 天。
       更早的日期在用户点开时按需生成（节气表已缓存，不会再发请求），
       避免连续签到几百天的老用户一进页面就串行处理几百次。 */
    async function backfillMissingCards() {
        const signDates = readSignDates();
        const recent = signDates.slice(0, BACKFILL_LIMIT);
        for (var i = 0; i < recent.length; i++) {
            const dateStr = recent[i];
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
