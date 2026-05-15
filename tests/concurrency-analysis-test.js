/**
 * AI简历分析高并发测试
 *
 * 使用 uploads/resumes/ 中的真实简历文件，对 DeepSeek API 进行并发分析压测。
 * 测试绕过HTTP层，直接调用 resumeAnalysisService，聚焦 AI API 的并发表现。
 *
 * 用法:
 *   node tests/concurrency-analysis-test.js [options]
 *
 * 选项:
 *   --concurrency=N   并发数 (默认: 5)
 *   --mode=MODE       分析模式: deepseek | text | full (默认: deepseek)
 *   --files=N         使用的简历文件数 (默认: 5，从 uploads/resumes 选择)
 *
 * 示例:
 *   # 5并发 DeepSeek 文本分析
 *   node tests/concurrency-analysis-test.js --concurrency=5
 *
 *   # 10并发全链路分析
 *   node tests/concurrency-analysis-test.js --concurrency=10 --mode=full
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config();

const RESUME_DIR = path.join(__dirname, '..', 'uploads', 'resumes');
const { resumeAnalysisService } = require('../services/resume');

// ============================================================
// Prepare test fixtures
// ============================================================

function collectResumeFiles(dir, count) {
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir)
    .filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ['.pdf', '.jpg', '.jpeg'].includes(ext) && !f.includes('177');
    })
    .slice(0, count)
    .map(f => ({
      name: f,
      path: path.join(dir, f),
      ext: path.extname(f).toLowerCase()
    }));

  return files;
}

function extractNamePosition(fileName) {
  // Format: {name}_{position}_{mbti}.ext
  const base = path.basename(fileName, path.extname(fileName));
  const parts = base.split('_');
  const mbtiIdx = parts.findIndex(p => ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP',
    'ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'].includes(p));
  if (mbtiIdx > 0) {
    return {
      name: parts.slice(0, mbtiIdx).join('_'),
      position: parts[mbtiIdx] || '未知岗位',
      mbti: parts[mbtiIdx] || 'INTJ'
    };
  }
  return { name: base, position: '未定岗位', mbti: 'INTJ' };
}

// ============================================================
// Analysis functions
// ============================================================

async function analyzeWithDeepSeek(fileInfo) {
  const buffer = fs.readFileSync(fileInfo.path);
  const info = extractNamePosition(fileInfo.name);
  const start = Date.now();
  try {
    const result = await resumeAnalysisService.analyzeWithDeepSeek(
      buffer, fileInfo.ext, info.position,
      {
        originalName: fileInfo.name,
        mbti: info.mbti,
        candidateProfile: { mbti: info.mbti, name: info.name, position: info.position }
      }
    );
    return {
      file: fileInfo.name,
      success: result.parseStatus === 'SUCCESS' || result.parseStatus === 'PARTIAL_SUCCESS',
      parseStatus: result.parseStatus,
      totalScore: result.totalScore || (result.scores?.resumeScore || 0),
      timing: Date.now() - start,
      error: null
    };
  } catch (err) {
    return {
      file: fileInfo.name,
      success: false,
      parseStatus: 'ERROR',
      totalScore: 0,
      timing: Date.now() - start,
      error: err.message?.slice(0, 100)
    };
  }
}

async function analyzeWithLocalVL(fileInfo) {
  const buffer = fs.readFileSync(fileInfo.path);
  const info = extractNamePosition(fileInfo.name);
  const start = Date.now();
  try {
    const result = await resumeAnalysisService.analyzeWithLocalVL(
      buffer, fileInfo.ext, info.position,
      {
        originalName: fileInfo.name,
        mbti: info.mbti,
        candidateProfile: { mbti: info.mbti, name: info.name, position: info.position },
        timeoutMs: 120000
      }
    );
    return {
      file: fileInfo.name,
      success: result.parseStatus === 'SUCCESS' || result.parseStatus === 'PARTIAL_SUCCESS',
      parseStatus: result.parseStatus,
      totalScore: result.totalScore || (result.scores?.resumeScore || 0),
      timing: Date.now() - start,
      error: null
    };
  } catch (err) {
    return {
      file: fileInfo.name,
      success: false,
      parseStatus: 'ERROR',
      totalScore: 0,
      timing: Date.now() - start,
      error: err.message?.slice(0, 120)
    };
  }
}

// ============================================================
// Concurrency runner
// ============================================================

async function runConcurrentAnalysis({ files, concurrency, mode }) {
  const analyzeFn = mode === 'local-vl' ? analyzeWithLocalVL : analyzeWithDeepSeek;
  console.log(`\n⚡ 启动 ${concurrency} 个并发 ${mode} 分析...`);
  console.log(`   使用 ${files.length} 个真实简历文件\n`);

  const tasks = [];
  for (let i = 0; i < concurrency; i++) {
    const fileInfo = files[i % files.length];
    tasks.push(analyzeFn(fileInfo).then(result => {
      const icon = result.success ? '✅' : '❌';
      console.log(`  ${icon} [${i+1}/${concurrency}] ${result.file} | ${result.parseStatus} | ${result.totalScore}分 | ${(result.timing/1000).toFixed(1)}s`);
      return result;
    }));
  }

  const start = Date.now();
  const results = await Promise.allSettled(tasks);
  const totalTime = Date.now() - start;

  const resolved = results.map(r =>
    r.status === 'fulfilled' ? r.value :
    { file: '?', success: false, parseStatus: 'CRASH', totalScore: 0, timing: 0, error: r.reason?.message?.slice(0, 80) }
  );

  return { results: resolved, totalTime };
}

// ============================================================
// Statistics
// ============================================================

function printReport(allResults, totalTime, options) {
  console.log('\n' + '='.repeat(70));
  console.log('📊 AI 简历分析高并发测试报告');
  console.log('='.repeat(70));

  const success = allResults.filter(r => r.success);
  const failed = allResults.filter(r => !r.success);
  const timings = success.map(r => r.timing).sort((a, b) => a - b);
  const p = (arr, pct) => arr.length > 0
    ? arr[Math.max(0, Math.min(Math.ceil(arr.length * pct / 100) - 1, arr.length - 1))]
    : 0;

  console.log(`\n📈 总体统计:`);
  console.log(`   模式:         ${options.mode}`);
  console.log(`   总请求数:     ${allResults.length}`);
  console.log(`   成功:         ${success.length} (${(success.length/allResults.length*100).toFixed(1)}%)`);
  console.log(`   失败:         ${failed.length}`);
  console.log(`   总耗时:       ${(totalTime/1000).toFixed(1)}s`);

  console.log(`\n⏱️  DeepSeek API 响应延迟:`);
  console.log(`   Min:  ${timings.length > 0 ? (Math.min(...timings)/1000).toFixed(1) : 0}s`);
  console.log(`   Avg:  ${timings.length > 0 ? (Math.round(timings.reduce((a,b)=>a+b,0)/timings.length)/1000).toFixed(1) : 0}s`);
  console.log(`   Max:  ${timings.length > 0 ? (Math.max(...timings)/1000).toFixed(1) : 0}s`);
  console.log(`   P50:  ${(p(timings, 50)/1000).toFixed(1)}s`);
  console.log(`   P90:  ${(p(timings, 90)/1000).toFixed(1)}s`);
  console.log(`   P95:  ${(p(timings, 95)/1000).toFixed(1)}s`);
  console.log(`   P99:  ${(p(timings, 99)/1000).toFixed(1)}s`);

  console.log(`\n📊 吞吐量: ${(allResults.length/(totalTime/1000)).toFixed(2)} req/s`);

  if (failed.length > 0) {
    console.log(`\n❌ 失败详情:`);
    const errors = {};
    for (const r of failed) {
      const key = r.error || r.parseStatus || 'unknown';
      errors[key] = (errors[key] || 0) + 1;
    }
    for (const [err, count] of Object.entries(errors).sort((a,b) => b[1]-a[1])) {
      console.log(`   - ${err}: ${count} 次`);
    }
  }

  // Score distribution
  const scores = success.map(r => r.totalScore);
  if (scores.length > 0) {
    console.log(`\n📊 评分分布:`);
    console.log(`   平均分: ${Math.round(scores.reduce((a,b)=>a+b,0)/scores.length)}`);
    console.log(`   最低分: ${Math.min(...scores)}`);
    console.log(`   最高分: ${Math.max(...scores)}`);
  }

  console.log('\n' + '='.repeat(70));
}

// ============================================================
// Main
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

  const CONCURRENCY = parseInt(options.concurrency) || 5;
  const MODE = options.mode || 'deepseek';
  const FILE_COUNT = parseInt(options.files) || 5;

  console.log('='.repeat(70));
  console.log('🔬 AI 简历分析高并发测试');
  console.log('='.repeat(70));
  console.log(`   并发数:     ${CONCURRENCY}`);
  console.log(`   模式:       ${MODE}`);
  console.log(`   API 地址:   ${process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'}`);
  console.log(`   模型:       ${process.env.DEEPSEEK_MODEL || 'deepseek-chat'}`);
  console.log(`   文件数:     ${FILE_COUNT}`);
  console.log('='.repeat(70));

  // Validate API key
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('\n❌ DEEPSEEK_API_KEY 未配置，请在 .env 中设置');
    process.exit(1);
  }

  // Collect test files
  const files = collectResumeFiles(RESUME_DIR, FILE_COUNT);
  if (files.length === 0) {
    console.error(`\n❌ 未找到简历文件: ${RESUME_DIR}`);
    process.exit(1);
  }
  console.log(`\n📄 测试文件:`);
  files.forEach(f => console.log(`   - ${f.name} (${f.ext})`));

  // Run analysis
  const { results, totalTime } = await runConcurrentAnalysis({
    files, concurrency: CONCURRENCY, mode: MODE
  });

  // Report
  printReport(results, totalTime, { ...options, mode: MODE });
}

main().catch(err => {
  console.error('❌ 测试异常:', err);
  process.exit(1);
});
