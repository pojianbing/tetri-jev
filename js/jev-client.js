/**
 * jev-client.js - TypeSafe AI Jev (System One) 官方云端客户端
 * 严格只调用官方 Jev 模型 API（https://api.typesafe.ai/v1/systemone），绝无本地降级。
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.JevClient = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class TypeSafeJevClient {
    constructor(options = {}) {
      this.apiKey = options.apiKey || '';
      // 浏览器环境默认通过后端代理 /api/systemone 转发（解决 CORS 并支持环境变量）
      this.endpoint = options.endpoint || (typeof window !== 'undefined' ? '/api/systemone' : 'https://api.typesafe.ai/v1/systemone');
      this.model = options.model || 'jev-latest';
    }

    setApiKey(key) {
      this.apiKey = key ? key.trim() : '';
    }

    hasApiKey() {
      return Boolean(this.apiKey && this.apiKey.length > 5);
    }

    /**
     * 发送真实 System One 评估请求至 TypeSafe 云端
     * @param {Object} state - 输入状态
     * @param {Object} questions - 复合问题字典 (Choice / Score / Noul)
     * @returns {Promise<Object>} 返回云端真实的结构化答案、概率与置信度
     */
    async evaluate(state, questions) {
      const startTime = performance.now();

      const payload = {
        state,
        model: this.model,
        questions,
      };

      const headers = {
        'Content-Type': 'application/json',
      };
      if (this.hasApiKey()) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errMessage = `HTTP ${response.status}`;
        try {
          const errData = await response.json();
          errMessage = errData.error || errData.message || JSON.stringify(errData);
        } catch (_) {
          errMessage = await response.text();
        }

        if (response.status === 401) {
          throw new Error(`[TypeSafe 鉴权失败] 未配置有效 API Key 或 Key 已失效: ${errMessage}`);
        }
        throw new Error(`[TypeSafe API 错误 ${response.status}] ${errMessage}`);
      }

      const data = await response.json();
      const latency = Math.round(performance.now() - startTime);

      return {
        success: true,
        latencyMs: latency,
        model: data.model || this.model,
        answers: data.answers,
        usage: data.usage || null,
        rawPayload: payload,
      };
    }
  }

  return {
    TypeSafeJevClient,
  };
});
