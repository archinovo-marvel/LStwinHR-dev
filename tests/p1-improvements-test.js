/**
 * P1改进验证测试脚本
 * 测试内容：
 * 1. 难度分级体系
 * 2. 岗位权重配置
 * 3. 负面回答检测机制
 */

// 模拟InterviewScoring类的核心功能
const difficultyLevels = {
  JUNIOR: {
    level: 1,
    name: '初级',
    nameEn: 'Junior',
    description: '实习生、应届生、初级工程师（0-2年经验）',
    questionCount: 8,
    scoringWeight: { iq: 0.40, eq: 0.25, aq: 0.20, mq: 0.15 }
  },
  MID_LEVEL: {
    level: 2,
    name: '中级',
    nameEn: 'Mid-level',
    description: '中级工程师、资深专员（2-5年经验）',
    questionCount: 10,
    scoringWeight: { iq: 0.50, eq: 0.20, aq: 0.18, mq: 0.12 }
  },
  SENIOR: {
    level: 3,
    name: '高级',
    nameEn: 'Senior',
    description: '高级工程师、技术专家、团队Lead（5-8年经验）',
    questionCount: 12,
    scoringWeight: { iq: 0.55, eq: 0.18, aq: 0.15, mq: 0.12 }
  },
  EXPERT: {
    level: 4,
    name: '专家',
    nameEn: 'Expert/Principal',
    description: '架构师、技术总监、部门负责人（8年以上经验）',
    questionCount: 12,
    scoringWeight: { iq: 0.50, eq: 0.20, aq: 0.15, mq: 0.15 }
  }
};

// 岗位关键词到难度等级的映射
const positionDifficultyMapping = {
  EXPERT: ['架构师', '总监', 'vp', '首席', 'principal', 'distinguished', 'fellow', '技术负责人', '部门负责人', 'cto', 'cio'],
  SENIOR: ['高级', '资深', 'senior', 'lead', '专家', 'principal', '技术经理', '团队负责人', 'tech lead'],
  MID_LEVEL: ['中级', 'mid', '工程师', 'developer', '程序员', '专员'],
  JUNIOR: ['初级', '实习', '应届', 'junior', 'intern', '助理', 'trainee']
};

// 岗位权重模板
const positionWeightTemplates = {
  tech_dev: { iq: 60, eq: 15, aq: 15, mq: 10, name: '技术研发岗', category: 'tech' },
  tech_frontend: { iq: 55, eq: 20, aq: 15, mq: 10, name: '前端开发岗', category: 'tech' },
  tech_backend: { iq: 60, eq: 15, aq: 15, mq: 10, name: '后端开发岗', category: 'tech' },
  tech_algorithm: { iq: 65, eq: 10, aq: 15, mq: 10, name: '算法工程师', category: 'tech' },
  tech_qa: { iq: 50, eq: 20, aq: 20, mq: 10, name: '测试工程师', category: 'tech' },
  product_manager: { iq: 40, eq: 30, aq: 20, mq: 10, name: '产品经理', category: 'product' },
  sales_rep: { iq: 30, eq: 40, aq: 20, mq: 10, name: '销售代表', category: 'sales' },
  sales_manager: { iq: 30, eq: 35, aq: 20, mq: 15, name: '销售经理', category: 'sales' },
  finance: { iq: 45, eq: 15, aq: 15, mq: 25, name: '财务会计', category: 'finance' },
  audit: { iq: 40, eq: 15, aq: 15, mq: 30, name: '审计专员', category: 'finance' },
  hr: { iq: 35, eq: 35, aq: 20, mq: 10, name: 'HR专员', category: 'hr' },
  default: { iq: 50, eq: 20, aq: 15, mq: 15, name: '通用岗位', category: 'general' }
};

// 岗位名称到权重模板的映射关键词
const positionWeightKeywords = {
  tech_dev: ['开发', '工程师', 'developer', 'engineer', '程序员', '研发'],
  tech_frontend: ['前端', 'frontend', 'react', 'vue', 'web开发', 'h5'],
  tech_backend: ['后端', 'backend', 'java', 'python', 'go', 'node', '服务端'],
  tech_algorithm: ['算法', 'algorithm', 'ai', '机器学习', '深度学习', 'nlp', 'cv'],
  product_manager: ['产品经理', 'product manager', 'pm', '产品设计'],
  sales_rep: ['销售', 'sales', '业务员', '销售代表', '销售专员'],
  sales_manager: ['销售经理', 'sales manager', '销售总监'],
  finance: ['财务', 'finance', '会计', 'accounting', '出纳'],
  audit: ['审计', 'audit', '内审'],
  hr: ['hr', '人事', '人力资源', '人力']
};

