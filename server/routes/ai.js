/* ==========================================
   routes/ai.js — 小清 AI 智能问诊
   ------------------------------------------
   接口格式由 AI_FORMAT 决定：
     responses → POST {AI_BASE_URL}/responses
     chat      → POST {AI_BASE_URL}/chat/completions
     messages  → POST {AI_BASE_URL}/messages（Anthropic 格式）
   默认流式输出（AI_STREAM=true），客户端按 SSE 读取；
   AI_STREAM=false 时返回普通 JSON。
   两个路由都需要登录，并按用户限流（默认 10 分钟 30 次）。
   ========================================== */

const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const aiConfig = require('../config/ai');
const { normalizeMessages, estimateTokens } = require('../config/context');
const { authMiddleware } = require('../config/auth');
const { createRateLimiter } = require('../config/ratelimit');

let client = null;

/* 返回给浏览器的统一错误文案；上游的真实错误只写服务端日志 */
const PUBLIC_ERROR = 'AI 服务暂时不可用，请稍后重试';

/* 记录不支持自定义 temperature 的模型（如 claude-haiku-5-5） */
const noTemperatureModels = new Set();

function getClient() {
    if (!client) {
        client = new OpenAI({
            apiKey: aiConfig.apiKey,
            baseURL: aiConfig.baseURL
        });
    }
    return client;
}

function extractReply(response) {
    if (response && typeof response.output_text === 'string' && response.output_text.trim()) {
        return response.output_text.trim();
    }
    const parts = [];
    for (const item of (response && response.output) || []) {
        if (item && item.type === 'message' && Array.isArray(item.content)) {
            for (const part of item.content) {
                if (part && part.type === 'output_text' && part.text) {
                    parts.push(part.text);
                }
            }
        }
    }
    return parts.join('\n').trim();
}

function toAnthropicMessages(list) {
    const out = [];
    for (const m of list) {
        const last = out[out.length - 1];
        if (last && last.role === m.role) {
            last.content += '\n\n' + m.content;
        } else {
            out.push({ role: m.role, content: m.content });
        }
    }
    while (out.length && out[0].role !== 'user') out.shift();
    return out;
}

const SYSTEM_PROMPT = `你是"小清"，清和居中医养生平台的AI智能养生助手。你的角色定位：

1. **身份**：你是一位温和、耐心、博学的中医养生助手，名字叫"小清"，服务于清和居平台的用户。

2. **能力范围**：
   - 中医体质辨识（平和质、气虚质、阳虚质、阴虚质、痰湿质、湿热质、血瘀质、气郁质、特禀质）
   - 日常养生建议（饮食、作息、运动、情志调节）
   - 常见不适症状的中医分析和调理建议
   - 穴位按摩、艾灸、食疗等中医保健方法
   - 二十四节气养生知识

3. **回答风格**：
   - 用通俗易懂的中文，适当使用中医术语但需解释
   - 结构化回答，分条列出建议
   - 每次回答控制在300-600字
   - 语气温暖亲切，像朋友间的交流

4. **重要约束**：
   - 每个回答末尾必须附上免责提示："⚠️ AI建议仅供参考，不构成医疗诊断。如有健康问题请咨询专业中医师。"
   - 遇到急症、重症症状（如剧烈胸痛、高烧不退、大出血等），必须首先建议立即就医
   - 不要推荐具体药物和剂量
   - 不要对明确的疾病做出诊断

请以"小清"的身份回答用户的问题。`;

/* 消息部分的 token 预算：总上下文上限里扣掉 system prompt 与少量框架开销 */
function messageBudget() {
    const reserved = estimateTokens(SYSTEM_PROMPT) + 64;
    return Math.max(1000, aiConfig.contextTokens - reserved);
}

/* ---------- 参数构造 ---------- */

function canSendTemperature() {
    return aiConfig.temperature !== null && !noTemperatureModels.has(aiConfig.model);
}

function messagesBody(incoming, stream, withTemperature) {
    const body = {
        model: aiConfig.model,
        max_tokens: aiConfig.maxTokens,
        system: SYSTEM_PROMPT,
        messages: toAnthropicMessages(incoming)
    };
    if (stream) body.stream = true;
    if (withTemperature) body.temperature = aiConfig.temperature;
    return body;
}

function chatPayload(incoming, stream, withTemperature) {
    const payload = {
        model: aiConfig.model,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...incoming],
        max_tokens: aiConfig.maxTokens
    };
    if (stream) payload.stream = true;
    if (withTemperature) payload.temperature = aiConfig.temperature;
    return payload;
}

