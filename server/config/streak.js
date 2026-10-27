/* ==========================================
   config/streak.js — 连续签到天数
   ------------------------------------------
   checkins.streak 记录的是“签到当天的连续天数”。
   读取时必须判断它是否仍然有效：最近一次签到是今天或昨天才算
   连续，否则已经断签，当前连续天数应为 0。
   ========================================== */

const { addDays } = require('./time');

/* lastDate：最近一次签到日期（YYYY-MM-DD）；lastStreak：当天记录的连续天数；
   todayStr：按业务时区计算的今天（YYYY-MM-DD） */
function activeStreak(lastDate, lastStreak, todayStr) {
    const streak = Number(lastStreak);
    if (!lastDate || !Number.isFinite(streak) || streak <= 0) return 0;

    const date = String(lastDate).slice(0, 10);
    if (date === todayStr || date === addDays(todayStr, -1)) return streak;
    return 0;
}

module.exports = { activeStreak };