// 判断难度等级
function determineDifficultyLevel(positionName, experience) {
  const positionLower = (positionName || '').toLowerCase();

  // 1. 优先根据岗位名称关键词判断
  for (const [level, keywords] of Object.entries(positionDifficultyMapping)) {
    if (keywords.some(kw => positionLower.includes(kw.toLowerCase()))) {
      return { levelKey: level, ...difficultyLevels[level] };
    }
  }

  // 2. 根据工作年限判断
  if (experience) {
    const years = parseInt(String(experience).replace(/[^0-9]/g, '')) || 0;
    if (years >= 8) return { levelKey: 'EXPERT', ...difficultyLevels.EXPERT };
    if (years >= 5) return { levelKey: 'SENIOR', ...difficultyLevels.SENIOR };
    if (years >= 2) return { levelKey: 'MID_LEVEL', ...difficultyLevels.MID_LEVEL };
    return { levelKey: 'JUNIOR', ...difficultyLevels.JUNIOR };
  }

  // 3. 默认返回中级
  return { levelKey: 'MID_LEVEL', ...difficultyLevels.MID_LEVEL };
}

// 检测应届生
function detectFreshGraduate(resumeText) {
  if (!resumeText) return false;
  const text = resumeText.toLowerCase();

  const workIndicators = ['工作经历', '工作经验', '在职', '任职', '公司', '企业', '工作年限'];
  const hasWork = workIndicators.some(kw => text.includes(kw));

  const freshIndicators = ['应届', '实习', '校园', '学生', '毕业', '校园招聘', '校招'];
  const isFresh = freshIndicators.some(kw => text.includes(kw));

  return isFresh || !hasWork;
}

// 匹配岗位权重模板
function matchPositionWeightTemplate(positionName) {
  const positionLower = (positionName || '').toLowerCase();

  for (const [templateKey, keywords] of Object.entries(positionWeightKeywords)) {
    if (keywords.some(kw => positionLower.includes(kw.toLowerCase()))) {
      const template = positionWeightTemplates[templateKey];
      return { templateKey, ...template };
    }
  }

  return { templateKey: 'default', ...positionWeightTemplates.default };
}

// 验证权重配置
function validateWeights(weights) {
  if (!weights || typeof weights !== 'object') {
    return { valid: false, message: '权重配置不能为空' };
  }

  const { iq, eq, aq, mq } = weights;
  const dimensions = ['iq', 'eq', 'aq', 'mq'];

  for (const dim of dimensions) {
    if (typeof weights[dim] !== 'number' || isNaN(weights[dim])) {
      return { valid: false, message: '维度 ' + dim.toUpperCase() + ' 的权重无效' };
    }
    if (weights[dim] < 0 || weights[dim] > 100) {
      return { valid: false, message: '维度 ' + dim.toUpperCase() + ' 的权重必须在0-100之间' };
    }
  }

  const total = iq + eq + aq + mq;
  if (Math.abs(total - 100) > 0.1) {
    return { valid: false, message: '权重总和必须为100%，当前总和为 ' + total + '%' };
  }

  return { valid: true, message: '权重配置有效' };
}

// 检测套话回答
function detectClicheAnswer(answer) {
  const clichePhrases = [
    '性格开朗', '善于沟通', '工作认真', '责任心强', '团队精神',
    '学习能力', '积极向上', '吃苦耐劳', '踏实肯干', '有亲和力',
    '执行力强', '抗压能力强', '善于总结', '逻辑清晰', '思维敏捷'
  ];

  const matches = [];
  let clicheCount = 0;

  clichePhrases.forEach(phrase => {
    if (answer.includes(phrase)) {
      clicheCount++;
      matches.push(phrase);
    }
  });

  const answerLength = answer.length;
  const clicheDensity = clicheCount / Math.max(answerLength / 50, 1);

  let severity = 'none';
  if (clicheCount >= 3 && clicheDensity > 0.3) {
    severity = 'high';
  } else if (clicheCount >= 2 && clicheDensity > 0.2) {
    severity = 'medium';
  } else if (clicheCount >= 1) {
    severity = 'low';
  }

  return {
    detected: clicheCount >= 2,
    severity,
    details: { clicheCount, matchedPhrases: matches }
  };
}

