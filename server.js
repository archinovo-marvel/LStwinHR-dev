const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { execFile } = require('child_process');
const { promisify } = require('util');
let Jimp;
try {
  Jimp = require('jimp');
} catch (error) {
  console.warn('⚠️ Jimp未成功加载，图片压缩功能将降级:', error.message);
}
const { pool, testConnection, dbConfig } = require('./db');
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
const storage = multer.memoryStorage();
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

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: function (req, file, cb) {
    console.log('=== multer fileFilter 被调用 ===');
    console.log('multer fileFilter - 文件信息:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });
    
    const allowedTypes = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      console.log('文件类型验证通过:', ext);
      cb(null, true);
    } else {
      console.log('文件类型验证失败:', ext);
      cb(new Error('只支持PDF、Word、JPG格式文件'));
    }
  }
});

// 中间件
app.use(cors());
app.use('/uploads', express.static('uploads'));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// JWT密钥
const JWT_SECRET = process.env.JWT_SECRET;

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
    rejectUnauthorized: false
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

async function analyzeResumeWithTimeout(fileBuffer, fileExt, position, timeoutMs = RESUME_ANALYSIS_TIMEOUT_MS) {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      const timeoutError = new Error(`简历分析超时(${timeoutMs}ms)`);
      timeoutError.code = 'RESUME_ANALYSIS_TIMEOUT';
      reject(timeoutError);
    }, timeoutMs);
  });

  return Promise.race([
    resumeAnalysisService.analyze(fileBuffer, fileExt, position),
    timeoutPromise
  ]);
}

async function analyzeResumeWithLocalVLTimeout(fileBuffer, fileExt, position, options = {}, timeoutMs = LOCAL_VL_ANALYSIS_TIMEOUT_MS) {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      const timeoutError = new Error(`本地VL分析超时(${timeoutMs}ms)`);
      timeoutError.code = 'LOCAL_VL_ANALYSIS_TIMEOUT';
      reject(timeoutError);
    }, timeoutMs);
  });

  return Promise.race([
    resumeAnalysisService.analyzeWithLocalVL(fileBuffer, fileExt, position, {
      ...options,
      timeoutMs
    }),
    timeoutPromise
  ]);
}

async function analyzeResumeWithDeepSeekTimeout(fileBuffer, fileExt, position, options = {}, timeoutMs = DEEPSEEK_FALLBACK_ANALYSIS_TIMEOUT_MS) {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      const timeoutError = new Error(`DeepSeek分析超时(${timeoutMs}ms)`);
      timeoutError.code = 'DEEPSEEK_ANALYSIS_TIMEOUT';
      reject(timeoutError);
    }, timeoutMs);
  });

  return Promise.race([
    resumeAnalysisService.analyzeWithDeepSeek(fileBuffer, fileExt, position, options),
    timeoutPromise
  ]);
}

async function analyzeResumeTextWithDeepSeekTimeout(text, position, options = {}, timeoutMs = DEEPSEEK_FALLBACK_ANALYSIS_TIMEOUT_MS) {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      const timeoutError = new Error(`DeepSeek文本分析超时(${timeoutMs}ms)`);
      timeoutError.code = 'DEEPSEEK_ANALYSIS_TIMEOUT';
      reject(timeoutError);
    }, timeoutMs);
  });

  return Promise.race([
    resumeAnalysisService.analyzeText(text, position, options),
    timeoutPromise
  ]);
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
        if (error) {
          reject(error);
          return;
        }
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

    console.log(`图片压缩前尺寸: ${width}x${height}, 大小: ${buffer.length} bytes`);

    if (width > maxEdge || height > maxEdge) {
      image.scaleToFit({ w: maxEdge, h: maxEdge });
    }

    // 恢复到最早的OCR预处理策略：灰度化 + 轻度增强 + 强制较高压缩比
    if (typeof image.greyscale === 'function') {
      image.greyscale();
    } else if (typeof image.grayscale === 'function') {
      image.grayscale();
    }
    if (typeof image.normalize === 'function') {
      image.normalize();
    }
    if (typeof image.contrast === 'function') {
      image.contrast(0.12);
    }

    const outputMimeType = 'image/jpeg';
    const compressedBuffer = await getJimpBufferAsync(image, outputMimeType, { quality: 55 });

    if (compressedBuffer?.length) {
      console.log(`图片压缩完成: ${buffer.length} -> ${compressedBuffer.length} bytes (quality=55)`);
      return { buffer: compressedBuffer, compressed: compressedBuffer.length < buffer.length };
    }

    console.log(`图片压缩失败后回退原图: ${buffer.length} bytes`);
    return { buffer, compressed: false };
  } catch (error) {
    console.warn('图片压缩失败，继续使用原图:', error.message);
    return { buffer, compressed: false };
  }
}

