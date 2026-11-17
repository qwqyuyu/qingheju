/* ==========================================
   checkin.js — 每日签到逻辑
   功能：签到按钮交互、3D翻转卡片动画、节气/药材知识卡片展示
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {

    /* 更新导航登录状态 */
    const user = API.getCurrentUser();
    if (user) {
        const navLink = document.getElementById('nav_user_link');
        if (navLink) { navLink.textContent = '我的'; navLink.href = 'profile.html'; }
    }

    const checkinBtn = document.getElementById('checkin_btn');
    const statusEl = document.getElementById('checkin_status');
    const checkinRetry = document.getElementById('checkin_retry');
    const overlay = document.getElementById('card_overlay');
    const flipCard = document.getElementById('flip_card');
    const cardClose = document.getElementById('card_close');
    const cardState = document.getElementById('card_state');
    const cardContent = document.getElementById('card_content');
    const cardImage = document.getElementById('card_image');
    const cardBackHint = document.getElementById('card_back_hint');

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
    var busy = false;                      /* 防止连点 */
    var initializing = false;              /* 初始化期间禁止签到 */

    /* 节气表只取一次：卡片按日期匹配节气，回填历史卡片时不再逐日请求接口 */
    var solarTermsCache = null;

    /* 回填历史卡片只做最近 30 天，更早的日期点开时再按需生成 */
    const BACKFILL_LIMIT = 30;

    /* 卡片缓存：结构版本 + 每个账号最多保留的张数 */
    const CARD_STORE_VERSION = 2;
    const CARD_STORE_LIMIT = 120;

    /* 卡片请求、动画与焦点均独立于签到请求 */
    var cardRequestId = 0;
    var cardLoading = false;
    var releaseCardFocus = null;
    var cardReady = false;    /* 内容已就绪，可点击翻开封面 */
    var cardFlipped = false;  /* 已翻开到内容面 */
    var cardCloseTimers = [];

    async function getSolarTermsOnce() {
        if (solarTermsCache) return solarTermsCache;
        try {
            const result = await API.getSolarTerms();
            if (result && result.success && Array.isArray(result.data)) {
                solarTermsCache = result.data;
            }
        } catch (e) {
            /* 不缓存失败结果；卡片区域重试时会重新请求。 */
        }
        return solarTermsCache || [];
    }

    /* 初始化失败时允许只重试状态确认，不把失败伪装成可签到。 */
    checkinRetry.addEventListener('click', initialize);

    /* 签到按钮点击事件 */
    checkinBtn.addEventListener('click', async () => {
        if (busy || initializing || historyFailed || checkinBtn.disabled) return;

        /* 已签到：再点只是查看今日卡片（依据来自服务端，不是本地缓存） */
        if (signedToday) {
            await window.showCheckinCard(serverToday);
            return;
        }

        busy = true;
        var outcome = null;
        setStatus('正在保存签到，请稍候', '');
        UI.busy(checkinBtn, true, '签到中…');

        try {
            const result = await API.checkin();

            if (result && result.success) {
                /* 只有服务端确认成功后才更新已签到状态、缓存与盖印。 */
                const dateStr = (result.data && result.data.date) || serverToday;
                serverToday = dateStr;
                signedToday = true;

                /* 合并写入本地缓存：加上今天，连续天数用服务端返回值（用法保持不变） */
                const signDates = readSignDates();
                if (signDates.indexOf(dateStr) < 0) signDates.unshift(dateStr);
                window.syncSignCache({
                    signDates: signDates,
                    streak: (result.data && result.data.streak) || 1
                });

                outcome = { ok: true, isNew: true, dateStr: dateStr, signDates: signDates };
            } else if (isAlreadyChecked(result)) {
                /* 409 只是提示可能已签到，必须重新向服务端确认后才能盖印。 */
                const synced = await resyncHistory();
                if (synced && signedToday) {
                    outcome = {
                        ok: true,
                        isNew: false,
                        dateStr: serverToday,
                        signDates: readSignDates()
                    };
                } else {
                    outcome = { ok: false, message: '签到状态确认失败，请重试' };
                }
            } else {
                outcome = {
                    ok: false,
                    message: (result && (result.message || result.msg)) || '签到失败，请稍后重试'
                };
            }
        } catch (e) {
            outcome = { ok: false, message: '网络错误，请稍后重试' };
        } finally {
            UI.busy(checkinBtn, false);
            busy = false;
        }

        if (outcome && outcome.ok) {
            setSignedState();
            loadSignStats();
            Calendar.refreshSignDates(outcome.signDates);
            if (outcome.isNew) UI.toast('签到成功', 'success');

            /* 卡片成败不再改变签到结果，也不会触发第二次签到。 */
            await window.showCheckinCard(outcome.dateStr);
            return;
        }

        /* 签到失败：保留未签到原状态，主按钮即为恢复入口，不盖印。 */
        signedToday = false;
        resetUnsignedState();
        checkinBtn.disabled = false;
        checkinBtn.removeAttribute('aria-disabled');
        const message = (outcome && outcome.message) || '签到失败，请稍后重试';
        setStatus(message + '，可再次点击签到', 'error');
        UI.toast(message, 'error');
    });

    /* 卡片重试只重新加载卡片，不调用 API.checkin。 */
    UI.bindRetry(cardState, function () {
        const dateStr = cardState.dataset.date;
        if (dateStr) window.showCheckinCard(dateStr);
    });

    /* 关闭卡片 */
    cardClose.addEventListener('click', closeCard);
    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeCard();
    });

    /* 点击封面（或键盘 Enter/空格）翻开内容面 */
    flipCard.addEventListener('click', function (e) {
        if (!cardReady || cardFlipped) return;
        if (e.target.closest('button, a, input, textarea')) return;
        flipCardOpen();
    });

    flipCard.addEventListener('keydown', function (e) {
        if (!cardReady || cardFlipped) return;
        if (e.target !== flipCard) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            flipCardOpen();
        }
    });

    /* 暴露到全局，供日历点击调用，并统一处理今日卡片的状态文案。 */
    window.showCheckinCard = async function (dateStr) {
        const result = await showCard(dateStr);
        if (dateStr === serverToday && signedToday) {
            if (result === false) {
                setStatus('签到成功，知识卡暂未加载', 'error');
            } else if (result === true) {
                setSignedState();
            }
        }
        return result;
    };

    /* 进入页面立即确认；HTML 本身也已提供禁用与忙碌首屏，避免脚本加载前误点。 */
    initialize();

    /* ---------- 初始化与签到状态相关工具 ---------- */

    async function initialize() {
        if (initializing || busy) return;

        const restoreRetryFocus = document.activeElement === checkinRetry;
        initializing = true;
        historyFailed = false;
        signedToday = false;
        checkinRetry.hidden = true;
        checkinBtn.classList.remove('signed');
        checkinBtn.setAttribute('aria-label', '正在确认签到状态');
        setStatus('正在确认签到状态，请稍候', '');
        UI.busy(checkinBtn, true, '正在确认签到状态');

        var ready = false;
        var history = null;

        try {
            /* 只拉一次签到记录：按钮状态、统计、日历三处共用。 */
            history = user ? await fetchCheckinHistory() : null;
            if (user && !applyHistory(history)) historyFailed = true;

            /* 节气加载失败不会阻断日历和签到状态确认。 */
            await Calendar.init({ history: history || { success: false }, today: serverToday });
            if (historyFailed) throw new Error('签到状态确认失败');

            /* 历史卡片回填是附加能力，失败不影响已经确认的签到状态。 */
            try {
                await backfillMissingCards();
            } catch (e) {
                /* 用户打开具体卡片时仍可单独加载与重试。 */
            }
            pruneCardData();
            loadSignStats();
            ready = true;
        } catch (e) {
            historyFailed = true;
            signedToday = false;
            loadSignStats();
        } finally {
            UI.busy(checkinBtn, false);
            initializing = false;
        }

        if (ready) {
            historyFailed = false;
            checkinBtn.disabled = false;
            checkinBtn.removeAttribute('aria-disabled');
            updateCheckinButton();
            if (restoreRetryFocus) checkinBtn.focus();
        } else {
            showInitializationError(restoreRetryFocus);
        }
    }

    function showInitializationError(restoreFocus) {
        resetUnsignedState();
        checkinBtn.disabled = true;
        checkinBtn.setAttribute('aria-disabled', 'true');
        checkinBtn.setAttribute('aria-label', '签到状态确认失败，请重新确认');
        setStatus('签到状态确认失败，请检查网络后重试', 'error');
        checkinRetry.hidden = false;
        if (restoreFocus) checkinRetry.focus();
    }

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
        const dates = Array.isArray(result.data.signDates) ? result.data.signDates : [];
        signedToday = (typeof result.data.checkedInToday === 'boolean')
            ? result.data.checkedInToday
            : dates.indexOf(serverToday) >= 0;
        return true;
    }

    /* 重新拉一次签到记录（409 之后用来纠正本地状态） */
    async function resyncHistory() {
        const latest = await fetchCheckinHistory();
        if (applyHistory(latest)) {
            historyFailed = false;
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

    function setStatus(message, type) {
        statusEl.textContent = message;
        statusEl.classList.toggle('is_error', type === 'error');
        statusEl.classList.toggle('is_ok', type === 'success');
    }

    /* 渲染签到按钮的初始状态 */
    function updateCheckinButton() {
        if (signedToday) {
            setSignedState();
            return;
        }
        resetUnsignedState();
        setStatus('点击按钮，获取今日养生知识卡片', '');
    }

    /* 设置为已签到状态；按钮仍可点击查看今日卡片。 */
    function setSignedState() {
        checkinBtn.classList.add('signed');
        checkinBtn.innerHTML = '<span class="checkin_btn_text">已签到</span><span class="checkin_btn_icon" aria-hidden="true">' + UI.icon('check', 19, { strokeWidth: 2.2 }) + '</span>';
        checkinBtn.setAttribute('aria-label', '今日已签到，查看今日养生知识卡片');
        setStatus('已签到 · 点击按钮查看今日知识卡片', 'success');
    }

    /* 恢复为未签到状态 */
    function resetUnsignedState() {
        checkinBtn.classList.remove('signed');
        checkinBtn.innerHTML = '<span class="checkin_btn_text">今日签到</span><span class="checkin_btn_icon" aria-hidden="true">' + UI.icon('yinyang', 19, { strokeWidth: 1.5 }) + '</span>';
        checkinBtn.setAttribute('aria-label', '今日签到');
    }

    /* 加载签到统计数据 */
    function loadSignStats() {
        try {
            document.getElementById('stat_streak').textContent = window.getSignStreak();
            document.getElementById('stat_total').textContent = window.getTotalSigns();
        } catch (e) {
            document.getElementById('stat_streak').textContent = '—';
            document.getElementById('stat_total').textContent = '—';
        }
    }

    /* ---------- 知识卡片数据 ---------- */

    /* 生成卡片内容 */
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
                herbs = (herbsResult && Array.isArray(herbsResult.data)) ? herbsResult.data : [];
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

        const cardData = { title: cardTitle, text: cardText, tip: cardTip, image: cardImgPath, isTerm: cardIsTerm };
        if (!cardData.title || !cardData.text) throw new Error('知识卡内容不完整');
        return cardData;
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

    /* ---------- 知识卡片显示、独立错误与焦点管理 ---------- */

    function prefersReducedMotion() {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function setCardBackHint(text) {
        if (cardBackHint) cardBackHint.textContent = text || '';
    }

    function clearCardTimers() {
        cardCloseTimers.forEach(clearTimeout);
        cardCloseTimers = [];
    }

    function openCardDialog() {
        clearCardTimers();
        overlay.style.display = 'flex';
        overlay.style.pointerEvents = 'auto';
        overlay.classList.add('show');
        overlay.setAttribute('aria-hidden', 'false');

        if (!releaseCardFocus) {
            releaseCardFocus = UI.trapFocus(flipCard, {
                onEscape: closeCard,
                initialFocus: flipCard
            });
        }
    }

    /* 点击封面翻开；内容未就绪或已翻开时忽略 */
    function flipCardOpen() {
        if (!cardReady || cardFlipped) return;
        cardFlipped = true;
        cardReady = false;
        flipCard.classList.remove('can_flip');
        flipCard.classList.add('flipped');
        setCardBackHint('');
        cardClose.focus({ preventScroll: true });
    }

    function showCardLoading(dateStr) {
        cardReady = false;
        cardFlipped = false;
        flipCard.classList.remove('is_resolving', 'flipped', 'flyout', 'dropping', 'can_flip');
        /* 直接弹出封面，不再先露出内容面；强制一次布局让上升动画正常开始 */
        void flipCard.offsetWidth;
        flipCard.classList.add('popped');
        cardContent.hidden = true;
        cardImage.hidden = true;
        cardState.hidden = true;
        cardState.dataset.date = dateStr;
        cardState.innerHTML = '';
        setCardBackHint('正在准备知识卡…');
        flipCard.focus({ preventScroll: true });
    }

    function showCardError(dateStr) {
        openCardDialog();
        cardReady = false;
        cardFlipped = false;
        flipCard.classList.remove('popped', 'flipped', 'flyout', 'dropping', 'can_flip');
        flipCard.classList.add('is_resolving');
        cardContent.hidden = true;
        cardImage.hidden = true;
        cardState.hidden = false;
        cardState.dataset.date = dateStr;
        cardState.innerHTML = UI.stateHTML('error', {
            text: '知识卡暂未加载',
            hint: '签到结果不会受影响，可只重试当前卡片。',
            actionText: '重试'
        });
        cardClose.focus();
    }

    /* 展示卡片（3D翻转动画）dateStr 可选，默认今天。
       返回 true=成功，false=失败，null=重复请求或已被关闭/新请求取代。 */
    async function showCard(dateStr) {
        if (cardLoading) return null;

        const todayStr = serverToday || window.localDate();
        dateStr = dateStr || todayStr;
        const isToday = (dateStr === todayStr);
        const requestId = ++cardRequestId;
        cardLoading = true;

        try {
            openCardDialog();
            showCardLoading(dateStr);

            /* 获取或生成卡片数据：今天首次签到、或历史卡片还没回填时按需生成 */
            var cardData = getStoredCardData(dateStr);
            if (!cardData || !cardData.title || !cardData.text) {
                cardData = await generateCardContent(dateStr);
                cardData.bgIndex = isToday ? getTodayBgIndex() : (Math.floor(Math.random() * 4) + 1);
                saveCardData(dateStr, cardData);
            }
            if (requestId !== cardRequestId) return null;

            const cardBack = flipCard.querySelector('.flip_card_back');
            var bgIndex = isToday ? getTodayBgIndex() : (cardData.bgIndex || 1);
            cardBack.style.background = "url('/images/card_bg_" + bgIndex + ".png') center/cover no-repeat";

            /* 设置卡片内容 */
            document.getElementById('card_title').textContent = cardData.title;
            document.getElementById('card_text').textContent = cardData.text;
            document.getElementById('card_tip').textContent = cardData.tip || '';
            cardImage.src = cardData.image || '';
            cardImage.alt = cardData.title + '知识插图';
            cardImage.style.objectFit = 'cover';
            cardImage.hidden = !cardData.image;
            cardState.hidden = true;
            cardContent.hidden = false;

            /* 数据就绪：停在封面，等待用户点击翻开 */
            flipCard.classList.remove('is_resolving', 'flipped', 'flyout', 'dropping');
            flipCard.classList.add('popped', 'can_flip');
            cardReady = true;
            cardFlipped = false;
            setCardBackHint('轻触翻开');
            return true;
        } catch (e) {
            if (requestId !== cardRequestId) return null;
            showCardError(dateStr);
            return false;
        } finally {
            if (requestId === cardRequestId) cardLoading = false;
        }
    }

    function closeCard() {
        if (overlay.style.display === 'none') return;

        /* 使尚未完成的请求失效，避免关闭后旧结果重新改动弹窗。 */
        cardRequestId++;
        cardLoading = false;
        clearCardTimers();
        if (releaseCardFocus) {
            releaseCardFocus();
            releaseCardFocus = null;
        }
        overlay.setAttribute('aria-hidden', 'true');
        overlay.style.pointerEvents = 'none';
        overlay.classList.remove('show');

        function finishClose() {
            overlay.style.display = 'none';
            cardReady = false;
            cardFlipped = false;
            flipCard.classList.remove('popped', 'flipped', 'flyout', 'dropping', 'is_resolving', 'can_flip');
            setCardBackHint('轻触翻开');
        }

        if (prefersReducedMotion()) {
            finishClose();
            return;
        }

        flipCard.classList.add('flyout');
        cardCloseTimers.push(setTimeout(() => {
            flipCard.classList.add('dropping');
        }, 500));
        cardCloseTimers.push(setTimeout(finishClose, 1200));
    }

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

    function getFallbackHerbs() {
        return [
            { name: '枸杞', effect: '滋补肝肾，益精明目。', seasonalTips: { spring:'与菊花泡茶养肝', summer:'与银耳煲汤滋阴', autumn:'与雪梨炖食润肺', winter:'与羊肉炖汤温补' }, nature: '性平，味甘', meridian: '归肝、肾经' },
            { name: '当归', effect: '补血活血，调经止痛。', seasonalTips: { spring:'与黄芪炖鸡', summer:'配红枣煮水', autumn:'与党参炖汤', winter:'当归生姜羊肉汤' }, nature: '性温，味甘辛', meridian: '归肝、心、脾经' },
            { name: '菊花', effect: '散风清热，平肝明目。', seasonalTips: { spring:'与枸杞泡茶养肝', summer:'与金银花泡茶解暑', autumn:'搭配蜂蜜润燥', winter:'少量搭配红枣饮用' }, nature: '性微寒，味甘苦', meridian: '归肺、肝经' }
        ];
    }
});
