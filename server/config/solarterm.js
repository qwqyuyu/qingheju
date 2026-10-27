/* ==========================================
   config/solarterm.js — 二十四节气日期计算
   ------------------------------------------
   节气由天文算法计算，不再依赖数据库里写死的日期。
   以“节气年”为单位：立春(当年 2 月) → 大寒(次年 1 月)，
   与页面现有的展示顺序保持一致。

   数据来源：js/vendor/lunar.js（lunar-javascript，寿星天文历算法）
   ========================================== */

const path = require('path');
const { Lunar, Solar } = require(path.join(__dirname, '..', '..', 'js', 'vendor', 'lunar.js'));
const { today } = require('./time');

/* 节气年顺序：立春 → 大雪（当年），冬至（当年 12 月），小寒/大寒（次年 1 月） */
const SPRING_TO_SNOW = [
    '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
    '立夏', '小满', '芒种', '夏至', '小暑', '大暑',
    '立秋', '处暑', '白露', '秋分', '寒露', '霜降',
    '立冬', '小雪', '大雪'
];
const TERM_NAMES = SPRING_TO_SNOW.concat(['冬至', '小寒', '大寒']);

const MIN_YEAR = 1900;
const MAX_YEAR = 2200;

const cache = new Map();

/* 2026-02-04 → 腊月十七 */
function toLunarDate(ymd) {
    const [y, m, d] = ymd.split('-').map(Number);
    const lunar = Solar.fromYmd(y, m, d).getLunar();
    return lunar.getMonthInChinese() + '月' + lunar.getDayInChinese();
}

/**
 * 计算某个“节气年”的 24 个节气。
 * @param {number} year 立春所在的公历年份
 * @returns {Array<{name: string, date: string, lunarDate: string}>}
 */
function termsOfYear(year) {
    const key = Number(year);
    if (cache.has(key)) return cache.get(key);

    const current = Lunar.fromYmd(key, 1, 1).getJieQiTable();
    const next = Lunar.fromYmd(key + 1, 1, 1).getJieQiTable();

    const items = [];
    const push = (name, solar) => {
        if (!solar) return;
        const date = solar.toYmd();
        items.push({ name, date, lunarDate: toLunarDate(date) });
    };

    for (const name of SPRING_TO_SNOW) push(name, current[name]);
    /* 库内部小写“冬至”指上一年 12 月，本公历年的冬至在 DONG_ZHI */
    push('冬至', current['DONG_ZHI']);
    push('小寒', next['小寒']);
    push('大寒', next['大寒']);

    cache.set(key, items);
    return items;
}

/* 当前“节气年”：今天在立春之前则属于上一年 */
function currentTermYear() {
    const year = Number(today().slice(0, 4));
    const terms = termsOfYear(year);
    const lichun = terms.length > 0 ? terms[0].date : year + '-02-04';
    return today() < lichun ? year - 1 : year;
}

module.exports = { termsOfYear, currentTermYear, TERM_NAMES, MIN_YEAR, MAX_YEAR };