async function optimizeResumeFileOnDisk(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const supportedImageExtensions = ['.jpg', '.jpeg', '.png'];

  if (!supportedImageExtensions.includes(ext)) {
    return {
      changed: false,
      skipped: true,
      reason: `当前未接入 ${ext || '未知格式'} 压缩器`
    };
  }

  const originalBuffer = await fs.readFile(filePath);
  const optimized = await compressImageBufferIfNeeded(originalBuffer, ext);

  if (!optimized.compressed || !optimized.buffer || optimized.buffer.length >= originalBuffer.length) {
    return {
      changed: false,
      skipped: true,
      reason: '压缩后未变小'
    };
  }

  await fs.writeFile(filePath, optimized.buffer);
  return {
    changed: true,
    beforeSize: originalBuffer.length,
    afterSize: optimized.buffer.length
  };
}

async function optimizeExistingResumeFiles() {
  try {
    if (!fsSync.existsSync(RESUME_UPLOAD_DIR)) {
      return;
    }

    const files = await fs.readdir(RESUME_UPLOAD_DIR);
    let optimizedCount = 0;
    let skippedCount = 0;

    for (const fileName of files) {
      const filePath = path.join(RESUME_UPLOAD_DIR, fileName);
      try {
        const result = await optimizeResumeFileOnDisk(filePath);

        if (result.changed) {
          optimizedCount += 1;
          console.log(`历史简历压缩完成: ${fileName} (${result.beforeSize} -> ${result.afterSize} bytes)`);
        } else {
          skippedCount += 1;
        }
      } catch (error) {
        console.warn(`压缩简历文件失败: ${fileName}`, error.message);
      }
    }

    console.log(`历史简历批量压缩处理完成: 优化 ${optimizedCount} 个，跳过 ${skippedCount} 个`);
  } catch (error) {
    console.error('历史简历批量压缩处理失败:', error);
  }
}

function createPendingResumeAnalysis(summary = '简历分析已加入后台队列，请稍候查看结果') {
  return {
    parseStatus: 'PENDING',
    summary,
    totalScore: 0,
    dimensionScores: {},
    strengths: [],
    risks: [],
    suggestions: ['后台正在分析简历，请稍候在候选管理中查看结果'],
    extractedContent: {},
    evidences: []
  };
}

function calculateCandidateScores(candidate, resumeAnalysis) {
  let finalMatchScore = 0;
  let mbtiScore = 0;
  let resumeScore = 0;

  if (candidate?.mbti) {
    const mbtiScores = {
      'ENTJ': 90, 'INTJ': 88, 'ENTP': 85, 'INTP': 82,
      'ENFJ': 85, 'INFJ': 88, 'ENFP': 80, 'INFP': 78,
      'ESTJ': 88, 'ISTJ': 85, 'ESTP': 82, 'ISTP': 80,
      'ESFJ': 85, 'ISFJ': 82, 'ESFP': 78, 'ISFP': 75
    };
    mbtiScore = mbtiScores[candidate.mbti] || 75;
  }

  const isSuccess = resumeAnalysis?.parseStatus === 'SUCCESS' || resumeAnalysis?.parseStatus === 'PARTIAL_SUCCESS';

  // 简历评分统一使用细则评分之和
  if (resumeAnalysis && isSuccess) {
    const scores = resumeAnalysis.scores || {};
    resumeScore = scores.resumeScore ||
      (Number(scores.educationScore) || 0) +
      (Number(scores.workScore) || 0) +
      (Number(scores.projectScore) || 0) +
      (Number(scores.skillScore) || 0) +
      (Number(scores.expressionScore) || 0);
  }

  if (candidate?.mbti && isSuccess) {
    finalMatchScore = Math.round((mbtiScore * 0.5) + (resumeScore * 0.5));
  } else if (candidate?.mbti) {
    finalMatchScore = mbtiScore;
  } else if (isSuccess) {
    finalMatchScore = resumeScore;
  } else {
    finalMatchScore = 60;
  }

  return {
    finalMatchScore,
    mbtiScore,
    resumeScore
  };
}

