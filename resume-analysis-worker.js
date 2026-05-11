'use strict';

require('dotenv').config();

const { Worker } = require('bullmq');
const {
  RESUME_ANALYSIS_QUEUE_NAME,
  createRedisConnection
} = require('./server/queues/resumeAnalysisQueue');
const { runResumeAnalysisInBackground } = require('./server/services/resumeAnalysis');

const workerConcurrency = Math.max(1, Number(process.env.RESUME_ANALYSIS_WORKER_CONCURRENCY || 1));
const redisConnection = createRedisConnection();

redisConnection.on('error', error => {
  console.error('[resume-analysis-worker] Redis连接异常:', error.message);
});

const worker = new Worker(
  RESUME_ANALYSIS_QUEUE_NAME,
  async job => {
    const candidateId = Number(job?.data?.candidateId);
    if (!Number.isInteger(candidateId) || candidateId <= 0) {
      throw new Error(`无效的简历分析任务candidateId: ${job?.data?.candidateId}`);
    }

    await runResumeAnalysisInBackground(candidateId, job?.data?.options || {});
  },
  {
    connection: redisConnection,
    concurrency: workerConcurrency
  }
);

worker.on('ready', () => {
  console.log(`[resume-analysis-worker] 已启动，队列=${RESUME_ANALYSIS_QUEUE_NAME}，并发=${workerConcurrency}`);
});

worker.on('completed', job => {
  console.log(`[resume-analysis-worker] 任务完成: ${job.id}`);
});

worker.on('failed', (job, error) => {
  console.error(`[resume-analysis-worker] 任务失败: ${job?.id || 'unknown'}`, error);
});

async function shutdown(signal) {
  console.log(`[resume-analysis-worker] 收到${signal}，正在关闭...`);
  try {
    await worker.close();
  } finally {
    await redisConnection.quit().catch(() => redisConnection.disconnect());
  }
  process.exit(0);
}

process.on('SIGINT', () => {
  shutdown('SIGINT').catch(error => {
    console.error('[resume-analysis-worker] SIGINT关闭失败:', error);
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM').catch(error => {
    console.error('[resume-analysis-worker] SIGTERM关闭失败:', error);
    process.exit(1);
  });
});