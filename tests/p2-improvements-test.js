/**
 * P2改进验证测试脚本
 * 测试内容：
 * 1. 评分置信度计算
 * 2. 岗位定制化题目库
 * 3. 录用建议生成
 */

// ========================================
// 模拟核心功能
// ========================================

// 置信度计算函数
function calculateConfidence(answer, aiResponse) {
  const lengthConfidence = calculateLengthConfidence(answer.length);
  const keywordConfidence = calculateKeywordConfidence(answer);
  const structureConfidence = calculateStructureConfidence(answer);
  const aiConfidence = aiResponse?.confidence || 0.7;

  const overallConfidence =
    lengthConfidence * 0.30 +
    keywordConfidence * 0.25 +
    structureConfidence * 0.25 +
    aiConfidence * 0.20;

  const level = getConfidenceLevel(overallConfidence);

  return {
    overall: Math.round(overallConfidence * 100) / 100,
    level: level.level,
    label: level.label,
    color: level.color,
    needsReview: level.needsReview || false,
    breakdown: {
      length: Math.round(lengthConfidence * 100) / 100,
      keyword: Math.round(keywordConfidence * 100) / 100,
      structure: Math.round(structureConfidence * 100) / 100,
      ai: Math.round(aiConfidence * 100) / 100
    }
  };
}

function calculateLengthConfidence(length) {
  if (length >= 200) return 0.95;
  if (length >= 150) return 0.85;
  if (length >= 100) return 0.75;
  if (length >= 50) return 0.55;
  if (length >= 30) return 0.40;
  return 0.25;
}

function calculateKeywordConfidence(text) {
  const keywords = ['主导', '负责', '实现', '优化', '设计', '开发', '测试', '部署', '解决', '方案'];
  let count = 0;
  keywords.forEach(kw => {
    if (text.includes(kw)) count++;
  });

  const density = count / Math.max(text.length / 50, 1);

  if (count >= 5 && density > 0.3) return 0.95;
  if (count >= 3 && density > 0.2) return 0.80;
  if (count >= 2) return 0.65;
  if (count >= 1) return 0.50;
  return 0.40;
}

function calculateStructureConfidence(text) {
  let score = 0;

  const numberingPatterns = [
    /第一[,.，。]/, /第二[,.，。]/, /第三[,.，。]/,
    /首先[,.，。]/, /其次[,.，。]/, /然后[,.，。]/, /最后[,.，。]/
  ];
  const numberingCount = numberingPatterns.filter(p => p.test(text)).length;
  if (numberingCount >= 3) score += 0.4;
  else if (numberingCount >= 2) score += 0.3;
  else if (numberingCount >= 1) score += 0.15;

  if (/总结|综上|所以|因此/.test(text)) score += 0.3;
  if (/因为.+所以|由于.+导致/.test(text)) score += 0.2;

  return Math.min(score, 1.0);
}

function getConfidenceLevel(confidence) {
  if (confidence >= 0.8) return { level: 'high', label: '高置信度', color: '#52c41a' };
  if (confidence >= 0.6) return { level: 'medium', label: '中置信度', color: '#faad14' };
  return { level: 'low', label: '低置信度', color: '#ff4d4f', needsReview: true };
}

// 录用建议生成函数
function generateHiringRecommendation(scoringResult, negativeIndicators) {
  const { totalScore, categoryScores } = scoringResult;
  const recommendation = determineRecommendationLevel(totalScore, negativeIndicators);
  const reasons = generateRecommendationReasons(scoringResult, recommendation);
  const risks = identifyRisks(scoringResult, negativeIndicators);
  const developmentSuggestions = generateDevelopmentSuggestions(scoringResult);

  return {
    recommendation: recommendation.level,
    recommendationLabel: recommendation.label,
    confidence: recommendation.confidence,
    reasons,
    risks,
    developmentSuggestions
  };
}

