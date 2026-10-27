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
