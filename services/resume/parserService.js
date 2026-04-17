/**
 * 解析服务
 * 负责PDF、图片等文件的解析和文本提取
 */
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
let pdfParse, Jimp, mammoth, WordExtractor;
try {
  pdfParse = require('pdf-parse');
  Jimp = require('jimp');
  mammoth = require('mammoth');
  WordExtractor = require('word-extractor');
} catch (error) {
  console.log('⚠️ 简历解析依赖包未完全安装:', error.message);
}

function getJimpReader() {
  return Jimp?.read || Jimp?.Jimp?.read;
}

function getPngMimeType() {
  return Jimp?.MIME_PNG || Jimp?.JimpMime?.png || 'image/png';
}

function getBufferAsync(image, mimeType) {
  if (typeof image.getBufferAsync === 'function') {
    return image.getBufferAsync(mimeType);
  }

  return new Promise((resolve, reject) => {
    image.getBuffer(mimeType, (error, buffer) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(buffer);
    });
  });
}

async function normalizeImageForVL(buffer, sourceExt = '.png', options = {}) {
  const readImage = getJimpReader();
  if (!readImage) {
    return {
      buffer,
      mimeType: sourceExt === '.png' ? 'image/png' : 'image/jpeg'
    };
  }

  const image = await readImage.call(Jimp?.Jimp || Jimp, buffer);
  const maxEdge = Number(options.maxEdge || 1024);
  const jpegQuality = Number(options.quality || 68);

  if (typeof image.scaleToFit === 'function') {
    try {
      await image.scaleToFit({ w: maxEdge, h: maxEdge });
    } catch (_) {
      await image.scaleToFit(maxEdge, maxEdge);
    }
  }

  if (typeof image.quality === 'function') {
    try {
      image.quality(jpegQuality);
    } catch (_) {
    }
  }

  const jpegMime = Jimp?.MIME_JPEG || Jimp?.JimpMime?.jpeg || 'image/jpeg';
  const normalizedBuffer = await getBufferAsync(image, jpegMime);

  return {
    buffer: normalizedBuffer,
    mimeType: jpegMime
  };
}

function extractDocUnicodeText(buffer) {
  try {
    const unicodeText = buffer.toString('utf16le');
    const matches = unicodeText.match(/[\u4e00-\u9fffA-Za-z0-9@._:+\/（）()、，。\-]{4,}/g) || [];
    const cleaned = matches
      .map(item => item.replace(/\u0000/g, '').trim())
      .filter(item => item.length >= 4)
      .filter(item => /[\u4e00-\u9fff]/.test(item) || /@/.test(item) || /\d{5,}/.test(item));

    return Array.from(new Set(cleaned)).join('\n').trim();
  } catch (_) {
    return '';
  }
}

const ParseStatus = {
  SUCCESS: 'SUCCESS',
  PARSE_FAILED: 'PARSE_FAILED',
  OCR_LOW_CONFIDENCE: 'OCR_LOW_CONFIDENCE',
  TEXT_TOO_SHORT: 'TEXT_TOO_SHORT',
  UNSUPPORTED_FILE_TYPE: 'UNSUPPORTED_FILE_TYPE',
  DEPENDENCY_MISSING: 'DEPENDENCY_MISSING',
  VL_OCR_SUCCESS: 'VL_OCR_SUCCESS',
  VL_OCR_FAILED: 'VL_OCR_FAILED'
};

async function convertPDFToImage(buffer) {
  const tempKey = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const tempDir = path.join(os.tmpdir(), 'resume-pdf-convert');
  const tempPdfPath = path.join(tempDir, `${tempKey}.pdf`);
  const tempOutputDir = path.join(tempDir, tempKey);

  await fs.mkdir(tempDir, { recursive: true });

  try {
    await fs.writeFile(tempPdfPath, buffer);

    await execFileAsync('pdftoppm', [
      '-jpeg',
      '-jpegopt',
      'quality=60',
      '-r',
      '110',
      '-singlefile',
      tempPdfPath,
      tempOutputDir
    ], {
      timeout: 30000 // 缩短到30秒
    });

    const jpegPath = `${tempOutputDir}.jpg`;
    const imageBuffer = await fs.readFile(jpegPath);

    return imageBuffer;
  } finally {
    await fs.unlink(tempPdfPath).catch(() => {});
    await fs.unlink(`${tempOutputDir}.jpg`).catch(() => {});
  }
}

