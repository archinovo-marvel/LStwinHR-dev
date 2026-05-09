const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');

// 数据文件路径
const DATA_FILE = path.join(__dirname, 'candidate-data.json');

// 确保数据文件存在
async function ensureDataFile() {
  try {
    await fs.access(DATA_FILE);
  } catch (error) {
    await fs.writeFile(DATA_FILE, JSON.stringify([]));
  }
}
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { createDiskUpload } = require('./server/utils/uploadStorage');
let Jimp;
try {
  Jimp = require('jimp');
} catch (error) {
  console.warn('⚠️ Jimp未成功加载，图片压缩功能将降级:', error.message);
}
const { pool, testConnection, dbConfig, initPersonalUserDB } = require('./db');
const {
  generateCandidateId,
  ensureCandidateDatabase,
  listCandidatesForUser,
  getCandidateById,
  getCandidateByIdGlobal,
  findCandidateBySnapshot,
  upsertCandidateForUser,
  updateCandidateById,
  deleteCandidateById,
  clearCandidatesForUser,
  listPositionsForUser,
  getPositionByName,
  upsertPositionForUser,
  deletePositionById,
  buildResumePointer,
  getCurrentInterviewSessionForUser,
  listInterviewSessionsForUser,
  getInterviewSessionById,
  createInterviewSessionForUser,
  upsertInterviewSessionForUser,
  deleteInterviewSessionById,
  deleteTemporaryInterviewSessionsForUser
} = require('./services/candidateStore');
const { scheduleResumeAnalysis } = require('./server/services/resumeAnalysis');
const { createVerificationCodeStore } = require('./server/services/verificationCodeStore');
require('dotenv').config();
const { 
  resumeAnalysisService, 
  ParseStatus,
  getAllPositions,
  getPositionConfig,
  normalizePositionConfig,
  buildPositionDescription,
  reportService
} = require('./services/resume');
console.log('✅ 简历分析服务模块加载成功');
const app = express();
const PORT = 3001;
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://ollama:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'deepseek-r1:14b';
const LOCAL_LLM_ENABLED = process.env.LOCAL_LLM_ENABLED === 'true';
const LOCAL_LLM_URL = process.env.LOCAL_LLM_URL || 'http://host.docker.internal:8002';
const LOCAL_LLM_MODEL = process.env.LOCAL_LLM_MODEL || 'qwen2-7b-gguf';
const LOCAL_LLM_VL_URL = process.env.LOCAL_LLM_VL_URL || 'http://host.docker.internal:8003';
const LOCAL_LLM_VL_MODEL = process.env.LOCAL_LLM_VL_MODEL || 'qwen3-vl-8b-gguf';
const DOCKER_CONTROL_ENABLED = process.env.DOCKER_CONTROL_ENABLED === 'true';
const _containerCache = new Map();

async function resolveContainerName(serviceKey) {
  const cached = _containerCache.get(serviceKey);
  if (cached && (Date.now() - cached.ts) < 30000) return cached.name;
  try {
    const { stdout } = await execFileAsync('docker', [
      'ps', '--filter', `label=com.docker.compose.service=${serviceKey}`,
      '--format', '{{.Names}}'
    ], { timeout: 10000 });
    const name = String(stdout || '').trim().split('\n')[0];
    if (!name) return null;
    _containerCache.set(serviceKey, { name, ts: Date.now() });
    return name;
  } catch (_) {
    return null;
  }
}

function invalidateContainerCache() {
  _containerCache.clear();
}
const RESUME_UPLOAD_DIR = path.join(__dirname, 'uploads', 'resumes');
const RESUME_ANALYSIS_TIMEOUT_MS = 10000;
const IMAGE_RESUME_ANALYSIS_TIMEOUT_MS = 20000;
const LOCAL_VL_ANALYSIS_TIMEOUT_MS = Number(process.env.LOCAL_VL_ANALYSIS_TIMEOUT_MS || 90000);
const SCANNED_PDF_LOCAL_VL_ANALYSIS_TIMEOUT_MS = Number(process.env.SCANNED_PDF_LOCAL_VL_ANALYSIS_TIMEOUT_MS || 90000);
const DEEPSEEK_FALLBACK_ANALYSIS_TIMEOUT_MS = Number(process.env.DEEPSEEK_FALLBACK_ANALYSIS_TIMEOUT_MS || 90000);
const activeResumeAnalysisJobs = new Map();
const manualResumeAnalysisJobs = new Set();
const execFileAsync = promisify(execFile);

const LOCAL_MODEL_REGISTRY = {
  'qwen3-vl-8b-gguf': {
    key: 'qwen3-vl-8b-gguf',
    label: 'Qwen3-VL-8B（图文）',
    model: 'qwen3-vl-8b-gguf',
    url: LOCAL_LLM_VL_URL,
    supportsImages: true
  }
};

