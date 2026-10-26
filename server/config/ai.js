/* ==========================================
   config/ai.js — 阿里云百炼 AI 配置
   ========================================== */

/* 密钥只从环境变量读取（Railway 变量或系统环境变量），禁止写死在源码里 */
module.exports = {
    apiKey: process.env.DASHSCOPE_API_KEY || '',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    maxTokens: 2000,
    temperature: 0.7
};
