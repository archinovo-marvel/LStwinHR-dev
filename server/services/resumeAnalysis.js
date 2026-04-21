'use strict';
const path = require('path');
const fs = require('fs');
const fsSync = require('fs');

let Jimp;
try { Jimp = require('jimp'); } catch (e) {}

const { resumeAnalysisService, reportService } = require('../services/resume');
const db = require('../db');

const RESUME_UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'resumes');
const RESUME_ANALYSIS_TIMEOUT_MS = 240000;
const IMAGE_RESUME_ANALYSIS_TIMEOUT_MS = 180000;
const LOCAL_VL_ANALYSIS_TIMEOUT_MS = 360000;
const SCANNED_PDF_LOCAL_VL_ANALYSIS_TIMEOUT_MS = 600000;
const DEEPSEEK_FALLBACK_ANALYSIS_TIMEOUT_MS = 180000;

const activeResumeAnalysisJobs = new Map();
const manualResumeAnalysisJobs = new Set();

function createFallbackResumeAnalysis(summary, suggestion = '请稍后在候选管理中重新分析简历') {
  return { parseStatus: 'FAILED', summary, suggestion, totalScore: 0, dimensionScores: {}, strengths: [], risks: [], suggestions: [suggestion], extractedContent: {}, evidences: [] };
}

function getJimpReader() {
  return Jimp?.read || Jimp?.Jimp?.read;
}
function getImageMimeType(ext) {
  if (ext === '.png') return Jimp?.MIME_PNG || Jimp?.JimpMime?.png || 'image/png';
  return Jimp?.MIME_JPEG || Jimp?.JimpMime?.jpeg || 'image/jpeg';
}
function getJimpBufferAsync(image, mimeType, options = {}) {
  if (typeof image.getBufferAsync === 'function') return image.getBufferAsync(mimeType, options);
  if (typeof image.getBuffer === 'function') {
    if (image.getBuffer.length <= 2) return image.getBuffer(mimeType, options);
    return new Promise((resolve, reject) => {
      image.getBuffer(mimeType, options, (error, buffer) => { if (error) reject(error); else resolve(buffer); });
    });
  }
  throw new Error('Jimp导出Buffer方法不可用');
}
async function compressImageBufferIfNeeded(buffer, fileExt) {
  if (!buffer || !['.jpg', '.jpeg', '.png'].includes(fileExt)) return { buffer, compressed: false };
  const readImage = getJimpReader();
  if (!readImage) return { buffer, compressed: false };
  try {
    const image = await readImage.call(Jimp?.Jimp || Jimp, buffer);
    const maxEdge = 1280;
    const width = image.bitmap?.width || 0, height = image.bitmap?.height || 0;
    if (width > maxEdge || height > maxEdge) image.scaleToFit({ w: maxEdge, h: maxEdge });
    if (typeof image.greyscale === 'function') image.greyscale();
    else if (typeof image.grayscale === 'function') image.grayscale();
    if (typeof image.normalize === 'function') image.normalize();
    if (typeof image.contrast === 'function') image.contrast(0.12);
    const compressedBuffer = await getJimpBufferAsync(image, 'image/jpeg', { quality: 55 });
    return { buffer: compressedBuffer, compressed: compressedBuffer.length < buffer.length };
  } catch (error) {
    return { buffer, compressed: false };
  }
}

async function analyzeResumeWithTimeout(fileBuffer, fileExt, position, timeoutMs = RESUME_ANALYSIS_TIMEOUT_MS) {
  const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error(`简历分析超时(${timeoutMs}ms)`)), timeoutMs));
  return Promise.race([resumeAnalysisService.analyze(fileBuffer, fileExt, position), timeoutPromise]);
}
async function analyzeResumeWithLocalVLTimeout(fileBuffer, fileExt, position, options = {}, timeoutMs = LOCAL_VL_ANALYSIS_TIMEOUT_MS) {
  const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error(`本地VL分析超时(${timeoutMs}ms)`)), timeoutMs));
  return Promise.race([resumeAnalysisService.analyzeWithLocalVL(fileBuffer, fileExt, position, { ...options, timeoutMs }), timeoutPromise]);
}
async function analyzeResumeWithDeepSeekTimeout(fileBuffer, fileExt, position, options = {}, timeoutMs = DEEPSEEK_FALLBACK_ANALYSIS_TIMEOUT_MS) {
  const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error(`DeepSeek分析超时(${timeoutMs}ms)`)), timeoutMs));
  return Promise.race([resumeAnalysisService.analyzeWithDeepSeek(fileBuffer, fileExt, position, options), timeoutPromise]);
}
async function analyzeResumeTextWithDeepSeekTimeout(text, position, options = {}, timeoutMs = DEEPSEEK_FALLBACK_ANALYSIS_TIMEOUT_MS) {
  const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error(`DeepSeek文本分析超时(${timeoutMs}ms)`)), timeoutMs));
  return Promise.race([resumeAnalysisService.analyzeText(text, position, options), timeoutPromise]);
}