async function runVLOCR(buffer, fileName = 'resume', isPDF = false, options = {}) {
  // 图片OCR缩短超时到30秒，扫描PDF保持60秒
  const defaultTimeout = isPDF ? 60000 : 30000;
  const VL_TIMEOUT = Number(process.env.VL_OCR_TIMEOUT_MS || defaultTimeout);
  const startTime = Date.now();
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;

  const vlOcrApiUrl = process.env.VL_OCR_API_URL || 'http://localhost:3001/api/chat';
  // 主VL模型API（OpenAI兼容格式）
  const mainVlApiUrl = process.env.LOCAL_LLM_VL_URL || 'http://localhost:8003';
  const mainVlModel = process.env.LOCAL_LLM_VL_MODEL || 'qwen3.5-9b-vlm-gguf';

  try {
    console.log(`[VL OCR] 开始使用本地VL模型进行OCR识别...`);
    await onProgress?.('Qwen3.5-9B OCR分析中', '正在使用Qwen3.5-9B多模态模型识别简历图像');

    let imageBuffer = buffer;
    if (isPDF) {
      console.log(`[VL OCR] 检测到PDF文件，先转换为图片...`);
      await onProgress?.('Qwen3.5-9B OCR分析中', '正在将扫描版PDF转换为图片');
      try {
        imageBuffer = await convertPDFToImage(buffer);
        console.log(`[VL OCR] PDF转图片成功，图片大小: ${imageBuffer.length} bytes`);
      } catch (convertError) {
        console.error(`[VL OCR] PDF转图片失败:`, convertError.message);
        throw new Error(`PDF转图片失败: ${convertError.message}`);
      }
    }

    const imageExt = path.extname(fileName || '').toLowerCase();
    const normalizedImage = isPDF
      ? {
          buffer: imageBuffer,
          mimeType: 'image/jpeg'
        }
      : ['.jpg', '.jpeg', '.png'].includes(imageExt)
        ? {
            buffer: imageBuffer,
            mimeType: imageExt === '.png' ? 'image/png' : 'image/jpeg'
          }
        : await normalizeImageForVL(
            imageBuffer,
            imageExt,
            { maxEdge: 1024, quality: 68 }
          );
    console.log(`[VL OCR] 归一化图片完成，大小: ${normalizedImage.buffer.length} bytes, MIME: ${normalizedImage.mimeType}`);
    const base64Image = normalizedImage.buffer.toString('base64');
    const imageDataUrl = `data:${normalizedImage.mimeType};base64,${base64Image}`;

    const ocrPrompt = '请逐行转写这张中文简历图片中的文字，只输出识别到的原文，不要总结，不要JSON，不要补充说明。';

    const createTimeoutSignal = (timeoutMs) => {
      if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
        return AbortSignal.timeout(timeoutMs);
      }
      const controller = new AbortController();
      setTimeout(() => controller.abort(), timeoutMs).unref?.();
      return controller.signal;
    };

    // 优先直接调用主VL模型，避免经由额外OCR网关造成阻塞。
    console.log(`[VL OCR] 尝试使用主VL模型: ${mainVlApiUrl}`);
    const mainVlResponse = await fetch(`${mainVlApiUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: createTimeoutSignal(VL_TIMEOUT),
      body: JSON.stringify({
        model: mainVlModel,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: ocrPrompt },
              { type: 'image_url', image_url: { url: imageDataUrl } }
            ]
          }
        ],
        max_tokens: 1600,
        temperature: 0.1
      })
    });

    if (!mainVlResponse.ok) {
      throw new Error(`主VL模型请求失败: HTTP ${mainVlResponse.status}`);
    }

    const mainVlResult = await mainVlResponse.json();
    const mainVlText = mainVlResult?.choices?.[0]?.message?.content || '';
    const elapsedMs = Date.now() - startTime;

    console.log(`[VL OCR] 主VL模型识别完成，耗时: ${elapsedMs}ms，文本长度: ${mainVlText.length}`);

    if (mainVlText.trim().length >= 50) {
      return {
        text: mainVlText.trim(),
        metadata: {
          parser: 'vl-model-main',
          elapsedMs,
          originalFileName: fileName,
          endpoint: mainVlApiUrl
        }
      };
    }

    // 主模型内容过短时，再尝试专用OCR网关。
    console.log(`[VL OCR] 主VL模型返回文本过短，尝试VL OCR API: ${vlOcrApiUrl}`);
    try {
      const response = await fetch(vlOcrApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: createTimeoutSignal(15000),
        body: JSON.stringify({
          message: ocrPrompt,
          mode: 'ocr',
          engine: 'local',
          localModel: mainVlModel,
          images: [imageDataUrl]
        })
      });

      if (response.ok) {
        const text = await response.text();
        if (text.trim().length >= mainVlText.trim().length) {
          return {
            text: text.trim(),
            metadata: {
              parser: 'vl-model-ocr',
              elapsedMs: Date.now() - startTime,
              originalFileName: fileName,
              endpoint: vlOcrApiUrl
            }
          };
        }
      }
    } catch (vlOcrError) {
      console.log(`[VL OCR] VL OCR API调用失败: ${vlOcrError.message}`);
    }

    return {
      text: mainVlText.trim(),
      metadata: {
        parser: 'vl-model-main',
        elapsedMs,
        originalFileName: fileName,
        endpoint: mainVlApiUrl
      }
    };
  } catch (error) {
    const elapsedMs = Date.now() - startTime;
    console.error(`[VL OCR] 识别失败，耗时: ${elapsedMs}ms，错误: ${error.message}`);
    return {
      text: '',
      error: error.message,
      metadata: {
        parser: 'vl-model-ocr',
        elapsedMs,
        error: true
      }
    };
  }
}

async function preprocessImageForOCR(buffer) {
  const readImage = getJimpReader();
  if (!readImage) {
    return buffer;
  }

  const image = await readImage.call(Jimp?.Jimp || Jimp, buffer);
  const maxEdge = 1600;

  if (typeof image.scaleToFit === 'function') {
    try {
      await image.scaleToFit({ w: maxEdge, h: maxEdge });
    } catch (_) {
      await image.scaleToFit(maxEdge, maxEdge);
    }
  }

  if (typeof image.greyscale === 'function') {
    image.greyscale();
  } else if (typeof image.grayscale === 'function') {
    image.grayscale();
  }

  if (typeof image.normalize === 'function') {
    image.normalize();
  }

  if (typeof image.contrast === 'function') {
    image.contrast(0.18);
  }

  return getBufferAsync(image, Jimp?.MIME_JPEG || Jimp?.JimpMime?.jpeg || 'image/jpeg');
}

function countMatches(text, pattern) {
  const matches = String(text || '').match(pattern);
  return matches ? matches.length : 0;
}

function scoreOCRTextQuality(text) {
  const value = String(text || '').trim();
  if (!value) {
    return {
      score: -999,
      length: 0,
      lineCount: 0,
      chineseChars: 0,
      keywordHits: 0,
      contactHits: 0,
      noisyChars: 0,
      brokenChinesePairs: 0
    };
  }

  const chineseChars = countMatches(value, /[\u4e00-\u9fff]/g);
  const keywordHits = countMatches(
    value,
    /教育经历|工作经历|实习经历|项目经历|校园经历|技能|获奖|证书|自我评价|个人信息|电话|手机|邮箱|毕业院校|专业/g
  );
  const contactHits = countMatches(
    value,
    /\b1[3-9]\d{9}\b|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
  );
  const noisyChars = countMatches(value, /[|¦§¤�]/g);
  const brokenChinesePairs = countMatches(value, /[\u4e00-\u9fff]\s+[\u4e00-\u9fff]/g);
  const lineCount = value.split(/\r?\n/).filter(line => line.trim()).length;

  const score =
    Math.min(value.length, 2400) * 0.02 +
    chineseChars * 0.08 +
    keywordHits * 10 +
    contactHits * 14 +
    Math.min(lineCount, 80) * 0.8 -
    noisyChars * 4 -
    brokenChinesePairs * 6;

  return {
    score,
    length: value.length,
    lineCount,
    chineseChars,
    keywordHits,
    contactHits,
    noisyChars,
    brokenChinesePairs
  };
}

function extractImportantOCRLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => (
      /邮箱|电话|手机|微信|毕业|大学|学院|专业|教育经历|工作经历|项目经历|技能|个人信息/.test(line) ||
      /\b1[3-9]\d{9}\b/.test(line) ||
      /@/.test(line)
    ));
}

function mergeOCRTexts(primaryText, secondaryText) {
  const primaryLines = String(primaryText || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  const seen = new Set(primaryLines.map(line => line.replace(/\s+/g, '')));
  const merged = [...primaryLines];

  for (const line of extractImportantOCRLines(secondaryText)) {
    const normalizedLine = line.replace(/\s+/g, '');
    if (!seen.has(normalizedLine)) {
      merged.push(line);
      seen.add(normalizedLine);
    }
  }

  return merged.join('\n');
}

function fuseOCRResults(tesseractResult, vlResult) {
  const tesseractText = String(tesseractResult?.text || '').trim();
  const vlText = String(vlResult?.text || '').trim();
  const tesseractQuality = scoreOCRTextQuality(tesseractText);
  const vlQuality = scoreOCRTextQuality(vlText);

  if (!tesseractText && !vlText) {
    return {
      text: '',
      parser: 'ocr-fusion',
      preferredSource: 'none',
      quality: {
        tesseract: tesseractQuality,
        vl: vlQuality
      }
    };
  }

  if (!tesseractText) {
    return {
      text: vlText,
      parser: 'ocr-fusion(vl-only)',
      preferredSource: 'vl',
      quality: {
        tesseract: tesseractQuality,
        vl: vlQuality
      }
    };
  }

  if (!vlText) {
    return {
      text: tesseractText,
      parser: 'ocr-fusion(tesseract-only)',
      preferredSource: 'tesseract',
      quality: {
        tesseract: tesseractQuality,
        vl: vlQuality
      }
    };
  }

  const preferVL =
    vlQuality.score >= tesseractQuality.score + 8 ||
    (tesseractQuality.brokenChinesePairs >= 3 && vlQuality.chineseChars >= tesseractQuality.chineseChars * 0.7) ||
    (tesseractQuality.noisyChars >= 3 && vlQuality.keywordHits >= tesseractQuality.keywordHits);

  const primaryText = preferVL ? vlText : tesseractText;
  const secondaryText = preferVL ? tesseractText : vlText;

  return {
    text: mergeOCRTexts(primaryText, secondaryText),
    parser: preferVL ? 'ocr-fusion(vl-primary)' : 'ocr-fusion(tesseract-primary)',
    preferredSource: preferVL ? 'vl' : 'tesseract',
    quality: {
      tesseract: tesseractQuality,
      vl: vlQuality
    }
  };
}

async function runNativeTesseractOCR(buffer, originalName = 'resume.jpg', timeoutMs = 30000) {
  const tempKey = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const imageExt = path.extname(originalName || '').toLowerCase() || '.jpg';
  const tempDir = path.join(os.tmpdir(), 'resume-image-ocr');
  const inputPath = path.join(tempDir, `${tempKey}${imageExt === '.png' ? '.png' : '.jpg'}`);

  await fs.mkdir(tempDir, { recursive: true });

  const startTime = Date.now();

  // 创建超时包装函数
  const withTimeout = async (promise, timeoutMs, label) => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${label}超时(${timeoutMs}ms)`));
      }, timeoutMs);
      promise.then(resolve, reject).finally(() => clearTimeout(timer));
    });
  };

  try {
    console.log(`[Tesseract OCR] 开始预处理图片...`);

    // 图片预处理缩短到3秒
    const processedBuffer = await withTimeout(
      preprocessImageForOCR(buffer),
      3000,
      '图片预处理'
    );
    console.log(`[Tesseract OCR] 预处理完成，耗时: ${Date.now() - startTime}ms`);

    await fs.writeFile(inputPath, processedBuffer);

    console.log(`[Tesseract OCR] 开始执行Tesseract识别...`);
    const tesseractStart = Date.now();

    const { stdout } = await execFileAsync('tesseract', [
      inputPath,
      'stdout',
      '-l',
      'chi_sim+eng',
      '--psm',
      '6'
    ], {
      // Tesseract识别时间 = 总超时 - 预处理3秒，最少7秒
      timeout: Math.max(timeoutMs - 3000, 7000),
      maxBuffer: 1024 * 1024 * 8
    });

    console.log(`[Tesseract OCR] 识别完成，耗时: ${Date.now() - tesseractStart}ms，文本长度: ${String(stdout || '').trim().length}`);

    return {
      text: String(stdout || '').trim(),
      metadata: {
        parser: 'tesseract-cli',
        originalFileName: originalName,
        elapsedMs: Date.now() - startTime
      }
    };
  } catch (error) {
    console.warn(`[Tesseract OCR] 识别失败，耗时: ${Date.now() - startTime}ms: ${error.message}`);
    return {
      text: '',
      error: error.message,
      metadata: {
        parser: 'tesseract-cli',
        error: true,
        originalFileName: originalName,
        elapsedMs: Date.now() - startTime
      }
    };
  } finally {
    await fs.unlink(inputPath).catch(() => {});
  }
}