const upload = createDiskUpload({
  fileSize: 10 * 1024 * 1024,
  allowedTypes: ['.pdf', '.doc', '.docx', '.jpg', '.jpeg'],
  errorMessage: '只支持PDF、Word、JPG格式文件'
});

// 中间件
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
app.use(cors({ origin: corsOrigin, credentials: false }));
app.use('/uploads', express.static('uploads'));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// JWT密钥
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 16) {
  console.error('❌ JWT_SECRET 未配置或长度不足16位，服务器拒绝启动');
  process.exit(1);
}

// 邮件配置
const emailTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT) || 465,
  secure: process.env.EMAIL_SECURE !== 'false',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  connectionTimeout: 10000,
  socketTimeout: 10000,
  tls: {
    rejectUnauthorized: process.env.EMAIL_TLS_REJECT_UNAUTHORIZED !== 'false'
  }
});

// 验证邮件服务连接
const verifyEmailConfig = async () => {
  try {
    await emailTransporter.verify();
    console.log('✅ 邮件服务连接成功');
    return true;
  } catch (error) {
    console.error('❌ 邮件服务连接失败:', error.message);
    return false;
  }
};

async function resolveOllamaModel() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!response.ok) {
      throw new Error(`Ollama tags request failed: ${response.status}`);
    }

    const result = await response.json();
    const models = result.models || [];
    if (models.length === 0) {
      throw new Error('Ollama 中暂无可用模型，请先执行 ollama pull 拉取模型');
    }

    const exactMatch = models.find(model => model.name === OLLAMA_MODEL);
    return exactMatch?.name || models[0].name;
  } catch (error) {
    throw new Error(`无法获取 Ollama 模型列表: ${error.message}`);
  }
}

function listLocalModels() {
  return Object.values(LOCAL_MODEL_REGISTRY).map(model => ({
    key: model.key,
    label: model.label,
    model: model.model,
    enabled: LOCAL_LLM_ENABLED,
    supportsImages: !!model.supportsImages
  }));
}

function resolveLocalModelConfig(preferredLocalModel = '') {
  const requestedKey = String(preferredLocalModel || '').trim();
  if (requestedKey && LOCAL_MODEL_REGISTRY[requestedKey]) {
    return LOCAL_MODEL_REGISTRY[requestedKey];
  }

  if (LOCAL_MODEL_REGISTRY[LOCAL_LLM_MODEL]) {
    return LOCAL_MODEL_REGISTRY[LOCAL_LLM_MODEL];
  }

  return Object.values(LOCAL_MODEL_REGISTRY)[0];
}

async function runDockerCommand(args, timeout = 180000) {
  const result = await execFileAsync('docker', args, {
    timeout,
    maxBuffer: 1024 * 1024 * 10
  });
  return {
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim()
  };
}

async function isContainerRunning(containerName) {
  try {
    const { stdout } = await runDockerCommand(['inspect', '--format', '{{.State.Running}}', containerName], 30000);
    return stdout === 'true';
  } catch (error) {
    return false;
  }
}

async function startContainerIfNeeded(containerName) {
  if (await isContainerRunning(containerName)) {
    return;
  }
  await runDockerCommand(['start', containerName], 180000);
}

async function stopContainerIfNeeded(containerName) {
  if (!await isContainerRunning(containerName)) {
    return;
  }
  await runDockerCommand(['stop', containerName], 180000);
}

async function waitForServiceReady(url, timeoutMs = 240000, intervalMs = 3000) {
  const startedAt = Date.now();
  let lastError = '';

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return true;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error.message;
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error(`等待服务就绪超时: ${url}${lastError ? ` (${lastError})` : ''}`);
}

