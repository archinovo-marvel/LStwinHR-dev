'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { loadUploadedFileBuffer, cleanupUploadedFile } = require('./uploadStorage');

// ——— File write semaphore ———
// Limits concurrent disk writes to avoid exhausting kernel I/O buffers.
// Under high concurrency, 200+ simultaneous fs.writeFile calls trigger ENOMEM
// on WSL2. This gate serializes writes so only N happen at once.
const FILE_WRITE_LIMIT = parseInt(process.env.FILE_WRITE_CONCURRENCY, 10) || Math.max(4, os.cpus().length * 4);
let _writeActive = 0;
const _writeQueue = [];

function _acquireWriteSlot() {
  if (_writeActive < FILE_WRITE_LIMIT) { _writeActive++; return Promise.resolve(); }
  return new Promise(r => { _writeQueue.push(r); });
}

function _releaseWriteSlot() {
  _writeActive--;
  const next = _writeQueue.shift();
  if (next) { _writeActive++; next(); }
}

let Jimp;
try { Jimp = require('jimp'); } catch (e) { /* Jimp not available */ }

const { ensureCandidateDatabase, upsertCandidateMinimal, upsertCandidateForUser, generateCandidateId, updateCandidateById } = require('../../services/candidateStore');
const { scheduleResumeAnalysis } = require('../services/resumeAnalysis');

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

async function writeResumeBufferSafely(uploadDir, requestedFileName, fileExt, buffer) {
  await fs.promises.mkdir(uploadDir, { recursive: true });

  const baseName = path.basename(requestedFileName, fileExt);
  let nextFileName = requestedFileName;

  while (true) {
    const nextFilePath = path.join(uploadDir, nextFileName);
    try {
      await fs.promises.writeFile(nextFilePath, buffer, { flag: 'wx' });
      return {
        resumeFileName: nextFileName,
        resumeFilePath: nextFilePath
      };
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }

      const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 1E6)}`;
      nextFileName = `${baseName}_${uniqueSuffix}${fileExt}`;
    }
  }
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
 * Background processing: write file, full DB upsert, schedule AI analysis.
 * Runs after the HTTP response is already sent to the client.
 */
async function processUploadBackground({ candidateId, body, heldBuffer, fileExt, originalName, owner, deps, resumeFilePath, resumeFileName }) {
  const { ensureDataFile, DATA_FILE } = deps;

  try {
    await ensureDataFile();

    const provisionalScores = calculateCandidateScores(body, null);
    const fullCandidate = {
      ...body,
      id: candidateId,
      ownerUserId: owner.id,
      ownerUserName: owner.username || owner.email || '',
      ownerUserEmail: owner.email || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      resumeFilePath,
      resumeOriginalName: originalName,
      resumeFileName,
      matchScore: provisionalScores.finalMatchScore,
      mbtiScore: provisionalScores.mbtiScore,
      resumeScore: provisionalScores.resumeScore,
      resumeAnalysis: createPendingResumeAnalysis(),
      recommendation: '简历分析排队中，请稍候查看结果',
      hasInterview: false,
      status: '分析中'
    };

    if (fullCandidate.resumeFilePath) {
      try {
        const stats = await fs.promises.stat(fullCandidate.resumeFilePath);
        fullCandidate.resumeSize = String(stats.size);
        if (process.env.RESUME_SKIP_HASH !== 'true') {
          fullCandidate.resumeFileHash = await calculateFileHash(fullCandidate.resumeFilePath);
        }
      } catch { /* ignore */ }
    }

    await upsertCandidateForUser(owner.id, fullCandidate);
    scheduleResumeAnalysis(candidateId, { renameAfterAnalysis: true });
  } catch (err) {
    console.error(`Background upload failed for candidate ${candidateId}:`, err.message);
    try {
      await updateCandidateById(candidateId, { status: '上传失败', recommendation: '上传处理失败' });
    } catch { /* best effort */ }
  }
}

/**
 * Async candidate submission — writes file to disk immediately so it's available
 * for re-analysis, then defers heavy DB upsert + AI scheduling to background.
 *
 * The client receives a 202 with { candidateId, status: '处理中', resumeFilePath }.
 */
async function createCandidateSubmission({ body, file, owner, deps }) {
  if (!owner) throw Object.assign(new Error('未授权，请先登录'), { statusCode: 401 });
  const { ensureDataFile, DATA_FILE } = deps;

  await ensureCandidateDatabase(owner.id);
  await ensureDataFile();

  const candidateId = generateCandidateId();
  let resumeFilePath = null, resumeFileName = null;

  // Phase 1 — sync: write file to disk NOW so it exists for re-analysis
  if (file) {
    const heldBuffer = file.buffer ? Buffer.from(file.buffer) : null;
    const fileExt = path.extname(file.originalname || '').toLowerCase();

    if (heldBuffer) {
      const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'resumes');
      const requestedFileName = buildUploadedResumeFileName(body.name, body.position, body.mbti, fileExt);
      const isImage = ['.jpg', '.jpeg', '.png'].includes(fileExt);
      const skipJimp = process.env.RESUME_SKIP_JIMP === 'true';

      const processedUpload = isImage && !skipJimp
        ? await compressImageBufferIfNeeded(heldBuffer, fileExt)
        : { buffer: heldBuffer, compressed: false };

      await _acquireWriteSlot();
      try {
        const written = await writeResumeBufferSafely(uploadDir, requestedFileName, fileExt, processedUpload.buffer);
        resumeFileName = written.resumeFileName;
        resumeFilePath = written.resumeFilePath;
      } finally {
        _releaseWriteSlot();
      }
    }

    // Fire background: full DB upsert + scoring + AI schedule
    const bgBuffer = file.buffer ? Buffer.from(file.buffer) : null;
    const bgExt = path.extname(file.originalname || '').toLowerCase();
    const bgOrigName = file.originalname || null;

    setImmediate(() => {
      processUploadBackground({
        candidateId, body, heldBuffer: bgBuffer, fileExt: bgExt,
        originalName: bgOrigName, owner, deps, resumeFilePath, resumeFileName
      }).catch(err => console.error('Background upload crashed:', err));
    });
  }

  // Clean up temp file if disk storage was used
  await cleanupUploadedFile(file);

  // Phase 2 — sync: insert minimal record (with file blob so re-analysis works immediately)
  const minimal = {
    id: candidateId,
    ownerUserId: owner.id,
    ownerUserName: owner.username || owner.email || '',
    ownerUserEmail: owner.email || '',
    name: body.name || '',
    position: body.position || '',
    phone: body.phone || '',
    email: body.email || '',
    mbti: body.mbti || '',
    status: '处理中',
    resumeFileName,
    resumeOriginalName: file?.originalname || null,
    resumeFileBuffer: file?.buffer || null,
    createdAt: new Date().toISOString()
  };

  await upsertCandidateMinimal(owner.id, minimal);

  return {
    success: true,
    candidateId,
    status: '处理中',
    resumeFilePath,
    candidate: minimal
  };
}

module.exports = { createCandidateSubmission };
