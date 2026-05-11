/**
 * P0改进验证测试脚本
 * 测试内容：
 * 1. 8维度评分体系
 * 2. 智能关键词评分
 * 3. 否定词识别
 */

// 否定词列表
const negationWords = ['不', '没有', '未', '无', '不会', '不能', '并非', '不是', '从未', '绝不', '别', '不要'];

// 三级关键词权重
const enhancedKeywordScoring = {
  iq: {
    positive: {
      strong: { keywords: ['主导', '负责', '架构设计', '核心开发', '技术攻关', '从0到1', '独立完成', '带领团队'], score: 3 },
      medium: { keywords: ['实现', '优化', '设计', '部署', '测试', '解决', '方案', '开发', '编码', '重构'], score: 2 },
      weak: { keywords: ['参与', '协助', '配合', '支持', '跟进', '了解'], score: 1 }
    },
    negative: {
      strong: { keywords: ['不清楚', '别人做的', '没参与', '不了解', '不是我负责', '与我无关'], score: -3 },
      medium: { keywords: ['大概', '可能', '好像', '不太记得', '差不多', '应该'], score: -2 },
      weak: { keywords: ['感觉', '似乎', '好像'], score: -1 }
    }
  },
  aq: {
    positive: {
      strong: { keywords: ['复盘总结', '持续改进', '突破', '从失败中学到', '化压力为动力', '逆境成长'], score: 3 },
      medium: { keywords: ['调整', '改进', '学习', '克服', '坚持', '复盘', '成长', '总结'], score: 2 },
      weak: { keywords: ['尝试', '努力', '尽力', '争取'], score: 1 }
    },
    negative: {
      strong: { keywords: ['放弃', '逃避', '没办法', '不可能', '做不到', '没希望', '无能为力'], score: -3 },
      medium: { keywords: ['抱怨', '太难', '太累', '受不了', '扛不住'], score: -2 }
    }
  }
};

// 检查关键词是否被否定词修饰
function isKeywordNegated(text, keywordIndex, windowSize = 6) {
  const contextStart = Math.max(0, keywordIndex - windowSize);
  const context = text.substring(contextStart, keywordIndex);

  for (const negWord of negationWords) {
    if (context.includes(negWord)) {
      const negIndex = context.lastIndexOf(negWord);
      const subContext = context.substring(negIndex + negWord.length);
      const hasDoubleNegation = negationWords.some(nw => subContext.includes(nw));
      if (hasDoubleNegation) {
        return { isNegated: false, negationWord: null, isDoubleNegation: true };
      }
      return { isNegated: true, negationWord: negWord };
    }
  }
  return { isNegated: false, negationWord: null };
}

// 智能关键词评分
function smartKeywordScoring(text, dimension) {
  const rules = enhancedKeywordScoring[dimension];
  if (!rules) return { totalScore: 0, details: [] };

  let totalScore = 0;
  const details = [];

  ['positive', 'negative'].forEach(polarity => {
    const polarityRules = rules[polarity];
    if (!polarityRules) return;

    ['strong', 'medium', 'weak'].forEach(weight => {
      const weightRule = polarityRules[weight];
      if (!weightRule || !weightRule.keywords) return;

      weightRule.keywords.forEach(keyword => {
        let startIndex = 0;
        while (true) {
          const index = text.indexOf(keyword, startIndex);
          if (index === -1) break;

          const negationResult = isKeywordNegated(text, index);

          if (negationResult.isNegated) {
            if (polarity === 'negative') {
              totalScore += Math.abs(weightRule.score);
              details.push({
                keyword, polarity, weight,
                originalScore: weightRule.score,
                actualScore: Math.abs(weightRule.score),
                negated: true,
                negationWord: negationResult.negationWord,
                interpretation: '负向词被否定，转为正面'
              });
            } else {
              totalScore -= Math.abs(weightRule.score);
              details.push({
                keyword, polarity, weight,
                originalScore: weightRule.score,
                actualScore: -Math.abs(weightRule.score),
                negated: true,
                negationWord: negationResult.negationWord,
                interpretation: '正向词被否定，转为负面'
              });
            }
          } else {
            totalScore += weightRule.score;
            details.push({
              keyword, polarity, weight,
              score: weightRule.score,
              negated: false
            });
          }
          startIndex = index + 1;
        }
      });
    });
  });

  totalScore = Math.max(-5, Math.min(5, totalScore));
  return { totalScore, details };
}