function responsesPayload(incoming, stream, withTemperature) {
    const payload = {
        model: aiConfig.model,
        instructions: SYSTEM_PROMPT,
        input: incoming,
        max_output_tokens: aiConfig.maxTokens
    };
    if (stream) payload.stream = true;
    if (withTemperature) payload.temperature = aiConfig.temperature;
    return payload;
}

/* ---------- Anthropic Messages ---------- */

async function postMessages(body, signal) {
    const url = aiConfig.baseURL.replace(/\/+$/, '') + '/messages';
    return fetch(url, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-api-key': aiConfig.apiKey,
            'authorization': 'Bearer ' + aiConfig.apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(body),
        signal
    });
}

async function errorText(response) {
    const data = await response.json().catch(() => ({}));
    return (data && data.error && data.error.message) || ('HTTP ' + response.status);
}

async function fetchMessages(incoming, stream, signal) {
    const withTemperature = canSendTemperature();
    let response = await postMessages(messagesBody(incoming, stream, withTemperature), signal);

    if (!response.ok && withTemperature) {
        const detail = await errorText(response.clone ? response.clone() : response);
        if (/temperature/i.test(detail)) {
            noTemperatureModels.add(aiConfig.model);
            console.warn('模型不支持自定义 temperature，已自动改用默认值:', aiConfig.model);
            response = await postMessages(messagesBody(incoming, stream, false), signal);
            if (!response.ok) throw new Error(await errorText(response));
            return response;
        }
        throw new Error(detail);
    }
    if (!response.ok) throw new Error(await errorText(response));
    return response;
}

/* ---------- OpenAI 兼容（chat / responses） ---------- */

async function requestChat(incoming, stream, signal) {
    const aiClient = getClient();
    const withTemperature = canSendTemperature();
    try {
        return await aiClient.chat.completions.create(chatPayload(incoming, stream, withTemperature), { signal });
    } catch (err) {
        if (withTemperature && /temperature/i.test(err.message || '')) {
            noTemperatureModels.add(aiConfig.model);
            console.warn('模型不支持自定义 temperature，已自动改用默认值:', aiConfig.model);
            return await aiClient.chat.completions.create(chatPayload(incoming, stream, false), { signal });
        }
        throw err;
    }
}

async function requestResponses(incoming, stream, signal) {
    const aiClient = getClient();
    const withTemperature = canSendTemperature();
    try {
        return await aiClient.responses.create(responsesPayload(incoming, stream, withTemperature), { signal });
    } catch (err) {
        if (withTemperature && /temperature/i.test(err.message || '')) {
            noTemperatureModels.add(aiConfig.model);
            console.warn('模型不支持自定义 temperature，已自动改用默认值:', aiConfig.model);
            return await aiClient.responses.create(responsesPayload(incoming, stream, false), { signal });
        }
        throw err;
    }
}

/* ---------- 非流式 ---------- */

async function callAI(incoming, signal) {
    const model = aiConfig.model;

    if (aiConfig.format === 'messages') {
        const response = await fetchMessages(incoming, false, signal);
        const data = await response.json().catch(() => ({}));
        const reply = (data.content || [])
            .filter(part => part && part.type === 'text' && part.text)
            .map(part => part.text)
            .join('\n')
            .trim();
        return { reply, model: data.model || model };
    }

    if (aiConfig.format === 'chat') {
        const completion = await requestChat(incoming, false, signal);
        const reply = completion.choices && completion.choices[0] && completion.choices[0].message
            ? completion.choices[0].message.content
            : '';
        return { reply, model: completion.model || model };
    }

    const response = await requestResponses(incoming, false, signal);
    return { reply: extractReply(response), model: response.model || model };
}

/* ---------- 流式（SSE） ---------- */

function startSSE(res) {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
}

function sendSSE(res, payload) {
    if (!res.writableEnded) {
        res.write('data: ' + JSON.stringify(payload) + '\n\n');
    }
}

async function* ssePayloads(body) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let index;
        while ((index = buffer.indexOf('\n\n')) >= 0) {
            const block = buffer.slice(0, index);
            buffer = buffer.slice(index + 2);
            for (const line of block.split('\n')) {
                if (!line.startsWith('data:')) continue;
                const payload = line.slice(5).trim();
                if (!payload || payload === '[DONE]') continue;
                try {
                    yield JSON.parse(payload);
                } catch (e) { /* 忽略非 JSON 行 */ }
            }
        }
    }
}