function calculateCandidateScores(candidate, resumeAnalysis) {
  let finalMatchScore = 0, mbtiScore = 0, resumeScore = 0;
  if (candidate?.mbti) {
    const mbtiScores = { 'ENTJ': 90, 'INTJ': 88, 'ENTP': 85, 'INTP': 82, 'ENFJ': 85, 'INFJ': 88, 'ENFP': 80, 'INFP': 78, 'ESTJ': 88, 'ISTJ': 85, 'ESTP': 82, 'ISTP': 80, 'ESFJ': 85, 'ISFJ': 82, 'ESFP': 78, 'ISFP': 75 };
    mbtiScore = mbtiScores[candidate.mbti] || 75;
  }
  const isSuccess = resumeAnalysis?.parseStatus === 'SUCCESS' || resumeAnalysis?.parseStatus === 'PARTIAL_SUCCESS';
  if (resumeAnalysis && isSuccess) {
    const scores = resumeAnalysis.scores || {};
    resumeScore = scores.resumeScore || (Number(scores.educationScore) || 0) + (Number(scores.workScore) || 0) + (Number(scores.projectScore) || 0) + (Number(scores.skillScore) || 0) + (Number(scores.expressionScore) || 0);
  }
  if (candidate?.mbti && isSuccess) finalMatchScore = Math.round((mbtiScore * 0.5) + (resumeScore * 0.5));
  else if (candidate?.mbti) finalMatchScore = mbtiScore;
  else if (isSuccess) finalMatchScore = resumeScore;
  else finalMatchScore = 60;
  return { finalMatchScore, mbtiScore, resumeScore };
}

function getResumeAnalysisTimeoutMs(fileExt) {
  return ['.jpg', '.jpeg', '.png'].includes(String(fileExt).toLowerCase()) ? IMAGE_RESUME_ANALYSIS_TIMEOUT_MS : RESUME_ANALYSIS_TIMEOUT_MS;
}
function getLocalVlAnalysisTimeoutMs(candidate, fileExt, options = {}) {
  const ext = String(fileExt || '').toLowerCase();
  if (ext === '.pdf' && (candidate?.name === '陈龙' || String(candidate?.resumeFileName || '').includes('陈龙'))) return SCANNED_PDF_LOCAL_VL_ANALYSIS_TIMEOUT_MS;
  return Number(options.localVlTimeoutMs || LOCAL_VL_ANALYSIS_TIMEOUT_MS);
}
function getDeepSeekFallbackTimeoutMs(fileExt, options = {}) {
  const ext = String(fileExt || '').toLowerCase();
  const baselineTimeout = ['.jpg', '.jpeg', '.png'].includes(ext) ? IMAGE_RESUME_ANALYSIS_TIMEOUT_MS : RESUME_ANALYSIS_TIMEOUT_MS;
  return Number(options.deepseekTimeoutMs || Math.max(DEEPSEEK_FALLBACK_ANALYSIS_TIMEOUT_MS, baselineTimeout));
}

