'use strict';

const { Queue } = require('bullmq');

require('dotenv').config();

const RESUME_ANALYSIS_QUEUE_NAME = process.env.RESUME_ANALYSIS_QUEUE_NAME || 'resume-analysis';
const RESUME_ANALYSIS_QUEUE_REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

let sharedConnection = null;
let sharedQueue = null;

function createRedisConnection() {
  const IORedis = require('ioredis');
  return new IORedis(RESUME_ANALYSIS_QUEUE_REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });
}

function getSharedConnection() {
  if (sharedConnection) {
    return sharedConnection;
  }

  sharedConnection = createRedisConnection();
  sharedConnection.on('error', error => {
    console.error('[resume-analysis-queue] Redis连接异常:', error.message);
  });
  return sharedConnection;
}

function getResumeAnalysisQueue() {
  if (sharedQueue) {
    return sharedQueue;
  }

  sharedQueue = new Queue(RESUME_ANALYSIS_QUEUE_NAME, {
    connection: getSharedConnection(),
    defaultJobOptions: {
      attempts: Number(process.env.RESUME_ANALYSIS_JOB_ATTEMPTS || 2),
      backoff: {
        type: 'exponential',
        delay: Number(process.env.RESUME_ANALYSIS_JOB_BACKOFF_MS || 10000)
      },
      removeOnComplete: Number(process.env.RESUME_ANALYSIS_REMOVE_ON_COMPLETE || 200),
      removeOnFail: Number(process.env.RESUME_ANALYSIS_REMOVE_ON_FAIL || 500)
    }
  });

  return sharedQueue;
}

async function enqueueResumeAnalysis(candidateId, options = {}) {
  const normalizedCandidateId = Number(candidateId);
  if (!Number.isInteger(normalizedCandidateId) || normalizedCandidateId <= 0) {
    throw new Error(`无效的候选人ID，无法入队: ${candidateId}`);
  }

  const queue = getResumeAnalysisQueue();
  const jobId = `resume-analysis-${normalizedCandidateId}`;
  const existingJob = await queue.getJob(jobId);

  if (existingJob) {
    const state = await existingJob.getState().catch(() => 'unknown');
    if (state && !['completed', 'failed'].includes(state)) {
      return {
        enqueued: false,
        duplicate: true,
        jobId,
        state
      };
    }

    try {
      await existingJob.remove();
    } catch (_) {
    }
  }

  const job = await queue.add(
    'analyze',
    {
      candidateId: normalizedCandidateId,
      options
    },
    {
      jobId
    }
  );

  return {
    enqueued: true,
    duplicate: false,
    jobId: job.id
  };
}

async function closeResumeAnalysisQueue() {
  if (sharedQueue) {
    await sharedQueue.close();
    sharedQueue = null;
  }

  if (sharedConnection) {
    await sharedConnection.quit().catch(() => sharedConnection.disconnect());
    sharedConnection = null;
  }
}

module.exports = {
  RESUME_ANALYSIS_QUEUE_NAME,
  createRedisConnection,
  getResumeAnalysisQueue,
  enqueueResumeAnalysis,
  closeResumeAnalysisQueue
};