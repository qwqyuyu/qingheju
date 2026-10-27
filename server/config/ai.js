/* ==========================================
   config/ai.js — AI 服务配置
   ------------------------------------------
   只有四个必填变量（都放在 server/.env，不会提交）：
     AI_BASE_URL   接口地址（含 /v1）
     AI_FORMAT     接口格式：responses | chat | messages
     AI_API_KEY    Key
     AI_MODEL      模型名
   可选：AI_MAX_TOKENS / AI_TEMPERATURE
   ========================================== */

const rawFormat = (process.env.AI_FORMAT || process.env.AI_API_MODE || 'responses').toLowerCase();
const format = ['responses', 'chat', 'messages'].includes(rawFormat) ? rawFormat : 'responses';

function toNumber(value, fallback) {
    if (value === undefined || value === null || String(value).trim() === '') return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

/* 温度默认 0.8；填 default / omit / none 表示不传，使用模型默认值。
   Anthropic Messages 只接受 0–1，OpenAI 兼容接口允许到 2 */
const maxTokens = Math.max(1, Math.floor(toNumber(process.env.AI_MAX_TOKENS, 1000)));

/* 上下文限制：一次请求最多带多少条历史消息、输入 token 预算、单条消息字符上限 */
const maxMessages = Math.max(1, Math.floor(toNumber(process.env.AI_MAX_MESSAGES, 15)));
const contextTokens = Math.max(1000, Math.floor(toNumber(process.env.AI_CONTEXT_TOKENS, 80000)));
const maxMessageChars = Math.max(100, Math.floor(toNumber(process.env.AI_MAX_MESSAGE_CHARS, 20000)));

const tempRaw = process.env.AI_TEMPERATURE;
const tempText = String(tempRaw === undefined ? '' : tempRaw).trim().toLowerCase();
const omitTemperature = ['default', 'omit', 'none'].includes(tempText);
let temperature = null;
if (!omitTemperature) {
    temperature = Math.min(
        format === 'messages' ? 1 : 2,
        Math.max(0, toNumber(tempRaw, 0.8))
    );
}

module.exports = {
    baseURL: process.env.AI_BASE_URL || '',
    format,
    apiKey: process.env.AI_API_KEY || process.env.DASHSCOPE_API_KEY || '',
    model: process.env.AI_MODEL || '',
    maxTokens,
    maxMessages,
    contextTokens,
    maxMessageChars,
    temperature,
    /* 默认开启流式输出；AI_STREAM=false 关闭 */
    stream: String(process.env.AI_STREAM || 'true').toLowerCase() !== 'false'
};
