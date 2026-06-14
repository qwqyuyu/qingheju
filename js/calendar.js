/* ==========================================
   calendar.js — 日历渲染逻辑
   功能：生成月历网格、标注农历/节气、签到标记、红色毛笔圈动画
   ========================================== */

/* 农历日期数据（1900-2100）简化版，仅用于展示基本农历信息 */
const LUNAR_INFO = {
    /* 农历月名 */
    monthNames: ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'],
    /* 农历日名 */
    dayNames: [
        '初一','初二','初三','初四','初五','初六','初七','初八','初九','初十',
        '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十',
        '廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'
    ]
};

const Calendar = (() => {
    let currentYear, currentMonth;
    let solarTerms = [];
    let signDates = [];

    /* 初始化 */
    async function init(year, month) {
        currentYear = year || new Date().getFullYear();
        currentMonth = month !== undefined ? month : new Date().getMonth(); /* 0-11 */

        /* 加载节气数据 */
        const result = await API.getSolarTerms();
        if (result.success) {
            solarTerms = result.data;
        }

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

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

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

    /* 简化农历计算（仅作展示用） */
    function getLunarDay(year, month, day) {
        /* 使用简单的偏移近似，实际项目中应使用完整的农历算法库 */
        const date = new Date(year, month - 1, day);
        const lunarDayIndex = (date.getDate() + 15) % 30;
        return LUNAR_INFO.dayNames[lunarDayIndex];
    }

    /* 绑定翻页事件 + 日历格子点击 */
    function bindEvents() {
        document.getElementById('cal_prev').addEventListener('click', () => {
            currentMonth--;
            if (currentMonth < 0) { currentMonth = 11; currentYear--; }
            render();
        });

        document.getElementById('cal_next').addEventListener('click', () => {
            currentMonth++;
            if (currentMonth > 11) { currentMonth = 0; currentYear++; }
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
