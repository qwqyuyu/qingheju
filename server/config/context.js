/* ==========================================
   config/context.js — AI 上下文裁剪
   ------------------------------------------
   两条硬限制（都可通过环境变量调整）：
     1. 最多保留最近 N 条消息（默认 15 条）
     2. 输入总预算 N tokens（默认 80000，含 system prompt）

   没有引入分词器依赖，用保守估算：
     中文/日文/韩文/全角/emoji 等宽字符 ≈ 1 字符 1 token（偏高估）
     其余字符 ≈ 4 字符 1 token
   高估只会让我们更早裁掉旧消息，不会把请求撑爆。

   裁剪顺序：先按条数取最近 N 条 → 单条超长截断 → 从最早的消息
   开始丢，直到总预算不超；若最新一条自身就超预算，截断它并加标记。
   ========================================== */

const MESSAGE_OVERHEAD_TOKENS = 4;
const TRUNCATE_MARK = '…（内容过长已截断）';

function isWideCodePoint(cp) {
    return (
        (cp >= 0x1100 && cp <= 0x11ff) ||   /* 韩文字母 */
        (cp >= 0x2e80 && cp <= 0x303f) ||   /* 中日韩部首/标点 */
        (cp >= 0x3040 && cp <= 0x33ff) ||   /* 假名/注音/符号 */
        (cp >= 0x3400 && cp <= 0x4dbf) ||   /* 扩展 A */
        (cp >= 0x4e00 && cp <= 0x9fff) ||   /* 基本汉字 */
        (cp >= 0xa000 && cp <= 0xa4cf) ||   /* 彝文 */
        (cp >= 0xac00 && cp <= 0xd7a3) ||   /* 韩文音节 */
        (cp >= 0xf900 && cp <= 0xfaff) ||   /* 兼容汉字 */
        (cp >= 0xfe30 && cp <= 0xfe4f) ||   /* 竖排标点 */
        (cp >= 0xff00 && cp <= 0xff60) ||   /* 全角字符 */
        (cp >= 0xffe0 && cp <= 0xffe6) ||
        (cp >= 0x1f300 && cp <= 0x1faff) || /* emoji */
        (cp >= 0x20000 && cp <= 0x3fffd)    /* 扩展 B 及以后 */
    );
}

/* 估算一段文本的 token 数（保守，宁多勿少） */
function estimateTokens(text) {
    if (!text) return 0;
    let wide = 0;
    let narrow = 0;
    for (const ch of String(text)) {
        if (isWideCodePoint(ch.codePointAt(0))) wide += 1;
        else narrow += 1;
    }
    return wide + Math.ceil(narrow / 4);
}

/* 把文本截到不超过 maxTokens 个 token（保留开头部分） */
function truncateToTokens(text, maxTokens) {
    if (estimateTokens(text) <= maxTokens) return text;
    const chars = Array.from(text);
    let low = 0;
    let high = chars.length;
    while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (estimateTokens(chars.slice(0, mid).join('')) <= maxTokens) low = mid;
        else high = mid - 1;
    }
    return chars.slice(0, low).join('');
}

/* 从最新一条往前装，装不下就停；最新一条自身超预算时截断它 */
function trimToBudget(messages, maxTokens) {
    const kept = [];
    let total = 0;

    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        const cost = estimateTokens(msg.content) + MESSAGE_OVERHEAD_TOKENS;

        if (total + cost <= maxTokens) {
            kept.unshift(msg);
            total += cost;
            continue;
        }

        /* 一条都还没装下，说明最新这条本身就超预算：截断后保留 */
        if (kept.length === 0) {
            const allowed = maxTokens - MESSAGE_OVERHEAD_TOKENS - estimateTokens(TRUNCATE_MARK);
            if (allowed > 0) {
                /* 可能已在单条字符上限处截断过一次，避免重复追加标记 */
                const base = msg.content.endsWith(TRUNCATE_MARK)
                    ? msg.content.slice(0, -TRUNCATE_MARK.length)
                    : msg.content;
                kept.unshift({
                    role: msg.role,
                    content: truncateToTokens(base, allowed) + TRUNCATE_MARK
                });
            }
        }
        break;
    }

    return kept;
}

/**
 * 清洗并裁剪前端传来的消息列表。
 *
 * @param {Array} list 原始 messages
 * @param {object} [options]
 * @param {number} [options.maxMessages=15]      最多保留的消息条数
 * @param {number} [options.maxMessageChars=20000] 单条消息字符上限
 * @param {number} [options.maxTokens=80000]     消息部分的 token 预算（不含 system prompt）
 * @returns {Array<{role: string, content: string}>}
 */
function normalizeMessages(list, options) {
    const opts = options || {};
    const maxMessages = Math.max(1, Math.floor(opts.maxMessages || 15));
    const maxMessageChars = Math.max(100, Math.floor(opts.maxMessageChars || 20000));
    const maxTokens = Math.max(100, Math.floor(opts.maxTokens || 80000));

    if (!Array.isArray(list)) return [];

    const cleaned = [];
    for (const item of list) {
        if (!item || (item.role !== 'user' && item.role !== 'assistant')) continue;
        if (typeof item.content !== 'string' || !item.content.trim()) continue;

        let content = item.content;
        const chars = Array.from(content);
        if (chars.length > maxMessageChars) {
            content = chars.slice(0, maxMessageChars).join('') + TRUNCATE_MARK;
        }
        cleaned.push({ role: item.role, content });
    }

    /* 只保留最近 maxMessages 条 */
    const recent = cleaned.slice(-maxMessages);

    /* 对话应以 user 开头；裁掉后可能留下开头的 assistant */
    while (recent.length > 1 && recent[0].role === 'assistant') recent.shift();

    return trimToBudget(recent, maxTokens);
}

module.exports = {
    estimateTokens,
    truncateToTokens,
    trimToBudget,
    normalizeMessages,
    TRUNCATE_MARK,
    MESSAGE_OVERHEAD_TOKENS
};
