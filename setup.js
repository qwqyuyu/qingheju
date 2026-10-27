#!/usr/bin/env node
/* ==========================================
   setup.js — 清和居 · 首次配置向导（Windows / macOS / Linux 通用）
   ------------------------------------------
   作用：
     · 第一次运行时，交互式填写数据库、JWT 密钥、可选 AI 配置，写入 server/.env
     · 已有的 server/.env 会先备份为 server/.env.bak.<时间戳>，再按「回车保留原值」的方式更新
     · 会尝试连接数据库并检查库是否存在（未安装依赖时自动跳过）
     · 不改动代码，也不依赖任何第三方包

   用法：
     node setup.js                       交互式配置（start.ps1 / start.sh 首次运行会自动调用）
     node setup.js --yes                 非交互：保留已有值，缺的用默认值并自动生成 JWT
     node setup.js --check               只检查 server/.env 是否可用于启动（0=可以，1=需要配置）
     node setup.js --out <路径>     写到指定文件（测试用）
     node setup.js --no-test             跳过数据库连接测试
     node setup.js --help                查看帮助
   ========================================== */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const crypto = require('node:crypto');
const { Writable } = require('node:stream');

const ROOT = __dirname;
const SERVER_DIR = path.join(ROOT, 'server');
const DEFAULT_ENV_FILE = path.join(SERVER_DIR, '.env');

const DEFAULTS = {
    APP_TIMEZONE: 'Asia/Shanghai',
    MYSQL_HOST: '127.0.0.1',
    MYSQL_PORT: '3306',
    MYSQL_USER: 'root',
    MYSQL_PASSWORD: '',
    MYSQL_DATABASE: 'qingheju',
    AI_FORMAT: 'responses',
    PORT: '3112',
    TRUST_PROXY: ''
};

/* 写入 .env 时的固定顺序（其余未知键会追加在后面） */
const MANAGED_ORDER = [
    'APP_TIMEZONE',
    'MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE',
    'JWT_SECRET',
    'TRUST_PROXY',
    'AI_BASE_URL', 'AI_FORMAT', 'AI_MODEL', 'AI_API_KEY',
    'PORT'
];

/* ---------- 命令行参数 ---------- */

function parseArgs(argv) {
    const args = { envFile: DEFAULT_ENV_FILE, check: false, yes: false, test: true, help: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--help' || a === '-h') args.help = true;
        else if (a === '--check') args.check = true;
        else if (a === '--yes' || a === '-y') args.yes = true;
        else if (a === '--no-test') args.test = false;
        else if (a === '--out') {
            const next = argv[++i];
            if (!next) { console.error('--out 需要一个文件路径'); process.exit(2); }
            args.envFile = path.resolve(next);
        }
        else if (a.startsWith('--out=')) args.envFile = path.resolve(a.slice('--out='.length));
        else {
            console.error('未知参数：' + a + '（用 --help 查看用法）');
            process.exit(2);
        }
    }
    return args;
}

function usage() {
    console.log(`
清和居 · 配置向导

用法：
  node setup.js                交互式填写配置，写入 server/.env
  node setup.js --yes          使用默认值/保留已有值，自动生成 JWT（适合自动化）
  node setup.js --check        只检查配置是否完整（可以启动返回 0）
  node setup.js --no-test      跳过数据库连接测试
  node setup.js --out X        写到指定文件（默认 server/.env）
  node setup.js --help         显示本帮助

说明：
  · server/.env 已被 .gitignore 忽略，不会提交；随时可以手工编辑。
  · 重复运行会先备份成 server/.env.bak.<时间戳>。
  · 启动脚本（start.ps1 / start.sh）发现配置缺失时，会自动调用本向导。
`);
}

/* ---------- .env 读取 / 写入 ---------- */

