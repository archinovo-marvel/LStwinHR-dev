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
  buildResumePointer
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
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_change_this_in_production';

// 邮件配置
const emailTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.exmail.qq.com',
  port: parseInt(process.env.EMAIL_PORT) || 465,
  secure: process.env.EMAIL_SECURE !== 'false',
  auth: {
    user: process.env.EMAIL_USER || 'gaolu@lstwin.top',
    pass: process.env.EMAIL_PASSWORD || 'EpZqKtR6bFjB3g2o'
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
  emailFromName: process.env.EMAIL_FROM_NAME || '孛数AI面试系统',
  emailFromAddress: process.env.EMAIL_FROM_ADDRESS || 'gaolu@lstwin.top'
});
app.use('/api', authRouter);

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

async function resolvePositionAccessContext(req) {
  const bearerToken = req.headers.authorization?.split(' ')[1];
  if (bearerToken) {
    try {
      const decoded = jwt.verify(bearerToken, JWT_SECRET);
      return {
        ownerUserId: decoded.id,
        ownerUserName: decoded.username || decoded.name || decoded.email || '',
        ownerUserEmail: decoded.email || '',
        isAuthenticated: true
      };
    } catch (error) {}
  }
  return null;
}

function serializePosition(position) {
  return {
    id: position.id,
    name: position.name,
    description: position.description || '',
    config: position.config || {},
    createdAt: position.createdAt || null,
    updatedAt: position.updatedAt || null
  };
}

function buildStoredPositionProfile(position) {
  if (!position) return null;
  return { id: position.id ?? null, name: position.name || '', description: position.description || '', config: position.config || {} };
}

app.get('/api/positions', async (req, res) => {
  try {
    const context = await resolvePositionAccessContext(req);
    if (!context?.ownerUserId) return res.status(401).json({ success: false, error: '未授权访问岗位列表' });
    const positions = await listPositionsForUser(context.ownerUserId);
    res.json({ success: true, positions: positions.map(serializePosition) });
  } catch (error) {
    console.error('获取岗位配置失败:', error);
    res.status(500).json({ success: false, error: '获取岗位配置失败', message: error.message });
  }
});

app.post('/api/positions', authMiddleware, async (req, res) => {
  try {
    const position = await upsertPositionForUser(req.user.id, req.body || {});
    res.json({ success: true, position: serializePosition(position) });
  } catch (error) {
    console.error('新增岗位失败:', error);
    res.status(error.message?.includes('已存在') || error.message?.includes('不能为空') ? 400 : 500).json({
      success: false, error: '新增岗位失败', message: error.message
    });
  }
});

app.put('/api/positions/:id', authMiddleware, async (req, res) => {
  try {
    const position = await upsertPositionForUser(req.user.id, { ...(req.body || {}), id: Number(req.params.id) });
    res.json({ success: true, position: serializePosition(position) });
  } catch (error) {
    console.error('更新岗位失败:', error);
    res.status(error.message?.includes('已存在') || error.message?.includes('不能为空') ? 400 : 500).json({
      success: false, error: '更新岗位失败', message: error.message
    });
  }
});

app.delete('/api/positions/:id', authMiddleware, async (req, res) => {
  try {
    const deletedCount = await deletePositionById(req.user.id, Number(req.params.id));
    if (!deletedCount) return res.status(404).json({ success: false, error: '岗位不存在' });
    res.json({ success: true });
  } catch (error) {
    console.error('删除岗位失败:', error);
    res.status(500).json({ success: false, error: '删除岗位失败', message: error.message });
  }
});
app.get('/api/resume-preview/:id', async (req, res) => {
  try {
    const candidateId = parseInt(req.params.id);
    await ensureDataFile();
    const token = req.headers.authorization?.split(' ')[1];
    let owner = null;
    if (token) {
      try { const decoded = jwt.verify(token, JWT_SECRET); owner = { id: decoded.id, username: decoded.username, email: decoded.email }; } catch {}
    }
    if (!owner) return res.status(401).json({ error: '未授权，请先登录' });
    await ensureCandidateDatabase(owner.id);
    const data = await fs.readFile(DATA_FILE, 'utf8');
    const candidates = JSON.parse(data);
    const candidate = candidates.find(c => c.id === candidateId);
    
    if (!candidate) {
      return res.status(404).send('候选人不存在');
    }
    
    // 生成PDF预览页面
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${candidate.name} - 简历预览</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: #f5f5f5;
          }
          .resume-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #1890ff;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .section {
            margin-bottom: 25px;
          }
          .section-title {
            font-size: 18px;
            font-weight: bold;
            color: #1890ff;
            margin-bottom: 15px;
            border-left: 4px solid #1890ff;
            padding-left: 10px;
          }
          .info-row {
            display: flex;
            margin-bottom: 8px;
          }
          .info-label {
            font-weight: bold;
            width: 100px;
            color: #666;
          }
          .skills {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }
          .skill-tag {
            background: #e6f7ff;
            color: #1890ff;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
          }
          .analysis-section {
            background: #f6ffed;
            border: 1px solid #b7eb8f;
            border-radius: 6px;
            padding: 15px;
            margin-top: 20px;
          }
          .highlight {
            color: #52c41a;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="resume-container">
          <div class="header">
            <h1>${candidate.name}</h1>
            <p style="color: #666; margin: 5px 0;">${candidate.position} | ${candidate.mbti || 'MBTI待完成'}</p>
          </div>
          
          <div class="section">
            <div class="section-title">基本信息</div>
            <div class="info-row">
              <span class="info-label">姓名:</span>
              <span>${candidate.name}</span>
            </div>
            <div class="info-row">
              <span class="info-label">应聘职位:</span>
              <span>${candidate.position}</span>
            </div>
            <div class="info-row">
              <span class="info-label">联系电话:</span>
              <span>${candidate.phone}</span>
            </div>
            <div class="info-row">
              <span class="info-label">邮箱地址:</span>
              <span>${candidate.email}</span>
            </div>
            <div class="info-row">
              <span class="info-label">MBTI类型:</span>
              <span>${candidate.mbti || '未完成'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">提交时间:</span>
              <span>${candidate.submitTime}</span>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">简历文件信息</div>
            <div class="info-row">
              <span class="info-label">文件名:</span>
              <span>${candidate.resumeFileName}</span>
            </div>
            <div class="info-row">
              <span class="info-label">文件大小:</span>
              <span>${candidate.resumeSize ? (candidate.resumeSize / 1024).toFixed(1) + ' KB' : '未知'}</span>
            </div>
          </div>
          
          ${candidate.analysisDetails?.resumeAnalysis ? `
          <div class="section">
            <div class="section-title">技能匹配</div>
            <div class="skills">
              ${candidate.analysisDetails.resumeAnalysis.skillMatches.map(match => 
                `<span class="skill-tag">${match.skill} (${match.type === 'core' ? '核心' : '商业'})</span>`
              ).join('')}
            </div>
          </div>
          
          <div class="analysis-section">
            <div class="section-title">简历分析亮点</div>
            <ul>
              ${candidate.analysisDetails.resumeAnalysis.highlights.map(highlight => 
                `<li class="highlight">${highlight}</li>`
              ).join('')}
            </ul>
          </div>
          ` : ''}
          
          <div class="section">
            <div class="section-title">匹配度评估</div>
            <div class="info-row">
              <span class="info-label">综合匹配度:</span>
              <span style="color: #1890ff; font-weight: bold;">${candidate.matchScore}%</span>
            </div>
            <div class="info-row">
              <span class="info-label">推荐理由:</span>
              <span>${candidate.recommendation}</span>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('生成PDF预览失败:', error);
    res.status(500).send('生成预览失败');
  }
});