function getResumeAnalysisTimeoutMs(fileExt) {
  if (['.jpg', '.jpeg', '.png'].includes(String(fileExt).toLowerCase())) {
    return IMAGE_RESUME_ANALYSIS_TIMEOUT_MS;
  }
  return RESUME_ANALYSIS_TIMEOUT_MS;
}

function getLocalVlAnalysisTimeoutMs(candidate, fileExt, options = {}) {
  const ext = String(fileExt || '').toLowerCase();
  if (ext === '.pdf' && (candidate?.name === '陈龙' || String(candidate?.resumeFileName || '').includes('陈龙'))) {
    return SCANNED_PDF_LOCAL_VL_ANALYSIS_TIMEOUT_MS;
  }
  return Number(options.localVlTimeoutMs || LOCAL_VL_ANALYSIS_TIMEOUT_MS);
}

function getDeepSeekFallbackTimeoutMs(fileExt, options = {}) {
  const ext = String(fileExt || '').toLowerCase();
  const baselineTimeout = ['.jpg', '.jpeg', '.png'].includes(ext)
    ? IMAGE_RESUME_ANALYSIS_TIMEOUT_MS
    : RESUME_ANALYSIS_TIMEOUT_MS;
  return Number(options.deepseekTimeoutMs || Math.max(DEEPSEEK_FALLBACK_ANALYSIS_TIMEOUT_MS, baselineTimeout));
}

