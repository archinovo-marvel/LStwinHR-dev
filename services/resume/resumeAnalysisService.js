const axios = require('axios');
const { parserService, ParseStatus, convertPDFToImage } = require('./parserService');
const { getPositionConfig, getAllPositions } = require('./positionConfig');
const extractorService = require('./extractorService');

const SCORE_LIMITS = {
  educationScore: 20,
  workScore: 20,
  projectScore: 30,
  skillScore: 25,
  expressionScore: 5,
  riskPenalty: 20,
  resumeScore: 100,
  totalScore: 100
};

// 本地VL模型配置
const LOCAL_VL_CONFIG = {
  url: process.env.LOCAL_LLM_VL_URL || 'http://localhost:8003',
  model: process.env.LOCAL_LLM_VL_MODEL || 'qwen3.5-9b-vlm-gguf',
  timeout: Number(process.env.LOCAL_VL_TIMEOUT_MS || 60000),
  enabled: process.env.LOCAL_LLM_ENABLED === 'true'
};

class ResumeAnalysisService {
  async scaleImageToFit(image, maxWidth, maxHeight, jimpModule = null, JimpClass = null) {
    if (!image) return;

    if (typeof image.scaleToFit === 'function') {
      try {
        await image.scaleToFit({ w: maxWidth, h: maxHeight });
        return;
      } catch (_) {
        try {
          await image.scaleToFit(maxWidth, maxHeight);
          return;
        } catch (_) {
        }
      }
    }

    if (typeof image.resize === 'function') {
      const auto = jimpModule?.AUTO || JimpClass?.AUTO || 0;
      try {
        await image.resize({ w: maxWidth, h: maxHeight });
        return;
      } catch (_) {
        try {
          await image.resize(maxWidth, auto);
        } catch (_) {
        }
      }
    }
  }

  async analyze(buffer, fileType, position, options = {}) {
    const startTime = Date.now();

    // 图片类型：直接使用VL模型进行OCR和分析
    if (['.jpg', '.jpeg', '.png'].includes(fileType)) {
      if (LOCAL_VL_CONFIG.enabled) {
        console.log(`[简历分析] 检测到图片简历，使用VL模型进行OCR分析...`);
        try {
          const analysis = await this.analyzeWithLocalVL(buffer, fileType, position, options);
          analysis.metadata = {
            ...analysis.metadata,
            originalName: options.originalName || '',
            source: 'vl-image-ocr',
            processingTime: Date.now() - startTime
          };
          return analysis;
        } catch (vlError) {
          console.error(`[简历分析] VL模型分析失败:`, vlError.message);
          return this.handleParseFailure({
            status: ParseStatus.PARSE_FAILED,
            error: `VL模型分析失败: ${vlError.message}`
          }, position);
        }
      } else {
        return this.handleParseFailure({
          status: ParseStatus.PARSE_FAILED,
          error: '图片简历需要VL模型支持，但VL模型未启用。请在.env中设置 LOCAL_LLM_ENABLED=true'
        }, position);
      }
    }

    // PDF类型：先尝试文本提取，文本过短则使用VL模型
    if (fileType === '.pdf') {
      const parseResult = await parserService.parseFile(buffer, fileType, options.originalName);
      const extractedText = String(parseResult?.text || '').trim();

      if (extractedText.length >= 40) {
        // 文本型PDF：使用文本模式分析
        console.log(`[简历分析] PDF文本提取成功(${extractedText.length}字符)，使用文本模式分析`);
        const analysis = await this.analyzeText(extractedText, position, {
          ...options,
          parserStatus: parseResult.status,
          parserError: parseResult.error || '',
          parserMetadata: parseResult.metadata || {},
          fileType
        });
        analysis.parseStatus = ParseStatus.SUCCESS;
        analysis.metadata = {
          ...analysis.metadata,
          originalName: options.originalName || '',
          parserStatus: parseResult.status,
          processingTime: Date.now() - startTime,
          source: 'pdf-text'
        };
        return analysis;
      }

      // 图片型PDF：转换为图片后使用VL模型
      console.log(`[简历分析] PDF文本过短(${extractedText.length}字符)，判定为图片型PDF`);
      if (LOCAL_VL_CONFIG.enabled) {
        console.log(`[简历分析] 使用VL模型进行OCR分析...`);
        try {
          const analysis = await this.analyzeWithLocalVL(buffer, fileType, position, options);
          analysis.metadata = {
            ...analysis.metadata,
            originalName: options.originalName || '',
            parserStatus: parseResult.status,
            processingTime: Date.now() - startTime,
            source: 'vl-pdf-ocr'
          };
          return analysis;
        } catch (vlError) {
          console.error(`[简历分析] VL模型分析失败:`, vlError.message);
          return this.handleParseFailure({
            status: ParseStatus.PARSE_FAILED,
            error: `VL模型分析失败: ${vlError.message}`
          }, position);
        }
      } else {
        return this.handleParseFailure({
          status: ParseStatus.TEXT_TOO_SHORT,
          error: '图片型PDF需要VL模型支持，但VL模型未启用。请在.env中设置 LOCAL_LLM_ENABLED=true'
        }, position);
      }
    }

    // Word类型：使用parserService解析
    if (['.doc', '.docx'].includes(fileType)) {
      const parseResult = await parserService.parseFile(buffer, fileType, options.originalName);
      const extractedText = String(parseResult?.text || '').trim();

      if (!extractedText || parseResult.status !== ParseStatus.SUCCESS) {
        return this.handleParseFailure({
          status: parseResult.status || ParseStatus.TEXT_TOO_SHORT,
          error: parseResult.error || 'Word文档提取文本过短'
        }, position);
      }

      const analysis = await this.analyzeText(extractedText, position, {
        ...options,
        parserStatus: parseResult.status,
        parserError: parseResult.error || '',
        parserMetadata: parseResult.metadata || {},
        fileType
      });
      analysis.parseStatus = ParseStatus.SUCCESS;
      analysis.metadata = {
        ...analysis.metadata,
        originalName: options.originalName || '',
        parserStatus: parseResult.status,
        processingTime: Date.now() - startTime,
        source: 'word-text'
      };
      return analysis;
    }

    // 不支持的文件类型
    return this.handleParseFailure({
      status: ParseStatus.UNSUPPORTED_FILE_TYPE,
      error: `不支持的文件类型: ${fileType}`
    }, position);
  }

  async analyzeWithDeepSeek(buffer, fileType, position, options = {}) {
    const startTime = Date.now();
    const providedText = this.normalizeWhitespace(String(options.extractedText || ''));
    const baseMeta = {
      originalName: options.originalName || '',
      processingTime: 0,
      source: 'deepseek-fallback'
    };
    const isImageFile = ['.jpg', '.jpeg', '.png'].includes(fileType);
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;

    if (providedText) {
      const analysis = await this.analyzeText(providedText, position, options);
      analysis.metadata = {
        ...analysis.metadata,
        ...baseMeta,
        processingTime: Date.now() - startTime,
        source: 'deepseek-cached-text'
      };
      return analysis;
    }

    // 对于图片或扫描版PDF，先尝试VL OCR提取文本
    let extractedText = '';
    let vlOcrSuccess = false;
    const vlOcrTimeout = 30000; // VL OCR 超时30秒

    if (isImageFile || fileType === '.pdf') {
      try {
        console.log(`[DeepSeek模式] 先尝试VL OCR提取文本，超时: ${vlOcrTimeout}ms...`);
        const parseResult = await parserService.parseFile(buffer, fileType, options.originalName, {
          timeoutMs: vlOcrTimeout
        });
        extractedText = this.normalizeWhitespace(String(parseResult?.text || ''));

        if (extractedText.length >= 50) {
          vlOcrSuccess = true;
          console.log(`[DeepSeek模式] VL OCR成功，提取文本长度: ${extractedText.length}`);
        } else {
          console.log(`[DeepSeek模式] VL OCR提取文本不足(${extractedText.length}字符)`);
        }
      } catch (vlError) {
        console.warn(`[DeepSeek模式] VL OCR失败:`, vlError.message);
        extractedText = '';
      }
    } else {
      // 非图片/PDF文件，直接解析
      const parseResult = await parserService.parseFile(buffer, fileType, options.originalName, {});
      extractedText = this.normalizeWhitespace(String(parseResult?.text || ''));
    }

    // 如果VL OCR成功提取到足够文本，用DeepSeek分析
    if (extractedText.length >= 50) {
      console.log(`[DeepSeek模式] 使用提取的文本进行DeepSeek分析...`);
      const analysis = await this.analyzeText(extractedText, position, {
        ...options,
        fileType
      });
      analysis.metadata = {
        ...analysis.metadata,
        ...baseMeta,
        processingTime: Date.now() - startTime,
        textLength: extractedText.length,
        source: 'deepseek-vl-ocr-text'
      };
      return analysis;
    }

    // VL OCR失败或文本不足，尝试用DeepSeek Vision直接分析图片
    if (isImageFile) {
      console.log(`[DeepSeek模式] VL OCR未成功，尝试DeepSeek Vision直接分析图片...`);
      try {
        const visionAnalysis = await this.analyzeImageWithDeepSeekVision(buffer, fileType, position, options);
        if (visionAnalysis && visionAnalysis.parseStatus === 'SUCCESS') {
          visionAnalysis.metadata = {
            ...visionAnalysis.metadata,
            ...baseMeta,
            processingTime: Date.now() - startTime,
            source: 'deepseek-vision-direct'
          };
          return visionAnalysis;
        }
      } catch (visionError) {
        console.warn(`[DeepSeek模式] DeepSeek Vision分析失败:`, visionError.message);
      }
    }

    // 所有方法都失败，返回错误
    const failedResult = this.handleParseFailure({
      status: ParseStatus.TEXT_TOO_SHORT,
      error: extractedText.length > 0
        ? `提取文本过短(${extractedText.length}字符)，无法进行有效分析`
        : 'VL OCR提取失败且DeepSeek Vision不可用，建议检查简历文件或上传PDF版本'
    }, position);
    failedResult.metadata = {
      ...failedResult.metadata,
      ...baseMeta,
      processingTime: Date.now() - startTime,
      textLength: extractedText.length,
      vlOcrSuccess
    };
    return failedResult;
  }

