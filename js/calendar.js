/* ==========================================
   calendar.js — 日历渲染逻辑
   功能：生成月历网格、标注农历/节气、签到标记、红色毛笔圈动画
   ========================================== */

/* 农历换算依赖 js/vendor/lunar.js（lunar-javascript），
   未加载时农历行自动隐藏，不会显示错误数据 */

const Calendar = (() => {
    let currentYear, currentMonth;
    let solarTerms = [];
    let loadedTermYears = new Set();
    let signDates = [];
    /* 服务端的“今天”（APP_TIMEZONE）。有值就优先用它，避免浏览器时区不同
       导致“签到按钮按服务端日期、日历高亮按本地日期”自相矛盾。 */
    let serverToday = '';

    /* 初始化
       init()                              按年月初始化（内部自己拉签到记录）
       init({ year, month, history, today }) 复用调用方已经拉到的签到记录与日期
       history 传入 { success: false } 时不再请求接口，直接用本地缓存渲染。 */
    async function init(options, month) {
        var history = null;

        if (options && typeof options === 'object') {
            currentYear = options.year || new Date().getFullYear();
            currentMonth = options.month !== undefined ? options.month : new Date().getMonth(); /* 0-11 */
            history = options.history || null;
            if (options.today) serverToday = options.today;
        } else {
            currentYear = options || new Date().getFullYear();
            currentMonth = month !== undefined ? month : new Date().getMonth(); /* 0-11 */
        }

        /* 加载当前显示月份所属“节气年”的数据（1 月属于上一节气年） */
        await ensureTerms(currentYear, currentMonth);

        /* 加载签到日期：接口优先；接口没给到（未登录/请求失败）才用本账号的本地缓存。
           缓存键带用户前缀，所以这里读到的绝不可能是别的账号的数据。 */
        if (history) {
            if (history.success && history.data) applyHistory(history.data);
            else signDates = readSignCache();
        } else {
            try {
                const result = await API.getCheckinHistory();
                if (result && result.success && result.data) applyHistory(result.data);
                else signDates = readSignCache();
            } catch (e) {
                signDates = readSignCache();
            }
        }

        render();
        bindEvents();
    }

    /* 把接口返回的签到数据落到本地（通过 common.js 的唯一写入口） */
    function applyHistory(data) {
        signDates = (data && Array.isArray(data.signDates)) ? data.signDates.slice() : [];
        if (data && data.serverToday) serverToday = data.serverToday;
        if (typeof window.syncSignCache === 'function') {
            window.syncSignCache({ signDates: signDates, streak: (data && data.streak) || 0 });
        }
    }

    /* 读本账号的签到日期缓存 */
    function readSignCache() {
        try {
            const raw = localStorage.getItem(window.userKey('sign_dates'));
            const list = raw ? JSON.parse(raw) : [];
            return Array.isArray(list) ? list : [];
        } catch (e) {
            return [];
        }
    }

    /* 节气接口按“节气年”返回（立春 → 次年大寒）：1 月属于上一年 */
    function termYearFor(year, month) {
        return month === 0 ? year - 1 : year;
    }

    /* 按需加载某个节气年的节气，跨年浏览时自动补齐 */
    async function ensureTerms(year, month) {
        const termYear = termYearFor(year, month);
        if (loadedTermYears.has(termYear)) return;
        const result = await API.getSolarTerms(termYear);
        if (result && result.success && Array.isArray(result.data)) {
            solarTerms = solarTerms.concat(result.data);
            loadedTermYears.add(termYear);
        }
    }

    /* 渲染日历 */
    function render() {
        const grid = document.getElementById('calendar_grid');
        const title = document.getElementById('cal_title');

        title.textContent = `${currentYear}年 ${currentMonth + 1}月`;

        /* 当月第一天和最后一天 */
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = firstDay.getDay(); /* 0=周日 */

        /* 上月最后几天 */
        const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();

        /* 优先用服务端日期，保证和签到按钮的判定口径一致 */
        const todayStr = serverToday || window.localDate();

        let cells = [];

        /* 上月填充格 */
        for (let i = startDayOfWeek - 1; i >= 0; i--) {
            const d = prevMonthLastDay - i;
            cells.push({ day: d, type: 'other_month' });
        }

        /* 当月日期 */
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const isToday = dateStr === todayStr;
            const isSigned = signDates.includes(dateStr);

            /* 查找当日节气 */
            const term = solarTerms.find(t => t.date === dateStr);

            /* 计算农历日期（简化计算） */
            const lunarDay = getLunarDay(currentYear, currentMonth + 1, d);

            cells.push({
                day: d,
                type: 'current_month',
                isToday,
                isSigned,
                term: term ? term.name : null,
                lunarDay,
                dateStr
            });
        }

        /* 下月填充格：补齐到 6 行 x 7 列 = 42 格 */
        const totalCells = cells.length;
        const remaining = totalCells <= 35 ? 35 - totalCells : 42 - totalCells;
        for (let d = 1; d <= remaining; d++) {
            cells.push({ day: d, type: 'other_month' });
        }

        /* 渲染 HTML */
        grid.innerHTML = cells.map(c => {
            let classes = ['calendar_cell'];
            if (c.type === 'other_month') classes.push('other_month');
            if (c.isToday) classes.push('today');
            if (c.isSigned) classes.push('signed');

            return `
                <div class="${classes.join(' ')}" data-date="${c.dateStr || ''}">
                    <span class="calendar_day">${c.day}</span>
                    ${c.lunarDay ? `<span class="calendar_lunar">${c.lunarDay}</span>` : ''}
                    ${c.term ? `<span class="calendar_term">${c.term}</span>` : ''}
                </div>
            `;
        }).join('');

        /* 签到格子重新触发动画（通过移除再添加 signed 类） */
        grid.querySelectorAll('.signed').forEach(cell => {
            cell.classList.remove('signed');
            void cell.offsetWidth; /* 强制重排 */
            cell.classList.add('signed');
        });
    }

    /* 农历日期：使用 lunar-javascript（js/vendor/lunar.js）
       初一显示月份（如“九月”“闰二月”），其余显示日（如“十七”） */
    function getLunarDay(year, month, day) {
        if (typeof Solar === 'undefined') return '';
        try {
            const lunar = Solar.fromYmd(year, month, day).getLunar();
            if (lunar.getDay() === 1) {
                /* 闰月时 getMonthInChinese() 自带“闰”字，如“闰六” */
                return lunar.getMonthInChinese() + '月';
            }
            return lunar.getDayInChinese();
        } catch (e) {
            return '';
        }
    }

    /* 绑定翻页事件 + 日历格子点击 */
    function bindEvents() {
        document.getElementById('cal_prev').addEventListener('click', async () => {
            currentMonth--;
            if (currentMonth < 0) { currentMonth = 11; currentYear--; }
            await ensureTerms(currentYear, currentMonth);
            render();
        });

        document.getElementById('cal_next').addEventListener('click', async () => {
            currentMonth++;
            if (currentMonth > 11) { currentMonth = 0; currentYear++; }
            await ensureTerms(currentYear, currentMonth);
            render();
        });

        /* 点击已签到日期查看当天卡片 */
        document.getElementById('calendar_grid').addEventListener('click', (e) => {
            const cell = e.target.closest('.calendar_cell.signed');
            if (!cell) return;
            const dateStr = cell.getAttribute('data-date');
            if (dateStr && window.showCheckinCard) {
                window.showCheckinCard(dateStr);
            }
        });
    }

    /* 刷新签到状态 */
    function refreshSignDates(dates) {
        signDates = Array.isArray(dates) ? dates.slice() : readSignCache();
        render();
    }

    /* 获取当前显示的年月 */
    function getCurrentDisplay() {
        return { year: currentYear, month: currentMonth };
    }

    return { init, refreshSignDates, getCurrentDisplay };
})();