/* 与 server/config/env.js 相同的解析规则：支持行内注释与引号 */
function parseEnv(text) {
    const map = new Map();
    for (const rawLine of String(text).split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const i = line.indexOf('=');
        if (i < 1) continue;
        const key = line.slice(0, i).trim();
        let val = line.slice(i + 1).trim();

        if (val.length > 0) {
            const q = val[0];
            if (q === '"' || q === "'") {
                const end = val.indexOf(q, 1);
                if (end > 0) val = val.slice(0, end + 1);
            } else {
                const hash = val.search(/\s#/);
                if (hash >= 0) val = val.slice(0, hash).trim();
            }
        }
        if (val.length >= 2) {
            const q1 = val[0];
            const q2 = val[val.length - 1];
            if ((q1 === '"' && q2 === '"') || (q1 === "'" && q2 === "'")) val = val.slice(1, -1);
        }
        map.set(key, val);
    }
    return map;
}

function loadExisting(file) {
    try {
        return parseEnv(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        return new Map();
    }
}

/* 值里含空格/引号时加引号，保证 config/env.js 能原样读回 */
function formatValue(value) {
    const v = String(value == null ? '' : value);
    if (v === '') return { text: '', warning: '' };
    if (/^[A-Za-z0-9_./:@%+~#\-]+$/.test(v)) return { text: v, warning: '' };
    if (!v.includes('"')) return { text: '"' + v + '"', warning: '' };
    if (!v.includes("'")) return { text: "'" + v + "'", warning: '' };
    return { text: v, warning: '值里同时包含单引号和双引号，无法安全转义，请手工编辑 ' + 'server/.env' };
}

function buildEnvText(map, file) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const warnings = [];
    const line = (key) => {
        const { text, warning } = formatValue(map.get(key) || '');
        if (warning) warnings.push(warning);
        return key + '=' + text;
    };

    const out = [];
    out.push('# ==========================================');
    out.push('# 清和居 · 本地配置（由 setup.js 于 ' + stamp + ' 生成）');
    out.push('# 该文件已被 .gitignore 忽略，不会提交；可以直接手工编辑');
    out.push('# ==========================================');
    out.push('');
    out.push('# 时区：服务端“今天/现在”按它计算');
    out.push(line('APP_TIMEZONE'));
    out.push('');
    out.push('# 数据库（MariaDB / MySQL）');
    for (const key of ['MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE']) {
        out.push(line(key));
    }
    out.push('');
    out.push('# 登录密钥：至少 32 位随机字符串；轮换后所有旧 token 立即失效');
    out.push(line('JWT_SECRET'));
    out.push('');
    out.push('# 反向代理：部署在 nginx / 云平台后填 1；直连部署留空');
    out.push(line('TRUST_PROXY'));
    out.push('');

    const aiReady = map.get('AI_BASE_URL') && map.get('AI_MODEL') && map.get('AI_API_KEY');
    if (aiReady) {
        out.push('# AI 问诊（四项齐全才会启用；缺一项接口返回 503）');
        for (const key of ['AI_BASE_URL', 'AI_FORMAT', 'AI_MODEL', 'AI_API_KEY']) out.push(line(key));
    } else {
        out.push('# AI 问诊（可选）：填好下面四项即启用；不填时 AI 接口返回 503，其它功能不受影响');
        out.push('# AI_BASE_URL=https://your-gateway.example/v1');
        out.push('# AI_FORMAT=responses');
        out.push('# AI_MODEL=your-model');
        out.push('# AI_API_KEY=your-api-key');
    }
    out.push('');
    out.push('# 本地监听端口（start.ps1 / start.sh 会覆盖为启动参数）');
    out.push(line('PORT'));

    /* 保留用户自己加的其它配置 */
    const extras = [...map.keys()].filter(k => !MANAGED_ORDER.includes(k));
    if (extras.length > 0) {
        out.push('');
        out.push('# 其它自定义配置（保留原值）');
        for (const key of extras) out.push(line(key));
    }

    out.push('');
    return { text: out.join('\n'), warnings };
}

function backupIfExists(file) {
    if (!fs.existsSync(file)) return '';
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const bak = file + '.bak.' + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) +
        '-' + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
    fs.copyFileSync(file, bak);
    return bak;
}

/* ---------- 交互输入 ---------- */

function createPrompter() {
    let muted = false;
    const output = new Writable({
        write(chunk, encoding, callback) {
            if (!muted) process.stdout.write(chunk, encoding);
            callback();
        }
    });
    const rl = readline.createInterface({
        input: process.stdin,
        output,
        terminal: process.stdin.isTTY === true
    });

    /* 自己维护行队列：readline 会一次性读完管道里的所有行，
       如果用 rl.question() 逐个问，中间的空隙会把后几行丢掉 */
    const buffered = [];
    const waiting = [];
    let closed = false;

    rl.on('line', (line) => {
        if (waiting.length > 0) waiting.shift()(line);
        else buffered.push(line);
    });
    rl.on('close', () => {
        closed = true;
        while (waiting.length > 0) waiting.shift()(null);
    });

    function nextLine() {
        if (buffered.length > 0) return Promise.resolve(buffered.shift());
        if (closed) return Promise.resolve(null);
        return new Promise((resolve) => waiting.push(resolve));
    }

    async function ask(text, options) {
        const opts = options || {};
        const def = opts.def === undefined ? '' : String(opts.def);

        if (closed && buffered.length === 0) {
            /* 非交互/输入提前结束：直接采用默认值 */
            console.log(text + (opts.hidden ? '' : def));
            return def;
        }

        process.stdout.write(text);
        if (opts.hidden) muted = true;
        const raw = await nextLine();
        muted = false;
        /* 管道/重定向输入不会回显，这里补一行，日志才看得懂 */
        if (!process.stdin.isTTY) {
            process.stdout.write((opts.hidden ? (raw ? '***' : '') : (raw == null ? '' : raw)) + '\n');
        } else if (opts.hidden) {
            process.stdout.write('\n');
        }

        let value = String(raw == null ? '' : raw).trim();
        if (value === '') value = def;

        if (typeof opts.validate === 'function') {
            const err = opts.validate(value);
            if (err) {
                console.log('  ! ' + err);
                return ask(text, opts);
            }
        }
        return value;
    }

    return { ask, close: () => rl.close() };
}

/* ---------- 小工具 ---------- */

function mask(value, keep) {
    const v = String(value || '');
    if (!v) return '（空）';
    const n = keep === undefined ? 4 : keep;
    if (v.length <= n * 2) return v.slice(0, 2) + '***';
    return v.slice(0, n) + '…' + v.slice(-2);
}

function generateJwtSecret() {
    return crypto.randomBytes(48).toString('base64url');
}

async function testDatabase(cfg) {
    let mysql;
    try {
        mysql = require(path.join(SERVER_DIR, 'node_modules', 'mysql2', 'promise'));
    } catch (e) {
        return { skipped: true, reason: '还没安装依赖（先运行 npm install / start 脚本会自动装）' };
    }

    let conn = null;
    try {
        conn = await mysql.createConnection({
            host: cfg.host,
            port: Number(cfg.port),
            user: cfg.user,
            password: cfg.password,
            connectTimeout: 3000
        });
        const [verRows] = await conn.query('SELECT VERSION() AS v');
        const [dbRows] = await conn.query('SHOW DATABASES LIKE ?', [cfg.database]);
        return {
            ok: true,
            version: verRows[0] && verRows[0].v,
            dbExists: dbRows.length > 0
        };
    } catch (e) {
        return { ok: false, code: e.code || '', message: e.message };
    } finally {
        if (conn) {
            try { await conn.end(); } catch (e) { /* ignore */ }
        }
    }
}

function printDbHint(cfg) {
    const port = cfg.port === '3306' ? '' : ' -P ' + cfg.port;
    console.log('      常见原因：数据库服务没启动、端口/账号不对，或库还没导入。');
    console.log('      导入表结构（任选其一，在项目根目录执行）：');
    console.log('        Windows : Get-Content server\\schema.sql | mysql -h ' + cfg.host + port + ' -u ' + cfg.user + ' -p');
    console.log('        macOS/Linux: mysql -h ' + cfg.host + port + ' -u ' + cfg.user + ' -p < server/schema.sql');
}

/* ---------- 检查模式 ---------- */

function checkMode(file) {
    if (!fs.existsSync(file)) {
        console.error('未找到 ' + path.relative(ROOT, file) + '，请先运行：node setup.js');
        return 1;
    }
    const map = loadExisting(file);
    const jwt = map.get('JWT_SECRET') || '';
    if (jwt.length < 32) {
        console.error('JWT_SECRET 缺失或不足 32 位，请运行：node setup.js');
        return 1;
    }
    if (!map.get('MYSQL_HOST')) {
        console.error('MYSQL_HOST 未配置，请运行：node setup.js');
        return 1;
    }
    return 0;
}

/* ---------- 主流程 ---------- */

async function runWizard(args) {
    const file = args.envFile;
    const existing = loadExisting(file);
    const hasExisting = existing.size > 0;
    const prompt = createPrompter();

    const val = (key, fallback) => (existing.has(key) ? existing.get(key) : (fallback === undefined ? '' : fallback));
    const map = new Map(existing);

    console.log('');
    console.log('  ============================================');
    console.log('        清 和 居 · 首次配置向导');
    console.log('  ============================================');
    console.log('');
    console.log('  配置文件：' + path.relative(ROOT, file));
    if (hasExisting) console.log('  已存在配置：直接回车 = 保留原值（会先备份）');
    console.log('  随时可以按 Ctrl+C 取消，之后运行 node setup.js 再来一次');
    console.log('');

    /* ---- 1. 数据库 ---- */
    console.log('  [1/3] 数据库（MariaDB / MySQL）');
    const host = await prompt.ask('    主机 [' + val('MYSQL_HOST', DEFAULTS.MYSQL_HOST) + ']: ', {
        def: val('MYSQL_HOST', DEFAULTS.MYSQL_HOST),
        validate: (v) => (v ? '' : '主机不能为空')
    });
    const port = await prompt.ask('    端口 [' + val('MYSQL_PORT', DEFAULTS.MYSQL_PORT) + ']: ', {
        def: val('MYSQL_PORT', DEFAULTS.MYSQL_PORT),
        validate: (v) => (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 65535 ? '' : '端口需为 1-65535 的整数')
    });
    const user = await prompt.ask('    用户名 [' + val('MYSQL_USER', DEFAULTS.MYSQL_USER) + ']: ', {
        def: val('MYSQL_USER', DEFAULTS.MYSQL_USER),
        validate: (v) => (v ? '' : '用户名不能为空')
    });
    const passwordHint = existing.has('MYSQL_PASSWORD') && existing.get('MYSQL_PASSWORD')
        ? '[已设置，回车保留]'
        : '[默认空，直接回车]';
    const password = await prompt.ask('    密码 ' + passwordHint + ': ', {
        def: val('MYSQL_PASSWORD', DEFAULTS.MYSQL_PASSWORD),
        hidden: true
    });
    const database = await prompt.ask('    数据库名 [' + val('MYSQL_DATABASE', DEFAULTS.MYSQL_DATABASE) + ']: ', {
        def: val('MYSQL_DATABASE', DEFAULTS.MYSQL_DATABASE),
        validate: (v) => (/^[A-Za-z0-9_$]+$/.test(v) ? '' : '库名只支持字母、数字、下划线和 $')
    });

    map.set('MYSQL_HOST', host);
    map.set('MYSQL_PORT', port);
    map.set('MYSQL_USER', user);
    map.set('MYSQL_PASSWORD', password);
    map.set('MYSQL_DATABASE', database);

    if (args.test) {
        console.log('');
        console.log('    正在测试数据库连接…');
        const result = await testDatabase({ host, port, user, password, database });
        if (result.skipped) {
            console.log('    - 跳过：' + result.reason);
        } else if (result.ok) {
            console.log('    ✓ 连接成功：MySQL/MariaDB ' + (result.version || '') +
                '，库 ' + database + (result.dbExists ? ' 已存在' : ' 不存在'));
            if (!result.dbExists) {
                console.log('    ! 库还不存在，启动前请先导入 server/schema.sql（见文末提示）');
            }
        } else {
            console.log('    ✗ 连接失败：' + (result.message || result.code || '未知错误'));
            printDbHint({ host, port, user });
            const go = await prompt.ask('    仍然保存这份配置吗？[Y/n]: ', {
                def: 'y',
                validate: (v) => (/^[yn]$/i.test(v) ? '' : '请输入 y 或 n')
            });
            if (!/^y$/i.test(go)) {
                prompt.close();
                console.log('\n  已取消，没有写入任何文件。');
                return 1;
            }
        }
    }
    console.log('');

    /* ---- 2. JWT ---- */
    console.log('  [2/3] 登录密钥（JWT）');
    const oldJwt = val('JWT_SECRET', '');
    const jwtDefault = oldJwt.length >= 32 ? oldJwt : generateJwtSecret();
    const jwtNote = oldJwt.length >= 32
        ? '    已检测到现有密钥，回车保留；输入新值可轮换（会让所有旧 token 失效）'
        : '    已自动生成随机密钥，直接回车即可';
    console.log(jwtNote);
    const jwt = await prompt.ask('    密钥 [' + mask(jwtDefault, 6) + ']: ', {
        def: jwtDefault,
        validate: (v) => (v.length >= 32 ? '' : '密钥至少需要 32 位（建议直接用生成的随机串）')
    });
    map.set('JWT_SECRET', jwt);
    console.log('');

    /* ---- 3. AI（可选） ---- */
    console.log('  [3/3] 小清 AI 问诊（可选，跳过不影响其它功能）');
    const aiComplete = !!(val('AI_BASE_URL') && val('AI_MODEL') && val('AI_API_KEY'));
    const wantAi = await prompt.ask('    现在配置 AI 吗？[' + (aiComplete ? 'Y/n' : 'y/N') + ']: ', {
        def: aiComplete ? 'y' : 'n',
        validate: (v) => (/^[yn]$/i.test(v) ? '' : '请输入 y 或 n')
    });

    if (/^y$/i.test(wantAi)) {
        const baseUrl = await prompt.ask('    接口地址（需带 /v1）[' + (val('AI_BASE_URL') || 'https://your-gateway.example/v1') + ']: ', {
            def: val('AI_BASE_URL', ''),
            validate: (v) => {
                if (!/^https?:\/\//i.test(v)) return '需要以 http:// 或 https:// 开头';
                if (!/\/v1\/?$/i.test(v)) return '地址通常以 /v1 结尾（例如 https://gateway.example/v1）';
                return '';
            }
        });
        const fmtDefault = (map.get('AI_FORMAT') || 'responses').toLowerCase();
        const fmtIndex = { responses: '1', chat: '2', messages: '3' }[fmtDefault] || '1';
        console.log('    接口格式：1) responses  2) chat  3) messages');
        const fmt = await prompt.ask('    选择 [' + fmtIndex + ']: ', {
            def: fmtIndex,
            validate: (v) => (/^[123]$/.test(v) ? '' : '请输入 1、2 或 3')
        });
        const format = { 1: 'responses', 2: 'chat', 3: 'messages' }[fmt];
        const model = await prompt.ask('    模型名 [' + (val('AI_MODEL') || '以网关 /v1/models 为准') + ']: ', {
            def: val('AI_MODEL', ''),
            validate: (v) => (v ? '' : '模型名不能为空')
        });
        const keyHint = val('AI_API_KEY') ? '[已设置，回车保留]' : '';
        const apiKey = await prompt.ask('    API Key ' + keyHint + ': ', {
            def: val('AI_API_KEY', ''),
            hidden: true,
            validate: (v) => (v ? '' : 'API Key 不能为空（不想配置 AI 请选 n）')
        });
        map.set('AI_BASE_URL', baseUrl);
        map.set('AI_FORMAT', format);
        map.set('AI_MODEL', model);
        map.set('AI_API_KEY', apiKey);
    } else if (!aiComplete) {
        map.delete('AI_BASE_URL');
        map.delete('AI_FORMAT');
        map.delete('AI_MODEL');
        map.delete('AI_API_KEY');
    }
    console.log('');

    /* ---- 4. 高级选项（默认不改） ---- */
    const tzDefault = val('APP_TIMEZONE', DEFAULTS.APP_TIMEZONE);
    const portDefault = val('PORT', DEFAULTS.PORT);
    const trustDefault = val('TRUST_PROXY', DEFAULTS.TRUST_PROXY);
    const advanced = await prompt.ask(
        '  高级选项（时区 ' + tzDefault + ' / 端口 ' + portDefault + ' / 反向代理 ' + (trustDefault || '关') + '）要修改吗？[y/N]: ',
        { def: 'n', validate: (v) => (/^[yn]$/i.test(v) ? '' : '请输入 y 或 n') }
    );
    if (/^y$/i.test(advanced)) {
        const tz = await prompt.ask('    时区 [' + tzDefault + ']: ', { def: tzDefault });
        const listenPort = await prompt.ask('    监听端口 [' + portDefault + ']: ', {
            def: portDefault,
            validate: (v) => (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 65535 ? '' : '端口需为 1-65535 的整数')
        });
        const trust = await prompt.ask('    反向代理层数（直连留空，nginx/云平台填 1）[' + trustDefault + ']: ', {
            def: trustDefault,
            validate: (v) => (v === '' || /^\d+$/.test(v) || /^[A-Za-z]+$/.test(v) ? '' : '填数字（如 1）或留空')
        });
        map.set('APP_TIMEZONE', tz);
        map.set('PORT', listenPort);
        map.set('TRUST_PROXY', trust);
    } else {
        if (!map.has('APP_TIMEZONE')) map.set('APP_TIMEZONE', DEFAULTS.APP_TIMEZONE);
        if (!map.has('PORT')) map.set('PORT', DEFAULTS.PORT);
        if (!map.has('TRUST_PROXY')) map.set('TRUST_PROXY', DEFAULTS.TRUST_PROXY);
    }

    prompt.close();

    /* ---- 写入 ---- */
    const { text, warnings } = buildEnvText(map, file);
    const backup = backupIfExists(file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text, 'utf8');
    try {
        if (process.platform !== 'win32') fs.chmodSync(file, 0o600);
    } catch (e) { /* ignore */ }

    for (const w of warnings) console.log('  ! ' + w);
    if (backup) console.log('  已备份原配置：' + path.relative(ROOT, backup));
    console.log('  ✓ 已写入 ' + path.relative(ROOT, file));
    console.log('');
    console.log('  配置摘要：');
    console.log('    数据库      ' + map.get('MYSQL_USER') + '@' + map.get('MYSQL_HOST') + ':' + map.get('MYSQL_PORT') + '/' + map.get('MYSQL_DATABASE'));
    console.log('    JWT 密钥    ' + mask(map.get('JWT_SECRET'), 6));
    if (map.get('AI_BASE_URL')) {
        console.log('    AI          ' + map.get('AI_FORMAT') + ' / ' + map.get('AI_MODEL') + ' / Key ' + mask(map.get('AI_API_KEY'), 3));
    } else {
        console.log('    AI          未配置（AI 接口会返回 503，其它功能正常）');
    }
    console.log('');
    console.log('  下一步：');
    console.log('    1) 如果库还没建：导入 server/schema.sql（见下方命令）');
    console.log('       Windows  : Get-Content server\\schema.sql | mysql -h ' + map.get('MYSQL_HOST') +
        (map.get('MYSQL_PORT') === '3306' ? '' : ' -P ' + map.get('MYSQL_PORT')) + ' -u ' + map.get('MYSQL_USER') + ' -p');
    console.log('       macOS/Linux: mysql -h ' + map.get('MYSQL_HOST') +
        (map.get('MYSQL_PORT') === '3306' ? '' : ' -P ' + map.get('MYSQL_PORT')) + ' -u ' + map.get('MYSQL_USER') + ' -p < server/schema.sql');
    console.log('    2) 启动服务：');
    console.log('       Windows  : 双击 start.bat，或 .\\start.ps1');
    console.log('       macOS/Linux: ./start.sh');
    console.log('    3) 以后想改配置：node setup.js（会先备份原文件）');
    console.log('');
    return 0;
}

/* ---------- 入口 ---------- */

(async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        usage();
        return;
    }
    if (args.check) {
        process.exitCode = checkMode(args.envFile);
        return;
    }

    if (args.yes) {
        /* 非交互：保留已有值，缺的用默认值并自动生成 JWT */
        const map = new Map(loadExisting(args.envFile));
        if (!map.get('APP_TIMEZONE')) map.set('APP_TIMEZONE', DEFAULTS.APP_TIMEZONE);
        for (const key of ['MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE', 'PORT', 'TRUST_PROXY']) {
            if (!map.has(key)) map.set(key, DEFAULTS[key]);
        }
        if (!map.has('AI_FORMAT')) map.set('AI_FORMAT', DEFAULTS.AI_FORMAT);
        if (!map.get('JWT_SECRET') || String(map.get('JWT_SECRET')).length < 32) {
            map.set('JWT_SECRET', generateJwtSecret());
        }
        const { text, warnings } = buildEnvText(map, args.envFile);
        const backup = backupIfExists(args.envFile);
        fs.mkdirSync(path.dirname(args.envFile), { recursive: true });
        fs.writeFileSync(args.envFile, text, 'utf8');
        try {
            if (process.platform !== 'win32') fs.chmodSync(args.envFile, 0o600);
        } catch (e) { /* ignore */ }
        for (const w of warnings) console.log('  ! ' + w);
        if (backup) console.log('  已备份原配置：' + path.relative(ROOT, backup));
        console.log('  ✓ 已写入 ' + path.relative(ROOT, args.envFile) + '（非交互模式）');
        return;
    }

    try {
        process.exitCode = await runWizard(args);
    } catch (err) {
        console.error('\n配置失败：' + (err && err.message ? err.message : err));
        process.exitCode = 1;
    }
})();
