/* ==========================================
   config/time.js — 统一时区处理
   ------------------------------------------
   服务端所有“今天/现在”都走这里，避免依赖进程
   所在时区（很多云主机默认是 UTC）。默认按
   APP_TIMEZONE（Asia/Shanghai）计算。
   ========================================== */

const TIMEZONE = (() => {
    const tz = process.env.APP_TIMEZONE || 'Asia/Shanghai';
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz }).format();
        return tz;
    } catch (e) {
        console.warn(`无效的 APP_TIMEZONE：${tz}，已回退到 Asia/Shanghai`);
        return 'Asia/Shanghai';
    }
})();

const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
});

function parts(at = new Date()) {
    const out = {};
    for (const p of formatter.formatToParts(at)) {
        if (p.type !== 'literal') out[p.type] = p.value;
    }
    return out;
}

/* YYYY-MM-DD（按 APP_TIMEZONE） */
function today(at = new Date()) {
    const p = parts(at);
    return `${p.year}-${p.month}-${p.day}`;
}

/* YYYY-MM-DD HH:mm（按 APP_TIMEZONE，和数据库 DATETIME 格式一致） */
function now(at = new Date()) {
    const p = parts(at);
    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/* 日期字符串加减天数 */
function addDays(dateStr, delta) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + delta));
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
}

/* MySQL 会话时区偏移，如 +08:00 */
function offsetString(at = new Date()) {
    const name = new Intl.DateTimeFormat('en-US', {
        timeZone: TIMEZONE,
        timeZoneName: 'longOffset'
    }).formatToParts(at).find(p => p.type === 'timeZoneName');

    const m = name && name.value.match(/GMT([+-]\d{2}:\d{2})/);
    return m ? m[1] : '+00:00';
}

module.exports = { TIMEZONE, today, now, addDays, offsetString };
