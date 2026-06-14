/* ==========================================
   config/ai.js — 阿里云百炼 AI 配置
   ========================================== */

module.exports = {
    apiKey: process.env.DASHSCOPE_API_KEY || 'sk-ws-H.RELMPRL.ADoz.MEUCIG_k8IQZaFYHbX8eK1zI-LqJ54UytuV4qVgOmZk0-oU7AiEApbYF_GJvj2IdWAYfpC6CC3WWdjHsV6R87Toti3bjAFE',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    maxTokens: 2000,
    temperature: 0.7
};
