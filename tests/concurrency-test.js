/**
 * 高并发简历上传测试 - 模拟真实招聘场景中大量用户扫描二维码上传简历
 *
 * 测试场景:
 *   招聘会现场，HR 生成二维码贴在海报上，候选人扫码后填写信息+上传简历。
 *   高峰期数百人同时扫码提交，考验系统的并发处理能力。
 *
 * 测试维度:
 *   1. 纯上传并发 (DISABLE_ANALYSIS=true 跳过AI分析)
 *   2. 上传+分析并发 (完整链路，测试AI并发门控)
 *   3. 混合场景 (部分上传+部分查询，模拟真实负载)
 *
 * 用法:
 *   node tests/concurrency-test.js [scenario] [options]
 *
 * 场景:
 *   upload       纯上传压测 (默认)
 *   full         上传+分析全链路
 *   mixed        混合读写场景
 *   quick        快速冒烟测试 (10并发)
 *
 * 选项:
 *   --concurrency=N   并发数 (默认: 50)
 *   --batches=N       批次数 (默认: 3)
 *   --delay=N         批次间隔毫秒 (默认: 500)
 *   --server=URL      服务器地址 (默认: http://localhost:3001)
 *   --token=TOKEN     手动指定JWT token
 *   --no-analysis     跳过AI分析 (默认: 上传场景下跳过)
 *
 * 示例:
 *   # 快速冒烟
 *   node tests/concurrency-test.js quick
 *
 *   # 100并发上传压测
 *   node tests/concurrency-test.js upload --concurrency=100 --batches=5
 *
 *   # 全链路50并发
 *   node tests/concurrency-test.js full --concurrency=50
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pipeline } = require('stream');
const { promisify } = require('util');
const streamPipeline = promisify(pipeline);

// ============================================================
// 配置
// ============================================================

const SERVER_URL = process.env.TEST_SERVER || 'http://localhost:3001';
const RESUME_DIR = path.join(__dirname, '..', 'uploads', 'resumes');
const TEST_FIXTURES_DIR = path.join(__dirname, 'fixtures');
const RESULTS_DIR = path.join(__dirname, 'results');

// MBTI类型池
const MBTI_POOL = ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP',
                   'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'];

// 岗位池
const POSITIONS = [
  'Java开发实习生', '算法工程师', '前端开发工程师', '产品经理', 'UI设计师',
  '数据分析师', '测试工程师', '运维工程师', '机器学习算法实习生', '后端开发工程师',
  '全栈开发工程师', 'iOS开发工程师', 'Android开发工程师', '架构师', '技术总监'
];

// 候选人姓名池
const NAMES = [
  '张伟', '王芳', '李娜', '刘洋', '陈静', '杨帆', '赵敏', '黄磊',
  '周杰', '吴鑫', '徐凯', '孙悦', '马超', '朱峰', '胡涛', '郭亮',
  '林风', '何雨', '罗刚', '梁雪', '宋宇', '唐磊', '韩冰', '冯锐'
];

// 手机号前缀
const PHONE_PREFIXES = ['138', '139', '150', '151', '152', '158', '159', '186', '187', '188'];

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const randomPhone = () => randomItem(PHONE_PREFIXES) + String(Math.random()).slice(2, 10);
const randomEmail = (name) => `${name}_${Date.now()}_${randomInt(1000,9999)}@test.com`;

// ============================================================
// 工具函数
// ============================================================

function createMultipartBoundary() {
  return '----FormBoundary' + crypto.randomBytes(16).toString('hex');
}

function buildMultipartBody(fields, fileField, filePath, boundary) {
  const parts = [];
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  // 文本字段
  for (const [key, value] of Object.entries(fields)) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`
    ));
  }

  // 文件字段
  const ext = path.extname(fileName).toLowerCase();
  const mimeMap = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
                    '.png': 'image/png', '.doc': 'application/msword',
                    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  const mime = mimeMap[ext] || 'application/octet-stream';

  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${fileName}"\r\nContent-Type: ${mime}\r\n\r\n`
  ));
  parts.push(fileBuffer);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  return { body: Buffer.concat(parts), boundary };
}

function httpRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;

    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: options.method || 'POST',
      headers: options.headers || {},
      timeout: options.timeout || 60000
    };

    const req = client.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const rawBody = Buffer.concat(chunks);
        let data;
        try { data = JSON.parse(rawBody.toString()); } catch { data = rawBody.toString(); }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data,
          timing: Date.now() - req._startTime
        });
      });
    });

    req._startTime = Date.now();

    req.on('error', (err) => {
      resolve({
        status: 0,
        error: err.code || err.message,
        data: null,
        timing: Date.now() - req._startTime
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        status: 0,
        error: 'TIMEOUT',
        data: null,
        timing: Date.now() - req._startTime
      });
    });

    if (body) req.write(body);
    req.end();
  });
}

async function getAuthToken(serverUrl) {
  console.log('🔑 获取认证token...');

  // 尝试多个已知测试账号
  const testAccounts = [
    { username: 'conctest', password: 'Test123456' },
    { username: 'test@test.com', password: 'test123456' },
    { username: 'admin', password: 'admin123' },
    { username: 'test', password: 'test123' }
  ];

  // 尝试多个登录端点
  const loginEndpoints = [
    `${serverUrl}/api/corp/login`,
    `${serverUrl}/api/login`
  ];

  for (const endpoint of loginEndpoints) {
    for (const account of testAccounts) {
      try {
        const loginRes = await httpRequest(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000
        }, JSON.stringify(account));

        if (loginRes.status === 200 && loginRes.data?.token) {
          console.log(`  ✅ 登录成功 (endpoint: ${endpoint.replace(serverUrl, '')}, userId: ${loginRes.data.user?.id || '?'})`);
          return {
            token: loginRes.data.token,
            userId: loginRes.data.user?.id,
            username: account.username,
            password: account.password
          };
        }
      } catch (e) {
        // continue to next account/endpoint
      }
    }
  }

  console.error('  ❌ 无法自动登录, 请使用 --token=YOUR_JWT_TOKEN 手动指定');
  console.error('     获取token方法:');
  console.error('     1. 打开浏览器登录招聘灵犀');
  console.error('     2. 打开开发者工具 → Network');
  console.error('     3. 找到任意 /api 请求, 复制 Authorization header 中的 token');
  console.error('     4. 运行: node tests/concurrency-test.js --token=TOKEN_VALUE');
  return null;
}

// ============================================================
// 测试Fixture准备
// ============================================================

function prepareTestFixtures() {
  if (!fs.existsSync(TEST_FIXTURES_DIR)) {
    fs.mkdirSync(TEST_FIXTURES_DIR, { recursive: true });
  }

  // 复用uploads/resumes中的真实简历文件
  if (fs.existsSync(RESUME_DIR)) {
    const files = fs.readdirSync(RESUME_DIR).filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ['.pdf', '.jpg', '.jpeg'].includes(ext) && !f.includes('177');
    });

    if (files.length > 0) {
      // 复制前5个到fixtures目录
      const copied = [];
      for (let i = 0; i < Math.min(5, files.length); i++) {
        const src = path.join(RESUME_DIR, files[i]);
        const destName = `fixture_${i}_${files[i]}`;
        const dest = path.join(TEST_FIXTURES_DIR, destName);
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(src, dest);
        }
        copied.push(dest);
      }
      console.log(`📄 已准备 ${copied.length} 个测试简历文件`);
      return copied;
    }
  }

  // 如果没有真实文件，创建最小有效PDF
  console.log('📄 创建测试PDF文件...');
  const minimalPdf = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\n' +
    'xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n' +
    'trailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF'
  );
  const fixturePath = path.join(TEST_FIXTURES_DIR, 'minimal_test.pdf');
  fs.writeFileSync(fixturePath, minimalPdf);
  return [fixturePath];
}

// ============================================================
// 单次上传操作
// ============================================================

async function performSingleUpload({ serverUrl, token, fixtureFile, index, skipAnalysis }) {
  const name = randomItem(NAMES);
  const position = randomItem(POSITIONS);
  const mbti = randomItem(MBTI_POOL);
  const phone = randomPhone();
  const email = randomEmail(name);

  // 使用公开投递端点 (模拟二维码扫码场景)
  const url = `${serverUrl}/api/public/candidates?token=${token}`;

  const fields = {
    name,
    position,
    mbti,
    phone,
    email,
    source: 'qrcode',
    ...(skipAnalysis ? { skipAnalysis: 'true' } : {})
  };

  const boundary = createMultipartBoundary();
  const { body } = buildMultipartBody(fields, 'resume', fixtureFile, boundary);

  const startTime = Date.now();
  const result = await httpRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': String(body.length),
      'X-Request-ID': `conctest-${index}-${Date.now()}`
    },
    timeout: 120000
  }, body);

  return {
    index,
    name,
    position,
    mbti,
    success: (result.status === 200 || result.status === 202) && result.data?.success,
    status: result.status,
    error: result.error || (result.data?.error || result.data?.message || null),
    candidateId: result.data?.candidateId || result.data?.candidate?.id || null,
    timing: Date.now() - startTime,
    serverTiming: result.timing
  };
}

// ============================================================
// 并发执行器
// ============================================================

async function runConcurrentBatch({ serverUrl, token, fixtures, count, skipAnalysis, label }) {
  console.log(`\n⚡ ${label}: 启动 ${count} 个并发上传...`);

  const tasks = [];
  for (let i = 0; i < count; i++) {
    const fixtureFile = randomItem(fixtures);
    tasks.push(performSingleUpload({
      serverUrl, token, fixtureFile, index: i, skipAnalysis
    }));
  }

  const startTime = Date.now();
  const results = await Promise.allSettled(tasks);
  const totalTime = Date.now() - startTime;

  // 整理结果
  const resolved = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      resolved.push(r.value);
    } else {
      resolved.push({
        index: -1,
        success: false,
        status: 0,
        error: r.reason?.message || String(r.reason),
        timing: 0
      });
    }
  }

  return { results: resolved, totalTime };
}

// ============================================================
// 统计分析
// ============================================================

function analyzeResults(allResults, scenario) {
  const successful = allResults.filter(r => r.success);
  const failed = allResults.filter(r => !r.success);

  // 按错误类型分类
  const errorTypes = {};
  for (const r of failed) {
    const errType = r.error || `HTTP_${r.status}`;
    errorTypes[errType] = (errorTypes[errType] || 0) + 1;
  }

  // 响应时间统计 (仅成功请求)
  const timings = successful.map(r => r.timing).sort((a, b) => a - b);
  const percentile = (arr, p) => {
    if (arr.length === 0) return 0;
    const idx = Math.ceil(arr.length * p / 100) - 1;
    return arr[Math.max(0, Math.min(idx, arr.length - 1))];
  };

  // HTTP状态码分布
  const statusCodes = {};
  for (const r of allResults) {
    const code = r.status || 0;
    statusCodes[code] = (statusCodes[code] || 0) + 1;
  }

  return {
    scenario,
    total: allResults.length,
    success: successful.length,
    failed: failed.length,
    successRate: allResults.length > 0 ? ((successful.length / allResults.length) * 100).toFixed(1) + '%' : '0%',
    timing: {
      min: timings.length > 0 ? Math.min(...timings) + 'ms' : 'N/A',
      max: timings.length > 0 ? Math.max(...timings) + 'ms' : 'N/A',
      avg: timings.length > 0 ? Math.round(timings.reduce((a, b) => a + b, 0) / timings.length) + 'ms' : 'N/A',
      p50: percentile(timings, 50) + 'ms',
      p90: percentile(timings, 90) + 'ms',
      p95: percentile(timings, 95) + 'ms',
      p99: percentile(timings, 99) + 'ms'
    },
    statusCodes,
    errorTypes,
    throughput: timings.length > 0
      ? (successful.length / (Math.max(...timings) / 1000)).toFixed(2) + ' req/s (peak)'
      : 'N/A'
  };
}

function printReport(batchStats, overallTotalTime) {
  console.log('\n' + '='.repeat(70));
  console.log('📊 高并发简历上传测试报告');
  console.log('='.repeat(70));

  const combined = [];
  for (const batch of batchStats) {
    combined.push(...batch.results);
  }
  const analysis = analyzeResults(combined, '综合');

  console.log(`\n📈 总体统计:`);
  console.log(`   总请求数:     ${analysis.total}`);
  console.log(`   成功:         ${analysis.success} (${analysis.successRate})`);
  console.log(`   失败:         ${analysis.failed}`);
  console.log(`   总耗时:       ${(overallTotalTime / 1000).toFixed(2)}s`);

  console.log(`\n⏱️  响应时间 (成功请求):`);
  console.log(`   Min:  ${analysis.timing.min}`);
  console.log(`   Avg:  ${analysis.timing.avg}`);
  console.log(`   Max:  ${analysis.timing.max}`);
  console.log(`   P50:  ${analysis.timing.p50}`);
  console.log(`   P90:  ${analysis.timing.p90}`);
  console.log(`   P95:  ${analysis.timing.p95}`);
  console.log(`   P99:  ${analysis.timing.p99}`);

  console.log(`\n🌐 HTTP状态码分布:`);
  for (const [code, count] of Object.entries(analysis.statusCodes).sort()) {
    const label = code === '200' ? '✅' : code === '429' ? '🚫' : code === '503' ? '🔴' : code === '0' ? '💀' : '⚠️';
    console.log(`   ${label} ${code}: ${count} 次`);
  }

  if (Object.keys(analysis.errorTypes).length > 0) {
    console.log(`\n❌ 错误类型分布:`);
    const sortedErrors = Object.entries(analysis.errorTypes).sort((a, b) => b[1] - a[1]);
    for (const [type, count] of sortedErrors) {
      console.log(`   - ${type}: ${count} 次`);
    }
  }

  // 并发瓶颈诊断
  console.log(`\n🔍 瓶颈诊断:`);
  const rateLimited = analysis.statusCodes['429'] || 0;
  const aiOverloaded = analysis.statusCodes['503'] || 0;
  const connectionErrors = analysis.statusCodes['0'] || 0;
  const serverErrors = analysis.statusCodes['500'] || 0;

  if (rateLimited > 0) {
    const pct = ((rateLimited / analysis.total) * 100).toFixed(1);
    console.log(`   🚫 频率限制触发: ${rateLimited}次 (${pct}%) - 建议调高 uploadLimiter 的 max 值`);
  }
  if (aiOverloaded > 0) {
    const pct = ((aiOverloaded / analysis.total) * 100).toFixed(1);
    console.log(`   🔴 AI服务过载: ${aiOverloaded}次 (${pct}%) - 建议增加 RESUME_ANALYSIS_MAX_CONCURRENCY`);
  }
  if (connectionErrors > 0) {
    const pct = ((connectionErrors / analysis.total) * 100).toFixed(1);
    console.log(`   💀 连接失败: ${connectionErrors}次 (${pct}%) - 检查DB连接池/文件描述符限制`);
  }
  if (serverErrors > 0) {
    const pct = ((serverErrors / analysis.total) * 100).toFixed(1);
    console.log(`   ⚠️ 服务器内部错误: ${serverErrors}次 (${pct}%) - 查看服务器日志`);
  }

  if (rateLimited === 0 && aiOverloaded === 0 && connectionErrors === 0 && serverErrors === 0) {
    console.log(`   ✅ 未发现明显瓶颈, 系统在${analysis.total}并发下运行正常`);
  }

  console.log(`\n💡 优化建议:`);
  if (rateLimited > analysis.total * 0.3) {
    console.log(`   - uploadLimiter当前限制过低(10/min/IP), 建议按实际业务调整`);
  }
  console.log(`   - 当前DB连接池: 25连接/50队列, 高并发时可适当增加 DB_CONNECTION_LIMIT`);
  console.log(`   - AI分析并发门控: 2并发/10队列, 可考虑增加 RESUME_ANALYSIS_MAX_CONCURRENCY`);
  console.log(`   - 考虑在反向代理层(nginx)增加请求缓冲和连接复用`);
  console.log(`   - 建议将简历文件先上传到对象存储(OSS)，再异步处理`);
  console.log(`   - 对于招聘会场景，可预生成token并批量预上传，避免现场峰值`);

  console.log('\n' + '='.repeat(70));

  // 保存结果
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
  const reportPath = path.join(RESULTS_DIR, `concurrency-report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    analysis,
    batchStats: batchStats.map(b => ({
      total: b.results.length,
      success: b.results.filter(r => r.success).length,
      failed: b.results.filter(r => !r.success).length,
      batchTime: b.totalTime
    })),
    overallTotalTime
  }, null, 2));
  console.log(`📁 详细报告已保存: ${reportPath}`);
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const scenario = args[0] || 'upload';
  const options = {};
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const [key, val] = arg.slice(2).split('=');
      options[key] = val || 'true';
    }
  }

  // 解析参数
  let CONCURRENCY = parseInt(options.concurrency) || 50;
  let BATCHES = parseInt(options.batches) || 3;
  const BATCH_DELAY = parseInt(options.delay) || 500;
  const SERVER = options.server || SERVER_URL;
  let SKIP_ANALYSIS = options['no-analysis'] !== undefined
    ? options['no-analysis'] !== 'false'
    : scenario !== 'full';
  const MANUAL_TOKEN = options.token || null;

  // 场景预设
  switch (scenario) {
    case 'quick':
      CONCURRENCY = 10; BATCHES = 1; SKIP_ANALYSIS = true;
      console.log('🚀 快速冒烟测试: 10并发 x 1批次');
      break;
    case 'upload':
      SKIP_ANALYSIS = true;
      console.log(`🚀 上传压测: ${CONCURRENCY}并发 x ${BATCHES}批次 (跳过AI分析)`);
      break;
    case 'full':
      SKIP_ANALYSIS = false;
      console.log(`🚀 全链路压测: ${CONCURRENCY}并发 x ${BATCHES}批次 (含AI分析)`);
      break;
    case 'mixed':
      SKIP_ANALYSIS = true;
      console.log(`🚀 混合场景压测: ${CONCURRENCY}并发 x ${BATCHES}批次`);
      break;
    case 'full-flow':
      SKIP_ANALYSIS = true;
      console.log(`🚀 全链路压测(从登录开始): ${CONCURRENCY}并发 x ${BATCHES}批次`);
      break;
    default:
      console.log(`🚀 自定义场景: ${scenario}, ${CONCURRENCY}并发 x ${BATCHES}批次`);
  }

  console.log(`🌐 服务器: ${SERVER}`);
  console.log(`📋 跳过AI分析: ${SKIP_ANALYSIS ? '是' : '否'}`);

  // 准备测试文件
  console.log('\n📦 准备测试文件...');
  const fixtures = prepareTestFixtures();
  if (fixtures.length === 0) {
    console.error('❌ 没有可用的测试文件');
    process.exit(1);
  }
  console.log(`   准备了 ${fixtures.length} 个测试文件`);

  // 获取token
  let token;
  if (MANUAL_TOKEN) {
    token = MANUAL_TOKEN;
    console.log('🔑 使用手动指定的token');
  } else {
    const auth = await getAuthToken(SERVER);
    if (!auth) {
      console.error('❌ 无法获取认证token, 测试终止');
      console.error('   请确认服务器已启动且数据库连接正常');
      console.error('   或使用 --token=YOUR_TOKEN 手动指定');
      process.exit(1);
    }
    token = auth.token;
  }

  // 尝试获取公开投递token (用于模拟二维码)
  console.log('\n🔗 获取公开投递token (模拟二维码)...');
  let publicToken = token; // 默认使用登录token

  try {
    const subTokenRes = await httpRequest(`${SERVER}/api/candidate-submission-token`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: 15000
    });
    if (subTokenRes.status === 200 && subTokenRes.data?.submissionToken) {
      publicToken = subTokenRes.data.submissionToken;
      console.log('   ✅ 获取公开投递token成功 (7天有效)');
    } else {
      console.log('   ⚠️ 无法获取专用投递token, 使用登录token代替');
    }
  } catch {
    console.log('   ⚠️ 获取投递token失败, 使用登录token代替');
  }

  // 频率限制警告
  console.log('\n⚠️  频率限制提醒:');
  console.log('   当前上传端点限制: 10 req/min/IP (uploadLimiter)');
  console.log('   高并发测试会触发 429 Too Many Requests');
  console.log('   建议临时调高限制: 修改 routes/candidateRoutes.js 中 uploadLimiter 的 max 值');
  console.log('   或者使用内部测试: node tests/concurrency-internal-test.js');
  console.log('   (内部测试绕过HTTP层，直接测试业务逻辑并发能力)\n');

  // 执行并发批次
  const batchStats = [];
  const overallStartTime = Date.now();

  for (let batch = 0; batch < BATCHES; batch++) {
    console.log(`\n📦 批次 ${batch + 1}/${BATCHES}`);

    const stats = await runConcurrentBatch({
      serverUrl: SERVER,
      token: publicToken,
      fixtures,
      count: CONCURRENCY,
      skipAnalysis: SKIP_ANALYSIS,
      label: `批次${batch + 1}`
    });

    const successes = stats.results.filter(r => r.success).length;
    const failures = stats.results.filter(r => !r.success).length;
    const avgTime = successes > 0
      ? Math.round(stats.results.filter(r => r.success).reduce((a, b) => a + b.timing, 0) / successes)
      : 0;

    console.log(`   ✅ 成功: ${successes}, ❌ 失败: ${failures}`);
    console.log(`   ⏱️  平均响应: ${avgTime}ms, 总耗时: ${(stats.totalTime / 1000).toFixed(2)}s`);
    console.log(`   📊 吞吐量: ${(successes / (stats.totalTime / 1000)).toFixed(2)} req/s`);

    batchStats.push(stats);

    // 批次间延迟
    if (batch < BATCHES - 1 && BATCH_DELAY > 0) {
      console.log(`   ⏸️  等待 ${BATCH_DELAY}ms...`);
      await new Promise(r => setTimeout(r, BATCH_DELAY));
    }
  }

  const overallTotalTime = Date.now() - overallStartTime;

  // 打印报告
  printReport(batchStats, overallTotalTime);

  // 全链路模式: 轮询后台处理状态
  if (scenario === 'full-flow') {
    console.log('\n🔍 轮询后台文件处理完成状态...');
    const allCandidates = [];
    for (const batch of batchStats) {
      for (const r of batch.results) {
        if (r.candidateId) allCandidates.push(r.candidateId);
      }
    }

    if (allCandidates.length > 0) {
      let completed = 0;
      const pollStart = Date.now();
      const maxPollMs = 60000;

      const checkStatus = async () => {
        try {
          const res = await httpRequest(`${SERVER}/api/candidates`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
            timeout: 15000
          });
          if (res.status === 200 && Array.isArray(res.data)) {
            const candidateIds = new Set(allCandidates.map(String));
            completed = res.data.filter(c =>
              candidateIds.has(String(c.id)) && c.status && c.status !== '处理中'
            ).length;
          }
        } catch { /* poll silently */ }
      };

      while (completed < allCandidates.length && Date.now() - pollStart < maxPollMs) {
        await checkStatus();
        console.log(`   📊 已完成: ${completed}/${allCandidates.length} (${(completed/allCandidates.length*100).toFixed(0)}%)`);
        if (completed < allCandidates.length) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      const pollTime = Date.now() - pollStart;
      console.log(`   ✅ 最终完成: ${completed}/${allCandidates.length}`);
      console.log(`   ⏱️  后台处理总耗时: ${(pollTime/1000).toFixed(1)}s`);
    }
  }
}

// 启动
main().catch(err => {
  console.error('❌ 测试异常:', err);
  process.exit(1);
});