  /**
   * 使用DeepSeek Vision模型直接分析图片简历
   */
  async analyzeImageWithDeepSeekVision(buffer, fileType, position, options = {}) {
    const config = this.getDeepSeekConfig();
    if (!config.apiKey) {
      throw new Error('DEEPSEEK_API_KEY 未配置');
    }

    // 将图片转为base64
    const base64Image = buffer.toString('base64');
    const mimeType = fileType === '.png' ? 'image/png' : 'image/jpeg';
    const imageUrl = `data:${mimeType};base64,${base64Image}`;

    const positionConfig = getPositionConfig(position, options.positionConfig);

    const messages = [
      {
        role: 'system',
        content: this.buildSystemPrompt()
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `这是一份简历图片，目标岗位：${position || '未指定'}。\n岗位核心技能要求：${(positionConfig?.coreSkills || []).slice(0, 5).join('、') || '未指定'}\n\n请仔细识别图片中的简历内容，并输出一个合法JSON对象进行分析评估。输出要求与文本分析相同。`
          },
          {
            type: 'image_url',
            image_url: { url: imageUrl }
          }
        ]
      }
    ];

    console.log(`[DeepSeek Vision] 开始分析图片...`);

    const response = await axios.post(`${config.baseURL}/chat/completions`, {
      model: config.model,
      messages,
      max_tokens: 4000,
      temperature: 0.2
    }, {
      timeout: config.timeout,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const content = response?.data?.choices?.[0]?.message?.content || '';
    if (!content.trim()) {
      throw new Error('DeepSeek Vision 返回为空');
    }

    console.log(`[DeepSeek Vision] 分析完成，返回内容长度: ${content.length}`);

    // 解析返回的JSON
    const parsed = this.parseAiJson(content);
    return this.normalizeAiAnalysis(parsed, '', position, options);
  }

  async analyzeText(text, position, options = {}) {
    const startTime = Date.now();
    const baseResult = this.createBaseResult(position);
    const cleanedText = this.normalizeWhitespace(text);

    if (!cleanedText) {
      const failedResult = this.handleParseFailure({
        status: ParseStatus.TEXT_TOO_SHORT,
        error: '未提取到可分析的简历文本'
      }, position);
      failedResult.metadata.processingTime = Date.now() - startTime;
      failedResult.metadata.source = 'empty-text';
      return failedResult;
    }

    try {
      const aiPayload = await this.requestDeepSeekAnalysis(cleanedText, position, options);
      const normalized = this.normalizeAiAnalysis(aiPayload, cleanedText, position, options);
      normalized.metadata = {
        ...normalized.metadata,
        source: 'deepseek',
        analyzedAt: normalized.metadata?.analyzedAt || new Date().toISOString(),
        processingTime: Date.now() - startTime,
        textLength: cleanedText.length,
        model: this.getDeepSeekConfig().model,
        truncated: cleanedText.length > this.getMaxResumeTextLength()
      };
      return normalized;
    } catch (error) {
      console.error('DeepSeek简历分析失败:', error.response?.data || error.message);
      return {
        ...baseResult,
        parseStatus: ParseStatus.PARSE_FAILED,
        error: error.message,
        summary: 'AI简历分析失败，请稍后重试',
        risks: [
          {
            type: 'AI_ANALYSIS_FAILED',
            title: 'AI分析失败',
            message: error.message,
            description: '调用 DeepSeek 分析简历时发生错误',
            severity: 'high',
            suggestion: '请检查 DEEPSEEK_API_KEY、网络连通性和模型配置'
          }
        ],
        suggestions: ['请稍后重试，或检查服务器中的 DeepSeek 配置'],
        recommendation: {
          level: '无法分析',
          reason: 'AI分析服务暂时不可用',
          color: 'danger'
        },
        metadata: {
          ...baseResult.metadata,
          source: 'deepseek',
          processingTime: Date.now() - startTime,
          textLength: cleanedText.length
        }
      };
    }
  }

  /**
   * 压缩图片以减少VL模型的视觉tokens占用
   * Qwen3-VL图像token计算：(H/32) × (W/32) + 2
   * 目标：将图片压缩到约1280x720，约900 tokens
   */
  async compressImageForVL(buffer, fileType) {
    let jimpModule;
    try {
      jimpModule = require('jimp');
    } catch (e) {
      console.warn('[VL图片压缩] Jimp模块未加载，跳过压缩');
      return { buffer, compressed: false };
    }

    const maxEdge = 1280;
    const targetPixels = 1280 * 720;

    try {
      let image;
      const JimpClass = jimpModule.Jimp || jimpModule;

      if (typeof JimpClass.fromBuffer === 'function') {
        image = await JimpClass.fromBuffer(buffer);
      } else if (typeof jimpModule.read === 'function') {
        image = await jimpModule.read(buffer);
      } else if (typeof JimpClass.read === 'function') {
        image = await JimpClass.read(buffer);
      } else {
        console.warn('[VL图片压缩] Jimp API不可用，跳过压缩');
        return { buffer, compressed: false };
      }

      const width = image.bitmap?.width || image.width || 0;
      const height = image.bitmap?.height || image.height || 0;
      const currentPixels = width * height;

      console.log(`[VL图片压缩] 原始尺寸: ${width}x${height}, 预计tokens: ${Math.ceil(width/32) * Math.ceil(height/32) + 2}`);

      if (currentPixels <= targetPixels && width <= maxEdge && height <= maxEdge) {
        console.log(`[VL图片压缩] 图片尺寸适中，无需压缩`);
        return { buffer, compressed: false };
      }

      await this.scaleImageToFit(image, maxEdge, maxEdge, jimpModule, JimpClass);

      const newWidth = image.bitmap?.width || image.width || 0;
      const newHeight = image.bitmap?.height || image.height || 0;
      console.log(`[VL图片压缩] 压缩后尺寸: ${newWidth}x${newHeight}, 预计tokens: ${Math.ceil(newWidth/32) * Math.ceil(newHeight/32) + 2}`);

      const mimeType = 'image/jpeg';
      let compressedBuffer;

      if (typeof image.quality === 'function') {
        try {
          image.quality(72);
        } catch (_) {
        }
      }

      if (typeof image.getBufferAsync === 'function') {
        const jpegMime = jimpModule.MIME_JPEG || JimpClass.MIME_JPEG || 'image/jpeg';
        compressedBuffer = await image.getBufferAsync(jpegMime);
      } else if (typeof image.getBuffer === 'function') {
        const jpegMime = jimpModule.MIME_JPEG || JimpClass.MIME_JPEG || 'image/jpeg';
        compressedBuffer = await new Promise((resolve, reject) => {
          image.getBuffer(jpegMime, (err, buf) => {
            if (err) reject(err);
            else resolve(buf);
          });
        });
      } else {
        return { buffer, compressed: false };
      }

      return { buffer: compressedBuffer, compressed: true, mimeType };
    } catch (error) {
      console.warn(`[VL图片压缩] 压缩失败，使用原图:`, error.message);
      return { buffer, compressed: false };
    }
  }

  /**
   * 使用本地VL模型分析简历（超时降级方案）
   * @param {Buffer} buffer - 文件buffer
   * @param {string} fileType - 文件类型
   * @param {string} position - 岗位
   * @param {object} options - 选项
   */
  async analyzeWithLocalVL(buffer, fileType, position, options = {}) {
    const startTime = Date.now();
    const baseResult = this.createBaseResult(position);
    const vlTimeoutMs = Number(options.timeoutMs || LOCAL_VL_CONFIG.timeout || 30000);
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    const onExtractedText = typeof options.onExtractedText === 'function' ? options.onExtractedText : null;

    if (!LOCAL_VL_CONFIG.enabled) {
      return {
        ...baseResult,
        parseStatus: ParseStatus.PARSE_FAILED,
        error: '本地VL模型未启用',
        summary: '本地VL模型未启用，无法进行降级分析',
        recommendation: {
          level: '无法分析',
          reason: '本地VL模型未启用',
          color: 'danger'
        },
        metadata: {
          ...baseResult.metadata,
          source: 'local-vl',
          processingTime: Date.now() - startTime
        }
      };
    }

    try {
      console.log('[本地VL] 开始使用本地VL模型分析简历...');

      // 将文件转换为 base64 图片格式
      let imageDataUrl;

      if (['.jpg', '.jpeg', '.png'].includes(fileType)) {
        // 图片简历优先走 OCR -> 文本分析，通常比直接视觉结构化更稳定
        const parseResult = await parserService.parseFile(buffer, fileType, options.originalName, options);
        const extractedText = String(parseResult?.text || '').trim();

        if (extractedText.length >= 80) {
          await onExtractedText?.(extractedText, {
            parserStatus: parseResult.status,
            parserError: parseResult.error || '',
            parserMetadata: parseResult.metadata || {},
            fileType,
            source: 'image-ocr'
          });
          console.log(`[本地VL] 图片OCR提取成功(${extractedText.length}字符)，优先使用文本模式分析`);
          await onProgress?.('Qwen3.5-9B文本分析中', 'OCR完成，正在进行Qwen3.5-9B文本分析');
          return await this.analyzeTextWithLocalVL(extractedText, position, {
            ...options,
            parserStatus: parseResult.status,
            parserError: parseResult.error || '',
            parserMetadata: parseResult.metadata || {},
            fileType
          });
        }

        // OCR文本不足时，再回退到直接视觉分析
        const compressed = await this.compressImageForVL(buffer, fileType);
        const mimeType = compressed.mimeType || (fileType === '.png' ? 'image/png' : 'image/jpeg');
        imageDataUrl = `data:${mimeType};base64,${compressed.buffer.toString('base64')}`;
      } else if (fileType === '.pdf') {
        // PDF 处理策略：
        // 1. 先尝试用 pdf-parse 提取文本
        // 2. 如果文本足够，使用文本模式
        // 3. 如果文本过短（图片型PDF），先转图片并走 OCR -> 文本分析
        // 4. OCR 仍不足时，最后才回退到直接图像模式
        const parseResult = await parserService.parseFile(buffer, fileType, options.originalName, options);
        const extractedText = String(parseResult?.text || '').trim();

        if (extractedText.length >= 40) {
          await onExtractedText?.(extractedText, {
            parserStatus: parseResult.status,
            parserError: parseResult.error || '',
            parserMetadata: parseResult.metadata || {},
            fileType,
            source: 'pdf-text'
          });
          // 文本足够，使用文本模式
          console.log(`[本地VL] PDF文本提取成功(${extractedText.length}字符)，使用文本模式分析`);
          await onProgress?.('Qwen3.5-9B文本分析中', 'PDF文本提取完成，正在进行Qwen3.5-9B文本分析');
          return await this.analyzeTextWithLocalVL(extractedText, position, {
            ...options,
            parserStatus: parseResult.status,
            parserError: parseResult.error || '',
            parserMetadata: parseResult.metadata || {},
            fileType
          });
        }

        // 文本过短，可能是扫描版 PDF。优先恢复到“转图 -> OCR -> 文本分析”的稳定方案。
        console.log(`[本地VL] PDF文本过短(${extractedText.length}字符)，尝试转换为图片并走OCR文本分析...`);
        try {
          await onProgress?.('Qwen3.5-9B OCR分析中', '正在将扫描版PDF转换为图片并进行OCR识别');
          const imageBuffer = await convertPDFToImage(buffer);
          const imageParseResult = await parserService.parseImage(
            imageBuffer,
            (options.originalName || 'resume.pdf').replace(/\.pdf$/i, '.jpg'),
            options
          );
          const imageExtractedText = String(imageParseResult?.text || '').trim();

          if (imageExtractedText.length >= 80) {
            await onExtractedText?.(imageExtractedText, {
              parserStatus: imageParseResult.status,
              parserError: imageParseResult.error || '',
              parserMetadata: {
                ...(parseResult.metadata || {}),
                scannedPdf: true,
                pdfParseStatus: parseResult.status,
                imageOcr: imageParseResult.metadata || {}
              },
              fileType,
              source: 'scanned-pdf-ocr'
            });
            console.log(`[本地VL] 扫描版PDF经转图OCR提取成功(${imageExtractedText.length}字符)，改走文本模式分析`);
            await onProgress?.('Qwen3.5-9B文本分析中', 'OCR完成，正在进行Qwen3.5-9B文本分析');
            return await this.analyzeTextWithLocalVL(imageExtractedText, position, {
              ...options,
              parserStatus: imageParseResult.status,
              parserError: imageParseResult.error || '',
              parserMetadata: {
                ...(parseResult.metadata || {}),
                scannedPdf: true,
                pdfParseStatus: parseResult.status,
                imageOcr: imageParseResult.metadata || {}
              },
              fileType
            });
          }

          const compressed = await this.compressImageForVL(imageBuffer, '.jpg');
          const mimeType = compressed.mimeType || 'image/jpeg';
          imageDataUrl = `data:${mimeType};base64,${compressed.buffer.toString('base64')}`;
          console.log(`[本地VL] 扫描版PDF转图OCR仍不足(${imageExtractedText.length}字符)，回退到图像模式分析`);
        } catch (convertError) {
          console.error(`[本地VL] PDF转图片失败:`, convertError.message);
          // 如果VL OCR之前已经成功提取了文本，使用那个结果
          if (parseResult.status === 'VL_OCR_SUCCESS' && extractedText.length > 0) {
            await onExtractedText?.(extractedText, {
              parserStatus: parseResult.status,
              parserError: parseResult.error || '',
              parserMetadata: parseResult.metadata || {},
              fileType,
              source: 'pdf-vl-ocr'
            });
            console.log(`[本地VL] 使用VL OCR已提取的文本进行分析`);
            await onProgress?.('Qwen3.5-9B文本分析中', 'Qwen3.5-9B OCR已提取文本，正在进行Qwen3.5-9B文本分析');
            return await this.analyzeTextWithLocalVL(extractedText, position, {
              ...options,
              parserStatus: parseResult.status,
              parserError: parseResult.error || '',
              parserMetadata: parseResult.metadata || {},
              fileType
            });
          }
          throw new Error(`PDF解析文本过短且无法转换为图片: ${convertError.message}`);
        }
      } else if (['.doc', '.docx'].includes(fileType)) {
        const parseResult = await parserService.parseFile(buffer, fileType, options.originalName);
        const extractedText = String(parseResult?.text || '').trim();

        if (!extractedText || parseResult.status !== ParseStatus.SUCCESS) {
          throw new Error(parseResult.error || 'Word文档解析文本过短，无法进行VL分析');
        }

        await onProgress?.('Qwen3.5-9B文本分析中', '文档文本提取完成，正在进行Qwen3.5-9B文本分析');
        return await this.analyzeTextWithLocalVL(extractedText, position, options);
      } else {
        throw new Error(`不支持的文件类型: ${fileType}`);
      }

      // 调用本地VL模型API
      // Qwen3-VL-8B 输出上限：推荐32768，极限38912
      // 图片会占用视觉tokens：1920x1080约2042 tokens
      const response = await axios.post(`${LOCAL_VL_CONFIG.url}/v1/chat/completions`, {
        model: LOCAL_VL_CONFIG.model,
        stream: false,
        max_tokens: 1600,
        temperature: 0,
        seed: 42,
        messages: [
          {
            role: 'system',
            content: this.buildVLSystemPrompt()
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: this.buildVLUserPrompt(position, options) },
              { type: 'image_url', image_url: { url: imageDataUrl } }
            ]
          }
        ]
      }, {
        timeout: vlTimeoutMs,
        headers: { 'Content-Type': 'application/json' }
      });

      const content = response?.data?.choices?.[0]?.message?.content || '';

      if (!content.trim()) {
        throw new Error('本地VL模型返回为空');
      }

      console.log(`[本地VL] 分析完成，返回内容长度: ${content.length}`);
      console.log(`[本地VL] 完整返回内容:\n${content}`);

      // 尝试解析JSON结果
      const analysis = this.parseVLResponse(content, position, options);

      console.log(`[本地VL] 解析结果: totalScore=${analysis.totalScore}, summary=${analysis.summary?.slice(0, 100)}`);
      console.log(`[本地VL] 提取的基本信息: ${JSON.stringify(analysis.extractedContent?.basicInfo)}`);
      console.log(`[本地VL] 建议: ${analysis.recommendation?.level} - ${analysis.recommendation?.reason}`);

      analysis.metadata = {
        ...analysis.metadata,
        source: 'local-vl',
        model: LOCAL_VL_CONFIG.model,
        processingTime: Date.now() - startTime
      };

      return analysis;
    } catch (error) {
      console.error('[本地VL] 分析失败:', error.message);
      return {
        ...baseResult,
        parseStatus: ParseStatus.PARSE_FAILED,
        error: error.message,
        summary: `本地VL模型分析失败: ${error.message}`,
        risks: [{
          type: 'VL_ANALYSIS_FAILED',
          title: 'VL分析失败',
          message: error.message,
          description: '使用本地VL模型进行简历分析时发生错误',
          severity: 'high',
          suggestion: '请检查本地VL模型服务是否正常运行'
        }],
        suggestions: ['请稍后重试，或联系管理员检查VL模型服务'],
        recommendation: {
          level: '无法分析',
          reason: 'VL分析服务暂时不可用',
          color: 'danger'
        },
        metadata: {
          ...baseResult.metadata,
          source: 'local-vl',
          processingTime: Date.now() - startTime,
          error: error.message
        }
      };
    }
  }

  /**
   * 使用本地VL模型分析文本（用于PDF/Word等）
   */
  async analyzeTextWithLocalVL(text, position, options = {}) {
    const startTime = Date.now();
    const baseResult = this.createBaseResult(position);
    const cleanedText = this.normalizeWhitespace(String(text || '').replace(/\u0000/g, ' '));
    const vlTimeoutMs = Number(options.timeoutMs || LOCAL_VL_CONFIG.timeout || 30000);
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;

    console.log(`[本地VL文本分析] 开始分析，原始文本长度: ${text.length}，清洗后长度: ${cleanedText.length}`);
    await onProgress?.('Qwen3.5-9B文本分析中', '正在进行Qwen3.5-9B文本分析');

    try {
      let content = '';
      const baseMessages = [
        {
          role: 'system',
          content: this.buildVLSystemPrompt()
        },
        {
          role: 'user',
          content: this.buildVLUserPrompt(position, options) + '\n\n简历文本内容：\n' + cleanedText.slice(0, 6000)
        }
      ];

      for (let attempt = 0; attempt < 2; attempt++) {
        const messages = attempt === 0
          ? baseMessages
          : [
              ...baseMessages,
              {
                role: 'user',
                content: '上一次输出不完整。请重新输出一个完整、合法的 JSON 对象，不要输出额外文字，不要省略字段。'
              }
            ];

        const response = await axios.post(`${LOCAL_VL_CONFIG.url}/v1/chat/completions`, {
          model: LOCAL_VL_CONFIG.model,
          stream: false,
          max_tokens: 1800,
          temperature: 0,
          seed: 42,
          messages
        }, {
          timeout: vlTimeoutMs,
          headers: { 'Content-Type': 'application/json' }
        });

        content = response?.data?.choices?.[0]?.message?.content || '';
        if (this.isUsableVLTextResponse(content)) {
          break;
        }
        console.warn(`[本地VL文本分析] 第 ${attempt + 1} 次返回内容质量不足，准备重试。内容预览: ${String(content).slice(0, 80)}`);
      }

      if (!this.isUsableVLTextResponse(content)) {
        throw new Error(`本地VL模型返回内容过短或格式异常: ${String(content).slice(0, 80)}`);
      }

      console.log(`[本地VL文本分析] 返回内容长度: ${content.length}`);
      console.log(`[本地VL文本分析] 完整返回内容:\n${content}`);

      const analysis = this.parseVLResponse(content, position, options);

      console.log(`[本地VL文本分析] 解析结果: totalScore=${analysis.totalScore}`);
      console.log(`[本地VL文本分析] 提取的基本信息: ${JSON.stringify(analysis.extractedContent?.basicInfo)}`);

      analysis.metadata = {
        ...analysis.metadata,
        source: 'local-vl-text',
        model: LOCAL_VL_CONFIG.model,
        processingTime: Date.now() - startTime,
        textLength: cleanedText.length
      };

      return analysis;
    } catch (error) {
      console.error('[本地VL文本分析] 失败:', error.message);
      throw error;
    }
  }

  /**
   * 构建VL模型的系统提示词
   */
  buildVLSystemPrompt() {
    return [
      '你是一名资深招聘HR和简历评估专家。',
      '请仔细阅读简历内容，从招聘视角进行专业评估。',
      '输出必须是合法JSON格式，不要输出Markdown代码块，不要添加额外解释。',
      '所有内容使用简体中文。'
    ].join('\n');
  }

  /**
   * 构建评分校准参考框架
   * 提供通用的评分标尺描述，帮助AI在不同候选人间保持评分一致性
   * 这不是硬编码的评分标准，而是一个语义参考框架，AI仍需基于简历原文做出判断
   */
  buildScoringAnchors() {
    return [
      '【评分校准参考框架】',
      '请基于以下通用评分标尺进行各维度打分，确保跨候选人评分标准一致：',
      '',
      '教育背景 (0-20分):',
      '- 16-20分：名校硕博，专业与岗位高度对口，学术背景突出',
      '- 11-15分：本科及以上学历，专业基本对口或有相关辅修/第二专业',
      '- 6-10分：大专学历或专业部分相关，可通过经验弥补',
      '- 0-5分：学历偏低或专业与岗位完全不符',
      '',
      '工作经历 (0-20分):',
      '- 16-20分：3年以上高度相关工作经验，有行业知名企业背景，职级较高',
      '- 11-15分：1-3年相关经验或实习经历丰富，有明确的职业成长路径',
      '- 6-10分：有工作经验但行业/岗位相关性一般，或为初级岗位经验',
      '- 0-5分：缺乏相关工作经验，或无正式工作经历',
      '',
      '项目经历 (0-30分):',
      '- 24-30分：多个高质量项目，技术深度与广度俱佳，有可量化的成果与影响力',
      '- 16-23分：有2个以上相关项目，项目描述详实，角色与贡献清晰',
      '- 8-15分：有1-2个项目经历，但描述较简单，角色不够清晰',
      '- 0-7分：无明显项目经历或项目与岗位无关',
      '',
      '技能匹配 (0-25分):',
      '- 20-25分：核心技能全部覆盖，且有超出岗位要求的额外技能或证书',
      '- 13-19分：覆盖大部分核心技能（≥60%），有1-2项突出技能',
      '- 6-12分：覆盖部分核心技能（30%-60%），关键技能有缺失',
      '- 0-5分：技能与岗位要求匹配度低（<30%），或技能描述模糊',
      '',
      '表达完整性 (0-5分):',
      '- 5分：简历结构完整，信息详实，逻辑清晰，语言专业，无明显信息缺口',
      '- 3-4分：基本信息完整，主要经历有描述，个别部分可更详尽',
      '- 1-2分：有基本信息但缺乏细节，部分经历描述过于简略',
      '- 0分：信息严重缺失，无法形成有效评估',
      '',
      'totalScore（综合评分，0-100分）:',
      '- 85-100分：高度匹配，简历在多个维度表现优异，建议优先推进',
      '- 70-84分：较好匹配，核心维度表现良好，建议进入下一轮',
      '- 55-69分：基本匹配，部分维度有亮点但存在明显短板，建议复筛',
      '- 40-54分：匹配度偏低，多维度存在不足，建议补充材料或谨慎考虑',
      '- 0-39分：匹配度低，与岗位要求差距较大',
      '',
      '【重要提醒】以上标尺为通用参考框架，请始终基于简历原文中实际呈现的信息进行评分，',
      '不要编造信息，不要因标尺描述而产生期望偏差。对于简历中未提及的信息，相应维度应给予较低分数。'
    ].join('\n');
  }

  /**
   * 构建VL模型的用户提示词
   */
  buildVLUserPrompt(position, options = {}) {
    const positionConfig = getPositionConfig(position, options.positionConfig);
    const mbtiType = options.mbti || '';

    const mbtiSection = mbtiType ? `
【MBTI岗位匹配度评分】
候选人的MBTI类型为：${mbtiType}
请基于以下维度评估该MBTI类型与目标岗位"${position || '未指定'}"的匹配度，并给出0-100分的评分：
1. 该MBTI类型的典型性格特质（如领导力、沟通风格、决策方式、工作偏好）
2. 目标岗位的核心要求（如团队协作、独立工作、压力应对、创新思维、细节把控）
3. 性格特质与岗位要求的契合程度
4. 潜在的性格优势可能带来的工作表现提升
5. 可能需要关注或补足的方面

输出中必须包含 mbtiMatchScore 字段（0-100的整数），以及 mbtiMatchReason 字段（简要说明评分理由）。
` : '';

    return [
      `目标岗位：${position || '未指定'}`,
      `岗位核心技能要求：${(positionConfig?.coreSkills || []).slice(0, 5).join('、') || '未指定'}`,
      this.buildScoringAnchors(),
      '',
      '请基于简历原文输出一个合法 JSON 对象，不要输出 Markdown，不要补充解释。',
      '必须包含字段：summary、totalScore、basicInfo、extractedContent、scores、strengths、risks、suggestions、interviewQuestions、recommendation。',
      'basicInfo 包含：name、phone、email、jobIntention。',
      'extractedContent 包含：education、workExperience、projectExperience、skills。',
      'scores 包含：education(0-20)、work(0-20)、project(0-30)、skill(0-25)、expression(0-5)。',
      'risks 每项包含：title、severity(high|medium|low)、suggestion。',
      'recommendation 包含：level、reason。',
      '如果信息缺失，请返回空字符串或空数组，不要编造。',
      mbtiSection,
      '',
      '【面试建议要求】interviewQuestions 必须严格基于简历原文内容生成 3-5 条具体的面试提问：',
      '1. 必须引用简历中具体的项目名称、公司名称、技能或经历，例如："请详细介绍你在XX项目中负责的具体工作内容？"',
      '2. 针对简历中的风险点设计验证性问题，例如工作空窗期、技能描述模糊、项目角色不清等',
      '3. 针对核心技能设计深度追问，例如："你提到熟悉XX技术，请举例说明在实际项目中如何应用的？"',
      '4. 避免泛泛而谈的通用问题，每条建议都要能追溯到简历原文的具体内容',
      '5. 格式为问句形式，便于面试官直接使用',
      '',
      'JSON 模板：{"summary":"","totalScore":0,"basicInfo":{"name":"","phone":"","email":"","jobIntention":""},"extractedContent":{"education":[],"workExperience":[],"projectExperience":[],"skills":[]},"scores":{"education":0,"work":0,"project":0,"skill":0,"expression":0},"strengths":[],"risks":[],"suggestions":[],"interviewQuestions":[],"recommendation":{"level":"","reason":""}}'
    ].filter(Boolean).join('\n');
  }

  isUsableVLTextResponse(content) {
    const normalized = String(content || '').trim();
    if (!normalized || normalized.length < 80) {
      return false;
    }

    if (normalized.includes('"summary"') || normalized.includes('"totalScore"')) {
      return true;
    }

    return normalized.startsWith('{') && normalized.includes('recommendation');
  }

  /**
   * 解析VL模型的响应
   */
  parseVLResponse(content, position, options = {}) {
    const baseResult = this.createBaseResult(position);

    console.log(`[本地VL] 开始解析响应，内容长度: ${content.length}`);

    try {
      // 尝试提取完整的JSON
      const jsonStr = this.extractFirstJsonObject(content);
      if (jsonStr) {
        try {
          const parsed = JSON.parse(jsonStr);
          console.log('[本地VL] 成功解析完整JSON');
          return this.buildNormalizedResult(parsed, position, options);
        } catch (parseError) {
          console.warn('[本地VL] JSON解析失败，尝试修复截断的JSON');
        }
      }

      // 如果JSON不完整，尝试从文本中提取关键字段
      console.log('[本地VL] 尝试从文本中提取关键字段...');
      const extracted = this.extractFieldsFromPartialJson(content, position);
      if (extracted) {
        return extracted;
      }

    } catch (parseError) {
      console.warn('[本地VL] 解析失败:', parseError.message);
    }

    // 无法解析，从文本构建结果
    return this.buildResultFromText(content, position, options);
  }

  /**
   * 从不完整的JSON中提取关键字段
   */
  extractFieldsFromPartialJson(content, position) {
    const result = this.createBaseResult(position);

    try {
      // 提取 summary
      const summaryMatch = content.match(/"summary"\s*:\s*"([^"]+)"/);
      if (summaryMatch) {
        result.summary = summaryMatch[1];
      }

      // 提取 totalScore
      const scoreMatch = content.match(/"totalScore"\s*:\s*(\d+)/);
      if (scoreMatch) {
        result.totalScore = parseInt(scoreMatch[1], 10);
      }

      // 提取 basicInfo
      const nameMatch = content.match(/"name"\s*:\s*"([^"]+)"/);
      const phoneMatch = content.match(/"phone"\s*:\s*"([^"]+)"/);
      const emailMatch = content.match(/"email"\s*:\s*"([^"]+)"/);

      if (nameMatch || phoneMatch || emailMatch) {
        result.extractedContent.basicInfo = {
          name: nameMatch ? nameMatch[1] : '',
          phone: phoneMatch ? phoneMatch[1] : '',
          email: emailMatch ? emailMatch[1] : '',
          jobIntention: ''
        };
        result.extractedContent.personalInfo = {
          name: nameMatch ? nameMatch[1] : '',
          phone: phoneMatch ? phoneMatch[1] : '',
          email: emailMatch ? emailMatch[1] : ''
        };
      }

      // 提取 scores（支持两种格式：scores.education 和直接的 educationScore）
      const eduMatch = content.match(/"education"\s*:\s*(\d+)/);
      const workMatch = content.match(/"work"\s*:\s*(\d+)/);
      const projectMatch = content.match(/"project"\s*:\s*(\d+)/);
      const skillMatch = content.match(/"skill"\s*:\s*(\d+)/);
      const expressionMatch = content.match(/"expression"\s*:\s*(\d+)/);

      if (eduMatch || workMatch || projectMatch || skillMatch) {
        result.scores = {
          educationScore: eduMatch ? parseInt(eduMatch[1], 10) : 0,
          workScore: workMatch ? parseInt(workMatch[1], 10) : 0,
          projectScore: projectMatch ? parseInt(projectMatch[1], 10) : 0,
          skillScore: skillMatch ? parseInt(skillMatch[1], 10) : 0,
          expressionScore: expressionMatch ? parseInt(expressionMatch[1], 10) : 0,
          riskPenalty: 0,
          resumeScore: 0
        };
        result.scores.resumeScore = result.scores.educationScore + result.scores.workScore +
          result.scores.projectScore + result.scores.skillScore + result.scores.expressionScore;
      }

      // 提取教育经历
      const educationMatch = content.match(/"education"\s*:\s*\[([\s\S]*?)(\]|\},)/);
      if (educationMatch) {
        const educationStr = educationMatch[1];
        const schoolMatches = educationStr.match(/"school"\s*:\s*"([^"]+)"/g);
        const majorMatches = educationStr.match(/"major"\s*:\s*"([^"]+)"/g);
        const degreeMatches = educationStr.match(/"degree"\s*:\s*"([^"]+)"/g);
        if (schoolMatches) {
          result.extractedContent.education = schoolMatches.map((match, i) => {
            const school = match.match(/"school"\s*:\s*"([^"]+)"/)?.[1] || '未标注';
            const major = majorMatches?.[i]?.match(/"major"\s*:\s*"([^"]+)"/)?.[1] || '未标注';
            const degree = degreeMatches?.[i]?.match(/"degree"\s*:\s*"([^"]+)"/)?.[1] || '未标注';
            return { school, major, degree, timeRange: '' };
          });
        }
      }

      // 提取工作经历
      const workExpMatch = content.match(/"workExperience"\s*:\s*\[([\s\S]*?)(\]|\},)/);
      if (workExpMatch) {
        const workStr = workExpMatch[1];
        const companyMatches = workStr.match(/"company"\s*:\s*"([^"]+)"/g);
        const roleMatches = workStr.match(/"role"\s*:\s*"([^"]+)"/g);
        if (companyMatches) {
          result.extractedContent.workExperience = companyMatches.map((match, i) => {
            const company = match.match(/"company"\s*:\s*"([^"]+)"/)?.[1] || '未标注';
            const role = roleMatches?.[i]?.match(/"role"\s*:\s*"([^"]+)"/)?.[1] || '未标注';
            return { companyOrOrg: company, role, timeRange: '', description: '' };
          });
        }
      }

      // 提取项目经历
      const projectExpMatch = content.match(/"projectExperience"\s*:\s*\[([\s\S]*?)(\]|\},)/);
      if (projectExpMatch) {
        const projectStr = projectExpMatch[1];
        const projectNameMatches = projectStr.match(/"projectName"\s*:\s*"([^"]+)"/g);
        const projectRoleMatches = projectStr.match(/"role"\s*:\s*"([^"]+)"/g);
        if (projectNameMatches) {
          result.extractedContent.projectExperience = projectNameMatches.map((match, i) => {
            const name = match.match(/"projectName"\s*:\s*"([^"]+)"/)?.[1] || '未标注';
            const role = projectRoleMatches?.[i]?.match(/"role"\s*:\s*"([^"]+)"/)?.[1] || '未标注';
            return { name, role, description: '' };
          });
          result.extractedContent.projects = result.extractedContent.projectExperience;
        }
      }

      // 提取技能
      const skillsMatch = content.match(/"skills"\s*:\s*\[([^\]]*)\]/);
      if (skillsMatch) {
        const skillsStr = skillsMatch[1];
        const skillItems = skillsStr.match(/"([^"]+)"/g);
        if (skillItems) {
          result.extractedContent.skills = skillItems.map(s => ({ name: s.replace(/"/g, '') }));
        }
      }

      // 提取 strengths（从数组中提取字符串）
      const strengthsMatch = content.match(/"strengths"\s*:\s*\[([\s\S]*?)(\]|$)/);
      if (strengthsMatch) {
        const strengthsStr = strengthsMatch[1];
        const strengthItems = strengthsStr.match(/"([^"]+)"/g);
        if (strengthItems) {
          result.strengths = strengthItems.map(s => s.replace(/"/g, '')).filter(s => s.length > 5);
        }
      }

      // 如果没有提取到totalScore，从scores计算
      if (!result.totalScore && result.scores.resumeScore > 0) {
        result.totalScore = Math.min(100, result.scores.resumeScore + 10);
      }

      // 设置recommendation
      if (result.totalScore > 0) {
        result.recommendation = {
          level: this.getRecommendationLevel(result.totalScore),
          reason: result.summary || '由本地VL模型分析',
          color: this.getRecommendationColor(result.totalScore)
        };
      }

      // 如果提取到了有意义的数据，返回结果
      if (result.summary || result.totalScore > 0) {
        console.log(`[本地VL] 从部分JSON中提取成功: totalScore=${result.totalScore}`);
        console.log(`[本地VL] 提取的基本信息: ${JSON.stringify(result.extractedContent.basicInfo)}`);
        console.log(`[本地VL] 教育经历: ${result.extractedContent.education.length}项, 工作经历: ${result.extractedContent.workExperience.length}项`);

        result.parseStatus = ParseStatus.SUCCESS;
        result.dimensionScores = {
          education: { score: result.scores.educationScore, maxScore: 20, details: '' },
          experience: { score: result.scores.workScore, maxScore: 20, details: '' },
          projectQuality: { score: result.scores.projectScore, maxScore: 30, details: '' },
          coreSkills: { score: result.scores.skillScore, maxScore: 25, details: '' },
          overall: { score: result.totalScore, maxScore: 100, details: result.summary }
        };

        // 构建 matchResult 和 educationMatch
        const matchedSkills = (result.extractedContent.skills || []).map(s => s.name).filter(Boolean);
        result.matchResult = {
          coreSkills: matchedSkills.map(skill => ({ skill, type: 'core', score: 3 })),
          businessSkills: [],
          matchedSkills: matchedSkills.map(skill => ({ skill, type: 'matched', score: 3 })),
          missingCoreSkills: [],
          abilityKeywords: []
        };
        result.educationMatch = {
          isMatch: result.extractedContent.education.length > 0,
          educationInfo: result.extractedContent.education,
          matchedMajors: [],
          hasConflict: false
        };
        result.experienceMatch = {
          isMatch: result.extractedContent.workExperience.length > 0 || result.extractedContent.projectExperience.length > 0
        };

        return result;
      }

    } catch (error) {
      console.warn('[本地VL] 部分JSON提取失败:', error.message);
    }

    return null;
  }

  /**
   * 构建标准化的分析结果
   */
  buildNormalizedResult(parsed, position, options) {
    const baseResult = this.createBaseResult(position);

    // 从 VL 模型返回的 extractedContent 中提取数据
    const vlExtractedContent = parsed.extractedContent || {};

    // 规范化教育经历
    const education = this.safeArray(vlExtractedContent.education || []).map(item => {
      if (typeof item === 'string') {
        return { school: item, major: '未标注', degree: '未标注', timeRange: '' };
      }
      return {
        school: item.school || '未标注',
        major: item.major || '未标注',
        degree: item.degree || '未标注',
        timeRange: item.timeRange || '',
        gpa: item.gpa || ''
      };
    });

    // 规范化工作经历
    const workExperience = this.safeArray(vlExtractedContent.workExperience || []).map(item => {
      if (typeof item === 'string') {
        return { companyOrOrg: item, role: '未标注', timeRange: '', description: '' };
      }
      return {
        companyOrOrg: item.company || item.companyOrOrg || '未标注',
        role: item.role || item.position || '未标注',
        timeRange: item.timeRange || '',
        description: item.description || item.responsibilities || ''
      };
    });

    // 规范化项目经历
    const projectExperience = this.safeArray(vlExtractedContent.projectExperience || []).map(item => {
      if (typeof item === 'string') {
        return { name: item, role: '未标注', description: '' };
      }
      return {
        name: item.projectName || item.name || '未标注',
        role: item.role || '未标注',
        timeRange: item.timeRange || '',
        description: item.description || ''
      };
    });

    // 规范化技能列表
    const skills = this.safeArray(vlExtractedContent.skills || []).map(item => {
      if (typeof item === 'string') {
        return { name: item };
      }
      return { name: item.name || item.skill || item };
    });

    const normalized = {
      summary: parsed.summary || '',
      totalScore: this.clampNumber(parsed.totalScore, 0, 100),
      scores: {
        educationScore: this.clampNumber(parsed.scores?.education || parsed.educationScore, 0, 20),
        workScore: this.clampNumber(parsed.scores?.work || parsed.workScore, 0, 20),
        projectScore: this.clampNumber(parsed.scores?.project || parsed.projectScore, 0, 30),
        skillScore: this.clampNumber(parsed.scores?.skill || parsed.skillScore, 0, 25),
        expressionScore: this.clampNumber(parsed.scores?.expression || parsed.expressionScore, 0, 5),
        riskPenalty: 0,
        resumeScore: 0
      },
      strengths: this.normalizeStringArray(parsed.strengths || [], 5),
      risks: this.normalizeRisks(parsed.risks || []),
      suggestions: parsed.suggestions || ['建议进一步面试评估'],
      extractedContent: {
        basicInfo: {
          name: parsed.basicInfo?.name || '',
          phone: extractorService.normalizePhoneCandidate(parsed.basicInfo?.phone || ''),
          email: extractorService.normalizeEmailCandidate(parsed.basicInfo?.email || ''),
          jobIntention: parsed.basicInfo?.jobIntention || ''
        },
        personalInfo: {
          name: parsed.basicInfo?.name || '',
          phone: extractorService.normalizePhoneCandidate(parsed.basicInfo?.phone || ''),
          email: extractorService.normalizeEmailCandidate(parsed.basicInfo?.email || '')
        },
        education,
        workExperience,
        projectExperience,
        projects: projectExperience,  // 兼容旧字段名
        skills,
        campusExperience: [],
        evaluation: ''
      },
      recommendation: {
        level: parsed.recommendation?.level || '建议进一步评估',
        reason: parsed.recommendation?.reason || '由本地VL模型分析',
        color: this.getRecommendationColor(parsed.totalScore !== undefined ? parsed.totalScore : 50)
      }
    };

    // 计算resumeScore
    normalized.scores.resumeScore = this.clampNumber(
      normalized.scores.educationScore +
      normalized.scores.workScore +
      normalized.scores.projectScore +
      normalized.scores.skillScore +
      normalized.scores.expressionScore,
      0, 100
    );

    if (!normalized.totalScore && normalized.scores.resumeScore > 0) {
      normalized.totalScore = normalized.scores.resumeScore;
    }

    if (!normalized.summary) {
      normalized.summary = parsed.recommendation?.reason
        || normalized.strengths[0]
        || `候选人与${position || '目标岗位'}相关信息已提取完成，建议结合面试进一步评估。`;
    }

    console.log(`[本地VL] 构建标准化结果: totalScore=${normalized.totalScore}`);
    console.log(`[本地VL] 基本信息: ${JSON.stringify(normalized.extractedContent.basicInfo)}`);
    console.log(`[本地VL] 教育经历: ${education.length}项, 工作经历: ${workExperience.length}项, 项目经历: ${projectExperience.length}项`);

    // 构建 matchResult，用于评分服务计算技能匹配
    const matchedSkills = skills.map(s => s.name).filter(Boolean);
    const positionConfig = getPositionConfig(position, options.positionConfig);
    const coreSkills = this.safeArray(positionConfig?.coreSkills || []);

    // 解析 AI 生成的 MBTI 岗位匹配度评分
    const mbtiMatchScore = this.clampNumber(parsed.mbtiMatchScore, 0, 100) || null;
    const mbtiMatchReason = this.safeString(parsed.mbtiMatchReason) || '';

    return {
      ...baseResult,
      parseStatus: ParseStatus.SUCCESS,
      ...normalized,
      dimensionScores: {
        education: { score: normalized.scores.educationScore, maxScore: 20, details: '' },
        experience: { score: normalized.scores.workScore, maxScore: 20, details: '' },
        projectQuality: { score: normalized.scores.projectScore, maxScore: 30, details: '' },
        coreSkills: { score: normalized.scores.skillScore, maxScore: 25, details: '' },
        overall: { score: normalized.totalScore, maxScore: 100, details: normalized.summary }
      },
      matchResult: {
        coreSkills: matchedSkills.filter(s => coreSkills.includes(s)).map(skill => ({ skill, type: 'core', score: 3 })),
        businessSkills: matchedSkills.filter(s => !coreSkills.includes(s)).map(skill => ({ skill, type: 'business', score: 3 })),
        matchedSkills: matchedSkills.map(skill => ({ skill, type: 'matched', score: 3 })),
        missingCoreSkills: [],
        abilityKeywords: []
      },
      educationMatch: {
        isMatch: education.length > 0,
        educationInfo: education,
        matchedMajors: education.filter(e => e.major && e.major !== '未标注').map(e => ({ major: e.major })),
        hasConflict: false
      },
      experienceMatch: {
        isMatch: workExperience.length > 0 || projectExperience.length > 0
      },
      smartInsights: {
        verdict: {
          label: normalized.recommendation.level,
          headline: normalized.summary.slice(0, 50),
          summary: normalized.summary
        },
        interviewSuggestions: this.buildInterviewSuggestions(
          parsed.interviewQuestions,
          parsed.suggestions,
          { education, workExperience, projectExperience, skills },
          normalized.risks,
          position
        )
      },
      mbtiMatchScore,  // AI 生成的 MBTI 岗位匹配度评分
      mbtiMatchReason  // MBTI 匹配度评分理由
    };
  }

  /**
    return this.buildResultFromText(content, position, options);
  }

  /**
   * 从文本构建分析结果（当VL模型未返回有效JSON时）
   */
  buildResultFromText(text, position, options = {}) {
    const baseResult = this.createBaseResult(position);

    // 尝试从文本中提取基本信息
    const nameMatch = text.match(/姓名[：:]\s*([^\n]+)/);
    const phoneMatch = text.match(/电话[：:]\s*([^\n]+)/);
    const emailMatch = text.match(/邮箱[：:]\s*([^\n]+)/);

    // 计算一个基础分数
    const textLength = text.length;
    const baseScore = Math.min(60, Math.floor(textLength / 100) + 40);

    return {
      ...baseResult,
      parseStatus: ParseStatus.SUCCESS,
      summary: text.slice(0, 200) || '简历分析完成',
      totalScore: baseScore,
      grade: this.getGrade(baseScore),
      extractedContent: {
        ...baseResult.extractedContent,
        basicInfo: {
          name: nameMatch?.[1]?.trim() || '',
          phone: phoneMatch?.[1]?.trim() || '',
          email: emailMatch?.[1]?.trim() || '',
          jobIntention: ''
        }
      },
      recommendation: {
        level: this.getRecommendationLevel(baseScore),
        reason: '由本地VL模型分析，建议结合面试进一步评估',
        color: this.getRecommendationColor(baseScore)
      },
      metadata: {
        ...baseResult.metadata,
        source: 'local-vl-text-extraction',
        rawTextLength: text.length
      }
    };
  }

  createBaseResult(position) {
    return {
      parseStatus: ParseStatus.SUCCESS,
      summary: '',
      totalScore: 0,
      grade: 'E',
      dimensionScores: {},
      strengths: [],
      risks: [],
      suggestions: [],
      extractedContent: {
        basicInfo: { name: '', phone: '', email: '', jobIntention: '' },
        education: [],
        workExperience: [],
        projectExperience: [],
        skills: [],
        campusExperience: [],
        evaluation: ''
      },
      evidences: [],
      matchResult: {
        coreSkills: [],
        businessSkills: [],
        matchedSkills: [],
        missingCoreSkills: [],
        abilityKeywords: []
      },
      scoreModel: [],
      scores: {
        educationScore: 0,
        workScore: 0,
        projectScore: 0,
        skillScore: 0,
        expressionScore: 0,
        riskPenalty: 0,
        resumeScore: 0
      },
      scoreWeights: {},
      smartInsights: {},
      recommendation: {
        level: '建议进一步评估',
        reason: '当前暂无足够信息完成判断',
        color: 'warning'
      },
      metadata: {
        position,
        analyzedAt: new Date().toISOString(),
        processingTime: 0
      }
    };
  }

  handleParseFailure(parseResult, position) {
    const baseResult = this.createBaseResult(position);
    return {
      ...baseResult,
      parseStatus: parseResult?.status || ParseStatus.PARSE_FAILED,
      error: parseResult?.error || '简历解析失败',
      summary: parseResult?.error || '简历解析失败',
      recommendation: {
        level: '无法分析',
        reason: parseResult?.error || '简历解析失败',
        color: 'danger'
      },
      suggestions: [this.getSuggestionForParseFailure(parseResult?.status)]
    };
  }

  getSuggestionForParseFailure(status) {
    const suggestions = {
      [ParseStatus.PARSE_FAILED]: '简历解析失败，请检查文件是否损坏或重新上传PDF/图片版简历',
      [ParseStatus.OCR_LOW_CONFIDENCE]: '图片识别质量较低，建议上传清晰的PDF或高清图片',
      [ParseStatus.TEXT_TOO_SHORT]: '提取文本过少，建议上传文字版PDF或内容更完整的简历',
      [ParseStatus.UNSUPPORTED_FILE_TYPE]: '当前仅建议上传 PDF、JPG、JPEG、PNG 格式简历',
      [ParseStatus.DEPENDENCY_MISSING]: '服务器解析组件缺失，请联系管理员处理'
    };
    return suggestions[status] || '简历解析出现问题，请稍后重试';
  }

  getDeepSeekConfig() {
    return {
      baseURL: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, ''),
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      timeout: Number(process.env.DEEPSEEK_TIMEOUT_MS || 60000)
    };
  }

  getMaxResumeTextLength() {
    return Number(process.env.DEEPSEEK_RESUME_TEXT_LIMIT || 18000);
  }

  async requestDeepSeekAnalysis(text, position, options = {}) {
    const config = this.getDeepSeekConfig();
    if (!config.apiKey) {
      throw new Error('DEEPSEEK_API_KEY 未配置，无法调用 DeepSeek 简历分析');
    }

    const positionConfig = getPositionConfig(position, options.positionConfig);
    const trimmedText = text.slice(0, this.getMaxResumeTextLength());
    const payload = {
      model: config.model,
      temperature: 0,
      seed: 42,
      messages: [
        {
          role: 'system',
          content: this.buildSystemPrompt()
        },
        {
          role: 'user',
          content: this.buildUserPrompt(trimmedText, position, positionConfig, options)
        }
      ]
    };

    try {
      const response = await axios.post(`${config.baseURL}/chat/completions`, payload, {
        timeout: config.timeout,
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      return this.parseAiJson(response?.data?.choices?.[0]?.message?.content || '');
    } catch (error) {
      const shouldRetryWithoutJsonFormat = [400, 404, 422].includes(error.response?.status || 0);
      if (!shouldRetryWithoutJsonFormat) {
        throw error;
      }

      const fallbackPayload = { ...payload };
      delete fallbackPayload.response_format;
      const response = await axios.post(`${config.baseURL}/chat/completions`, fallbackPayload, {
        timeout: config.timeout,
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      return this.parseAiJson(response?.data?.choices?.[0]?.message?.content || '');
    }
  }

  buildSystemPrompt() {
    return [
      '你是一名资深招聘HR和结构化简历评估专家。',
      '你必须严格依据简历原文作答，不要臆造经历、学校、技能或项目。',
      '请从招聘视角给候选人做保守、专业、可落地的评估，不要过度美化。',
      '输出必须是合法JSON，不要输出Markdown，不要输出代码块，不要补充解释性文字。',
      '所有文案使用简体中文。'
    ].join('\n');
  }

  buildUserPrompt(text, position, positionConfig, options = {}) {
    const candidateProfile = options.candidateProfile && typeof options.candidateProfile === 'object'
      ? options.candidateProfile
      : {};
    const mbtiType = candidateProfile.mbti || options.mbti || '';

    const mbtiSection = mbtiType ? `
【MBTI岗位匹配度评分】
候选人的MBTI类型为：${mbtiType}
请基于以下维度评估该MBTI类型与目标岗位”${position || '未指定'}”的匹配度，并给出0-100分的评分：
1. 该MBTI类型的典型性格特质（如领导力、沟通风格、决策方式、工作偏好）
2. 目标岗位的核心要求（如团队协作、独立工作、压力应对、创新思维、细节把控）
3. 性格特质与岗位要求的契合程度
4. 潜在的性格优势可能带来的工作表现提升
5. 可能需要关注或补足的方面

输出中必须包含 mbtiMatchScore 字段（0-100的整数），以及 mbtiMatchReason 字段（简要说明评分理由）。
` : '';

    return [
      `目标岗位：${position || '未指定'}`,
      `候选人基础信息：${JSON.stringify(candidateProfile, null, 2)}`,
      `岗位画像：${JSON.stringify(positionConfig || {}, null, 2)}`,
      this.buildScoringAnchors(),
      '',
      '请阅读下面的简历文本，并输出一个严格符合以下要求的JSON对象：',
      '1. 你需要以资深HR口吻完成结构化分析和打分。',
      '2. 打分字段必须包含：educationScore(0-20)、workScore(0-20)、projectScore(0-30)、skillScore(0-25)、expressionScore(0-5)、riskPenalty(0-20)、resumeScore(0-100)。',
      '3. riskPenalty 仅用于标记风险强度，不参与简历总分扣减。',
      '4. resumeScore = educationScore + workScore + projectScore + skillScore + expressionScore，并限制在0到100之间。',
      '5. totalScore 与 resumeScore 保持一致。',
      '6. 输出字段必须包含：summary、totalScore、dimensionScores、strengths、risks、suggestions、extractedContent、matchResult、scores、recommendation、smartInsights、evidences。',
      '7. dimensionScores 至少包含：education、experience、projectQuality、coreSkills、overall，每项含 score、maxScore、details。',
      '8. extractedContent 必须包含：basicInfo、education、workExperience、projectExperience、skills、campusExperience、evaluation。',
      '9. matchResult 必须包含：coreSkills、businessSkills、missingCoreSkills、abilityKeywords。coreSkills/businessSkills 中每项尽量返回 {skill,type,score,description}。',
      '10. risks 每项必须包含：type、title、message、description、severity(high|medium|low)、suggestion。',
      '11. recommendation 必须包含：level、reason、color。',
      '12. smartInsights 必须包含：verdict，其中包含 label、headline、summary。',
      '13. smartInsights 还必须包含 interviewSuggestions，为 3 到 5 条面试建议数组。',
      '14. 【面试建议要求】interviewSuggestions 必须严格基于简历原文生成：',
      '    - 必须引用简历中具体的项目名称、公司名称、技能名称',
      '    - 针对风险点设计验证性问题（如工作空窗期、技能描述模糊、项目角色不清）',
      '    - 针对核心技能设计深度追问',
      '    - 避免泛泛而谈的通用问题',
      '    - 格式为面试官可直接提问的问句',
      '15. 所有内容必须基于简历原文，没有证据就留空、写”未提及”或不填，不要编造。',
      mbtiSection,
      `原始解析状态：${options.parserStatus || ParseStatus.SUCCESS}`,
      options.parserError ? `原始解析备注：${options.parserError}` : '',
      '简历文本开始：',
      text,
      '简历文本结束。'
    ].filter(Boolean).join('\n\n');
  }

  parseAiJson(content) {
    const normalized = String(content || '').trim();
    if (!normalized) {
      throw new Error('DeepSeek 未返回可解析内容');
    }

    const cleaned = normalized
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch (error) {
      const objectText = this.extractFirstJsonObject(cleaned);
      if (!objectText) {
        throw new Error('DeepSeek 返回内容不是合法JSON');
      }
      return JSON.parse(objectText);
    }
  }

  extractFirstJsonObject(text) {
    const start = text.indexOf('{');
    if (start < 0) return '';

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < text.length; index += 1) {
      const char = text[index];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (char === '{') depth += 1;
      if (char === '}') depth -= 1;

      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }

    return '';
  }

  normalizeAiAnalysis(raw, text, position, options = {}) {
    const base = this.createBaseResult(position);
    const safe = raw && typeof raw === 'object' ? raw : {};
    const extractedContent = this.normalizeExtractedContent(safe.extractedContent || {});
    const matchResult = this.normalizeMatchResult(
      safe.matchResult || {},
      extractedContent,
      position,
      options.positionConfig
    );
    const scores = this.normalizeScores(safe.scores || {}, safe.totalScore);
    const totalScore = this.clampNumber(
      safe.totalScore !== undefined ? safe.totalScore : scores.resumeScore,
      0,
      SCORE_LIMITS.totalScore
    );
    const recommendation = this.normalizeRecommendation(safe.recommendation, totalScore, extractedContent, position);
    const risks = this.normalizeRisks(safe.risks || []);
    const strengths = this.normalizeStringArray(safe.strengths, 6);
    const suggestions = this.normalizeStringArray(safe.suggestions, 8);
    const dimensionScores = this.normalizeDimensionScores(safe.dimensionScores || {}, scores, totalScore, extractedContent, matchResult);
    const smartInsights = this.normalizeSmartInsights(safe.smartInsights || {}, recommendation, totalScore, strengths, risks);
    const summary = this.normalizeSummary(safe.summary, totalScore, recommendation, strengths, risks);
    const evidences = this.normalizeEvidences(safe.evidences || []);

    // 解析 AI 生成的 MBTI 岗位匹配度评分
    const mbtiMatchScore = this.clampNumber(safe.mbtiMatchScore, 0, 100) || null;
    const mbtiMatchReason = this.safeString(safe.mbtiMatchReason) || '';

    return {
      ...base,
      parseStatus: ParseStatus.SUCCESS,
      sourceText: text,  // 简历源文本（PDF/Word直接提取，或图片OCR识别）
      summary,
      totalScore,
      grade: this.getGrade(totalScore),
      dimensionScores,
      strengths,
      risks,
      suggestions,
      extractedContent,
      evidences,
      matchResult,
      scoreModel: this.buildScoreModel(scores),
      scores,
      scoreWeights: getPositionConfig(position, options.positionConfig)?.weights || {},
      smartInsights,
      recommendation,
      mbtiMatchScore,  // AI 生成的 MBTI 岗位匹配度评分
      mbtiMatchReason, // MBTI 匹配度评分理由
      metadata: {
        ...base.metadata,
        position,
        analyzedAt: safe.metadata?.analyzedAt || new Date().toISOString(),
        parserStatus: options.parserStatus || ParseStatus.SUCCESS
      }
    };
  }

  normalizeExtractedContent(raw) {
    const basicInfo = raw.basicInfo || {};
    return {
      basicInfo: {
        name: this.safeString(basicInfo.name),
        phone: this.safeString(basicInfo.phone),
        email: this.safeString(basicInfo.email),
        jobIntention: this.safeString(basicInfo.jobIntention)
      },
      education: this.safeArray(raw.education).map(item => (typeof item === 'string' ? { school: item } : item)),
      workExperience: this.safeArray(raw.workExperience).map(item => (typeof item === 'string' ? { description: item } : item)),
      projectExperience: this.safeArray(raw.projectExperience).map(item => (typeof item === 'string' ? { description: item } : item)),
      skills: this.safeArray(raw.skills).map(item => (typeof item === 'string' ? { name: item } : item)),
      campusExperience: this.safeArray(raw.campusExperience).map(item => (typeof item === 'string' ? { description: item } : item)),
      evaluation: this.safeString(raw.evaluation)
    };
  }

  normalizeMatchResult(raw, extractedContent, position, positionConfigOverride) {
    const normalizedCoreSkills = this.normalizeSkillMatches(raw.coreSkills, 'core');
    const normalizedBusinessSkills = this.normalizeSkillMatches(raw.businessSkills, 'business');
    const positionConfig = getPositionConfig(position, positionConfigOverride);
    const matchedSkills = [...normalizedCoreSkills, ...normalizedBusinessSkills];
    const matchedSkillNames = matchedSkills.map(item => item.skill);
    const coreSkills = this.safeArray(positionConfig?.coreSkills);
    const missingCoreSkills = this.safeArray(raw.missingCoreSkills).length > 0
      ? this.safeArray(raw.missingCoreSkills).map(item => this.safeString(item)).filter(Boolean)
      : coreSkills.filter(skill => !matchedSkillNames.includes(skill));

    return {
      coreSkills: normalizedCoreSkills,
      businessSkills: normalizedBusinessSkills,
      matchedSkills,
      missingCoreSkills,
      abilityKeywords: this.normalizeStringArray(raw.abilityKeywords, 8)
    };
  }

  normalizeSkillMatches(items, defaultType) {
    return this.safeArray(items)
      .map(item => {
        if (typeof item === 'string') {
          return {
            skill: item,
            type: defaultType,
            score: 3,
            description: ''
          };
        }

        const skill = this.safeString(item.skill || item.name);
        if (!skill) return null;

        return {
          skill,
          type: this.safeString(item.type || item.category || defaultType) || defaultType,
          score: this.clampNumber(item.score, 1, 5) || 3,
          description: this.safeString(item.description)
        };
      })
      .filter(Boolean);
  }

  normalizeScores(rawScores, totalScore) {
    const scores = {
      educationScore: this.clampNumber(rawScores.educationScore, 0, SCORE_LIMITS.educationScore),
      workScore: this.clampNumber(rawScores.workScore, 0, SCORE_LIMITS.workScore),
      projectScore: this.clampNumber(rawScores.projectScore, 0, SCORE_LIMITS.projectScore),
      skillScore: this.clampNumber(rawScores.skillScore, 0, SCORE_LIMITS.skillScore),
      expressionScore: this.clampNumber(rawScores.expressionScore, 0, SCORE_LIMITS.expressionScore),
      riskPenalty: this.clampNumber(rawScores.riskPenalty, 0, SCORE_LIMITS.riskPenalty),
      resumeScore: this.clampNumber(rawScores.resumeScore, 0, SCORE_LIMITS.resumeScore)
    };

    const calculatedResumeScore = this.clampNumber(
      scores.educationScore +
      scores.workScore +
      scores.projectScore +
      scores.skillScore +
      scores.expressionScore,
      0,
      SCORE_LIMITS.resumeScore
    );

    scores.resumeScore = calculatedResumeScore;

    if (!scores.resumeScore && totalScore !== undefined) {
      scores.resumeScore = this.clampNumber(totalScore, 0, SCORE_LIMITS.resumeScore);
    }

    return scores;
  }

  normalizeDimensionScores(raw, scores, totalScore, extractedContent, matchResult) {
    return {
      education: this.normalizeDimensionItem(
        raw.education,
        scores.educationScore,
        SCORE_LIMITS.educationScore,
        extractedContent.education.length > 0 ? '已识别教育经历' : '教育信息较少'
      ),
      experience: this.normalizeDimensionItem(
        raw.experience,
        scores.workScore,
        SCORE_LIMITS.workScore,
        extractedContent.workExperience.length > 0 ? '存在工作经历支撑' : '工作经历较少'
      ),
      projectQuality: this.normalizeDimensionItem(
        raw.projectQuality,
        scores.projectScore,
        SCORE_LIMITS.projectScore,
        extractedContent.projectExperience.length > 0 ? '识别到项目经历' : '项目经历较少'
      ),
      coreSkills: this.normalizeDimensionItem(
        raw.coreSkills,
        scores.skillScore,
        SCORE_LIMITS.skillScore,
        matchResult.matchedSkills.length > 0 ? `命中${matchResult.matchedSkills.length}项岗位相关技能` : '岗位技能命中较少'
      ),
      overall: this.normalizeDimensionItem(
        raw.overall,
        totalScore,
        SCORE_LIMITS.totalScore,
        '综合岗位匹配度评估'
      )
    };
  }

  normalizeDimensionItem(item, fallbackScore, maxScore, fallbackDetails) {
    const source = item && typeof item === 'object' ? item : {};
    return {
      score: this.clampNumber(source.score, 0, maxScore) || fallbackScore || 0,
      maxScore: this.clampNumber(source.maxScore, 1, maxScore) || maxScore,
      details: this.safeString(source.details) || fallbackDetails
    };
  }

  normalizeRisks(risks) {
    // 定义要过滤掉的风险关键词（时间相关、存疑相关）
    const filteredRiskKeywords = [
      '时间', '时长', '日期', '周期', '时长存疑', '时间逻辑',
      '存疑', '逻辑存疑', '实习时间', '工作时间', '经历时间',
      '时间线', '时间跨度', '断档', '空窗期', '时间冲突'
    ];

    const normalizedRisks = this.safeArray(risks)
      .map((item, index) => {
        if (typeof item === 'string') {
          return {
            type: `RISK_${index + 1}`,
            title: item,
            message: item,
            description: item,
            severity: 'medium',
            suggestion: '建议在面试中进一步核实'
          };
        }

        const description = this.safeString(item.description || item.message || item.title);
        if (!description) return null;

        const severity = ['high', 'medium', 'low'].includes(item.severity) ? item.severity : 'medium';
        return {
          type: this.safeString(item.type) || `RISK_${index + 1}`,
          title: this.safeString(item.title) || description,
          message: this.safeString(item.message) || description,
          description,
          severity,
          suggestion: this.safeString(item.suggestion) || '建议在面试中重点核实'
        };
      })
      .filter(Boolean)
      // 过滤掉时间相关和存疑相关的风险项
      .filter(risk => {
        const titleLower = risk.title.toLowerCase();
        const descLower = risk.description.toLowerCase();
        const messageLower = (risk.message || '').toLowerCase();

        // 检查是否包含要过滤的关键词
        const shouldFilter = filteredRiskKeywords.some(keyword =>
          titleLower.includes(keyword) ||
          descLower.includes(keyword) ||
          messageLower.includes(keyword)
        );

        return !shouldFilter;
      });

    // 去重：基于title去重，保留第一个出现的风险项
    const seenTitles = new Set();
    const deduplicatedRisks = normalizedRisks.filter(risk => {
      const normalizedTitle = risk.title.trim().toLowerCase();
      if (seenTitles.has(normalizedTitle)) {
        return false;
      }
      seenTitles.add(normalizedTitle);
      return true;
    });

    return deduplicatedRisks;
  }

  normalizeRecommendation(recommendation, totalScore, extractedContent = null, position = null) {
    const source = recommendation && typeof recommendation === 'object' ? recommendation : {};
    
    if (source.level || source.reason || source.color) {
      return {
        level: this.safeString(source.level) || this.getRecommendationLevel(totalScore),
        reason: this.safeString(source.reason) || this.getRecommendationReason(totalScore, extractedContent, position),
        color: this.safeString(source.color) || this.getRecommendationColor(totalScore)
      };
    }

    return {
      level: this.getRecommendationLevel(totalScore),
      reason: this.getRecommendationReason(totalScore, extractedContent, position),
      color: this.getRecommendationColor(totalScore)
    };
  }

  /**
   * 构建基于简历内容的面试建议
   * 优先使用 VL 模型返回的建议，否则基于简历内容生成
   */
  buildInterviewSuggestions(vlSuggestions, fallbackSuggestions, extractedContent, risks, position) {
    // 如果 VL 模型返回了具体的面试建议，直接使用
    if (Array.isArray(vlSuggestions) && vlSuggestions.length >= 3) {
      return vlSuggestions.slice(0, 5).map(s => String(s).trim()).filter(Boolean);
    }

    const suggestions = [];
    const { education, workExperience, projectExperience, skills } = extractedContent || {};

    // 基于项目经历生成面试建议
    if (Array.isArray(projectExperience) && projectExperience.length > 0) {
      const mainProject = projectExperience[0];
      const projectName = mainProject.name || mainProject.projectName || '你的项目';
      suggestions.push(`请详细介绍在"${projectName}"项目中担任的具体角色和主要贡献？`);
      if (projectExperience.length > 1) {
        const secondProject = projectExperience[1];
        const secondName = secondProject.name || secondProject.projectName || '该项目';
        suggestions.push(`在"${secondName}"项目中遇到了哪些技术难点，是如何解决的？`);
      }
    }

    // 基于工作经历生成面试建议
    if (Array.isArray(workExperience) && workExperience.length > 0) {
      const mainWork = workExperience[0];
      const company = mainWork.company || mainWork.companyOrOrg || '该公司';
      const role = mainWork.role || mainWork.position || '该岗位';
      suggestions.push(`在${company}担任${role}期间，最有成就感的工作成果是什么？`);

      // 检查工作经历是否有空窗期
      if (workExperience.length > 1) {
        suggestions.push(`请说明从上一份工作离职的主要原因？`);
      }
    }

    // 基于教育经历生成面试建议
    if (Array.isArray(education) && education.length > 0) {
      const edu = education[0];
      const school = edu.school || '你的学校';
      const major = edu.major || '你的专业';
      if (major && major !== '未标注') {
        suggestions.push(`你所学的${major}专业对申请${position || '该岗位'}有哪些帮助？`);
      }
    }

    // 基于风险点生成面试建议
    if (Array.isArray(risks) && risks.length > 0) {
      const highRisks = risks.filter(r => r.severity === 'high');
      if (highRisks.length > 0) {
        const risk = highRisks[0];
        const riskTitle = risk.title || '该方面';
        suggestions.push(`关于"${riskTitle}"，能否提供更多细节或证明材料？`);
      }
    }

    // 基于技能生成面试建议
    if (Array.isArray(skills) && skills.length > 0) {
      const mainSkill = skills[0];
      const skillName = typeof mainSkill === 'string' ? mainSkill : (mainSkill.name || '该技能');
      suggestions.push(`你提到熟悉${skillName}，请举例说明在实际项目中的应用经验？`);
    }

    // 如果生成的建议不足3条，使用 fallbackSuggestions 补充
    while (suggestions.length < 3 && Array.isArray(fallbackSuggestions)) {
      const fallback = fallbackSuggestions[suggestions.length];
      if (fallback && !suggestions.includes(fallback)) {
        suggestions.push(String(fallback).trim());
      } else {
        break;
      }
    }

    // 确保至少有3条建议
    const defaultSuggestions = [
      `请做一个简单的自我介绍，重点说明与${position || '该岗位'}相关的工作经历？`,
      '你认为自己最大的优势和需要提升的地方分别是什么？',
      '对未来3-5年的职业发展有什么规划？'
    ];

    while (suggestions.length < 3 && defaultSuggestions.length > 0) {
      const defaultQ = defaultSuggestions.shift();
      if (!suggestions.includes(defaultQ)) {
        suggestions.push(defaultQ);
      }
    }

    return suggestions.slice(0, 5);
  }

  normalizeSmartInsights(raw, recommendation, totalScore, strengths, risks) {
    const verdict = raw.verdict && typeof raw.verdict === 'object' ? raw.verdict : {};
    const riskCount = risks.filter(item => item.severity === 'high').length;
    const interviewSuggestions = this.normalizeStringArray(
      raw.interviewSuggestions || raw.interviewFocus || raw.interviewQuestions,
      5
    ).map(item => item.replace(/\s+/g, ' ').trim());

    return {
      verdict: {
        label: this.safeString(verdict.label) || recommendation.level,
        headline: this.safeString(verdict.headline) || recommendation.reason,
        summary: this.safeString(verdict.summary) || (
          riskCount > 0
            ? `当前存在${riskCount}项高风险点，建议带着问题进入后续评估。`
            : strengths[0] || '整体岗位匹配度中等，建议结合面试继续确认。'
        )
      },
      interviewSuggestions
    };
  }

  normalizeSummary(summary, totalScore, recommendation, strengths, risks) {
    const safeSummary = this.safeString(summary);
    if (safeSummary) return safeSummary;

    const riskCount = risks.filter(item => item.severity === 'high').length;
    let text = `该简历综合评分${totalScore}分（${this.getGrade(totalScore)}级）`;

    if (recommendation.reason) {
      text += `，${recommendation.reason}`;
    }
    if (strengths.length > 0) {
      text += `。亮点包括：${strengths.slice(0, 3).join('；')}`;
    }
    if (riskCount > 0) {
      text += `。当前存在${riskCount}个高风险点，建议重点核实`;
    }

    return text;
  }

  normalizeEvidences(items) {
    return this.safeArray(items)
      .map(item => {
        if (typeof item === 'string') {
          return {
            skill: item,
            type: 'text',
            hasEvidence: true,
            quality: 'medium',
            sources: []
          };
        }

        const skill = this.safeString(item.skill);
        if (!skill) return null;

        return {
          skill,
          type: this.safeString(item.type) || 'text',
          hasEvidence: Boolean(item.hasEvidence !== false),
          quality: this.safeString(item.quality || item.evidenceQuality) || 'medium',
          sources: this.safeArray(item.sources)
        };
      })
      .filter(Boolean);
  }

  buildScoreModel(scores) {
    return [
      { key: 'educationScore', label: '教育背景', score: scores.educationScore, maxScore: SCORE_LIMITS.educationScore },
      { key: 'workScore', label: '工作经历', score: scores.workScore, maxScore: SCORE_LIMITS.workScore },
      { key: 'projectScore', label: '项目经历', score: scores.projectScore, maxScore: SCORE_LIMITS.projectScore },
      { key: 'skillScore', label: '技能匹配', score: scores.skillScore, maxScore: SCORE_LIMITS.skillScore },
      { key: 'expressionScore', label: '表达完整性', score: scores.expressionScore, maxScore: SCORE_LIMITS.expressionScore },
      { key: 'riskPenalty', label: '风险提醒', score: scores.riskPenalty, maxScore: SCORE_LIMITS.riskPenalty }
    ];
  }

  getGrade(score) {
    if (score >= 85) return 'A';
    if (score >= 75) return 'B';
    if (score >= 65) return 'C';
    if (score >= 55) return 'D';
    return 'E';
  }

  getRecommendationLevel(score) {
    if (score >= 82) return '进入下一轮面试';
    if (score >= 65) return '建议复筛';
    if (score >= 50) return '建议补充材料';
    return '建议淘汰';
  }

  getRecommendationReason(score, extractedContent = null, position = null) {
    const { education, workExperience, projectExperience, skills } = extractedContent || {};
    
    const hasWorkExperience = Array.isArray(workExperience) && workExperience.length > 0;
    const hasProjectExperience = Array.isArray(projectExperience) && projectExperience.length > 0;
    const hasSkills = Array.isArray(skills) && skills.length > 0;
    const hasEducation = Array.isArray(education) && education.length > 0;
    
    const mainWork = hasWorkExperience ? workExperience[0] : null;
    const mainProject = hasProjectExperience ? projectExperience[0] : null;
    const mainSkill = hasSkills ? skills[0] : null;
    
    if (score >= 82) {
      let reason = '候选人与岗位较为匹配';
      
      if (mainWork) {
        const company = mainWork.company || mainWork.companyOrOrg || '';
        const role = mainWork.role || mainWork.position || '';
        if (company && role) {
          reason += `，在${company}担任${role}期间积累了相关经验`;
        }
      }
      
      if (mainProject) {
        const projectName = mainProject.name || mainProject.projectName || '';
        if (projectName) {
          reason += reason.includes('，') ? `，"${projectName}"项目经历突出` : `，"${projectName}"项目经历突出`;
        }
      }
      
      if (mainSkill) {
        const skillName = typeof mainSkill === 'string' ? mainSkill : (mainSkill.name || mainSkill.skill || '');
        if (skillName) {
          reason += `，具备${skillName}等核心技能`;
        }
      }
      
      return reason + '，可优先推进后续面试';
    }
    
    if (score >= 65) {
      let reason = '候选人具备一定岗位匹配度';
      
      if (!hasWorkExperience && hasProjectExperience) {
        reason += '，虽缺乏正式工作经验，但项目经历丰富';
      } else if (hasWorkExperience && !hasProjectExperience) {
        reason += '，工作经历稳定';
      } else if (!hasWorkExperience && !hasProjectExperience) {
        reason += '，建议重点考察其实际能力';
      }
      
      if (mainSkill) {
        const skillName = typeof mainSkill === 'string' ? mainSkill : (mainSkill.name || mainSkill.skill || '');
        if (skillName) {
          reason += `，${skillName}技能需在面试中验证`;
        }
      }
      
      return reason + '，建议结合面试继续确认';
    }
    
    if (score >= 50) {
      let reason = '当前履历信息有限';
      
      if (!hasWorkExperience) {
        reason += '，缺乏相关工作经历';
      }
      
      if (!hasProjectExperience) {
        reason += '，项目经验不足';
      }
      
      if (!hasSkills) {
        reason += '，技能描述不明确';
      }
      
      return reason + '，建议补充项目或能力证明';
    }
    
    let reason = '当前简历与岗位要求存在明显差距';
    
    if (!hasWorkExperience && !hasProjectExperience) {
      reason = '缺乏相关工作和项目经验，暂不建议推进';
    } else if (!hasSkills) {
      reason = '技能与岗位要求不匹配，不建议直接推进';
    }
    
    return reason;
  }

  getRecommendationColor(score) {
    if (score >= 82) return 'success';
    if (score >= 65) return 'primary';
    if (score >= 50) return 'warning';
    return 'danger';
  }

  normalizeStringArray(value, limit = 10) {
    return this.safeArray(value)
      .map(item => this.safeString(typeof item === 'string' ? item : item?.text || item?.description || item?.message))
      .filter(Boolean)
      .slice(0, limit);
  }

  safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  safeString(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  clampNumber(value, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(min, Math.min(max, Math.round(parsed)));
  }

  normalizeWhitespace(text) {
    return String(text || '')
      .replace(/\u0000/g, '')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  getSupportedPositions() {
    return getAllPositions();
  }
}

module.exports = new ResumeAnalysisService();
