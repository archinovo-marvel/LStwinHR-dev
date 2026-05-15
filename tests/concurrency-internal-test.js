/**
 * 内部并发测试 - 直接调用业务逻辑层，绕过HTTP频率限制
 *
 * 目的: 测试核心业务逻辑在高并发下的表现，排除HTTP层干扰
 * 场景: 模拟招聘会现场大量简历同时提交时，数据库层和文件系统层的表现
 *
 * 用法:
 *   node tests/concurrency-internal-test.js [options]
 *
 * 选项:
 *   --concurrency=N   并发数 (默认: 100)
 *   --user=N          使用N个不同用户 (默认: 5, 模拟多HR同时收简历)
 *   --no-analysis     跳过AI分析
 *
 * 前置条件: 需要有效的数据库连接和.env配置
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config();

// 设置测试环境变量
process.env.NODE_ENV = 'test';

const { pool, testConnection } = require('../db');
const {
  generateCandidateId,
  ensureCandidateDatabase,
  upsertCandidateForUser,
  listCandidatesForUser
} = require('../services/candidateStore');

const RESUME_DIR = path.join(__dirname, '..', 'uploads', 'resumes');
const MBTI_POOL = ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP',
                   'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'];
const POSITIONS = ['Java开发实习生', '算法工程师', '前端开发工程师', '产品经理',
                   '数据分析师', '测试工程师', '机器学习算法实习生', '后端开发工程师'];
const NAMES = ['张伟','王芳','李娜','刘洋','陈静','杨帆','赵敏','黄磊',
               '周杰','吴鑫','徐凯','孙悦','马超','朱峰','胡涛','郭亮'];
const PHONE_PREFIXES = ['138','139','150','151','152','158','159','186','187','188'];

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomPhone = () => randomItem(PHONE_PREFIXES) + String(Math.random()).slice(2, 10);

// ============================================================
// 数据库准备 - 创建测试用户
// ============================================================

async function createTestUsers(count) {
  console.log(`\n📋 创建 ${count} 个测试用户...`);
  const users = [];

  for (let i = 0; i < count; i++) {
    const userId = 900000 + i; // 使用高端ID避免与真实用户冲突

    try {
      // 确保候选人数据库表存在（仅需DB表，不需要auth表）
      await ensureCandidateDatabase(userId);
      users.push({
        id: userId,
        username: `测试员${i}`,
        email: `loadtest_${i}@test.internal`
      });
      console.log(`   ✅ 用户 ${userId} 就绪 (DB表已初始化)`);
    } catch (err) {
      console.error(`   ❌ 用户 ${userId} 初始化失败:`, err.message);
    }
  }

  return users;
}

// ============================================================
// 准备测试简历文件
// ============================================================

function prepareResumeBuffer() {
  // 尝试复用已有文件
  if (fs.existsSync(RESUME_DIR)) {
    const files = fs.readdirSync(RESUME_DIR).filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ['.pdf', '.jpg', '.jpeg'].includes(ext);
    });
    if (files.length > 0) {
      const filePath = path.join(RESUME_DIR, files[0]);
      console.log(`📄 使用已有简历文件: ${files[0]}`);
      return fs.readFileSync(filePath);
    }
  }

  // 创建最小PDF
  console.log('📄 创建最小测试PDF');
  return Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\n' +
    'xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n' +
    'trailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF'
  );
}

// ============================================================
// 核心: 直接调用业务逻辑的并发测试
// ============================================================

async function performDirectSubmit({ user, resumeBuffer, index, skipAnalysis }) {
  const name = randomItem(NAMES) + '_' + index;
  const position = randomItem(POSITIONS);
  const mbti = randomItem(MBTI_POOL);
  const phone = randomPhone();
  const email = `test${index}_${Date.now()}@test.com`;
  const candidateId = generateCandidateId();

  const candidate = {
    ...{ name, position, mbti, phone, email },
    id: candidateId,
    ownerUserId: user.id,
    ownerUserName: user.username,
    ownerUserEmail: user.email,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resumeFileBuffer: resumeBuffer,
    resumeFileName: `${name}_${position}_${mbti}.pdf`,
    resumeOriginalName: `${name}_${position}_${mbti}.pdf`,
    resumeFilePath: null,
    matchScore: 60,
    mbtiScore: 75,
    resumeScore: 0,
    resumeAnalysis: skipAnalysis ? null : {
      parseStatus: 'PENDING', summary: '排队中', totalScore: 0,
      dimensionScores: {}, strengths: [], risks: [],
      suggestions: ['请稍候查看结果'], extractedContent: {}, evidences: []
    },
    recommendation: skipAnalysis ? '待分析' : '简历分析排队中',
    hasInterview: false,
    status: skipAnalysis ? '已提交' : '分析中',
    resumeSize: String(resumeBuffer.length)
  };

  return upsertCandidateForUser(user.id, candidate);
}

async function runConcurrentSubmit({ users, resumeBuffer, concurrency, skipAnalysis }) {
  console.log(`\n⚡ 启动 ${concurrency} 个并发提交...`);

  const tasks = [];
  for (let i = 0; i < concurrency; i++) {
    const user = randomItem(users);
    tasks.push((async () => {
      const startTime = Date.now();
      try {
        await performDirectSubmit({
          user, resumeBuffer, index: i, skipAnalysis
        });
        return { index: i, success: true, timing: Date.now() - startTime };
      } catch (err) {
        return {
          index: i, success: false,
          error: err.code || err.message?.slice(0, 80),
          timing: Date.now() - startTime
        };
      }
    })());
  }

  const startTime = Date.now();
  const results = await Promise.allSettled(tasks);
  const totalTime = Date.now() - startTime;

  const resolved = results.map(r => r.status === 'fulfilled' ? r.value : {
    index: -1, success: false, error: r.reason?.message?.slice(0, 80), timing: 0
  });

  return { results: resolved, totalTime };
}

// ============================================================
// 分析 & 报告
// ============================================================

function analyzeAndPrint(batchResults, overallTime, options) {
  console.log('\n' + '='.repeat(70));
  console.log('📊 内部并发测试报告 (绕过HTTP层)');
  console.log('='.repeat(70));

  const all = [];
  for (const batch of batchResults) all.push(...batch.results);

  const success = all.filter(r => r.success);
  const failed = all.filter(r => !r.success);

  const timings = success.map(r => r.timing).sort((a, b) => a - b);
  const p = (arr, pct) => arr.length > 0
    ? arr[Math.max(0, Math.min(Math.ceil(arr.length * pct / 100) - 1, arr.length - 1))]
    : 0;

  console.log(`\n📈 总体统计:`);
  console.log(`   总提交数:   ${all.length}`);
  console.log(`   成功:       ${success.length} (${(success.length/all.length*100).toFixed(1)}%)`);
  console.log(`   失败:       ${failed.length}`);
  console.log(`   总耗时:     ${(overallTime / 1000).toFixed(2)}s`);

  console.log(`\n⏱️  DB写入延迟 (upsertCandidateForUser):`);
  console.log(`   Min:  ${timings.length > 0 ? Math.min(...timings) : 0}ms`);
  console.log(`   Avg:  ${timings.length > 0 ? Math.round(timings.reduce((a,b)=>a+b,0)/timings.length) : 0}ms`);
  console.log(`   Max:  ${timings.length > 0 ? Math.max(...timings) : 0}ms`);
  console.log(`   P50:  ${p(timings, 50)}ms`);
  console.log(`   P90:  ${p(timings, 90)}ms`);
  console.log(`   P95:  ${p(timings, 95)}ms`);
  console.log(`   P99:  ${p(timings, 99)}ms`);

  console.log(`\n📊 吞吐量:`);
  console.log(`   总吞吐:  ${(all.length / (overallTime / 1000)).toFixed(2)} req/s`);
  if (batchResults.length > 1) {
    for (let i = 0; i < batchResults.length; i++) {
      const batch = batchResults[i];
      console.log(`   批次${i+1}: ${(batch.results.length / (batch.totalTime / 1000)).toFixed(2)} req/s (${(batch.totalTime/1000).toFixed(2)}s)`);
    }
  }

  if (failed.length > 0) {
    console.log(`\n❌ 错误分布:`);
    const errors = {};
    for (const r of failed) {
      const key = r.error || 'unknown';
      errors[key] = (errors[key] || 0) + 1;
    }
    for (const [err, count] of Object.entries(errors).sort((a,b) => b[1]-a[1])) {
      console.log(`   - ${err}: ${count} 次`);
    }
  }

  // 瓶颈分析
  console.log(`\n🔍 瓶颈分析:`);
  const avgTiming = timings.length > 0 ? Math.round(timings.reduce((a,b)=>a+b,0)/timings.length) : 0;
  const p99 = p(timings, 99);

  if (p99 > 5000) {
    console.log(`   🔴 P99延迟 ${p99}ms 过高 — DB连接池可能耗尽`);
    console.log(`   建议: 增大 DB_CONNECTION_LIMIT (当前25), 或启用连接复用`);
  } else if (p99 > 2000) {
    console.log(`   🟡 P99延迟 ${p99}ms 偏高 — 高并发下DB写入有排队`);
    console.log(`   建议: 考虑使用批量INSERT或消息队列缓冲写入`);
  } else {
    console.log(`   🟢 P99延迟 ${p99}ms 表现良好`);
  }

  if (avgTiming > 1000) {
    console.log(`   🟡 平均延迟 ${avgTiming}ms 偏高`);
    console.log(`   建议: 检查MySQL的innodb_buffer_pool_size和磁盘I/O`);
  }

  console.log(`\n💡 系统调优建议:`);
  console.log(`   - DB连接池: 当前限制约25连接, 高峰期建议50-100`);
  console.log(`   - MySQL: SET GLOBAL max_connections=200; (默认151可能不够)`);
  console.log(`   - MySQL: innodb_flush_log_at_trx_commit=2 (高并发下可牺牲部分持久性)`);
  console.log(`   - 文件系统: 确保uploads目录在SSD上`);
  console.log(`   - Node.js: UV_THREADPOOL_SIZE=128 (增大libuv线程池用于文件I/O)`);
  console.log(`   - 架构: 高并发场景建议引入消息队列解耦上传和持久化`);

  console.log('\n' + '='.repeat(70));
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const options = {};
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, val] = arg.slice(2).split('=');
      options[key] = val || 'true';
    }
  }

  const CONCURRENCY = parseInt(options.concurrency) || 100;
  const USER_COUNT = parseInt(options.user) || 5;
  const SKIP_ANALYSIS = options['no-analysis'] !== 'false';
  const BATCHES = parseInt(options.batches) || 1;
  const BATCH_DELAY = parseInt(options.delay) || 300;

  console.log('='.repeat(70));
  console.log('🔬 内部并发测试 — 直接测试业务逻辑层');
  console.log('='.repeat(70));
  console.log(`   并发数:       ${CONCURRENCY}`);
  console.log(`   用户数:       ${USER_COUNT} (模拟${USER_COUNT}个HR同时收简历)`);
  console.log(`   批次数:       ${BATCHES}`);
  console.log(`   AI分析:       ${SKIP_ANALYSIS ? '跳过' : '包含'}`);
  console.log(`   DB连接池:     ${process.env.DB_CONNECTION_LIMIT || 25}`);
  console.log(`   Resolve分析:  ${process.env.RESUME_ANALYSIS_MAX_CONCURRENCY || 2}并发`);
  console.log('='.repeat(70));

  // 1. 测试数据库连接
  console.log('\n🔌 检查数据库连接...');
  const dbOk = await testConnection();
  if (!dbOk) {
    console.error('❌ 数据库连接失败, 请检查配置');
    process.exit(1);
  }

  // 2. 创建测试用户
  const users = await createTestUsers(USER_COUNT);

  // 3. 准备简历文件
  const resumeBuffer = prepareResumeBuffer();
  console.log(`   简历文件大小: ${(resumeBuffer.length / 1024).toFixed(1)} KB`);

  // 4. 执行并发测试
  const batchResults = [];
  const overallStart = Date.now();

  for (let batch = 0; batch < BATCHES; batch++) {
    console.log(`\n📦 批次 ${batch + 1}/${BATCHES}`);

    const stats = await runConcurrentSubmit({
      users, resumeBuffer,
      concurrency: CONCURRENCY,
      skipAnalysis: SKIP_ANALYSIS
    });

    console.log(`   ✅ ${stats.results.filter(r=>r.success).length} | ❌ ${stats.results.filter(r=>!r.success).length}`);
    console.log(`   ⏱️ 批次耗时: ${(stats.totalTime/1000).toFixed(2)}s`);
    batchResults.push(stats);

    if (batch < BATCHES - 1 && BATCH_DELAY > 0) {
      await new Promise(r => setTimeout(r, BATCH_DELAY));
    }
  }

  const overallTime = Date.now() - overallStart;

  // 5. 分析报告
  analyzeAndPrint(batchResults, overallTime, options);

  // 6. 清理 (可选 — 默认不删除以便检查数据)
  console.log('\n🧹 提示: 测试数据未自动清理');
  console.log(`   测试用户ID范围: ${users[0].id} - ${users[users.length-1].id}`);
  console.log('   如需清理，请手动删除相关数据');

  // 关闭连接池
  await pool.end();
  console.log('🔌 数据库连接已关闭');
}

main().catch(err => {
  console.error('❌ 测试异常:', err);
  process.exit(1);
});