async function runResumeAnalysisInBackground(candidateId, options = {}) {
  if (activeResumeAnalysisJobs.has(candidateId)) {
    return activeResumeAnalysisJobs.get(candidateId);
  }

  const { renameAfterAnalysis = false, forceReanalyze = false, trigger = 'auto' } = options;

  if (trigger === 'auto' && manualResumeAnalysisJobs.size > 0) {
    console.log(`[自动分析] 检测到手动分析任务进行中，跳过自动派发 candidateId=${candidateId}`);
    return;
  }

  if (trigger === 'manual') {
    manualResumeAnalysisJobs.add(candidateId);
  }
  const job = (async () => {
    try {
      console.log(`[后台分析] 开始获取候选人数据, candidateId=${candidateId}`);
      
      // 从数据库获取候选人数据（通过全局ID查询）
      const candidate = await getCandidateByIdGlobal(candidateId, { includeBlob: true });

      if (!candidate) {
        console.log(`后台简历分析: 未找到候选人(candidateId=${candidateId})`);
        return;
      }

      console.log(`[后台分析] 候选人数据获取成功:`, {
        id: candidate.id,
        name: candidate.name,
        position: candidate.position,
        hasResumeFileBuffer: !!candidate.resumeFileBuffer,
        resumeFileBufferSize: candidate.resumeFileBuffer ? candidate.resumeFileBuffer.length : 0,
        resumeFileName: candidate.resumeFileName,
        resumeFilePath: candidate.resumeFilePath
      });
      if (!candidate.resumeFilePath && !candidate.resumeFileBuffer) {
        console.log(`[后台分析] 候选人没有简历文件`);
        await updateCandidateById(candidateId, {
          status: '待分析',
          recommendation: '未找到简历文件，无法分析'
        });
        return;
      }

      let fileBuffer;
      let fileExt;

      // 优先使用内存中的文件
      if (candidate.resumeFileBuffer) {
        fileBuffer = candidate.resumeFileBuffer;
        fileExt = candidate.resumeFileName ? path.extname(candidate.resumeFileName).toLowerCase() : '.pdf';
      } else if (candidate.resumeFilePath) {
        try {
          await fs.access(candidate.resumeFilePath);
        } catch (error) {
          await updateCandidateById(candidateId, {
            status: '待分析',
            recommendation: '简历文件已丢失，无法分析'
          });
          return;
        }
        fileBuffer = await fs.readFile(candidate.resumeFilePath);
        fileExt = path.extname(candidate.resumeFilePath).toLowerCase();
      } else {
        await updateCandidateById(candidateId, {
          status: '待分析',
          recommendation: '未找到简历文件，无法分析'
        });
        return;
      }

      const localVlTimeoutMs = getLocalVlAnalysisTimeoutMs(candidate, fileExt, options);
      const timeoutMs = Math.max(getResumeAnalysisTimeoutMs(fileExt), localVlTimeoutMs);
      const deepseekTimeoutMs = getDeepSeekFallbackTimeoutMs(fileExt, options);
      let resumeAnalysis;
      let usedLocalVL = false;
      let localVLTimedOut = false;
      let cachedExtractedText = '';
      let cachedExtractedMeta = null;
      const updateAnalysisStage = async (status, recommendation) => {
        await updateCandidateById(candidateId, {
          status,
          recommendation: recommendation || status
        });
      };
      const updateCachedExtractedText = async (text, meta = {}) => {
        const normalizedText = String(text || '').trim();
        if (!normalizedText) {
          return;
        }
        if (normalizedText.length >= String(cachedExtractedText || '').trim().length) {
          cachedExtractedText = normalizedText;
          cachedExtractedMeta = meta;
          console.log(`[简历分析] 已缓存OCR文本，长度: ${normalizedText.length}，来源: ${meta.source || 'unknown'}`);
        }
      };

      // 检查本地VL模型是否启用
      const localVLEnabled = process.env.LOCAL_LLM_ENABLED === 'true';
      
      if (localVLEnabled) {
        // 本地VL模型已启用，尝试使用
        console.log(`[简历分析] 本地VL模型已启用，开始分析...`);
        await updateAnalysisStage('VL分析准备中', '正在准备本地VL分析任务');
        try {
          resumeAnalysis = await analyzeResumeWithLocalVLTimeout(
            fileBuffer,
            fileExt,
            candidate.position,
            {
              originalName: candidate.resumeFileName,
              onProgress: updateAnalysisStage,
              onExtractedText: updateCachedExtractedText
            },
            localVlTimeoutMs
          );
          
          // 检查分析是否成功
          if (resumeAnalysis.parseStatus === 'SUCCESS' || resumeAnalysis.parseStatus === 'PARTIAL_SUCCESS') {
            usedLocalVL = true;
            console.log(`[简历分析] 本地VL模型分析完成，状态: ${resumeAnalysis.parseStatus}`);
          } else {
            // VL分析失败，降级到DeepSeek
            console.log(`[简历分析] 本地VL模型分析未成功(${resumeAnalysis.parseStatus})，降级到DeepSeek...`);
            throw new Error(resumeAnalysis.error || 'VL分析失败');
          }
        } catch (vlError) {
          console.error(`[简历分析] 本地VL模型分析失败:`, vlError.message);
          if (vlError.code === 'LOCAL_VL_ANALYSIS_TIMEOUT') {
            localVLTimedOut = true;
            console.error(`[简历分析] 本地VL模型在 ${localVlTimeoutMs}ms 内未完成，标记为超时`);
            await updateAnalysisStage('VL分析超时', `本地VL分析超时，已达到 ${Math.round(localVlTimeoutMs / 1000)}s 上限`);
          }
          // 本地VL失败时，尝试DeepSeek作为备用
          console.log(`[简历分析] 尝试使用DeepSeek作为备用...`);
          await updateAnalysisStage(
            'DeepSeek分析中',
            cachedExtractedText
              ? '本地VL未完成，正在复用OCR文本切换到DeepSeek分析'
              : '本地VL OCR未成功，正在切换到DeepSeek备用分析'
          );
          try {
            if (cachedExtractedText) {
              resumeAnalysis = await analyzeResumeTextWithDeepSeekTimeout(
                cachedExtractedText,
                candidate.position,
                {
                  originalName: candidate.resumeFileName,
                  parserStatus: cachedExtractedMeta?.parserStatus || '',
                  parserError: cachedExtractedMeta?.parserError || '',
                  parserMetadata: cachedExtractedMeta?.parserMetadata || {},
                  fileType: fileExt
                },
                deepseekTimeoutMs
              );
            } else {
              resumeAnalysis = await analyzeResumeWithDeepSeekTimeout(
                fileBuffer,
                fileExt,
                candidate.position,
                {
                  originalName: candidate.resumeFileName
                },
                deepseekTimeoutMs
              );
            }
            console.log(`[简历分析] DeepSeek分析完成`);
          } catch (dsError) {
            console.error(`[简历分析] DeepSeek也失败:`, dsError.message);
            resumeAnalysis = createFallbackResumeAnalysis(
              `简历分析失败，本地VL和DeepSeek都无法完成分析`,
              '请检查简历文件格式或联系管理员'
            );
          }
        }
      } else {
        // 本地VL模型未启用，直接使用DeepSeek
        console.log(`[简历分析] 本地VL模型未启用，使用DeepSeek进行分析...`);
        try {
          await updateAnalysisStage('DeepSeek分析中', '本地VL未启用，正在使用DeepSeek分析');
          resumeAnalysis = await analyzeResumeWithDeepSeekTimeout(
            fileBuffer,
            fileExt,
            candidate.position,
            {
              originalName: candidate.resumeFileName
            },
            deepseekTimeoutMs
          );
          console.log(`[简历分析] DeepSeek分析完成`);
        } catch (dsError) {
          console.error(`[简历分析] DeepSeek分析失败:`, dsError.message);
          resumeAnalysis = createFallbackResumeAnalysis(
            `简历分析失败: ${dsError.message}`,
            '请检查简历文件格式或联系管理员'
          );
        }
      }

      const { finalMatchScore, mbtiScore, resumeScore } = calculateCandidateScores(candidate, resumeAnalysis);
      const analysisSummary = String(resumeAnalysis.summary || resumeAnalysis.error || '');

      let status = '待分析';
      if (resumeAnalysis.parseStatus === 'SUCCESS' || resumeAnalysis.parseStatus === 'PARTIAL_SUCCESS') {
        status = usedLocalVL ? '已分析(VL)' : '已分析';
      } else if (localVLTimedOut || analysisSummary.includes('超时')) {
        status = 'VL分析超时';
      }
      
      const suggestions = resumeAnalysis.suggestions || [];
      const recommendation = suggestions.length > 0 ? suggestions[0] : '建议进一步评估';

      // 构建前端期望的分析结果格式
      const resumeAnalysisResult = reportService.buildResumeAnalysisResult({
        analysis: resumeAnalysis,
        position: candidate.position,
        positionConfig: null,
        mbtiScore: mbtiScore,
        interviewScore: candidate.interviewScore || null
      });

      // 更新数据库中的候选人数据
      await updateCandidateById(candidateId, {
        resumeAnalysis: resumeAnalysis,
        resumeAnalysisResult: resumeAnalysisResult,
        matchScore: finalMatchScore,
        mbtiScore: mbtiScore,
        resumeScore: resumeScore,
        status: status,
        recommendation: recommendation
      });

      if (renameAfterAnalysis && resumeAnalysis.parseStatus === 'SUCCESS') {
        candidate.matchScore = finalMatchScore;
        await renameResumeFileIfNeeded(candidate, finalMatchScore);
        await reconcileCandidateResumeFile(candidate, { normalizeName: false });
      }

      console.log(`后台简历分析完成(candidateId=${candidateId})，状态: ${status}`);
    } catch (error) {
      console.error(`后台简历分析任务异常(candidateId=${candidateId}):`, error);
      try {
        const isTimeout = error.code === 'LOCAL_VL_ANALYSIS_TIMEOUT' ||
          error.code === 'RESUME_ANALYSIS_TIMEOUT' ||
          String(error.message || '').includes('超时') ||
          String(error.message || '').toLowerCase().includes('timeout');

        await updateCandidateById(candidateId, {
          status: isTimeout ? 'VL分析超时' : '待分析',
          recommendation: isTimeout
            ? `简历分析超时，请稍后重试（VL超时上限 ${Math.round(localVlTimeoutMs / 1000)}s）`
            : '简历分析失败，请稍后重试'
        });
      } catch (updateError) {
        console.error(`后台简历分析异常后更新候选人状态失败(candidateId=${candidateId}):`, updateError);
      }
    } finally {
      if (trigger === 'manual') {
        manualResumeAnalysisJobs.delete(candidateId);
      }
      activeResumeAnalysisJobs.delete(candidateId);
    }
  })();

  activeResumeAnalysisJobs.set(candidateId, job);
  return job;
}