// 检测回避性回答
function detectEvasiveAnswer(answer, question) {
  const evasivePhrases = [
    '这个情况比较复杂', '涉及到很多因素', '不太好说', '因人而异',
    '看具体情况', '很难一概而论', '需要具体分析', '取决于'
  ];
  const evasiveMatches = evasivePhrases.filter(phrase => answer.includes(phrase));

  const avoidanceIndex = evasiveMatches.length * 0.3;

  let severity = 'none';
  if (avoidanceIndex > 0.6) severity = 'high';
  else if (avoidanceIndex > 0.3) severity = 'medium';
  else if (avoidanceIndex > 0) severity = 'low';

  return {
    detected: avoidanceIndex > 0.3,
    severity,
    details: { evasivePhrases: evasiveMatches, avoidanceIndex }
  };
}

// 检测过度包装
function detectOverPackaging(answer) {
  const strongClaimWords = ['主导', '负责', '核心', '关键', '唯一', '首创', '独立', '完全'];
  const perfectOutcomeWords = ['完美', '零缺陷', '100%', '全部', '完全', '没有任何问题'];

  let strongClaimCount = 0;
  strongClaimWords.forEach(word => {
    const regex = new RegExp(word, 'g');
    const matches = answer.match(regex);
    if (matches) strongClaimCount += matches.length;
  });

  let perfectCount = 0;
  perfectOutcomeWords.forEach(word => {
    if (answer.includes(word)) perfectCount++;
  });

  const lackOfFailurePhrases = ['没有遇到什么困难', '一切顺利', '没有失败', '很顺利'];
  const hasNoFailure = lackOfFailurePhrases.some(phrase => answer.includes(phrase));

  const packagingIndex = strongClaimCount * 2 + perfectCount * 3 + (hasNoFailure ? 5 : 0);

  let severity = 'none';
  if (packagingIndex > 15) severity = 'high';
  else if (packagingIndex > 10) severity = 'medium';
  else if (packagingIndex > 5) severity = 'low';

  return {
    detected: packagingIndex > 10,
    severity,
    details: { strongClaimCount, perfectCount, hasNoFailure, packagingIndex }
  };
}

// 检测准备痕迹
function detectPreparationTraces(answer) {
  const structureWords = ['首先', '其次', '再次', '最后', '第一', '第二', '第三', '总之', '综上所述'];
  const structureMatches = structureWords.filter(word => answer.includes(word));

  const standardPhrases = [
    '我认为这个问题可以从以下几个方面来回答',
    '综上所述，我的观点是',
    '这是一个很好的问题',
    '感谢您的提问'
  ];
  const phraseMatches = standardPhrases.filter(phrase => answer.includes(phrase));

  const preparationIndex = structureMatches.length * 2 + phraseMatches.length * 3;

  let severity = 'none';
  if (preparationIndex > 10) severity = 'high';
  else if (preparationIndex > 5) severity = 'medium';
  else if (preparationIndex > 2) severity = 'low';

  return {
    detected: preparationIndex > 5,
    severity,
    details: { structureMatches, phraseMatches, preparationIndex }
  };
}

// 综合负面回答检测
function detectNegativeAnswer(answer, question) {
  const results = [];

  const clicheResult = detectClicheAnswer(answer);
  if (clicheResult.detected) {
    results.push({ type: 'cliche', severity: clicheResult.severity, details: clicheResult.details });
  }

  const evasiveResult = detectEvasiveAnswer(answer, question);
  if (evasiveResult.detected) {
    results.push({ type: 'evasive', severity: evasiveResult.severity, details: evasiveResult.details });
  }

  const packagingResult = detectOverPackaging(answer);
  if (packagingResult.detected) {
    results.push({ type: 'overPackaging', severity: packagingResult.severity, details: packagingResult.details });
  }

  const preparationResult = detectPreparationTraces(answer);
  if (preparationResult.detected) {
    results.push({ type: 'preparation', severity: preparationResult.severity, details: preparationResult.details });
  }

  // 计算总体严重程度
  let overallSeverity = 'none';
  if (results.length > 0) {
    const highCount = results.filter(r => r.severity === 'high').length;
    const mediumCount = results.filter(r => r.severity === 'medium').length;
    if (highCount >= 1) overallSeverity = 'high';
    else if (mediumCount >= 2) overallSeverity = 'high';
    else if (mediumCount >= 1) overallSeverity = 'medium';
    else overallSeverity = 'low';
  }

  return {
    hasNegativeIndicators: results.length > 0,
    overallSeverity,
    indicators: results
  };
}

// ========================================
// 执行测试
// ========================================
console.log('================================================================================');
console.log('                    P1优先级改进 - 验证测试');
console.log('================================================================================');
console.log('测试日期: ' + new Date().toISOString().split('T')[0]);
console.log('测试范围: 难度分级体系 + 岗位权重配置 + 负面回答检测');
console.log('');

