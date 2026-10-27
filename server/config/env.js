/* ==========================================
   config/env.js — 加载 server/.env（本地开发用）
   ------------------------------------------
   已经有值的环境变量优先，不会被文件覆盖；
   生产环境没有 .env 时直接跳过。
   ========================================== */

const fs = require('fs');
const path = require('path');

module.exports = function loadEnv() {
    const file = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(file)) return;

    fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;

        const i = line.indexOf('=');
        if (i < 1) return;

        const key = line.slice(0, i).trim();
        let val = line.slice(i + 1).trim();

        /* 支持行内注释：
           · 未加引号的值去掉「空白 + #」之后的内容；
           · 加引号的值在闭合引号处结束，后面同样可以写注释。
           这样 `AI_FORMAT=chat  # chat | messages` 读成 chat，
           `MYSQL_PASSWORD="a#b"  # 口令` 读成 a#b。 */
        if (val.length > 0) {
            const quote = val[0];
            if (quote === '"' || quote === "'") {
                const end = val.indexOf(quote, 1);
                if (end > 0) val = val.slice(0, end + 1);
            } else {
                const hash = val.search(/\s#/);
                if (hash >= 0) val = val.slice(0, hash).trim();
            }
        }

        if (val.length >= 2) {
            const q1 = val[0];
            const q2 = val[val.length - 1];
            if ((q1 === '"' && q2 === '"') || (q1 === "'" && q2 === "'")) {
                val = val.slice(1, -1);
            }
        }

        if (!process.env[key]) process.env[key] = val;
    });
};