function scheduleResumeAnalysis(candidateId, options = {}) {
  setImmediate(() => {
    runResumeAnalysisInBackground(candidateId, options).catch(error => {
      console.error(`后台简历分析调度失败(candidateId=${candidateId}):`, error);
    });
  });
}

// 简历路由工厂函数
const { createResumeRouter } = require('./routes/resume.routes');

// 挂载简历路由（传递依赖）
app.use('/api', createResumeRouter({ ensureDataFile, scheduleResumeAnalysis }));

// 验证码存储（生产环境应使用Redis）
const verificationCodes = new Map();

// 验证Token中间件（提取到此处供authRoutes使用）
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: '未提供认证令牌' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: '无效的认证令牌' });
  }
};

// 创建并挂载模块化认证路由
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
  createPublicSubmissionToken: () => null,
  ensureCandidateDatabase,
  emailFromName: process.env.EMAIL_FROM_NAME,
  emailFromAddress: process.env.EMAIL_FROM_ADDRESS
});
app.use('/api', authRouter);

// 挂载岗位路由
app.use('/api', require('./routes/position.routes'));

// 挂载候选人路由
const { createCandidateRouter } = require('./routes/candidateRoutes');
const candidateRouter = createCandidateRouter({
  authMiddleware,
  publicSubmissionMiddleware: (req, res, next) => next(),
  upload,
  createCandidateSubmission: async ({ body, file, owner }) => {
    // Factory has closure access to server.js scope helpers
    if (!owner) throw Object.assign(new Error('未授权，请先登录'), { statusCode: 401 });

    await ensureCandidateDatabase(owner.id);
    await ensureDataFile();

    let resumeFilePath = null;
    let resumeFileName = null;

    if (file) {
      try {
        const uploadDir = path.join(__dirname, 'uploads', 'resumes');
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
        await fs.writeFile(resumeFilePath, processedUpload.buffer);
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
        const stats = await fs.stat(newCandidate.resumeFilePath);
        newCandidate.resumeSize = String(stats.size);
        newCandidate.resumeFileHash = await calculateFileHash(newCandidate.resumeFilePath);
      } catch (error) { /* ignore */ }
    }

    if (file) newCandidate.resumeFileBuffer = file.buffer;
    await upsertCandidateForUser(owner.id, newCandidate);
    if (file) scheduleResumeAnalysis(newCandidate.id, { renameAfterAnalysis: true });

    return newCandidate;
  },
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
      const existingRecords = candidate.interviewRecords || [];
      const updatedRecords = [...existingRecords, interviewRecord];
      updateData.interviewRecords = updatedRecords;
      updateData.latestInterviewRecord = interviewRecord;
    }

    const resumeScore = candidate.matchScore || 0;
    const mbtiScore = candidate.mbtiScore || 0;
    const finalScore = Math.round((resumeScore * 0.35) + (mbtiScore * 0.15) + (interviewScore * 0.5));
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
      interviewRecordsCount: updateData.interviewRecords?.length || 0
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

// 挂载聊天路由
const { createChatRouter } = require('./routes/chat.routes');
app.use('/api', createChatRouter());

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

// 挂载讯飞路由
app.use('/api', require('./routes/xunfei.routes'));

// 测试数据库连接
testConnection();

// 验证邮件配置
verifyEmailConfig();

// 启动后异步批量优化历史上传的简历文件
setImmediate(() => {
  optimizeExistingResumeFiles().catch(error => {
    console.error('启动时历史简历压缩任务失败:', error);
  });
});

// 注意：express.json() 中间件会干扰multer的文件上传
// 我们需要在特定路由中处理JSON解析

// 数据文件路径
const DATA_FILE = path.join(__dirname, 'candidate-data.json');

// 确保数据文件存在
async function ensureDataFile() {
  try {
    await fs.access(DATA_FILE);
  } catch (error) {
    // 文件不存在，创建空数组
    await fs.writeFile(DATA_FILE, JSON.stringify([]));
  }
}

// 简历下载端点已移至 routes/candidateRoutes.js
// 聊天路由已移至 routes/chat.routes.js
// 面试分保存已移至 routes/candidateRoutes.js (saveCandidateInterviewResult factory)
// 候选人创建已移至 routes/candidateRoutes.js (createCandidateSubmission factory)
// 预览/清理无效候选人已移至 routes/candidateRoutes.js

// 讯飞路由已移至 routes/xunfei.routes.js
// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`数据服务器运行在 http://localhost:${PORT}`);
});
