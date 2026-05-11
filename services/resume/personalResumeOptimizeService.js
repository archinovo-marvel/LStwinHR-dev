/**
 * 个人简历优化建议服务
 * 专门用于个人用户的简历优化，输出格式严格约束
 */
const axios = require('axios');

// 本地VL模型配置
const LOCAL_VL_CONFIG = {
  url: process.env.LOCAL_LLM_VL_URL || 'http://localhost:8000',
  model: process.env.LOCAL_LLM_VL_MODEL || 'qwen3.5-9b-vlm-gguf',
  timeout: Number(process.env.LOCAL_VL_TIMEOUT_MS || 120000),
  enabled: process.env.LOCAL_LLM_ENABLED === 'true'
};

// 严格约束的输出格式示例
const OUTPUT_EXAMPLE = `{
  "highlights": [
    "拥有3年以上前端开发经验，技术栈成熟",
    "参与过大型电商平台项目，具备复杂业务处理能力",
    "熟练使用React、Vue双框架，适应性强"
  ],
  "suggestions": [
    "建议在简历开头添加个人技术亮点总结，让HR快速了解核心竞争力",
    "项目经历中可补充具体的技术难点和解决方案，体现技术深度",
    "工作经历建议使用STAR法则描述，突出成果和影响力",
    "可添加GitHub作品集或技术博客链接，展示技术热情"
  ]
}`;

// 系统提示词
const SYSTEM_PROMPT = `你是一名资深简历优化专家，专门帮助求职者优化简历内容。

你的任务是分析简历内容，输出两个部分：
1. highlights（亮点）：3-5条简历中的优势亮点，客观描述候选人的竞争力
2. suggestions（优化建议）：3-5条具体的优化建议，帮助候选人改进简历

输出要求：
- 必须严格输出JSON格式，不要输出任何其他文字
- 不要使用Markdown代码块，直接输出JSON
- highlights每条控制在20-40字，突出核心优势
- suggestions每条控制在30-50字，具体可执行
- 所有内容使用简体中文
- 如果简历信息不足，基于已有内容分析，不要编造

输出格式示例：
${OUTPUT_EXAMPLE}`;

class PersonalResumeOptimizeService {
  /**
   * 分析简历并生成优化建议
   * @param {Buffer} buffer - 文件buffer
   * @param {string} fileType - 文件类型 (.pdf, .doc, .docx)
   * @param {string} originalName - 原始文件名
   * @returns {Promise<Object>} - { highlights, suggestions }
   */
  async analyze(buffer, fileType, originalName) {
    const startTime = Date.now();

    if (!LOCAL_VL_CONFIG.enabled) {
      throw new Error('本地大模型未启用，请设置 LOCAL_LLM_ENABLED=true');
    }

    try {
      console.log(`[简历优化] 开始分析简历: ${originalName}`);

      // 根据文件类型选择分析方式
      let result;

      if (['.jpg', '.jpeg', '.png'].includes(fileType)) {
        result = await this.analyzeImage(buffer, fileType);
      } else if (fileType === '.pdf') {
        result = await this.analyzePDF(buffer);
      } else if (['.doc', '.docx'].includes(fileType)) {
        result = await this.analyzeDoc(buffer, fileType);
      } else {
        throw new Error(`不支持的文件类型: ${fileType}`);
      }

      console.log(`[简历优化] 分析完成，耗时: ${Date.now() - startTime}ms`);
      return result;

    } catch (error) {
      console.error('[简历优化] 分析失败:', error.message);
      throw error;
    }
  }