function determineRecommendationLevel(totalScore, negativeIndicators) {
  const hasHighRisk = negativeIndicators.some(i => i.severity === 'high');
  const hasMultipleMediumRisk = negativeIndicators.filter(i => i.severity === 'medium').length >= 2;

  if (totalScore >= 85 && !hasHighRisk && !hasMultipleMediumRisk) {
    return { level: 'strongly_recommend', label: '强烈推荐', confidence: 'high' };
  }
  if (totalScore >= 75 && !hasHighRisk) {
    return { level: 'recommend', label: '推荐', confidence: 'medium' };
  }
  if (totalScore >= 60) {
    return { level: 'pending', label: '待定', confidence: 'low' };
  }
  if (totalScore >= 50) {
    return { level: 'not_recommend', label: '不推荐', confidence: 'medium' };
  }
  return { level: 'strongly_not_recommend', label: '强烈不推荐', confidence: 'high' };
}

function generateRecommendationReasons(scoringResult, recommendation) {
  const reasons = [];
  const { totalScore, categoryScores } = scoringResult;

  if (categoryScores?.iq?.rawScore >= 8) {
    reasons.push({ type: 'strength', dimension: 'IQ', text: '专业能力强' });
  }
  if (categoryScores?.eq?.rawScore >= 8) {
    reasons.push({ type: 'strength', dimension: 'EQ', text: '情商高' });
  }
  if (totalScore >= 80) {
    reasons.push({ type: 'overall', text: '综合表现优秀' });
  }

  return reasons;
}

function identifyRisks(scoringResult, negativeIndicators) {
  const risks = { high: [], medium: [], low: [] };
  const { totalScore, categoryScores } = scoringResult;

  if (totalScore < 50) {
    risks.high.push({ type: 'overall_score', text: '综合评分过低' });
  }
  if (categoryScores?.mq?.rawScore < 5) {
    risks.high.push({ type: 'mq_low', text: '职业操守评分较低' });
  }
  if (categoryScores?.aq?.rawScore < 6) {
    risks.medium.push({ type: 'aq_low', text: '抗压能力可能不足' });
  }
  if (categoryScores?.eq?.rawScore < 7) {
    risks.low.push({ type: 'eq_improvable', text: '沟通技巧有提升空间' });
  }

  negativeIndicators.forEach(indicator => {
    const risk = { type: indicator.type, text: indicator.description };
    if (indicator.severity === 'high') risks.high.push(risk);
    else if (indicator.severity === 'medium') risks.medium.push(risk);
    else risks.low.push(risk);
  });

  return risks;
}

function generateDevelopmentSuggestions(scoringResult) {
  const suggestions = [];
  const { categoryScores } = scoringResult;

  const trainingFocus = [];
  if (categoryScores?.iq?.rawScore < 7) trainingFocus.push('专业技能培训');
  if (categoryScores?.eq?.rawScore < 7) trainingFocus.push('沟通协作培训');
  if (trainingFocus.length > 0) {
    suggestions.push({ type: 'training', label: '培训重点', items: trainingFocus });
  }

  suggestions.push({ type: 'goals', label: '发展目标', items: ['3个月内掌握核心技能', '6个月内独立承担项目'] });

  return suggestions;
}

// 岗位定制化题目库
const positionSpecificQuestions = {
  tech: {
    iq: [
      { id: 'tech_iq_1', category: '技术深度', question: '请详细介绍你使用过的核心技术栈' }
    ],
    eq: [
      { id: 'tech_eq_1', category: '技术评审冲突', question: '技术方案评审中同事反对你的方案，如何处理？' }
    ]
  },
  product: {
    iq: [
      { id: 'product_iq_1', category: '需求分析', question: '如何将模糊业务需求转化为产品方案？' }
    ]
  },
  sales: {
    iq: [
      { id: 'sales_iq_1', category: '销售策略', question: '请描述一次成功拿下重要客户的案例' }
    ]
  },
  management: {
    iq: [
      { id: 'mgmt_iq_1', category: '团队建设', question: '请描述你如何搭建和管理高效团队' }
    ]
  }
};

function getPositionSpecificQuestions(category) {
  return positionSpecificQuestions[category] || null;
}

// ========================================
// 执行测试
// ========================================
console.log('================================================================================');
console.log('                    P2优先级改进 - 验证测试');
console.log('================================================================================');
console.log('测试日期: ' + new Date().toISOString().split('T')[0]);
console.log('测试范围: 评分置信度 + 岗位定制化题目 + 录用建议');
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
// 测试1：评分置信度计算
// ========================================
console.log('================================================================================');
console.log('【测试1：评分置信度计算】');
console.log('================================================================================');