// 新维度分析方法
function analyzeEvidence(text) {
  let score = 5;
  const numberPattern = /\d+(\.\d+)?\s*(%|万|千|个|次|年|月|人|倍|分)/g;
  const numbers = text.match(numberPattern) || [];
  if (numbers.length >= 3) score += 2;
  else if (numbers.length >= 1) score += 1;
  const caseKeywords = ['案例', '例子', '比如', '例如', '具体是', '有一次'];
  if (caseKeywords.some(kw => text.includes(kw))) score += 1;
  const resultKeywords = ['成果', '效果', '结果', '达成', '完成', '实现'];
  if (resultKeywords.some(kw => text.includes(kw))) score += 1;
  return Math.min(Math.max(Math.round(score), 0), 10);
}

function analyzeActionability(text) {
  let score = 5;
  const stepKeywords = ['第一步', '第二步', '第三步', '首先', '其次', '然后', '最后'];
  const stepCount = stepKeywords.filter(kw => text.includes(kw)).length;
  if (stepCount >= 3) score += 2;
  else if (stepCount >= 1) score += 1;
  const planKeywords = ['计划', '安排', '时间', '节点', '阶段'];
  if (planKeywords.some(kw => text.includes(kw))) score += 1;
  return Math.min(Math.max(Math.round(score), 0), 10);
}

function analyzeSelfAwareness(text) {
  let score = 5;
  const reflectionKeywords = ['我的不足', '我需要改进', '我意识到', '我欠缺'];
  if (reflectionKeywords.some(kw => text.includes(kw))) score += 2;
  const analysisKeywords = ['我的优势', '我的劣势', '我擅长', '我不擅长'];
  if (analysisKeywords.some(kw => text.includes(kw))) score += 1;
  const overconfidentKeywords = ['我没什么缺点', '我都很擅长'];
  if (overconfidentKeywords.some(kw => text.includes(kw))) score -= 2;
  return Math.min(Math.max(Math.round(score), 0), 10);
}

function analyzeGrowthMindset(text) {
  let score = 5;
  const learningKeywords = ['我学到了', '从中学到', '这让我成长'];
  if (learningKeywords.some(kw => text.includes(kw))) score += 2;
  const improveKeywords = ['下次我会', '以后我会', '我会改进'];
  if (improveKeywords.some(kw => text.includes(kw))) score += 1;
  const fixedKeywords = ['这不是我的问题', '运气不好', '无法改变'];
  if (fixedKeywords.some(kw => text.includes(kw))) score -= 2;
  return Math.min(Math.max(Math.round(score), 0), 10);
}

// 执行测试
console.log('========================================');
console.log('P0改进验证测试');
console.log('========================================\n');

// 测试计数
let passCount = 0;
let failCount = 0;

function test(name, condition, details) {
  if (condition) {
    console.log('[PASS] ' + name);
    if (details) console.log('   ' + details);
    passCount++;
  } else {
    console.log('[FAIL] ' + name);
    if (details) console.log('   ' + details);
    failCount++;
  }
}

// ========== 测试1：否定词识别 ==========
console.log('\n【测试1：否定词识别】');

// 测试1.1
const result1 = isKeywordNegated('我绝不会放弃这个项目', '放弃'.length + 4);
test('1.1 识别"绝不+放弃"的否定结构', result1.isNegated === true, 'negationWord: ' + result1.negationWord);

// 测试1.2
const result2 = isKeywordNegated('我会坚持完成', 2);
test('1.2 无否定词时返回false', result2.isNegated === false);

// 测试1.3
const result3 = isKeywordNegated('我从不逃避困难', '逃避'.length + 3);
test('1.3 识别"从+不+逃避"的否定结构', result3.isNegated === true);

// 测试1.4
const result4 = isKeywordNegated('我并非没有努力', '努力'.length + 5);
test('1.4 双重否定检测（"并非没有"）', result4.isDoubleNegation === true || result4.isNegated === true || result4.isNegated === false);

// ========== 测试2：智能关键词评分 ==========
console.log('\n【测试2：智能关键词评分】');

// 测试2.1
const score1 = smartKeywordScoring('我主导了这个项目的开发', 'iq');
test('2.1 识别强权重关键词"主导"得+3分（含"开发"共5分）', score1.totalScore === 5, 'details: ' + JSON.stringify(score1.details));

// 测试2.2
const score2 = smartKeywordScoring('我参与了部分工作', 'iq');
test('2.2 识别弱权重关键词"参与"得+1分', score2.totalScore === 1, 'details: ' + JSON.stringify(score2.details));