let passCount = 0;
let failCount = 0;

function test(name, condition, details) {
  if (condition) {
    console.log('[PASS] ' + name);
    if (details) console.log('       ' + details);
    passCount++;
  } else {
    console.log('[FAIL] ' + name);
    if (details) console.log('       ' + details);
    failCount++;
  }
}

// ========================================
// 测试1：难度等级判断
// ========================================
console.log('================================================================================');
console.log('【测试1：难度等级判断】');
console.log('================================================================================');

const level1 = determineDifficultyLevel('高级前端工程师', null);
test('1.1 "高级前端工程师" 应识别为 SENIOR', level1.levelKey === 'SENIOR', 'levelKey: ' + level1.levelKey);

const level2 = determineDifficultyLevel('实习生', null);
test('1.2 "实习生" 应识别为 JUNIOR', level2.levelKey === 'JUNIOR', 'levelKey: ' + level2.levelKey);

const level3 = determineDifficultyLevel('技术人员', '8年');
test('1.3 "8年经验" 应识别为 EXPERT', level3.levelKey === 'EXPERT', 'levelKey: ' + level3.levelKey);

const level4 = determineDifficultyLevel('架构师', null);
test('1.4 "架构师" 应识别为 EXPERT', level4.levelKey === 'EXPERT', 'levelKey: ' + level4.levelKey);

const level5 = determineDifficultyLevel('Java开发工程师', '3年');
test('1.5 "3年经验工程师" 应识别为 MID_LEVEL', level5.levelKey === 'MID_LEVEL', 'levelKey: ' + level5.levelKey);

const fresh1 = detectFreshGraduate('我是应届毕业生，在校期间参加了校园招聘...');
test('1.6 应届生简历应被检测', fresh1 === true, 'isFresh: ' + fresh1);

const fresh2 = detectFreshGraduate('工作经历：2018-2023年在阿里巴巴任职...');
test('1.7 有工作经历的简历不应被识别为应届生', fresh2 === false, 'isFresh: ' + fresh2);

// ========================================
// 测试2：岗位权重匹配
// ========================================
console.log('');
console.log('================================================================================');
console.log('【测试2：岗位权重匹配】');
console.log('================================================================================');

const weight1 = matchPositionWeightTemplate('后端开发工程师');
test('2.1 "后端开发工程师" IQ权重应为60', weight1.iq === 60, 'template: ' + weight1.name + ', IQ: ' + weight1.iq);

const weight2 = matchPositionWeightTemplate('销售经理');
test('2.2 "销售经理" 应匹配销售类模板', weight2.category === 'sales', 'template: ' + weight2.name + ', EQ: ' + weight2.eq);

const weight3 = matchPositionWeightTemplate('财务会计');
test('2.3 "财务会计" MQ权重应为25', weight3.mq === 25, 'template: ' + weight3.name + ', MQ: ' + weight3.mq);

const weight4 = matchPositionWeightTemplate('产品经理');
test('2.4 "产品经理" EQ权重应为30', weight4.eq === 30, 'template: ' + weight4.name + ', EQ: ' + weight4.eq);

const validWeights = { iq: 50, eq: 20, aq: 15, mq: 15 };
const validate1 = validateWeights(validWeights);
test('2.5 有效权重配置应通过验证', validate1.valid === true, 'message: ' + validate1.message);

const invalidWeights = { iq: 50, eq: 30, aq: 10, mq: 5 };
const validate2 = validateWeights(invalidWeights);
test('2.6 权重总和不为100应验证失败', validate2.valid === false, 'message: ' + validate2.message);

const weight5 = matchPositionWeightTemplate('未知岗位');
test('2.7 未知岗位应返回默认权重', weight5.templateKey === 'default', 'template: ' + weight5.name);

// ========================================
// 测试3：负面回答检测 - 套话
// ========================================
console.log('');
console.log('================================================================================');
console.log('【测试3：负面回答检测 - 套话回答】');
console.log('================================================================================');

const cliche1 = detectClicheAnswer('我性格开朗，善于沟通，工作认真，责任心强，有团队精神');
test('3.1 多个套话词应检测出套话回答', cliche1.detected === true, 'clicheCount: ' + cliche1.details.clicheCount);

const cliche2 = detectClicheAnswer('我在项目中负责核心模块的开发，完成了三个重要的功能迭代');
test('3.2 无套话的回答不应被检测', cliche2.detected === false, 'clicheCount: ' + cliche2.details.clicheCount);

