const express = require('express');
const path = require('path');

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://ollama:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'deepseek-r1:14b';
const LOCAL_LLM_ENABLED = process.env.LOCAL_LLM_ENABLED === 'true';
const LOCAL_LLM_URL = process.env.LOCAL_LLM_URL || 'http://host.docker.internal:8002';
const LOCAL_LLM_MODEL = process.env.LOCAL_LLM_MODEL || 'qwen2-7b-gguf';
const LOCAL_LLM_VL_URL = process.env.LOCAL_LLM_VL_URL || 'http://host.docker.internal:8003';
const DOCKER_CONTROL_ENABLED = process.env.DOCKER_CONTROL_ENABLED === 'true';
const { execFile } = require('child_process');
const { promisify } = require('util');
const { withAIConcurrencyLimit } = require('../server/utils/aiConcurrencyGate');
const execFileAsync = promisify(execFile);
const CHAT_MAX_IMAGE_COUNT = Number(process.env.CHAT_MAX_IMAGE_COUNT || 3);
const CHAT_MAX_IMAGE_TOTAL_BYTES = Number(process.env.CHAT_MAX_IMAGE_TOTAL_BYTES || 4 * 1024 * 1024);

const LOCAL_MODEL_REGISTRY = {
  'qwen3-vl-8b-gguf': {
    key: 'qwen3-vl-8b-gguf',
    label: 'Qwen3-VL-8B（图文）',
    model: 'qwen3-vl-8b-gguf',
    url: LOCAL_LLM_VL_URL,
    supportsImages: true
  }
};

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

function estimateDataUrlBytes(dataUrl) {
  const separatorIndex = dataUrl.indexOf(',');
  if (separatorIndex === -1) {
    return 0;
  }

  const base64Body = dataUrl.slice(separatorIndex + 1);
  const paddingLength = (base64Body.match(/=+$/) || [''])[0].length;
  return Math.max(0, Math.ceil(base64Body.length * 3 / 4) - paddingLength);
}

function normalizeChatImages(images = []) {
  if (!Array.isArray(images)) {
    return [];
  }

  return images.filter(image => image && typeof image === 'string' && image.startsWith('data:image/'));
}

function validateChatImages(images = []) {
  const normalizedImages = normalizeChatImages(images);

  if (normalizedImages.length > CHAT_MAX_IMAGE_COUNT) {
    throw new Error(`图片数量不能超过 ${CHAT_MAX_IMAGE_COUNT} 张`);
  }

  const totalBytes = normalizedImages.reduce((sum, image) => sum + estimateDataUrlBytes(image), 0);
  if (totalBytes > CHAT_MAX_IMAGE_TOTAL_BYTES) {
    throw new Error(`图片总大小不能超过 ${Math.round(CHAT_MAX_IMAGE_TOTAL_BYTES / 1024 / 1024)}MB`);
  }

  return normalizedImages;
}

async function resolveOllamaModel() {
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
}

const _containerCache = new Map();
const _containerLookupInflight = new Map();
const _containerOperationInflight = new Map();

async function resolveContainerName(serviceKey) {
  const cached = _containerCache.get(serviceKey);
  if (cached && (Date.now() - cached.ts) < 30000) return cached.name;

  const inflightLookup = _containerLookupInflight.get(serviceKey);
  if (inflightLookup) {
    return inflightLookup;
  }

  const lookupPromise = (async () => {
    try {
      const { stdout } = await execFileAsync('docker', [
        'ps', '--filter', `label=com.docker.compose.service=${serviceKey}`,
        '--format', '{{.Names}}'
      ], { timeout: 10000 });
      const name = String(stdout || '').trim().split('\n')[0];
      if (!name) {
        _containerCache.delete(serviceKey);
        return null;
      }
      _containerCache.set(serviceKey, { name, ts: Date.now() });
      return name;
    } catch (_) {
      return null;
    } finally {
      _containerLookupInflight.delete(serviceKey);
    }
  })();

  _containerLookupInflight.set(serviceKey, lookupPromise);
  return lookupPromise;
}

function invalidateContainerCache() {
  _containerCache.clear();
}

async function withContainerOperation(containerName, action, task) {
  const operationKey = `${action}:${containerName}`;
  const inflightOperation = _containerOperationInflight.get(operationKey);
  if (inflightOperation) {
    return inflightOperation;
  }

  const operationPromise = (async () => {
    try {
      return await task();
    } finally {
      _containerOperationInflight.delete(operationKey);
    }
  })();

  _containerOperationInflight.set(operationKey, operationPromise);
  return operationPromise;
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
  await withContainerOperation(containerName, 'start', async () => {
    if (await isContainerRunning(containerName)) {
      return;
    }
    await runDockerCommand(['start', containerName], 180000);
  });
}