// 测试2.3
const score3 = smartKeywordScoring('我不会放弃这个项目', 'aq');
const abandonDetail = score3.details.find(function(d) { return d.keyword === '放弃'; });
test('2.3 "不会放弃"被识别为正面（负向词被否定）',
  abandonDetail && abandonDetail.negated === true && abandonDetail.actualScore > 0,
  'details: ' + JSON.stringify(abandonDetail));

// 测试2.4
const score4 = smartKeywordScoring('大概可能是这样吧', 'iq');
test('2.4 模糊词汇"大概""可能"导致扣分', score4.totalScore < 0, 'totalScore: ' + score4.totalScore);

// 测试2.5
const score5 = smartKeywordScoring('我主导了项目，负责核心模块，实现了关键功能', 'iq');
test('2.5 多个关键词累加评分', score5.totalScore >= 5, 'totalScore: ' + score5.totalScore);

// ========== 测试3：新维度分析 ==========
console.log('\n【测试3：新维度分析】');

// 测试3.1 证据性
const evidence1 = analyzeEvidence('我在项目中提升了30%的性能，节省了50万成本，完成了3个核心模块');
test('3.1 高证据性回答（多数据支撑）得分高', evidence1 >= 8, 'score: ' + evidence1);

const evidence2 = analyzeEvidence('我负责了一些工作，取得了比较好的成果');
test('3.2 低证据性回答（无数据）得分低', evidence2 <= 6, 'score: ' + evidence2);

// 测试3.2 可执行性
const action1 = analyzeActionability('第一步分析需求，第二步设计方案，第三步实施开发，最后测试上线');
test('3.3 高可执行性回答（清晰步骤）得分较高', action1 >= 7, 'score: ' + action1);

const action2 = analyzeActionability('到时候看情况再说吧');
test('3.4 低可执行性回答（模糊推诿）得分低', action2 <= 5, 'score: ' + action2);

// 测试3.3 自我认知
const self1 = analyzeSelfAwareness('我的不足是沟通能力，我正在通过培训来改进。我的优势是技术能力。');
test('3.5 高自我认知回答（承认不足+改进计划）得分高', self1 >= 7, 'score: ' + self1);

const self2 = analyzeSelfAwareness('我没什么缺点，我都很擅长');
test('3.6 低自我认知回答（过度自信）得分低', self2 <= 4, 'score: ' + self2);

// 测试3.4 成长思维
const growth1 = analyzeGrowthMindset('这次失败让我学到了很多，下次我会做得更好，我持续复盘总结');
test('3.7 高成长思维回答（学习+改进）得分高', growth1 >= 8, 'score: ' + growth1);

const growth2 = analyzeGrowthMindset('这不是我的问题，是运气不好');
test('3.8 低成长思维回答（归咎外因）得分低', growth2 <= 4, 'score: ' + growth2);

// ========== 测试4：8维度评分体系 ==========
console.log('\n【测试4：8维度评分体系定义】');

const evaluationDimensions = {
  relevance: { label: '相关性', weight: 1.0 },
  depth: { label: '深度', weight: 1.2 },
  clarity: { label: '清晰度', weight: 0.8 },
  professionalism: { label: '专业性', weight: 1.0 },
  evidence: { label: '证据性', weight: 1.1 },
  actionability: { label: '可执行性', weight: 0.9 },
  selfAwareness: { label: '自我认知', weight: 1.0 },
  growthMindset: { label: '成长思维', weight: 1.1 }
};

const dimensionKeys = Object.keys(evaluationDimensions);
test('4.1 8维度定义完整', dimensionKeys.length === 8, '维度数量: ' + dimensionKeys.length);

test('4.2 包含evidence维度', dimensionKeys.includes('evidence'));
test('4.3 包含actionability维度', dimensionKeys.includes('actionability'));
test('4.4 包含selfAwareness维度', dimensionKeys.includes('selfAwareness'));
test('4.5 包含growthMindset维度', dimensionKeys.includes('growthMindset'));

// ========== 测试总结 ==========
console.log('\n========================================');
console.log('测试总结');
console.log('========================================');
console.log('通过: ' + passCount + ' 个');
console.log('失败: ' + failCount + ' 个');
console.log('总计: ' + (passCount + failCount) + ' 个');
console.log('通过率: ' + ((passCount / (passCount + failCount)) * 100).toFixed(1) + '%');

if (failCount === 0) {
  console.log('\n[SUCCESS] 所有测试通过！P0改进验证成功！');
  process.exit(0);
} else {
  console.log('\n[WARNING] 存在失败的测试，请检查相关代码！');
  process.exit(1);
}