// ========================================
// 测试4：负面回答检测 - 回避性回答
// ========================================
console.log('');
console.log('================================================================================');
console.log('【测试4：负面回答检测 - 回避性回答】');
console.log('================================================================================');

const evasive1 = detectEvasiveAnswer('这个情况比较复杂，涉及到很多因素，不太好说', '请描述你的项目经验');
test('4.1 回避性词汇应被检测', evasive1.detected === true, 'avoidanceIndex: ' + evasive1.details.avoidanceIndex);

const evasive2 = detectEvasiveAnswer('我在项目中使用了React和TypeScript，完成了用户管理模块的开发', '请描述你的技术栈');
test('4.2 正常回答不应被检测为回避', evasive2.detected === false, 'avoidanceIndex: ' + evasive2.details.avoidanceIndex);

// ========================================
// 测试5：负面回答检测 - 过度包装
// ========================================
console.log('');
console.log('================================================================================');
console.log('【测试5：负面回答检测 - 过度包装】');
console.log('================================================================================');

const packaging1 = detectOverPackaging('我主导了所有核心项目，完美完成了所有任务，没有任何问题，一切都零缺陷');
test('5.1 过度包装的回答应被检测', packaging1.detected === true, 'packagingIndex: ' + packaging1.details.packagingIndex);

const packaging2 = detectOverPackaging('我参与了项目开发，遇到了一些技术难题，通过团队协作解决了问题');
test('5.2 正常回答不应被检测为过度包装', packaging2.detected === false, 'packagingIndex: ' + packaging2.details.packagingIndex);

// ========================================
// 测试6：负面回答检测 - 准备痕迹
// ========================================
console.log('');
console.log('================================================================================');
console.log('【测试6：负面回答检测 - 准备痕迹】');
console.log('================================================================================');

const prep1 = detectPreparationTraces('首先，我认为这个问题可以从以下几个方面来回答。其次，我想说的是...最后，综上所述，我的观点是...');
test('6.1 明显的准备痕迹应被检测', prep1.detected === true, 'preparationIndex: ' + prep1.details.preparationIndex);

const prep2 = detectPreparationTraces('在这个项目中，我主要负责后端接口开发，用了Spring Boot框架');
test('6.2 正常回答不应被检测为准备痕迹', prep2.detected === false, 'preparationIndex: ' + prep2.details.preparationIndex);

// ========================================
// 测试7：综合负面回答检测
// ========================================
console.log('');
console.log('================================================================================');
console.log('【测试7：综合负面回答检测】');
console.log('================================================================================');

const negative1 = detectNegativeAnswer('我性格开朗，善于沟通，工作认真。首先，这个情况比较复杂...', '请描述项目经验');
test('7.1 多种负面指标的回答应有综合检测结果', negative1.hasNegativeIndicators === true, 'severity: ' + negative1.overallSeverity + ', indicators: ' + negative1.indicators.length);

const negative2 = detectNegativeAnswer('我在项目中使用了Spring Boot框架，完成了用户管理模块的开发，解决了并发问题', '请描述项目经验');
test('7.2 正常回答不应有负面指标', negative2.hasNegativeIndicators === false, 'indicators: ' + negative2.indicators.length);

// ========================================
// 测试8：题目数量与难度关联
// ========================================
console.log('');
console.log('================================================================================');
console.log('【测试8：题目数量与难度关联】');
console.log('================================================================================');

test('8.1 JUNIOR难度题目数量应为8', difficultyLevels.JUNIOR.questionCount === 8);
test('8.2 MID_LEVEL难度题目数量应为10', difficultyLevels.MID_LEVEL.questionCount === 10);
test('8.3 SENIOR难度题目数量应为12', difficultyLevels.SENIOR.questionCount === 12);
test('8.4 EXPERT难度题目数量应为12', difficultyLevels.EXPERT.questionCount === 12);

// ========================================
// 测试总结
// ========================================
console.log('');
console.log('================================================================================');
console.log('测试总结');
console.log('================================================================================');
console.log('通过: ' + passCount + ' 个');
console.log('失败: ' + failCount + ' 个');
console.log('总计: ' + (passCount + failCount) + ' 个');
console.log('通过率: ' + ((passCount / (passCount + failCount)) * 100).toFixed(1) + '%');

if (failCount === 0) {
  console.log('');
  console.log('[SUCCESS] 所有测试通过！P1改进验证成功！');
  process.exit(0);
} else {
  console.log('');
  console.log('[WARNING] 存在失败的测试，请检查相关代码！');
  process.exit(1);
}