async function getChatRuntimeStatus(preferredEngine = 'auto', preferredLocalModel = '') {
  const forceLocal = preferredEngine === 'local';
  const forceOllama = preferredEngine === 'ollama';
  const useAuto = preferredEngine === 'auto' || !preferredEngine;
  const localModel = resolveLocalModelConfig(preferredLocalModel);
  const runtime = {
    defaultEngine: LOCAL_LLM_ENABLED ? 'auto' : 'ollama',
    selectedEngine: preferredEngine,
    currentEngine: LOCAL_LLM_ENABLED ? 'local' : 'ollama',
    currentModel: '',
    currentLabel: '',
    currentLocalModelKey: localModel?.key || '',
    availableEngines: [
      {
        key: 'auto',
        label: '自动',
        enabled: true
      },
      {
        key: 'ollama',
        label: 'Ollama',
        enabled: true
      },
      {
        key: 'local',
        label: '本地模型',
        enabled: LOCAL_LLM_ENABLED
      }
    ],
    availableLocalModels: listLocalModels()
  };

  if (forceLocal) {
    if (!LOCAL_LLM_ENABLED) {
      runtime.currentEngine = 'unknown';
      runtime.currentLabel = '本地模型未启用';
      runtime.localError = '本地模型当前未启用';
      return runtime;
    }

    runtime.currentEngine = 'local';
    runtime.currentModel = localModel?.model || LOCAL_LLM_MODEL;
    runtime.currentLocalModelKey = localModel?.key || '';
    runtime.currentLabel = `本地模型 ${localModel?.model || LOCAL_LLM_MODEL}`;
    return runtime;
  }

  if (LOCAL_LLM_ENABLED && useAuto) {
    runtime.currentEngine = 'local';
    runtime.currentModel = localModel?.model || LOCAL_LLM_MODEL;
    runtime.currentLocalModelKey = localModel?.key || '';
    runtime.currentLabel = `本地模型 ${localModel?.model || LOCAL_LLM_MODEL}`;
    return runtime;
  }

  if (forceOllama || useAuto || !LOCAL_LLM_ENABLED) {
    try {
      const resolvedModel = await resolveOllamaModel();
      runtime.currentEngine = 'ollama';
      runtime.currentModel = resolvedModel;
      runtime.currentLabel = `Ollama ${resolvedModel}`;
    } catch (error) {
      runtime.currentEngine = 'ollama';
      runtime.currentLabel = 'Ollama 未就绪';
      runtime.ollamaError = error.message;
    }
  }

  return runtime;
}

