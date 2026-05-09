'use strict';

class AIOverloadError extends Error {
  constructor(message = 'AI服务繁忙，请稍后重试') {
    super(message);
    this.name = 'AIOverloadError';
    this.code = 'AI_OVERLOADED';
    this.statusCode = 503;
  }
}

class ConcurrencyGate {
  constructor(limit, maxQueue, label) {
    this.limit = Math.max(1, Number(limit) || 1);
    this.maxQueue = Math.max(0, Number(maxQueue) || 0);
    this.label = label;
    this.activeCount = 0;
    this.queue = [];
  }

  async run(task) {
    if (this.activeCount < this.limit) {
      return this.execute(task);
    }

    if (this.queue.length >= this.maxQueue) {
      throw new AIOverloadError(`${this.label}繁忙，请稍后重试`);
    }

    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
    });
  }

  async execute(task) {
    this.activeCount += 1;
    try {
      return await task();
    } finally {
      this.activeCount -= 1;
      this.drainQueue();
    }
  }

  drainQueue() {
    while (this.activeCount < this.limit && this.queue.length > 0) {
      const next = this.queue.shift();
      this.execute(next.task).then(next.resolve).catch(next.reject);
    }
  }

  // updateConfig allows in-place config changes without replacing the Gate
  // instance, so queued Promises are never orphaned.
  updateConfig(limit, maxQueue) {
    this.limit = Math.max(1, Number(limit) || 1);
    this.maxQueue = Math.max(0, Number(maxQueue) || 0);
  }
}

const gates = new Map();

function getGateConfig(engine) {
  if (engine === 'local') {
    return {
      key: 'local',
      limit: Math.max(1, Number(process.env.LOCAL_AI_MAX_CONCURRENCY || 1)),
      maxQueue: Math.max(0, Number(process.env.LOCAL_AI_MAX_QUEUE || 8)),
      label: '本地AI服务'
    };
  }

  if (engine === 'resume-analysis') {
    return {
      key: 'resume-analysis',
      limit: Math.max(1, Number(process.env.RESUME_ANALYSIS_MAX_CONCURRENCY || 2)),
      maxQueue: Math.max(0, Number(process.env.RESUME_ANALYSIS_MAX_QUEUE || 10)),
      label: '简历分析服务'
    };
  }

  return {
    key: 'ollama',
    limit: Math.max(1, Number(process.env.OLLAMA_AI_MAX_CONCURRENCY || 2)),
    maxQueue: Math.max(0, Number(process.env.OLLAMA_AI_MAX_QUEUE || 12)),
    label: 'Ollama服务'
  };
}

function withAIConcurrencyLimit(engine, task) {
  const config = getGateConfig(engine);
  let gate = gates.get(config.key);

  // Only create the gate once (or re-create if it was never created).
  // Idle gates are NOT rebuilt — rebuilding would orphan queued Promises
  // (memory leak + permanent hang).
  if (!gate) {
    gate = new ConcurrencyGate(config.limit, config.maxQueue, config.label);
    gates.set(config.key, gate);
  } else if (gate.limit !== config.limit || gate.maxQueue !== config.maxQueue) {
    // Config changed while gate was busy: update in-place without losing the queue.
    gate.updateConfig(config.limit, config.maxQueue);
  }

  return gate.run(task);
}

module.exports = {
  AIOverloadError,
  withAIConcurrencyLimit
};