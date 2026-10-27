/* ==========================================
   上下文限制测试（不依赖数据库、不发网络请求）
   运行：node test/context.test.mjs
   ========================================== */

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
    normalizeMessages,
    estimateTokens,
    MESSAGE_OVERHEAD_TOKENS,
    TRUNCATE_MARK
} = require('../config/context.js');

function ok(name) {
    console.log('  ✓ ' + name);
}

function totalTokens(list) {
    return list.reduce((sum, m) => sum + estimateTokens(m.content) + MESSAGE_OVERHEAD_TOKENS, 0);
}

/* 1. 条数上限 */
const many = Array.from({ length: 40 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: '第' + i + '条消息'
}));
let kept = normalizeMessages(many, { maxMessages: 15, maxTokens: 80000 });
assert.ok(kept.length <= 15, '最多 15 条，实际 ' + kept.length);
assert.equal(kept[kept.length - 1].content, '第39条消息', '最新一条必须保留');
assert.equal(kept[0].role, 'user', '裁剪后应以 user 开头');
ok('只保留最近 15 条且以 user 开头（实际 ' + kept.length + ' 条）');

/* 2. 全是 user 时正好保留 15 条 */
const allUser = Array.from({ length: 20 }, (_, i) => ({ role: 'user', content: '问题' + i }));
kept = normalizeMessages(allUser, { maxMessages: 15, maxTokens: 80000 });
assert.equal(kept.length, 15);
assert.equal(kept[0].content, '问题5');
ok('20 条裁到 15 条');

/* 3. 开头的 assistant 会被丢掉 */
kept = normalizeMessages([
    { role: 'assistant', content: '上一轮回答' },
    { role: 'user', content: '新问题' }
], { maxMessages: 15 });
assert.deepEqual(kept.map(m => m.role), ['user']);
ok('开头的 assistant 消息被移除');

/* 4. 80000 tokens 总预算 */
const long = Array.from({ length: 15 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: '中'.repeat(10000)
}));
kept = normalizeMessages(long, { maxMessages: 15, maxTokens: 80000 });
assert.ok(kept.length >= 1);
assert.ok(totalTokens(kept) <= 80000, '总量 ' + totalTokens(kept) + ' 应 <= 80000');
assert.equal(kept[kept.length - 1].content.length, 10000, '最新一条应完整保留');
ok('超出 token 预算时从最早的消息开始丢弃（保留 ' + kept.length + ' 条，' + totalTokens(kept) + ' tokens）');

/* 5. 单条超大消息：截断并加标记（单条字符上限放宽，直接触发 token 预算） */
kept = normalizeMessages([{ role: 'user', content: '中'.repeat(200000) }], {
    maxMessages: 15,
    maxMessageChars: 300000,
    maxTokens: 80000
});
assert.equal(kept.length, 1);
assert.ok(kept[0].content.endsWith(TRUNCATE_MARK), '应带截断标记');
assert.ok(totalTokens(kept) <= 80000, '截断后 ' + totalTokens(kept) + ' 应 <= 80000');
ok('单条超预算时截断并标记（' + totalTokens(kept) + ' tokens）');

/* 6. 单条字符上限（截断并标记） */
kept = normalizeMessages([{ role: 'user', content: 'a'.repeat(100000) }], {
    maxMessageChars: 20000,
    maxTokens: 80000
});
assert.equal(kept.length, 1);
assert.equal(kept[0].content.length, 20000 + TRUNCATE_MARK.length);
assert.ok(kept[0].content.startsWith('a'.repeat(20000)));
assert.ok(kept[0].content.endsWith(TRUNCATE_MARK));
ok('单条消息按 20000 字符截断并标记');

/* 7. 非法消息被过滤 */
kept = normalizeMessages([
    null,
    { role: 'system', content: 'x' },
    { role: 'user', content: '' },
    { role: 'user', content: '   ' },
    { role: 'user', content: '有效问题' }
], { maxMessages: 15 });
assert.deepEqual(kept, [{ role: 'user', content: '有效问题' }]);
assert.deepEqual(normalizeMessages('not-an-array'), []);
ok('非法/空消息被过滤');

/* 8. token 估算方向正确（中文高估、英文 4 字符约 1 token） */
assert.equal(estimateTokens('你好'), 2);
assert.equal(estimateTokens('abcd'), 1);
assert.ok(estimateTokens('中文') > estimateTokens('ab'));
ok('token 估算：中文 1 字 1 token，英文 4 字符 1 token');

console.log('\n上下文限制测试全部通过。');