class ParserService {
  async parseFile(buffer, fileType, originalName, options = {}) {
    const ext = fileType.toLowerCase();
    if (ext === '.pdf') {
      return this.parsePDF(buffer, options);
    } else if (['.jpg', '.jpeg', '.png'].includes(ext)) {
      return this.parseImage(buffer, originalName || `resume${ext}`, options);
    } else if (['.doc', '.docx'].includes(ext)) {
      return this.parseWord(buffer, ext);
    } else {
      return {
        status: ParseStatus.UNSUPPORTED_FILE_TYPE,
        text: '',
        error: `不支持的文件类型: ${ext}`,
        metadata: { originalName, fileType: ext }
      };
    }
  }
  async parsePDF(buffer, options = {}) {
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    if (!pdfParse) {
      return {
        status: ParseStatus.DEPENDENCY_MISSING,
        text: '',
        error: 'PDF解析依赖未安装，请安装pdf-parse包',
        metadata: { parser: 'pdf-parse' }
      };
    }
    try {
      console.log('开始解析PDF文件...');
      await onProgress?.('PDF解析中', '正在提取PDF中的原始文本');
      const data = await pdfParse(buffer);
      const text = data.text || '';
      console.log(`PDF解析成功，提取文本长度: ${text.length}`);
      if (text.length < 50) {
        console.log(`PDF文本过短(${text.length}字符)，尝试使用VL模型进行OCR识别...`);
        await onProgress?.('Qwen3.5-9B OCR分析中', 'PDF文本不足，切换到Qwen3.5-9B OCR识别');
        const vlResult = await runVLOCR(buffer, 'pdf', true, options);

        if (vlResult.text && vlResult.text.length > text.length) {
          console.log(`[VL OCR] 回退成功，文本长度: ${vlResult.text.length}`);
          return {
            status: ParseStatus.VL_OCR_SUCCESS,
            text: vlResult.text,
            metadata: {
              ...vlResult.metadata,
              originalTextLength: text.length,
              fallbackReason: 'pdf-parse文本过短'
            }
          };
        }

        return {
          status: ParseStatus.TEXT_TOO_SHORT,
          text,
          error: 'PDF提取文本过短，VL OCR回退也未能提取更多内容',
          metadata: {
            textLength: text.length,
            pageCount: data.numpages,
            info: data.info,
            vlOcrTextLength: vlResult.text?.length || 0
          }
        };
      }
      return {
        status: ParseStatus.SUCCESS,
        text,
        metadata: {
          textLength: text.length,
          pageCount: data.numpages,
          info: data.info,
          parser: 'pdf-parse'
        }
      };
    } catch (error) {
      console.error('PDF解析失败:', error);
      return {
        status: ParseStatus.PARSE_FAILED,
        text: '',
        error: `PDF解析失败: ${error.message}`,
        metadata: { error: error.stack }
      };
    }
  }
  async parseImage(buffer, originalName = 'resume.jpg', options = {}) {
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    // 注意：图片简历始终需要 VL OCR 来提取文本，skipVlOcr 参数对图片无效
    if (!Jimp) {
      return {
        status: ParseStatus.DEPENDENCY_MISSING,
        text: '',
        error: 'OCR依赖未安装，请安装jimp并确保图片预处理可用',
        metadata: { parser: 'vl-model-main' }
      };
    }

    try {
      console.log('开始使用VL OCR优先策略识别图片...');
      await onProgress?.('Qwen3.5-9B OCR分析中', '正在使用Qwen3.5-9B多模态模型进行OCR识别');

      // 优先执行 VL OCR，设置严格超时
      const vlOcrTimeout = 25000; // VL OCR 超时25秒
      let vlResult;
      try {
        vlResult = await Promise.race([
          runVLOCR(buffer, originalName, false, { ...options, timeoutMs: vlOcrTimeout }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('VL OCR 超时')), vlOcrTimeout)
          )
        ]);
      } catch (vlError) {
        console.warn(`[图片OCR] VL OCR失败或超时:`, vlError.message);
        vlResult = { text: '', metadata: { error: vlError.message } };
      }