  /**
   * 分析图片简历
   */
  async analyzeImage(buffer, fileType) {
    const base64Image = buffer.toString('base64');
    const mimeType = fileType === '.png' ? 'image/png' : 'image/jpeg';
    const imageUrl = `data:${mimeType};base64,${base64Image}`;

    const response = await axios.post(`${LOCAL_VL_CONFIG.url}/v1/chat/completions`, {
      model: LOCAL_VL_CONFIG.model,
      stream: false,
      max_tokens: 1000,
      temperature: 0.3,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: '请分析这份简历图片，输出亮点和优化建议。' },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }
      ]
    }, {
      timeout: LOCAL_VL_CONFIG.timeout,
      headers: { 'Content-Type': 'application/json' }
    });

    return this.parseResponse(response.data);
  }

  /**
   * 分析PDF简历
   */
  async analyzePDF(buffer) {
    // 先尝试提取文本
    const pdfParse = require('pdf-parse');
    let text = '';

    try {
      const data = await pdfParse(buffer);
      text = data.text || '';
    } catch (e) {
      console.warn('[简历优化] PDF文本提取失败，尝试OCR');
    }

    // 如果文本足够，直接用文本分析
    if (text.trim().length >= 100) {
      return await this.analyzeText(text);
    }

    // 文本不足，转换为图片后分析
    const { convertPDFToImage } = require('./parserService');
    try {
      const imageBuffer = await convertPDFToImage(buffer);
      return await this.analyzeImage(imageBuffer, '.jpg');
    } catch (e) {
      throw new Error('PDF解析失败，请上传清晰的PDF文件');
    }
  }

  /**
   * 分析Word文档
   */
  async analyzeDoc(buffer, fileType) {
    const mammoth = require('mammoth');
    let text = '';

    try {
      if (fileType === '.docx') {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value || '';
      } else {
        // .doc 文件，尝试用 antiword 或其他方式
        throw new Error('暂不支持 .doc 格式，请转换为 .docx 或 PDF');
      }
    } catch (e) {
      throw new Error('Word文档解析失败: ' + e.message);
    }

    if (text.trim().length < 50) {
      throw new Error('文档内容过少，无法进行分析');
    }

    return await this.analyzeText(text);
  }

  /**
   * 分析文本内容
   */
  async analyzeText(text) {
    const cleanedText = text.replace(/\s+/g, ' ').trim().slice(0, 8000);

    const response = await axios.post(`${LOCAL_VL_CONFIG.url}/v1/chat/completions`, {
      model: LOCAL_VL_CONFIG.model,
      stream: false,
      max_tokens: 1000,
      temperature: 0.3,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `请分析以下简历内容，输出亮点和优化建议。\n\n简历内容：\n${cleanedText}` }
      ]
    }, {
      timeout: LOCAL_VL_CONFIG.timeout,
      headers: { 'Content-Type': 'application/json' }
    });

    return this.parseResponse(response.data);
  }

  /**
   * 解析大模型响应
   */
  parseResponse(responseData) {
    const content = responseData?.choices?.[0]?.message?.content || '';

    if (!content.trim()) {
      throw new Error('大模型返回为空');
    }

    console.log('[简历优化] 原始响应:', content.slice(0, 200));

    // 尝试提取JSON
    let jsonStr = content;

    // 移除可能的Markdown代码块
    jsonStr = jsonStr.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();

    // 尝试找到JSON对象
    const startIdx = jsonStr.indexOf('{');
    const endIdx = jsonStr.lastIndexOf('}');

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      jsonStr = jsonStr.slice(startIdx, endIdx + 1);
    }

    try {
      const parsed = JSON.parse(jsonStr);

      // 验证格式
      if (!parsed.highlights || !Array.isArray(parsed.highlights)) {
        parsed.highlights = [];
      }
      if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
        parsed.suggestions = [];
      }

      // 过滤和清理
      parsed.highlights = parsed.highlights
        .filter(h => typeof h === 'string' && h.trim().length > 0)
        .slice(0, 5);

      parsed.suggestions = parsed.suggestions
        .filter(s => typeof s === 'string' && s.trim().length > 0)
        .slice(0, 5);

      // 如果内容不足，添加默认提示
      if (parsed.highlights.length === 0) {
        parsed.highlights = ['简历内容已识别，建议进一步完善项目经历描述'];
      }
      if (parsed.suggestions.length === 0) {
        parsed.suggestions = ['建议补充更多项目细节和技术成果', '可添加量化数据展示工作成效'];
      }

      return parsed;

    } catch (e) {
      console.error('[简历优化] JSON解析失败:', e.message);
      // 返回默认结果
      return {
        highlights: ['简历内容已成功识别'],
        suggestions: ['建议完善项目经历的具体描述', '可添加技术成果和量化数据']
      };
    }
  }
}

module.exports = new PersonalResumeOptimizeService();
