/* ==========================================
   配置向导测试：node test/setup.test.mjs
   ------------------------------------------
   不需要数据库、不修改 server/.env：
   全部用 --out 指向临时文件，验证 setup.js 的写入/备份/校验行为。
   （交互式提示本身靠人工验证；这里覆盖非交互路径，避免管道输入的平台差异）
   ========================================== */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const SETUP = path.join(ROOT, 'setup.js');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qingheju-setup-'));
const envFile = path.join(tmpDir, 'test.env');

const ok = (name) => console.log('  ✓ ' + name);

function run(args) {
    const result = spawnSync(process.execPath, [SETUP, ...args], { stdio: 'ignore' });
    return result.status;
}

function readText(file) {
    return fs.readFileSync(file, 'utf8');
}

/* 与 config/env.js 相同的解析规则 */
function parseEnv(text) {
    const map = new Map();
    for (const raw of String(text).split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const i = line.indexOf('=');
        if (i < 1) continue;
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
        map.set(line.slice(0, i).trim(), val);
    }
    return map;
}

try {
    /* 1. 配置不存在时 --check 应失败 */
    assert.notEqual(run(['--check', '--out', envFile]), 0);
    ok('--check：没有配置文件时返回非 0');

    /* 2. --yes 生成一份可用的默认配置 */
    assert.equal(run(['--yes', '--out', envFile]), 0);
    let map = parseEnv(readText(envFile));
    assert.equal(map.get('MYSQL_HOST'), '127.0.0.1');
    assert.equal(map.get('MYSQL_PORT'), '3306');
    assert.equal(map.get('MYSQL_DATABASE'), 'qingheju');
    assert.equal(map.get('APP_TIMEZONE'), 'Asia/Shanghai');
    assert.ok((map.get('JWT_SECRET') || '').length >= 32, '应自动生成 JWT_SECRET');
    assert.equal(map.has('AI_BASE_URL'), false, '默认不写 AI 配置');
    assert.ok(readText(envFile).includes('# AI_BASE_URL='), '未配置 AI 时保留注释占位');
    ok('--yes：生成默认配置并自动生成 64 位 JWT 密钥');

    /* 3. --check 通过 */
    assert.equal(run(['--check', '--out', envFile]), 0);
    ok('--check：生成的配置可以启动');

    /* 4. 再次运行会备份，且保留已有密钥 */
    const jwt = map.get('JWT_SECRET');
    assert.equal(run(['--yes', '--out', envFile]), 0);
    const backups = fs.readdirSync(tmpDir).filter(f => f.startsWith('test.env.bak.'));
    assert.ok(backups.length >= 1, '重复运行应生成 .bak 备份');
    assert.equal(parseEnv(readText(envFile)).get('JWT_SECRET'), jwt, '重复运行应保留已有 JWT 密钥');
    ok('重复运行：自动备份原文件，已有配置保持不变');

    /* 5. 已有配置（含空格/引号/自定义键）应被正确保留与转义 */
    fs.writeFileSync(envFile, [
        'MYSQL_HOST=db.local',
        'MYSQL_PORT=3307',
        'MYSQL_USER=root',
        'MYSQL_PASSWORD="p@ss word#"',
        'MYSQL_DATABASE=qingheju',
        'JWT_SECRET=' + 'k'.repeat(40),
        'CUSTOM_FLAG=1',
        'AI_BASE_URL=https://gateway.example/v1',
        'AI_FORMAT=chat',
        'AI_MODEL=test-model',
        'AI_API_KEY=sk-test'
    ].join('\n') + '\n');

    assert.equal(run(['--yes', '--out', envFile]), 0);
    const text = readText(envFile);
    map = parseEnv(text);
    assert.equal(map.get('MYSQL_HOST'), 'db.local');
    assert.equal(map.get('MYSQL_PORT'), '3307');
    assert.equal(map.get('MYSQL_PASSWORD'), 'p@ss word#', '带空格和 # 的密码应能原样读回');
    assert.equal(map.get('CUSTOM_FLAG'), '1', '用户自定义键应保留');
    assert.equal(map.get('AI_FORMAT'), 'chat');
    assert.equal(map.get('AI_MODEL'), 'test-model');
    assert.ok(text.includes('MYSQL_PASSWORD="p@ss word#"'), '含空格的值应加引号写入');
    ok('保留自定义键，含空格/# 的值加引号写入且能被正确解析');

    /* 6. 帮助信息 */
    assert.equal(run(['--help']), 0);
    ok('--help 正常退出');

    /* 7. 非法的 --out 参数应报错 */
    assert.notEqual(run(['--out']), 0);
    ok('--out 缺少路径时返回非 0');
} finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
}

console.log('\n配置向导测试全部通过。');