      const vlText = String(vlResult?.text || '').trim();
      const vlElapsed = vlResult?.metadata?.elapsedMs || 0;

      console.log(`[图片OCR] VL OCR完成，耗时: ${vlElapsed}ms，文本长度: ${vlText.length}`);

      // 如果 VL OCR 结果足够好（>=50字符），直接返回，不启动 Tesseract OCR
      const vlQuality = scoreOCRTextQuality(vlText);
      if (vlText.length >= 50) {
        console.log(`[图片OCR] VL OCR结果可用(长度:${vlText.length}，得分:${vlQuality.score})，直接返回`);

        return {
          status: ParseStatus.SUCCESS,
          text: vlText,
          metadata: {
            parser: 'vl-ocr-primary',
            preferredSource: 'vl',
            textLength: vlText.length,
            vl: vlResult.metadata || {},
            vlQuality
          }
        };
      }

      // VL OCR 结果不足，但不再尝试 Tesseract OCR（容易卡住）
      // 直接返回 VL OCR 结果，让后续分析流程处理
      console.log(`[图片OCR] VL OCR结果不足(${vlText.length}字符)，跳过Tesseract OCR避免阻塞`);

      if (vlText.length > 0) {
        return {
          status: ParseStatus.SUCCESS,
          text: vlText,
          metadata: {
            parser: 'vl-ocr-partial',
            preferredSource: 'vl',
            textLength: vlText.length,
            vl: vlResult.metadata || {},
            vlQuality,
            note: 'VL OCR结果有限，可能影响分析质量'
          }
        };
      }