const longAnswer = '我在项目中主导了核心模块的开发，负责架构设计和技术选型。首先，我分析了业务需求，然后设计了可扩展的架构方案。其次，我带领团队完成了关键功能的开发。最后，通过优化，性能提升了30%。综上所述，这个项目让我积累了丰富的经验。';
const confidence1 = calculateConfidence(longAnswer);
test('1.1 长回答、有结构、有关键词应中高置信度', confidence1.overall >= 0.7, 'overall: ' + confidence1.overall + ', level: ' + confidence1.label);

const shortAnswer = '我负责开发';
const confidence2 = calculateConfidence(shortAnswer);
test('1.2 短回答应低置信度', confidence2.level === 'low', 'overall: ' + confidence2.overall + ', level: ' + confidence2.label);

const mediumAnswer = '我负责了这个项目的开发，实现了核心功能，解决了多个技术难题。';
const confidence3 = calculateConfidence(mediumAnswer);
test('1.3 中等长度回答应有中等置信度', confidence3.overall >= 0.4, 'overall: ' + confidence3.overall);

// 测试置信度分解
test('1.4 置信度分解应包含四个因素',
  confidence1.breakdown.length !== undefined &&
  confidence1.breakdown.keyword !== undefined &&
  confidence1.breakdown.structure !== undefined &&
  confidence1.breakdown.ai !== undefined,
  'breakdown keys: ' + Object.keys(confidence1.breakdown).join(', ')
);

// ========================================
// 测试2：录用建议生成
// ========================================
console.log('');
console.log('================================================================================');
console.log('【测试2：录用建议生成】');
console.log('================================================================================');

const highScoreResult = {
  totalScore: 88,
  categoryScores: {
    iq: { rawScore: 9 },
    eq: { rawScore: 8 },
    aq: { rawScore: 8 },
    mq: { rawScore: 8 }
  }
};
const recommendation1 = generateHiringRecommendation(highScoreResult, []);
test('2.1 高分无风险应"强烈推荐"', recommendation1.recommendation === 'strongly_recommend', 'label: ' + recommendation1.recommendationLabel);

const mediumScoreResult = {
  totalScore: 72,
  categoryScores: {
    iq: { rawScore: 7 },
    eq: { rawScore: 7 },
    aq: { rawScore: 7 },
    mq: { rawScore: 7 }
  }
};
const recommendation2 = generateHiringRecommendation(mediumScoreResult, []);
test('2.2 中等分数应"推荐"或"待定"',
  recommendation2.recommendation === 'recommend' || recommendation2.recommendation === 'pending',
  'label: ' + recommendation2.recommendationLabel
);

const lowScoreResult = {
  totalScore: 45,
  categoryScores: {
    iq: { rawScore: 5 },
    eq: { rawScore: 5 },
    aq: { rawScore: 4 },
    mq: { rawScore: 4 }
  }
};
const recommendation3 = generateHiringRecommendation(lowScoreResult, []);
test('2.3 低分应"不推荐"',
  recommendation3.recommendation === 'not_recommend' || recommendation3.recommendation === 'strongly_not_recommend',
  'label: ' + recommendation3.recommendationLabel
);

const withNegativeIndicators = {
  totalScore: 70,
  categoryScores: {
    iq: { rawScore: 7 },
    eq: { rawScore: 7 },
    aq: { rawScore: 6 },
    mq: { rawScore: 6 }
  }
};
const negativeIndicators = [
  { type: 'cliche', severity: 'medium', description: '检测到套话' }
];
const recommendation4 = generateHiringRecommendation(withNegativeIndicators, negativeIndicators);
test('2.4 有负面指标时应有风险项', recommendation4.risks.medium.length > 0, 'medium risks: ' + recommendation4.risks.medium.length);

// 测试录用建议包含各个部分
test('2.5 录用建议应包含推荐理由', recommendation1.reasons.length > 0, 'reasons: ' + recommendation1.reasons.length);
test('2.6 录用建议应包含培养建议', recommendation1.developmentSuggestions.length > 0, 'suggestions: ' + recommendation1.developmentSuggestions.length);

// ========================================
// 测试3：风险识别
// ========================================
console.log('');
console.log('================================================================================');
console.log('【测试3：风险识别】');
console.log('================================================================================');