async function streamAI(incoming, res, signal) {
    startSSE(res);

    let full = '';
    let modelUsed = aiConfig.model;
    const emit = (text) => {
        if (!text) return;
        full += text;
        sendSSE(res, { delta: text });
    };

    try {
        if (aiConfig.format === 'messages') {
            const response = await fetchMessages(incoming, true, signal);
            for await (const event of ssePayloads(response.body)) {
                if (event.type === 'message_start' && event.message && event.message.model) {
                    modelUsed = event.message.model;
                }
                if (event.type === 'content_block_delta' && event.delta &&
                    event.delta.type === 'text_delta' && event.delta.text) {
                    emit(event.delta.text);
                }
                if (event.type === 'error') {
                    throw new Error((event.error && event.error.message) || '上游返回错误');
                }
            }
        } else if (aiConfig.format === 'chat') {
            const stream = await requestChat(incoming, true, signal);
            for await (const chunk of stream) {
                if (chunk.model) modelUsed = chunk.model;
                const text = chunk.choices && chunk.choices[0] && chunk.choices[0].delta
                    ? chunk.choices[0].delta.content
                    : '';
                if (text) emit(text);
            }
        } else {
            const stream = await requestResponses(incoming, true, signal);
            for await (const event of stream) {
                if (event.type === 'response.output_text.delta' && event.delta) {
                    emit(event.delta);
                }
                if (event.type === 'response.completed' && event.response && event.response.model) {
                    modelUsed = event.response.model;
                }
                if (event.type === 'error') {
                    throw new Error((event.error && event.error.message) || '上游返回错误');
                }
            }
        }

        if (!full) throw new Error('AI 返回内容为空');
        sendSSE(res, { done: true, model: modelUsed, format: aiConfig.format });
    } catch (err) {
        if (signal && signal.aborted) {
            /* 客户端已断开：上游请求已被取消，没有人再读这个响应了 */
            console.log('AI 流式请求：客户端已断开，已取消上游请求');
        } else {
            /* 上游原始错误只写日志，不发给浏览器（可能带出网关地址、模型名等内部信息） */
            console.error('AI 流式接口错误:', err.status || '', err.message);
            sendSSE(res, { error: PUBLIC_ERROR });
        }
    } finally {
        res.end();
    }
}

/* ---------- 路由 ---------- */

async function handleAI(req, res) {
    /* 客户端中途断开（关页面、点停止）时取消上游请求，避免白白消耗 token。
       用 res 的 close：响应已正常结束（writableEnded）时不算断开。 */
    const controller = new AbortController();
    res.on('close', () => {
        if (!res.writableEnded) controller.abort();
    });

    try {
        const { messages } = req.body || {};
        const incoming = normalizeMessages(messages, {
            maxMessages: aiConfig.maxMessages,
            maxMessageChars: aiConfig.maxMessageChars,
            maxTokens: messageBudget()
        });
        if (incoming.length === 0) {
            return res.status(400).json({ code: 400, msg: '消息不能为空' });
        }

        if (!aiConfig.apiKey || !aiConfig.baseURL || !aiConfig.model) {
            return res.status(503).json({
                code: 503,
                msg: 'AI 服务未配置，请设置 AI_API_KEY / AI_BASE_URL / AI_MODEL'
            });
        }

        if (aiConfig.stream) {
            await streamAI(incoming, res, controller.signal);
            return;
        }

        const result = await callAI(incoming, controller.signal);
        if (!result.reply) throw new Error('AI 返回内容为空');

        res.json({
            code: 200,
            data: {
                reply: result.reply,
                model: result.model,
                format: aiConfig.format
            }
        });
    } catch (err) {
        if (controller.signal.aborted) {
            console.log('AI 请求：客户端已断开，已取消上游请求');
            return;
        }
        console.error('AI 接口错误:', err.status || '', err.message);
        if (!res.headersSent) {
            res.status(500).json({ code: 500, msg: PUBLIC_ERROR });
        } else {
            try { sendSSE(res, { error: PUBLIC_ERROR }); } catch (e) { /* ignore */ }
            res.end();
        }
    }
}

/* 按用户限流：默认 10 分钟 30 次，可用环境变量覆盖 */
const aiLimiter = createRateLimiter({
    windowMs: process.env.AI_RATE_LIMIT_WINDOW_MS,
    max: process.env.AI_RATE_LIMIT_MAX,
    message: '小清有点忙，请稍后再问（AI 调用过于频繁）'
});

router.post('/ai/chat', authMiddleware, aiLimiter, handleAI);
router.post('/ai/message', authMiddleware, aiLimiter, handleAI);

module.exports = router;