      // 完全没有结果
      return {
        status: ParseStatus.TEXT_TOO_SHORT,
        text: '',
        error: 'VL OCR未能识别出有效文本，请检查简历图片质量或尝试上传PDF版本',
        metadata: {
          parser: 'vl-ocr-failed',
          vlError: vlResult?.metadata?.error || '未知错误'
        }
      };
    } catch (error) {
      console.error('图片OCR识别失败:', error);
      return {
        status: ParseStatus.PARSE_FAILED,
        text: '',
        error: `图片OCR识别失败: ${error.message}`,
        metadata: { error: error.stack }
      };
    }
  }
  async parseWord(buffer, ext) {
    if (ext === '.doc') {
      if (!WordExtractor) {
        return {
          status: ParseStatus.DEPENDENCY_MISSING,
          text: '',
          error: 'DOC解析依赖未安装，请安装word-extractor包',
          metadata: { parser: 'word-extractor', fileType: ext }
        };
      }

      const tempKey = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const tempDir = path.join(os.tmpdir(), 'resume-doc-parse');
      const tempDocPath = path.join(tempDir, `${tempKey}.doc`);

      try {
        console.log('开始解析DOC文件...');
        await fs.mkdir(tempDir, { recursive: true });
        await fs.writeFile(tempDocPath, buffer);

        const extractor = new WordExtractor();
        const extracted = await extractor.extract(tempDocPath);
        const primaryText = String(extracted?.getBody?.() || '').trim();
        const fallbackText = extractDocUnicodeText(buffer);
        const text = primaryText.length >= fallbackText.length ? primaryText : fallbackText;

        console.log(`DOC解析成功，主文本长度: ${primaryText.length}，兜底文本长度: ${fallbackText.length}，最终文本长度: ${text.length}`);

        if (text.length < 50) {
          return {
            status: ParseStatus.TEXT_TOO_SHORT,
            text,
            error: 'DOC文档提取文本过短',
            metadata: {
              textLength: text.length,
              parser: 'word-extractor',
              fileType: ext,
              fallbackTextLength: fallbackText.length
            }
          };
        }

        return {
          status: ParseStatus.SUCCESS,
          text,
          metadata: {
            textLength: text.length,
            parser: 'word-extractor',
            fileType: ext,
            fallbackTextLength: fallbackText.length
          }
        };
      } catch (error) {
        console.error('DOC解析失败:', error);
        return {
          status: ParseStatus.PARSE_FAILED,
          text: '',
          error: `DOC解析失败: ${error.message}`,
          metadata: { parser: 'word-extractor', fileType: ext, error: error.stack }
        };
      } finally {
        await fs.unlink(tempDocPath).catch(() => {});
      }
    }

    if (!mammoth) {
      return {
        status: ParseStatus.DEPENDENCY_MISSING,
        text: '',
        error: 'Word解析依赖未安装，请安装mammoth包',
        metadata: { parser: 'mammoth', fileType: ext }
      };
    }

    try {
      console.log('开始解析Word文件...');
      const result = await mammoth.extractRawText({ buffer });
      const text = (result.value || '').trim();
      const warnings = result.messages || [];

      console.log(`Word解析成功，提取文本长度: ${text.length}`);

      if (text.length < 50) {
        return {
          status: ParseStatus.TEXT_TOO_SHORT,
          text,
          error: 'Word文档提取文本过短',
          metadata: {
            textLength: text.length,
            parser: 'mammoth',
            warnings
          }
        };
      }

      return {
        status: ParseStatus.SUCCESS,
        text,
        metadata: {
          textLength: text.length,
          parser: 'mammoth',
          warnings
        }
      };
    } catch (error) {
      console.error('Word解析失败:', error);
      return {
        status: ParseStatus.PARSE_FAILED,
        text: '',
        error: `Word解析失败: ${error.message}`,
        metadata: { error: error.stack, parser: 'mammoth', fileType: ext }
      };
    }
  }
  isSuccess(parseResult) {
    return parseResult.status === ParseStatus.SUCCESS;
  }
  needsManualReview(parseResult) {
    return [
      ParseStatus.OCR_LOW_CONFIDENCE,
      ParseStatus.TEXT_TOO_SHORT,
      ParseStatus.PARSE_FAILED
    ].includes(parseResult.status);
  }
  getParseStatusMessage(status) {
    const messages = {
      [ParseStatus.SUCCESS]: '解析成功',
      [ParseStatus.PARSE_FAILED]: '解析失败',
      [ParseStatus.OCR_LOW_CONFIDENCE]: 'OCR识别置信度较低',
      [ParseStatus.TEXT_TOO_SHORT]: '提取文本过短',
      [ParseStatus.UNSUPPORTED_FILE_TYPE]: '不支持的文件类型',
      [ParseStatus.DEPENDENCY_MISSING]: '解析依赖缺失'
    };
    return messages[status] || '未知状态';
  }
}
module.exports = {
  parserService: new ParserService(),
  ParseStatus,
  convertPDFToImage,
  runNativeTesseractOCR,
  runVLOCR,
  scoreOCRTextQuality,
  fuseOCRResults,
  mergeOCRTexts
};