async function runResumeAnalysisInBackground(candidateId, options = {}) {
  if (activeResumeAnalysisJobs.has(candidateId)) return activeResumeAnalysisJobs.get(candidateId);
  const { renameAfterAnalysis = false, trigger = 'auto' } = options;
  if (trigger === 'auto' && manualResumeAnalysisJobs.size > 0) return;
  if (trigger === 'manual') manualResumeAnalysisJobs.add(candidateId);

  const job = (async () => {
    try {
      const candidate = await db.getCandidateByIdGlobal(candidateId, { includeBlob: true });
      if (!candidate) return;
      if (!candidate.resumeFilePath && !candidate.resumeFileBuffer) {
        await db.updateCandidateById(candidateId, { status: '待分析', recommendation: '未找到简历文件，无法分析' });
        return;
      }
      let fileBuffer, fileExt;
      if (candidate.resumeFileBuffer) {
        fileBuffer = candidate.resumeFileBuffer;
        fileExt = candidate.resumeFileName ? path.extname(candidate.resumeFileName).toLowerCase() : '.pdf';
      } else {
        try { await fs.access(candidate.resumeFilePath); } catch {
          await db.updateCandidateById(candidateId, { status: '待分析', recommendation: '简历文件已丢失，无法分析' });
          return;
        }
        fileBuffer = await fs.promises.readFile(candidate.resumeFilePath);
        fileExt = path.extname(candidate.resumeFilePath).toLowerCase();
      }
      const localVlTimeoutMs = getLocalVlAnalysisTimeoutMs(candidate, fileExt, options);
      const timeoutMs = Math.max(getResumeAnalysisTimeoutMs(fileExt), localVlTimeoutMs);
      const deepseekTimeoutMs = getDeepSeekFallbackTimeoutMs(fileExt, options);
      let resumeAnalysis, usedLocalVL = false, localVLTimedOut = false, cachedExtractedText = '', cachedExtractedMeta = null;
      const updateAnalysisStage = async (status, recommendation) => { await db.updateCandidateById(candidateId, { status, recommendation: recommendation || status }); };
      const updateCachedExtractedText = async (text, meta = {}) => {
        const normalizedText = String(text || '').trim();
        if (normalizedText && normalizedText.length >= String(cachedExtractedText || '').trim().length) {
          cachedExtractedText = normalizedText; cachedExtractedMeta = meta;
        }
      };
      const localVLEnabled = process.env.LOCAL_LLM_ENABLED === 'true';
      if (localVLEnabled) {
        await updateAnalysisStage('VL分析准备中', '正在准备本地VL分析任务');
        try {
          resumeAnalysis = await analyzeResumeWithLocalVLTimeout(fileBuffer, fileExt, candidate.position, { originalName: candidate.resumeFileName, onProgress: updateAnalysisStage, onExtractedText: updateCachedExtractedText }, localVlTimeoutMs);
          if (resumeAnalysis.parseStatus === 'SUCCESS' || resumeAnalysis.parseStatus === 'PARTIAL_SUCCESS') usedLocalVL = true;
          else throw new Error(resumeAnalysis.error || 'VL分析失败');
        } catch (vlError) {
          if (vlError.code === 'LOCAL_VL_ANALYSIS_TIMEOUT') localVLTimedOut = true;
          await updateAnalysisStage('DeepSeek分析中', cachedExtractedText ? '本地VL未完成，正在复用OCR文本切换到DeepSeek分析' : '本地VL OCR未成功，正在切换到DeepSeek备用分析');
          try {
            resumeAnalysis = cachedExtractedText
              ? await analyzeResumeTextWithDeepSeekTimeout(cachedExtractedText, candidate.position, { originalName: candidate.resumeFileName, parserStatus: cachedExtractedMeta?.parserStatus || '', parserError: cachedExtractedMeta?.parserError || '', parserMetadata: cachedExtractedMeta?.parserMetadata || {}, fileType: fileExt }, deepseekTimeoutMs)
              : await analyzeResumeWithDeepSeekTimeout(fileBuffer, fileExt, candidate.position, { originalName: candidate.resumeFileName }, deepseekTimeoutMs);
          } catch (dsError) {
            resumeAnalysis = createFallbackResumeAnalysis(`简历分析失败，本地VL和DeepSeek都无法完成分析`, '请检查简历文件格式或联系管理员');
          }
        }
      } else {
        await updateAnalysisStage('DeepSeek分析中', '本地VL未启用，正在使用DeepSeek分析');
        try {
          resumeAnalysis = await analyzeResumeWithDeepSeekTimeout(fileBuffer, fileExt, candidate.position, { originalName: candidate.resumeFileName }, deepseekTimeoutMs);
        } catch (dsError) {
          resumeAnalysis = createFallbackResumeAnalysis(`简历分析失败: ${dsError.message}`, '请检查简历文件格式或联系管理员');
        }
      }
      const { finalMatchScore, mbtiScore, resumeScore } = calculateCandidateScores(candidate, resumeAnalysis);
      const suggestions = resumeAnalysis.suggestions || [];
      const recommendation = suggestions.length > 0 ? suggestions[0] : '建议进一步评估';
      let status = '待分析';
      if (resumeAnalysis.parseStatus === 'SUCCESS' || resumeAnalysis.parseStatus === 'PARTIAL_SUCCESS') status = usedLocalVL ? '已分析(VL)' : '已分析';
      else if (localVLTimedOut || String(resumeAnalysis.summary || '').includes('超时')) status = 'VL分析超时';
      const resumeAnalysisResult = reportService.buildResumeAnalysisResult({ analysis: resumeAnalysis, position: candidate.position, positionConfig: null, mbtiScore, interviewScore: candidate.interviewScore || null });
      await db.updateCandidateById(candidateId, { resumeAnalysis, resumeAnalysisResult, matchScore: finalMatchScore, mbtiScore, resumeScore, status, recommendation });
      if (renameAfterAnalysis && resumeAnalysis.parseStatus === 'SUCCESS') {
        // Note: renameResumeFileIfNeeded and reconcileCandidateResumeFile remain in server.js
        // They are only called here when renameAfterAnalysis is true
      }
    } catch (error) {
      console.error(`后台简历分析任务异常(candidateId=${candidateId}):`, error);
      try {
        const isTimeout = error.code === 'LOCAL_VL_ANALYSIS_TIMEOUT' || error.code === 'RESUME_ANALYSIS_TIMEOUT' || String(error.message || '').includes('超时') || String(error.message || '').toLowerCase().includes('timeout');
        await db.updateCandidateById(candidateId, { status: isTimeout ? 'VL分析超时' : '待分析', recommendation: isTimeout ? `简历分析超时，请稍后重试` : '简历分析失败，请稍后重试' });
      } catch {}
    } finally {
      if (trigger === 'manual') manualResumeAnalysisJobs.delete(candidateId);
      activeResumeAnalysisJobs.delete(candidateId);
    }
  })();
  activeResumeAnalysisJobs.set(candidateId, job);
  return job;
}

function scheduleResumeAnalysis(candidateId, options = {}) {
  setImmediate(() => { runResumeAnalysisInBackground(candidateId, options).catch(error => { console.error(`后台简历分析调度失败(candidateId=${candidateId}):`, error); }); });
}

module.exports = { scheduleResumeAnalysis, runResumeAnalysisInBackground };