async function streamLocalModelResponse(res, prompt, mode = 'general', localModelKey = '', images = []) {
  const localModel = resolveLocalModelConfig(localModelKey);
  if (!localModel) {
    throw new Error('未找到可用的本地模型配置');
  }

  const normalizedImages = Array.isArray(images)
    ? images.filter(image => image && typeof image === 'string' && image.startsWith('data:image/'))
    : [];

  if (normalizedImages.length > 0 && !localModel.supportsImages) {
    throw new Error('当前本地模型不支持图片输入，请切换到 Qwen3-VL');
  }

  const userContent = normalizedImages.length > 0
    ? [
        { type: 'text', text: prompt },
        ...normalizedImages.map(image => ({
          type: 'image_url',
          image_url: {
            url: image
          }
        }))
      ]
    : prompt;

  const response = await fetch(`${localModel.url}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: localModel.model,
      stream: false,
      max_tokens: mode === 'interview' ? 384 : 512,
      temperature: mode === 'interview' ? 0.2 : 0.3,
      messages: [
        {
          role: 'system',
          content: buildChatSystemPrompt(mode)
        },
        {
          role: 'user',
          content: userContent
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`本地模型服务请求失败(${response.status}) ${errorText}`.trim());
  }

  const result = await response.json();
  const content = result?.choices?.[0]?.message?.content || '';
  if (!content) {
    throw new Error('本地模型返回为空');
  }
  res.write(content);

  return localModel;
}

async function streamOllamaResponse(res, prompt, mode = 'general', preferredModel = null) {
  const model = preferredModel || await resolveOllamaModel();
  const ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      prompt,
      stream: true,
      options: {
        temperature: mode === 'interview' ? 0.6 : 0.7
      }
    })
  });

  if (!ollamaResponse.ok || !ollamaResponse.body) {
    const errorText = await ollamaResponse.text().catch(() => '');
    throw new Error(`Ollama请求失败(${ollamaResponse.status}) ${errorText}`.trim());
  }

  const reader = ollamaResponse.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      const chunk = JSON.parse(line);
      if (chunk.response) {
        res.write(chunk.response);
      }
    }
  }

  if (buffer.trim()) {
    const lastChunk = JSON.parse(buffer);
    if (lastChunk.response) {
      res.write(lastChunk.response);
    }
  }
}

function buildChatSystemPrompt(mode = 'general') {
  if (mode === 'interview') {
    return [
      '你是“招聘灵犀”的专业 AI 面试官。',
      '你的目标是围绕候选人的岗位、经历和回答进行专业面试。',
      '回答要求自然、专业、简洁，不要使用 Markdown 标题。',
      '如果输入中包含“当前面试问题”和“候选人回答”，请先评价回答，再决定是否追问或提出下一题。'
    ].join('\n');
  }

  return [
    '你是“招聘灵犀”的本地 AI 招聘助手。',
    '请围绕招聘、岗位咨询、公司问答、面试建议等场景进行回答。',
    '回答使用简体中文，风格专业、友好、简洁。',
    '如果用户是在面试上下文中提问，请优先以面试官视角作答。'
  ].join('\n');
}

function createFallbackResumeAnalysis(summary, suggestion = '请稍后在候选管理中重新分析简历') {
  return {
    parseStatus: 'PARSE_FAILED',
    summary,
    totalScore: 0,
    dimensionScores: {},
    strengths: [],
    risks: [{ type: 'ANALYSIS_ERROR', description: summary, severity: 'high' }],
    suggestions: [suggestion],
    extractedContent: {},
    evidences: []
  };
}

function sanitizeFileNamePart(value, fallback = '未命名') {
  const normalized = String(value || fallback)
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || fallback;
}

function buildAnalyzedResumeFileName(name, position, score, ext) {
  const safeName = sanitizeFileNamePart(name, '候选人');
  const safePosition = sanitizeFileNamePart(position, '未定岗位');
  return `${safeName}_${safePosition}${ext}`;
}

function buildUploadedResumeFileName(name, position, mbti, ext) {
  const safeName = sanitizeFileNamePart(name, '候选人');
  const safePosition = sanitizeFileNamePart(position, '未定岗位');
  const safeMbti = sanitizeFileNamePart(mbti, '未测MBTI');
  return `${safeName}_${safePosition}_${safeMbti}${ext}`;
}

function shouldUseAnalyzedResumeName(candidate) {
  return Number.isFinite(Number(candidate?.matchScore)) && Number(candidate.matchScore) > 0;
}

function buildCanonicalResumeFileName(candidate, ext) {
  if (shouldUseAnalyzedResumeName(candidate)) {
    return buildAnalyzedResumeFileName(candidate.name, candidate.position, candidate.matchScore, ext);
  }

  return buildUploadedResumeFileName(candidate.name, candidate.position, candidate.mbti, ext);
}

function collectResumeCandidateFileNames(candidate, ext = '') {
  const names = new Set();
  const fileExt = ext || path.extname(candidate?.resumeFilePath || candidate?.resumeFileName || candidate?.resumeOriginalName || '').toLowerCase();

  if (fileExt) {
    names.add(buildUploadedResumeFileName(candidate.name, candidate.position, candidate.mbti, fileExt));
    names.add(buildAnalyzedResumeFileName(candidate.name, candidate.position, candidate.matchScore, fileExt));
  }

  const knownNames = [
    candidate?.resumeFileName,
    candidate?.resumeOriginalName,
    candidate?.resumeFilePath ? path.basename(candidate.resumeFilePath) : ''
  ].filter(Boolean);

  knownNames.forEach(name => names.add(path.basename(name)));

  return Array.from(names).filter(Boolean);
}

function collectResumeCandidateExtensions(candidate) {
  const extensions = new Set();
  const knownPaths = [
    candidate?.resumeFilePath,
    candidate?.resumeFileName,
    candidate?.resumeOriginalName
  ].filter(Boolean);

  knownPaths.forEach(value => {
    const ext = path.extname(String(value)).toLowerCase();
    if (ext) {
      extensions.add(ext);
    }
  });

  return Array.from(extensions);
}

async function findCandidateResumeFile(candidate) {
  try {
    if (!fsSync.existsSync(RESUME_UPLOAD_DIR)) {
      return null;
    }

    const files = await fs.readdir(RESUME_UPLOAD_DIR);
    if (!files.length) {
      return null;
    }

    const exactCandidates = collectResumeCandidateFileNames(candidate);
    for (const expectedName of exactCandidates) {
      const matched = files.find(file => file.toLowerCase() === expectedName.toLowerCase());
      if (matched) {
        return path.join(RESUME_UPLOAD_DIR, matched);
      }
    }

    const safeName = sanitizeFileNamePart(candidate?.name, '');
    const safePosition = sanitizeFileNamePart(candidate?.position, '');
    if (safeName && safePosition) {
      const prefixMatch = files.find(file => {
        const lowerFile = file.toLowerCase();
        return lowerFile.includes(safeName.toLowerCase()) && lowerFile.includes(safePosition.toLowerCase());
      });

      if (prefixMatch) {
        return path.join(RESUME_UPLOAD_DIR, prefixMatch);
      }
    }

    const expectedExtensions = collectResumeCandidateExtensions(candidate);
    const candidateSize = String(candidate?.resumeSize || '').trim();
    const candidateHash = String(candidate?.resumeFileHash || '').trim().toLowerCase();
    const sizeMatchedFiles = [];

    if (candidateSize) {
      for (const file of files) {
        const filePath = path.join(RESUME_UPLOAD_DIR, file);
        const fileExt = path.extname(file).toLowerCase();
        if (expectedExtensions.length > 0 && !expectedExtensions.includes(fileExt)) {
          continue;
        }

        try {
          const stats = await fs.stat(filePath);
          if (stats.isFile() && String(stats.size) === candidateSize) {
            sizeMatchedFiles.push(filePath);
          }
        } catch (error) {
          console.warn('按文件大小查找简历时跳过文件:', file, error.message);
        }
      }
    }

    if (candidateHash && sizeMatchedFiles.length > 0) {
      for (const filePath of sizeMatchedFiles) {
        try {
          const hash = await calculateFileHash(filePath);
          if (hash.toLowerCase() === candidateHash) {
            return filePath;
          }
        } catch (error) {
          console.warn('按文件指纹查找简历失败:', path.basename(filePath), error.message);
        }
      }
    }

    if (!candidateHash && sizeMatchedFiles.length === 1) {
      return sizeMatchedFiles[0];
    }

    return null;
  } catch (error) {
    console.error('查找候选人简历文件失败:', error.message);
    return null;
  }
}

async function ensureUniqueResumeTargetPath(targetPath) {
  if (!fsSync.existsSync(targetPath)) {
    return targetPath;
  }

  const ext = path.extname(targetPath);
  const baseName = path.basename(targetPath, ext);
  const dirName = path.dirname(targetPath);
  const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 1e6)}`;
  return path.join(dirName, `${baseName}_${uniqueSuffix}${ext}`);
}

async function calculateFileHash(filePath) {
  const fileBuffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

async function areFilesEquivalent(filePathA, filePathB) {
  try {
    const [statsA, statsB] = await Promise.all([fs.stat(filePathA), fs.stat(filePathB)]);
    if (statsA.size !== statsB.size) {
      return false;
    }

    const [hashA, hashB] = await Promise.all([
      calculateFileHash(filePathA),
      calculateFileHash(filePathB)
    ]);

    return hashA === hashB;
  } catch (error) {
    console.error('比较文件是否一致失败:', error.message);
    return false;
  }
}

async function reconcileCandidateResumeFile(candidate, options = {}) {
  if (!candidate) {
    return false;
  }

  const { normalizeName = false } = options;
  let changed = false;
  let resolvedPath = candidate.resumeFilePath || null;

  if (resolvedPath) {
    try {
      await fs.access(resolvedPath);
    } catch (error) {
      resolvedPath = null;
    }
  }

  if (!resolvedPath) {
    resolvedPath = await findCandidateResumeFile(candidate);
  }

  if (!resolvedPath) {
    return false;
  }

  const ext = path.extname(resolvedPath).toLowerCase();
  if (!ext) {
    return false;
  }

  const canonicalName = buildCanonicalResumeFileName(candidate, ext);
  let canonicalPath = path.join(RESUME_UPLOAD_DIR, canonicalName);
  const resolvedBaseName = path.basename(resolvedPath);

  if (normalizeName && resolvedBaseName !== canonicalName) {
    try {
      if (fsSync.existsSync(canonicalPath)) {
        const sameFile = await areFilesEquivalent(resolvedPath, canonicalPath);
        if (sameFile) {
          await fs.unlink(resolvedPath);
          resolvedPath = canonicalPath;
          console.log('检测到重复简历文件，已合并到规范命名文件:', canonicalName);
          changed = true;
        } else {
          canonicalPath = await ensureUniqueResumeTargetPath(canonicalPath);
          await fs.rename(resolvedPath, canonicalPath);
          resolvedPath = canonicalPath;
          console.log('检测到旧简历文件名，已自动规范命名:', path.basename(resolvedPath));
          changed = true;
        }
      } else {
        await fs.rename(resolvedPath, canonicalPath);
        resolvedPath = canonicalPath;
        console.log('检测到旧简历文件名，已自动规范命名:', path.basename(resolvedPath));
        changed = true;
      }
    } catch (error) {
      console.error('自动规范简历文件名失败:', error.message);
    }
  }

  try {
    const stats = await fs.stat(resolvedPath);
    if (candidate.resumeFilePath !== resolvedPath) {
      candidate.resumeFilePath = resolvedPath;
      changed = true;
    }

    const resolvedName = path.basename(resolvedPath);
    if (candidate.resumeFileName !== resolvedName) {
      candidate.resumeFileName = resolvedName;
      changed = true;
    }

    const normalizedSize = String(stats.size);
    if (String(candidate.resumeSize || '') !== normalizedSize) {
      candidate.resumeSize = normalizedSize;
      changed = true;
    }

    const resolvedHash = await calculateFileHash(resolvedPath);
    if (String(candidate.resumeFileHash || '').toLowerCase() !== resolvedHash.toLowerCase()) {
      candidate.resumeFileHash = resolvedHash;
      changed = true;
    }
  } catch (error) {
    console.error('同步简历文件信息失败:', error.message);
  }

  return changed;
}

async function reconcileCandidatesResumeFiles(candidates, options = {}) {
  let changed = false;

  for (const candidate of candidates) {
    const candidateChanged = await reconcileCandidateResumeFile(candidate, options);
    changed = changed || candidateChanged;
  }

  return changed;
}

async function renameResumeFileIfNeeded(candidate, score) {
  if (!candidate?.resumeFilePath) {
    return candidate;
  }

  const currentExt = path.extname(candidate.resumeFilePath).toLowerCase();
  if (!currentExt) {
    return candidate;
  }

  const targetFileName = buildAnalyzedResumeFileName(candidate.name, candidate.position, score, currentExt);
  const targetFilePath = path.join(path.dirname(candidate.resumeFilePath), targetFileName);

  if (candidate.resumeFilePath === targetFilePath) {
    candidate.resumeFileName = targetFileName;
    return candidate;
  }

  try {
    await fs.access(candidate.resumeFilePath);
    const uniqueTargetPath = await ensureUniqueResumeTargetPath(targetFilePath);
    await fs.rename(candidate.resumeFilePath, uniqueTargetPath);
    candidate.resumeFilePath = uniqueTargetPath;
    candidate.resumeFileName = path.basename(uniqueTargetPath);
    console.log('简历文件已重命名:', targetFileName);
  } catch (error) {
    console.error('简历文件重命名失败:', error.message);
  }

  return candidate;
}

async function inspectCandidateFileIntegrity(candidate) {
  const reasons = [];

  await reconcileCandidateResumeFile(candidate, { normalizeName: false });

  if (!candidate?.resumeFilePath) {
    reasons.push('未上传简历文件');
    return reasons;
  }

  try {
    await fs.access(candidate.resumeFilePath);
  } catch (error) {
    reasons.push('简历文件已丢失');
    return reasons;
  }

  try {
    const stats = await fs.stat(candidate.resumeFilePath);
    if (!stats.isFile()) {
      reasons.push('简历路径不是有效文件');
      return reasons;
    }
    if (stats.size <= 0) {
      reasons.push('简历文件为空');
      return reasons;
    }
  } catch (error) {
    reasons.push('无法读取简历文件');
    return reasons;
  }

  if (!candidate.resumeFileName) {
    reasons.push('缺少简历文件名');
  }

  return reasons;
}

async function getInvalidCandidates(candidates) {
  const invalidCandidates = [];

  for (const candidate of candidates) {
    const reasons = await inspectCandidateFileIntegrity(candidate);
    if (reasons.length > 0) {
      invalidCandidates.push({
        id: candidate.id,
        name: candidate.name,
        position: candidate.position,
        resumeFileName: candidate.resumeFileName || candidate.resumeOriginalName || '未命名',
        reasons
      });
    }
  }

  return invalidCandidates;
}

async function removeCandidateResumeFile(candidate) {
  if (!candidate?.resumeFilePath) {
    return;
  }

  try {
    await fs.access(candidate.resumeFilePath);
    await fs.unlink(candidate.resumeFilePath);
    console.log('已删除无效候选人的简历文件:', candidate.resumeFilePath);
  } catch (error) {
    console.log('跳过删除简历文件:', candidate.resumeFilePath, error.message);
  }
}

function getJimpReader() {
  return Jimp?.read || Jimp?.Jimp?.read;
}

function getImageMimeType(ext) {
  if (ext === '.png') {
    return Jimp?.MIME_PNG || Jimp?.JimpMime?.png || 'image/png';
  }
  return Jimp?.MIME_JPEG || Jimp?.JimpMime?.jpeg || 'image/jpeg';
}

function getJimpBufferAsync(image, mimeType, options) {
  if (typeof image.getBufferAsync === 'function') {
    return image.getBufferAsync(mimeType, options);
  }
  if (typeof image.getBuffer === 'function') {
    if (image.getBuffer.length <= 2) {
      return image.getBuffer(mimeType, options);
    }
    return new Promise((resolve, reject) => {
      image.getBuffer(mimeType, options, (error, buffer) => {
        if (error) { reject(error); return; }
        resolve(buffer);
      });
    });
  }
  throw new Error('Jimp导出Buffer方法不可用');
}

async function compressImageBufferIfNeeded(buffer, fileExt) {
  if (!buffer || !['.jpg', '.jpeg', '.png'].includes(fileExt)) {
    return { buffer, compressed: false };
  }
  const readImage = getJimpReader();
  if (!readImage) {
    return { buffer, compressed: false };
  }
  try {
    const image = await readImage.call(Jimp?.Jimp || Jimp, buffer);
    const maxEdge = 1280;
    const width = image.bitmap?.width || 0;
    const height = image.bitmap?.height || 0;
    if (width > maxEdge || height > maxEdge) {
      image.scaleToFit({ w: maxEdge, h: maxEdge });
    }
    if (typeof image.greyscale === 'function') image.greyscale();
    else if (typeof image.grayscale === 'function') image.grayscale();
    if (typeof image.normalize === 'function') image.normalize();
    if (typeof image.contrast === 'function') image.contrast(0.12);
    const compressedBuffer = await getJimpBufferAsync(image, 'image/jpeg', { quality: 55 });
    if (compressedBuffer?.length) {
      return { buffer: compressedBuffer, compressed: compressedBuffer.length < buffer.length };
    }
    return { buffer, compressed: false };
  } catch (error) {
    return { buffer, compressed: false };
  }
}

async function optimizeResumeFileOnDisk(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
    return { changed: false, skipped: true, reason: `当前未接入 ${ext || '未知格式'} 压缩器` };
  }
  const originalBuffer = await fs.readFile(filePath);
  const optimized = await compressImageBufferIfNeeded(originalBuffer, ext);
  if (!optimized.compressed || !optimized.buffer || optimized.buffer.length >= originalBuffer.length) {
    return { changed: false, skipped: true, reason: '压缩后未变小' };
  }
  await fs.writeFile(filePath, optimized.buffer);
  return { changed: true, beforeSize: originalBuffer.length, afterSize: optimized.buffer.length };
}

async function optimizeExistingResumeFiles() {
  try {
    if (!fsSync.existsSync(RESUME_UPLOAD_DIR)) return;
    const files = await fs.readdir(RESUME_UPLOAD_DIR);
    let optimizedCount = 0, skippedCount = 0;
    for (const fileName of files) {
      const filePath = path.join(RESUME_UPLOAD_DIR, fileName);
      try {
        const result = await optimizeResumeFileOnDisk(filePath);
        if (result.changed) { optimizedCount += 1; }
        else { skippedCount += 1; }
      } catch (error) {
        console.warn(`压缩简历文件失败: ${fileName}`, error.message);
      }
    }
    console.log(`历史简历批量压缩处理完成: 优化 ${optimizedCount} 个，跳过 ${skippedCount} 个`);
  } catch (error) {
    console.error('历史简历批量压缩处理失败:', error);
  }
}

// scheduleResumeAnalysis 已移至 server/services/resumeAnalysis.js

// 验证码存储（优先使用 Redis，多实例下可共享）
const verificationCodes = createVerificationCodeStore();

// 验证Token中间件（提取到此处供authRoutes使用）
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log('[Auth] Authorization header:', authHeader ? `${authHeader.substring(0, 20)}...` : 'missing');

  const token = authHeader?.split(' ')[1];
  if (!token) {
    console.log('[Auth] No token provided');
    return res.status(401).json({ message: '未提供认证令牌' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('[Auth] Token decoded successfully, user:', decoded.id, 'type:', decoded.userType);
    req.user = decoded;
    next();
  } catch (error) {
    console.log('[Auth] Token verification failed:', error.message);
    return res.status(401).json({ message: '无效的认证令牌' });
  }
};

// 挂载企业认证路由
const createCorpAuthRouter = require('./server/routes/corpAuthRoutes');
const corpAuthRouter = createCorpAuthRouter({
  pool,
  bcrypt,
  jwt,
  JWT_SECRET,
  verificationCodes,
  emailTransporter,
  EMAIL_VERIFICATION_MODE: process.env.EMAIL_VERIFICATION_MODE,
  authMiddleware,
  ensureCandidateDatabase,
  emailFromName: process.env.EMAIL_FROM_NAME,
  emailFromAddress: process.env.EMAIL_FROM_ADDRESS
});
app.use('/api/corp', corpAuthRouter);

// 挂载个人认证路由
const createPersonalAuthRouter = require('./server/routes/personalAuthRoutes');
const personalAuthRouter = createPersonalAuthRouter({
  pool,
  bcrypt,
  jwt,
  JWT_SECRET,
  verificationCodes,
  emailTransporter,
  EMAIL_VERIFICATION_MODE: process.env.EMAIL_VERIFICATION_MODE,
  authMiddleware,
  initPersonalUserDB,
  emailFromName: process.env.EMAIL_FROM_NAME,
  emailFromAddress: process.env.EMAIL_FROM_ADDRESS
});
app.use('/api/personal', personalAuthRouter);

// 挂载通用认证路由（check-duplicate 等）
const { createAuthRouter } = require('./routes/authRoutes');
const authRouter = createAuthRouter({
  pool,
  bcrypt,
  jwt,
  JWT_SECRET,
  verificationCodes,
  emailTransporter,
  EMAIL_VERIFICATION_MODE: process.env.EMAIL_VERIFICATION_MODE,
  authMiddleware,
  createPublicSubmissionToken: (user) => jwt.sign({ id: user.id, type: 'public_submission' }, JWT_SECRET, { expiresIn: '7d' }),
  ensureCandidateDatabase,
  emailFromName: process.env.EMAIL_FROM_NAME,
  emailFromAddress: process.env.EMAIL_FROM_ADDRESS
});
app.use('/api', authRouter);

// 挂载个人简历路由
const createPersonalResumeRouter = require('./server/routes/personalResumeRoutes');
const personalResumeRouter = createPersonalResumeRouter({ authMiddleware, upload });
app.use('/api/personal/resume', personalResumeRouter);

// 挂载个人面试路由
const createPersonalInterviewRouter = require('./routes/personalInterview.routes');
const personalInterviewRouter = createPersonalInterviewRouter({ authMiddleware });
app.use('/api/personal/interview', personalInterviewRouter);

// 岗位路由
app.use('/api', require('./routes/position.routes'));

// 挂载候选人路由
const { createCandidateRouter } = require('./routes/candidateRoutes');
const { createCandidateSubmission } = require('./server/utils/candidateSubmission');

const candidateRouter = createCandidateRouter({
  authMiddleware,
  publicSubmissionMiddleware: (req, res, next) => next(),
  upload,
  createCandidateSubmission: ({ body, file, owner }) =>
    createCandidateSubmission({ body, file, owner, deps: { ensureDataFile, DATA_FILE } }),
  saveCandidateInterviewResult: async ({ user, payload }) => {
    const { candidateId, interviewScore, interviewDetails, interviewDate, interviewRecord, candidateSnapshot } = payload;

    const candidate = await getCandidateByIdGlobal(candidateId, { includeBlob: false });
    if (!candidate) {
      const error = new Error('候选人不存在，无法回写面试分。请确认是从候选人列表中选择后开始的面试。');
      error.statusCode = 404;
      throw error;
    }

    const updateData = {
      interviewScore,
      interviewDetails,
      interviewDate,
      hasInterview: true
    };

    if (interviewRecord) {
      // Atomic append to avoid stale-read race condition under concurrent submissions
      updateData._appendInterviewRecord = interviewRecord;
    }

    const resumeScore = candidate.matchScore || 0;
    const mbtiScore = candidate.mbtiScore || 0;
    const finalScore = Math.round((resumeScore * 0.4) + (mbtiScore * 0.1) + (interviewScore * 0.5));
    updateData.finalScore = finalScore;

    const updatedCandidate = await updateCandidateById(candidateId, updateData);
    if (!updatedCandidate) {
      throw new Error('更新候选人数据失败');
    }

    return {
      candidateId,
      interviewScore,
      resumeScore,
      mbtiScore,
      finalScore,
      interviewRecordsCount: updatedCandidate.interviewRecords?.length || 0
    };
  },
  listCandidatesForUser,
  deleteCandidateById,
  clearCandidatesForUser,
  getCandidateByIdGlobal,
  ensureDataFile,
  getInvalidCandidates,
  removeCandidateResumeFile,
  DATA_FILE
});
app.use('/api', candidateRouter);

// 请求日志中间件
app.use((req, res, next) => {
  if (req.url.includes('resume-file')) {
    console.log('[Server] 收到 resume-file 请求:', req.method, req.url);
    console.log('[Server] Query:', req.query);
  }
  next();
});

// 挂载简历路由
const { createResumeRouter } = require('./routes/resume.routes');
app.use('/api', createResumeRouter({ ensureDataFile, scheduleResumeAnalysis }));

// 挂载聊天路由
const { createChatRouter } = require('./routes/chat.routes');
app.use('/api', createChatRouter({ authMiddleware }));

// 挂载面试会话路由
const { createInterviewSessionRouter } = require('./routes/interviewSessionRoutes');
app.use('/api', createInterviewSessionRouter({
  authMiddleware,
  getCurrentInterviewSessionForUser,
  listInterviewSessionsForUser,
  createInterviewSessionForUser,
  upsertInterviewSessionForUser,
  deleteInterviewSessionById,
  deleteTemporaryInterviewSessionsForUser
}));

// 讯飞路由已移除
// app.use('/api', require('./routes/xunfei.routes'));

// AI面试评分端点
const interviewAnalysisService = require('./server/services/interviewAnalysisService');

app.post('/api/interview/analyze', authMiddleware, async (req, res) => {
  try {
    const result = await interviewAnalysisService.evaluateInterview(req.body);
    res.json(result);
  } catch (e) {
    console.error('AI评分失败:', e);
    res.status(e.code === 'AI_OVERLOADED' ? 503 : 500).json({ error: e.message });
  }
});

// 测试数据库连接，失败则拒绝启动
testConnection().then(ok => {
  if (!ok) {
    console.error('❌ 数据库连接失败，服务器拒绝启动，请检查数据库配置');
    process.exit(1);
  }

  // 验证邮件配置
  verifyEmailConfig();

  // 启动后异步批量优化历史上传的简历文件
  setImmediate(() => {
    optimizeExistingResumeFiles().catch(error => {
      console.error('启动时历史简历压缩任务失败:', error);
    });
  });

  app.listen(PORT, () => {
    console.log(`数据服务器运行在 http://localhost:${PORT}`);
  });
});
