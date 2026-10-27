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

    /* 初始化 */
    async function init(year, month) {
        currentYear = year || new Date().getFullYear();
        currentMonth = month !== undefined ? month : new Date().getMonth(); /* 0-11 */

        /* 加载当前显示月份所属“节气年”的数据（1 月属于上一节气年） */
        await ensureTerms(currentYear, currentMonth);

        /* 加载签到日期（优先从后端，降级到本地缓存） */
        try {
            const historyResult = await API.getCheckinHistory();
            if (historyResult.success && historyResult.data) {
                signDates = historyResult.data.signDates || [];
                localStorage.setItem('sign_dates', JSON.stringify(signDates));
                localStorage.setItem('sign_streak', (historyResult.data.streak || 0).toString());
                localStorage.setItem('total_signs', (signDates.length).toString());
                if (signDates.length > 0) localStorage.setItem('last_sign_date', signDates[0]);
            } else {
                signDates = JSON.parse(localStorage.getItem('sign_dates') || '[]');
            }
        } catch (e) {
            signDates = JSON.parse(localStorage.getItem('sign_dates') || '[]');
        }

        render();
        bindEvents();
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

        const todayStr = window.localDate();

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
    function refreshSignDates() {
        signDates = JSON.parse(localStorage.getItem('sign_dates') || '[]');
        render();
    }

    /* 获取当前显示的年月 */
    function getCurrentDisplay() {
        return { year: currentYear, month: currentMonth };
    }

    return { init, refreshSignDates, getCurrentDisplay };
})();
