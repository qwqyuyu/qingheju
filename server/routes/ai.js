/* ==========================================
   routes/ai.js — 小清 AI 智能问诊路由
   ========================================== */

const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const aiConfig = require('../config/ai');

const client = new OpenAI({
    apiKey: aiConfig.apiKey,
    baseURL: aiConfig.baseURL
});

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

/* POST /api/ai/chat */
router.post('/ai/chat', async (req, res) => {
    try {
        const { messages } = req.body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ code: 400, msg: '消息不能为空' });
        }

        const completion = await client.chat.completions.create({
            model: aiConfig.model,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                ...messages
            ],
            max_tokens: aiConfig.maxTokens,
            temperature: aiConfig.temperature
        });

        const reply = completion.choices[0].message.content;

        res.json({
            code: 200,
            data: {
                reply: reply,
                model: completion.model
            }
        });

    } catch (err) {
        console.error('AI 接口错误:', err.message);
        res.status(500).json({
            code: 500,
            msg: 'AI 服务暂时不可用，请稍后重试'
        });
    }
});

module.exports = router;