// 真正的简历文件预览端点
app.get('/api/resume-file/:id', async (req, res) => {
  try {
    const candidateId = parseInt(req.params.id);
    
    // 从数据库获取候选人数据
    const candidate = await getCandidateByIdGlobal(candidateId, { includeBlob: true });
    
    if (!candidate) {
      return res.status(404).send('候选人不存在');
    }
    
    // 检查是否有简历文件
    if (!candidate.resumeFileBuffer && !candidate.resumeFilePath) {
      return res.status(404).send('简历文件不存在');
    }
    
    // 确定文件扩展名和内容类型
    let ext, contentType;
    
    if (candidate.resumeFileBuffer && candidate.resumeFileName) {
      ext = path.extname(candidate.resumeFileName).toLowerCase();
    } else if (candidate.resumeFilePath) {
      ext = path.extname(candidate.resumeFilePath).toLowerCase();
    } else {
      return res.status(404).send('无法确定简历文件格式');
    }
    
    contentType = 'application/octet-stream';
    if (ext === '.pdf') {
      contentType = 'application/pdf';
    } else if (ext === '.doc') {
      contentType = 'application/msword';
    } else if (ext === '.docx') {
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (ext === '.jpg' || ext === '.jpeg') {
      contentType = 'image/jpeg';
    } else if (ext === '.png') {
      contentType = 'image/png';
    }
    
    // 设置响应头
    const previewFileName = candidate.resumeFileName || `resume_${candidate.id}${ext}`;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="resume${ext}"; filename*=UTF-8''${encodeURIComponent(previewFileName)}`);
    
    // 发送文件内容
    if (candidate.resumeFileBuffer) {
      res.send(candidate.resumeFileBuffer);
    } else if (candidate.resumeFilePath) {
      const fileBuffer = await fs.readFile(candidate.resumeFilePath);
      res.send(fileBuffer);
    }
  } catch (error) {
    console.error('预览简历文件失败:', error);
    res.status(500).send('预览失败');
  }
});

// 简历内容分析API接口
app.post('/api/analyze-resume/:id', async (req, res) => {
  req.setTimeout(300000);
  res.setTimeout(300000);
  
  try {
    const candidateId = parseInt(req.params.id);
    const forceReanalyze = true;
    
    if (isNaN(candidateId)) {
      return res.status(400).json({ error: '无效的候选人ID' });
    }
    
    console.log(`开始分析简历，候选人ID: ${candidateId}`);
    
    // 从数据库获取候选人数据
    const candidate = await getCandidateByIdGlobal(candidateId, { includeBlob: true });
    
    if (!candidate) {
      return res.status(404).json({ error: '候选人不存在' });
    }
    
    if (!candidate.resumeFileBuffer && !candidate.resumeFilePath) {
      return res.status(404).json({ error: '简历文件不存在' });
    }
    
    // 检查文件是否存在（如果有文件路径）
    if (candidate.resumeFilePath && !candidate.resumeFileBuffer) {
      try {
        await fs.access(candidate.resumeFilePath);
      } catch (error) {
        return res.status(404).json({ error: '简历文件已丢失' });
      }
    }
    
    // 确定文件扩展名
    let fileExt;
    if (candidate.resumeFileBuffer && candidate.resumeFileName) {
      fileExt = path.extname(candidate.resumeFileName).toLowerCase();
    } else if (candidate.resumeFilePath) {
      fileExt = path.extname(candidate.resumeFilePath).toLowerCase();
    } else {
      return res.status(400).json({ error: '无法确定简历文件格式' });
    }
    
    if (!['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'].includes(fileExt)) {
      return res.status(400).json({ error: '不支持的文件格式' });
    }

    // 更新候选人状态为分析中
    await updateCandidateById(candidateId, {
      status: '分析中',
      recommendation: '简历分析已加入后台队列，请稍候自动刷新结果'
    });

    scheduleResumeAnalysis(candidateId, { renameAfterAnalysis: false, forceReanalyze, trigger: 'manual' });

    res.status(202).json({
      success: true,
      queued: true,
      message: '简历已加入后台分析队列',
      candidate: { ...candidate, status: '分析中' }
    });
    
  } catch (error) {
    console.error('简历分析失败:', error);
    console.error('错误堆栈:', error.stack);
    
    if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      res.status(504).json({ error: '简历分析超时，请稍后重试' });
    } else if (error.code === 'ENOENT') {
      res.status(404).json({ error: '简历文件不存在' });
    } else if (error.message.includes('memory')) {
      res.status(413).json({ error: '文件过大，请压缩后重试' });
    } else {
      res.status(500).json({ error: '简历分析失败: ' + error.message });
    }
  }
});

// 保存面试分和面试记录到候选人数据
app.post('/api/candidates/interview-score', express.json(), async (req, res) => {
  try {
    const { candidateId, interviewScore, interviewDetails, interviewDate, interviewRecord, candidateSnapshot } = req.body;

    console.log('保存面试分和面试记录请求:', {
      candidateId,
      interviewScore,
      interviewDetails,
      hasInterviewRecord: !!interviewRecord,
      hasCandidateSnapshot: !!candidateSnapshot
    });

    // 首先获取候选人现有数据
    const candidate = await getCandidateByIdGlobal(candidateId, { includeBlob: false });

    if (!candidate) {
      // 如果候选人不存在，尝试通过快照查找
      if (candidateSnapshot) {
        // 这里可以添加通过快照查找候选人的逻辑
        // 但目前先返回错误
        return res.status(404).json({ error: '候选人不存在，无法回写面试分。请确认是从候选人列表中选择后开始的面试。' });
      }
      return res.status(404).json({ error: '候选人不存在，无法回写面试分。请确认是从候选人列表中选择后开始的面试。' });
    }

    // 准备更新数据
    const updateData = {
      interviewScore: interviewScore,
      interviewDetails: interviewDetails,
      interviewDate: interviewDate,
      hasInterview: true
    };

    // 处理面试记录
    if (interviewRecord) {
      // 获取现有面试记录
      const existingRecords = candidate.interviewRecords || [];
      // 添加新记录
      const updatedRecords = [...existingRecords, interviewRecord];
      updateData.interviewRecords = updatedRecords;
      updateData.latestInterviewRecord = interviewRecord;

      console.log('面试记录已保存:', {
        candidateId,
        sessionId: interviewRecord.sessionId,
        totalRecords: updatedRecords.length
      });
    }

    // 计算综合评分（简历分 + MBTI分 + 面试分）
    const resumeScore = candidate.matchScore || 0;
    const mbtiScore = candidate.mbtiScore || 0;
    const finalScore = Math.round((resumeScore * 0.35) + (mbtiScore * 0.15) + (interviewScore * 0.5));
    updateData.finalScore = finalScore;

    // 更新候选人数据到数据库
    const updatedCandidate = await updateCandidateById(candidateId, updateData);

    if (!updatedCandidate) {
      throw new Error('更新候选人数据失败');
    }

    console.log('面试分和面试记录保存成功:', {
      candidateId,
      interviewScore,
      resumeScore,
      mbtiScore,
      finalScore,
      interviewRecordsCount: updateData.interviewRecords?.length || 0
    });

    res.json({
      success: true,
      message: '面试分和面试记录保存成功',
      data: {
        candidateId,
        interviewScore,
        resumeScore,
        mbtiScore,
        finalScore,
        interviewRecordsCount: updateData.interviewRecords?.length || 0
      }
    });

  } catch (error) {
    console.error('保存面试分失败:', error);
    res.status(500).json({ error: '保存面试分失败: ' + error.message });
  }
});

// 获取候选人列表（用于面试选择）
app.get('/api/candidates', async (req, res) => {
  req.setTimeout(60000);
  res.setTimeout(60000);
  try {
    const token = req.headers.authorization?.split(' ')[1];
    let userId = null;
    if (token) {
      try { const decoded = jwt.verify(token, JWT_SECRET); userId = decoded.id; } catch {}
    }
    if (!userId) return res.status(401).json({ error: '未授权' });
    const candidates = await listCandidatesForUser(userId);
    
    const pendingCandidates = candidates.filter(c => 
      c.status === '待分析' || 
      c.status === '分析中' ||
      (c.resumeFileBuffer && !c.resumeAnalysis)
    );
    
    if (pendingCandidates.length > 0) {
      console.log(`[自动分析] 当前检测到 ${pendingCandidates.length} 个待分析简历，但已禁用列表接口自动派发，避免占用本地VL模型`);
    }
    
    res.json(candidates.map(c => ({
      id: c.id, name: c.name, position: c.position, phone: c.phone, email: c.email,
      mbti: c.mbti, submitTime: c.submitTime, matchScore: c.matchScore,
      interviewScore: c.interviewScore || null, finalScore: c.finalScore || null,
      hasInterview: c.hasInterview || false, interviewDate: c.interviewDate || null,
      interviewDetails: c.interviewDetails || null, recommendation: c.recommendation,
      analysisDetails: c.analysisDetails, resumeAnalysis: c.resumeAnalysis,
      resumeAnalysisResult: c.resumeAnalysisResult,
      resumeFilePath: c.resumeFilePath, resumeFileName: c.resumeFileName,
      resumeOriginalName: c.resumeOriginalName, resumeSize: c.resumeSize,
      status: c.status, createdAt: c.createdAt, updatedAt: c.updatedAt
    })));
  } catch (error) {
    console.error('获取候选人列表失败:', error);
    res.status(500).json({ error: '获取候选人列表失败' });
  }
});

// 获取工作流列表
app.get('/api/workflows', async (req, res) => {
  try {
    // 返回默认工作流数据，与前端默认值保持一致
    const workflows = [
      {
        id: 1,
        title: '简历智能分析',
        description: '上传简历，AI自动分析候选人特点',
        steps: ['上传简历文件', 'AI智能分析', '生成分析报告', '查看匹配度'],
        route: '/resume'
      },
      {
        id: 2,
        title: 'AI智能对话',
        description: '与AI HR进行智能对话，了解企业信息',
        steps: ['选择对话类型', '开始AI对话', '语音/文字交互', '获得专业建议'],
        route: '/chat'
      },
      {
        id: 3,
        title: '候选人管理',
        description: '查看和管理所有候选人信息',
        steps: ['查看候选人列表', '分析简历内容', '查看匹配度', '管理候选人状态'],
        route: '/resume-analysis'
      },
      {
        id: 4,
        title: 'AI面试评估',
        description: '进行AI模拟面试，获得专业评估',
        steps: ['选择面试类型', '开始AI面试', '回答问题', '获得评估报告'],
        route: '/chat'
      }
    ];
    res.json({ workflows });
  } catch (error) {
    console.error('获取工作流失败:', error);
    res.status(500).json({ error: '获取工作流失败' });
  }
});

// 本地 LLM 对话降级接口
app.get('/api/chat/runtime', async (req, res) => {
  try {
    const runtime = await getChatRuntimeStatus(
      String(req.query.engine || 'auto'),
      String(req.query.localModel || '')
    );
    res.json(runtime);
  } catch (error) {
    console.error('获取对话引擎状态失败:', error);
    res.status(500).json({ error: `获取对话引擎状态失败: ${error.message}` });
  }
});

app.post('/api/chat/switch-engine-services', async (req, res) => {
  if (!DOCKER_CONTROL_ENABLED) {
    return res.status(501).json({
      success: false,
      message: '当前环境未启用Docker服务控制'
    });
  }

  try {
    const engine = String(req.body?.engine || '').trim();
    const requestedLocalModel = String(req.body?.localModel || '').trim();
    const localModelConfig = resolveLocalModelConfig(requestedLocalModel);

    if (!engine) {
      return res.status(400).json({
        success: false,
        message: '缺少引擎参数'
      });
    }

    if (engine === 'ollama') {
      const textC = await resolveContainerName('local-llm-text');
      const vlC = await resolveContainerName('local-llm-vl');
      const ollamaC = await resolveContainerName('ollama');
      if (textC) await stopContainerIfNeeded(textC);
      if (vlC) await stopContainerIfNeeded(vlC);
      if (ollamaC) {
        await startContainerIfNeeded(ollamaC);
        await waitForServiceReady(`${OLLAMA_BASE_URL}/api/tags`, 180000, 3000);
      }

      return res.json({
        success: true,
        engine: 'ollama',
        activeServices: ['ollama']
      });
    }

    if (engine === 'local' || engine === 'auto') {
      const ollamaC = await resolveContainerName('ollama');
      const vlC = await resolveContainerName('local-llm-vl');
      if (ollamaC) await stopContainerIfNeeded(ollamaC);
      if (vlC) {
        await startContainerIfNeeded(vlC);
        await waitForServiceReady(`${LOCAL_LLM_VL_URL}/health`, 240000, 3000);
      }

      return res.json({
        success: true,
        engine,
        activeServices: ['local-llm-vl'],
        localModel: localModelConfig?.key || ''
      });
    }

    return res.json({
      success: true,
      engine,
      message: '当前引擎无需切换本地推理服务'
    });
  } catch (error) {
    console.error('切换对话引擎服务失败:', error);
    return res.status(500).json({
      success: false,
      message: error.message || '切换对话引擎服务失败'
    });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, mode = 'general', engine = 'auto', localModel = '', images = [] } = req.body || {};

    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: '消息内容不能为空' });
    }

    const prompt = `${buildChatSystemPrompt(mode)}\n\n用户输入：\n${String(message).trim()}\n\n请直接开始回答：`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const forceLocal = engine === 'local';
    const forceOllama = engine === 'ollama';
    const useAuto = engine === 'auto' || !engine;

    if (forceLocal && !LOCAL_LLM_ENABLED) {
      return res.status(400).json({ error: '本地模型当前未启用，无法切换到本地模型' });
    }

    if ((LOCAL_LLM_ENABLED && !forceOllama) && (forceLocal || useAuto)) {
      try {
        const resolvedLocalModel = resolveLocalModelConfig(localModel);
        res.setHeader('X-LLM-Source', 'local');
        res.setHeader('X-LLM-Model', resolvedLocalModel?.model || LOCAL_LLM_MODEL);
        res.setHeader('X-LLM-Label', `local-${resolvedLocalModel?.model || LOCAL_LLM_MODEL}`);
        await streamLocalModelResponse(res, prompt, mode, localModel, images);
      } catch (localError) {
        if (forceLocal) {
          throw localError;
        }
        console.warn('本地模型服务不可用，回退到 Ollama:', localError.message);
        const resolvedModel = await resolveOllamaModel();
        res.setHeader('X-LLM-Source', 'ollama');
        res.setHeader('X-LLM-Model', resolvedModel);
        res.setHeader('X-LLM-Label', `ollama-${resolvedModel}`);
        await streamOllamaResponse(res, prompt, mode, resolvedModel);
      }
    } else {
      const resolvedModel = await resolveOllamaModel();
      res.setHeader('X-LLM-Source', 'ollama');
      res.setHeader('X-LLM-Model', resolvedModel);
      res.setHeader('X-LLM-Label', `ollama-${resolvedModel}`);
      await streamOllamaResponse(res, prompt, mode, resolvedModel);
    }

    res.end();
  } catch (error) {
    console.error('本地LLM对话失败:', error);
    res.status(500).json({ error: `本地LLM对话失败: ${error.message}` });
  }
});

// 简历下载端点
app.get('/api/download-resume/:id', async (req, res) => {
  try {
    console.log('收到下载请求:', req.params.id);
    const candidateId = parseInt(req.params.id);
    
    if (isNaN(candidateId)) {
      console.error('无效的候选人ID:', req.params.id);
      return res.status(400).send('无效的候选人ID');
    }
    
    // 从数据库获取候选人数据
    const candidate = await getCandidateByIdGlobal(candidateId, { includeBlob: true });
    
    console.log('找到候选人:', candidate ? candidate.name : '未找到');
    
    if (!candidate) {
      return res.status(404).send('候选人不存在');
    }
    
    // 确定文件扩展名
    let ext;
    if (candidate.resumeFileBuffer && candidate.resumeFileName) {
      ext = path.extname(candidate.resumeFileName).toLowerCase();
    } else if (candidate.resumeFilePath) {
      ext = path.extname(candidate.resumeFilePath).toLowerCase();
    } else {
      return res.status(404).send('简历文件不存在');
    }
    
    let contentType = 'application/octet-stream';
    if (ext === '.pdf') {
      contentType = 'application/pdf';
    } else if (ext === '.doc') {
      contentType = 'application/msword';
    } else if (ext === '.docx') {
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (ext === '.jpg' || ext === '.jpeg') {
      contentType = 'image/jpeg';
    } else if (ext === '.png') {
      contentType = 'image/png';
    }
    
    // 如果有内存中的文件，直接下载
    if (candidate.resumeFileBuffer) {
      const fileName = candidate.resumeFileName || `resume_${candidate.id}${ext}`;
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      res.send(candidate.resumeFileBuffer);
      console.log('内存文件下载成功');
      return;
    }
    
    // 如果有文件路径，尝试读取文件
    if (candidate.resumeFilePath) {
      try {
        await fs.access(candidate.resumeFilePath);
        const fileBuffer = await fs.readFile(candidate.resumeFilePath);
        
        res.setHeader('Content-Type', contentType);
        const fileName = candidate.resumeFileName || `resume_${candidate.id}${ext}`;
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        
        res.send(fileBuffer);
        console.log('文件下载成功');
        return;
      } catch (error) {
        console.log('文件不存在:', error.message);
      }
    }
    
    // 如果没有文件，返回错误信息
    console.log('简历文件不存在');
    res.status(404).send('简历文件不存在');
  } catch (error) {
    console.error('下载简历失败:', error);
    console.error('错误堆栈:', error.stack);
    res.status(500).send('下载失败');
  }
});

// 简单的测试下载端点
app.get('/api/test-download', (req, res) => {
  try {
    const testContent = `招聘灵犀 - 测试文件

========================================

这是一个测试下载文件，用于验证下载功能是否正常工作。

测试信息:
- 文件名: test.txt
- 生成时间: ${new Date().toLocaleString('zh-CN')}
- 状态: 正常

如果您能看到这个文件内容，说明下载功能工作正常。

========================================
招聘灵犀`;
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="test.txt"');
    res.setHeader('Content-Length', Buffer.byteLength(testContent, 'utf8'));
    
    res.send(Buffer.from(testContent, 'utf8'));
    console.log('测试文本下载成功');
  } catch (error) {
    console.error('测试下载失败:', error);
    res.status(500).send('测试下载失败');
  }
});

// 测试文件上传端点
app.post('/api/test-upload', upload.single('testFile'), (req, res) => {
  try {
    console.log('测试文件上传请求:', req.body);
    console.log('测试上传的文件:', req.file);
    
    if (req.file) {
      res.json({
        success: true,
        message: '文件上传成功',
        file: {
          originalname: req.file.originalname,
          filename: req.file.filename,
          path: req.file.path,
          size: req.file.size
        }
      });
    } else {
      res.json({
        success: false,
        message: '没有文件上传'
      });
    }
  } catch (error) {
    console.error('测试上传失败:', error);
    res.status(500).json({ error: '测试上传失败' });
  }
});

// 简单的文件上传测试页面
app.get('/api/upload-test', (req, res) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>文件上传测试</title>
    <meta charset="utf-8">
</head>
<body>
    <h1>文件上传功能测试</h1>
    <form id="uploadForm" enctype="multipart/form-data">
        <p>
            <label>选择文件:</label><br>
            <input type="file" id="fileInput" name="testFile" accept=".pdf,.doc,.docx" required>
        </p>
        <p>
            <button type="submit">上传测试</button>
        </p>
    </form>
    
    <div id="result" style="margin-top: 20px; padding: 10px; border: 1px solid #ccc;"></div>

    <script>
        document.getElementById('uploadForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const fileInput = document.getElementById('fileInput');
            const file = fileInput.files[0];
            const resultDiv = document.getElementById('result');
            
            if (!file) {
                resultDiv.innerHTML = '<p style="color: red;">请选择文件</p>';
                return;
            }
            
            resultDiv.innerHTML = '<p>正在上传...</p>';
            
            const formData = new FormData();
            formData.append('testFile', file);
            
            try {
                const response = await fetch('/api/test-upload', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                resultDiv.innerHTML = '<pre>' + JSON.stringify(result, null, 2) + '</pre>';
            } catch (error) {
                resultDiv.innerHTML = '<p style="color: red;">错误: ' + error.message + '</p>';
            }
        });
    </script>
</body>
</html>`;
  
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// 生成简历PDF内容（模拟）
function generateResumePDF(candidate) {
  // 清理候选人数据，避免特殊字符导致PDF格式错误
  const cleanName = (candidate.name || '未知').replace(/[()]/g, '');
  const cleanPosition = (candidate.position || '未知').replace(/[()]/g, '');
  const cleanPhone = (candidate.phone || '未知').replace(/[()]/g, '');
  const cleanEmail = (candidate.email || '未知').replace(/[()]/g, '');
  const cleanMbti = (candidate.mbti || '未完成').replace(/[()]/g, '');
  const cleanScore = candidate.matchScore || 0;
  const cleanRecommendation = (candidate.recommendation || '暂无').replace(/[()]/g, '').substring(0, 50);
  
  // 创建一个简单的文本格式简历，而不是PDF
  const resumeText = `
招聘灵犀 - 候选人简历

========================================

基本信息
----------------------------------------
姓名: ${cleanName}
应聘职位: ${cleanPosition}
联系电话: ${cleanPhone}
邮箱地址: ${cleanEmail}
MBTI类型: ${cleanMbti}

匹配分析
----------------------------------------
匹配度: ${cleanScore}%
推荐理由: ${cleanRecommendation}

生成时间: ${new Date().toLocaleString('zh-CN')}

========================================
招聘灵犀
`;

  // 返回纯文本内容，让浏览器以文本形式显示
  return resumeText;
}

// 添加候选人数据
app.post('/api/candidates', upload.single('resume'), async (req, res) => {
  try {
    console.log('=== 候选人数据请求开始 ===');
    console.log('Content-Type:', req.headers['content-type']);
    console.log('请求体类型:', typeof req.body);
    console.log('收到候选人数据请求:', req.body);
    console.log('上传的文件:', req.file);
    console.log('multer错误:', req.multerError);
    console.log('=== 候选人数据请求结束 ===');
    console.log('请求体字段检查:', {
      name: req.body.name,
      position: req.body.position,
      phone: req.body.phone,
      email: req.body.email,
      mbti: req.body.mbti
    });
    
    // 详细检查文件上传信息
    if (req.file) {
      console.log('文件上传成功:', {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        buffer: req.file.buffer ? '有数据' : '无数据'
      });
    } else {
      console.log('没有文件上传');
    }
    
     // 设置响应超时
    res.setTimeout(30000, () => {
      console.error('请求超时');
      if (!res.headersSent) {
        res.status(504).json({ error: '请求超时，请重试' });
      }
    });
    
    const token = req.headers.authorization?.split(' ')[1];
    let owner = null;
    if (token) {
      try { const decoded = jwt.verify(token, JWT_SECRET); owner = { id: decoded.id, username: decoded.username, email: decoded.email }; } catch {}
    }
    if (!owner) return res.status(401).json({ error: '未授权，请先登录' });
    await ensureCandidateDatabase(owner.id);
    
    await ensureDataFile();
    const data = await fs.readFile(DATA_FILE, 'utf8');
    const candidates = JSON.parse(data);
    
    let resumeFilePath = null;
    let resumeFileName = null;
    
    // 如果有文件上传，保存文件到磁盘
    if (req.file) {
      
      try {
        const uploadDir = path.join(__dirname, 'uploads', 'resumes');
        console.log('上传目录路径:', uploadDir);
        
        // 确保目录存在
        if (!fsSync.existsSync(uploadDir)) {
          console.log('创建上传目录:', uploadDir);
          fsSync.mkdirSync(uploadDir, { recursive: true });
        }
        
        const fileExt = path.extname(req.file.originalname).toLowerCase();
        resumeFileName = buildUploadedResumeFileName(req.body.name, req.body.position, req.body.mbti, fileExt);
        resumeFilePath = path.join(uploadDir, resumeFileName);
        const processedUpload = await compressImageBufferIfNeeded(req.file.buffer, fileExt);
        if (fsSync.existsSync(resumeFilePath)) {
          const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 1E6)}`;
          const baseName = path.basename(resumeFileName, fileExt);
          resumeFileName = `${baseName}_${uniqueSuffix}${fileExt}`;
          resumeFilePath = path.join(uploadDir, resumeFileName);
        }
        
        await fs.writeFile(resumeFilePath, processedUpload.buffer);
        console.log('文件已保存到:', resumeFilePath);
        console.log(`初筛上传预处理完成: ${req.file.size} -> ${processedUpload.buffer?.length || req.file.size} bytes`);
      } catch (error) {
        console.error('❌ 保存文件失败:', error);
        console.error('错误详情:', error.message);
        console.error('错误堆栈:', error.stack);
      }
    }
    
    const provisionalScores = calculateCandidateScores(req.body, null);
    
    const newCandidate = {
      ...req.body,
      id: generateCandidateId(),
      ownerUserId: owner.id,
      ownerUserName: owner.username || owner.email || '',
      ownerUserEmail: owner.email || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      resumeFilePath: resumeFilePath,
      resumeOriginalName: req.file ? req.file.originalname : null,
      resumeFileName: resumeFileName,
      matchScore: provisionalScores.finalMatchScore,
      mbtiScore: provisionalScores.mbtiScore,
      resumeScore: provisionalScores.resumeScore,
      resumeAnalysis: req.file ? createPendingResumeAnalysis() : null,
      recommendation: req.file ? '简历分析排队中，请稍候查看结果' : '建议进一步评估',
      hasInterview: false,
      status: req.file ? '分析中' : '已提交'
    };

    if (newCandidate.resumeFilePath && fsSync.existsSync(newCandidate.resumeFilePath)) {
      try {
        const stats = await fs.stat(newCandidate.resumeFilePath);
        newCandidate.resumeSize = String(stats.size);
        newCandidate.resumeFileHash = await calculateFileHash(newCandidate.resumeFilePath);
      } catch (error) {
        console.error('生成简历文件指纹失败:', error.message);
      }
    }
    
    console.log('创建的新候选人数据:', {
      name: newCandidate.name,
      position: newCandidate.position,
      matchScore: newCandidate.matchScore,
      mbtiScore: newCandidate.mbtiScore,
      resumeScore: newCandidate.resumeScore
    });
    
    if (req.file) {
      newCandidate.resumeFileBuffer = req.file.buffer;
    }
    
    await upsertCandidateForUser(owner.id, newCandidate);

    if (req.file) {
      scheduleResumeAnalysis(newCandidate.id, { renameAfterAnalysis: true });
    }
    
    console.log('新候选人数据已保存:', newCandidate);
    res.json({ success: true, candidate: newCandidate });
  } catch (error) {
    console.error('保存数据失败:', error);
    console.error('错误堆栈:', error.stack);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: '保存数据失败', 
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
});

// 删除候选人数据
app.delete('/api/candidates/:id', async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    let userId = null;
    if (token) { try { const decoded = jwt.verify(token, JWT_SECRET); userId = decoded.id; } catch {} }
    if (!userId) return res.status(401).json({ error: '未授权' });
    
    const candidateId = parseInt(req.params.id);
    if (isNaN(candidateId)) return next();
    
    await deleteCandidateById(userId, candidateId);
    res.json({ success: true });
  } catch (error) {
    console.error('删除数据失败:', error);
    res.status(500).json({ error: '删除数据失败' });
  }
});

// 预览无效候选人清理结果
app.get('/api/candidates/cleanup-invalid-preview', async (req, res) => {
  try {
    await ensureDataFile();
    const data = await fs.readFile(DATA_FILE, 'utf8');
    const candidates = JSON.parse(data);
    const invalidCandidates = await getInvalidCandidates(candidates);

    res.json({
      success: true,
      count: invalidCandidates.length,
      candidates: invalidCandidates
    });
  } catch (error) {
    console.error('预览无效候选人清理失败:', error);
    res.status(500).json({ error: '预览无效候选人清理失败' });
  }
});

// 清理无效候选人数据
app.delete('/api/candidates/cleanup-invalid', async (req, res) => {
  try {
    await ensureDataFile();
    const data = await fs.readFile(DATA_FILE, 'utf8');
    const candidates = JSON.parse(data);
    const invalidCandidates = await getInvalidCandidates(candidates);

    if (invalidCandidates.length === 0) {
      return res.json({
        success: true,
        removedCount: 0,
        removedCandidates: []
      });
    }

    const invalidIds = new Set(invalidCandidates.map(candidate => candidate.id));
    const removedCandidates = candidates.filter(candidate => invalidIds.has(candidate.id));
    const validCandidates = candidates.filter(candidate => !invalidIds.has(candidate.id));

    for (const candidate of removedCandidates) {
      await removeCandidateResumeFile(candidate);
    }

    await fs.writeFile(DATA_FILE, JSON.stringify(validCandidates, null, 2));

    res.json({
      success: true,
      removedCount: removedCandidates.length,
      removedCandidates: invalidCandidates
    });
  } catch (error) {
    console.error('清理无效候选人失败:', error);
    res.status(500).json({ error: '清理无效候选人失败' });
  }
});

// 清空所有数据（清空数据库中的候选人数据）
app.delete('/api/candidates', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`[清空数据] 用户 ${userId} 请求清空所有候选人数据`);

    const deletedCount = await clearCandidatesForUser(userId);

    console.log(`[清空数据] 成功删除 ${deletedCount} 条候选人数据`);
    res.json({ success: true, deletedCount });
  } catch (error) {
    console.error('清空数据失败:', error);
    res.status(500).json({ error: '清空数据失败', message: error.message });
  }
});

// 讯飞虚拟人签名生成 API
app.get('/api/xunfei/avatar-sign', (req, res) => {
  try {
    const appId = process.env.XUNFEI_APP_ID || process.env.REACT_APP_XUNFEI_APP_ID;
    const apiKey = process.env.XUNFEI_API_KEY || process.env.REACT_APP_XUNFEI_API_KEY;
    const apiSecret = process.env.XUNFEI_API_SECRET || process.env.REACT_APP_XUNFEI_API_SECRET;
    
    if (!appId || !apiKey || !apiSecret) {
      return res.status(500).json({ error: '讯飞 API 配置缺失' });
    }
    
    const host = 'avatar.cn-huadong-1.xf-yun.com';
    const path = '/v1/interact';
    const date = new Date().toUTCString();
    
    const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
    const signatureSha = crypto.createHmac('sha256', apiSecret).update(signatureOrigin).digest('base64');
    
    const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`;
    const authorization = Buffer.from(authorizationOrigin).toString('base64');
    
    const signedUrl = `wss://${host}${path}?authorization=${authorization}&date=${encodeURIComponent(date)}&host=${host}`;
    
    console.log('🔐 讯飞签名生成:', {
      host,
      path,
      date,
      signatureOrigin,
      authorization: authorization.substring(0, 50) + '...'
    });
    
    res.json({
      success: true,
      signedUrl,
      appId,
      expiresIn: 300
    });
  } catch (error) {
    console.error('生成讯飞签名失败:', error);
    res.status(500).json({ error: '生成签名失败' });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// OCR对比测试API
app.post('/api/test-ocr-comparison', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传图片文件' });
    }

    const buffer = req.file.buffer;
    const originalName = req.file.originalname || 'test.jpg';

    console.log(`[OCR测试] 收到文件: ${originalName}, 大小: ${buffer.length}`);

    // 动态导入parserService中的OCR函数
    const parserModule = require('./services/resume/parserService');

    // 运行Tesseract OCR
    console.log('[OCR测试] 开始Tesseract OCR...');
    const tesseractStart = Date.now();
    let tesseractResult = { text: '', elapsed: 0, error: null };
    try {
      const result = await parserModule.runNativeTesseractOCR(buffer, originalName);
      tesseractResult.text = result.text || '';
      tesseractResult.elapsed = Date.now() - tesseractStart;
      console.log(`[OCR测试] Tesseract完成，耗时: ${tesseractResult.elapsed}ms，长度: ${tesseractResult.text.length}`);
    } catch (e) {
      tesseractResult.error = e.message;
      tesseractResult.elapsed = Date.now() - tesseractStart;
      console.log(`[OCR测试] Tesseract失败: ${e.message}`);
    }

    // 运行VL OCR
    console.log('[OCR测试] 开始VL OCR...');
    const vlStart = Date.now();
    let vlResult = { text: '', elapsed: 0, error: null };
    try {
      const result = await parserModule.runVLOCR(buffer, originalName, false, {});
      vlResult.text = result.text || '';
      vlResult.elapsed = Date.now() - vlStart;
      console.log(`[OCR测试] VL OCR完成，耗时: ${vlResult.elapsed}ms，长度: ${vlResult.text.length}`);
    } catch (e) {
      vlResult.error = e.message;
      vlResult.elapsed = Date.now() - vlStart;
      console.log(`[OCR测试] VL OCR失败: ${e.message}`);
    }

    // 计算评分
    const tesseractQuality = parserModule.scoreOCRTextQuality ?
      parserModule.scoreOCRTextQuality(tesseractResult.text) :
      { score: tesseractResult.text.length, length: tesseractResult.text.length };

    const vlQuality = parserModule.scoreOCRTextQuality ?
      parserModule.scoreOCRTextQuality(vlResult.text) :
      { score: vlResult.text.length, length: vlResult.text.length };

    // 融合结果
    const fusedResult = parserModule.fuseOCRResults ?
      parserModule.fuseOCRResults(tesseractResult, vlResult) :
      { text: tesseractResult.text || vlResult.text, parser: 'fallback', preferredSource: 'unknown' };

    res.json({
      success: true,
      fileName: originalName,
      fileSize: buffer.length,
      tesseract: {
        text: tesseractResult.text,
        elapsed: tesseractResult.elapsed,
        error: tesseractResult.error,
        quality: tesseractQuality
      },
      vl: {
        text: vlResult.text,
        elapsed: vlResult.elapsed,
        error: vlResult.error,
        quality: vlQuality
      },
      fused: {
        text: fusedResult.text,
        parser: fusedResult.parser,
        preferredSource: fusedResult.preferredSource,
        quality: fusedResult.quality
      }
    });
  } catch (error) {
    console.error('OCR测试失败:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`数据服务器运行在 http://localhost:${PORT}`);
  console.log(`API端点:`);
  console.log(`  GET  /api/candidates - 获取所有候选人数据`);
  console.log(`  POST /api/candidates - 添加候选人数据`);
  console.log(`  DELETE /api/candidates/:id - 删除指定候选人`);
  console.log(`  DELETE /api/candidates - 清空所有数据`);
  console.log(`  GET  /api/download-resume/:id - 下载简历文件`);
  console.log(`  GET  /api/test-download - 测试下载功能`);
  console.log(`  GET  /api/upload-test - 文件上传测试页面`);
  console.log(`  POST /api/test-upload - 文件上传测试API`);
  console.log(`  GET  /api/health - 健康检查`);
});