async function stopContainerIfNeeded(containerName) {
  await withContainerOperation(containerName, 'stop', async () => {
    if (!await isContainerRunning(containerName)) {
      return;
    }
    await runDockerCommand(['stop', containerName], 180000);
  });
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

async function runDockerCommand(args, timeout = 180000) {
  const result = await execFileAsync('docker', args, { timeout, maxBuffer: 1024 * 1024 * 10 });
  return {
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim()
  };
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
      { key: 'auto', label: '自动', enabled: true },
      { key: 'ollama', label: 'Ollama', enabled: true },
      { key: 'local', label: '本地模型', enabled: LOCAL_LLM_ENABLED }
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

function buildChatSystemPrompt(mode = 'general') {
  if (mode === 'interview') {
    return [
      '你是"招聘灵犀"的专业 AI 面试官。',
      '你的目标是围绕候选人的岗位、经历和回答进行专业面试。',
      '回答要求自然、专业、简洁，不要使用 Markdown 标题。',
      '如果输入中包含"当前面试问题"和"候选人回答"，请先评价回答，再决定是否追问或提出下一题。'
    ].join('\n');
  }
  return [
    '你是"招聘灵犀"的本地 AI 招聘助手。',
    '请围绕招聘、岗位咨询、公司问答、面试建议等场景进行回答。',
    '回答使用简体中文，风格专业、友好、简洁。',
    '如果用户是在面试上下文中提问，请优先以面试官视角作答。'
  ].join('\n');
}

async function streamLocalModelResponse(res, prompt, mode = 'general', localModelKey = '', images = []) {
  const localModel = resolveLocalModelConfig(localModelKey);
  if (!localModel) {
    throw new Error('未找到可用的本地模型配置');
  }

  const normalizedImages = normalizeChatImages(images);

  if (normalizedImages.length > 0 && !localModel.supportsImages) {
    throw new Error('当前本地模型不支持图片输入，请切换到 Qwen3-VL');
  }

  const userContent = normalizedImages.length > 0
    ? [
        { type: 'text', text: prompt },
        ...normalizedImages.map(image => ({
          type: 'image_url',
          image_url: { url: image }
        }))
      ]
    : prompt;

  await withAIConcurrencyLimit('local', async () => {
    const response = await fetch(`${localModel.url}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: localModel.model,
        stream: false,
        max_tokens: mode === 'interview' ? 384 : 512,
        temperature: mode === 'interview' ? 0.2 : 0.3,
        messages: [
          { role: 'system', content: buildChatSystemPrompt(mode) },
          { role: 'user', content: userContent }
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
  });
  return localModel;
}

async function streamOllamaResponse(res, prompt, mode = 'general', preferredModel = null) {
  const model = preferredModel || await resolveOllamaModel();
  await withAIConcurrencyLimit('ollama', async () => {
    const ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: true,
        options: { temperature: mode === 'interview' ? 0.6 : 0.7 }
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
        let chunk;
        try { chunk = JSON.parse(line); } catch { continue; }
        if (chunk.response) {
          res.write(chunk.response);
        }
      }
    }

    if (buffer.trim()) {
      let lastChunk;
      try { lastChunk = JSON.parse(buffer); } catch { lastChunk = null; }
      if (lastChunk?.response) {
        res.write(lastChunk.response);
      }
    }
  });
}

function createChatRouter({ authMiddleware } = {}) {
  const router = express.Router();

  // P2-5: 所有聊天路由需要认证
  if (authMiddleware) {
    router.use(authMiddleware);
  }

  // 获取对话引擎状态
  router.get('/chat/runtime', async (req, res) => {
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

  // 切换对话引擎服务
  router.post('/chat/switch-engine-services', async (req, res) => {
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

  // 对话接口
  router.post('/chat', async (req, res) => {
    try {
      const { message, mode = 'general', engine = 'auto', localModel = '', images = [] } = req.body || {};
      const normalizedImages = validateChatImages(images);

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
          await streamLocalModelResponse(res, prompt, mode, localModel, normalizedImages);
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
      if (res.headersSent) {
        res.end();
      } else {
        const statusCode = error.code === 'AI_OVERLOADED' ? 503 : 500;
        res.status(statusCode).json({ error: `本地LLM对话失败: ${error.message}` });
      }
    }
  });

  return router;
}

module.exports = { createChatRouter };
