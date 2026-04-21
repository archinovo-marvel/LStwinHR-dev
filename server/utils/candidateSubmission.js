'use strict';
const path = require('path');
const fs = require('fs');
const fsSync = require('fs');
const crypto = require('crypto');

let Jimp;
try { Jimp = require('jimp'); } catch (e) { /* Jimp not available */ }

const { generateCandidateId } = require('../../db');

function sanitizeFileNamePart(value, fallback = '未命名') {
  if (!value) return fallback;
  return String(value).replace(/[\\/:*?"<>|]/g, '_').substring(0, 30) || fallback;
}

function buildUploadedResumeFileName(name, position, mbti, ext) {
  const safeName = sanitizeFileNamePart(name, '候选人');
  const safePosition = sanitizeFileNamePart(position, '未定岗位');
  const safeMbti = sanitizeFileNamePart(mbti, '未测MBTI');
  return `${safeName}_${safePosition}_${safeMbti}${ext}`;
}

function getJimpReader() {
  if (!Jimp) return null;
  if (typeof Jimp.read === 'function') return Jimp;
  if (typeof Jimp.default?.read === 'function') return Jimp.default;
  return null;
}

function getImageMimeType(ext) {
  const m = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
  return m[ext] || 'image/jpeg';
}

function getJimpBufferAsync(image, mimeType, options = {}) {
  return new Promise((resolve, reject) => {
    image.getBuffer(mimeType, (err, buffer) => {
      if (err) reject(err); else resolve(buffer);
    });
  });
}

async function compressImageBufferIfNeeded(buffer, fileExt) {
  if (!buffer || !['.jpg', '.jpeg', '.png'].includes(fileExt)) {
    return { buffer, compressed: false };
  }
  const readImage = getJimpReader();
  if (!readImage) return { buffer, compressed: false };
  try {
    const image = await readImage.call(Jimp?.Jimp || Jimp, buffer);
    const maxEdge = 1280;
    const width = image.bitmap?.width || 0;
    const height = image.bitmap?.height || 0;
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

async function calculateFileHash(filePath) {
  const fileBuffer = await fs.promises.readFile(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

function createPendingResumeAnalysis(summary = '简历分析已加入后台队列，请稍候查看结果') {
  return { parseStatus: 'PENDING', summary, totalScore: 0, dimensionScores: {}, strengths: [], risks: [], suggestions: ['后台正在分析简历，请稍候在候选管理中查看结果'], extractedContent: {}, evidences: [] };
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

/**
 * Create a candidate submission - handles file upload, scoring, and DB persistence.
 * @param {object} params
 * @param {object} params.body - request body
 * @param {object} params.file - uploaded file (multer)
 * @param {object} params.owner - authenticated user { id, username, email }
 * @param {object} params.deps - server dependencies { ensureCandidateDatabase, upsertCandidateForUser, scheduleResumeAnalysis, ensureDataFile, DATA_FILE }
 */
async function createCandidateSubmission({ body, file, owner, deps }) {
  if (!owner) throw Object.assign(new Error('未授权，请先登录'), { statusCode: 401 });
  const { ensureCandidateDatabase, upsertCandidateForUser, scheduleResumeAnalysis, ensureDataFile, DATA_FILE } = deps;

  await ensureCandidateDatabase(owner.id);
  await ensureDataFile();

  let resumeFilePath = null, resumeFileName = null;

  if (file) {
    try {
      const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'resumes');
      if (!fsSync.existsSync(uploadDir)) fsSync.mkdirSync(uploadDir, { recursive: true });
      const fileExt = path.extname(file.originalname).toLowerCase();
      resumeFileName = buildUploadedResumeFileName(body.name, body.position, body.mbti, fileExt);
      resumeFilePath = path.join(uploadDir, resumeFileName);
      const processedUpload = await compressImageBufferIfNeeded(file.buffer, fileExt);
      if (fsSync.existsSync(resumeFilePath)) {
        const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 1E6)}`;
        const baseName = path.basename(resumeFileName, fileExt);
        resumeFileName = `${baseName}_${uniqueSuffix}${fileExt}`;
        resumeFilePath = path.join(uploadDir, resumeFileName);
      }
      await fs.promises.writeFile(resumeFilePath, processedUpload.buffer);
    } catch (error) {
      console.error('保存文件失败:', error);
    }
  }

  const provisionalScores = calculateCandidateScores(body, null);
  const newCandidate = {
    ...body,
    id: generateCandidateId(),
    ownerUserId: owner.id,
    ownerUserName: owner.username || owner.email || '',
    ownerUserEmail: owner.email || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resumeFilePath,
    resumeOriginalName: file ? file.originalname : null,
    resumeFileName,
    matchScore: provisionalScores.finalMatchScore,
    mbtiScore: provisionalScores.mbtiScore,
    resumeScore: provisionalScores.resumeScore,
    resumeAnalysis: file ? createPendingResumeAnalysis() : null,
    recommendation: file ? '简历分析排队中，请稍候查看结果' : '建议进一步评估',
    hasInterview: false,
    status: file ? '分析中' : '已提交'
  };

  if (newCandidate.resumeFilePath && fsSync.existsSync(newCandidate.resumeFilePath)) {
    try {
      const stats = await fs.promises.stat(newCandidate.resumeFilePath);
      newCandidate.resumeSize = String(stats.size);
      newCandidate.resumeFileHash = await calculateFileHash(newCandidate.resumeFilePath);
    } catch (error) { /* ignore */ }
  }

  if (file) newCandidate.resumeFileBuffer = file.buffer;
  await upsertCandidateForUser(owner.id, newCandidate);
  if (file) scheduleResumeAnalysis(newCandidate.id, { renameAfterAnalysis: true });

  return newCandidate;
}

module.exports = { createCandidateSubmission };