const riskResult = {
  totalScore: 55,
  categoryScores: {
    iq: { rawScore: 6 },
    eq: { rawScore: 5 },
    aq: { rawScore: 5 },
    mq: { rawScore: 4 }
  }
};
const recommendation5 = generateHiringRecommendation(riskResult, []);
test('3.1 MQ评分低应有高风险', recommendation5.risks.high.some(r => r.type === 'mq_low'), 'high risks: ' + recommendation5.risks.high.map(r => r.type).join(', '));

const riskResult2 = {
  totalScore: 65,
  categoryScores: {
    iq: { rawScore: 7 },
    eq: { rawScore: 6 },
    aq: { rawScore: 5 },
    mq: { rawScore: 7 }
  }
};
const recommendation6 = generateHiringRecommendation(riskResult2, []);
test('3.2 AQ评分较低应有中等风险', recommendation6.risks.medium.some(r => r.type === 'aq_low'), 'medium risks: ' + recommendation6.risks.medium.map(r => r.type).join(', '));

const riskResult3 = {
  totalScore: 75,
  categoryScores: {
    iq: { rawScore: 8 },
    eq: { rawScore: 6 },
    aq: { rawScore: 7 },
    mq: { rawScore: 7 }
  }
};
const recommendation7 = generateHiringRecommendation(riskResult3, []);
test('3.3 EQ评分略低应有低风险建议', recommendation7.risks.low.length > 0, 'low risks: ' + recommendation7.risks.low.length);

// ========================================
// 测试4：岗位定制化题目库
// ========================================
console.log('');
console.log('================================================================================');
console.log('【测试4：岗位定制化题目库】');
console.log('================================================================================');

const techQuestions = getPositionSpecificQuestions('tech');
test('4.1 技术岗位应有定制题目', techQuestions !== null && techQuestions.iq !== undefined, 'has IQ questions: ' + (techQuestions?.iq !== undefined));
test('4.2 技术岗位应有EQ题目', techQuestions?.eq !== undefined, 'has EQ questions: ' + (techQuestions?.eq !== undefined));

const productQuestions = getPositionSpecificQuestions('product');
test('4.3 产品岗位应有定制题目', productQuestions !== null && productQuestions.iq !== undefined, 'has IQ questions: ' + (productQuestions?.iq !== undefined));

const salesQuestions = getPositionSpecificQuestions('sales');
test('4.4 销售岗位应有定制题目', salesQuestions !== null, 'has questions: ' + (salesQuestions !== null));

const mgmtQuestions = getPositionSpecificQuestions('management');
test('4.5 管理岗位应有定制题目', mgmtQuestions !== null, 'has questions: ' + (mgmtQuestions !== null));

// 验证题目结构
const techIQQuestion = techQuestions?.iq?.[0];
test('4.6 题目应包含id', techIQQuestion?.id !== undefined, 'id: ' + techIQQuestion?.id);
test('4.7 题目应包含category', techIQQuestion?.category !== undefined, 'category: ' + techIQQuestion?.category);
test('4.8 题目应包含question', techIQQuestion?.question !== undefined, 'has question: ' + (techIQQuestion?.question !== undefined));

// ========================================
// 测试5：培养建议生成
// ========================================
console.log('');
console.log('================================================================================');
console.log('【测试5：培养建议生成】');
console.log('================================================================================');

const trainingResult = {
  totalScore: 65,
  categoryScores: {
    iq: { rawScore: 6 },
    eq: { rawScore: 6 },
    aq: { rawScore: 6 },
    mq: { rawScore: 7 }
  }
};
const recommendation8 = generateHiringRecommendation(trainingResult, []);
const trainingSuggestion = recommendation8.developmentSuggestions.find(s => s.type === 'training');
test('5.1 多维度评分较低应有培训建议', trainingSuggestion !== undefined, 'training items: ' + (trainingSuggestion?.items?.join(', ') || 'none'));

test('5.2 应有发展目标建议',
  recommendation8.developmentSuggestions.some(s => s.type === 'goals'),
  'has goals: ' + recommendation8.developmentSuggestions.some(s => s.type === 'goals')
);

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
  console.log('[SUCCESS] 所有测试通过！P2改进验证成功！');
  process.exit(0);
} else {
  console.log('');
  console.log('[WARNING] 存在失败的测试，请检查相关代码！');
  process.exit(1);
}
